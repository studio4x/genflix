import { createClient } from '@supabase/supabase-js'

import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getAsaasBaseUrl,
  getBearerToken,
  getConfiguredAsaasWebhookSecrets,
  getHeaderValue,
} from '../../_shared/asaas.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
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

type SessionRow = {
  id: string
  external_payment_id: string | null
  gateway_environment: 'sandbox' | 'production' | null
  checkout_url: string | null
  raw_response: Record<string, unknown> | null
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

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readNestedString(source: Record<string, unknown> | null, path: string[]) {
  let cursor: unknown = source
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') {
      return null
    }
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return readString(cursor)
}

async function resolveInvoiceUrlFromAsaas(input: {
  paymentId: string
  environment: 'sandbox' | 'production'
  accessToken: string
}) {
  const response = await fetch(`${getAsaasBaseUrl(input.environment)}/v3/payments/${input.paymentId}`, {
    method: 'GET',
    headers: {
      access_token: input.accessToken,
    },
  })

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload) {
    return null
  }

  return (
    readString(payload.invoiceUrl) ??
    readString(payload.bankSlipUrl) ??
    readString(payload.transactionReceiptUrl) ??
    null
  )
}

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao ausente: Supabase URL e service role sao obrigatorios.' })
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
    jsonResponse(res, 401, { error: 'Token invalido ou expirado.' })
    return null
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id)

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel validar as permissoes do usuario.' })
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

  return { supabaseUrl, serviceRoleKey, adminClient }
}

async function handleResolveInvoiceUrl(req: ApiRequest, res: ApiResponse, context: NonNullable<Awaited<ReturnType<typeof assertAdmin>>>) {
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as { sessionId?: string }
  const sessionId = readString(body?.sessionId)

  if (!sessionId) {
    jsonResponse(res, 400, { error: 'sessionId obrigatorio.' })
    return
  }

  const sessionResult = await context.adminClient
    .from('commerce_checkout_sessions')
    .select('id, external_payment_id, gateway_environment, checkout_url, raw_response')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel carregar o pedido.' })
    return
  }

  const session = (sessionResult.data ?? null) as SessionRow | null
  if (!session) {
    jsonResponse(res, 404, { error: 'Pedido nao encontrado.' })
    return
  }

  const paymentId = readString(session.external_payment_id)
  const environment = session.gateway_environment ?? (await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)).environment ?? 'sandbox'
  const asaasToken = getAsaasAccessToken(environment)

  if (paymentId && asaasToken) {
    const invoiceUrl = await resolveInvoiceUrlFromAsaas({ paymentId, environment, accessToken: asaasToken })
    if (invoiceUrl) {
      jsonResponse(res, 200, { url: invoiceUrl, source: 'asaas-payment' })
      return
    }
  }

  const rawResponse = session.raw_response ?? {}
  const fallbackUrl = (
    readNestedString(rawResponse, ['payment', 'invoiceUrl']) ??
    readNestedString(rawResponse, ['invoiceUrl']) ??
    readNestedString(rawResponse, ['payment', 'bankSlipUrl']) ??
    readNestedString(rawResponse, ['bankSlipUrl']) ??
    readNestedString(rawResponse, ['payment', 'transactionReceiptUrl']) ??
    readNestedString(rawResponse, ['transactionReceiptUrl']) ??
    session.checkout_url
  )

  if (!fallbackUrl) {
    jsonResponse(res, 404, { error: 'Fatura nao disponivel para este pedido.' })
    return
  }

  jsonResponse(res, 200, { url: fallbackUrl, source: 'session-fallback' })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const context = await assertAdmin(req, res)
  if (!context) {
    return
  }

  if (req.method === 'POST') {
    await handleResolveInvoiceUrl(req, res, context)
    return
  }

  const checks: DiagnosticCheck[] = [
    {
      key: 'supabase-service-role',
      label: 'Service role do Supabase',
      status: 'ok',
      detail: 'Variavel disponivel no ambiente do deploy.',
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
        ? 'Credencial sandbox disponivel para testes controlados.'
        : 'Configure ASAAS_ACCESS_TOKEN_SANDBOX antes de validar compras e repasses em sandbox.',
    })

    checks.push({
      key: 'asaas-production-token',
      label: 'Token Asaas producao',
      status: hasProductionToken ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasProductionToken
        ? 'Credencial de producao disponivel para operacao real.'
        : 'Producao ainda pendente. Configure ASAAS_ACCESS_TOKEN_PRODUCTION quando a conta Asaas final estiver aprovada.',
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
        ? 'Segredo do webhook sandbox disponivel.'
        : 'Configure ASAAS_WEBHOOK_SECRET_SANDBOX antes de validar callbacks em sandbox.',
    })

    checks.push({
      key: 'webhook-secret-production',
      label: 'Segredo do webhook producao',
      status: hasProductionWebhookSecret ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasProductionWebhookSecret
        ? 'Segredo do webhook producao disponivel.'
        : 'Configure ASAAS_WEBHOOK_SECRET_PRODUCTION ou ASAAS_WEBHOOK_SECRET para callbacks de producao.',
    })

    checks.push({
      key: 'public-url',
      label: 'URL publica do app',
      status: process.env.APP_PUBLIC_URL || process.env.VERCEL_URL ? 'ok' : 'warning',
      detail: process.env.APP_PUBLIC_URL
        ? `APP_PUBLIC_URL configurada: ${process.env.APP_PUBLIC_URL}.`
        : 'APP_PUBLIC_URL nao configurada. O sistema usara a origem da requisicao para montar callbacks e webhook.',
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
      detail: error instanceof Error ? error.message : 'Nao foi possivel carregar a configuracao do gateway.',
    })

    jsonResponse(res, 200, {
      environment: null,
      checkedAt: new Date().toISOString(),
      checks,
    })
  }
}
