import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getPublicAppUrl } from '../_shared/app-url.js'
import { getBearerToken, getHeaderValue } from '../_shared/asaas.js'
import { handleSecurityScans } from '../_shared/security-scans-handler.js'
import { sendNotificationEmail } from '../_shared/email.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type QueueRow = {
  id: string
  user_id: string
  channel: 'push' | 'email' | 'whatsapp' | 'in-app'
  title: string
  body: string
  payload: Record<string, unknown>
  attempt_count: number
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

type PreferenceRow = {
  user_id: string
  email_enabled: boolean
  email_digest: 'immediate' | 'daily' | 'weekly' | 'never'
}

const processQueueSchema = z.object({
  action: z.literal('process_queue').default('process_queue'),
  limit: z.number().int().min(1).max(100).default(50),
})

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function parseBody(rawBody: unknown) {
  if (!rawBody) return {}
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return typeof rawBody === 'object' ? rawBody as Record<string, unknown> : {}
}

function getFirstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function calculateNextRetry(attemptCount: number) {
  const retryDelaysMinutes = [5, 15, 60, 240]
  const delay = retryDelaysMinutes[Math.min(Math.max(attemptCount - 1, 0), retryDelaysMinutes.length - 1)]
  return new Date(Date.now() + delay * 60 * 1000).toISOString()
}

function readActionUrl(payload: Record<string, unknown>) {
  const actionUrl = payload.action_url
  return typeof actionUrl === 'string' && actionUrl.trim() ? actionUrl.trim() : null
}

function buildAbsoluteActionUrl(actionUrl: string | null) {
  if (!actionUrl) return null
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl

  const appUrl = getPublicAppUrl()
  return `${appUrl.replace(/\/$/, '')}/${actionUrl.replace(/^\//, '')}`
}

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const cronSecret = process.env.CRON_SECRET
  const task = getFirstQueryValue(req.query?.task)
  const receivedCronSecret = getHeaderValue(req.headers['x-cron-secret'])
  const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração ausente: Supabase URL e service role são obrigatórios.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (task === 'process_queue' && cronSecret && (receivedCronSecret === cronSecret || bearerToken === cronSecret)) {
    return { adminClient }
  }

  if (!bearerToken) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' })
    return null
  }

  const userResult = await adminClient.auth.getUser(bearerToken)
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
      if (!relation.roles) return []
      return Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    })
    .map((role) => role.code)

  if (!roles.includes('admin')) {
    jsonResponse(res, 403, { error: 'Apenas administradores podem processar a fila de notificações.' })
    return null
  }

  return { adminClient }
}

async function insertDeliveryLog(adminClient: SupabaseClient, input: {
  queueId: string
  channel: QueueRow['channel']
  attemptNumber: number
  status: 'success' | 'failure' | 'ignored'
  errorMessage?: string | null
  deliveredAt?: string | null
}) {
  await adminClient.from('notification_delivery_logs').insert({
    queue_id: input.queueId,
    channel: input.channel,
    attempt_number: input.attemptNumber,
    status: input.status,
    error_message: input.errorMessage ?? null,
    retry_attempt: input.attemptNumber,
    delivered_at: input.deliveredAt ?? null,
  })
}

