import { createClient } from '@supabase/supabase-js'

import { getBearerToken, getHeaderValue } from '../../_shared/asaas.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function parseCurrency(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim().toUpperCase() : 'BRL'
}

type CheckoutRow = {
  id: string
  created_at: string
  status: string
  external_payment_id: string | null
  checkout_url: string | null
  raw_response: Record<string, unknown> | null
  course_id: string | null
  buyer_name: string | null
  currency: string | null
  amount_cents: number | null
  gateway_environment: string | null
  courses: { title: string | null } | Array<{ title: string | null }> | null
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'GET') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao do Supabase ausente.' })
    return
  }

  const accessToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!accessToken) {
    jsonResponse(res, 401, { error: 'Token ausente ou invalido.' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
  if (userError || !userData.user) {
    jsonResponse(res, 401, { error: 'Token ausente ou invalido.' })
    return
  }

  const { data, error } = await adminClient
    .from('commerce_checkout_sessions')
    .select(`
      id,
      created_at,
      status,
      external_payment_id,
      checkout_url,
      raw_response,
      course_id,
      buyer_name,
      currency,
      amount_cents,
      gateway_environment,
      courses:course_id ( title )
    `)
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel consultar o historico de pagamentos.' })
    return
  }

  const records = ((data ?? []) as CheckoutRow[]).map((row) => {
    const rawResponse = row.raw_response ?? {}
    const paymentId = readString(row.external_payment_id)
    const invoiceCode = paymentId?.replace(/^pay_/i, '')
    const asaasBaseUrl = row.gateway_environment === 'production' ? 'https://www.asaas.com' : 'https://sandbox.asaas.com'

    const invoiceUrl = (
      readNestedString(rawResponse, ['payment', 'invoiceUrl']) ??
      readNestedString(rawResponse, ['invoiceUrl']) ??
      readNestedString(rawResponse, ['payment', 'bankSlipUrl']) ??
      readNestedString(rawResponse, ['bankSlipUrl']) ??
      readNestedString(rawResponse, ['payment', 'transactionReceiptUrl']) ??
      readNestedString(rawResponse, ['transactionReceiptUrl']) ??
      (invoiceCode ? `${asaasBaseUrl}/i/${invoiceCode}` : null)
    )

    const amount = typeof row.amount_cents === 'number' ? row.amount_cents / 100 : 0

    const courseRelation = Array.isArray(row.courses) ? row.courses[0] : row.courses

    return {
      id: row.id,
      date: Date.parse(row.created_at),
      amount,
      currency: parseCurrency(row.currency),
      status: row.status,
      raw_status: row.status,
      description: courseRelation?.title?.trim() || 'Pedido na GenFlix',
      pdf_url: invoiceUrl,
      type: 'one_time' as const,
      asaas_checkout_id: row.external_payment_id,
      installment_current: null,
      installment_total: null,
      installment_group_key: null,
      buyer_name: row.buyer_name,
      course_id: row.course_id,
      checkout_url: row.checkout_url,
    }
  })

  jsonResponse(res, 200, {
    payments: records,
    subscription: {
      tier: null,
      endAt: null,
      cancelAtPeriodEnd: false,
    },
  })
}
