import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { sendPasswordResetEmail } from '../_shared/email.js'
import { getPublicAppUrl } from '../_shared/app-url.js'

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

type RecoveryLinkData = {
  properties?: {
    action_link?: string
  } | null
}

const RESET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RESET_RATE_LIMIT_MAX_PER_IP = 10
const RESET_RATE_LIMIT_MAX_PER_EMAIL = 3
const resetRateLimitStore = new Map<string, number[]>()
const RESET_GENERIC_SUCCESS_MESSAGE = 'Se o e-mail existir, enviaremos um link de recuperacao.'

const passwordResetSchema = z.object({
  email: z.string().email('E-mail invalido.'),
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

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]
  }

  return null
}

function getRequestIp(req: ApiRequest) {
  const forwardedFor = getHeaderValue(req.headers['x-forwarded-for'])
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) {
      return firstIp
    }
  }

  const cloudflareIp = getHeaderValue(req.headers['cf-connecting-ip'])
  if (cloudflareIp?.trim()) {
    return cloudflareIp.trim()
  }

  const realIp = getHeaderValue(req.headers['x-real-ip'])
  if (realIp?.trim()) {
    return realIp.trim()
  }

  return 'unknown'
}

function incrementAndCheckRateLimit(key: string, maxRequests: number) {
  const now = Date.now()
  const recentRequests = (resetRateLimitStore.get(key) ?? []).filter((timestamp) => now - timestamp < RESET_RATE_LIMIT_WINDOW_MS)
  recentRequests.push(now)
  resetRateLimitStore.set(key, recentRequests)

  if (resetRateLimitStore.size > 10_000) {
    for (const [storeKey, timestamps] of resetRateLimitStore.entries()) {
      const hasRecentEntry = timestamps.some((timestamp) => now - timestamp < RESET_RATE_LIMIT_WINDOW_MS)
      if (!hasRecentEntry) {
        resetRateLimitStore.delete(storeKey)
      }
    }
  }

  return recentRequests.length > maxRequests
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configura??o do Supabase ausente.')
  }

  return { supabaseUrl, serviceRoleKey }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Metodo n?o permitido.' })
    return
  }

  const parsedBody = parseBody(req.body)
  const validationResult = passwordResetSchema.safeParse({
    email: typeof parsedBody?.email === 'string' ? parsedBody.email.trim().toLowerCase() : undefined,
  })

  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const normalizedEmail = validationResult.data.email
  const requesterIp = getRequestIp(req)
  const ipRateLimitExceeded = incrementAndCheckRateLimit(`ip:${requesterIp}`, RESET_RATE_LIMIT_MAX_PER_IP)
  const emailRateLimitExceeded = incrementAndCheckRateLimit(`email:${normalizedEmail}`, RESET_RATE_LIMIT_MAX_PER_EMAIL)
  if (ipRateLimitExceeded || emailRateLimitExceeded) {
    jsonResponse(res, 200, { message: RESET_GENERIC_SUCCESS_MESSAGE })
    return
  }

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = normalizedEmail
    const redirectTo = `${getPublicAppUrl()}/redefinir-senha`
    const linkResult = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    })

    if (linkResult.error) {
      // Fluxo publico: nao revela se o e-mail existe ou nao.
      jsonResponse(res, 200, { message: RESET_GENERIC_SUCCESS_MESSAGE })
      return
    }

    const linkData = linkResult.data as RecoveryLinkData
    const actionLink = linkData.properties?.action_link

    if (!actionLink) {
      jsonResponse(res, 200, { message: RESET_GENERIC_SUCCESS_MESSAGE })
      return
    }

    const profileResult = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('email', email)
      .maybeSingle()

    await sendPasswordResetEmail({
      to: email,
      fullName: typeof profileResult.data?.full_name === 'string' ? profileResult.data.full_name : null,
      actionLink,
    })

    jsonResponse(res, 200, { message: RESET_GENERIC_SUCCESS_MESSAGE })
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'N?o foi possivel enviar o e-mail de recuperacao.',
    })
  }
}
