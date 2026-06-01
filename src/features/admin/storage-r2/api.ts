import { supabase } from '@/services/supabase/client'

export type R2BucketUsageRow = {
  name: string
  location: string
  storage_class: string
  jurisdiction: string | null
  creation_date: string
  usage_end: string
  payload_size_bytes: number
  metadata_size_bytes: number
  total_size_bytes: number
  object_count: number
  upload_count: number
  infrequent_access_payload_size_bytes: number
  infrequent_access_metadata_size_bytes: number
  infrequent_access_total_size_bytes: number
  infrequent_access_object_count: number
  infrequent_access_upload_count: number
}

export type R2UsageOverview = {
  account_id: string
  checked_at: string
  bucket_count: number
  buckets: R2BucketUsageRow[]
  totals: {
    payload_size_bytes: number
    metadata_size_bytes: number
    total_size_bytes: number
    object_count: number
    upload_count: number
    infrequent_access_total_size_bytes: number
    infrequent_access_object_count: number
  }
}

export type R2ObjectRow = {
  key: string
  size_bytes: number
  last_modified: string | null
  etag: string | null
}

export type R2ObjectsListResponse = {
  bucket: string
  prefix: string
  checked_at: string
  objects: R2ObjectRow[]
  continuation_token: string | null
}

async function getAuthenticatedEdgeContext() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sess?o expirada. Entre novamente para visualizar o uso do storage.')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configura??o do Supabase ausente no frontend.')
  }

  return { accessToken, supabaseUrl, supabaseAnonKey }
}

export async function fetchR2UsageOverview() {
  const { accessToken, supabaseUrl, supabaseAnonKey } = await getAuthenticatedEdgeContext()

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-r2-usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      access_token: accessToken,
    }),
  })

  const payload = await response.json().catch(() => null) as (R2UsageOverview & { error?: string }) | null
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? 'N?o foi possivel carregar o uso do storage R2.')
  }

  return payload
}

export async function fetchR2Objects(input: {
  bucket: string
  prefix?: string
  continuationToken?: string | null
}) {
  const { accessToken, supabaseUrl, supabaseAnonKey } = await getAuthenticatedEdgeContext()

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-r2-usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      access_token: accessToken,
      action: 'list_objects',
      bucket: input.bucket,
      prefix: input.prefix ?? '',
      continuation_token: input.continuationToken ?? null,
    }),
  })

  const payload = await response.json().catch(() => null) as (R2ObjectsListResponse & { error?: string }) | null
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? 'N?o foi possivel listar arquivos do R2.')
  }

  return payload
}

export async function deleteR2Object(input: { bucket: string; key: string }) {
  const { accessToken, supabaseUrl, supabaseAnonKey } = await getAuthenticatedEdgeContext()

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-r2-usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      access_token: accessToken,
      action: 'delete_object',
      bucket: input.bucket,
      key: input.key,
    }),
  })

  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? 'N?o foi possivel excluir arquivo do R2.')
  }
}
