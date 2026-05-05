import { supabase } from '@/services/supabase/client'

export type StudentPaymentRecord = {
  id: string
  date: number
  amount: number
  currency: string
  status: string
  raw_status?: string | null
  description: string
  pdf_url: string | null
  type: 'subscription' | 'one_time'
  asaas_checkout_id?: string | null
  installment_current?: number | null
  installment_total?: number | null
  installment_group_key?: string | null
  checkout_url?: string | null
}

type PaymentHistoryResponse = {
  payments?: StudentPaymentRecord[]
}

export async function fetchStudentPaymentHistory() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente.')
  }

  const response = await fetch('/api/checkout/asaas/history', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } & PaymentHistoryResponse | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Nao foi possivel consultar o historico de pagamentos.')
  }

  return payload?.payments ?? []
}

export async function requestStudentRefund(input: { checkoutSessionId: string; reason?: string }) {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente.')
  }

  const response = await fetch('/api/checkout/asaas/request-refund', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      checkoutSessionId: input.checkoutSessionId,
      reason: input.reason ?? '',
    }),
  })

  const payload = (await response.json().catch(() => null)) as { error?: string; supportTicketId?: string | null } | null
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Nao foi possivel solicitar o reembolso.')
  }

  return {
    supportTicketId: payload?.supportTicketId ?? null,
  }
}
