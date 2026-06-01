import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Inbox, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { supabase } from '@/services/supabase/client'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from './api'

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diffInSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))

  if (diffInSeconds < 60) {
    return 'agora'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `ha ${diffInMinutes} min`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `ha ${diffInHours} h`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `ha ${diffInDays} dia${diffInDays === 1 ? '' : 's'}`
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function getPriorityClassName(priority: AppNotification['priority']) {
  if (priority === 'urgent') {
    return 'border-red-200 bg-red-50 text-red-700'
  }

  if (priority === 'high') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (priority === 'low') {
    return 'border-[#D8E6EB] bg-[#F2F7F9] text-[#5F7077]'
  }

  return 'border-[#BEE3EA] bg-[#E8F6FA] text-[#0A3640]'
}

export function NotificationsOverviewPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const visibleItems = useMemo(() => items.slice(0, 12), [items])

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [notificationRows, count] = await Promise.all([
        fetchNotifications(20),
        fetchUnreadNotificationCount(),
      ])
      setItems(notificationRows)
      setUnreadCount(count)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel carregar as notificacoes.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`notifications-overview:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications()
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [loadNotifications, user?.id])

  async function handleOpenNotification(notification: AppNotification) {
    if (!notification.read_at) {
      await markNotificationRead(notification.id)
      await loadNotifications()
    }

    if (notification.action_url) {
      if (notification.action_url.startsWith('/')) {
        navigate(notification.action_url)
      } else {
        window.location.assign(notification.action_url)
      }
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    await loadNotifications()
  }

  return (
    <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Notificacoes</p>
          <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Caixa do painel</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
            Aqui aparecem avisos enviados pela plataforma, eventos transacionais e mensagens que pedem sua atencao.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadNotifications()}
            disabled={isLoading}
            className="h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading ? 'animate-spin' : '')} />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleMarkAllRead()}
            className="h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
          >
            Marcar todas lidas
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <article className="border border-[#D8E6EB] bg-[#F2F7F9] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Nao lidas</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{unreadCount}</p>
        </article>
        <article className="border border-[#D8E6EB] bg-[#F2F7F9] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Visiveis</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{visibleItems.length}</p>
        </article>
        <article className="border border-[#D8E6EB] bg-[#F2F7F9] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Total carregado</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{items.length}</p>
        </article>
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && visibleItems.length === 0 ? (
          <p className="text-sm font-semibold text-[#6d7f84]">Carregando notificacoes...</p>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-5 py-8 text-center">
            <Inbox className="mx-auto h-8 w-8 text-[#1398B7]" />
            <p className="mt-3 font-readex text-base font-semibold text-[#15323b]">Nenhuma notificacao</p>
            <p className="mt-1 text-sm font-medium text-[#6d7f84]">
              Quando o admin ou a operacao enviarem algo importante, voce encontra aqui.
            </p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const isUnread = !item.read_at

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleOpenNotification(item)}
                className="block w-full border border-[#D8E6EB] bg-white px-5 py-4 text-left transition hover:bg-[#F2F7F9]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-1 h-2.5 w-2.5 shrink-0 border',
                      isUnread ? 'border-[#1398B7] bg-[#1398B7]' : 'border-[#D8E6EB] bg-white',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="line-clamp-1 font-readex text-sm font-semibold text-[#15323b]">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-[#8BA0A7]">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-[#5F7077]">
                      {item.body}
                    </span>
                    <span className="mt-3 flex items-center gap-2">
                      <span
                        className={cn(
                          'border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                          getPriorityClassName(item.priority),
                        )}
                      >
                        {item.category}
                      </span>
                      {item.action_url ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#1398B7]">
                          Abrir <ExternalLink className="h-3 w-3" />
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}
