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
