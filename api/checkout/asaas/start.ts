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
  courseId: z.string().uuid('Curso invalido.'),
})

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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao do Supabase ausente.' })
    return
  }

  const body = parseBody(req.body)
  const parsed = startCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const accessToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!accessToken) {
    jsonResponse(res, 401, { error: 'Token ausente ou invalido.' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
  if (userError || !userData.user) {
    jsonResponse(res, 401, { error: 'Token ausente ou invalido.' })
    return
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    jsonResponse(res, 500, { error: 'Nao foi possivel carregar o perfil do usuario.' })
    return
  }

  const { data: course, error: courseError } = await adminClient
    .from('courses')
    .select('id, title, description, status, price_cents, currency, is_public')
    .eq('id', parsed.data.courseId)
    .maybeSingle()

  if (courseError) {
    jsonResponse(res, 500, { error: 'Nao foi possivel carregar o curso.' })
    return
  }

  if (!course || course.status !== 'published' || course.is_public !== true) {
    jsonResponse(res, 404, { error: 'Curso indisponivel para compra.' })
    return
  }

  const priceCents = Number(course.price_cents ?? 0)
  const origin = getRequestOrigin(req)

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
      jsonResponse(res, 500, { error: 'Nao foi possivel liberar o curso gratuito.' })
      return
    }

    jsonResponse(res, 200, {
      checkoutUrl: `${origin}/aluno/cursos/${course.id}`,
      mode: 'free',
    })
    return
  }

  const gatewayConfig = await fetchPaymentGatewayConfiguration(supabaseUrl, serviceRoleKey)
  if (!gatewayConfig.is_active || gatewayConfig.gateway_code !== 'asaas') {
    jsonResponse(res, 400, { error: 'Gateway de pagamento indisponivel.' })
    return
  }

  const asaasToken = getAsaasAccessToken(gatewayConfig.environment ?? 'sandbox')
  if (!asaasToken) {
    jsonResponse(res, 500, { error: 'Chave do Asaas nao configurada para o ambiente ativo.' })
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
      name: profile?.full_name ?? userData.user.user_metadata?.full_name ?? userData.user.email ?? 'Aluno Genflix',
      email: profile?.email ?? userData.user.email,
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
        'Nao foi possivel criar o checkout.',
    })
    return
  }

  const checkoutUrl = `${gatewayConfig.environment === 'sandbox' ? 'https://sandbox.asaas.com' : 'https://asaas.com'}/checkoutSession/show?id=${checkoutPayload.id}`

  const sessionInsert = await adminClient.from('commerce_checkout_sessions').insert({
    id: checkoutSessionId,
    course_id: course.id,
    user_id: userData.user.id,
    buyer_name: profile?.full_name ?? userData.user.user_metadata?.full_name ?? userData.user.email ?? 'Aluno Genflix',
    buyer_email: profile?.email ?? userData.user.email,
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
    jsonResponse(res, 500, { error: 'Nao foi possivel registrar o checkout.' })
    return
  }

  jsonResponse(res, 200, {
    checkoutUrl,
    checkoutId: checkoutPayload.id,
  })
}
