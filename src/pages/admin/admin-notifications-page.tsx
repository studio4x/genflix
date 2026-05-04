import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BellRing, CheckCircle2, Clock3, ExternalLink, Mail, MessageCircle, MonitorSmartphone, RefreshCw, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  fetchNotificationAdminSettings,
  fetchNotificationStats,
  fetchRecentQueueItems,
  fetchPlatformNotifications,
  processNotificationQueue,
  saveNotificationAdminSettings,
  sendBroadcastNotification,
  type BroadcastNotificationResult,
  type NotificationAdminSettings,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationQueueItem,
  type PlatformNotification,
} from '@/features/notifications/api'
import { cn } from '@/lib/utils'

const roleOptions = [
  { value: 'admin', label: 'Admins' },
  { value: 'criador', label: 'Criadores' },
  { value: 'student', label: 'Alunos' },
  { value: 'aluno', label: 'Alunos legado' },
]

const channelOptions: Array<{ value: NotificationChannel; label: string; icon: typeof BellRing }> = [
  { value: 'in-app', label: 'In-app', icon: BellRing },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'push', label: 'Push', icon: MonitorSmartphone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

const priorityOptions: Array<{ value: NotificationPriority; label: string }> = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getStatusClassName(status: NotificationQueueItem['status']) {
  if (status === 'failed' || status === 'bounced') {
    return 'border-red-200 bg-red-50 text-red-700'
  }

  if (status === 'pending' || status === 'retry') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (status === 'sent' || status === 'delivered') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  return 'border-[#D8E6EB] bg-[#F2F7F9] text-[#5F7077]'
}

function getChannelClassName(channel: NotificationChannel) {
  if (channel === 'email') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (channel === 'whatsapp') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (channel === 'push') {
    return 'border-violet-200 bg-violet-50 text-violet-700'
  }

  return 'border-[#BEE3EA] bg-[#E8F6FA] text-[#0A3640]'
}

function getTabButtonClassName(isActive: boolean) {
  return cn(
    'rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition',
    isActive
      ? 'border-[#1398B7] bg-[#1398B7] text-white'
      : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:border-[#1398B7] hover:text-[#15323b]',
  )
}

function formatRecipientLabel(notification: PlatformNotification) {
  if (notification.recipient_full_name?.trim()) {
    return notification.recipient_full_name.trim()
  }

  if (notification.recipient_email?.trim()) {
    return notification.recipient_email.trim()
  }

  return notification.user_id
}

type AdminNotificationsTab = 'manuais' | 'plataforma' | 'operacoes'

function getQueueHealthMeta(pending: number, failed: number) {
  if (failed > 0) {
    return {
      label: 'Em atenção',
      icon: AlertTriangle,
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (pending > 0) {
    return {
      label: 'Processando',
      icon: Clock3,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    label: 'Estável',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
}

export function AdminNotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [queueItems, setQueueItems] = useState<NotificationQueueItem[]>([])
  const [operationsQueueItems, setOperationsQueueItems] = useState<NotificationQueueItem[]>([])
  const [platformItems, setPlatformItems] = useState<PlatformNotification[]>([])
  const [adminSettings, setAdminSettings] = useState<NotificationAdminSettings | null>(null)
  const [queueStats, setQueueStats] = useState({
    pending: 0,
    retry: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    bounced: 0,
    ignored: 0,
  })
  const [totalNotifications, setTotalNotifications] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [adminNotificationEmail, setAdminNotificationEmail] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('system')
  const [priority, setPriority] = useState<NotificationPriority>('normal')
  const [actionUrl, setActionUrl] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<NotificationChannel[]>(['in-app'])

  const requestedTab = searchParams.get('tab')
  const activeTab: AdminNotificationsTab =
    requestedTab === 'plataforma' || requestedTab === 'operacoes' ? requestedTab : 'manuais'

  const pendingQueue = queueStats.pending + queueStats.retry
  const failedQueue = queueStats.failed + queueStats.bounced
  const sentQueue = queueStats.sent + queueStats.delivered

  const platformSummary = useMemo(() => {
    const withEmail = platformItems.filter((item) => item.channels.includes('email')).length
    const withInApp = platformItems.filter((item) => item.channels.includes('in-app')).length
    const withMultipleChannels = platformItems.filter((item) => item.channels.length > 1).length

    return {
      withEmail,
      withInApp,
      withMultipleChannels,
    }
  }, [platformItems])

  const operationsSummary = useMemo(() => {
    const uniqueChannels = new Set<NotificationChannel>()
    let lastActivityAt: string | null = null
    let retryingCount = 0

    for (const item of operationsQueueItems) {
      uniqueChannels.add(item.channel)
      if (!lastActivityAt || new Date(item.created_at).getTime() > new Date(lastActivityAt).getTime()) {
        lastActivityAt = item.created_at
      }

      if (item.status === 'retry') {
        retryingCount += 1
      }
    }

    const health = getQueueHealthMeta(pendingQueue, failedQueue)

    return {
      uniqueChannels: uniqueChannels.size,
      lastActivityAt,
      retryingCount,
      health,
    }
  }, [failedQueue, operationsQueueItems, pendingQueue])

  function renderTabButton(tab: AdminNotificationsTab, label: string) {
    const isActive = activeTab === tab

    return (
      <button
        key={tab}
        type="button"
        onClick={() => setSearchParams((current) => {
          const next = new URLSearchParams(current)
          if (tab === 'manuais') {
            next.delete('tab')
          } else {
            next.set('tab', tab)
          }
          return next
        }, { replace: true })}
        className={getTabButtonClassName(isActive)}
      >
        {label}
      </button>
    )
  }

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      if (activeTab === 'plataforma') {
        const [stats, recentItems] = await Promise.all([
          fetchNotificationStats(false),
          fetchPlatformNotifications(25),
        ])

        setQueueStats(stats.queue)
        setTotalNotifications(stats.total)
        setUnreadNotifications(stats.unread)
        setPlatformItems(recentItems)
      } else if (activeTab === 'operacoes') {
        const [stats, recentItems] = await Promise.all([
          fetchNotificationStats(false),
          fetchRecentQueueItems(25, false),
        ])

        setQueueStats(stats.queue)
        setTotalNotifications(stats.total)
        setUnreadNotifications(stats.unread)
        setOperationsQueueItems(recentItems)
      } else {
        const [stats, recentItems, settings] = await Promise.all([
          fetchNotificationStats(true),
          fetchRecentQueueItems(25, true),
          fetchNotificationAdminSettings(),
        ])
        setQueueStats(stats.queue)
        setTotalNotifications(stats.total)
        setUnreadNotifications(stats.unread)
        setQueueItems(recentItems)
        setAdminSettings(settings)
        setAdminNotificationEmail(settings.admin_notification_email ?? '')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar notificações.')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const selectedChannelLabels = useMemo(
    () => channelOptions
      .filter((channel) => selectedChannels.includes(channel.value))
      .map((channel) => channel.label)
      .join(', '),
    [selectedChannels],
  )

  function toggleRole(roleCode: string) {
    setSelectedRoles((current) =>
      current.includes(roleCode)
        ? current.filter((item) => item !== roleCode)
        : [...current, roleCode],
    )
  }

  function toggleChannel(channel: NotificationChannel) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    )
  }

  async function handleSaveAdminSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSavingSettings(true)

    try {
      const savedSettings = await saveNotificationAdminSettings(adminNotificationEmail)
      setAdminSettings(savedSettings)
      setAdminNotificationEmail(savedSettings.admin_notification_email ?? '')
      setSuccessMessage(
        savedSettings.admin_notification_email
          ? `E-mail administrativo padrÃ£o salvo: ${savedSettings.admin_notification_email}.`
          : 'E-mail administrativo padrÃ£o removido.',
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel salvar o e-mail administrativo.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (selectedChannels.length === 0) {
      setErrorMessage('Selecione ao menos um canal.')
      return
    }

    setIsSending(true)

    try {
      const result = await sendBroadcastNotification({
        title,
        body,
        category,
        priority,
        actionUrl: actionUrl.trim() || null,
        roleCodes: selectedRoles,
        channels: selectedChannels,
      }) as BroadcastNotificationResult

      setSuccessMessage(
        `Notificação enviada para ${result.recipient_count} usuário(s), com ${result.queued_count} entrega(s) registradas.`,
      )
      setTitle('')
      setBody('')
      setActionUrl('')
      await loadDashboard()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar a notificação.')
    } finally {
      setIsSending(false)
    }
  }

  async function handleProcessQueue() {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsProcessingQueue(true)

    try {
      const result = await processNotificationQueue()
      setSuccessMessage(
        `Fila processada: ${result.processed} item(ns), ${result.sent} enviado(s), ${result.retrying} em nova tentativa, ${result.failed} falha(s), ${result.ignored} ignorado(s).`,
      )
      await loadDashboard()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível processar a fila de notificações.')
    } finally {
      setIsProcessingQueue(false)
    }
  }

  const HealthIcon = operationsSummary.health.icon

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Comunicação</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Notificações</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            {activeTab === 'plataforma'
              ? 'Consulte o histórico completo de notificações enviadas pela plataforma, incluindo e-mails e mensagens internas.'
              : activeTab === 'operacoes'
                ? 'Monitore a fila de e-mails e acompanhe os processos críticos que dependem de processamento contínuo.'
              : 'Envie avisos para usuários e acompanhe apenas os envios manuais registrados nesta área.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {renderTabButton('manuais', 'Manuais')}
            {renderTabButton('plataforma', 'Plataforma')}
            {renderTabButton('operacoes', 'Operações')}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {activeTab === 'manuais' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleProcessQueue()}
              disabled={isProcessingQueue}
              className="h-11 rounded-none border-[#1398B7] bg-white font-black text-[#0A3640] hover:bg-[#E8F6FA]"
            >
              <Send className="mr-2 h-4 w-4" />
              {isProcessingQueue ? 'Processando...' : 'Processar fila'}
            </Button>
          ) : null}
          {activeTab === 'operacoes' ? (
            <Link
              to="/admin/pendencias"
              className="inline-flex h-11 items-center justify-center rounded-none border border-[#D8E6EB] bg-white px-4 font-black text-[#0A3640] transition hover:border-[#1398B7] hover:bg-[#F2F7F9]"
            >
              Pendências operacionais
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadDashboard()}
            disabled={isLoading}
            className="h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading ? 'animate-spin' : '')} />
            Atualizar
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {activeTab === 'manuais' ? (
        <>
          <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4 text-sm font-semibold leading-6 text-[#15323b]">
            Esta página exibe apenas notificações enviadas manualmente a partir do painel.
            O envio externo por e-mail já usa a fila técnica da GenFlix, mas depende das variáveis SMTP definitivas.
            Enquanto SMTP/domínio não estiverem configurados, itens de e-mail permanecem em nova tentativa ou falha controlada.
            Acompanhe essa dependência em <a href="/admin/pendencias" className="font-black text-[#1398B7] underline">Pendências Operacionais</a>.
          </div>

          <section className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
            <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Configuração global</p>
                <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">
                  E-mail padrão para notificações administrativas
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
                  Use este endereço como caixa de destino principal para alertas internos, operacionais e avisos que
                  precisem chegar fora do painel.
                </p>
              </div>
              <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Atual</p>
                <p className="mt-1 font-readex text-sm font-semibold text-[#15323b]">
                  {adminSettings?.admin_notification_email ?? 'Não configurado'}
                </p>
              </div>
            </div>

            <form onSubmit={(event) => void handleSaveAdminSettings(event)} className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="flex-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">E-mail administrativo</span>
                <input
                  type="email"
                  value={adminNotificationEmail}
                  onChange={(event) => setAdminNotificationEmail(event.target.value)}
                  className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  placeholder="ex.: operacao@genflix.com.br"
                />
              </label>

              <Button
                type="submit"
                disabled={isLoading || isSavingSettings}
                className="h-12 rounded-none bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-6 font-black text-white hover:opacity-95"
              >
                {isSavingSettings ? 'Salvando...' : 'Salvar e-mail'}
              </Button>
            </form>

            <p className="mt-3 text-xs font-semibold leading-6 text-[#6d7f84]">
              Se vazio, a plataforma continua operando sem um e-mail administrativo padrão.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total manual', value: totalNotifications, helper: 'Notificações enviadas manualmente' },
              { label: 'Não lidas', value: unreadNotifications, helper: 'Aguardando leitura' },
              { label: 'Fila manual', value: pendingQueue, helper: 'Canais externos registrados manualmente' },
              { label: 'Falhas', value: failedQueue, helper: 'Exigem análise' },
            ].map((card) => (
              <article key={card.label} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_34px_rgba(10,54,64,0.05)]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{card.label}</p>
                <p className="mt-3 font-readex text-4xl font-semibold text-[#0A3640]">{card.value}</p>
                <p className="mt-2 text-sm font-semibold text-[#6d7f84]">{card.helper}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <form onSubmit={(event) => void handleSubmit(event)} className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
              <div className="border-b border-[#D8E6EB] pb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Envio manual</p>
                <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Enviar notificação</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#6d7f84]">
                  A v1 registra entrega in-app imediatamente e prepara a fila para e-mail, push e WhatsApp.
                </p>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Título</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    maxLength={200}
                    className="h-12 border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    placeholder="Ex.: Novo curso disponível"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Mensagem</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    rows={5}
                    className="resize-none border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-7 text-[#15323b] outline-none focus:border-[#1398B7]"
                    placeholder="Escreva uma mensagem curta e clara..."
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Categoria</span>
                    <input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="h-12 border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      placeholder="course, payment, system..."
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Prioridade</span>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as NotificationPriority)}
                      className="h-12 border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#15323b] outline-none focus:border-[#1398B7]"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">URL de ação opcional</span>
                  <input
                    value={actionUrl}
                    onChange={(event) => setActionUrl(event.target.value)}
                    className="h-12 border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    placeholder="/aluno/cursos ou https://..."
                  />
                </label>

                <div className="grid gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Público</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roleOptions.map((role) => (
                      <label key={role.value} className="flex cursor-pointer items-center gap-3 border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.value)}
                          onChange={() => toggleRole(role.value)}
                          className="h-4 w-4 accent-[#1398B7]"
                        />
                        <span className="text-sm font-black text-[#15323b]">{role.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-[#6d7f84]">Sem filtro selecionado, envia para todos os usuários.</p>
                </div>

                <div className="grid gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Canais</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {channelOptions.map((channel) => {
                      const Icon = channel.icon
                      const isSelected = selectedChannels.includes(channel.value)

                      return (
                        <label
                          key={channel.value}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 border px-4 py-3 transition',
                            isSelected
                              ? 'border-[#1398B7] bg-[#E8F6FA] text-[#0A3640]'
                              : 'border-[#D8E6EB] bg-white text-[#5F7077]',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleChannel(channel.value)}
                            className="h-4 w-4 accent-[#1398B7]"
                          />
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-black">{channel.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs font-semibold text-[#6d7f84]">Selecionado: {selectedChannelLabels || 'nenhum canal'}.</p>
                </div>
              </div>

              <div className="mt-6 border-t border-[#D8E6EB] pt-5">
                <Button
                  type="submit"
                  disabled={isSending}
                  className="h-12 w-full rounded-none bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] font-readex text-sm font-semibold text-white hover:opacity-95"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSending ? 'Enviando...' : 'Enviar notificação'}
                </Button>
              </div>
            </form>

            <section className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
              <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Fila de entrega</p>
                  <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Monitoramento manual</h2>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2">
                    <p className="text-lg font-black text-[#0A3640]">{pendingQueue}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Pend.</p>
                  </div>
                  <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2">
                    <p className="text-lg font-black text-[#0A3640]">{sentQueue}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Env.</p>
                  </div>
                  <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2">
                    <p className="text-lg font-black text-red-700">{failedQueue}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Falha</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-hidden border border-[#D8E6EB]">
                {isLoading ? (
                  <p className="p-5 text-sm font-semibold text-[#6d7f84]">Carregando fila...</p>
                ) : queueItems.length === 0 ? (
                  <p className="p-5 text-sm font-semibold text-[#6d7f84]">Nenhuma entrega registrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                      <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                        <tr>
                          <th className="px-4 py-3">Canal</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Título</th>
                          <th className="px-4 py-3">Criado em</th>
                          <th className="px-4 py-3">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8E6EB]">
                        {queueItems.map((item) => (
                          <tr key={item.id} className="align-top">
                            <td className="px-4 py-3 text-xs font-black uppercase text-[#0A3640]">{item.channel}</td>
                            <td className="px-4 py-3">
                              <span className={cn('inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getStatusClassName(item.status))}>
                                {item.status}
                              </span>
                            </td>
                            <td className="max-w-[260px] px-4 py-3">
                              <p className="line-clamp-1 font-black text-[#15323b]">{item.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#6d7f84]">{item.body}</p>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-[#6d7f84]">{formatDateTime(item.created_at)}</td>
                            <td className="max-w-[220px] px-4 py-3 text-xs font-semibold text-red-700">
                              {item.final_error || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </section>
        </>
      ) : activeTab === 'operacoes' ? (
        <>
          <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4 text-sm font-semibold leading-6 text-[#15323b]">
            Esta aba consolida o pulso operacional da plataforma: fila de e-mails, reprocessamentos, pontos de falha
            e atalhos para os fluxos críticos que precisam estar saudáveis no dia a dia.
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Pendente / retry',
                value: pendingQueue,
                helper: 'Entregas aguardando processamento',
              },
              {
                label: 'Falhas / bounced',
                value: failedQueue,
                helper: 'Entregas que exigem revisão',
              },
              {
                label: 'Concluídos',
                value: sentQueue,
                helper: 'Itens enviados ou entregues',
              },
              {
                label: 'Canais monitorados',
                value: operationsSummary.uniqueChannels,
                helper: 'Presença recente na fila',
              },
            ].map((card) => (
              <article key={card.label} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_34px_rgba(10,54,64,0.05)]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{card.label}</p>
                <p className="mt-3 font-readex text-4xl font-semibold text-[#0A3640]">{card.value}</p>
                <p className="mt-2 text-sm font-semibold text-[#6d7f84]">{card.helper}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <article className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
              <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Fila de e-mails</p>
                  <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Monitoramento operacional</h2>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
                    Acompanhe os itens recentes da fila técnica, o volume de retries e o último momento de atividade
                    para detectar interrupções rapidamente.
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-2 border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]',
                    operationsSummary.health.className,
                  )}
                >
                  <HealthIcon className="h-3.5 w-3.5" />
                  {operationsSummary.health.label}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Em retry</p>
                  <p className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{operationsSummary.retryingCount}</p>
                </div>
                <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Última atividade</p>
                  <p className="mt-1 font-readex text-sm font-semibold text-[#15323b]">
                    {formatDateTime(operationsSummary.lastActivityAt)}
                  </p>
                </div>
                <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Monitorados</p>
                  <p className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{operationsQueueItems.length}</p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden border border-[#D8E6EB]">
                {isLoading ? (
                  <p className="p-5 text-sm font-semibold text-[#6d7f84]">Carregando operação...</p>
                ) : operationsQueueItems.length === 0 ? (
                  <p className="p-5 text-sm font-semibold text-[#6d7f84]">Nenhuma atividade operacional recente encontrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                      <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                        <tr>
                          <th className="px-4 py-3">Canal</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Título</th>
                          <th className="px-4 py-3">Tentativas</th>
                          <th className="px-4 py-3">Próxima</th>
                          <th className="px-4 py-3">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8E6EB]">
                        {operationsQueueItems.map((item) => (
                          <tr key={item.id} className="align-top">
                            <td className="px-4 py-3 text-xs font-black uppercase text-[#0A3640]">{item.channel}</td>
                            <td className="px-4 py-3">
                              <span className={cn('inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getStatusClassName(item.status))}>
                                {item.status}
                              </span>
                            </td>
                            <td className="max-w-[260px] px-4 py-3">
                              <p className="line-clamp-1 font-black text-[#15323b]">{item.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#6d7f84]">{item.body}</p>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-[#6d7f84]">{item.attempt_count}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-[#6d7f84]">{formatDateTime(item.next_retry_at)}</td>
                            <td className="max-w-[220px] px-4 py-3 text-xs font-semibold text-red-700">
                              {item.final_error || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </article>

            <aside className="space-y-4">
              {[
                {
                  title: 'Crons e jobs críticos',
                  description:
                    'Use esta área para acompanhar os processos que alimentam a operação, como envio automático, rotinas agendadas e reprocessamentos.',
                  status: 'Vinculado',
                  tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  actionLabel: 'Abrir pendências',
                  actionTo: '/admin/pendencias',
                },
                {
                  title: 'Pagamentos e webhooks',
                  description:
                    'Quando um processo crítico não for da fila de notificação, verifique o ciclo financeiro e os eventos recebidos do gateway.',
                  status: 'Monitorar',
                  tone: 'border-amber-200 bg-amber-50 text-amber-700',
                  actionLabel: 'Abrir pagamentos',
                  actionTo: '/admin/pagamentos',
                },
                {
                  title: 'Repasses e sincronizações',
                  description:
                    'Repasses e sincronizações em segundo plano continuam como ponto de atenção operacional até a rotina ficar totalmente estável.',
                  status: 'Acompanhar',
                  tone: 'border-[#BEE3EA] bg-[#E8F6FA] text-[#0A3640]',
                  actionLabel: 'Abrir repasses',
                  actionTo: '/admin/repasses',
                },
              ].map((item) => (
                <article key={item.title} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_34px_rgba(10,54,64,0.05)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Processo crítico</p>
                      <h3 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">{item.title}</h3>
                    </div>
                    <span className={cn('inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', item.tone)}>
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-medium leading-6 text-[#6d7f84]">{item.description}</p>

                  <Link
                    to={item.actionTo}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#1398B7] underline decoration-[#1398B7]/40 underline-offset-4"
                  >
                    {item.actionLabel}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </aside>
          </section>
        </>
      ) : (
        <>
          <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4 text-sm font-semibold leading-6 text-[#15323b]">
            Esta aba reúne todas as notificações geradas pela plataforma, incluindo e-mails, avisos in-app e
            registros enviados para outros canais quando existirem.
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total geral', value: totalNotifications, helper: 'Todas as notificações geradas' },
              { label: 'Não lidas', value: unreadNotifications, helper: 'Aguardando leitura' },
              { label: 'Com e-mail', value: platformSummary.withEmail, helper: 'Incluem canal e-mail' },
              { label: 'Com in-app', value: platformSummary.withInApp, helper: 'Incluem aviso interno' },
            ].map((card) => (
              <article key={card.label} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_34px_rgba(10,54,64,0.05)]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{card.label}</p>
                <p className="mt-3 font-readex text-4xl font-semibold text-[#0A3640]">{card.value}</p>
                <p className="mt-2 text-sm font-semibold text-[#6d7f84]">{card.helper}</p>
              </article>
            ))}
          </section>

          <section className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
            <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Histórico geral</p>
                <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Notificações da plataforma</h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
                  Visualize o que foi enviado pela plataforma com seus canais, destinatários e situação de leitura.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2">
                  <p className="text-lg font-black text-[#0A3640]">{platformSummary.withMultipleChannels}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Multi</p>
                </div>
                <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2">
                  <p className="text-lg font-black text-[#0A3640]">{platformItems.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Carreg.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden border border-[#D8E6EB]">
              {isLoading ? (
                <p className="p-5 text-sm font-semibold text-[#6d7f84]">Carregando histórico...</p>
              ) : platformItems.length === 0 ? (
                <p className="p-5 text-sm font-semibold text-[#6d7f84]">Nenhuma notificação registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                    <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                      <tr>
                        <th className="px-4 py-3">Destinatário</th>
                        <th className="px-4 py-3">Título</th>
                        <th className="px-4 py-3">Canais</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8E6EB]">
                      {platformItems.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="px-4 py-3">
                            <p className="font-black text-[#15323b]">{formatRecipientLabel(item)}</p>
                            <p className="mt-1 text-xs font-semibold text-[#6d7f84]">{item.recipient_email ?? item.user_id}</p>
                          </td>
                          <td className="max-w-[260px] px-4 py-3">
                            <p className="line-clamp-1 font-black text-[#15323b]">{item.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#6d7f84]">{item.body}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {item.channels.length > 0 ? (
                                item.channels.map((channel) => (
                                  <span
                                    key={channel}
                                    className={cn('inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getChannelClassName(channel))}
                                  >
                                    {channel}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs font-semibold text-[#6d7f84]">Sem canal</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-black uppercase text-[#0A3640]">{item.category}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                              item.read_at ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700',
                            )}>
                              {item.read_at ? 'lida' : 'nao lida'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#6d7f84]">{formatDateTime(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
