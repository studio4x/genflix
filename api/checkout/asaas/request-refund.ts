import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getBearerToken, getHeaderValue } from '../../_shared/asaas.js'

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

const requestSchema = z.object({
  checkoutSessionId: z.string().uuid('Pedido invalido.'),
  reason: z.string().trim().max(1200).optional(),
})

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
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

type CheckoutSessionRow = {
  id: string
  user_id: string | null
  status: string
  course_id: string | null
  courses: { title: string | null } | Array<{ title: string | null }> | null
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
  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao do Supabase ausente.' })
    return
  }

  const accessToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!accessToken) {
    jsonResponse(res, 401, { error: 'Token ausente ou invalido.' })
    return
  }

  const body = parseBody(req.body)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' })
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

  const { data: session, error: sessionError } = await adminClient
    .from('commerce_checkout_sessions')
    .select(`
      id,
      user_id,
      status,
      course_id,
      courses:course_id ( title )
    `)
    .eq('id', parsed.data.checkoutSessionId)
    .maybeSingle()

  if (sessionError) {
    jsonResponse(res, 500, { error: 'Nao foi possivel validar o pedido.' })
    return
  }

  const checkout = session as CheckoutSessionRow | null
  if (!checkout || checkout.user_id !== userData.user.id) {
    jsonResponse(res, 404, { error: 'Pedido nao encontrado para esta conta.' })
    return
  }

  const status = checkout.status.trim().toLowerCase()
  if (status === 'refunded' || status === 'chargeback') {
    jsonResponse(res, 409, { error: 'Este pedido ja foi estornado.' })
    return
  }
  if (status === 'refund_pending') {
    jsonResponse(res, 200, { ok: true, alreadyPending: true })
    return
  }
  if (status !== 'paid') {
    jsonResponse(res, 409, { error: 'Apenas pedidos pagos podem solicitar reembolso.' })
    return
  }

  const nowIso = new Date().toISOString()
  const requestedReason = parsed.data.reason?.trim() ?? ''
  const reasonSection = requestedReason.length > 0
    ? `Motivo informado pelo aluno:\n${requestedReason}`
    : 'Motivo informado pelo aluno: nao informado.'

  const courseRelation = Array.isArray(checkout.courses) ? checkout.courses[0] : checkout.courses
  const courseTitle = courseRelation?.title?.trim() || 'Curso sem titulo'

  const updateSessionResult = await adminClient
    .from('commerce_checkout_sessions')
    .update({
      status: 'refund_pending',
      updated_at: nowIso,
    })
    .eq('id', checkout.id)

  if (updateSessionResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel registrar a solicitacao de reembolso.' })
    return
  }

  const supportSubject = `Solicitacao de reembolso - Pedido ${checkout.id.slice(0, 8)}`
  const supportDescription = [
    'Solicitacao criada pelo aluno via dashboard de pagamentos.',
    '',
    `Pedido: ${checkout.id}`,
    `Curso: ${courseTitle}`,
    `Course ID: ${checkout.course_id ?? 'nao informado'}`,
    '',
    reasonSection,
  ].join('\n')

  const supportInsert = await adminClient.from('support_tickets').insert({
    user_id: userData.user.id,
    category: 'payment',
    priority: 'high',
    subject: supportSubject,
    description: supportDescription,
  }).select('id').maybeSingle()

  if (supportInsert.error) {
    jsonResponse(res, 500, { error: 'Solicitacao registrada, mas nao foi possivel abrir ticket de suporte.' })
    return
  }

  jsonResponse(res, 200, {
    ok: true,
    status: 'refund_pending',
    supportTicketId: supportInsert.data?.id ?? null,
  })
}
