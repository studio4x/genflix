import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Flag, Inbox, MessageCircle, RefreshCw, Search, Send, ShieldCheck, UserPlus, X } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createCourseCreatorConversation,
  createDirectConversation,
  fetchConversationMessages,
  fetchConversations,
  fetchMessageReports,
  markConversationRead,
  reportConversationMessage,
  resolveMessageReport,
  searchMessageRecipients,
  sendConversationMessage,
  type ConversationMessage,
  type ConversationSummary,
  type MessageReportReason,
  type MessageReportSummary,
  type MessageRecipient,
} from '@/features/messages/api'
import { cn } from '@/lib/utils'
import { supabase } from '@/services/supabase/client'

function formatConversationDate(value: string | null) {
  if (!value) {
    return 'Nova'
  }

  const date = new Date(value)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()

  return new Intl.DateTimeFormat('pt-BR', isToday ? {
    hour: '2-digit',
    minute: '2-digit',
  } : {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function getDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
  if (fullName?.trim()) {
    return fullName.trim()
  }

  if (email?.trim()) {
    return email.split('@')[0]
  }

  return 'Usuário GenFlix'
}

const reportReasonLabels: Record<MessageReportReason, string> = {
  spam: 'Spam',
  harassment: 'Assédio',
  inappropriate: 'Conteúdo inadequado',
  abuse: 'Abuso',
  other: 'Outro motivo',
}

function getConversationTitle(conversation: ConversationSummary) {
  if (conversation.metadata?.kind === 'creator_channel') {
    if (conversation.metadata.course_title?.trim()) {
      return `Criador do curso - ${conversation.metadata.course_title.trim()}`
    }

    const otherParticipant = conversation.participants.find((participant) => !participant.is_current_user)
    if (otherParticipant) {
      return getDisplayName(otherParticipant.full_name, otherParticipant.email)
    }
  }

  if (conversation.title?.trim()) {
    return conversation.title
  }

  const otherParticipants = conversation.participants.filter((participant) => !participant.is_current_user)
  if (otherParticipants.length === 0) {
    return 'Conversa'
  }

  return otherParticipants
    .map((participant) => getDisplayName(participant.full_name, participant.email))
    .join(', ')
}

function getConversationSubtitle(conversation: ConversationSummary) {
  if (conversation.metadata?.kind === 'course_room') {
    return 'Sala do curso com alunos ativos'
  }

  if (conversation.metadata?.kind === 'creator_channel') {
    const otherParticipant = conversation.participants.find((participant) => !participant.is_current_user)
    return `Canal direto com ${getDisplayName(otherParticipant?.full_name, otherParticipant?.email)}`
  }

  const otherParticipant = conversation.participants.find((participant) => !participant.is_current_user)
  if (!otherParticipant) {
    return 'Sem outro participante'
  }

  return otherParticipant.email
}

function getConversationBadgeLabel(conversation: ConversationSummary) {
  if (conversation.metadata?.kind === 'course_room') {
    return 'Curso'
  }

  if (conversation.metadata?.kind === 'creator_channel') {
    return 'Criador'
  }

  return conversation.conversation_type === 'group' ? 'Grupo' : 'Direta'
}

function getConversationPriority(conversation: ConversationSummary) {
  if (conversation.metadata?.kind === 'course_room') {
    return 0
  }

  if (conversation.metadata?.kind === 'creator_channel') {
    return 1
  }

  return 2
}

function getSupportRoute(contextLabel: 'Admin' | 'Aluno' | 'Criador') {
  if (contextLabel === 'Admin') {
    return '/admin/suporte'
  }

  if (contextLabel === 'Criador') {
    return '/criador/suporte'
  }

  return '/aluno/suporte'
}

export function MessagesPage({ contextLabel }: { contextLabel: 'Admin' | 'Aluno' | 'Criador' }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedConversationIdRef = useRef(searchParams.get('conversation'))
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipients, setRecipients] = useState<MessageRecipient[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get('conversation'),
  )
  const [draft, setDraft] = useState('')
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSearchingRecipients, setIsSearchingRecipients] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isReporting, setIsReporting] = useState(false)
  const [reportTarget, setReportTarget] = useState<ConversationMessage | null>(null)
  const [reportReason, setReportReason] = useState<MessageReportReason>('inappropriate')
  const [reportDescription, setReportDescription] = useState('')
  const [messageReports, setMessageReports] = useState<MessageReportSummary[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const adminSection = contextLabel === 'Admin' && searchParams.get('section') === 'reports' ? 'reports' : 'messages'

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversation_id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )
  const supportRoute = useMemo(() => getSupportRoute(contextLabel), [contextLabel])
  const visibleConversations = useMemo(() => {
    const scopedConversations = contextLabel === 'Aluno'
      ? conversations.filter((conversation) => {
        if (conversation.metadata?.kind !== 'creator_channel') {
          return true
        }

        return conversation.conversation_id === selectedConversationId || conversation.message_count > 0
      })
      : conversations

    return [...scopedConversations].sort((left, right) => {
      const priorityDifference = getConversationPriority(left) - getConversationPriority(right)
      if (priorityDifference !== 0) {
        return priorityDifference
      }

      const leftTimestamp = left.last_message_at ? new Date(left.last_message_at).getTime() : 0
      const rightTimestamp = right.last_message_at ? new Date(right.last_message_at).getTime() : 0

      return rightTimestamp - leftTimestamp
    })
  }, [contextLabel, conversations, selectedConversationId])

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true)
    setErrorMessage(null)

    try {
      const rows = await fetchConversations()
      setConversations(rows)
      const prioritizedRows = [...rows].sort((left, right) => {
        const priorityDifference = getConversationPriority(left) - getConversationPriority(right)
        if (priorityDifference !== 0) {
          return priorityDifference
        }

        const leftTimestamp = left.last_message_at ? new Date(left.last_message_at).getTime() : 0
        const rightTimestamp = right.last_message_at ? new Date(right.last_message_at).getTime() : 0

        return rightTimestamp - leftTimestamp
      })

      if (!selectedConversationId && rows.length > 0) {
        const nextConversationId =
          requestedConversationIdRef.current && rows.some((conversation) => conversation.conversation_id === requestedConversationIdRef.current)
            ? requestedConversationIdRef.current
            : prioritizedRows[0]?.conversation_id ?? rows[0].conversation_id
        setSelectedConversationId(nextConversationId)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar conversas.')
    } finally {
      setIsLoadingConversations(false)
    }
  }, [selectedConversationId])

  const loadMessageReports = useCallback(async () => {
    if (contextLabel !== 'Admin') {
      return
    }

    setIsLoadingReports(true)

    try {
      const rows = await fetchMessageReports('pending')
      setMessageReports(rows)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar denúncias.')
    } finally {
      setIsLoadingReports(false)
    }
  }, [contextLabel])

  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true)
    setErrorMessage(null)

    try {
      const rows = await fetchConversationMessages(conversationId)
      setMessages(rows)
      await markConversationRead(conversationId)
      await loadConversations()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar mensagens.')
    } finally {
      setIsLoadingMessages(false)
    }
  }, [loadConversations])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    void loadMessageReports()
  }, [loadMessageReports])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current)
      nextParams.set('conversation', selectedConversationId)
      return nextParams
    }, { replace: true })

    void loadMessages(selectedConversationId)
  }, [loadMessages, selectedConversationId, setSearchParams])

  useEffect(() => {
    if (!selectedConversationId) {
      return undefined
    }

    const channel = supabase
      .channel(`conversation:${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          void loadMessages(selectedConversationId)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          void loadConversations()
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [loadConversations, loadMessages, selectedConversationId])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`message-inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadConversations()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reports',
        },
        () => {
          void loadMessageReports()
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [loadConversations, loadMessageReports, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      setIsSearchingRecipients(true)
      searchMessageRecipients(recipientQuery)
        .then((rows) => {
          if (isMounted) {
            setRecipients(rows)
          }
        })
        .catch((error) => {
          if (isMounted) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível buscar usuários.')
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsSearchingRecipients(false)
          }
        })
    }, 250)

    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [recipientQuery])

  async function handleSelectRecipient(recipient: MessageRecipient) {
    setErrorMessage(null)

    try {
      const conversationId = await createDirectConversation(recipient.id)
      setSelectedConversationId(conversationId)
      setRecipientQuery('')
      await loadConversations()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa.')
    }
  }

  async function handleOpenCourseCreatorChannel(courseId: string) {
    setErrorMessage(null)

    try {
      const conversationId = await createCourseCreatorConversation(courseId)
      requestedConversationIdRef.current = conversationId
      setSelectedConversationId(conversationId)
      await loadConversations()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel abrir o canal com o criador.')
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedConversationId || !draft.trim()) {
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      await sendConversationMessage(selectedConversationId, draft)
      setDraft('')
      await loadMessages(selectedConversationId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setIsSending(false)
    }
  }

  async function handleReportMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!reportTarget) {
      return
    }

    setIsReporting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await reportConversationMessage(reportTarget.id, reportReason, reportDescription)
      setReportTarget(null)
      setReportDescription('')
      setReportReason('inappropriate')
      setSuccessMessage('Denúncia enviada para moderação.')
      await loadMessageReports()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível denunciar a mensagem.')
    } finally {
      setIsReporting(false)
    }
  }

  async function handleResolveReport(reportId: string) {
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await resolveMessageReport(reportId)
      setSuccessMessage('Denúncia marcada como resolvida.')
      await loadMessageReports()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível resolver a denúncia.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">{contextLabel} / Mensagens</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Mensagens</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
            Converse com alunos e criadores em tempo real dentro da GenFlix. Para falar com administradores, use o canal de{' '}
            <Link to={supportRoute} className="font-black text-[#1398B7] underline underline-offset-2 hover:text-[#0A3640]">
              suporte
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {contextLabel === 'Admin' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearchParams((current) => {
                  const next = new URLSearchParams(current)
                  next.set('section', 'messages')
                  return next
                }, { replace: true })}
                className={`h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] ${
                  adminSection === 'messages' ? 'border-[#1398B7] bg-[#E8F6FA]' : 'hover:border-[#1398B7]'
                }`}
              >
                Conversas
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearchParams((current) => {
                  const next = new URLSearchParams(current)
                  next.set('section', 'reports')
                  return next
                }, { replace: true })}
                className={`h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] ${
                  adminSection === 'reports' ? 'border-[#1398B7] bg-[#E8F6FA]' : 'hover:border-[#1398B7]'
                }`}
              >
                Denúncias
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadConversations()}
            disabled={isLoadingConversations}
            className="h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoadingConversations ? 'animate-spin' : '')} />
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

      {contextLabel === 'Admin' && adminSection === 'reports' ? (
        <section className="border border-[#D8E6EB] bg-[#F8FBFC] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Moderação</p>
              <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Denúncias de mensagens</h2>
              <p className="mt-1 text-sm font-medium text-[#6d7f84]">
                Acompanhe mensagens reportadas pelos usuários e marque como resolvidas após análise.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMessageReports()}
              disabled={isLoadingReports}
              className="h-10 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', isLoadingReports ? 'animate-spin' : '')} />
              Atualizar denúncias
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoadingReports && messageReports.length === 0 ? (
              <p className="text-sm font-semibold text-[#6d7f84]">Carregando denúncias...</p>
            ) : messageReports.length === 0 ? (
              <div className="border border-dashed border-[#D8E6EB] bg-white p-4 text-sm font-bold text-[#6d7f84]">
                Nenhuma denúncia pendente no momento.
              </div>
            ) : (
              messageReports.map((report) => (
                <article key={report.report_id} className="border border-[#D8E6EB] bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800">
                          {reportReasonLabels[report.reason]}
                        </span>
                        <span className="text-xs font-bold text-[#8BA0A7]">
                          Reportado por {getDisplayName(report.reporter_name, report.reporter_email)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#15323b]">
                        {report.message_content}
                      </p>
                      {report.description ? (
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#6d7f84]">
                          Observação: {report.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs font-bold text-[#8BA0A7]">
                        Mensagem de {getDisplayName(report.sender_name, report.sender_email)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleResolveReport(report.report_id)}
                      className="rounded-none bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] font-black text-white"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Resolver
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {adminSection !== 'reports' ? (
      <section className="grid min-h-[680px] overflow-hidden border border-[#D8E6EB] bg-white shadow-[0_18px_42px_rgba(10,54,64,0.05)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-[#D8E6EB] bg-[#F2F7F9] xl:border-b-0 xl:border-r">
          <div className="border-b border-[#D8E6EB] p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8BA0A7]" />
              <input
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
                className="h-12 w-full border border-[#D8E6EB] bg-white pl-10 pr-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="Buscar usuário para conversar"
              />
            </label>

            {recipientQuery.trim() ? (
              <div className="mt-3 max-h-56 overflow-y-auto border border-[#D8E6EB] bg-white">
                {isSearchingRecipients ? (
                  <p className="p-3 text-sm font-semibold text-[#6d7f84]">Buscando...</p>
                ) : recipients.length === 0 ? (
                  <p className="p-3 text-sm font-semibold text-[#6d7f84]">Nenhum usuário encontrado.</p>
                ) : (
                  recipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => void handleSelectRecipient(recipient)}
                      className="flex w-full items-center gap-3 border-b border-[#D8E6EB] px-3 py-3 text-left last:border-b-0 hover:bg-[#E8F6FA]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] text-xs font-black text-white">
                        {getDisplayName(recipient.full_name, recipient.email).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-[#15323b]">
                          {getDisplayName(recipient.full_name, recipient.email)}
                        </span>
                        <span className="block truncate text-xs font-semibold text-[#6d7f84]">{recipient.email}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {isLoadingConversations && visibleConversations.length === 0 ? (
              <p className="p-5 text-sm font-semibold text-[#6d7f84]">Carregando conversas...</p>
            ) : visibleConversations.length === 0 ? (
              <div className="p-8 text-center">
                <UserPlus className="mx-auto h-8 w-8 text-[#1398B7]" />
                <p className="mt-3 font-readex text-base font-semibold text-[#15323b]">Comece uma conversa</p>
                <p className="mt-1 text-sm font-medium leading-6 text-[#6d7f84]">
                  Use a busca acima para encontrar outro usuário.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#D8E6EB]">
                {visibleConversations.map((conversation) => {
                  const isActive = conversation.conversation_id === selectedConversationId
                  return (
                    <button
                      key={conversation.conversation_id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.conversation_id)}
                      className={cn(
                        'block w-full px-4 py-4 text-left transition',
                        isActive ? 'bg-white' : 'hover:bg-white/70',
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="inline-flex items-center bg-[#E8F6FA] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0A3640]">
                            {getConversationBadgeLabel(conversation)}
                          </span>
                          <span className="block truncate font-readex text-sm font-semibold text-[#15323b]">
                            {getConversationTitle(conversation)}
                          </span>
                          <span className="mt-1 block truncate text-xs font-semibold text-[#6d7f84]">
                            {conversation.last_message_preview || getConversationSubtitle(conversation)}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-[11px] font-black text-[#8BA0A7]">
                            {formatConversationDate(conversation.last_message_at)}
                          </span>
                          {conversation.unread_count > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center bg-[#1398B7] px-1.5 text-[10px] font-black text-white">
                              {conversation.unread_count}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-[680px] flex-col">
          {selectedConversation ? (
            <>
              <div className="border-b border-[#D8E6EB] bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] font-black text-white">
                        {getConversationTitle(selectedConversation).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1398B7]">
                          {getConversationBadgeLabel(selectedConversation)}
                        </p>
                        <h2 className="truncate font-readex text-lg font-semibold text-[#15323b]">
                          {getConversationTitle(selectedConversation)}
                        </h2>
                        <p className="truncate text-xs font-semibold text-[#6d7f84]">
                          {selectedConversation.metadata?.kind === 'course_room'
                            ? `${selectedConversation.participants.length} aluno(s) com acesso ativo`
                            : selectedConversation.metadata?.kind === 'creator_channel'
                              ? 'Canal privado entre aluno e criador'
                              : `${selectedConversation.participants.length} participante(s)`}
                        </p>
                      </div>
                    </div>

                    {contextLabel === 'Aluno' && selectedConversation.metadata?.kind === 'course_room' && selectedConversation.metadata.course_id ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleOpenCourseCreatorChannel(selectedConversation.metadata.course_id!)}
                        className="shrink-0 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
                      >
                        Falar com o criador
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white p-5">
                {isLoadingMessages && messages.length === 0 ? (
                  <p className="text-sm font-semibold text-[#6d7f84]">Carregando mensagens...</p>
                ) : messages.length === 0 ? (
                  <div className="flex h-full min-h-[420px] items-center justify-center text-center">
                    <div>
                      <MessageCircle className="mx-auto h-10 w-10 text-[#1398B7]" />
                      <p className="mt-3 font-readex text-lg font-semibold text-[#15323b]">Nenhuma mensagem ainda</p>
                      <p className="mt-1 text-sm font-medium text-[#6d7f84]">Envie a primeira mensagem desta conversa.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isMine = message.sender_id === user?.id
                      return (
                        <div key={message.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[min(78%,680px)] border px-4 py-3 shadow-sm',
                              isMine
                                ? 'border-[#1398B7] bg-[#E8F6FA] text-[#0A3640]'
                                : 'border-[#D8E6EB] bg-[#F2F7F9] text-[#15323b]',
                            )}
                          >
                            <div className="mb-1 flex items-center justify-between gap-4">
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
                                {isMine ? 'Você' : getDisplayName(message.sender_name, message.sender_email)}
                              </p>
                              <p className="text-[11px] font-bold opacity-60">{formatConversationDate(message.created_at)}</p>
                            </div>
                            <p className="whitespace-pre-wrap text-sm font-semibold leading-7">{message.content}</p>
                            {!isMine ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReportTarget(message)
                                  setReportDescription('')
                                  setReportReason('inappropriate')
                                }}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#6d7f84] hover:text-red-700"
                              >
                                <Flag className="h-3 w-3" />
                                Denunciar
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={(event) => void handleSendMessage(event)} className="border-t border-[#D8E6EB] bg-[#F2F7F9] p-4">
                <div className="flex gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={5000}
                    rows={2}
                    className="min-h-12 flex-1 resize-none border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
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
                    disabled={isSending || !draft.trim()}
                    className="h-auto rounded-none bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] px-5 font-black text-white hover:opacity-95"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-right text-[11px] font-semibold text-[#8BA0A7]">{draft.length}/5000</p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-white p-8 text-center">
              <div>
                <Inbox className="mx-auto h-12 w-12 text-[#1398B7]" />
                <h2 className="mt-4 font-readex text-2xl font-semibold text-[#15323b]">Selecione uma conversa</h2>
                <p className="mt-2 max-w-md text-sm font-medium leading-7 text-[#6d7f84]">
                  Escolha uma conversa existente ou busque um usuário para iniciar um novo contato.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      ) : null}

      {reportTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ backgroundColor: 'rgba(10, 54, 64, 0.5)' }}
        >
          <form
            onSubmit={(event) => void handleReportMessage(event)}
            className="w-full max-w-lg border border-[#D8E6EB] bg-white p-5 shadow-[0_28px_80px_rgba(10,54,64,0.18)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Moderação</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Denunciar mensagem</h2>
                <p className="mt-1 text-sm font-medium text-[#6d7f84]">
                  Sua denúncia será enviada para análise da equipe GenFlix.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="flex h-9 w-9 items-center justify-center border border-[#D8E6EB] text-[#6d7f84] hover:text-[#15323b]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 border border-[#D8E6EB] bg-[#F8FBFC] p-3 text-sm font-semibold leading-6 text-[#15323b]">
              {reportTarget.content}
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8BA0A7]">Motivo</span>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value as MessageReportReason)}
                className="mt-2 h-11 w-full border border-[#D8E6EB] bg-white px-3 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"
              >
                {Object.entries(reportReasonLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8BA0A7]">
                Descrição opcional
              </span>
              <textarea
                value={reportDescription}
                onChange={(event) => setReportDescription(event.target.value)}
                rows={4}
                maxLength={500}
                className="mt-2 w-full resize-none border border-[#D8E6EB] bg-white px-3 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none placeholder:text-[#8BA0A7] focus:border-[#1398B7]"
                placeholder="Conte rapidamente o que aconteceu."
              />
            </label>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportTarget(null)}
                className="rounded-none border-[#D8E6EB] bg-white font-black !text-[#0A3640] hover:!text-[#0A3640]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isReporting}
                className="rounded-none bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] font-black text-white"
              >
                <Flag className="mr-2 h-4 w-4" />
                {isReporting ? 'Enviando...' : 'Enviar denúncia'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
