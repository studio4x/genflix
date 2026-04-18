import { supabase } from '@/services/supabase/client'

export type CreatorCommissionStatus = 'pending' | 'eligible' | 'scheduled' | 'paid' | 'canceled' | 'refunded' | 'failed'
export type CreatorPayoutStatus = 'draft' | 'scheduled' | 'processing' | 'paid' | 'failed' | 'canceled'

export interface AdminCreatorCommission {
  id: string
  course_id: string
  creator_id: string
  checkout_session_id: string | null
  external_payment_id: string | null
  gross_amount_cents: number
  commission_rate: number
  commission_amount_cents: number
  status: CreatorCommissionStatus
  sale_paid_at: string
  eligible_at: string
  canceled_at: string | null
  refunded_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface AdminCreatorPayout {
  id: string
  creator_id: string
  amount_cents: number
  status: CreatorPayoutStatus
  pix_key_type: string | null
  pix_key: string | null
  payout_name: string | null
  scheduled_for: string | null
  paid_at: string | null
  created_by: string | null
  notes: string | null
  created_at: string
}

export interface AdminCreatorPayoutItem {
  id: string
  payout_id: string
  commission_id: string
  amount_cents: number
  created_at: string
}

export interface AdminCreatorProfile {
  user_id: string
  payout_name: string | null
  document: string | null
  pix_key_type: string | null
  pix_key: string | null
  default_commission_percent: number
  payout_hold_days: number
  is_payout_enabled: boolean
}

export interface AdminCreatorProfileIdentity {
  id: string
  full_name: string | null
  email: string | null
}

export interface AdminCreatorCourseIdentity {
  id: string
  title: string | null
}

export interface AdminCreatorPayoutDashboard {
  commissions: AdminCreatorCommission[]
  payouts: AdminCreatorPayout[]
  payoutItems: AdminCreatorPayoutItem[]
  profiles: AdminCreatorProfileIdentity[]
  creatorProfiles: AdminCreatorProfile[]
  courses: AdminCreatorCourseIdentity[]
}

async function getAccessToken() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessão expirada. Entre novamente para gerenciar repasses.')
  }

  return accessToken
}

export async function fetchAdminCreatorPayoutDashboard(): Promise<AdminCreatorPayoutDashboard> {
  const accessToken = await getAccessToken()
  const response = await fetch('/api/admin/creator-payouts', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = await response.json().catch(() => null) as (AdminCreatorPayoutDashboard & { error?: string }) | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível carregar repasses de criadores.')
  }

  if (!payload) {
    throw new Error('A API de repasses retornou uma resposta vazia.')
  }

  return payload
}

export async function registerPaidCreatorPayout(input: {
  creatorId: string
  commissionIds: string[]
  paidAt?: string
  notes?: string
}) {
  const accessToken = await getAccessToken()
  const response = await fetch('/api/admin/creator-payouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'register_paid_payout',
      creatorId: input.creatorId,
      commissionIds: input.commissionIds,
      paidAt: input.paidAt,
      notes: input.notes,
    }),
  })

  const payload = await response.json().catch(() => null) as { payoutId?: string; error?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível registrar o repasse.')
  }

  return payload?.payoutId ?? null
}

export function formatMoneyFromCents(valueInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100)
}
