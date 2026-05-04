import { supabase } from '@/services/supabase/client'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'in-app'
export type NotificationQueueStatus = 'pending' | 'retry' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'ignored'
export type EmailDigestFrequency = 'immediate' | 'daily' | 'weekly' | 'never'

export interface AppNotification {
  id: string
  user_id: string
  title: string
  body: string
  action_url: string | null
  category: string
  priority: NotificationPriority
  is_actionable: boolean
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface NotificationQueueItem {
  id: string
  notification_id: string | null
  user_id: string
  channel: NotificationChannel
  title: string
  body: string
  status: NotificationQueueStatus
  attempt_count: number
  last_attempt_at: string | null
  next_retry_at: string | null
  final_error: string | null
  provider_message_id: string | null
  created_at: string
  updated_at: string
}

export interface NotificationStats {
  total: number
  unread: number
  queue: Record<NotificationQueueStatus, number>
}

export interface BroadcastNotificationInput {
  title: string
  body: string
  category: string
  priority: NotificationPriority
  actionUrl: string | null
  roleCodes: string[]
  channels: NotificationChannel[]
}

export interface BroadcastNotificationResult {
  recipient_count: number
  queued_count: number
}

export interface NotificationPreferences {
  user_id: string
  push_enabled: boolean
  email_enabled: boolean
  whatsapp_enabled: boolean
  in_app_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  quiet_hours_timezone: string
  email_digest: EmailDigestFrequency
  created_at?: string
  updated_at?: string
}

export interface NotificationPreferencesInput {
  push_enabled: boolean
  email_enabled: boolean
  whatsapp_enabled: boolean
  in_app_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  quiet_hours_timezone: string
  email_digest: EmailDigestFrequency
}

export interface NotificationAdminSettings {
  id: number
  admin_notification_email: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface NotificationQueueProcessResult {
  processed: number
  sent: number
  failed: number
  retrying: number
  ignored: number
}

export const defaultNotificationPreferences: NotificationPreferencesInput = {
  push_enabled: true,
  email_enabled: true,
  whatsapp_enabled: false,
  in_app_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  quiet_hours_timezone: 'America/Sao_Paulo',
  email_digest: 'immediate',
}

const queueStatuses: NotificationQueueStatus[] = [
  'pending',
  'retry',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'ignored',
]

function emptyQueueStats(): Record<NotificationQueueStatus, number> {
  return queueStatuses.reduce<Record<NotificationQueueStatus, number>>((acc, status) => {
    acc[status] = 0
    return acc
  }, {} as Record<NotificationQueueStatus, number>)
}

export async function fetchNotifications(limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, action_url, category, priority, is_actionable, metadata, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as AppNotification[]
}

export async function fetchUnreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.rpc('mark_notification_read', {
    _notification_id: notificationId,
  })

  if (error) {
    throw error
  }
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read')

  if (error) {
    throw error
  }
}

export async function fetchNotificationStats(manualOnly = false) {
  const notificationsQuery = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })

  const unreadQuery = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  const queueQuery = supabase
    .from('notification_queue')
    .select('status')

  if (manualOnly) {
    notificationsQuery.contains('metadata', { broadcast: true })
    unreadQuery.contains('metadata', { broadcast: true })
    queueQuery.contains('payload', { metadata: { broadcast: true } })
  }

  const [{ count: total, error: totalError }, { count: unread, error: unreadError }, queueResult] = await Promise.all([
    notificationsQuery,
    unreadQuery,
    queueQuery,
  ])

  if (totalError) {
    throw totalError
  }

  if (unreadError) {
    throw unreadError
  }

  if (queueResult.error) {
    throw queueResult.error
  }

  const queue = emptyQueueStats()
  for (const row of queueResult.data ?? []) {
    const status = row.status as NotificationQueueStatus
    if (status in queue) {
      queue[status] += 1
    }
  }

  return {
    total: total ?? 0,
    unread: unread ?? 0,
    queue,
  } satisfies NotificationStats
}

export async function fetchRecentQueueItems(limit = 25, manualOnly = false) {
  const query = supabase
    .from('notification_queue')
    .select('id, notification_id, user_id, channel, title, body, status, attempt_count, last_attempt_at, next_retry_at, final_error, provider_message_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (manualOnly) {
    query.contains('payload', { metadata: { broadcast: true } })
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as NotificationQueueItem[]
}

export async function sendBroadcastNotification(input: BroadcastNotificationInput) {
  const { data, error } = await supabase.rpc('admin_send_broadcast_notification', {
    _title: input.title,
    _body: input.body,
    _category: input.category,
    _priority: input.priority,
    _action_url: input.actionUrl,
    _role_codes: input.roleCodes.length > 0 ? input.roleCodes : null,
    _channels: input.channels,
  })

  if (error) {
    throw error
  }

  return data as BroadcastNotificationResult
}

export async function fetchNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('user_id, push_enabled, email_enabled, whatsapp_enabled, in_app_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, email_digest, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return {
      user_id: userId,
      ...defaultNotificationPreferences,
    } satisfies NotificationPreferences
  }

  return data as NotificationPreferences
}

export async function saveNotificationPreferences(userId: string, input: NotificationPreferencesInput) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...input,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, push_enabled, email_enabled, whatsapp_enabled, in_app_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, email_digest, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return data as NotificationPreferences
}

export async function fetchNotificationAdminSettings() {
  const { data, error } = await supabase
    .from('notification_admin_settings')
    .select('id, admin_notification_email, updated_by, created_at, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (
    data ?? {
      id: 1,
      admin_notification_email: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ) as NotificationAdminSettings
}

export async function saveNotificationAdminSettings(email: string | null) {
  const { data: sessionData } = await supabase.auth.getSession()
  const normalizedEmail = email?.trim() || null

  const { data, error } = await supabase
    .from('notification_admin_settings')
    .upsert(
      {
        id: 1,
        admin_notification_email: normalizedEmail,
        updated_by: sessionData.session?.user.id ?? null,
      },
      { onConflict: 'id' },
    )
    .select('id, admin_notification_email, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return data as NotificationAdminSettings
}

export async function processNotificationQueue(limit = 50) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('Sessão expirada. Entre novamente para processar a fila.')
  }

  const response = await fetch('/api/admin/notifications?task=process_queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'process_queue',
      limit,
    }),
  })

  const payload = await response.json().catch(() => null) as Partial<NotificationQueueProcessResult> & { error?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível processar a fila de notificações.')
  }

  return {
    processed: Number(payload?.processed ?? 0),
    sent: Number(payload?.sent ?? 0),
    failed: Number(payload?.failed ?? 0),
    retrying: Number(payload?.retrying ?? 0),
    ignored: Number(payload?.ignored ?? 0),
  } satisfies NotificationQueueProcessResult
}
