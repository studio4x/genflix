import { createClient } from '@supabase/supabase-js'

import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getAsaasBaseUrl,
  getBearerToken,
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

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao ausente do Supabase.' })
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
    jsonResponse(res, 403, { error: 'Apenas administradores podem abrir faturas de pedidos.' })
    return null
  }

  return { adminClient, supabaseUrl, serviceRoleKey }
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
  if (!response.ok) {
    return null
  }

  const typedPayload = payload as Record<string, unknown>
  return (
    readString(typedPayload?.invoiceUrl) ??
    readString(typedPayload?.bankSlipUrl) ??
    readString(typedPayload?.transactionReceiptUrl) ??
    null
  )
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const context = await assertAdmin(req, res)
  if (!context) {
    return
  }

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

  const environment = session.gateway_environment ?? (await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)).environment ?? 'sandbox'
  const asaasToken = getAsaasAccessToken(environment)
  const paymentId = readString(session.external_payment_id)

  if (paymentId && asaasToken) {
    const invoiceUrl = await resolveInvoiceUrlFromAsaas({
      paymentId,
      environment,
      accessToken: asaasToken,
    })

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
