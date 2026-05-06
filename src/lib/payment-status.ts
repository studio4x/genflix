export type PaymentStatusTone = 'green' | 'amber' | 'red' | 'slate'

export function normalizePaymentStatus(rawStatus: string) {
  const normalized = rawStatus.trim().toLowerCase()

  if (normalized === 'paid' || normalized === 'succeeded' || normalized === 'received' || normalized === 'processed') {
    return { label: 'Pago', tone: 'green' as const }
  }

  if (normalized === 'open' || normalized === 'pending' || normalized === 'active') {
    return { label: 'Pendente', tone: 'amber' as const }
  }

  if (normalized === 'refund_pending') {
    return { label: 'Reembolso pendente', tone: 'amber' as const }
  }

  if (normalized === 'refunded' || normalized === 'chargeback') {
    return { label: 'Reembolsado', tone: 'red' as const }
  }

  if (normalized === 'void' || normalized === 'canceled' || normalized === 'cancelled' || normalized === 'expired') {
    return { label: 'Cancelado', tone: 'red' as const }
  }

  if (normalized === 'failed') {
    return { label: 'Falhou', tone: 'red' as const }
  }

  if (normalized === 'ignored') {
    return { label: 'Ignorado', tone: 'slate' as const }
  }

  return { label: rawStatus, tone: 'slate' as const }
}

export function paymentStatusClassName(tone: PaymentStatusTone) {
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
