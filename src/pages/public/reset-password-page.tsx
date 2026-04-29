import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PasswordField } from '@/components/forms/password-field'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixAuthLayout } from '@/components/public/genflix-auth-layout'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import { hasPasswordRecoveryUrl } from '@/features/auth/password-recovery-state'
import { genflixHeroImage } from '@/features/public/genflix-public-media'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const {
    completePasswordRecovery,
    isPasswordRecoverySession,
    user,
    roles,
    isLoading,
  } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRecoveryLinkExpired, setIsRecoveryLinkExpired] = useState(false)

  const waitingRoleResolution = !!user && roles.length === 0
  const hasMinimumLength = useMemo(() => password.length >= 8, [password])
  const hasRecoveryContext = isPasswordRecoverySession || hasPasswordRecoveryUrl()
  const isResolvingRecoverySession = hasRecoveryContext && !user && !isRecoveryLinkExpired

  useEffect(() => {
    if (!hasRecoveryContext || user || isLoading) {
      setIsRecoveryLinkExpired(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsRecoveryLinkExpired(true)
    }, 8000)

    return () => window.clearTimeout(timeoutId)
  }, [hasRecoveryContext, isLoading, user])

  if (isLoading || waitingRoleResolution || isResolvingRecoverySession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <div className="max-w-md rounded-[10px] border border-white/12 bg-white/8 p-6 text-center shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">
            Validando link de redefinição
          </p>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Estamos ativando sua sessão segura para você definir a nova senha.
          </p>
        </div>
      </main>
    )
  }

  if (user && !hasRecoveryContext) {
    return <Navigate to={getDashboardPathForRoles(roles)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!hasMinimumLength) {
      setError('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)

    try {
      await completePasswordRecovery(password)
      setMessage('Senha redefinida com sucesso!')
      setPassword('')
      setConfirmPassword('')
      window.setTimeout(() => {
        navigate(getDashboardPathForRoles(roles), { replace: true })
      }, 300)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao redefinir senha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <GenflixAuthLayout
      entryPrefix="global.auth.resetPassword"
      title="Redefinir senha"
      subtitle="Finalize a recuperação para acessar sua conta GenFlix."
      imageUrl={genflixHeroImage}
    >
      {!user ? (
        <div className="rounded-[28px] border border-cyan-200 bg-cyan-50 px-5 py-5 text-[#0A3640]">
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Link inválido ou expirado</h2>
          <p className="mt-3 text-sm font-medium leading-6">
            Abra o link mais recente enviado ao seu e-mail ou solicite uma nova recuperação de senha.
          </p>
          <GenflixCtaButton asChild className="mt-5">
            <Link to="/recuperar-senha">Solicitar novo link</Link>
          </GenflixCtaButton>
        </div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10242b]/72 p-4 backdrop-blur-sm">
          <form
            className="w-full max-w-[520px] rounded-[34px] border border-[#D8E6EB] bg-[#F2F7F9] p-6 shadow-[0_28px_90px_rgba(16,36,43,0.32)] sm:p-8"
            onSubmit={handleSubmit}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                {message ? <CheckCircle2 className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#1398B7]">GenFlix</p>
                <h2 className="mt-1 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
                  Crie sua nova senha
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#5f7077]">
                  Insira uma senha segura. Ao definir, seu acesso será concluído automaticamente.
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#4f656c]">Nova senha</span>
                <PasswordField
                  className="h-12 w-full rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#183139] outline-none transition placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite a nova senha"
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#4f656c]">Confirmar senha</span>
                <PasswordField
                  className="h-12 w-full rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#183139] outline-none transition placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#7a8a90]">
              Use pelo menos 8 caracteres para proteger sua conta.
            </p>

            {message ? (
              <p className="mt-5 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </p>
            ) : null}

            <GenflixCtaButton type="submit" disabled={isSubmitting || Boolean(message)} className="mt-6 w-full px-5 py-4">
              {isSubmitting ? 'Definindo...' : 'Definir senha'}
            </GenflixCtaButton>

            <div className="mt-5 text-center text-sm text-[#5F7077]">
              Precisa voltar?{' '}
              <Link to="/login" className="font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]">
                Ir para login <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
          </form>
        </div>
      )}
    </GenflixAuthLayout>
  )
}
