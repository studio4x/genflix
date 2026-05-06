import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getAsaasBaseUrl,
  getBearerToken,
  getHeaderValue,
  getRequestOrigin,
} from '../../_shared/asaas.js'
import { queueUserNotification } from '../../_shared/notifications.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

const startCheckoutSchema = z.object({
  courseId: z.string().uuid('Curso inválido.'),
  buyerName: z.string().trim().max(160).optional(),
  buyerEmail: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
  buyerDocument: z.string().trim().optional(),
  buyerPhone: z.string().trim().optional(),
  buyerAddress: z.string().trim().optional(),
  buyerAddressNumber: z.string().trim().optional(),
  buyerAddressComplement: z.string().trim().optional(),
  buyerPostalCode: z.string().trim().optional(),
  buyerState: z.string().trim().optional(),
  buyerProvince: z.string().trim().optional(),
  buyerCity: z.string().trim().optional(),
  buyerUserId: z.string().trim().uuid().optional().or(z.literal('')),
})

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') {
      return message
    }
  }

  return ''
}

function isLegacyCourseSalesSchemaError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()

  return ['slug', 'launch_date', 'price_cents', 'currency', 'is_public'].some((column) => {
    return (
      message.includes(`courses.${column}`) ||
      message.includes(`column ${column}`) ||
      message.includes(`'${column}' column`) ||
      message.includes(`"${column}"`)
    ) && (
      message.includes('does not exist') ||
      message.includes('could not find') ||
      message.includes('schema cache')
    )
  })
}

