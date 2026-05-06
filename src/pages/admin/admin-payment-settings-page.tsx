import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchAdminPaymentInvoiceUrl,
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
import { normalizePaymentStatus, paymentStatusClassName } from '@/lib/payment-status'

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
  const [activeTab, setActiveTab] = useState<'history' | 'events' | 'settings'>('history')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'refunded'>('all')
  const [environment, setEnvironment] = useState<PaymentGatewayEnvironment>('sandbox')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null)
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

  async function openInvoice(session: CommerceCheckoutSessionSummary) {
    setOpeningInvoiceId(session.id)
    try {
      const resolvedUrl = await fetchAdminPaymentInvoiceUrl(session.id)
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
    } catch (openError) {
      if (session.checkout_url) {
        window.open(session.checkout_url, '_blank', 'noopener,noreferrer')
        return
      }
      setError(openError instanceof Error ? openError.message : 'Nao foi possivel abrir a fatura do pedido.')
    } finally {
      setOpeningInvoiceId(null)
    }
  }

  const metricCards = [
    { label: 'Total de pedidos', value: metrics.totalSessions.toString(), detail: 'checkouts registrados' },
    { label: 'Pagos', value: metrics.paidSessions.toString(), detail: `${metrics.activeSessions} ativo(s)` },
    {
      label: 'Pendentes e reembolsados',
      value: (metrics.activeSessions + metrics.refundedSessions).toString(),
      detail: 'em acompanhamento',
    },
  ]

  const tabs = [
    {
      key: 'history' as const,
      label: 'Historico',
      description: 'Compras processadas, status e faturas.',
    },
    {
      key: 'events' as const,
      label: 'Eventos',
      description: 'Eventos de webhook e conciliacao operacional.',
    },
    {
      key: 'settings' as const,
      label: 'Configuracoes',
      description: 'Ambiente, webhook, diagnostico e chaves.',
    },
  ]

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredSessions = useMemo(() => {
    return recentSessions.filter((session) => {
      const normalized = normalizePaymentStatus(session.status)
      const normalizedLabel = normalized.label.toLowerCase()

      if (statusFilter === 'pending' && normalizedLabel !== 'pendente') {
        return false
      }

      if (statusFilter === 'paid' && normalizedLabel !== 'pago') {
        return false
      }

      if (statusFilter === 'refunded' && normalizedLabel !== 'reembolsado') {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const text = [
        session.buyer_name ?? '',
        session.buyer_email ?? '',
        session.id ?? '',
        session.status ?? '',
        session.courses?.title ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return text.includes(normalizedSearch)
    })
  }, [normalizedSearch, recentSessions, statusFilter])

  return (
    <div className="animate-in space-y-6 fade-in duration-500">
      <header className="space-y-2">
        <h2 className="font-readex text-4xl font-bold tracking-tight text-[#021B41]">Controle de Pagamentos</h2>
        <p className="max-w-3xl text-lg text-[#1C304A]">
          Acompanhe compras registradas e ajuste o ambiente operacional do checkout.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="space-y-6 rounded-[28px] border border-[#C6D9E6] bg-[#F8FCFF] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#274E79]">Admin / Pagamentos</p>
            <h3 className="font-readex text-4xl font-bold tracking-tight text-[#021B41]">Historico de pagamentos</h3>
            <p className="max-w-3xl text-lg text-[#1C304A]">
              Consulta os pedidos processados, acompanha os estados e alterna o ambiente do checkout sem sair da
              pagina.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              void loadSettings()
              void runDiagnostics()
            }}
            disabled={isLoading || isDiagnosing}
            variant="outline"
            className="h-12 rounded-full border-[#B7CFDF] bg-[#E9F4FB] px-6 text-base font-semibold text-[#0A2A49]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading || isDiagnosing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-[#C6D9E6] pb-5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full border px-6 py-2.5 text-lg font-semibold transition-all ${
                  isActive
                    ? 'border-[#031437] bg-[#031437] text-white'
                    : 'border-[#B7CFDF] bg-white text-[#1A3354] hover:border-[#7EA8C6]'
                }`}
                title={tab.description}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'history' ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              {metricCards.map((card) => (
                <article key={card.label} className="rounded-3xl border border-[#B7CFDF] bg-white p-6">
                  <p className="text-2xl text-[#1A3354]">{card.label}</p>
                  <p className="mt-2 text-5xl font-bold tracking-tight text-[#031437]">{card.value}</p>
                  <p className="mt-1 text-sm font-medium text-[#5F7077]">{card.detail}</p>
                </article>
              ))}
            </section>

            <section className="space-y-4 rounded-3xl border border-[#B7CFDF] bg-[#F4FAFF] p-5">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#274E79]">Buscar</p>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por cliente, item, referencia ou status..."
                  className="h-12 flex-1 rounded-2xl border border-[#C6D9E6] bg-white px-4 text-base text-[#1A3354] placeholder:text-[#70879D] focus:border-[#7EA8C6] focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all' as const, label: 'Todos' },
                    { key: 'pending' as const, label: 'Pendentes' },
                    { key: 'paid' as const, label: 'Pagos' },
                    { key: 'refunded' as const, label: 'Reembolsados' },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setStatusFilter(filter.key)}
                      className={`h-12 rounded-full border px-5 text-lg font-semibold transition-colors ${
                        statusFilter === filter.key
                          ? 'border-[#031437] bg-[#031437] text-white'
                          : 'border-[#B7CFDF] bg-white text-[#1A3354]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="overflow-x-auto rounded-3xl border border-[#B7CFDF] bg-white">
              <table className="min-w-full divide-y divide-[#D7E5EF]">
                <thead className="bg-[#F4FAFF]">
                  <tr className="text-left text-xs font-black uppercase tracking-[0.24em] text-[#274E79]">
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Comprado</th>
                    <th className="px-5 py-4">Data/Hora</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Valor</th>
                    <th className="px-5 py-4">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1ECF3]">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm font-semibold text-[#5F7077]">
                        Nenhum pagamento encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => (
                      <tr key={session.id} className="align-top">
                        <td className="px-5 py-4">
                          <p className="text-lg font-bold text-[#031437]">{session.buyer_name ?? 'Checkout'}</p>
                          <p className="text-sm text-[#4A607A]">{session.buyer_email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-base font-bold text-[#031437]">{session.courses?.title ?? 'Curso'}</p>
                          <p className="text-sm text-[#4A607A]">Pedido {session.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-5 py-4 text-base text-[#1A3354]">{formatDateTime(session.created_at)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${paymentStatusClassName(normalizePaymentStatus(session.status).tone)}`}
                          >
                            {normalizePaymentStatus(session.status).label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-base font-bold text-[#031437]">
                          {session.courses?.price_cents != null ? formatMoney(session.courses.price_cents) : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void openInvoice(session)}
                            disabled={openingInvoiceId === session.id}
                            className="h-10 rounded-full border-[#B7CFDF] px-4 font-semibold text-[#0A2A49] disabled:opacity-60"
                          >
                            {openingInvoiceId === session.id ? 'Abrindo...' : 'Abrir pedido'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        {activeTab === 'events' ? (
          <section className="space-y-4">
            <article className="rounded-3xl border border-[#B7CFDF] bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#274E79]">Eventos recentes</p>
              <h3 className="mt-2 font-readex text-2xl font-bold tracking-tight text-[#021B41]">Webhook Asaas</h3>
              <p className="mt-2 text-sm leading-7 text-[#5F7077]">
                Esta lista mostra os ultimos eventos processados para facilitar conciliacao e diagnostico da operacao.
              </p>
              <div className="mt-4 space-y-3">
                {recentEvents.length === 0 ? (
                  <p className="text-sm font-medium text-[#5F7077]">Nenhum evento recebido ainda.</p>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-[#D8E6EB] bg-[#F4FAFF] px-4 py-3">
                      <p className="text-base font-bold text-[#021B41]">{event.event_type}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${paymentStatusClassName(normalizePaymentStatus(event.status).tone)}`}
                        >
                          {normalizePaymentStatus(event.status).label}
                        </span>
                        <span className="text-sm text-[#5F7077]">
                          {formatEnvironmentLabel(event.gateway_environment ?? null)} - {formatDateTime(event.received_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === 'settings' ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-5">
              <article className="rounded-3xl border border-[#D8E6EB] bg-white p-6 shadow-sm">
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
                    className="rounded-full border-[#D8E6EB] font-black text-[#15323b]"
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

              <article className="rounded-3xl border border-[#D8E6EB] bg-white p-6 shadow-sm">
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

              <article className="rounded-3xl border border-[#D8E6EB] bg-white p-6 shadow-sm">
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
                        className={`rounded-full border px-5 py-3 text-sm font-black transition-all ${
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
              <article className="rounded-3xl border border-[#D8E6EB] bg-white p-6 shadow-sm">
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
                    className="rounded-full bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95"
                  >
                    {copySuccess ? 'Copiado' : 'Copiar URL'}
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-[#D8E6EB] font-black text-[#15323b]">
                    <a href="https://docs.asaas.com/docs/checkout-asaas" target="_blank" rel="noreferrer">
                      Abrir docs
                    </a>
                  </Button>
                </div>
              </article>

              <article className="rounded-3xl border border-[#D8E6EB] bg-white p-6 shadow-sm">
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
      </section>
    </div>
  )
}
