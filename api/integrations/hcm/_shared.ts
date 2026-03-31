import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type RoleRow = {
  id: string
  code: string
}

type ExternalAccessTokenClaims = {
  iss: string
  aud: string
  sub: string
  email?: string
  source_system: string
  external_user_id: string
  external_course_id: string
  external_reference_id?: string | null
  target?: string | null
  redirect_path?: string | null
  jti: string
  iat: number
  exp: number
}

type ResolvedExternalUser = {
  userId: string
  email: string
  created: boolean
}

type ResolvedCourseMapping = {
  courseId: string
  externalCourseId: string
}

export type { ApiRequest, ApiResponse, ExternalAccessTokenClaims, ResolvedExternalUser, ResolvedCourseMapping }

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]
  }

  return null
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf-8')
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Configuracao ausente: ${name}`)
  }
  return value
}

export function createServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function parseBody(rawBody: unknown) {
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)

  return `{${entries.join(',')}}`
}

function createHexHmac(input: string, secret: string) {
  return createHmac('sha256', secret).update(input).digest('hex')
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifySignedIntegrationRequest(req: ApiRequest, parsedBody: Record<string, unknown>) {
  const secret = getRequiredEnv('HCM_INBOUND_HMAC_SECRET')
  const timestamp = getHeaderValue(req.headers['x-hcm-timestamp'])
  const signature = getHeaderValue(req.headers['x-hcm-signature'])
  const requestId = getHeaderValue(req.headers['x-request-id']) ?? randomBytes(8).toString('hex')

  if (!timestamp || !signature) {
    throw new Error('Headers obrigatorios ausentes.')
  }

  const timestampMs = Date.parse(timestamp)
  if (!Number.isFinite(timestampMs)) {
    throw new Error('Timestamp invalido.')
  }

  const driftMs = Math.abs(Date.now() - timestampMs)
  if (driftMs > 5 * 60 * 1000) {
    throw new Error('Requisicao fora da janela de validade.')
  }

  const payloadToSign = `${timestamp}.${stableStringify(parsedBody)}`
  const expectedSignature = createHexHmac(payloadToSign, secret)
  if (!safeEqual(expectedSignature, signature)) {
    throw new Error('Assinatura invalida.')
  }

  return { requestId, timestamp }
}

export function verifyExternalAccessToken(token: string): ExternalAccessTokenClaims {
  const secret = getRequiredEnv('HCM_ACCESS_TOKEN_SECRET')
  const expectedIssuer = process.env.HCM_ACCESS_TOKEN_ISSUER ?? 'homecarematch'
  const expectedAudience = process.env.HCM_ACCESS_TOKEN_AUDIENCE ?? 'homecarematch-lms'

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Token de acesso invalido.')
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string; typ?: string }
  if (header.alg !== 'HS256') {
    throw new Error('Algoritmo de token nao suportado.')
  }

  const expectedSignature = base64UrlEncode(
    createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest(),
  )

  if (!safeEqual(expectedSignature, encodedSignature)) {
    throw new Error('Assinatura do token invalida.')
  }

  const claims = JSON.parse(base64UrlDecode(encodedPayload)) as ExternalAccessTokenClaims
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (claims.iss !== expectedIssuer) {
    throw new Error('Issuer invalido.')
  }

  if (claims.aud !== expectedAudience) {
    throw new Error('Audience invalida.')
  }

  if (!claims.external_user_id || !claims.external_course_id || !claims.jti) {
    throw new Error('Claims obrigatorias ausentes.')
  }

  if (!Number.isFinite(claims.exp) || claims.exp < nowSeconds) {
    throw new Error('Token expirado.')
  }

  return claims
}

export async function writeIntegrationLog(
  adminClient: SupabaseClient,
  payload: {
    source_system: string
    direction: 'inbound' | 'outbound' | 'internal'
    event_type: string
    request_id?: string | null
    correlation_id?: string | null
    user_id?: string | null
    course_id?: string | null
    external_user_id?: string | null
    external_course_id?: string | null
    http_status?: number | null
    status: 'received' | 'processed' | 'failed' | 'ignored'
    payload?: Record<string, unknown> | null
    response_payload?: Record<string, unknown> | null
    error_message?: string | null
  },
) {
  const result = await adminClient.from('integration_logs').insert({
    source_system: payload.source_system,
    direction: payload.direction,
    event_type: payload.event_type,
    request_id: payload.request_id ?? null,
    correlation_id: payload.correlation_id ?? null,
    user_id: payload.user_id ?? null,
    course_id: payload.course_id ?? null,
    external_user_id: payload.external_user_id ?? null,
    external_course_id: payload.external_course_id ?? null,
    http_status: payload.http_status ?? null,
    status: payload.status,
    payload: payload.payload ?? {},
    response_payload: payload.response_payload ?? null,
    error_message: payload.error_message ?? null,
  })

  if (result.error) {
    console.error('Falha ao registrar integration_log:', result.error)
  }
}

function normalizeEmail(email: string | undefined) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function createInternalPassword() {
  return `Hcm#${randomBytes(12).toString('base64url')}9a`
}

