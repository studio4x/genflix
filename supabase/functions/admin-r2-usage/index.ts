import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CloudflareApiEnvelope<T> = {
  success: boolean
  errors?: Array<{ code: number; message: string }>
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido.' }, 405)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const accessToken = getAccessToken(request, body)
    if (!accessToken) {
      return jsonResponse({ error: 'Token de acesso ausente.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Configuracao ausente do Supabase.' }, 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return jsonResponse({ error: 'Token invalido ou expirado.' }, 401)
    }

    const roleCheck = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role_code: 'admin',
    })
    if (roleCheck.error) {
      return jsonResponse({ error: 'Falha ao validar perfil de administrador.' }, 500)
    }
    if (!roleCheck.data) {
      return jsonResponse({ error: 'Apenas administradores podem visualizar o uso do storage.' }, 403)
    }

    const accountId = (Deno.env.get('R2_ACCOUNT_ID') ?? '').trim()
    const cloudflareToken = (Deno.env.get('CLOUDFLARE_API_TOKEN') ?? Deno.env.get('CLOUDFLARE_ACCESS_TOKEN') ?? '').trim()
    if (!accountId || !cloudflareToken) {
      return jsonResponse({ error: 'Secrets ausentes para R2 (R2_ACCOUNT_ID e CLOUDFLARE_API_TOKEN).' }, 500)
    }

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
        const infrequentAccessPayloadSizeBytes = toNumber(usage.infrequentAccessPayloadSize)
        const infrequentAccessMetadataSizeBytes = toNumber(usage.infrequentAccessMetadataSize)

        return {
          name: bucket.name,
          location: bucket.location,
          storage_class: bucket.storage_class,
          jurisdiction: bucket.jurisdiction ?? null,
          creation_date: bucket.creation_date,
          usage_end: usage.end,
          payload_size_bytes: payloadSizeBytes,
          metadata_size_bytes: metadataSizeBytes,
          total_size_bytes: payloadSizeBytes + metadataSizeBytes,
          object_count: toNumber(usage.objectCount),
          upload_count: toNumber(usage.uploadCount),
          infrequent_access_payload_size_bytes: infrequentAccessPayloadSizeBytes,
          infrequent_access_metadata_size_bytes: infrequentAccessMetadataSizeBytes,
          infrequent_access_total_size_bytes: infrequentAccessPayloadSizeBytes + infrequentAccessMetadataSizeBytes,
          infrequent_access_object_count: toNumber(usage.infrequentAccessObjectCount),
          infrequent_access_upload_count: toNumber(usage.infrequentAccessUploadCount),
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

    return jsonResponse({
      account_id: accountId,
      checked_at: new Date().toISOString(),
      bucket_count: bucketRows.length,
      buckets: bucketRows,
      totals,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao consultar a Cloudflare.'
    return jsonResponse({ error: message }, 500)
  }
})

function getAccessToken(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get('Authorization')
  const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const accessTokenFromBody = typeof body?.access_token === 'string' ? body.access_token.trim() : ''
  return accessTokenFromBody || accessTokenFromHeader
}

function toNumber(value: string | undefined) {
  if (!value) {
    return 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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

  const payload = (await response.json()) as CloudflareApiEnvelope<T>
  if (!response.ok || !payload.success) {
    const details = payload.errors?.map((entry) => `${entry.code}: ${entry.message}`).join('; ') ?? 'erro desconhecido'
    throw new Error(`Cloudflare API falhou: ${details}`)
  }

  return payload.result
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
