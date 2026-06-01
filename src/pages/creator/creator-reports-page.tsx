import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotificationPreferencesPage } from '@/pages/shared/notification-preferences-page'
import { NotificationsOverviewPanel } from '@/features/notifications/notifications-overview-panel'
import {
  fetchCreatorCommissions,
  fetchCreatorCourses,
  fetchCreatorPayoutSettings,
  fetchCreatorPayouts,
  fetchCreatorSalesReport,
  formatMoneyFromCents,
  type CreatorCommissionRow,
  type CreatorCourseSummary,
  type CreatorPayoutRow,
  type CreatorPayoutSettingsRow,
  type CreatorSalesReportRow,
} from '@/features/creator/reports/api'

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    published: 'Publicado',
    archived: 'Arquivado',
    pending: 'Pendente',
    eligible: 'Elegivel',
    scheduled: 'Agendada',
    processing: 'Processando',
    paid: 'Paga',
    canceled: 'Cancelada',
    refunded: 'Estornada',
    failed: 'Falhou',
  }

  return labels[status] ?? status
}

function statusTone(status: string) {
  if (status === 'published' || status === 'paid' || status === 'eligible') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (status === 'pending' || status === 'scheduled' || status === 'draft' || status === 'processing') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  if (status === 'canceled' || status === 'refunded' || status === 'failed' || status === 'archived') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  return 'border-[#D8E6EB] bg-[#E8F6FA] text-[#0A3640]'
}

function getPeriodKey(row: CreatorSalesReportRow) {
  return `${row.course_id}:${row.period_index}`
}

