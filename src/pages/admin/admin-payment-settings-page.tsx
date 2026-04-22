import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchCommerceDashboardSummaries,
  fetchPaymentGatewayDiagnostics,
  fetchPaymentGatewaySettings,
  updatePaymentGatewaySettings,
  type CommerceCheckoutSessionSummary,
  type CommerceDashboardMetrics,
  type CommerceEventSummary,
  type PaymentDiagnosticCheck,
  type PaymentGatewayDiagnostics,
  type PaymentGatewayEnvironment,
} from '@/features/admin/commerce/api'

function buildWebhookUrl() {
  if (typeof window === 'undefined') {
    return '/api/webhooks/asaas'
  }

  return `${window.location.origin}/api/webhooks/asaas`
}

function formatEnvironmentLabel(environment: PaymentGatewayEnvironment | null) {
  if (!environment) {
    return 'Nao identificado'
  }

  return environment === 'production' ? 'Producao' : 'Sandbox'
}

function formatMoney(valueInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Sem eventos'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatStatusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Ativo',
    paid: 'Pago',
    canceled: 'Cancelado',
    expired: 'Expirado',
    failed: 'Falhou',
    refunded: 'Estornado',
    chargeback: 'Chargeback',
    received: 'Recebido',
    processed: 'Processado',
    ignored: 'Ignorado',
  }

  return labels[status] ?? status
}

