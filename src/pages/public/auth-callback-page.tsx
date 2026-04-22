import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { supabase } from '@/services/supabase/client'
import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import { GenflixAuthLayout } from '@/components/public/genflix-auth-layout'
import { genflixHeroImage } from '@/features/public/genflix-public-media'
import type { RoleCode } from '@/types/auth'

type CallbackState = 'loading' | 'success' | 'error'
const KNOWN_ROLE_CODES = new Set<RoleCode>(['admin', 'student', 'aluno', 'professor', 'criador'])

async function loadCallbackRoles(userId: string) {
  const result = await supabase
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userId)

  if (result.error) {
    return []
  }

  return ((result.data ?? []) as Array<{ roles: { code: string } | { code: string }[] | null }>)
    .flatMap((item) => {
      if (!item.roles) return []
      return Array.isArray(item.roles) ? item.roles : [item.roles]
    })
    .map((role) => role.code)
    .filter((code): code is RoleCode => KNOWN_ROLE_CODES.has(code as RoleCode))
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { roles, refreshProfile } = useAuth()
  const [state, setState] = useState<CallbackState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function handleCallback() {
      const sessionResult = await supabase.auth.getSession()

      if (sessionResult.error || !sessionResult.data.session) {
        if (!isMounted) return
        setState('error')
        setError('Link expirado ou inválido. Solicite um novo link de acesso.')
        return
      }

      await refreshProfile().catch(() => undefined)
      const callbackRoles = await loadCallbackRoles(sessionResult.data.session.user.id)

      if (!isMounted) return
      setState('success')

      window.setTimeout(() => {
        navigate(getDashboardPathForRoles(callbackRoles.length > 0 ? callbackRoles : roles), { replace: true })
      }, 700)
    }

    void handleCallback()

    return () => {
      isMounted = false
    }
  }, [navigate, refreshProfile, roles])

  return (
    <GenflixAuthLayout
      entryPrefix="global.auth.callback"
      title="Validando acesso"
      subtitle="Estamos conferindo seu link mágico da GenFlix."
      imageUrl={genflixHeroImage}
    >
      <div className="rounded-[30px] border border-[#D8E6EB] bg-[#F2F7F9] p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#1398B7] shadow-sm">
          {state === 'loading' ? <Loader2 className="h-8 w-8 animate-spin" /> : null}
          {state === 'success' ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : null}
          {state === 'error' ? <MailWarning className="h-8 w-8 text-rose-600" /> : null}
        </div>

        <h1 className="mt-5 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
          {state === 'loading' ? 'Verificando link...' : null}
          {state === 'success' ? 'Acesso confirmado' : null}
          {state === 'error' ? 'Não foi possível entrar' : null}
        </h1>

        <p className="mt-3 text-sm font-medium leading-6 text-[#5f7077]">
          {state === 'loading' ? 'Isso leva só alguns segundos.' : null}
          {state === 'success' ? 'Vamos abrir seu painel automaticamente.' : null}
          {state === 'error' ? error : null}
        </p>

        {state === 'error' ? (
          <GenflixCtaButton asChild className="mt-6">
            <Link to="/login">Voltar para login</Link>
          </GenflixCtaButton>
        ) : null}
      </div>
    </GenflixAuthLayout>
  )
}
