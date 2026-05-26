import { createClient } from '@supabase/supabase-js'

import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getAsaasBaseUrl,
  getBearerToken,
  getConfiguredAsaasWebhookSecrets,
  getHeaderValue,
} from '../../_shared/asaas.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type DiagnosticStatus = 'ok' | 'warning' | 'error'

type DiagnosticCheck = {
  key: string
  label: string
  status: DiagnosticStatus
  detail: string
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
  openAiApiKey?: string | null
  geminiApiKey?: string | null
  checks: CredentialsCheck[]
}

type SessionRow = {
  id: string
  external_payment_id: string | null
  gateway_environment: 'sandbox' | 'production' | null
  checkout_url: string | null
  raw_response: Record<string, unknown> | null
}

type NarrationCredentialsRow = {
  openai_api_key: string | null
  gemini_api_key: string | null
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function hasEnvironmentToken(environment: 'sandbox' | 'production') {
  if (environment === 'sandbox') {
    return Boolean(process.env.ASAAS_ACCESS_TOKEN_SANDBOX ?? process.env.ASAAS_ACCESS_TOKEN)
  }

  return Boolean(process.env.ASAAS_ACCESS_TOKEN_PRODUCTION ?? process.env.ASAAS_ACCESS_TOKEN)
}

function hasEnvironmentWebhookSecret(environment: 'sandbox' | 'production') {
  if (environment === 'sandbox') {
    return Boolean(process.env.ASAAS_WEBHOOK_SECRET_SANDBOX ?? process.env.ASAAS_WEBHOOK_SECRET)
  }

  return Boolean(process.env.ASAAS_WEBHOOK_SECRET_PRODUCTION ?? process.env.ASAAS_WEBHOOK_SECRET)
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readNestedString(source: Record<string, unknown> | null, path: string[]) {
  let cursor: unknown = source
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') {
      return null
    }
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return readString(cursor)
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
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

async function listSupabaseSecretsDetailed(context: { accessToken: string; projectRef: string }) {
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
  const rows = Array.isArray(payload)
    ? payload
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }
        const record = item as { name?: unknown; value?: unknown }
        if (typeof record.name !== 'string') {
          return null
        }
        return {
          name: record.name,
          value: typeof record.value === 'string' ? record.value : null,
        }
      })
      .filter((entry): entry is { name: string; value: string | null } => Boolean(entry))
    : []

  return rows
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

async function buildNarrationCredentialsDiagnostics(): Promise<CredentialsDiagnosticsResponse> {
  const checks: CredentialsCheck[] = []
  const supabaseContext = getSupabaseManagementContext()
  const vercelContext = getVercelManagementContext()

  let hasOpenAiInSupabase = false
  let hasGeminiInSupabase = false
  let hasOpenAiInVercel = false
  let hasGeminiInVercel = false
  let openAiApiKeyFromSupabase: string | null = null
  let geminiApiKeyFromSupabase: string | null = null
  let openAiApiKeyFromDatabase: string | null = null
  let geminiApiKeyFromDatabase: string | null = null

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceRoleKey) {
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const credentialsResult = await adminClient
        .from('narration_ai_credentials')
        .select('openai_api_key, gemini_api_key')
        .eq('id', true)
        .maybeSingle()

      const row = (credentialsResult.data ?? null) as NarrationCredentialsRow | null
      openAiApiKeyFromDatabase = readOptionalString(row?.openai_api_key)
      geminiApiKeyFromDatabase = readOptionalString(row?.gemini_api_key)
    } catch {
      // noop: fallback para management APIs abaixo
    }
  }

  if (supabaseContext) {
    try {
      const secrets = await listSupabaseSecretsDetailed(supabaseContext)
      const names = new Set(secrets.map((entry) => entry.name))
      hasOpenAiInSupabase = names.has('OPENAI_API_KEY')
      hasGeminiInSupabase = names.has('GEMINI_API_KEY')
      openAiApiKeyFromSupabase = secrets.find((entry) => entry.name === 'OPENAI_API_KEY')?.value ?? null
      geminiApiKeyFromSupabase = secrets.find((entry) => entry.name === 'GEMINI_API_KEY')?.value ?? null
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

  const hasOpenAiInDatabase = Boolean(openAiApiKeyFromDatabase)
  const hasGeminiInDatabase = Boolean(geminiApiKeyFromDatabase)

  let location: CredentialLocation = 'unavailable'
  if (hasOpenAiInDatabase || hasGeminiInDatabase) {
    location = 'supabase'
  } else if (hasOpenAiInSupabase || hasGeminiInSupabase) {
    location = 'supabase'
  } else if (hasOpenAiInVercel || hasGeminiInVercel) {
    location = 'vercel'
  } else if (supabaseContext) {
    location = 'supabase'
  } else if (vercelContext) {
    location = 'vercel'
  }

  const hasOpenAiKey = location === 'supabase'
    ? (hasOpenAiInDatabase || hasOpenAiInSupabase)
    : hasOpenAiInVercel
  const hasGeminiKey = location === 'supabase'
    ? (hasGeminiInDatabase || hasGeminiInSupabase)
    : hasGeminiInVercel

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
    openAiApiKey: location === 'supabase' ? (openAiApiKeyFromDatabase ?? openAiApiKeyFromSupabase) : null,
    geminiApiKey: location === 'supabase' ? (geminiApiKeyFromDatabase ?? geminiApiKeyFromSupabase) : null,
    checks,
  }
}

