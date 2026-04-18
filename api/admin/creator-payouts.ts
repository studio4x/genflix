import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getBearerToken, getHeaderValue } from '../_shared/asaas.js'

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

const registerPayoutSchema = z.object({
  action: z.literal('register_paid_payout'),
  creatorId: z.string().uuid('Criador inválido.'),
  commissionIds: z.array(z.string().uuid('Comissão inválida.')).min(1, 'Selecione ao menos uma comissão.'),
  paidAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
})

type AdminContext = {
  adminClient: SupabaseClient
  requesterId: string
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

async function createAdminContext(req: ApiRequest, res: ApiResponse): Promise<AdminContext | null> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração ausente: Supabase URL e service role são obrigatórios.' })
    return null
  }

  const token = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!token) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const userResult = await adminClient.auth.getUser(token)
  if (userResult.error || !userResult.data.user) {
    jsonResponse(res, 401, { error: 'Token inválido ou expirado.' })
    return null
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id)

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'Não foi possível validar as permissões do usuário.' })
    return null
  }

  const roles = ((rolesResult.data as Array<{ roles: { code: string } | { code: string }[] | null }> | null) ?? [])
    .flatMap((relation) => {
      if (!relation.roles) {
        return []
      }

      return Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    })
    .map((role) => role.code)

  if (!roles.includes('admin')) {
    jsonResponse(res, 403, { error: 'Apenas administradores podem gerenciar repasses.' })
    return null
  }

  return {
    adminClient,
    requesterId: userResult.data.user.id,
  }
}

async function handleList(context: AdminContext, res: ApiResponse) {
  const [commissionsResult, payoutsResult, payoutItemsResult, profilesResult, creatorProfilesResult, coursesResult] =
    await Promise.all([
      context.adminClient
        .from('creator_commissions')
        .select('*')
        .order('sale_paid_at', { ascending: false })
        .limit(500),
      context.adminClient
        .from('creator_payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      context.adminClient
        .from('creator_payout_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
      context.adminClient
        .from('profiles')
        .select('id, full_name, email'),
      context.adminClient
        .from('creator_profiles')
        .select('*'),
      context.adminClient
        .from('courses')
        .select('id, title'),
    ])

  const firstError =
    commissionsResult.error ??
    payoutsResult.error ??
    payoutItemsResult.error ??
    profilesResult.error ??
    creatorProfilesResult.error ??
    coursesResult.error

  if (firstError) {
    jsonResponse(res, 500, { error: firstError.message })
    return
  }

  jsonResponse(res, 200, {
    commissions: commissionsResult.data ?? [],
    payouts: payoutsResult.data ?? [],
    payoutItems: payoutItemsResult.data ?? [],
    profiles: profilesResult.data ?? [],
    creatorProfiles: creatorProfilesResult.data ?? [],
    courses: coursesResult.data ?? [],
  })
}

async function handleRegisterPayout(context: AdminContext, req: ApiRequest, res: ApiResponse) {
  const body = parseBody(req.body)
  const parsed = registerPayoutSchema.safeParse(body)

  if (!parsed.success) {
    jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const paidAt = parsed.data.paidAt ?? new Date().toISOString()
  const { data, error } = await context.adminClient.rpc('register_creator_commission_payout', {
    _creator_id: parsed.data.creatorId,
    _commission_ids: Array.from(new Set(parsed.data.commissionIds)),
    _paid_at: paidAt,
    _created_by: context.requesterId,
    _notes: parsed.data.notes?.trim() || null,
  })

  if (error) {
    jsonResponse(res, 400, { error: error.message })
    return
  }

  jsonResponse(res, 200, {
    payoutId: data,
  })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  const context = await createAdminContext(req, res)
  if (!context) {
    return
  }

  if (req.method === 'GET') {
    await handleList(context, res)
    return
  }

  if (req.method === 'POST') {
    await handleRegisterPayout(context, req, res)
    return
  }

  jsonResponse(res, 405, { error: 'Método não permitido.' })
}
