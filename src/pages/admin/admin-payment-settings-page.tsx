import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchCommerceDashboardSummaries,
  fetchPaymentGatewaySettings,
  updatePaymentGatewaySettings,
  type CommerceCheckoutSessionSummary,
  type CommerceEventSummary,
  type PaymentGatewayEnvironment,
} from '@/features/admin/commerce/api'

function buildWebhookUrl() {
  if (typeof window === 'undefined') {
    return '/api/webhooks/asaas'
  }

  return `${window.location.origin}/api/webhooks/asaas`
}

function formatEnvironmentLabel(environment: PaymentGatewayEnvironment) {
  return environment === 'production' ? 'Produção' : 'Sandbox'
}

export function AdminPaymentSettingsPage() {
  const { user } = useAuth()
  const [environment, setEnvironment] = useState<PaymentGatewayEnvironment>('sandbox')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentSessions, setRecentSessions] = useState<CommerceCheckoutSessionSummary[]>([])
  const [recentEvents, setRecentEvents] = useState<CommerceEventSummary[]>([])

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setError(null)
      try {
        const [settings, summaries] = await Promise.all([
          fetchPaymentGatewaySettings(),
          fetchCommerceDashboardSummaries(),
        ])
        if (isMounted) {
          setEnvironment(settings.environment)
          setRecentSessions(summaries.sessions)
          setRecentEvents(summaries.events)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as configurações.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()
    return () => {
      isMounted = false
    }
  }, [])

  const webhookUrl = useMemo(() => buildWebhookUrl(), [])

  async function handleSave(nextEnvironment: PaymentGatewayEnvironment) {
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updatePaymentGatewaySettings(nextEnvironment, user.id)
      setEnvironment(nextEnvironment)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as configurações.')
    } finally {
      setIsSaving(false)
    }
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 2000)
  }

  return (
    <div className="animate-in space-y-7 fade-in duration-500">
      <header className="space-y-3 border-b border-[#D8E6EB] pb-6">
        <div className="inline-flex border border-[#D8E6EB] bg-[#E8F6FA] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
          Pagamento Asaas
        </div>
        <h2 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Configurações de pagamento</h2>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
          Use esta tela para conferir o que precisa ser configurado no gateway, copiar a URL do webhook e alternar
          entre produção e sandbox.
        </p>
      </header>

      {error ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Checklist</p>
            <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
              O que precisa estar configurado
            </h3>
            <div className="mt-5 space-y-2 text-sm leading-7 text-[#5F7077]">
              <p>1. Defina a chave de API do Asaas para produção e sandbox nas variáveis de ambiente do deploy.</p>
              <p>2. Aponte o webhook do Asaas para a URL exibida nesta tela.</p>
              <p>3. Escolha o ambiente ativo abaixo e salve a configuração.</p>
              <p>4. Quando o pagamento for confirmado, o acesso ao curso será liberado automaticamente.</p>
            </div>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Ambiente</p>
            <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
              Trocar entre sandbox e produção
            </h3>
            <div className="mt-5 flex flex-wrap gap-3">
              {(['sandbox', 'production'] as const).map((option) => {
                const isActive = environment === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void handleSave(option)}
                    disabled={isSaving || isLoading}
                    className={`border px-5 py-3 text-sm font-black transition-all ${
                      isActive
                        ? 'border-[#1398B7] bg-gradient-to-b from-[#1398B7] to-[#0A3640] text-white shadow-[0_10px_24px_rgba(10,54,64,0.16)]'
                        : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:border-[#1398B7]/50'
                    }`}
                  >
                    {formatEnvironmentLabel(option)}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 text-sm text-[#5F7077]">
              Ambiente atual: <span className="font-black text-[#15323b]">{formatEnvironmentLabel(environment)}</span>
            </p>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Últimos checkouts</p>
            <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">Sessões recentes</h3>
            <div className="mt-5 space-y-3">
              {recentSessions.length === 0 ? (
                <p className="text-sm font-medium text-[#5F7077]">Nenhum checkout registrado ainda.</p>
              ) : (
                recentSessions.map((session) => (
                  <div key={session.id} className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                    <p className="text-sm font-black text-[#15323b]">{session.courses?.title ?? 'Curso'}</p>
                    <p className="mt-1 text-xs font-semibold text-[#5F7077]">{session.buyer_email}</p>
                    <span className="mt-2 inline-flex bg-[#E8F6FA] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#1398B7]">
                      {session.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="space-y-5">
          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Webhook</p>
            <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
              URL para cadastrar no Asaas
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#5F7077]">
              Cadastre esta URL na área de webhooks do Asaas, selecionando os eventos de checkout. Ela recebe a
              confirmação de pagamento e libera o curso automaticamente.
            </p>

            <div className="mt-5 border border-[#D8E6EB] bg-[#F2F7F9] p-4">
              <p className="break-all text-sm font-semibold text-[#15323b]">{webhookUrl}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void copyWebhook()}
                className="bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95"
              >
                {copySuccess ? 'Copiado' : 'Copiar URL'}
              </Button>
              <Button asChild variant="outline" className="border-[#D8E6EB] font-black text-[#15323b]">
                <a href="https://docs.asaas.com/docs/checkout-asaas" target="_blank" rel="noreferrer">
                  Abrir docs
                </a>
              </Button>
            </div>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Variáveis</p>
            <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
              Chaves necessárias no deploy
            </h3>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-[#5F7077]">
              <li><span className="font-black text-[#15323b]">ASAAS_ACCESS_TOKEN_SANDBOX</span> para testes.</li>
              <li><span className="font-black text-[#15323b]">ASAAS_ACCESS_TOKEN_PRODUCTION</span> para produção.</li>
              <li><span className="font-black text-[#15323b]">ASAAS_WEBHOOK_SECRET</span> se você quiser validar a assinatura do webhook.</li>
            </ul>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Eventos recentes</p>
            <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">Webhook Asaas</h3>
            <div className="mt-5 space-y-3">
              {recentEvents.length === 0 ? (
                <p className="text-sm font-medium text-[#5F7077]">Nenhum evento recebido ainda.</p>
              ) : (
                recentEvents.map((event) => (
                  <div key={event.id} className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                    <p className="text-sm font-black text-[#15323b]">{event.event_type}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex bg-[#E8F6FA] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#1398B7]">
                        {event.status}
                      </span>
                      <span className="text-xs font-semibold text-[#5F7077]">
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(event.received_at))}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
