import { supabase } from '@/services/supabase/client'

export interface CreatorSalesReportRow {
  course_id: string
  course_title: string
  creator_id: string | null
  launch_date: string | null
  period_index: number
  period_starts_at: string
  period_ends_at: string
  sales_count: number
  gross_revenue_cents: number
  cancellations_count: number
  cancellations_amount_cents: number
}

export interface CreatorCommissionRow {
  id: string
  course_id: string
  creator_id: string
  checkout_session_id: string | null
  external_payment_id: string | null
  gross_amount_cents: number
  commission_rate: number
  commission_amount_cents: number
  status: 'pending' | 'eligible' | 'scheduled' | 'paid' | 'canceled' | 'refunded' | 'failed'
  sale_paid_at: string
  eligible_at: string
  paid_at: string | null
  canceled_at: string | null
  refunded_at: string | null
  courses?: {
    title?: string | null
  } | null
}

export interface CreatorPayoutSettingsRow {
  id: number
  mode: 'manual' | 'automatic'
  interval_days: number
  minimum_amount_cents: number
  is_enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
}

export interface CreatorPayoutRow {
  id: string
  course_id: string | null
  amount_cents: number
  status: 'draft' | 'scheduled' | 'processing' | 'paid' | 'failed' | 'canceled'
  payout_method: 'external' | 'asaas'
  external_status: string | null
  external_transfer_id: string | null
  scheduled_for: string | null
  paid_at: string | null
  failed_at: string | null
  failure_reason: string | null
  created_at: string
  courses?: {
    title?: string | null
  } | null
}

export interface CreatorCourseSummary {
  id: string
  title: string
  status: string
  launch_date: string | null
  price_cents: number | null
  currency: string | null
  is_public: boolean | null
  creator_commission_percent: number | null
}

interface CreatorSalesReportFilters {
  creatorId?: string | null
  courseId?: string | null
}

export async function fetchCreatorSalesReport(filters: CreatorSalesReportFilters = {}) {
  const { data, error } = await supabase.rpc('get_creator_sales_report', {
    _creator_id: filters.creatorId ?? null,
    _course_id: filters.courseId ?? null,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as CreatorSalesReportRow[]
}

export async function fetchCreatorCommissions() {
  const { data, error } = await supabase
    .from('creator_commissions')
    .select('*, courses(title)')
    .order('sale_paid_at', { ascending: false })
    .limit(20)

  if (error) {
    throw error
  }

  return (data ?? []) as CreatorCommissionRow[]
}

export async function fetchCreatorPayoutSettings() {
  const { data, error } = await supabase
    .from('creator_payout_settings')
    .select('id, mode, interval_days, minimum_amount_cents, is_enabled, last_run_at, next_run_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? {
    id: 1,
    mode: 'automatic',
    interval_days: 30,
    minimum_amount_cents: 0,
    is_enabled: true,
    last_run_at: null,
    next_run_at: null,
  }) as CreatorPayoutSettingsRow
}

export async function fetchCreatorPayouts() {
  const { data, error } = await supabase
    .from('creator_payouts')
    .select('id, course_id, amount_cents, status, payout_method, external_status, external_transfer_id, scheduled_for, paid_at, failed_at, failure_reason, created_at, courses(title)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw error
  }

  return (data ?? []) as CreatorPayoutRow[]
}

export async function fetchCreatorCourses() {
  const sessionResult = await supabase.auth.getUser()
  const userId = sessionResult.data.user?.id

  if (!userId) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, status, launch_date, price_cents, currency, is_public, creator_commission_percent')
    .eq('creator_id', userId)
    .order('launch_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CreatorCourseSummary[]
}

export function formatMoneyFromCents(valueInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100)
}
