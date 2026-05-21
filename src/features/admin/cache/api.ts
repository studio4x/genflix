import { supabase } from '@/services/supabase/client'

type AdminClearServerCacheResponse = {
  ok?: boolean
  error?: string
  refreshed_at?: string
}

async function getAuthenticatedEdgeContext() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Entre novamente para limpar o cache.')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuracao do Supabase ausente no frontend.')
  }

  return { accessToken, supabaseUrl, supabaseAnonKey }
}

export async function clearServerCache() {
  const { accessToken, supabaseUrl, supabaseAnonKey } = await getAuthenticatedEdgeContext()

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-clear-cache`, {
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

  const payload = await response.json().catch(() => null) as AdminClearServerCacheResponse | null
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? 'Nao foi possivel limpar o cache do servidor.')
  }
}

export async function clearBrowserCache() {
  try {
    localStorage.clear()
  } catch {
    // noop
  }

  try {
    sessionStorage.clear()
  } catch {
    // noop
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }

  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>
  }

  if (typeof indexedDB !== 'undefined' && typeof indexedDbWithDatabases.databases === 'function') {
    try {
      const databases = await indexedDbWithDatabases.databases()
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter((name): name is string => Boolean(name))
          .map((name) => new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name)
            request.onsuccess = () => resolve()
            request.onerror = () => resolve()
            request.onblocked = () => resolve()
          })),
      )
    } catch {
      // noop
    }
  }
}
