import { supabase } from '@/services/supabase/client'

export type PaymentGatewayEnvironment = 'sandbox' | 'production'

export interface PaymentGatewaySettings {
  id: number
  gateway_code: 'asaas'
  environment: PaymentGatewayEnvironment
  is_active: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface CommerceCheckoutSessionSummary {
  id: string
  buyer_email: string
  status: string
  checkout_url: string | null
  created_at: string
  courses?: {
    title?: string | null
  } | null
}

export interface CommerceEventSummary {
  id: string
  event_type: string
  status: string
  created_at?: string
  received_at: string
}

export async function fetchPaymentGatewaySettings(): Promise<PaymentGatewaySettings> {
  const result = await supabase
    .from('payment_gateway_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }

  return (
    result.data ?? {
      id: 1,
      gateway_code: 'asaas',
      environment: 'sandbox',
      is_active: true,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ) as PaymentGatewaySettings
}

export async function updatePaymentGatewaySettings(
  environment: PaymentGatewayEnvironment,
  updatedBy?: string | null,
) {
  const result = await supabase
    .from('payment_gateway_settings')
    .upsert(
      {
        id: 1,
        gateway_code: 'asaas',
        environment,
        is_active: true,
        updated_by: updatedBy ?? null,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as PaymentGatewaySettings
}

export async function fetchCommerceDashboardSummaries() {
  const [sessionsResult, eventsResult] = await Promise.all([
    supabase
      .from('commerce_checkout_sessions')
      .select('id, buyer_email, status, checkout_url, created_at, courses(title)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('commerce_events')
      .select('id, event_type, status, received_at')
      .order('received_at', { ascending: false })
      .limit(5),
  ])

  if (sessionsResult.error) {
    throw sessionsResult.error
  }

  if (eventsResult.error) {
    throw eventsResult.error
  }

  return {
    sessions: (sessionsResult.data ?? []) as CommerceCheckoutSessionSummary[],
    events: (eventsResult.data ?? []) as CommerceEventSummary[],
  }
}

export async function fetchPublicCatalogCourses() {
  const result = await supabase
    .from('courses')
    .select('*')
    .eq('status', 'published')
    .eq('is_public', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return result.data ?? []
}
