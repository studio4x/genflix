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
  if (!accessToken) {
    jsonResponse(res, 401, { error: 'Token ausente ou inválido.' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
  if (userError || !userData.user) {
    jsonResponse(res, 401, { error: 'Token ausente ou inválido.' })
    return
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userData.user.id)
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
  const buyerName =
    normalizeOptionalText(parsed.data.buyerName) ??
    normalizeOptionalText(profile?.full_name) ??
    normalizeOptionalText(userData.user.user_metadata?.full_name as string | undefined) ??
    normalizeOptionalText(userData.user.email) ??
    'Aluno GenFlix'
  const buyerEmail =
    normalizeOptionalText(parsed.data.buyerEmail) ??
    normalizeOptionalText(profile?.email) ??
    normalizeOptionalText(userData.user.email)

  if (!buyerEmail) {
    jsonResponse(res, 400, { error: 'Informe um e-mail válido para iniciar o checkout.' })
    return
  }

  if (priceCents <= 0) {
    const releaseResult = await adminClient
      .from('course_releases')
      .upsert(
        {
          course_id: course.id,
          release_type: 'user',
          user_id: userData.user.id,
          group_id: null,
          starts_at: null,
          ends_at: null,
          is_active: true,
          created_by: userData.user.id,
          release_source: 'purchase',
          release_status: 'active',
          source_system: 'asaas',
          external_reference_id: `free-${course.id}-${userData.user.id}`,
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
      userId: userData.user.id,
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
  const checkoutRequest = {
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['DETACHED'],
    minutesToExpire: 1440,
    externalReference: checkoutSessionId,
    callback: {
      successUrl: `${origin}/aluno/cursos/${course.id}?checkout=success`,
      cancelUrl: `${origin}/aluno/cursos/${course.id}?checkout=cancel`,
      expiredUrl: `${origin}/aluno/cursos/${course.id}?checkout=expired`,
    },
    items: [
      {
        name: course.title,
        description: course.description?.replace(/<[^>]*>?/gm, ' ').trim() || course.title,
        quantity: 1,
        value: priceCents / 100,
      },
    ],
    customerData: {
      name: buyerName,
      email: buyerEmail,
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
    user_id: userData.user.id,
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    gateway_code: 'asaas',
    gateway_environment: gatewayConfig.environment,
    external_reference: checkoutSessionId,
    external_checkout_id: checkoutPayload.id,
    checkout_url: checkoutUrl,
    status: 'active',
    raw_request: checkoutRequest,
    raw_response: checkoutPayload,
  })

  if (sessionInsert.error) {
    jsonResponse(res, 500, { error: 'Não foi possível registrar o checkout.' })
    return
  }

  jsonResponse(res, 200, {
    checkoutUrl,
    checkoutId: checkoutPayload.id,
  })
}