export function CreatorReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<CreatorSalesReportRow[]>([])
  const [courses, setCourses] = useState<CreatorCourseSummary[]>([])
  const [commissions, setCommissions] = useState<CreatorCommissionRow[]>([])
  const [payouts, setPayouts] = useState<CreatorPayoutRow[]>([])
  const [payoutSettings, setPayoutSettings] = useState<CreatorPayoutSettingsRow | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [reportRows, commissionRows, courseRows, payoutRows, settings] = await Promise.all([
        fetchCreatorSalesReport(),
        fetchCreatorCommissions(),
        fetchCreatorCourses(),
        fetchCreatorPayouts(),
        fetchCreatorPayoutSettings(),
      ])
      setRows(reportRows)
      setCommissions(commissionRows)
      setCourses(courseRows)
      setPayouts(payoutRows)
      setPayoutSettings(settings)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel carregar os relatorios.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const periodOptions = useMemo(() => {
    return rows
      .filter((row) => !selectedCourseId || row.course_id === selectedCourseId)
      .map((row) => ({
        key: getPeriodKey(row),
        label: `${row.course_title} - ${formatDate(row.period_starts_at)} a ${formatDate(row.period_ends_at)}`,
        startsAt: row.period_starts_at,
        endsAt: row.period_ends_at,
      }))
  }, [rows, selectedCourseId])

  const selectedPeriod = useMemo(() => {
    return rows.find((row) => getPeriodKey(row) === selectedPeriodKey) ?? null
  }, [rows, selectedPeriodKey])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesCourse = !selectedCourseId || row.course_id === selectedCourseId
      const matchesPeriod = !selectedPeriodKey || getPeriodKey(row) === selectedPeriodKey
      return matchesCourse && matchesPeriod
    })
  }, [rows, selectedCourseId, selectedPeriodKey])

  const filteredCommissions = useMemo(() => {
    return commissions.filter((commission) => {
      const matchesCourse = !selectedCourseId || commission.course_id === selectedCourseId
      if (!matchesCourse) {
        return false
      }

      if (!selectedPeriod) {
        return true
      }

      const paidAt = new Date(commission.sale_paid_at)
      const periodStart = new Date(`${selectedPeriod.period_starts_at}T00:00:00`)
      const periodEnd = new Date(`${selectedPeriod.period_ends_at}T23:59:59`)
      return paidAt >= periodStart && paidAt <= periodEnd
    })
  }, [commissions, selectedCourseId, selectedPeriod])

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        sales: acc.sales + Number(row.sales_count ?? 0),
        revenue: acc.revenue + Number(row.gross_revenue_cents ?? 0),
        cancellations: acc.cancellations + Number(row.cancellations_count ?? 0),
        canceledAmount: acc.canceledAmount + Number(row.cancellations_amount_cents ?? 0),
      }),
      {
        sales: 0,
        revenue: 0,
        cancellations: 0,
        canceledAmount: 0,
      },
    )
  }, [filteredRows])

  const commissionTotals = useMemo(() => {
    return filteredCommissions.reduce(
      (acc, commission) => {
        const amount = Number(commission.commission_amount_cents ?? 0)
        return {
          pending: acc.pending + (commission.status === 'pending' || commission.status === 'eligible' ? amount : 0),
          paid: acc.paid + (commission.status === 'paid' ? amount : 0),
          canceled: acc.canceled + (commission.status === 'canceled' || commission.status === 'refunded' ? amount : 0),
        }
      },
      { pending: 0, paid: 0, canceled: 0 },
    )
  }, [filteredCommissions])

  const courseSummaries = useMemo(() => {
    return courses.map((course) => {
      const courseRows = rows.filter((row) => row.course_id === course.id)
      return {
        course,
        sales: courseRows.reduce((total, row) => total + Number(row.sales_count ?? 0), 0),
        revenue: courseRows.reduce((total, row) => total + Number(row.gross_revenue_cents ?? 0), 0),
        cancellations: courseRows.reduce((total, row) => total + Number(row.cancellations_count ?? 0), 0),
      }
    })
  }, [courses, rows])

  const metricCards = [
    { label: 'Vendas', value: totals.sales.toString(), detail: 'no filtro atual' },
    { label: 'Receita bruta', value: formatMoneyFromCents(totals.revenue), detail: 'sem descontar taxas' },
    { label: 'Cancelamentos', value: totals.cancellations.toString(), detail: formatMoneyFromCents(totals.canceledAmount) },
    { label: 'Comissoes pendentes', value: formatMoneyFromCents(commissionTotals.pending), detail: 'pendentes ou elegiveis' },
    { label: 'Comissoes pagas', value: formatMoneyFromCents(commissionTotals.paid), detail: 'repasse confirmado' },
    { label: 'Estornadas', value: formatMoneyFromCents(commissionTotals.canceled), detail: 'canceladas ou refundadas' },
  ]

  const payoutTotals = useMemo(() => {
    return payouts.reduce(
      (acc, payout) => ({
        processing: acc.processing + (payout.status === 'processing' || payout.status === 'scheduled' ? Number(payout.amount_cents ?? 0) : 0),
        paid: acc.paid + (payout.status === 'paid' ? Number(payout.amount_cents ?? 0) : 0),
        failed: acc.failed + (payout.status === 'failed' ? Number(payout.amount_cents ?? 0) : 0),
      }),
      { processing: 0, paid: 0, failed: 0 },
    )
  }, [payouts])

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId)
    setSelectedPeriodKey('')
  }

  const requestedTab = searchParams.get('tab')
  const activeTab = requestedTab === 'notificacoes' || requestedTab === 'preferencias' ? requestedTab : 'relatorios'

  function renderTabButton(tab: 'relatorios' | 'notificacoes' | 'preferencias', label: string) {
    const isActive = activeTab === tab
    return (
      <button
        key={tab}
        type="button"
        onClick={() => setSearchParams((current) => {
          const next = new URLSearchParams(current)
          if (tab === 'relatorios') {
            next.delete('tab')
          } else {
            next.set('tab', tab)
          }
          return next
        }, { replace: true })}
        className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
          isActive
            ? 'border-[#1398B7] bg-[#1398B7] text-white'
            : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:border-[#1398B7] hover:text-[#15323b]'
        }`}
      >
        {label}
      </button>
    )
  }

  if (activeTab === 'notificacoes') {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Relatorios</p>
            <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Notificacoes</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
              Acompanhe comunicados enviados pela plataforma e avisos transacionais sem sair do painel do criador.
            </p>
            <div className="hidden">
              {renderTabButton('relatorios', 'Relatorios')}
              {renderTabButton('notificacoes', 'Notificacoes')}
              {renderTabButton('preferencias', 'Preferencias')}
            </div>
          </div>
        </header>

        <NotificationsOverviewPanel />
      </div>
    )
  }

  if (activeTab === 'preferencias') {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Relatorios</p>
            <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Preferencias</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
              Ajuste os canais e horarios de notificacao do criador diretamente nesta area.
            </p>
            <div className="hidden">
              {renderTabButton('relatorios', 'Relatorios')}
              {renderTabButton('notificacoes', 'Notificacoes')}
              {renderTabButton('preferencias', 'Preferencias')}
            </div>
          </div>
        </header>

        <NotificationPreferencesPage contextLabel="Criador" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Relatorios</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Painel do criador</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            Acompanhe os cursos vinculados a voce, vendas por ciclos de seis meses, cancelamentos e comissoes previstas
            para repasse PIX.
          </p>
          <div className="hidden">
            {renderTabButton('relatorios', 'Relatorios')}
            {renderTabButton('notificacoes', 'Notificacoes')}
            {renderTabButton('preferencias', 'Preferencias')}
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={isLoading}
          variant="outline"
          className="border-[#D8E6EB] font-black text-[#15323b]"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      {errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1398B7]">Politica de repasse</p>
          <h2 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">
            {payoutSettings?.mode === 'manual' ? 'Repasse manual pelo administrador' : 'Repasse automatico via Asaas'}
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#6d7f84]">
            {payoutSettings?.is_enabled === false
              ? 'Os repasses automaticos estao pausados pela administracao.'
              : `Ciclo a cada ${payoutSettings?.interval_days ?? 30} dia(s), com minimo de ${formatMoneyFromCents(payoutSettings?.minimum_amount_cents ?? 0)} por lote.`}
          </p>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F7077]">Proxima janela</p>
              <p className="mt-1 font-black text-[#15323b]">{formatDateTime(payoutSettings?.next_run_at)}</p>
            </div>
            <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F7077]">Ultima execucao</p>
              <p className="mt-1 font-black text-[#15323b]">{formatDateTime(payoutSettings?.last_run_at)}</p>
            </div>
          </div>
        </article>

        <article className="grid gap-3 md:grid-cols-3">
          <div className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Processando</p>
            <p className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">{formatMoneyFromCents(payoutTotals.processing)}</p>
          </div>
          <div className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Pago</p>
            <p className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">{formatMoneyFromCents(payoutTotals.paid)}</p>
          </div>
          <div className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Falhou</p>
            <p className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">{formatMoneyFromCents(payoutTotals.failed)}</p>
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block border border-[#D8E6EB] bg-[#F2F7F9] p-4">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Curso</span>
          <select
            value={selectedCourseId}
            onChange={(event) => handleCourseChange(event.target.value)}
            className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"
          >
            <option value="">Todos os cursos vinculados</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block border border-[#D8E6EB] bg-[#F2F7F9] p-4">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Periodo</span>
          <select
            value={selectedPeriodKey}
            onChange={(event) => setSelectedPeriodKey(event.target.value)}
            className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"
          >
            <option value="">Todos os ciclos de 6 meses</option>
            {periodOptions.map((period) => (
              <option key={period.key} value={period.key}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => (
          <div key={card.label} className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">{card.label}</p>
            <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{card.value}</p>
            <p className="mt-2 text-xs font-semibold text-[#6d7f84]">{card.detail}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden border border-[#D8E6EB] bg-white">
        <div className="border-b border-[#D8E6EB] px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Cursos vinculados</p>
          <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Minha carteira de cursos</h2>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm font-medium text-[#6d7f84]">Carregando cursos...</p>
        ) : courseSummaries.length === 0 ? (
          <div className="p-6">
            <p className="font-readex text-lg font-semibold text-[#15323b]">Nenhum curso vinculado ainda.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d7f84]">
              Quando um admin vincular um curso ao seu usuario, ele aparecer- aqui com m-tricas comerciais e comissoes.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {courseSummaries.map(({ course, sales, revenue, cancellations }) => (
              <article key={course.id} className="border border-[#D8E6EB] bg-[#F2F7F9] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-readex text-lg font-semibold tracking-tight text-[#15323b]">{course.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                      Lancamento: {formatDate(course.launch_date)}
                    </p>
                  </div>
                  <span className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(course.status)}`}>
                    {formatStatus(course.status)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5F7077]">Vendas</p>
                    <p className="mt-1 font-black text-[#15323b]">{sales}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5F7077]">Receita</p>
                    <p className="mt-1 font-black text-[#15323b]">{formatMoneyFromCents(revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5F7077]">Cancel.</p>
                    <p className="mt-1 font-black text-[#15323b]">{cancellations}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-[#6d7f84]">
                  Preco: {formatMoneyFromCents(Number(course.price_cents ?? 0))} - Comissao: {Number(course.creator_commission_percent ?? 0)}%
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden border border-[#D8E6EB] bg-white">
        <div className="border-b border-[#D8E6EB] px-5 py-4">
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Semestres por curso</h2>
          <p className="mt-1 text-sm font-medium text-[#6d7f84]">
            Cada linha representa um ciclo de seis meses contado a partir do lan-amento do curso.
          </p>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm font-medium text-[#6d7f84]">Carregando relat-rios...</p>
        ) : filteredRows.length === 0 ? (
          <div className="p-6">
            <p className="font-readex text-lg font-semibold text-[#15323b]">Sem dados para o filtro atual.</p>
            <p className="mt-2 text-sm leading-6 text-[#6d7f84]">
              Experimente selecionar outro curso ou per-odo. As vendas aparecem ap-s o webhook confirmar o pagamento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
              <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                <tr>
                  <th className="px-5 py-3">Curso</th>
                  <th className="px-5 py-3">Periodo</th>
                  <th className="px-5 py-3">Vendas</th>
                  <th className="px-5 py-3">Receita</th>
                  <th className="px-5 py-3">Cancelamentos</th>
                  <th className="px-5 py-3">Valor cancelado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6EB]">
                {filteredRows.map((row) => (
                  <tr key={`${row.course_id}-${row.period_index}`} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-black text-[#15323b]">{row.course_title}</p>
                      <p className="mt-1 text-xs font-medium text-[#5F7077]">Lancamento: {formatDate(row.launch_date)}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">
                      {formatDate(row.period_starts_at)} a {formatDate(row.period_ends_at)}
                    </td>
                    <td className="px-5 py-4 font-black text-[#15323b]">{row.sales_count}</td>
                    <td className="px-5 py-4 font-black text-[#15323b]">{formatMoneyFromCents(row.gross_revenue_cents)}</td>
                    <td className="px-5 py-4 font-black text-[#15323b]">{row.cancellations_count}</td>
                    <td className="px-5 py-4 font-black text-[#15323b]">
                      {formatMoneyFromCents(row.cancellations_amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden border border-[#D8E6EB] bg-white">
        <div className="border-b border-[#D8E6EB] px-5 py-4">
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Meus repasses</h2>
          <p className="mt-1 text-sm font-medium text-[#6d7f84]">
            Hist-rico dos lotes pagos, em processamento ou com falha. Os pagamentos via Asaas usam a chave PIX cadastrada no seu perfil.
          </p>
        </div>

        {payouts.length === 0 ? (
          <div className="p-6">
            <p className="font-readex text-lg font-semibold text-[#15323b]">Nenhum repasse registrado ainda.</p>
            <p className="mt-2 text-sm leading-6 text-[#6d7f84]">
              Quando suas comissoes forem pagas ou enviadas ao Asaas, os lotes aparecer-o aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
              <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                <tr>
                  <th className="px-5 py-3">Curso</th>
                  <th className="px-5 py-3">M-todo</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6EB]">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-5 py-4 font-black text-[#15323b]">
                      {payout.courses?.title ?? 'Curso'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">
                      {payout.payout_method === 'asaas' ? 'PIX via Asaas' : 'Pagamento externo'}
                      {payout.external_status ? <span className="block text-xs">Asaas: {payout.external_status}</span> : null}
                    </td>
                    <td className="px-5 py-4 font-black text-[#15323b]">{formatMoneyFromCents(payout.amount_cents)}</td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">
                      {formatDateTime(payout.paid_at ?? payout.failed_at ?? payout.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(payout.status)}`}>
                        {formatStatus(payout.status)}
                      </span>
                      {payout.failure_reason ? <p className="mt-2 text-xs font-semibold text-rose-700">{payout.failure_reason}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden border border-[#D8E6EB] bg-white">
        <div className="border-b border-[#D8E6EB] px-5 py-4">
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Ultimas comissoes</h2>
          <p className="mt-1 text-sm font-medium text-[#6d7f84]">
            Comissoes ficam elegiveis em ate 30 dias apos a venda e podem ser canceladas se houver estorno.
          </p>
        </div>

        {filteredCommissions.length === 0 ? (
          <div className="p-6">
            <p className="font-readex text-lg font-semibold text-[#15323b]">Nenhuma comissao no filtro atual.</p>
            <p className="mt-2 text-sm leading-6 text-[#6d7f84]">
              Elas aparecerao aqui quando uma venda paga tiver curso vinculado e percentual configurado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
              <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                <tr>
                  <th className="px-5 py-3">Curso</th>
                  <th className="px-5 py-3">Venda</th>
                  <th className="px-5 py-3">Comissao</th>
                  <th className="px-5 py-3">Venda paga em</th>
                  <th className="px-5 py-3">Elegivel em</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6EB]">
                {filteredCommissions.map((commission) => (
                  <tr key={commission.id}>
                    <td className="px-5 py-4 font-black text-[#15323b]">
                      {commission.courses?.title ?? 'Curso'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">
                      {formatMoneyFromCents(commission.gross_amount_cents)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black text-[#15323b]">{formatMoneyFromCents(commission.commission_amount_cents)}</p>
                      <p className="mt-1 text-xs font-semibold text-[#5F7077]">{commission.commission_rate}%</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">
                      {formatDateTime(commission.sale_paid_at)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">
                      {formatDateTime(commission.eligible_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(commission.status)}`}>
                        {formatStatus(commission.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
