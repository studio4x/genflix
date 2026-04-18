import { createClient } from '@supabase/supabase-js'

import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getBearerToken,
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

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração ausente: Supabase URL e service role são obrigatórios.' })
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
    jsonResponse(res, 401, { error: 'Token inválido ou expirado.' })
    return null
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id)

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'Não foi possível validar as permissões do usuário.' })
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
    jsonResponse(res, 405, { error: 'Método não permitido.' })
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
      detail: 'Variável disponível no ambiente do deploy.',
    },
  ]

  try {
    const gatewayConfig = await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)
    const asaasToken = getAsaasAccessToken(gatewayConfig.environment)
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET

    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas' ? 'ok' : 'error',
      detail:
        gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas'
          ? `Asaas ativo em ${gatewayConfig.environment}.`
          : 'Gateway inativo ou diferente de Asaas.',
    })

    checks.push({
      key: 'asaas-token',
      label: `Token Asaas ${gatewayConfig.environment}`,
      status: asaasToken ? 'ok' : 'error',
      detail: asaasToken
        ? 'Token encontrado no ambiente do deploy.'
        : `Configure ASAAS_ACCESS_TOKEN_${gatewayConfig.environment.toUpperCase()} ou ASAAS_ACCESS_TOKEN.`,
    })

    checks.push({
      key: 'webhook-secret',
      label: 'Segredo do webhook',
      status: webhookSecret ? 'ok' : 'warning',
      detail: webhookSecret
        ? 'ASAAS_WEBHOOK_SECRET configurado.'
        : 'Webhook sem segredo dedicado. Funciona, mas recomenda-se configurar ASAAS_WEBHOOK_SECRET.',
    })

    jsonResponse(res, 200, {
      environment: gatewayConfig.environment,
      checkedAt: new Date().toISOString(),
      checks,
    })
  } catch (error) {
    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Não foi possível carregar a configuração do gateway.',
    })

    jsonResponse(res, 200, {
      environment: null,
      checkedAt: new Date().toISOString(),
      checks,
    })
  }
}
