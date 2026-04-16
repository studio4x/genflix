import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  fetchPaymentGatewayConfiguration,
  getHeaderValue,
} from '../_shared/asaas.js'

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

function parseBody(rawBody: unknown) {
  if (!rawBody) {
    return null
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as Record<string, unknown>
  }

  return null
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

async function findSessionByKeys(
  adminClient: SupabaseClient,
  checkoutId: string | null,
  externalReference: string | null,
) {
  const query = adminClient
    .from('commerce_checkout_sessions')
    .select('*')

  if (checkoutId) {
    const byCheckout = await query.eq('external_checkout_id', checkoutId).maybeSingle()
    if (byCheckout.data) {
      return byCheckout.data as Record<string, unknown>
    }
  }

  if (externalReference) {
    const byReference = await adminClient
      .from('commerce_checkout_sessions')
      .select('*')
      .eq('external_reference', externalReference)
      .maybeSingle()

    if (byReference.data) {
      return byReference.data as Record<string, unknown>
    }
  }

  return null
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao do Supabase ausente.' })
    return
  }

  if (webhookSecret) {
    const receivedSecret = getHeaderValue(req.headers['asaas-access-token'])
    if (receivedSecret !== webhookSecret) {
      jsonResponse(res, 401, { error: 'Token do webhook invalido.' })
      return
    }
  }

  const body = parseBody(req.body)
  const event = typeof body?.event === 'string' ? body.event : typeof body?.type === 'string' ? body.type : null
  const eventId = typeof body?.id === 'string' ? body.id : `asaas-${crypto.randomUUID()}`
  const checkout = typeof body?.checkout === 'object' && body.checkout ? (body.checkout as Record<string, unknown>) : null
  const payment = typeof body?.payment === 'object' && body.payment ? (body.payment as Record<string, unknown>) : null
  const checkoutId = typeof checkout?.id === 'string' ? checkout.id : null
  const externalReference = typeof checkout?.externalReference === 'string' ? checkout.externalReference : null
  const paymentId = typeof payment?.id === 'string' ? payment.id : null

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const gatewayConfig = await fetchPaymentGatewayConfiguration(supabaseUrl, serviceRoleKey)
  const environment = gatewayConfig.environment ?? 'sandbox'
  const eventExists = await adminClient
    .from('commerce_events')
    .select('id')
    .eq('external_event_id', eventId)
    .maybeSingle()

  if (eventExists.data?.id) {
    jsonResponse(res, 200, { ok: true, ignored: true })
    return
  }

  const session = await findSessionByKeys(adminClient, checkoutId, externalReference)

  const sessionId = typeof session?.id === 'string' ? session.id : null
  const courseId = typeof session?.course_id === 'string' ? session.course_id : null
  const userId = typeof session?.user_id === 'string' ? session.user_id : null

  let nextStatus: 'received' | 'processed' | 'ignored' | 'failed' = 'received'
  let releasedAt: string | null = null

  if (event === 'CHECKOUT_PAID') {
    nextStatus = 'processed'
    releasedAt = new Date().toISOString()

    if (sessionId && courseId && userId) {
      const releaseResult = await adminClient
        .from('course_releases')
        .upsert(
          {
            course_id: courseId,
            release_type: 'user',
            user_id: userId,
            group_id: null,
            starts_at: null,
            ends_at: null,
            is_active: true,
            created_by: null,
            release_source: 'purchase',
            release_status: 'active',
            source_system: 'asaas',
            external_reference_id: externalReference ?? sessionId,
            managed_by_integration: true,
            last_synced_at: releasedAt,
            revoked_at: null,
            revoked_reason: null,
          },
          { onConflict: 'course_id,user_id' },
        )

      if (releaseResult.error) {
        nextStatus = 'failed'
      } else {
        await adminClient
          .from('commerce_checkout_sessions')
          .update({
            status: 'paid',
            released_at: releasedAt,
            external_payment_id: paymentId,
            raw_response: body ?? {},
          })
          .eq('id', sessionId)
      }
    }
  } else if (event === 'CHECKOUT_CANCELED' || event === 'CHECKOUT_EXPIRED') {
    nextStatus = 'processed'
    if (sessionId) {
      await adminClient
        .from('commerce_checkout_sessions')
        .update({
          status: event === 'CHECKOUT_CANCELED' ? 'canceled' : 'expired',
          external_payment_id: paymentId,
          raw_response: body ?? {},
        })
        .eq('id', sessionId)
    }
  } else {
    nextStatus = 'ignored'
  }

  const insertEvent = await adminClient.from('commerce_events').insert({
    gateway_code: 'asaas',
    gateway_environment: environment,
    external_event_id: eventId,
    event_type: event ?? 'UNKNOWN_EVENT',
    course_id: courseId,
    user_id: userId,
    checkout_session_id: sessionId,
    external_checkout_id: checkoutId,
    external_payment_id: paymentId,
    status: nextStatus,
    payload: body ?? {},
    received_at: new Date().toISOString(),
  })

  if (insertEvent.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel registrar o webhook.' })
    return
  }

  jsonResponse(res, 200, { ok: true })
}