async function processEmailQueue(adminClient: SupabaseClient, limit: number) {
  const queueResult = await adminClient
    .from('notification_queue')
    .select('id, user_id, channel, title, body, payload, attempt_count')
    .in('status', ['pending', 'retry'])
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  if (queueResult.error) {
    throw queueResult.error
  }

  const queueRows = (queueResult.data ?? []) as QueueRow[]
  const userIds = [...new Set(queueRows.map((row) => row.user_id))]

  const [profilesResult, preferencesResult] = await Promise.all([
    userIds.length
      ? adminClient.from('profiles').select('id, email, full_name').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? adminClient.from('notification_preferences').select('user_id, email_enabled, email_digest').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (preferencesResult.error) throw preferencesResult.error

  const profiles = new Map((profilesResult.data as ProfileRow[]).map((profile) => [profile.id, profile]))
  const preferences = new Map((preferencesResult.data as PreferenceRow[]).map((preference) => [preference.user_id, preference]))
  const counters = { processed: 0, sent: 0, failed: 0, retrying: 0, ignored: 0 }

  for (const row of queueRows) {
    counters.processed += 1
    const attemptNumber = row.attempt_count + 1

    if (row.channel === 'in-app') {
      await adminClient
        .from('notification_queue')
        .update({
          status: 'sent',
          attempt_count: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          provider_message_id: 'in-app',
          final_error: null,
        })
        .eq('id', row.id)
      counters.sent += 1
      continue
    }

    if (row.channel !== 'email') {
      await adminClient
        .from('notification_queue')
        .update({
          status: 'ignored',
          attempt_count: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          final_error: 'Canal ainda não possui provedor configurado na GenFlix.',
        })
        .eq('id', row.id)
      await insertDeliveryLog(adminClient, {
        queueId: row.id,
        channel: row.channel,
        attemptNumber,
        status: 'ignored',
        errorMessage: 'Canal ainda não possui provedor configurado na GenFlix.',
      })
      counters.ignored += 1
      continue
    }

    const profile = profiles.get(row.user_id)
    const preference = preferences.get(row.user_id)
    if (preference && (!preference.email_enabled || preference.email_digest === 'never')) {
      await adminClient
        .from('notification_queue')
        .update({
          status: 'ignored',
          attempt_count: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          final_error: 'Usuário desativou notificações por e-mail.',
        })
        .eq('id', row.id)
      await insertDeliveryLog(adminClient, {
        queueId: row.id,
        channel: row.channel,
        attemptNumber,
        status: 'ignored',
        errorMessage: 'Usuário desativou notificações por e-mail.',
      })
      counters.ignored += 1
      continue
    }

    if (!profile?.email) {
      await adminClient
        .from('notification_queue')
        .update({
          status: 'failed',
          attempt_count: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          final_error: 'Usuário sem e-mail cadastrado.',
        })
        .eq('id', row.id)
      await insertDeliveryLog(adminClient, {
        queueId: row.id,
        channel: row.channel,
        attemptNumber,
        status: 'failure',
        errorMessage: 'Usuário sem e-mail cadastrado.',
      })
      counters.failed += 1
      continue
    }

    try {
      const messageId = await sendNotificationEmail({
        to: profile.email,
        fullName: profile.full_name,
        title: row.title,
        body: row.body,
        actionUrl: buildAbsoluteActionUrl(readActionUrl(row.payload)),
        actionLabel: 'Abrir na GenFlix',
      })

      await adminClient
        .from('notification_queue')
        .update({
          status: 'sent',
          attempt_count: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          provider_message_id: messageId,
          final_error: null,
        })
        .eq('id', row.id)
      await insertDeliveryLog(adminClient, {
        queueId: row.id,
        channel: row.channel,
        attemptNumber,
        status: 'success',
        deliveredAt: new Date().toISOString(),
      })
      counters.sent += 1
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Falha desconhecida no envio de e-mail.'
      const isFinalFailure = attemptNumber >= 5
      await adminClient
        .from('notification_queue')
        .update({
          status: isFinalFailure ? 'failed' : 'retry',
          attempt_count: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          next_retry_at: isFinalFailure ? new Date().toISOString() : calculateNextRetry(attemptNumber),
          final_error: errorMessage,
        })
        .eq('id', row.id)
      await insertDeliveryLog(adminClient, {
        queueId: row.id,
        channel: row.channel,
        attemptNumber,
        status: 'failure',
        errorMessage,
      })
      if (isFinalFailure) counters.failed += 1
      else counters.retrying += 1
    }
  }

  return counters
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const task = getFirstQueryValue(req.query?.task)

  if (task === 'security_scans' || task === 'run_scheduled_security_scan') {
    await handleSecurityScans(req, res)
    return
  }

  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    jsonResponse(res, 405, { error: 'Método não permitido.' })
    return
  }

  const context = await assertAdmin(req, res)
  if (!context) return

  const body = parseBody(req.body)
  const parsed = processQueueSchema.safeParse({
    action: body.action ?? (task === 'process_queue' ? 'process_queue' : undefined),
    limit: typeof body.limit === 'number' ? body.limit : Number(getFirstQueryValue(req.query?.limit) ?? 50),
  })

  if (!parsed.success) {
    jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  try {
    const result = await processEmailQueue(context.adminClient, parsed.data.limit)
    jsonResponse(res, 200, result)
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Não foi possível processar a fila de notificações.',
    })
  }
}
