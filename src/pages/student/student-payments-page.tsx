import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CreditCard, ExternalLink, FileText, Loader2, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { fetchStudentPaymentHistory, requestStudentRefund, type StudentPaymentRecord } from '@/features/student/payments/api'
import { normalizePaymentStatus, paymentStatusClassName } from '@/lib/payment-status'

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

const REFUND_WINDOW_DAYS = 7
const REFUND_WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000

function canRequestRefund(status: string, paymentDate: number) {
  if (status.trim().toLowerCase() !== 'paid') {
    return false
  }

  if (!Number.isFinite(paymentDate)) {
    return false
  }

  return Date.now() - paymentDate <= REFUND_WINDOW_MS
}

type PaymentRowProps = {
  payment: StudentPaymentRecord
  onOpenRefundModal: (payment: StudentPaymentRecord) => void
}

function PaymentRow({ payment, onOpenRefundModal }: PaymentRowProps) {
  const status = normalizePaymentStatus(payment.status)
  const isPendingPayment = payment.status.toLowerCase() === 'open' || payment.status.toLowerCase() === 'pending' || payment.status.toLowerCase() === 'active'
  const invoiceUrl = payment.pdf_url || payment.checkout_url || null
  const actionLabel = isPendingPayment ? 'Pagar' : 'Ver fatura'
  const refundAllowed = canRequestRefund(payment.status, payment.date)

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatDate(payment.date)}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-bold text-slate-900">{payment.description}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Pedido #{payment.id.slice(0, 8)}</p>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatCurrency(payment.amount, payment.currency)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${paymentStatusClassName(status.tone)}`}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {invoiceUrl ? (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#BFD8E2] bg-[#F0F8FB] px-4 py-2 text-xs font-black tracking-[0.02em] text-[#113845] transition-colors hover:bg-[#E4F2F7]"
            >
              {actionLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
              Sem fatura externa
            </span>
          )}

          <button
            type="button"
            onClick={() => onOpenRefundModal(payment)}
            disabled={!refundAllowed}
            className="inline-flex items-center gap-2 rounded-full border border-[#E6C87B] bg-[#FFF8E8] px-4 py-2 text-xs font-black tracking-[0.02em] text-[#8A5B00] transition-colors hover:bg-[#FDEEC6] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Solicitar reembolso
          </button>
        </div>
      </td>
    </tr>
  )
}

type RefundModalStep = 'options' | 'confirm'

function RefundRequestModal({
  payment,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  payment: StudentPaymentRecord
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [step, setStep] = useState<RefundModalStep>('options')
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirmRefund() {
    setErrorMessage(null)
    try {
      await onSubmit(reason)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel enviar a solicitacao de reembolso.')
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#09131fb0] p-4 backdrop-blur-sm">
      <div className="w-full max-w-[640px] rounded-[36px] border border-[#D7DEE6] bg-white p-6 shadow-[0_30px_90px_rgba(9,19,31,0.3)] sm:p-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D7DEE6] text-[#546273] transition-colors hover:bg-[#F3F6F9]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'options' ? (
          <div className="space-y-6">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.3em] text-[#C96A1B]">Antes de cancelar</p>
              <h3 className="mt-3 max-w-[500px] text-4xl font-black leading-[1.05] tracking-tight text-[#09142A]">Podemos tentar resolver isto contigo?</h3>
              <p className="mt-4 text-lg leading-8 text-[#445166]">
                O reembolso remove o acesso ao curso. Se o problema for acesso, pagamento, conteudo ou duvida de uso, o suporte pode ajudar rapidamente.
              </p>
            </div>

            <div className="rounded-3xl border border-[#DAE2EA] bg-[#F5F7FA] p-5">
              <p className="text-xl font-bold text-[#0E1B33]">{payment.description}</p>
              <p className="mt-1 text-sm font-semibold text-[#5B687B]">
                Pedido {payment.id.slice(0, 8)} · {formatCurrency(payment.amount, payment.currency)}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                asChild
                className="h-12 flex-1 rounded-full border border-[#BFD8E2] bg-[#EAF5F9] text-base font-black text-[#173847] hover:bg-[#DCEFF6]"
              >
                <Link to="/aluno/suporte?openTicketModal=1&ticketStep=form">Abrir ticket de suporte</Link>
              </Button>

              <Button
                type="button"
                onClick={() => setStep('confirm')}
                className="h-12 flex-1 rounded-full bg-[#282B57] text-base font-black text-white hover:bg-[#202347]"
              >
                Solicitar reembolso
              </Button>
            </div>

            <button type="button" onClick={onClose} className="w-full text-center text-base font-bold text-[#334155]">
              Voltar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.3em] text-[#D31C4B]">Confirmar solicitacao</p>
              <h3 className="mt-3 max-w-[520px] text-4xl font-black leading-[1.05] tracking-tight text-[#09142A]">Tens certeza que queres pedir o reembolso?</h3>
              <p className="mt-4 text-lg leading-8 text-[#445166]">
                O estorno sera solicitado automaticamente no gateway de pagamento. O acesso ao curso sera removido apos a confirmacao.
              </p>
            </div>

            <label className="grid gap-3">
              <span className="text-lg font-bold text-[#253246]">Mensagem opcional</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Conta rapidamente o motivo do pedido..."
                rows={4}
                className="resize-none rounded-3xl border border-[#D7DEE6] bg-[#F7F9FC] px-4 py-3 text-base text-[#1F2A3D] outline-none"
              />
            </label>

            {errorMessage ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => setStep('options')}
                disabled={isSubmitting}
                className="h-12 flex-1 rounded-full border border-[#BFD8E2] bg-[#EAF5F9] text-base font-black text-[#173847] hover:bg-[#DCEFF6]"
              >
                Rever opcoes
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirmRefund()}
                disabled={isSubmitting}
                className="h-12 flex-1 rounded-full bg-[#C70F45] text-base font-black text-white hover:bg-[#AE0D3C]"
              >
                {isSubmitting ? 'Enviando...' : 'Confirmar reembolso'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function StudentPaymentsPage() {
  const [payments, setPayments] = useState<StudentPaymentRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedRefundPayment, setSelectedRefundPayment] = useState<StudentPaymentRecord | null>(null)
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)

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

  async function handleSubmitRefund(reason: string) {
    if (!selectedRefundPayment) {
      return
    }

    setIsSubmittingRefund(true)
    try {
      await requestStudentRefund({
        checkoutSessionId: selectedRefundPayment.id,
        reason,
      })

      setSelectedRefundPayment(null)
      await loadHistory(true)
    } finally {
      setIsSubmittingRefund(false)
    }
  }

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
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-500">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} onOpenRefundModal={setSelectedRefundPayment} />
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

      {selectedRefundPayment ? (
        <RefundRequestModal
          payment={selectedRefundPayment}
          isSubmitting={isSubmittingRefund}
          onClose={() => setSelectedRefundPayment(null)}
          onSubmit={handleSubmitRefund}
        />
      ) : null}
    </div>
  )
}
