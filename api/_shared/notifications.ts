import type { SupabaseClient } from '@supabase/supabase-js'

type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'in-app'
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

type QueueUserNotificationInput = {
  userId: string
  title: string
  body: string
  category?: string
  priority?: NotificationPriority
  actionUrl?: string | null
  channels?: NotificationChannel[]
  metadata?: Record<string, unknown>
}

export async function queueUserNotification(
  adminClient: SupabaseClient,
  input: QueueUserNotificationInput,
) {
  const { error } = await adminClient.rpc('create_user_notification', {
    _user_id: input.userId,
    _title: input.title,
    _body: input.body,
    _category: input.category ?? 'system',
    _priority: input.priority ?? 'normal',
    _action_url: input.actionUrl ?? null,
    _channels: input.channels ?? ['in-app'],
    _metadata: input.metadata ?? {},
  })

  if (error) {
    throw error
  }
}

