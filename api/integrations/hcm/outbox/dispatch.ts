import { createHmac } from 'node:crypto'

import type { ApiRequest, ApiResponse } from '../_shared.js'
import {
  createServiceClient,
  getCronAuthorizationToken,
  writeIntegrationLog,
} from '../_shared.js'

type OutboxRow = {
  id: string
  source_system: string
  event_type: 'course.progress.updated' | 'course.completed' | 'course.approval.updated'
  user_id: string
  course_id: string
  payload: Record<string, unknown> | null
  attempt_count: number
  created_at: string
}

type CourseSnapshot = {
  progress_percent: number
  is_completed: boolean
  approval_status: 'pending' | 'approved' | 'rejected' | 'not_applicable'
  completed_at: string | null
  last_activity_at: string | null
}

function createOutboundSignature(timestamp: string, payload: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
}

function getRetryDelayMinutes(attemptCount: number) {
  const bounded = Math.min(Math.max(attemptCount, 1), 8)
  return 2 ** bounded
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    res.status(500).json({ error: 'Configuracao ausente: CRON_SECRET.' })
    return
  }

  if (getCronAuthorizationToken(req) !== cronSecret) {
    res.status(401).json({ error: 'Acesso nao autorizado.' })
    return
  }

  const webhookUrl = process.env.HCM_EVENTS_WEBHOOK_URL
  const outboundSecret = process.env.HCM_OUTBOUND_SIGNING_SECRET
  if (!webhookUrl || !outboundSecret) {
    res.status(500).json({ error: 'Configuracao ausente para webhook outbound da HCM.' })
    return
  }

  const adminClient = createServiceClient()
  const nowIso = new Date().toISOString()

  const pendingResult = await adminClient
    .from('integration_event_outbox')
    .select('id, source_system, event_type, user_id, course_id, payload, attempt_count, created_at')
    .eq('source_system', 'homecare_match')
    .in('delivery_status', ['pending', 'failed'])
    .lte('next_attempt_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(20)

  if (pendingResult.error) {
    res.status(500).json({ error: pendingResult.error.message })
    return
  }

  const events = (pendingResult.data as OutboxRow[] | null) ?? []
  let delivered = 0
  let failed = 0

  for (const event of events) {
    await adminClient
      .from('integration_event_outbox')
      .update({
        delivery_status: 'processing',
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', event.id)

    try {
      const [identityResult, mappingResult, snapshotResult] = await Promise.all([
        adminClient
          .from('external_user_identities')
          .select('external_user_id')
          .eq('source_system', event.source_system)
          .eq('user_id', event.user_id)
          .maybeSingle(),
        adminClient
          .from('external_course_mappings')
          .select('external_course_id')
          .eq('source_system', event.source_system)
          .eq('course_id', event.course_id)
          .maybeSingle(),
        adminClient.rpc('get_course_integration_snapshot', {
          _user_id: event.user_id,
          _course_id: event.course_id,
        }),
      ])

      if (identityResult.error || mappingResult.error || snapshotResult.error) {
        throw new Error(
          identityResult.error?.message
          ?? mappingResult.error?.message
          ?? snapshotResult.error?.message
          ?? 'Falha ao consolidar snapshot de integracao.',
        )
      }

      const externalUserId = identityResult.data?.external_user_id
      const externalCourseId = mappingResult.data?.external_course_id
      const snapshot = ((snapshotResult.data as CourseSnapshot[] | null) ?? [])[0]

      if (!externalUserId || !externalCourseId || !snapshot) {
        throw new Error('Mapeamento externo ou snapshot indisponivel para envio.')
      }

      const body = JSON.stringify({
        event_id: event.id,
        source_system: 'homecare_match_lms',
        event_type: event.event_type,
        occurred_at: event.created_at,
        user: {
          external_user_id: externalUserId,
        },
        course: {
          external_course_id: externalCourseId,
        },
        data: {
          progress_percent: snapshot.progress_percent,
          is_completed: snapshot.is_completed,
          approval_status: snapshot.approval_status,
          completed_at: snapshot.completed_at,
          last_activity_at: snapshot.last_activity_at,
        },
        metadata: event.payload ?? {},
      })

      const timestamp = new Date().toISOString()
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HCM-Timestamp': timestamp,
          'X-HCM-Signature': createOutboundSignature(timestamp, body, outboundSecret),
          'X-Request-Id': event.id,
        },
        body,
      })

      const responsePayload = await response.text().catch(() => '')
      if (!response.ok) {
        throw new Error(`Webhook respondeu ${response.status}: ${responsePayload || 'sem corpo'}`)
      }

      await adminClient
        .from('integration_event_outbox')
        .update({
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
          last_error: null,
          attempt_count: event.attempt_count + 1,
        })
        .eq('id', event.id)

      await writeIntegrationLog(adminClient, {
        source_system: event.source_system,
        direction: 'outbound',
        event_type: event.event_type,
        request_id: event.id,
        user_id: event.user_id,
        course_id: event.course_id,
        external_user_id: externalUserId,
        external_course_id: externalCourseId,
        http_status: response.status,
        status: 'processed',
        payload: JSON.parse(body) as Record<string, unknown>,
        response_payload: responsePayload ? { body: responsePayload } : null,
      })

      delivered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar evento.'
      const nextAttemptCount = event.attempt_count + 1
      const shouldDeadLetter = nextAttemptCount >= 8
      const nextAttemptAt = new Date(Date.now() + getRetryDelayMinutes(nextAttemptCount) * 60 * 1000).toISOString()

      await adminClient
        .from('integration_event_outbox')
        .update({
          delivery_status: shouldDeadLetter ? 'dead_letter' : 'failed',
          attempt_count: nextAttemptCount,
          last_error: message,
          next_attempt_at: shouldDeadLetter ? new Date().toISOString() : nextAttemptAt,
        })
        .eq('id', event.id)

      await writeIntegrationLog(adminClient, {
        source_system: event.source_system,
        direction: 'outbound',
        event_type: event.event_type,
        request_id: event.id,
        user_id: event.user_id,
        course_id: event.course_id,
        http_status: 500,
        status: 'failed',
        payload: event.payload ?? {},
        error_message: message,
      })

      failed += 1
    }
  }

  res.status(200).json({
    processed: events.length,
    delivered,
    failed,
  })
}
