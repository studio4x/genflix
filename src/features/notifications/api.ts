import { supabase } from '@/services/supabase/client'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'in-app'
export type NotificationQueueStatus = 'pending' | 'retry' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'ignored'

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

export async function fetchNotificationStats() {
  const [{ count: total, error: totalError }, { count: unread, error: unreadError }, queueResult] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    supabase.from('notification_queue').select('status'),
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

export async function fetchRecentQueueItems(limit = 25) {
  const { data, error } = await supabase
    .from('notification_queue')
    .select('id, notification_id, user_id, channel, title, body, status, attempt_count, last_attempt_at, next_retry_at, final_error, provider_message_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

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
