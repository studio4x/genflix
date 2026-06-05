import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, ExternalLink, Inbox, RefreshCw, X } from 'lucide-react'

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
    return `há ${diffInMinutes} min`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `há ${diffInHours} h`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `há ${diffInDays} dia${diffInDays === 1 ? '' : 's'}`
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

export function NotificationCenter({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clearedAt, setClearedAt] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const visibleItems = useMemo(() => {
    const filteredItems = clearedAt
      ? items.filter((item) => new Date(item.created_at).getTime() > clearedAt)
      : items

    return filteredItems.slice(0, compact ? 5 : 8)
  }, [clearedAt, compact, items])

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setUnreadCount(0)
      setClearedAt(null)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [notificationRows, count] = await Promise.all([
        fetchNotifications(compact ? 8 : 15),
        fetchUnreadNotificationCount(),
      ])
      setItems(notificationRows)
      setUnreadCount(count)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as notificações.')
    } finally {
      setIsLoading(false)
    }
  }, [compact, user?.id])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`notifications:${user.id}`)
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

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  async function handleOpenNotification(notification: AppNotification) {
    if (!notification.read_at) {
      await markNotificationRead(notification.id)
      await loadNotifications()
    }

    if (notification.action_url) {
      setIsOpen(false)
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

  function handleClearAllVisible() {
    setClearedAt(Date.now())
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center border border-[#D8E6EB] bg-white text-[#0A3640] shadow-sm transition hover:border-[#1398B7]/50 hover:bg-[#E8F6FA]"
        aria-label="Abrir notificações"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center bg-[#1398B7] px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-3 w-[min(92vw,420px)] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(10,54,64,0.16)]">
          <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[#F2F7F9] px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Notificações</p>
              <h2 className="mt-1 font-readex text-lg font-semibold text-[#15323b]">
                {unreadCount > 0 ? `${unreadCount} nova${unreadCount === 1 ? '' : 's'}` : 'Tudo em dia'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadNotifications()}
                className="inline-flex h-9 w-9 items-center justify-center border border-[#D8E6EB] bg-white text-[#5F7077] hover:border-[#1398B7]/50 hover:text-[#0A3640]"
                aria-label="Atualizar notificações"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading ? 'animate-spin' : '')} />
              </button>
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="inline-flex h-9 w-9 items-center justify-center border border-[#D8E6EB] bg-white text-[#5F7077] hover:border-[#1398B7]/50 hover:text-[#0A3640]"
                aria-label="Marcar todas como lidas"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="m-4 border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && visibleItems.length === 0 ? (
              <div className="p-5 text-sm font-semibold text-[#6d7f84]">Carregando notificações...</div>
            ) : visibleItems.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="mx-auto h-8 w-8 text-[#1398B7]" />
                <p className="mt-3 font-readex text-base font-semibold text-[#15323b]">Nenhuma notificação</p>
                <p className="mt-1 text-sm font-medium text-[#6d7f84]">Quando algo importante acontecer, aparece aqui.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D8E6EB]">
                {visibleItems.map((item) => {
                  const isUnread = !item.read_at
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleOpenNotification(item)}
                      className="block w-full bg-white px-5 py-4 text-left transition hover:bg-[#F2F7F9]"
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
                            <span className={cn('border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getPriorityClassName(item.priority))}>
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
                })}
              </div>
            )}
          </div>

          <div className="border-t border-[#D8E6EB] bg-[#F2F7F9] p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearAllVisible}
                disabled={visibleItems.length === 0}
                className="h-10 rounded-none border-[#D8E6EB] bg-white text-xs font-black text-[#0A3640] hover:border-[#1398B7]"
              >
                <X className="mr-2 h-4 w-4" />
                Limpar todas
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleMarkAllRead()}
                className="h-10 rounded-none border-[#D8E6EB] bg-white text-xs font-black text-[#0A3640] hover:border-[#1398B7]"
              >
                Marcar todas como lidas
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
