import { useEffect, useMemo, useState } from 'react'

import {
  fetchCreatorSalesReport,
  formatMoneyFromCents,
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

export function CreatorReportsPage() {
  const [rows, setRows] = useState<CreatorSalesReportRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadReport() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const reportRows = await fetchCreatorSalesReport()
        if (isMounted) {
          setRows(reportRows)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar os relatorios.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadReport()

    return () => {
      isMounted = false
    }
  }, [])

  const totals = useMemo(() => {
    return rows.reduce(
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
  }, [rows])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Relatorios</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Meus relatorios</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
            Acompanhe vendas, receita bruta e cancelamentos dos cursos vinculados a voce, agrupados em ciclos de seis meses a partir do lancamento.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-[24px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Vendas</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{totals.sales}</p>
        </div>
        <div className="rounded-[24px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Receita bruta</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{formatMoneyFromCents(totals.revenue)}</p>
        </div>
        <div className="rounded-[24px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Cancelamentos</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{totals.cancellations}</p>
        </div>
        <div className="rounded-[24px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Valor cancelado</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{formatMoneyFromCents(totals.canceledAmount)}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white">
        <div className="border-b border-[#D8E6EB] px-5 py-4">
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Semestres por curso</h2>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm font-medium text-[#6d7f84]">Carregando relatorios...</p>
        ) : errorMessage ? (
          <p className="p-5 text-sm font-semibold text-[#1398B7]">{errorMessage}</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm font-medium text-[#6d7f84]">
            Nenhum curso vinculado ou pedido comercial encontrado ate o momento.
          </p>
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
                {rows.map((row) => (
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
    </div>
  )
}
