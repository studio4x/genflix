import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Paperclip, Send } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { TicketAttachment } from '@/components/support/ticket-attachment'
import { TicketSlaBadge } from '@/components/support/ticket-sla-badge'
import { TicketStatusBadge } from '@/components/support/ticket-status-badge'
import { Button } from '@/components/ui/button'
import {
  fetchSupportMessageById,
  fetchSupportSettings,
  fetchSupportTicketDetail,
  sendSupportMessage,
  updateSupportTicketStatus,
} from '@/features/support/api'
import { formatSupportDate, formatSupportBusinessHours, getSupportCategoryConfig, getSupportPriorityBadgeClass, getSupportUserDisplayName, supportPriorityLabelMap, supportStatusLabelMap } from '@/lib/support-sla'
import { supabase } from '@/services/supabase/client'
import type { SupportTicketDetail, SupportTicketStatus } from '@/features/support/types'

export function SupportTicketDetailPage() {
  const { ticketId = '' } = useParams()
  const location = useLocation()
  const { user, roles } = useAuth()
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null)
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSupportSettings>> | null>(null)
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const isAdminView = location.pathname.startsWith('/admin') || roles.includes('admin')

  const categoryConfig = useMemo(
    () => ticket ? getSupportCategoryConfig(ticket.category, settings?.sla) : null,
    [settings?.sla, ticket],
  )

  async function loadData() {
    if (!ticketId) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [ticketDetail, supportSettings] = await Promise.all([
        fetchSupportTicketDetail(ticketId),
        fetchSupportSettings(),
      ])

      setTicket(ticketDetail)
      setSettings(supportSettings)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel carregar o ticket.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [ticketId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [ticket?.messages.length])

  useEffect(() => {
    if (!ticketId) {
      return undefined
    }

    const channel = supabase
      .channel(`support-chat-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload) => {
          const messageId = String(payload.new.id ?? '')
          if (!messageId) {
            return
          }

          const nextMessage = await fetchSupportMessageById(messageId).catch(() => null)
          if (!nextMessage) {
            return
          }

          setTicket((current) => {
            if (!current || current.messages.some((message) => message.id === nextMessage.id)) {
              return current
            }

            return {
              ...current,
              messages: [...current.messages, nextMessage],
            }
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${ticketId}`,
        },
        (payload) => {
          setTicket((current) => current ? {
            ...current,
            status: payload.new.status as SupportTicketStatus,
            priority: payload.new.priority as SupportTicketDetail['priority'],
            category: payload.new.category as SupportTicketDetail['category'],
            first_response_due_at: String(payload.new.first_response_due_at ?? current.first_response_due_at),
            first_response_at: payload.new.first_response_at ? String(payload.new.first_response_at) : null,
            sla_policy_key: String(payload.new.sla_policy_key ?? current.sla_policy_key),
            sla_status: payload.new.sla_status as SupportTicketDetail['sla_status'],
            updated_at: String(payload.new.updated_at ?? current.updated_at),
          } : current)
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [ticketId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!ticket) {
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      const message = await sendSupportMessage({
        ticketId: ticket.id,
        message: draft,
        attachment,
      })

      setDraft('')
      setAttachment(null)
      setTicket((current) => current ? {
        ...current,
        messages: current.messages.some((item) => item.id === message.id)
          ? current.messages
          : [...current.messages, message],
      } : current)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel enviar a mensagem.')
    } finally {
      setIsSending(false)
    }
  }

  async function handleStatusChange(nextStatus: SupportTicketStatus) {
    if (!ticket || nextStatus === ticket.status) {
      return
    }

    setIsUpdatingStatus(true)
    setErrorMessage(null)

    try {
      const updated = await updateSupportTicketStatus(ticket.id, nextStatus)
      setTicket((current) => current ? { ...current, ...updated, messages: current.messages } : current)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel atualizar o status do ticket.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm font-semibold text-[#5F7077]">Carregando ticket...</p>
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        {errorMessage ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <p className="text-sm font-semibold text-[#5F7077]">Ticket nao encontrado.</p>
      </div>
    )
  }

  const canReply = isAdminView || ticket.status !== 'closed'
  const backPath = isAdminView
    ? '/admin/suporte'
    : location.pathname.startsWith('/criador')
      ? '/criador/suporte'
      : '/aluno/suporte'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-black text-[#1398B7]">
            <ArrowLeft className="h-4 w-4" />
            Voltar para a lista
          </Link>
          <h1 className="mt-3 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">{ticket.subject}</h1>
          <p className="mt-2 text-sm font-semibold text-[#6d7f84]">
            Ticket #{ticket.id.slice(0, 8).toUpperCase()} · Aberto em {formatSupportDate(ticket.created_at, false)}
          </p>
        </div>

        <TicketStatusBadge status={ticket.status} />
      </header>

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-4">
        <section className="space-y-6 md:col-span-3">
          <article className="overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#D8E6EB] px-5 py-4">
              <div>
                <h2 className="font-readex text-xl font-semibold text-[#15323b]">Historico de mensagens</h2>
              </div>

              {isAdminView ? (
                <select
                  value={ticket.status}
                  onChange={(event) => void handleStatusChange(event.target.value as SupportTicketStatus)}
                  disabled={isUpdatingStatus}
                  className="h-10 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                >
                  {Object.entries(supportStatusLabelMap).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="flex h-[600px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FBFC] p-5">
                <div className="max-w-[min(82%,720px)] rounded-[22px] border border-[#D8E6EB] bg-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8BA0A7]">Descricao do problema</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#15323b]">{ticket.description}</p>
                  {ticket.attachment_url ? (
                    <div className="mt-4">
                      <TicketAttachment url={ticket.attachment_url} name={ticket.attachment_name} />
                    </div>
                  ) : null}
                  <p className="mt-4 text-[11px] font-bold text-[#8BA0A7]">{formatSupportDate(ticket.created_at)}</p>
                </div>

                {ticket.messages.map((message) => {
                  const isMine = message.sender_id === user?.id

                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[min(82%,720px)] rounded-[22px] border px-4 py-4 shadow-sm ${
                          isMine
                            ? 'rounded-tr-[8px] border-[#1398B7] bg-[#1398B7] text-white'
                            : 'rounded-tl-[8px] border-[#D8E6EB] bg-white text-[#15323b]'
                        }`}
                      >
                        {!isMine ? (
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Equipe de suporte</p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7">{message.message}</p>
                        {message.attachment_url ? (
                          <div className="mt-4">
                            <TicketAttachment url={message.attachment_url} name={message.attachment_name} compact />
                          </div>
                        ) : null}
                        <p className={`mt-3 text-[11px] font-bold ${isMine ? 'text-white/70' : 'text-[#8BA0A7]'}`}>
                          {formatSupportDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {!canReply ? (
                <div className="border-t border-[#D8E6EB] bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
                  Este chamado foi encerrado.
                </div>
              ) : null}

              {canReply ? (
                <form onSubmit={(event) => void handleSubmit(event)} className="border-t border-[#D8E6EB] bg-white p-4">
                  {attachment ? (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-2 text-xs font-semibold text-[#15323b]">
                      <Paperclip className="h-3.5 w-3.5 text-[#1398B7]" />
                      <span className="max-w-[220px] truncate">{attachment.name}</span>
                      <button type="button" onClick={() => setAttachment(null)} className="font-black text-[#1398B7]">
                        Remover
                      </button>
                    </div>
                  ) : null}

                  <div className="flex gap-3">
                    <label className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] text-[#1398B7]">
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                      />
                    </label>

                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={2}
                      className="min-h-12 flex-1 resize-none rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none"
                      placeholder="Digite sua mensagem..."
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          event.currentTarget.form?.requestSubmit()
                        }
                      }}
                    />

                    <Button
                      type="submit"
                      disabled={isSending || (!draft.trim() && !attachment)}
                      className="h-12 rounded-2xl bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 font-black text-white hover:opacity-95"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </article>
        </section>

        <aside className="space-y-4">
          <article className="rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Informacoes</h2>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Usuario</p>
                <p className="mt-1 font-semibold text-[#15323b]">{getSupportUserDisplayName(ticket.user ?? null)}</p>
                <p className="text-xs text-[#6d7f84]">{ticket.user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Categoria</p>
                <p className="mt-1 font-semibold text-[#15323b]">{categoryConfig?.label ?? ticket.category}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Prioridade</p>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getSupportPriorityBadgeClass(ticket.priority)}`}>
                  {supportPriorityLabelMap[ticket.priority]}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">SLA da primeira resposta</p>
                <div className="mt-2">
                  <TicketSlaBadge ticket={ticket} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Prazo previsto</p>
                <p className="mt-1 font-semibold text-[#15323b]">{formatSupportDate(ticket.first_response_due_at)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Primeira resposta</p>
                <p className="mt-1 font-semibold text-[#15323b]">{ticket.first_response_at ? formatSupportDate(ticket.first_response_at) : 'Aguardando'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8BA0A7]">Ultima atualizacao</p>
                <p className="mt-1 font-semibold text-[#15323b]">{formatSupportDate(ticket.updated_at)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            <p className="font-black">{categoryConfig?.description ?? 'Primeira resposta conforme a categoria do chamado.'}</p>
            <p className="mt-2 text-xs font-semibold">
              Horario de atendimento: {settings ? formatSupportBusinessHours(settings.businessHours) : '-'}
            </p>
          </article>

          <article className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-900">
            <p className="font-black">Se houver fraude, seguranca ou risco imediato, mantenha o chamado ativo e registre o maximo de contexto possivel.</p>
          </article>
        </aside>
      </div>
    </div>
  )
}
