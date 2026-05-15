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

export async function fetchR2UsageOverview() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Entre novamente para visualizar o uso do storage.')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuracao do Supabase ausente no frontend.')
  }

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
    throw new Error(payload?.error ?? 'Nao foi possivel carregar o uso do storage R2.')
  }

  return payload
}
