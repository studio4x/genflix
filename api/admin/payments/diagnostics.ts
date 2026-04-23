import { createClient } from '@supabase/supabase-js'

import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getBearerToken,
  getConfiguredAsaasWebhookSecrets,
  getHeaderValue,
} from '../../_shared/asaas.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type DiagnosticStatus = 'ok' | 'warning' | 'error'

type DiagnosticCheck = {
  key: string
  label: string
  status: DiagnosticStatus
  detail: string
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function hasEnvironmentToken(environment: 'sandbox' | 'production') {
  if (environment === 'sandbox') {
    return Boolean(process.env.ASAAS_ACCESS_TOKEN_SANDBOX ?? process.env.ASAAS_ACCESS_TOKEN)
  }

  return Boolean(process.env.ASAAS_ACCESS_TOKEN_PRODUCTION ?? process.env.ASAAS_ACCESS_TOKEN)
}

function hasEnvironmentWebhookSecret(environment: 'sandbox' | 'production') {
  if (environment === 'sandbox') {
    return Boolean(process.env.ASAAS_WEBHOOK_SECRET_SANDBOX ?? process.env.ASAAS_WEBHOOK_SECRET)
  }

  return Boolean(process.env.ASAAS_WEBHOOK_SECRET_PRODUCTION ?? process.env.ASAAS_WEBHOOK_SECRET)
}

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'ConfiguraÃ§Ã£o ausente: Supabase URL e service role sÃ£o obrigatÃ³rios.' })
    return null
  }

  const token = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!token) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const userResult = await adminClient.auth.getUser(token)
  if (userResult.error || !userResult.data.user) {
    jsonResponse(res, 401, { error: 'Token invÃ¡lido ou expirado.' })
    return null
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id)

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'NÃ£o foi possÃ­vel validar as permissÃµes do usuÃ¡rio.' })
    return null
  }

  const roles = ((rolesResult.data as Array<{ roles: { code: string } | { code: string }[] | null }> | null) ?? [])
    .flatMap((relation) => {
      if (!relation.roles) {
        return []
      }

      return Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    })
    .map((role) => role.code)

  if (!roles.includes('admin')) {
    jsonResponse(res, 403, { error: 'Apenas administradores podem diagnosticar pagamentos.' })
    return null
  }

  return { supabaseUrl, serviceRoleKey }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'GET') {
    jsonResponse(res, 405, { error: 'MÃ©todo nÃ£o permitido.' })
    return
  }

  const context = await assertAdmin(req, res)
  if (!context) {
    return
  }

  const checks: DiagnosticCheck[] = [
    {
      key: 'supabase-service-role',
      label: 'Service role do Supabase',
      status: 'ok',
      detail: 'VariÃ¡vel disponÃ­vel no ambiente do deploy.',
    },
  ]

  try {
    const gatewayConfig = await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)
    const activeEnvironment = gatewayConfig.environment ?? 'sandbox'
    const asaasToken = getAsaasAccessToken(activeEnvironment)
    const webhookSecrets = getConfiguredAsaasWebhookSecrets()
    const hasSandboxToken = hasEnvironmentToken('sandbox')
    const hasProductionToken = hasEnvironmentToken('production')
    const hasSandboxWebhookSecret = hasEnvironmentWebhookSecret('sandbox')
    const hasProductionWebhookSecret = hasEnvironmentWebhookSecret('production')

    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas' ? 'ok' : 'error',
      detail:
        gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas'
          ? `Asaas ativo em ${activeEnvironment}.`
          : 'Gateway inativo ou diferente de Asaas.',
    })

    checks.push({
      key: 'asaas-active-token',
      label: `Token Asaas do ambiente ativo (${activeEnvironment})`,
      status: asaasToken ? 'ok' : 'error',
      detail: asaasToken
        ? 'Token encontrado no ambiente do deploy.'
        : `Configure ASAAS_ACCESS_TOKEN_${activeEnvironment.toUpperCase()} ou ASAAS_ACCESS_TOKEN.`,
    })

    checks.push({
      key: 'asaas-sandbox-token',
      label: 'Token Asaas sandbox',
      status: hasSandboxToken ? 'ok' : activeEnvironment === 'sandbox' ? 'error' : 'warning',
      detail: hasSandboxToken
        ? 'Credencial sandbox disponÃ­vel para testes controlados.'
        : 'Configure ASAAS_ACCESS_TOKEN_SANDBOX antes de validar compras e repasses em sandbox.',
    })

    checks.push({
      key: 'asaas-production-token',
      label: 'Token Asaas produÃ§Ã£o',
      status: hasProductionToken ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasProductionToken
        ? 'Credencial de produÃ§Ã£o disponÃ­vel para operaÃ§Ã£o real.'
        : 'ProduÃ§Ã£o ainda pendente. Configure ASAAS_ACCESS_TOKEN_PRODUCTION quando a conta Asaas final estiver aprovada.',
    })

    checks.push({
      key: 'webhook-secret',
      label: 'Segredo do webhook',
      status: webhookSecrets.length > 0 ? 'ok' : 'warning',
      detail: webhookSecrets.length > 0
        ? 'Webhook com segredo configurado para pelo menos um ambiente do Asaas.'
        : 'Webhook sem segredo dedicado. Funciona, mas recomenda-se configurar ASAAS_WEBHOOK_SECRET.',
    })

    checks.push({
      key: 'webhook-secret-sandbox',
      label: 'Segredo do webhook sandbox',
      status: hasSandboxWebhookSecret ? 'ok' : activeEnvironment === 'sandbox' ? 'error' : 'warning',
      detail: hasSandboxWebhookSecret
        ? 'Segredo do webhook sandbox disponÃ­vel.'
        : 'Configure ASAAS_WEBHOOK_SECRET_SANDBOX antes de validar callbacks em sandbox.',
    })

    checks.push({
      key: 'webhook-secret-production',
      label: 'Segredo do webhook produÃ§Ã£o',
      status: hasProductionWebhookSecret ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasProductionWebhookSecret
        ? 'Segredo do webhook produÃ§Ã£o disponÃ­vel.'
        : 'Configure ASAAS_WEBHOOK_SECRET_PRODUCTION ou ASAAS_WEBHOOK_SECRET para callbacks de produÃ§Ã£o.',
    })

    checks.push({
      key: 'public-url',
      label: 'URL pÃºblica do app',
      status: process.env.APP_PUBLIC_URL || process.env.VERCEL_URL ? 'ok' : 'warning',
      detail: process.env.APP_PUBLIC_URL
        ? `APP_PUBLIC_URL configurada: ${process.env.APP_PUBLIC_URL}.`
        : 'APP_PUBLIC_URL nÃ£o configurada. O sistema usarÃ¡ a origem da requisiÃ§Ã£o para montar callbacks e webhook.',
    })

    jsonResponse(res, 200, {
      environment: activeEnvironment,
      checkedAt: new Date().toISOString(),
      checks,
    })
  } catch (error) {
    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: 'error',
      detail: error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel carregar a configuraÃ§Ã£o do gateway.',
    })

    jsonResponse(res, 200, {
      environment: null,
      checkedAt: new Date().toISOString(),
      checks,
    })
  }
}
