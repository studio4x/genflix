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

export function formatMoneyFromCents(valueInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100)
}