function parseBody(rawBody: unknown) {
  if (!rawBody) {
    return null
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as Record<string, unknown>
  }

  return null
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function normalizeDocument(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function normalizePhoneNumber(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function normalizeCityCode(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function normalizePostalCode(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function normalizeStateCode(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value)?.toUpperCase()
  return normalized && normalized.length > 0 ? normalized.slice(0, 2) : null
}

function limitAsaasName(value: string, fallback: string) {
  const normalized = normalizeOptionalText(value) ?? normalizeOptionalText(fallback) ?? ''
  return normalized.slice(0, 30)
}

const MIN_INSTALLMENT_VALUE = 50
const MAX_INSTALLMENTS_ALLOWED = 12

function resolveMaxInstallmentCount(totalAmount: number) {
  const byMinimumValue = Math.floor(totalAmount / MIN_INSTALLMENT_VALUE)
  if (!Number.isFinite(byMinimumValue) || byMinimumValue < 2) {
    return null
  }

  return Math.max(2, Math.min(MAX_INSTALLMENTS_ALLOWED, byMinimumValue))
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Método não permitido.' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração do Supabase ausente.' })
    return
  }

  const body = parseBody(req.body)
  const parsed = startCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const accessToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const buyerUserId = normalizeOptionalText(parsed.data.buyerUserId)
  let authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null } | null = null

  if (accessToken) {
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
    if (userError || !userData.user) {
      jsonResponse(res, 401, { error: 'Token ausente ou inválido.' })
      return
    }

    authUser = userData.user
  } else if (buyerUserId) {
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(buyerUserId)
    if (userError || !userData.user) {
      jsonResponse(res, 401, { error: 'Conta não encontrada para iniciar o checkout.' })
      return
    }

    authUser = userData.user
  } else {
    jsonResponse(res, 401, { error: 'Token ausente ou inválido.' })
    return
  }

  const resolvedUserId = authUser.id

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, full_name, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city')
    .eq('id', resolvedUserId)
    .maybeSingle()

  if (profileError) {
    jsonResponse(res, 500, { error: 'Não foi possível carregar o perfil do usuário.' })
    return
  }

  let { data: course, error: courseError } = await adminClient
    .from('courses')
    .select('id, title, description, status, price_cents, currency, is_public')
    .eq('id', parsed.data.courseId)
    .maybeSingle()

  const usingLegacyCourseSalesSchema = Boolean(courseError && isLegacyCourseSalesSchemaError(courseError))

  if (usingLegacyCourseSalesSchema) {
    const legacyCourseResult = await adminClient
      .from('courses')
      .select('id, title, description, status')
      .eq('id', parsed.data.courseId)
      .maybeSingle()

    course = legacyCourseResult.data
      ? {
        ...legacyCourseResult.data,
        price_cents: null,
        currency: 'BRL',
        is_public: true,
      }
      : null
    courseError = legacyCourseResult.error
  }

  if (courseError) {
    jsonResponse(res, 500, { error: 'Não foi possível carregar o curso.' })
    return
  }

  if (!course || course.status !== 'published' || course.is_public !== true) {
    jsonResponse(res, 404, { error: 'Curso indisponível para compra.' })
    return
  }

  if (usingLegacyCourseSalesSchema) {
    jsonResponse(res, 503, { error: 'Checkout indisponivel ate concluir a migracao comercial do banco.' })
    return
  }

  const priceCents = Number(course.price_cents ?? 0)
  const origin = getRequestOrigin(req)
  const buyerName = limitAsaasName(
    parsed.data.buyerName ??
      profile?.full_name ??
      (authUser.user_metadata?.full_name as string | undefined) ??
      authUser.email ??
      'Aluno GenFlix',
    'Aluno GenFlix',
  )
  const buyerEmail =
    normalizeOptionalText(parsed.data.buyerEmail) ??
    normalizeOptionalText(profile?.email) ??
    normalizeOptionalText(authUser.email)
  const buyerDocument =
    normalizeDocument(parsed.data.buyerDocument) ??
    normalizeDocument(profile?.cpf) ??
    normalizeDocument((authUser.user_metadata as Record<string, unknown> | null | undefined)?.document as string | undefined) ??
    normalizeDocument((authUser.user_metadata as Record<string, unknown> | null | undefined)?.cpf as string | undefined)
  const buyerPhone =
    normalizePhoneNumber(parsed.data.buyerPhone) ??
    normalizePhoneNumber(profile?.whatsapp_number) ??
    normalizePhoneNumber((authUser.user_metadata as Record<string, unknown> | null | undefined)?.phone as string | undefined) ??
    normalizePhoneNumber((authUser.user_metadata as Record<string, unknown> | null | undefined)?.phone_number as string | undefined)
  const buyerAddress = normalizeOptionalText(parsed.data.buyerAddress) ?? normalizeOptionalText(profile?.address)
  const buyerAddressNumber = normalizeOptionalText(parsed.data.buyerAddressNumber) ?? normalizeOptionalText(profile?.address_number)
  const buyerAddressComplement = normalizeOptionalText(parsed.data.buyerAddressComplement) ?? normalizeOptionalText(profile?.address_complement)
  const buyerPostalCode = normalizePostalCode(parsed.data.buyerPostalCode) ?? normalizePostalCode(profile?.postal_code)
  const buyerState = normalizeStateCode(parsed.data.buyerState) ?? normalizeStateCode(profile?.state)
  const buyerProvince = normalizeOptionalText(parsed.data.buyerProvince) ?? normalizeOptionalText(profile?.province)
  const buyerCity = normalizeCityCode(parsed.data.buyerCity) ?? normalizeCityCode(profile?.city)

  if (!buyerEmail) {
    jsonResponse(res, 400, { error: 'Informe um e-mail válido para iniciar o checkout.' })
    return
  }

  if (!buyerDocument || buyerDocument.length !== 11) {
    jsonResponse(res, 400, { error: 'Informe um CPF válido para iniciar o checkout.' })
    return
  }

  if (!buyerPhone || buyerPhone.length < 10) {
    jsonResponse(res, 400, { error: 'Informe um celular válido para iniciar o checkout.' })
    return
  }

  if (!buyerAddress || !buyerAddressNumber || !buyerPostalCode || buyerPostalCode.length !== 8 || !buyerState || !buyerProvince || !buyerCity) {
    jsonResponse(res, 400, { error: 'Informe o endereço completo para iniciar o checkout.' })
    return
  }


  const profileUpsertResult = await adminClient.from('profiles').upsert(
    {
      id: resolvedUserId,
      email: buyerEmail,
      full_name: buyerName,
      cpf: buyerDocument,
      whatsapp_number: buyerPhone,
      address: buyerAddress,
      address_number: buyerAddressNumber,
      address_complement: buyerAddressComplement,
      postal_code: buyerPostalCode,
      state: buyerState,
      province: buyerProvince,
      city: buyerCity,
    },
    { onConflict: 'id' },
  )

  if (profileUpsertResult.error) {
    console.error('checkout_profile_upsert_failed', profileUpsertResult.error)
  }

  if (priceCents <= 0) {
    const releaseResult = await adminClient
      .from('course_releases')
      .upsert(
        {
          course_id: course.id,
          release_type: 'user',
          user_id: resolvedUserId,
          group_id: null,
          starts_at: null,
          ends_at: null,
          is_active: true,
          created_by: resolvedUserId,
          release_source: 'purchase',
          release_status: 'active',
          source_system: 'asaas',
          external_reference_id: `free-${course.id}-${resolvedUserId}`,
          managed_by_integration: true,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'course_id,user_id' },
      )

    if (releaseResult.error) {
      jsonResponse(res, 500, { error: 'Não foi possível liberar o curso gratuito.' })
      return
    }

    await queueUserNotification(adminClient, {
      userId: resolvedUserId,
      title: 'Curso liberado com sucesso',
      body: `O acesso ao curso ${course.title ?? 'selecionado'} ja esta disponivel na sua area do aluno.`,
      category: 'payment',
      priority: 'high',
      actionUrl: `/aluno/cursos/${course.id}`,
      channels: ['in-app', 'email'],
      metadata: {
        course_id: course.id,
        release_mode: 'free',
      },
    }).catch(() => undefined)

    jsonResponse(res, 200, {
      checkoutUrl: `${origin}/aluno/cursos/${course.id}`,
      mode: 'free',
    })
    return
  }

  const gatewayConfig = await fetchPaymentGatewayConfiguration(supabaseUrl, serviceRoleKey)
  if (!gatewayConfig.is_active || gatewayConfig.gateway_code !== 'asaas') {
    jsonResponse(res, 400, { error: 'Gateway de pagamento indisponível.' })
    return
  }

  const asaasToken = getAsaasAccessToken(gatewayConfig.environment ?? 'sandbox')
  if (!asaasToken) {
    jsonResponse(res, 500, { error: 'Chave do Asaas não configurada para o ambiente ativo.' })
    return
  }

  const checkoutSessionId = crypto.randomUUID()
  const totalAmount = priceCents / 100
  const maxInstallmentCount = resolveMaxInstallmentCount(totalAmount)
  const chargeTypes = maxInstallmentCount ? ['DETACHED', 'INSTALLMENT'] : ['DETACHED']
  const checkoutRequest = {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes,
    minutesToExpire: 1440,
    externalReference: checkoutSessionId,
    callback: {
      successUrl: `${origin}/checkout/confirmacao?courseId=${course.id}&courseTitle=${encodeURIComponent(course.title)}&courseValue=${priceCents / 100}&currency=${encodeURIComponent(course.currency ?? 'BRL')}`,
      cancelUrl: `${origin}/aluno/cursos/${course.id}?checkout=cancel`,
      expiredUrl: `${origin}/aluno/cursos/${course.id}?checkout=expired`,
    },
    items: [
      {
        name: limitAsaasName(course.title, 'Curso GenFlix'),
        description: course.description?.replace(/<[^>]*>?/gm, ' ').trim() || course.title,
        quantity: 1,
        value: totalAmount,
      },
    ],
    ...(maxInstallmentCount
      ? {
        installment: {
          maxInstallmentCount,
        },
      }
      : {}),
    customerData: {
      name: buyerName,
      email: buyerEmail,
      cpfCnpj: buyerDocument,
      phone: buyerPhone,
      address: buyerAddress,
      addressNumber: buyerAddressNumber,
      complement: buyerAddressComplement,
      postalCode: buyerPostalCode,
      province: buyerProvince,
      city: Number(buyerCity),
    },
  }

  const createCheckoutResponse = await fetch(`${getAsaasBaseUrl(gatewayConfig.environment as 'sandbox' | 'production')}/v3/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: asaasToken,
    },
    body: JSON.stringify(checkoutRequest),
  })

  const checkoutPayload = await createCheckoutResponse.json().catch(() => null) as {
    id?: string
    message?: string
    errors?: Array<{ description?: string }>
  } | null

  if (!createCheckoutResponse.ok || !checkoutPayload?.id) {
    jsonResponse(res, createCheckoutResponse.status || 500, {
      error:
        checkoutPayload?.message ||
        checkoutPayload?.errors?.[0]?.description ||
        'Não foi possível criar o checkout.',
    })
    return
  }

  const checkoutUrl = `${gatewayConfig.environment === 'sandbox' ? 'https://sandbox.asaas.com' : 'https://asaas.com'}/checkoutSession/show?id=${checkoutPayload.id}`

  const sessionInsert = await adminClient.from('commerce_checkout_sessions').insert({
    id: checkoutSessionId,
    course_id: course.id,
    user_id: resolvedUserId,
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    buyer_document: buyerDocument,
    buyer_phone: buyerPhone,
    buyer_address: buyerAddress,
    buyer_address_number: buyerAddressNumber,
    buyer_address_complement: buyerAddressComplement,
    buyer_postal_code: buyerPostalCode,
    buyer_state: buyerState,
    buyer_province: buyerProvince,
    buyer_city: buyerCity,
    gateway_code: 'asaas',
    gateway_environment: gatewayConfig.environment,
    external_reference_id: checkoutSessionId,
    external_reference: checkoutSessionId,
    external_checkout_id: checkoutPayload.id,
    checkout_url: checkoutUrl,
    status: 'active',
    raw_request: checkoutRequest,
    raw_response: checkoutPayload,
  })

  if (sessionInsert.error) {
    console.error('checkout_session_insert_failed', sessionInsert.error)
    jsonResponse(res, 500, { error: 'Nao foi possivel registrar o pedido antes de enviar ao pagamento.' })
    return
  }

  jsonResponse(res, 200, {
    checkoutUrl,
    checkoutId: checkoutPayload.id,
  })
}
