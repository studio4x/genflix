import { createClient } from '@supabase/supabase-js'

import { env } from '@/config/env'

function createNoCacheFetch() {
  return (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
    ...init,
    cache: 'no-store',
    headers: (() => {
      const headers = new Headers(init?.headers)
      headers.set('cache-control', 'no-store, max-age=0')
      headers.set('pragma', 'no-cache')
      return headers
    })(),
  })
}

export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      fetch: createNoCacheFetch(),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
