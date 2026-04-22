import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { HelpCircle, LifeBuoy, Lock, Paperclip, Search, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { createSupportTicket, fetchSupportSettings } from '@/features/support/api'
import { getSupportListRoute, getSupportPriorityOptions, getSupportTicketRoute } from '@/lib/support-sla'
import type {
  SupportBusinessHoursConfig,
  SupportCrisisProtocolConfig,
  SupportModalStep,
  SupportSlaConfig,
  SupportTicketCategory,
  SupportTicketPriority,
} from '@/features/support/types'

const emptySettings: {
  sla: SupportSlaConfig
  businessHours: SupportBusinessHoursConfig
  crisisProtocol: SupportCrisisProtocolConfig
} = {
  sla: {
    categories: [],
    public_note: '',
  },
  businessHours: {
    timezone: 'America/Sao_Paulo',
    days_of_week: [1, 2, 3, 4, 5],
    start_hour: 8,
    end_hour: 18,
  },
  crisisProtocol: {
    title: '',
    description: '',
    note: '',
  },
}

function getPriorityLabel(priority: SupportTicketPriority) {
  switch (priority) {
    case 'low':
      return 'Baixa'
    case 'medium':
      return 'Media'
    case 'high':
      return 'Alta'
    case 'urgent':
      return 'Urgente'
    default:
      return priority
  }
}

export function SupportTicketModal({
  initialStep = 'choice',
  onClose,
  onCreated,
}: {
  initialStep?: SupportModalStep
  onClose: () => void
  onCreated?: (ticketId: string) => void
}) {
  const { user, roles } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<SupportModalStep>(initialStep)
  const [settings, setSettings] = useState(emptySettings)
  const [category, setCategory] = useState<SupportTicketCategory>('general')
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState<SupportTicketPriority>('medium')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isAdmin = roles.includes('admin')
  const priorityOptions = useMemo(() => getSupportPriorityOptions(isAdmin), [isAdmin])
  const selectedCategory = useMemo(
    () => settings.sla.categories.find((item) => item.key === category) ?? settings.sla.categories[0],
    [category, settings.sla.categories],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    setStep(initialStep)
  }, [initialStep])

  useEffect(() => {
    let isMounted = true

    setIsLoadingSettings(true)
    void fetchSupportSettings()
      .then((nextSettings) => {
        if (!isMounted) {
          return
        }

        setSettings(nextSettings)
        setCategory(nextSettings.sla.categories[0]?.key ?? 'general')
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar as configuracoes de suporte.')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSettings(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!priorityOptions.includes(priority)) {
      setPriority(priorityOptions[priorityOptions.length - 1] ?? 'medium')
    }
  }, [priority, priorityOptions])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user?.id) {
      navigate('/login')
      return
    }

    if (!subject.trim() || !description.trim()) {
      setErrorMessage('Preencha assunto e descricao para abrir o chamado.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const ticket = await createSupportTicket({
        category,
        subject,
        description,
        priority,
        attachment,
      })

      onCreated?.(ticket.id)
      onClose()
      navigate(getSupportTicketRoute(ticket.id, isAdmin))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel abrir o chamado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#061b21]/58 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[#F2F8FA] px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Suporte</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
              {step === 'choice' ? 'Como podemos ajudar?' : 'Novo chamado'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5F7077]">
              {step === 'choice'
                ? 'Veja primeiro as perguntas frequentes ou siga direto para abrir um chamado.'
                : 'Descreva o contexto para a equipe receber o seu chamado com clareza.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] text-[#5F7077] transition-colors hover:bg-white"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'choice' ? (
          <div className="overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-readex text-xl font-semibold text-[#15323b]">Ver perguntas frequentes</h3>
                <p className="mt-2 text-sm leading-6 text-[#5F7077]">
                  Consulte nossa base publica com respostas rapidas sobre acesso, pagamentos e uso da plataforma.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="mt-4 h-11 w-full rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
                >
                  <Link to="/suporte">
                    <Search className="mr-2 h-4 w-4" />
                    Ir para FAQ publica
                  </Link>
                </Button>
              </div>

              <div className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#1398B7] to-[#0A3640] text-white">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-readex text-xl font-semibold text-[#15323b]">Abrir um chamado</h3>
                <p className="mt-2 text-sm leading-6 text-[#5F7077]">
                  Quando a FAQ nao resolver, envie um chamado com contexto, passos e o que voce precisa no momento.
                </p>
                <Button
                  type="button"
                  onClick={() => setStep('form')}
                  className="mt-4 h-11 w-full rounded-2xl bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95"
                >
                  Abrir um chamado
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-11 w-full rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="overflow-y-auto px-6 py-6">
            <div className="rounded-[24px] border border-[#BEE3EA] bg-[#F2F8FA] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">SLA de primeira resposta</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#15323b]">
                {selectedCategory?.description ?? 'Nossa equipe responde conforme a categoria do chamado e o horario de atendimento.'}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#5F7077]">
                Atendimento: {String(settings.businessHours.start_hour).padStart(2, '0')}h às {String(settings.businessHours.end_hour).padStart(2, '0')}h ({settings.businessHours.timezone}).
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#5F7077]">
                A prioridade interna ajuda na triagem, mas nao altera a promessa publica de SLA.
              </p>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {isLoadingSettings ? (
              <p className="mt-4 text-sm font-semibold text-[#5F7077]">Carregando formulario...</p>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Categoria</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}
                    className="h-12 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                  >
                    {settings.sla.categories.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Assunto</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Ex: problema com pagamento ou acesso"
                    className="h-12 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Prioridade interna</span>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}
                    className="h-12 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                  >
                    {priorityOptions.map((item) => (
                      <option key={item} value={item}>{getPriorityLabel(item)}</option>
                    ))}
                  </select>
                  {!isAdmin && !priorityOptions.includes('urgent') ? (
                    <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#5F7077]">
                      <Lock className="h-3.5 w-3.5 text-[#8BA0A7]" />
                      A prioridade serve apenas para triagem interna e segue as regras do perfil autenticado.
                    </p>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Descricao</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={5}
                    placeholder="Explique o contexto, os passos ja tentados e o que voce precisa resolver."
                    className="resize-none rounded-[16px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none"
                  />
                </label>

                <div className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Anexo (opcional)</span>
                  <label className="flex min-h-[56px] cursor-pointer items-center justify-between rounded-[18px] border border-dashed border-[#BFD7DE] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] transition-colors hover:bg-[#F8FBFC]">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 text-[#1398B7]" />
                      <span className="truncate">{attachment?.name ?? 'Selecionar arquivo'}</span>
                    </span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {attachment ? (
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="justify-self-start text-xs font-black uppercase tracking-[0.14em] text-[#1398B7]"
                    >
                      Remover anexo
                    </button>
                  ) : null}
                </div>

                {!user?.id ? (
                  <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Entre na sua conta para enviar o chamado e acompanhar o historico em tempo real.
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(initialStep === 'form' ? 'form' : 'choice')}
                className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
              >
                {initialStep === 'form' ? 'Fechar' : 'Voltar'}
              </Button>

              <div className="flex flex-col gap-3 sm:flex-row">
                {user?.id ? (
                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoadingSettings}
                    className="h-11 rounded-2xl bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 font-black text-white hover:opacity-95"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar chamado'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="h-11 rounded-2xl bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 font-black text-white hover:opacity-95"
                  >
                    Entrar para abrir chamado
                  </Button>
                )}

                {user?.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
                  >
                    <Link to={getSupportListRoute(isAdmin)}>Ver historico</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
