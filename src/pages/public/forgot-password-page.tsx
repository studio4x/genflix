import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixAuthLayout } from '@/components/public/genflix-auth-layout'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import { genflixHeroImage } from '@/features/public/genflix-site-content'

export function ForgotPasswordPage() {
  const { requestPasswordReset, user, roles, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const waitingRoleResolution = !!user && roles.length === 0

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  if (user) {
    return <Navigate to={getDashboardPathForRoles(roles)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setIsSubmitting(true)

    try {
      await requestPasswordReset(email)
      setMessage('Se o e-mail existir, enviaremos um link de recuperação.')
    } catch (submitError) {
      const submitMessage =
        submitError instanceof Error
          ? submitError.message
          : 'Falha ao solicitar recuperação.'
      setError(submitMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <GenflixAuthLayout
      entryPrefix="global.auth.forgotPassword"
      title="Recupere seu acesso"
      subtitle="Enviaremos um link para você redefinir sua senha e continuar seus estudos."
      imageUrl={genflixHeroImage}
    >
      <div className="border-b border-[#D8E6EB]">
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            to="/login"
            className="pb-3 text-[#8BA0A7] transition-colors hover:text-[#5F7077]"
          >
            Entrar
          </Link>
          <span className="border-b-2 border-[#1398B7] pb-3 text-[#1398B7]">
            Recuperar senha
          </span>
        </div>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#4f656c]">E-mail:</span>
          <input
            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Seu@e-mail.com"
            autoComplete="email"
            required
          />
        </label>

        <p className="text-sm leading-6 text-[#7a8a90]">
          Informe o e-mail usado no cadastro. Se ele existir, você receberá um link para redefinir a senha.
        </p>

        {message ? (
          <p className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <GenflixCtaButton type="submit" disabled={isSubmitting} className="h-12 w-full px-5">
          {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
        </GenflixCtaButton>
      </form>

      <div className="mt-6 text-center text-sm text-[#5F7077]">
        Lembrou sua senha?{' '}
        <Link to="/login" className="font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]">
          Voltar para entrar <ArrowRight className="inline h-3.5 w-3.5" />
        </Link>
      </div>
    </GenflixAuthLayout>
  )
}
