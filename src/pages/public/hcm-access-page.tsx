import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { supabase } from '@/services/supabase/client'
import { AuthShell } from '@/pages/public/auth-shell'

type AccessState = 'resolving' | 'error'

export function HcmAccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<AccessState>('resolving')
  const [message, setMessage] = useState('Validando seu acesso ao curso...')

  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams])
  const phase = useMemo(() => searchParams.get('phase') ?? '', [searchParams])
  const nonceState = useMemo(() => searchParams.get('state') ?? '', [searchParams])

  useEffect(() => {
    let isMounted = true

    async function resolveInitialAccess() {
      const sessionResult = await supabase.auth.getSession()
      const currentAccessToken = sessionResult.data.session?.access_token ?? null

      const response = await fetch('/api/integrations/hcm/access/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          access_token: currentAccessToken,
        }),
      })

      const payload = await response.json().catch(() => null) as
        | { mode?: 'direct' | 'magic_link'; redirect_url?: string; error?: string }
        | null

      if (!response.ok || !payload?.redirect_url) {
        throw new Error(payload?.error ?? 'Nao foi possivel iniciar seu acesso ao curso.')
      }

      window.location.replace(payload.redirect_url)
    }

    async function finalizeAccess() {
      setMessage('Finalizando sua entrada no LMS...')

      let sessionResult = await supabase.auth.getSession()
      if (!sessionResult.data.session) {
        const refreshResult = await supabase.auth.refreshSession()
        if (refreshResult.error) {
          throw refreshResult.error
        }
        sessionResult = await supabase.auth.getSession()
      }

      const accessToken = sessionResult.data.session?.access_token
      if (!accessToken) {
        throw new Error('Sua sessao no LMS nao foi criada. Gere um novo acesso pela HomeCare Match.')
      }

      const response = await fetch('/api/integrations/hcm/access/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          state: nonceState,
        }),
      })

      const payload = await response.json().catch(() => null) as { redirect_url?: string; error?: string } | null
      if (!response.ok || !payload?.redirect_url) {
        throw new Error(payload?.error ?? 'Nao foi possivel concluir seu acesso ao curso.')
      }

      navigate(payload.redirect_url, { replace: true })
    }

    async function run() {
      try {
        if (phase === 'complete') {
          if (!nonceState) {
            throw new Error('Estado de acesso ausente.')
          }
          await finalizeAccess()
          return
        }

        if (!token) {
          throw new Error('Token de acesso ausente.')
        }

        await resolveInitialAccess()
      } catch (error) {
        if (!isMounted) {
          return
        }
        setState('error')
        setMessage(error instanceof Error ? error.message : 'Falha ao acessar este curso.')
      }
    }

    void run()

    return () => {
      isMounted = false
    }
  }, [navigate, nonceState, phase, token])

  return (
    <AuthShell
      title="Acesso ao Curso"
      subtitle="Estamos conectando sua sessao da HomeCare Match com a plataforma de cursos."
    >
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${state === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
            {state === 'error' ? (
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-10 w-10 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className={`text-base font-medium leading-8 ${state === 'error' ? 'text-rose-700' : 'text-slate-600'}`}>
            {message}
          </p>
          {state === 'resolving' ? (
            <p className="text-sm font-medium text-slate-400">
              Isso pode levar alguns segundos enquanto validamos seu acesso.
            </p>
          ) : null}
        </div>

        {state === 'error' ? (
          <div className="flex flex-col items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#1473ff] px-6 text-sm font-black text-white shadow-[0_14px_35px_rgba(20,115,255,0.22)] transition hover:bg-[#1067e6]"
            >
              Voltar para a plataforma
            </Link>
            <p className="text-sm font-medium text-slate-500">
              Se o problema persistir, gere um novo acesso na HomeCare Match.
            </p>
          </div>
        ) : null}
      </div>
    </AuthShell>
  )
}
