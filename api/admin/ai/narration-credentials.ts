import { createClient } from '@supabase/supabase-js'

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

type CredentialLocation = 'supabase' | 'vercel' | 'unavailable'

type CredentialsCheck = {
  key: string
  label: string
  status: 'ok' | 'warning' | 'error'
  detail: string
}

type CredentialsDiagnosticsResponse = {
  location: CredentialLocation
  checkedAt: string
  hasOpenAiKey: boolean
  hasGeminiKey: boolean
  checks: CredentialsCheck[]
}

type CredentialsSaveRequest = {
  openAiApiKey?: string
  geminiApiKey?: string
  targetLocation?: Exclude<CredentialLocation, 'unavailable'>
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function getHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

function getBearerToken(headerValue: string) {
  const match = headerValue.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' })
    return null
  }

  const token = getBearerToken(getHeaderValue(req.headers.authorization) || getHeaderValue(req.headers.Authorization))
  if (!token) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const userResult = await adminClient.auth.getUser(token)
  if (userResult.error || !userResult.data.user) {
    jsonResponse(res, 401, { error: 'Token invalido ou expirado.' })
    return null
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id)

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel validar as permissoes do usuario.' })
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
    jsonResponse(res, 403, { error: 'Apenas administradores podem alterar credenciais de narracao.' })
    return null
  }

  return { userId: userResult.data.user.id }
}

function getSupabaseManagementContext() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = process.env.SUPABASE_PROJECT_REF

  if (!accessToken || !projectRef) {
    return null
  }

  return { accessToken, projectRef }
}

function getVercelManagementContext() {
  const token = process.env.VERCEL_ACCESS_TOKEN ?? process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_ORG_ID

  if (!token || !projectId || !teamId) {
    return null
  }

  return { token, projectId, teamId }
}

async function listSupabaseSecrets(context: { accessToken: string; projectRef: string }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${context.projectRef}/secrets`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Falha ao listar secrets no Supabase: ${message}`)
  }

  const payload = await response.json().catch(() => [])
  const names = Array.isArray(payload)
    ? payload
      .map((item) => (item && typeof item === 'object' ? (item as { name?: unknown }).name : null))
      .filter((name): name is string => typeof name === 'string')
    : []

  return new Set(names)
}

async function upsertSupabaseSecrets(
  context: { accessToken: string; projectRef: string },
  input: { openAiApiKey?: string | null; geminiApiKey?: string | null },
) {
  const updates: Array<{ name: string; value: string }> = []

  if (input.openAiApiKey) {
    updates.push({ name: 'OPENAI_API_KEY', value: input.openAiApiKey })
  }

  if (input.geminiApiKey) {
    updates.push({ name: 'GEMINI_API_KEY', value: input.geminiApiKey })
  }

  if (updates.length === 0) {
    return
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${context.projectRef}/secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Falha ao salvar secrets no Supabase: ${message}`)
  }
}

async function listVercelEnv(context: { token: string; projectId: string; teamId: string }) {
  const response = await fetch(`https://api.vercel.com/v10/projects/${context.projectId}/env?teamId=${context.teamId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Falha ao listar variaveis na Vercel: ${message}`)
  }

  const payload = await response.json().catch(() => ({})) as { envs?: Array<{ key?: string }> }
  const names = (payload.envs ?? [])
    .map((item) => item.key)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)

  return new Set(names)
}

async function upsertVercelEnv(
  context: { token: string; projectId: string; teamId: string },
  input: { openAiApiKey?: string | null; geminiApiKey?: string | null },
) {
  const updates: Array<{ key: string; value: string; type: 'encrypted'; target: Array<'production' | 'preview' | 'development'> }> = []

  if (input.openAiApiKey) {
    updates.push({
      key: 'OPENAI_API_KEY',
      value: input.openAiApiKey,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    })
  }

  if (input.geminiApiKey) {
    updates.push({
      key: 'GEMINI_API_KEY',
      value: input.geminiApiKey,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    })
  }

  if (updates.length === 0) {
    return
  }

  const response = await fetch(`https://api.vercel.com/v10/projects/${context.projectId}/env?upsert=true&teamId=${context.teamId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Falha ao salvar variaveis na Vercel: ${message}`)
  }
}