async function handleNarrationCredentialsScope(
  req: ApiRequest,
  res: ApiResponse,
  context: NonNullable<Awaited<ReturnType<typeof assertAdmin>>>,
) {
  if (req.method === 'GET') {
    const diagnostics = await buildNarrationCredentialsDiagnostics()
    jsonResponse(res, 200, diagnostics)
    return
  }

  const rawBody = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as {
    openAiApiKey?: string
    geminiApiKey?: string
    targetLocation?: 'supabase' | 'vercel'
  }

  const openAiApiKey = readOptionalString(rawBody?.openAiApiKey)
  const geminiApiKey = readOptionalString(rawBody?.geminiApiKey)

  if (!openAiApiKey && !geminiApiKey) {
    jsonResponse(res, 400, { error: 'Informe ao menos uma credencial (OpenAI ou Gemini).' })
    return
  }

  const diagnostics = await buildNarrationCredentialsDiagnostics()
  const targetLocation = rawBody?.targetLocation ?? (diagnostics.location === 'unavailable' ? 'supabase' : diagnostics.location)

  const currentCredentialsResult = await context.adminClient
    .from('narration_ai_credentials')
    .select('openai_api_key, gemini_api_key')
    .eq('id', true)
    .maybeSingle()
  const currentCredentials = (currentCredentialsResult.data ?? null) as NarrationCredentialsRow | null

  await context.adminClient
    .from('narration_ai_credentials')
    .upsert({
      id: true,
      openai_api_key: openAiApiKey ?? currentCredentials?.openai_api_key ?? null,
      gemini_api_key: geminiApiKey ?? currentCredentials?.gemini_api_key ?? null,
      updated_by: context.userId,
    }, { onConflict: 'id' })

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

  const nextDiagnostics = await buildNarrationCredentialsDiagnostics()
  jsonResponse(res, 200, {
    ok: true,
    location: targetLocation,
    diagnostics: nextDiagnostics,
  })
}

async function resolveInvoiceUrlFromAsaas(input: {
  paymentId: string
  environment: 'sandbox' | 'production'
  accessToken: string
}) {
  const response = await fetch(`${getAsaasBaseUrl(input.environment)}/v3/payments/${input.paymentId}`, {
    method: 'GET',
    headers: {
      access_token: input.accessToken,
    },
  })

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload) {
    return null
  }

  return (
    readString(payload.invoiceUrl) ??
    readString(payload.bankSlipUrl) ??
    readString(payload.transactionReceiptUrl) ??
    null
  )
}

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao ausente: Supabase URL e service role sao obrigatorios.' })
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
    jsonResponse(res, 403, { error: 'Apenas administradores podem diagnosticar pagamentos.' })
    return null
  }

  return { supabaseUrl, serviceRoleKey, adminClient, userId: userResult.data.user.id }
}