function statusTone(status: string) {
  if (status === 'paid' || status === 'processed') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  if (status === 'active' || status === 'received') {
    return 'bg-sky-50 text-sky-700 border-sky-200'
  }

  if (status === 'failed' || status === 'chargeback' || status === 'refunded') {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return 'bg-[#E8F6FA] text-[#0A3640] border-[#D8E6EB]'
}

function diagnosticTone(status: PaymentDiagnosticCheck['status']) {
  if (status === 'ok') {
    return {
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (status === 'warning') {
    return {
      icon: AlertTriangle,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    icon: XCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  }
}

const emptyMetrics: CommerceDashboardMetrics = {
  totalSessions: 0,
  activeSessions: 0,
  paidSessions: 0,
  refundedSessions: 0,
  failedEvents: 0,
  estimatedGrossRevenueCents: 0,
  lastEventAt: null,
}

export function AdminPaymentSettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history')
  const [environment, setEnvironment] = useState<PaymentGatewayEnvironment>('sandbox')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<CommerceDashboardMetrics>(emptyMetrics)
  const [diagnostics, setDiagnostics] = useState<PaymentGatewayDiagnostics | null>(null)
  const [recentSessions, setRecentSessions] = useState<CommerceCheckoutSessionSummary[]>([])
  const [recentEvents, setRecentEvents] = useState<CommerceEventSummary[]>([])

  const webhookUrl = useMemo(() => buildWebhookUrl(), [])

  const runDiagnostics = useCallback(async () => {
    setIsDiagnosing(true)
    setDiagnosticError(null)
    try {
      const result = await fetchPaymentGatewayDiagnostics()
      setDiagnostics(result)
    } catch (diagnosticsError) {
      setDiagnosticError(
        diagnosticsError instanceof Error
          ? diagnosticsError.message
          : 'Nao foi possivel diagnosticar as configuracoes de pagamento.',
      )
    } finally {
      setIsDiagnosing(false)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [settings, summaries] = await Promise.all([
        fetchPaymentGatewaySettings(),
        fetchCommerceDashboardSummaries(),
      ])
      setEnvironment(settings.environment)
      setRecentSessions(summaries.sessions)
      setRecentEvents(summaries.events)
      setMetrics(summaries.metrics)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar as configuracoes.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
    void runDiagnostics()
  }, [loadSettings, runDiagnostics])

  async function handleSave(nextEnvironment: PaymentGatewayEnvironment) {
    if (!user) {
      setError('Usuario nao autenticado.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updatePaymentGatewaySettings(nextEnvironment, user.id)
      setEnvironment(nextEnvironment)
      await runDiagnostics()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar as configuracoes.')
    } finally {
      setIsSaving(false)
    }
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 2000)
  }

  const metricCards = [
    { label: 'Checkouts', value: metrics.totalSessions.toString(), detail: 'ultimos registros operacionais' },
    { label: 'Pagos', value: metrics.paidSessions.toString(), detail: `${metrics.activeSessions} ativo(s)` },
    { label: 'Receita bruta', value: formatMoney(metrics.estimatedGrossRevenueCents), detail: 'estimativa por cursos pagos' },
    { label: 'Estornos', value: metrics.refundedSessions.toString(), detail: 'refunds e chargebacks' },
    { label: 'Eventos com falha', value: metrics.failedEvents.toString(), detail: 'nos eventos recentes' },
    { label: 'Ultimo evento', value: formatDateTime(metrics.lastEventAt), detail: 'webhook recebido' },
  ]

  const tabs = [
    {
      key: 'history' as const,
      label: 'Historico',
      description: 'Pagamentos realizados, eventos e faturas do Asaas.',
    },
    {
      key: 'settings' as const,
      label: 'Configuracoes',
      description: 'Ambiente, webhook, diagnostico e variaveis do gateway.',
    },
  ]

  return (
    <div className="animate-in space-y-7 fade-in duration-500">
      <header className="space-y-3 border-b border-[#D8E6EB] pb-6">
        <div className="inline-flex border border-[#D8E6EB] bg-[#E8F6FA] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
          Pagamento Asaas
        </div>
        <h2 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Pagamentos e configuracoes</h2>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
          Use a aba principal para acompanhar o historico de pagamentos e abrir faturas no Asaas. Na aba de
          configuracoes voce ajusta o ambiente, o webhook e a operacao do gateway.
        </p>
      </header>

      {error ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-3 border-b border-[#D8E6EB] pb-5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-w-[220px] border px-5 py-4 text-left transition-all ${
                isActive
                  ? 'border-[#1398B7] bg-gradient-to-b from-[#1398B7] to-[#0A3640] text-white shadow-[0_12px_30px_rgba(10,54,64,0.18)]'
                  : 'border-[#D8E6EB] bg-white text-[#15323b] hover:border-[#1398B7]/45 hover:bg-[#F7FBFC]'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-80">{tab.label}</p>
              <p className={`mt-2 text-sm font-semibold leading-6 ${isActive ? 'text-white/90' : 'text-[#5F7077]'}`}>
                {tab.description}
              </p>
            </button>
          )
        })}
      </section>

      {activeTab === 'history' ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricCards.map((card) => (
              <article key={card.label} className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{card.label}</p>
                <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">{card.value}</p>
                <p className="mt-2 text-xs font-semibold text-[#5F7077]">{card.detail}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Pagamentos realizados</p>
                  <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
                    Historico vinculado ao Asaas
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5F7077]">
                    Consulte os checkouts mais recentes e abra diretamente a fatura gerada pelo Asaas sempre que houver
                    um link externo disponivel.
                  </p>
                </div>
                <span className="inline-flex border border-[#D8E6EB] bg-[#E8F6FA] px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
                  {recentSessions.length} registro(s)
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {recentSessions.length === 0 ? (
                  <p className="text-sm font-medium text-[#5F7077]">Nenhum checkout registrado ainda.</p>
                ) : (
                  recentSessions.map((session) => (
                    <div key={session.id} className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[#15323b]">{session.courses?.title ?? 'Curso'}</p>
                          <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                            {session.buyer_name ? `${session.buyer_name} · ` : ''}
                            {session.buyer_email}
                          </p>
                        </div>
                        <span className={`inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(session.status)}`}>
                          {formatStatusLabel(session.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-[#5F7077]">
                          {formatEnvironmentLabel(session.gateway_environment ?? null)} · {formatDateTime(session.created_at)}
                        </p>
                        {session.checkout_url ? (
                          <Button asChild variant="outline" className="h-9 border-[#D8E6EB] font-black text-[#15323b]">
                            <a href={session.checkout_url} target="_blank" rel="noreferrer">
                              Ver fatura no Asaas
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-[#8A9CA4]">Sem fatura externa disponivel</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Eventos recentes</p>
              <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">Webhook Asaas</h3>
              <p className="mt-2 text-sm leading-7 text-[#5F7077]">
                Esta coluna mostra os ultimos eventos processados para facilitar conciliacao e diagnostico da operacao.
              </p>
              <div className="mt-5 space-y-3">
                {recentEvents.length === 0 ? (
                  <p className="text-sm font-medium text-[#5F7077]">Nenhum evento recebido ainda.</p>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                      <p className="text-sm font-black text-[#15323b]">{event.event_type}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(event.status)}`}>
                          {formatStatusLabel(event.status)}
                        </span>
                        <span className="text-xs font-semibold text-[#5F7077]">
                          {formatEnvironmentLabel(event.gateway_environment ?? null)} · {formatDateTime(event.received_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-5">
            <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Diagnostico</p>
                  <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
                    Configuracao operacional
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5F7077]">
                    Esta checagem valida o registro do gateway, o ambiente ativo e se as variaveis sensiveis existem no
                    deploy, sem revelar nenhum segredo.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void runDiagnostics()}
                  disabled={isDiagnosing}
                  variant="outline"
                  className="border-[#D8E6EB] font-black text-[#15323b]"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  Verificar
                </Button>
              </div>

              {diagnosticError ? (
                <div className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {diagnosticError}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(diagnostics?.checks ?? []).map((check) => {
                  const tone = diagnosticTone(check.status)
                  const Icon = tone.icon
                  return (
                    <div key={check.key} className={`border px-4 py-4 ${tone.className}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <p className="text-sm font-black">{check.label}</p>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 opacity-85">{check.detail}</p>
                    </div>
                  )
                })}
              </div>

              <p className="mt-4 text-xs font-semibold text-[#5F7077]">
                Ultima verificacao: {formatDateTime(diagnostics?.checkedAt)}
              </p>
            </article>

            <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Checklist</p>
              <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
                O que precisa estar configurado
              </h3>
              <div className="mt-5 space-y-2 text-sm leading-7 text-[#5F7077]">
                <p>1. Configure a chave de API do Asaas para producao e sandbox nas variaveis de ambiente do deploy.</p>
                <p>2. Aponte o webhook do Asaas para a URL exibida nesta tela.</p>
                <p>3. Se usar segredo no webhook, cadastre o mesmo valor no Asaas e em `ASAAS_WEBHOOK_SECRET`.</p>
                <p>4. Escolha o ambiente ativo abaixo e salve a configuracao.</p>
                <p>5. Quando o pagamento for confirmado, o acesso ao curso sera liberado automaticamente.</p>
              </div>
            </article>

            <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Ambiente</p>
              <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
                Trocar entre sandbox e producao
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
          </div>

          <div className="space-y-5">
            <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Webhook</p>
              <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
                URL para cadastrar no Asaas
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#5F7077]">
                Cadastre esta URL na area de webhooks do Asaas. Ela recebe confirmacoes, cancelamentos, expiracoes,
                estornos e chargebacks para atualizar o acesso do aluno e a comissao do criador.
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
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Variaveis</p>
              <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">
                Chaves necessarias no deploy
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-[#5F7077]">
                <li><span className="font-black text-[#15323b]">ASAAS_ACCESS_TOKEN_SANDBOX</span> para testes.</li>
                <li><span className="font-black text-[#15323b]">ASAAS_ACCESS_TOKEN_PRODUCTION</span> para producao.</li>
                <li><span className="font-black text-[#15323b]">ASAAS_ACCESS_TOKEN</span> como fallback opcional.</li>
                <li><span className="font-black text-[#15323b]">ASAAS_WEBHOOK_SECRET</span> para validar o webhook.</li>
              </ul>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  )
}