async function ensureStudentRole(adminClient: SupabaseClient, userId: string) {
  const studentRoleResult = await adminClient
    .from('roles')
    .select('id, code')
    .eq('code', 'student')
    .maybeSingle()

  if (studentRoleResult.error || !studentRoleResult.data) {
    throw new Error('Role student nao encontrada no LMS.')
  }

  const role = studentRoleResult.data as RoleRow

  const upsertResult = await adminClient.from('user_roles').upsert(
    {
      user_id: userId,
      role_id: role.id,
    },
    {
      onConflict: 'user_id,role_id',
      ignoreDuplicates: true,
    },
  )

  if (upsertResult.error) {
    throw upsertResult.error
  }
}

async function ensureProfile(
  adminClient: SupabaseClient,
  userId: string,
  email: string | null,
  fullName?: string | null,
) {
  const profilePayload: Record<string, unknown> = {
    id: userId,
  }

  if (email?.trim()) {
    profilePayload.email = email.trim().toLowerCase()
  }

  if (typeof fullName === 'string') {
    profilePayload.full_name = fullName.trim() || null
  }

  const result = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (result.error) {
    throw result.error
  }
}

export async function resolveOrCreateExternalUser(
  adminClient: SupabaseClient,
  input: {
    sourceSystem: string
    externalUserId: string
    email?: string
    fullName?: string | null
    externalReferenceId?: string | null
  },
): Promise<ResolvedExternalUser> {
  const normalizedEmail = normalizeEmail(input.email)

  const externalIdentityResult = await adminClient
    .from('external_user_identities')
    .select('user_id, external_email')
    .eq('source_system', input.sourceSystem)
    .eq('external_user_id', input.externalUserId)
    .maybeSingle()

  if (externalIdentityResult.error) {
    throw externalIdentityResult.error
  }

  if (externalIdentityResult.data?.user_id) {
    const userId = externalIdentityResult.data.user_id as string
    const resolvedEmail = normalizedEmail || externalIdentityResult.data.external_email || null

    if (resolvedEmail || input.fullName?.trim()) {
      await ensureProfile(adminClient, userId, resolvedEmail, input.fullName)
    }

    return {
      userId,
      email: resolvedEmail ?? '',
      created: false,
    }
  }

  if (normalizedEmail) {
    const profileResult = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (profileResult.error) {
      throw profileResult.error
    }

    if (profileResult.data?.id) {
      const existingUserId = profileResult.data.id as string

      await ensureStudentRole(adminClient, existingUserId)
      await ensureProfile(adminClient, existingUserId, normalizedEmail, input.fullName)

      const mappingResult = await adminClient.from('external_user_identities').upsert(
        {
          user_id: existingUserId,
          source_system: input.sourceSystem,
          external_user_id: input.externalUserId,
          external_email: normalizedEmail,
          external_reference_id: input.externalReferenceId ?? null,
        },
        { onConflict: 'source_system,external_user_id' },
      )

      if (mappingResult.error) {
        throw mappingResult.error
      }

      return {
        userId: existingUserId,
        email: normalizedEmail,
        created: false,
      }
    }
  }

  if (!normalizedEmail) {
    throw new Error('E-mail obrigatorio para criar usuario no LMS.')
  }

  const createdUserResult = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: createInternalPassword(),
    email_confirm: true,
    user_metadata: input.fullName?.trim() ? { full_name: input.fullName.trim() } : undefined,
  })

  if (createdUserResult.error || !createdUserResult.data.user) {
    throw new Error(createdUserResult.error?.message ?? 'Nao foi possivel criar usuario no LMS.')
  }

  const createdUser = createdUserResult.data.user
  await ensureStudentRole(adminClient, createdUser.id)
  await ensureProfile(adminClient, createdUser.id, normalizedEmail, input.fullName)

  const mappingResult = await adminClient.from('external_user_identities').insert({
    user_id: createdUser.id,
    source_system: input.sourceSystem,
    external_user_id: input.externalUserId,
    external_email: normalizedEmail,
    external_reference_id: input.externalReferenceId ?? null,
  })

  if (mappingResult.error) {
    throw mappingResult.error
  }

  return {
    userId: createdUser.id,
    email: normalizedEmail,
    created: true,
  }
}

