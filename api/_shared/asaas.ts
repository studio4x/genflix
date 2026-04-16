import { createClient } from '@supabase/supabase-js'

type ApiRequest = {
  headers: Record<string, string | string[] | undefined>
}

export type AsaasEnvironment = 'sandbox' | 'production'

export function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]
  }

  return null
}

export function getBearerToken(headerValue: string | null) {
  if (!headerValue) {
    return null
  }

  const [scheme, token] = headerValue.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token.trim()
}

export function getRequestOrigin(req: ApiRequest) {
  const origin = getHeaderValue(req.headers.origin)
  if (origin) {
    return origin
  }

  const host = getHeaderValue(req.headers['x-forwarded-host']) ?? getHeaderValue(req.headers.host)
  const protocol = getHeaderValue(req.headers['x-forwarded-proto']) ?? 'https'

  if (!host) {
    return 'https://genflix-omega.vercel.app'
  }

  return `${protocol}://${host}`
}

export function getAsaasBaseUrl(environment: AsaasEnvironment) {
  return environment === 'sandbox'
    ? 'https://api-sandbox.asaas.com'
    : 'https://api.asaas.com'
}

export function getAsaasAccessToken(environment: AsaasEnvironment) {
  return environment === 'sandbox'
    ? process.env.ASAAS_ACCESS_TOKEN_SANDBOX ?? process.env.ASAAS_ACCESS_TOKEN
    : process.env.ASAAS_ACCESS_TOKEN_PRODUCTION ?? process.env.ASAAS_ACCESS_TOKEN
}

export async function fetchPaymentGatewayConfiguration(supabaseUrl: string, serviceRoleKey: string) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const result = await adminClient
    .from('payment_gateway_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }

  return (result.data as { environment?: AsaasEnvironment; gateway_code?: string; is_active?: boolean } | null) ?? {
    environment: 'sandbox' as const,
    gateway_code: 'asaas',
    is_active: true,
  }
}
