import { supabase } from '@/services/supabase/client'
import {
  isLegacyCourseSalesSchemaError,
  withLegacyCourseSalesDefaults,
} from '@/features/courses/schema-compat'

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
  buyer_name?: string | null
  buyer_email: string
  status: string
  gateway_environment?: PaymentGatewayEnvironment | null
  checkout_url: string | null
  created_at: string
  released_at?: string | null
  courses?: {
    title?: string | null
    price_cents?: number | null
  } | null
}

export interface CommerceEventSummary {
  id: string
  event_type: string
  status: string
  gateway_environment?: PaymentGatewayEnvironment | null
  created_at?: string
  received_at: string
}

export interface CommerceDashboardMetrics {
  totalSessions: number
  activeSessions: number
  paidSessions: number
  refundedSessions: number
  failedEvents: number
  estimatedGrossRevenueCents: number
  lastEventAt: string | null
}

export interface PaymentDiagnosticCheck {
  key: string
  label: string
  status: 'ok' | 'warning' | 'error'
  detail: string
}

export interface PaymentGatewayDiagnostics {
  environment: PaymentGatewayEnvironment | null
  checkedAt: string
  checks: PaymentDiagnosticCheck[]
}

type CommerceMetricSession = {
  id: string
  status: string
  courses?: { price_cents?: number | null } | { price_cents?: number | null }[] | null
}

function getSessionCoursePriceCents(session: CommerceMetricSession) {
  const course = Array.isArray(session.courses) ? session.courses[0] : session.courses
  return Number(course?.price_cents ?? 0)
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
  const [sessionsResult, eventsResult, metricSessionsResult] = await Promise.all([
    supabase
      .from('commerce_checkout_sessions')
      .select('id, buyer_name, buyer_email, status, gateway_environment, checkout_url, created_at, released_at, courses(title, price_cents)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('commerce_events')
      .select('id, event_type, status, gateway_environment, received_at')
      .order('received_at', { ascending: false })
      .limit(8),
    supabase
      .from('commerce_checkout_sessions')
      .select('id, status, courses(price_cents)')
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (sessionsResult.error) {
    throw sessionsResult.error
  }

  if (eventsResult.error) {
    throw eventsResult.error
  }

  if (metricSessionsResult.error) {
    throw metricSessionsResult.error
  }

  const metricSessions = (metricSessionsResult.data ?? []) as CommerceMetricSession[]
  const recentEvents = (eventsResult.data ?? []) as CommerceEventSummary[]
  const paidSessions = metricSessions.filter((session) => session.status === 'paid')
  const metrics: CommerceDashboardMetrics = {
    totalSessions: metricSessions.length,
    activeSessions: metricSessions.filter((session) => session.status === 'active').length,
    paidSessions: paidSessions.length,
    refundedSessions: metricSessions.filter((session) => session.status === 'refunded' || session.status === 'chargeback').length,
    failedEvents: recentEvents.filter((event) => event.status === 'failed').length,
    estimatedGrossRevenueCents: paidSessions.reduce((total, session) => {
      return total + getSessionCoursePriceCents(session)
    }, 0),
    lastEventAt: recentEvents[0]?.received_at ?? null,
  }

  return {
    sessions: (sessionsResult.data ?? []) as CommerceCheckoutSessionSummary[],
    events: recentEvents,
    metrics,
  }
}

export async function fetchPaymentGatewayDiagnostics(): Promise<PaymentGatewayDiagnostics> {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessão expirada. Entre novamente para diagnosticar pagamentos.')
  }

  const response = await fetch('/api/admin/payments/diagnostics', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = await response.json().catch(() => null) as PaymentGatewayDiagnostics & { error?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível diagnosticar as configurações de pagamento.')
  }

  if (!payload?.checks) {
    throw new Error('Diagnóstico retornou sem dados de configuração.')
  }

  return payload
}

export async function fetchAdminPaymentInvoiceUrl(sessionId: string) {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Entre novamente para abrir a fatura.')
  }

  const response = await fetch('/api/admin/payments/diagnostics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sessionId }),
  })

  const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? 'Nao foi possivel abrir a fatura do pedido.')
  }

  return payload.url
}

export async function fetchPublicCatalogCourses() {
  const result = await supabase
    .from('courses')
    .select('*')
    .eq('status', 'published')
    .eq('is_public', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (result.error && isLegacyCourseSalesSchemaError(result.error)) {
    const legacyResult = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (legacyResult.error) {
      throw legacyResult.error
    }

    return (legacyResult.data ?? []).map(withLegacyCourseSalesDefaults)
  }

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []).map(withLegacyCourseSalesDefaults)
}