async function handleResolveInvoiceUrl(req: ApiRequest, res: ApiResponse, context: NonNullable<Awaited<ReturnType<typeof assertAdmin>>>) {
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as { sessionId?: string }
  const sessionId = readString(body?.sessionId)

  if (!sessionId) {
    jsonResponse(res, 400, { error: 'sessionId obrigatorio.' })
    return
  }

  const sessionResult = await context.adminClient
    .from('commerce_checkout_sessions')
    .select('id, external_payment_id, gateway_environment, checkout_url, raw_response')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel carregar o pedido.' })
    return
  }

  const session = (sessionResult.data ?? null) as SessionRow | null
  if (!session) {
    jsonResponse(res, 404, { error: 'Pedido nao encontrado.' })
    return
  }

  const paymentId = readString(session.external_payment_id)
  const environment = session.gateway_environment ?? (await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)).environment ?? 'sandbox'
  const asaasToken = getAsaasAccessToken(environment)

  if (paymentId && asaasToken) {
    const invoiceUrl = await resolveInvoiceUrlFromAsaas({ paymentId, environment, accessToken: asaasToken })
    if (invoiceUrl) {
      jsonResponse(res, 200, { url: invoiceUrl, source: 'asaas-payment' })
      return
    }
  }

  const rawResponse = session.raw_response ?? {}
  const fallbackUrl = (
    readNestedString(rawResponse, ['payment', 'invoiceUrl']) ??
    readNestedString(rawResponse, ['invoiceUrl']) ??
    readNestedString(rawResponse, ['payment', 'bankSlipUrl']) ??
    readNestedString(rawResponse, ['bankSlipUrl']) ??
    readNestedString(rawResponse, ['payment', 'transactionReceiptUrl']) ??
    readNestedString(rawResponse, ['transactionReceiptUrl']) ??
    session.checkout_url
  )

  if (!fallbackUrl) {
    jsonResponse(res, 404, { error: 'Fatura nao disponivel para este pedido.' })
    return
  }

  jsonResponse(res, 200, { url: fallbackUrl, source: 'session-fallback' })
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

  const scope = getHeaderValue(req.query?.scope)
  if (scope === 'narration-ai') {
    await handleNarrationCredentialsScope(req, res, context)
    return
  }

  if (req.method === 'POST') {
    await handleResolveInvoiceUrl(req, res, context)
    return
  }

  const checks: DiagnosticCheck[] = [
    {
      key: 'supabase-service-role',
      label: 'Service role do Supabase',
      status: 'ok',
      detail: 'Variavel disponivel no ambiente do deploy.',
    },
  ]

  try {
    const gatewayConfig = await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)
    const activeEnvironment = gatewayConfig.environment ?? 'sandbox'
    const asaasToken = getAsaasAccessToken(activeEnvironment)
    const webhookSecrets = getConfiguredAsaasWebhookSecrets()
    const hasSandboxToken = hasEnvironmentToken('sandbox')
    const hasProductionToken = hasEnvironmentToken('production')
    const hasSandboxWebhookSecret = hasEnvironmentWebhookSecret('sandbox')
    const hasProductionWebhookSecret = hasEnvironmentWebhookSecret('production')

    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas' ? 'ok' : 'error',
      detail:
        gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas'
          ? `Asaas ativo em ${activeEnvironment}.`
          : 'Gateway inativo ou diferente de Asaas.',
    })

    checks.push({
      key: 'asaas-active-token',
      label: `Token Asaas do ambiente ativo (${activeEnvironment})`,
      status: asaasToken ? 'ok' : 'error',
      detail: asaasToken
        ? 'Token encontrado no ambiente do deploy.'
        : `Configure ASAAS_ACCESS_TOKEN_${activeEnvironment.toUpperCase()} ou ASAAS_ACCESS_TOKEN.`,
    })

    checks.push({
      key: 'asaas-sandbox-token',
      label: 'Token Asaas sandbox',
      status: hasSandboxToken ? 'ok' : activeEnvironment === 'sandbox' ? 'error' : 'warning',
      detail: hasSandboxToken
        ? 'Credencial sandbox disponivel para testes controlados.'
        : 'Configure ASAAS_ACCESS_TOKEN_SANDBOX antes de validar compras e repasses em sandbox.',
    })

    checks.push({
      key: 'asaas-production-token',
      label: 'Token Asaas producao',
      status: hasProductionToken ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasProductionToken
        ? 'Credencial de producao disponivel para operacao real.'
        : 'Producao ainda pendente. Configure ASAAS_ACCESS_TOKEN_PRODUCTION quando a conta Asaas final estiver aprovada.',
    })

    checks.push({
      key: 'webhook-secret',
      label: 'Segredo do webhook',
      status: webhookSecrets.length > 0 ? 'ok' : 'warning',
      detail: webhookSecrets.length > 0
        ? 'Webhook com segredo configurado para pelo menos um ambiente do Asaas.'
        : 'Webhook sem segredo dedicado. Funciona, mas recomenda-se configurar ASAAS_WEBHOOK_SECRET.',
    })

    checks.push({
      key: 'webhook-secret-sandbox',
      label: 'Segredo do webhook sandbox',
      status: hasSandboxWebhookSecret ? 'ok' : activeEnvironment === 'sandbox' ? 'error' : 'warning',
      detail: hasSandboxWebhookSecret
        ? 'Segredo do webhook sandbox disponivel.'
        : 'Configure ASAAS_WEBHOOK_SECRET_SANDBOX antes de validar callbacks em sandbox.',
    })

    checks.push({
      key: 'webhook-secret-production',
      label: 'Segredo do webhook producao',
      status: hasProductionWebhookSecret ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasProductionWebhookSecret
        ? 'Segredo do webhook producao disponivel.'
        : 'Configure ASAAS_WEBHOOK_SECRET_PRODUCTION ou ASAAS_WEBHOOK_SECRET para callbacks de producao.',
    })

    checks.push({
      key: 'public-url',
      label: 'URL publica do app',
      status: process.env.APP_PUBLIC_URL || process.env.VERCEL_URL ? 'ok' : 'warning',
      detail: process.env.APP_PUBLIC_URL
        ? `APP_PUBLIC_URL configurada: ${process.env.APP_PUBLIC_URL}.`
        : 'APP_PUBLIC_URL nao configurada. O sistema usara a origem da requisicao para montar callbacks e webhook.',
    })

    jsonResponse(res, 200, {
      environment: activeEnvironment,
      checkedAt: new Date().toISOString(),
      checks,
    })
  } catch (error) {
    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Nao foi possivel carregar a configuracao do gateway.',
    })

    jsonResponse(res, 200, {
      environment: null,
      checkedAt: new Date().toISOString(),
      checks,
    })
  }
}
