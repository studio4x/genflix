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

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuracao do Supabase ausente.')
  }

  return { supabaseUrl, serviceRoleKey }
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

  const parsedBody = parseBody(req.body)
  const validationResult = passwordResetSchema.safeParse({
    email: typeof parsedBody?.email === 'string' ? parsedBody.email.trim().toLowerCase() : undefined,
  })

  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = validationResult.data.email
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
      jsonResponse(res, 200, { message: 'Se o e-mail existir, enviaremos um link de recuperacao.' })
      return
    }

    const linkData = linkResult.data as RecoveryLinkData
    const actionLink = linkData.properties?.action_link

    if (!actionLink) {
      jsonResponse(res, 200, { message: 'Se o e-mail existir, enviaremos um link de recuperacao.' })
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

    jsonResponse(res, 200, { message: 'Se o e-mail existir, enviaremos um link de recuperacao.' })
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Nao foi possivel enviar o e-mail de recuperacao.',
    })
  }
}
