import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CreditCard, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { fetchStudentPaymentHistory, type StudentPaymentRecord } from '@/features/student/payments/api'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(amount)
}

function formatDate(dateValue: number) {
  if (!Number.isFinite(dateValue)) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateValue))
}

function normalizeStatus(status: string) {
  const normalized = status.trim().toLowerCase()

  if (normalized === 'paid' || normalized === 'succeeded') {
    return { label: 'Pago', tone: 'green' as const }
  }
  if (normalized === 'open' || normalized === 'pending' || normalized === 'active') {
    return { label: 'Pendente', tone: 'amber' as const }
  }
  if (normalized === 'refund_pending') {
    return { label: 'Estorno pendente', tone: 'amber' as const }
  }
  if (normalized === 'refunded') {
    return { label: 'Estornado', tone: 'slate' as const }
  }
  if (normalized === 'void' || normalized === 'canceled' || normalized === 'cancelled' || normalized === 'expired') {
    return { label: 'Cancelado', tone: 'red' as const }
  }

  return { label: status, tone: 'slate' as const }
}

function statusClassName(tone: 'green' | 'amber' | 'red' | 'slate') {
  if (tone === 'green') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (tone === 'amber') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (tone === 'red') {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function PaymentRow({ payment }: { payment: StudentPaymentRecord }) {
  const status = normalizeStatus(payment.status)
  const actionLabel = payment.status.toLowerCase() === 'open' || payment.status.toLowerCase() === 'pending'
    ? 'Pagar'
    : 'Ver Fatura'

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatDate(payment.date)}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-bold text-slate-900">{payment.description}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Pedido #{payment.id.slice(0, 8)}</p>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatCurrency(payment.amount, payment.currency)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${statusClassName(status.tone)}`}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {payment.pdf_url ? (
          <a
            href={payment.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-blue-700 transition-colors hover:bg-blue-100"
          >
            {actionLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-xs font-semibold text-slate-500">Recibo Digital</span>
        )}
      </td>
    </tr>
  )
}

export function StudentPaymentsPage() {
  const [payments, setPayments] = useState<StudentPaymentRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadHistory = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)
    try {
      const nextPayments = await fetchStudentPaymentHistory()
      setPayments(nextPayments)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o historico.'
      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const hasPayments = useMemo(() => payments.length > 0, [payments.length])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-slate-100 pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-blue-700">
            <CreditCard className="h-3.5 w-3.5" />
            Pagamentos
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Historico de Pagamentos</h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
              Confira seus pedidos, faturas e o status mais recente de cada pagamento realizado na plataforma.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadHistory(true)}
          disabled={isLoading || isRefreshing}
          className="h-12 rounded-2xl border-slate-200 px-5 font-bold text-slate-700"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      {isLoading ? (
        <section className="flex min-h-[240px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-semibold">Buscando registros de pagamento...</p>
          </div>
        </section>
      ) : null}

      {!isLoading && error ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5" />
            <div className="space-y-3">
              <p className="text-base font-black">Nao foi possivel carregar seus pagamentos.</p>
              <p className="text-sm font-medium">{error}</p>
              <Button type="button" variant="outline" onClick={() => void loadHistory()} className="rounded-xl border-red-200 bg-white text-red-700">
                Tentar novamente
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {!isLoading && !error ? (
        <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          {hasPayments ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Descricao</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-500">Fatura</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 text-center">
                <FileText className="h-10 w-10 text-slate-300" />
                <p className="mt-4 text-base font-bold text-slate-700">Nenhum historico de pagamento encontrado.</p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Assim que um pedido for criado, ele sera listado aqui para acompanhamento.
                </p>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