export async function resolveCourseByExternalId(
  adminClient: SupabaseClient,
  input: {
    sourceSystem: string
    externalCourseId: string
  },
): Promise<ResolvedCourseMapping> {
  const result = await adminClient
    .from('external_course_mappings')
    .select('course_id, external_course_id, is_active')
    .eq('source_system', input.sourceSystem)
    .eq('external_course_id', input.externalCourseId)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }

  if (!result.data?.course_id || result.data.is_active !== true) {
    throw new Error('Curso externo nao mapeado no LMS.')
  }

  return {
    courseId: result.data.course_id as string,
    externalCourseId: result.data.external_course_id as string,
  }
}

export async function upsertManagedCourseRelease(
  adminClient: SupabaseClient,
  input: {
    sourceSystem: string
    courseId: string
    userId: string
    releaseSource: 'purchase' | 'free_enrollment' | 'integration'
    releaseStatus: 'active' | 'revoked' | 'expired' | 'pending'
    externalReferenceId?: string | null
    startsAt?: string | null
    endsAt?: string | null
    revokedReason?: string | null
  },
) {
  const existingResult = await adminClient
    .from('course_releases')
    .select('id')
    .eq('course_id', input.courseId)
    .eq('user_id', input.userId)
    .eq('release_type', 'user')
    .maybeSingle()

  if (existingResult.error) {
    throw existingResult.error
  }

  const payload = {
    course_id: input.courseId,
    release_type: 'user',
    user_id: input.userId,
    group_id: null,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    is_active: input.releaseStatus === 'active',
    source_system: input.sourceSystem,
    release_source: input.releaseSource,
    release_status: input.releaseStatus,
    external_reference_id: input.externalReferenceId ?? null,
    managed_by_integration: true,
    last_synced_at: new Date().toISOString(),
    revoked_at: input.releaseStatus === 'revoked' ? new Date().toISOString() : null,
    revoked_reason: input.releaseStatus === 'revoked' ? input.revokedReason ?? 'revoked_by_hcm' : null,
  }

  if (existingResult.data?.id) {
    const updateResult = await adminClient
      .from('course_releases')
      .update(payload)
      .eq('id', existingResult.data.id)
      .select('id')
      .single()

    if (updateResult.error) {
      throw updateResult.error
    }

    return updateResult.data.id as string
  }

  const insertResult = await adminClient
    .from('course_releases')
    .insert(payload)
    .select('id')
    .single()

  if (insertResult.error) {
    throw insertResult.error
  }

  return insertResult.data.id as string
}

export async function requireAuthenticatedUser(
  adminClient: SupabaseClient,
  req: ApiRequest,
) {
  const authHeader = getHeaderValue(req.headers.authorization)
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''

  if (!accessToken) {
    throw new Error('Token de sessao ausente.')
  }

  const userResult = await adminClient.auth.getUser(accessToken)
  if (userResult.error || !userResult.data.user) {
    throw new Error('Token de sessao invalido ou expirado.')
  }

  return {
    accessToken,
    user: userResult.data.user,
  }
}

export function buildAppBaseUrl(req: ApiRequest) {
  const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto'])
  const host = getHeaderValue(req.headers.host)
  const fallback = process.env.APP_BASE_URL ?? 'https://cursos.homecarematch.com.br'

  if (!host) {
    return fallback
  }

  return `${forwardedProto ?? 'https'}://${host}`
}

export function getCronAuthorizationToken(req: ApiRequest) {
  const authHeader = getHeaderValue(req.headers.authorization)
  return authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
}
