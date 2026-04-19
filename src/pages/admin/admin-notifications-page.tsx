import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BellRing, Mail, MessageCircle, MonitorSmartphone, RefreshCw, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  fetchNotificationStats,
  fetchRecentQueueItems,
  processNotificationQueue,
  sendBroadcastNotification,
  type BroadcastNotificationResult,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationQueueItem,
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

export function AdminNotificationsPage() {
  const [queueItems, setQueueItems] = useState<NotificationQueueItem[]>([])
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
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('system')
  const [priority, setPriority] = useState<NotificationPriority>('normal')
  const [actionUrl, setActionUrl] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<NotificationChannel[]>(['in-app'])

  const pendingQueue = queueStats.pending + queueStats.retry
  const failedQueue = queueStats.failed + queueStats.bounced
  const sentQueue = queueStats.sent + queueStats.delivered

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [stats, recentItems] = await Promise.all([
        fetchNotificationStats(),
        fetchRecentQueueItems(),
      ])
      setQueueStats(stats.queue)
      setTotalNotifications(stats.total)
      setUnreadNotifications(stats.unread)
      setQueueItems(recentItems)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar notificações.')
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Comunicação</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Notificações</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            Envie avisos para usuários, acompanhe a fila multi-canal e monitore falhas de entrega.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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

      <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4 text-sm font-semibold leading-6 text-[#15323b]">
        O envio externo por e-mail já usa a fila técnica da GenFlix, mas depende das variáveis SMTP definitivas.
        Enquanto SMTP/domínio não estiverem configurados, itens de e-mail permanecem em nova tentativa ou falha controlada.
        Acompanhe essa dependência em <a href="/admin/pendencias" className="font-black text-[#1398B7] underline">Pendências Operacionais</a>.
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total in-app', value: totalNotifications, helper: 'Notificações criadas' },
          { label: 'Não lidas', value: unreadNotifications, helper: 'Aguardando leitura' },
          { label: 'Fila pendente', value: pendingQueue, helper: 'Canais externos' },
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
              <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Monitoramento</h2>
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
    </div>
  )
}