async function buildDiagnostics(): Promise<CredentialsDiagnosticsResponse> {
  const checks: CredentialsCheck[] = []
  const supabaseContext = getSupabaseManagementContext()
  const vercelContext = getVercelManagementContext()

  let hasOpenAiInSupabase = false
  let hasGeminiInSupabase = false
  let hasOpenAiInVercel = false
  let hasGeminiInVercel = false

  if (supabaseContext) {
    try {
      const names = await listSupabaseSecrets(supabaseContext)
      hasOpenAiInSupabase = names.has('OPENAI_API_KEY')
      hasGeminiInSupabase = names.has('GEMINI_API_KEY')
      checks.push({
        key: 'supabase-management',
        label: 'Gerenciamento Supabase',
        status: 'ok',
        detail: 'Acesso ao Management API ativo para listar e atualizar secrets.',
      })
    } catch (error) {
      checks.push({
        key: 'supabase-management',
        label: 'Gerenciamento Supabase',
        status: 'warning',
        detail: error instanceof Error ? error.message : 'Falha ao acessar secrets do Supabase.',
      })
    }
  } else {
    checks.push({
      key: 'supabase-management',
      label: 'Gerenciamento Supabase',
      status: 'warning',
      detail: 'SUPABASE_ACCESS_TOKEN ou SUPABASE_PROJECT_REF ausente.',
    })
  }

  if (vercelContext) {
    try {
      const names = await listVercelEnv(vercelContext)
      hasOpenAiInVercel = names.has('OPENAI_API_KEY')
      hasGeminiInVercel = names.has('GEMINI_API_KEY')
      checks.push({
        key: 'vercel-management',
        label: 'Gerenciamento Vercel',
        status: 'ok',
        detail: 'Acesso ao projeto Vercel disponivel para leitura de variaveis.',
      })
    } catch (error) {
      checks.push({
        key: 'vercel-management',
        label: 'Gerenciamento Vercel',
        status: 'warning',
        detail: error instanceof Error ? error.message : 'Falha ao acessar variaveis da Vercel.',
      })
    }
  } else {
    checks.push({
      key: 'vercel-management',
      label: 'Gerenciamento Vercel',
      status: 'warning',
      detail: 'VERCEL_TOKEN/VERCEL_ACCESS_TOKEN ou VERCEL_PROJECT_ID/VERCEL_ORG_ID ausente.',
    })
  }

  let location: CredentialLocation = 'unavailable'
  if (hasOpenAiInSupabase || hasGeminiInSupabase) {
    location = 'supabase'
  } else if (hasOpenAiInVercel || hasGeminiInVercel) {
    location = 'vercel'
  } else if (supabaseContext) {
    location = 'supabase'
  } else if (vercelContext) {
    location = 'vercel'
  }

  const hasOpenAiKey = location === 'supabase' ? hasOpenAiInSupabase : hasOpenAiInVercel
  const hasGeminiKey = location === 'supabase' ? hasGeminiInSupabase : hasGeminiInVercel

  if (!hasOpenAiKey && !hasGeminiKey) {
    checks.push({
      key: 'narration-provider',
      label: 'Credenciais de narracao',
      status: 'error',
      detail: 'Nenhuma chave encontrada. Configure ao menos uma IA para gerar narração.',
    })
  } else if (!hasOpenAiKey || !hasGeminiKey) {
    checks.push({
      key: 'narration-provider',
      label: 'Credenciais de narracao',
      status: 'warning',
      detail: 'Apenas uma IA configurada. Recomenda-se manter OpenAI + Gemini para fallback.',
    })
  } else {
    checks.push({
      key: 'narration-provider',
      label: 'Credenciais de narracao',
      status: 'ok',
      detail: 'OpenAI e Gemini configuradas para operacao primária + fallback.',
    })
  }

  return {
    location,
    checkedAt: new Date().toISOString(),
    hasOpenAiKey,
    hasGeminiKey,
    checks,
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const context = await assertAdmin(req, res)
  if (!context) {
    return
  }

  if (req.method === 'GET') {
    const diagnostics = await buildDiagnostics()
    jsonResponse(res, 200, diagnostics)
    return
  }

  const rawBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
  const body = (rawBody ?? {}) as CredentialsSaveRequest
  const openAiApiKey = readOptionalString(body.openAiApiKey)
  const geminiApiKey = readOptionalString(body.geminiApiKey)

  if (!openAiApiKey && !geminiApiKey) {
    jsonResponse(res, 400, { error: 'Informe ao menos uma credencial (OpenAI ou Gemini).' })
    return
  }

  const diagnostics = await buildDiagnostics()
  const targetLocation = body.targetLocation ?? (diagnostics.location === 'unavailable' ? 'supabase' : diagnostics.location)

  if (targetLocation === 'supabase') {
    const supabaseContext = getSupabaseManagementContext()
    if (!supabaseContext) {
      jsonResponse(res, 500, { error: 'Nao foi possivel salvar no Supabase: credenciais de gerenciamento ausentes.' })
      return
    }
    await upsertSupabaseSecrets(supabaseContext, { openAiApiKey, geminiApiKey })
  } else {
    const vercelContext = getVercelManagementContext()
    if (!vercelContext) {
      jsonResponse(res, 500, { error: 'Nao foi possivel salvar na Vercel: credenciais de gerenciamento ausentes.' })
      return
    }
    await upsertVercelEnv(vercelContext, { openAiApiKey, geminiApiKey })
  }

  const nextDiagnostics = await buildDiagnostics()

  jsonResponse(res, 200, {
    ok: true,
    savedBy: context.userId,
    location: targetLocation,
    diagnostics: nextDiagnostics,
  })
}
