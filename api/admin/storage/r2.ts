import { createClient } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type CloudflareApiEnvelope<T> = {
  success: boolean
  errors?: Array<{ code: number; message: string }>
  messages?: Array<{ code: number; message: string }>
  result: T
}

type CloudflareR2Bucket = {
  name: string
  creation_date: string
  location: string
  storage_class: string
  jurisdiction?: string
}

type CloudflareR2BucketUsage = {
  end: string
  payloadSize: string
  metadataSize: string
  objectCount: string
  uploadCount: string
  infrequentAccessPayloadSize?: string
  infrequentAccessMetadataSize?: string
  infrequentAccessObjectCount?: string
  infrequentAccessUploadCount?: string
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

function getBearerToken(authHeader: string | null) {
  if (!authHeader) {
    return null
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token.trim()
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function toNumber(value: string | undefined) {
  if (!value) {
    return 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCloudflareError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro inesperado ao consultar a API da Cloudflare.'
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
    jsonResponse(res, 403, { error: 'Apenas administradores podem visualizar o uso do storage.' })
    return null
  }

  return { userId: userResult.data.user.id }
}

async function cloudflareRequest<T>(input: {
  accountId: string
  token: string
  path: string
}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${input.accountId}${input.path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
  })

  const payload = await response.json() as CloudflareApiEnvelope<T>
  if (!response.ok || !payload.success) {
    const details = payload.errors?.map((entry) => `${entry.code}: ${entry.message}`).join('; ') ?? 'erro desconhecido'
    throw new Error(`Cloudflare API falhou: ${details}`)
  }

  return payload.result
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const context = await assertAdmin(req, res)
  if (!context) {
    return
  }

  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? ''
  const cloudflareToken = (process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_ACCESS_TOKEN ?? '').trim()

  if (!accountId || !cloudflareToken) {
    jsonResponse(res, 500, {
      error: 'Secrets ausentes para R2 (R2_ACCOUNT_ID e CLOUDFLARE_API_TOKEN).',
    })
    return
  }

  try {
    const bucketList = await cloudflareRequest<{ buckets: CloudflareR2Bucket[] }>({
      accountId,
      token: cloudflareToken,
      path: '/r2/buckets',
    })

    const bucketRows = await Promise.all(
      (bucketList.buckets ?? []).map(async (bucket) => {
        const usage = await cloudflareRequest<CloudflareR2BucketUsage>({
          accountId,
          token: cloudflareToken,
          path: `/r2/buckets/${encodeURIComponent(bucket.name)}/usage`,
        })

        const payloadSizeBytes = toNumber(usage.payloadSize)
        const metadataSizeBytes = toNumber(usage.metadataSize)
        const totalSizeBytes = payloadSizeBytes + metadataSizeBytes
        const objectCount = toNumber(usage.objectCount)
        const uploadCount = toNumber(usage.uploadCount)
        const infrequentAccessPayloadSizeBytes = toNumber(usage.infrequentAccessPayloadSize)
        const infrequentAccessMetadataSizeBytes = toNumber(usage.infrequentAccessMetadataSize)
        const infrequentAccessObjectCount = toNumber(usage.infrequentAccessObjectCount)
        const infrequentAccessUploadCount = toNumber(usage.infrequentAccessUploadCount)

        return {
          name: bucket.name,
          location: bucket.location,
          storage_class: bucket.storage_class,
          jurisdiction: bucket.jurisdiction ?? null,
          creation_date: bucket.creation_date,
          usage_end: usage.end,
          payload_size_bytes: payloadSizeBytes,
          metadata_size_bytes: metadataSizeBytes,
          total_size_bytes: totalSizeBytes,
          object_count: objectCount,
          upload_count: uploadCount,
          infrequent_access_payload_size_bytes: infrequentAccessPayloadSizeBytes,
          infrequent_access_metadata_size_bytes: infrequentAccessMetadataSizeBytes,
          infrequent_access_total_size_bytes: infrequentAccessPayloadSizeBytes + infrequentAccessMetadataSizeBytes,
          infrequent_access_object_count: infrequentAccessObjectCount,
          infrequent_access_upload_count: infrequentAccessUploadCount,
        }
      }),
    )

    const totals = bucketRows.reduce(
      (acc, bucket) => ({
        payload_size_bytes: acc.payload_size_bytes + bucket.payload_size_bytes,
        metadata_size_bytes: acc.metadata_size_bytes + bucket.metadata_size_bytes,
        total_size_bytes: acc.total_size_bytes + bucket.total_size_bytes,
        object_count: acc.object_count + bucket.object_count,
        upload_count: acc.upload_count + bucket.upload_count,
        infrequent_access_total_size_bytes:
          acc.infrequent_access_total_size_bytes + bucket.infrequent_access_total_size_bytes,
        infrequent_access_object_count:
          acc.infrequent_access_object_count + bucket.infrequent_access_object_count,
      }),
      {
        payload_size_bytes: 0,
        metadata_size_bytes: 0,
        total_size_bytes: 0,
        object_count: 0,
        upload_count: 0,
        infrequent_access_total_size_bytes: 0,
        infrequent_access_object_count: 0,
      },
    )

    jsonResponse(res, 200, {
      account_id: accountId,
      checked_at: new Date().toISOString(),
      bucket_count: bucketRows.length,
      buckets: bucketRows,
      totals,
    })
  } catch (error) {
    jsonResponse(res, 500, {
      error: formatCloudflareError(error),
    })
  }
}
