import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

type RuntimeSettingRow = {
  key: string
  value: string
}

function safeStringEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

function getRetryDelayMinutes(attemptCount: number) {
  const bounded = Math.min(Math.max(attemptCount, 1), 8)
  return 2 ** bounded
}

async function createOutboundSignature(timestamp: string, payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido.' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Configuracao incompleta para o dispatcher HCM.' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const settingsResult = await supabaseAdmin
    .from('integration_runtime_settings')
    .select('key, value')
    .in('key', [
      'hcm_edge_cron_secret',
      'hcm_events_webhook_url',
      'hcm_outbound_signing_secret',
      'hcm_source_system',
    ])

  if (settingsResult.error) {
    return new Response(JSON.stringify({ error: settingsResult.error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const settings = new Map(
    ((settingsResult.data as RuntimeSettingRow[] | null) ?? []).map((row) => [row.key, row.value]),
  )

  const cronSecret = settings.get('hcm_edge_cron_secret') ?? ''
  const webhookUrl = settings.get('hcm_events_webhook_url') ?? ''
  const outboundSecret = settings.get('hcm_outbound_signing_secret') ?? ''
  const sourceSystem = settings.get('hcm_source_system') ?? 'homecare_match'
  const providedAuthorization = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''

  if (!cronSecret || !webhookUrl || !outboundSecret) {
    return new Response(JSON.stringify({ error: 'Configuracao ausente em integration_runtime_settings.' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  if (!safeStringEqual(providedAuthorization, cronSecret)) {
    return new Response(JSON.stringify({ error: 'Acesso nao autorizado.' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const nowIso = new Date().toISOString()
  const pendingResult = await supabaseAdmin
    .from('integration_event_outbox')
    .select('id, source_system, event_type, user_id, course_id, payload, attempt_count, created_at')
    .eq('source_system', sourceSystem)
    .in('delivery_status', ['pending', 'failed'])
    .lte('next_attempt_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(20)

  if (pendingResult.error) {
    return new Response(JSON.stringify({ error: pendingResult.error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const events = (pendingResult.data as OutboxRow[] | null) ?? []
  let delivered = 0
  let failed = 0

  for (const event of events) {
    await supabaseAdmin
      .from('integration_event_outbox')
      .update({
        delivery_status: 'processing',
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', event.id)

    try {
      const [identityResult, mappingResult, snapshotResult] = await Promise.all([
        supabaseAdmin
          .from('external_user_identities')
          .select('external_user_id')
          .eq('source_system', event.source_system)
          .eq('user_id', event.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from('external_course_mappings')
          .select('external_course_id')
          .eq('source_system', event.source_system)
          .eq('course_id', event.course_id)
          .maybeSingle(),
        supabaseAdmin.rpc('get_course_integration_snapshot', {
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
          'X-HCM-Signature': await createOutboundSignature(timestamp, body, outboundSecret),
          'X-Request-Id': event.id,
        },
        body,
      })

      const responsePayload = await response.text().catch(() => '')
      if (!response.ok) {
        throw new Error(`Webhook respondeu ${response.status}: ${responsePayload || 'sem corpo'}`)
      }

      await supabaseAdmin
        .from('integration_event_outbox')
        .update({
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
          last_error: null,
          attempt_count: event.attempt_count + 1,
        })
        .eq('id', event.id)

      await supabaseAdmin.from('integration_logs').insert({
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
        payload: JSON.parse(body),
        response_payload: responsePayload ? { body: responsePayload } : null,
      })

      delivered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar evento.'
      const nextAttemptCount = event.attempt_count + 1
      const shouldDeadLetter = nextAttemptCount >= 8
      const nextAttemptAt = new Date(Date.now() + getRetryDelayMinutes(nextAttemptCount) * 60 * 1000).toISOString()

      await supabaseAdmin
        .from('integration_event_outbox')
        .update({
          delivery_status: shouldDeadLetter ? 'dead_letter' : 'failed',
          attempt_count: nextAttemptCount,
          last_error: message,
          next_attempt_at: shouldDeadLetter ? new Date().toISOString() : nextAttemptAt,
        })
        .eq('id', event.id)

      await supabaseAdmin.from('integration_logs').insert({
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

  return new Response(JSON.stringify({
    processed: events.length,
    delivered,
    failed,
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
})
