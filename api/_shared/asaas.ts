import { createClient } from '@supabase/supabase-js'

import { getPublicAppUrl } from './app-url.js'

type ApiRequest = {
  headers: Record<string, string | string[] | undefined>
}

export type AsaasEnvironment = 'sandbox' | 'production'
export type AsaasTransferStatus = 'PENDING' | 'DONE' | 'CANCELLED'
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

export type AsaasTransferPayload = {
  id?: string
  status?: AsaasTransferStatus | string
  value?: number
  externalReference?: string
  message?: string
  errors?: Array<{ description?: string }>
}

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
  void req
  return getPublicAppUrl()
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

export function getConfiguredAsaasWebhookSecrets() {
  return Array.from(new Set([
    process.env.ASAAS_WEBHOOK_SECRET_PRODUCTION,
    process.env.ASAAS_WEBHOOK_SECRET_SANDBOX,
    process.env.ASAAS_WEBHOOK_SECRET,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
}

export function getAsaasPixAddressKeyType(keyType: string | null | undefined) {
  const normalized = keyType?.toLowerCase()
  const mapping: Record<PixKeyType, 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'EMAIL',
    phone: 'PHONE',
    random: 'EVP',
  }

  if (!normalized || !(normalized in mapping)) {
    return null
  }

  return mapping[normalized as PixKeyType]
}

function readAsaasError(payload: AsaasTransferPayload | null, fallback: string) {
  return payload?.message || payload?.errors?.[0]?.description || fallback
}

export async function fetchAsaasBalance(environment: AsaasEnvironment, accessToken: string) {
  const response = await fetch(`${getAsaasBaseUrl(environment)}/v3/finance/balance`, {
    method: 'GET',
    headers: {
      access_token: accessToken,
    },
  })

  const payload = await response.json().catch(() => null) as { balance?: number; errors?: Array<{ description?: string }> } | null

  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.description ?? 'N?o foi possivel consultar o saldo disponivel no Asaas.')
  }

  return Number(payload?.balance ?? 0)
}

export async function createAsaasPixTransfer(input: {
  environment: AsaasEnvironment
  accessToken: string
  amountCents: number
  pixKey: string
  pixKeyType: string
  description: string
  externalReference: string
}) {
  const pixAddressKeyType = getAsaasPixAddressKeyType(input.pixKeyType)

  if (!pixAddressKeyType) {
    throw new Error('Tipo de chave PIX invalido para transferencia Asaas.')
  }

  const requestBody = {
    value: input.amountCents / 100,
    operationType: 'PIX',
    pixAddressKey: input.pixKey,
    pixAddressKeyType,
    description: input.description,
    externalReference: input.externalReference,
  }

  const response = await fetch(`${getAsaasBaseUrl(input.environment)}/v3/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: input.accessToken,
    },
    body: JSON.stringify(requestBody),
  })

  const payload = await response.json().catch(() => null) as AsaasTransferPayload | null

  if (!response.ok || !payload?.id) {
    throw new Error(readAsaasError(payload, 'N?o foi possivel criar a transferencia PIX no Asaas.'))
  }

  return {
    requestBody,
    payload,
  }
}

export async function fetchAsaasTransfer(input: {
  environment: AsaasEnvironment
  accessToken: string
  transferId: string
}) {
  const response = await fetch(`${getAsaasBaseUrl(input.environment)}/v3/transfers/${input.transferId}`, {
    method: 'GET',
    headers: {
      access_token: input.accessToken,
    },
  })

  const payload = await response.json().catch(() => null) as AsaasTransferPayload | null

  if (!response.ok || !payload?.id) {
    throw new Error(readAsaasError(payload, 'N?o foi possivel consultar a transferencia PIX no Asaas.'))
  }

  return payload
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
