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

export function formatMoneyFromCents(valueInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100)
}
