import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, KeyRound, MailCheck } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixAuthLayout } from '@/components/public/genflix-auth-layout'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import { genflixHeroImage } from '@/features/public/genflix-public-media'

type LoginMode = 'magic-link' | 'password'

export function LoginPage() {
  const { user, signIn, signInWithMagicLink, isLoading, roles } = useAuth()
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      await signIn(email, password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha no login.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      await signInWithMagicLink(email)
      setMessage(`Enviamos um link de acesso para ${email}. Abra seu e-mail para entrar na GenFlix.`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar o link de acesso.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <GenflixAuthLayout
      entryPrefix="global.auth.login"
      title="Bem-vindo de volta"
      subtitle={mode === 'password' ? 'Continue de onde parou.' : 'Entre sem senha usando um link mágico.'}
      imageUrl={genflixHeroImage}
    >
      <div className="border-b border-[#D8E6EB]">
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            to="/login"
            className="border-b-2 border-[#1398B7] pb-3 text-[#1398B7]"
          >
            Entrar
          </Link>
          <Link
            to="/criar-conta"
            className="pb-3 text-[#8BA0A7] transition-colors hover:text-[#5F7077]"
          >
            Criar conta
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2 rounded-[18px] border border-[#D8E6EB] bg-[#F2F7F9] p-1">
        <button
          type="button"
          onClick={() => {
            setMode('password')
            setError(null)
            setMessage(null)
          }}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-[14px] text-sm font-bold transition ${
            mode === 'password'
              ? 'bg-[#1398B7] text-white shadow-sm'
              : 'text-[#6d7f84] hover:bg-white'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          Senha
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('magic-link')
            setError(null)
            setMessage(null)
          }}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-[14px] text-sm font-bold transition ${
            mode === 'magic-link'
              ? 'bg-[#1398B7] text-white shadow-sm'
              : 'text-[#6d7f84] hover:bg-white'
          }`}
        >
          <MailCheck className="h-4 w-4" />
          Link mágico
        </button>
      </div>

      {mode === 'magic-link' ? (
        <form className="mt-6 space-y-5" onSubmit={handleMagicLinkSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4f656c]">E-mail:</span>
            <input
              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </label>

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
            {isSubmitting ? 'Enviando...' : 'Enviar link de acesso'}
          </GenflixCtaButton>

          <p className="text-center text-xs font-medium leading-5 text-[#8a9aa0]">
            O link expira em cerca de 1 hora. Se não encontrar, verifique spam ou promoções.
          </p>
        </form>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={handlePasswordSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4f656c]">E-mail:</span>
            <input
              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4f656c]">Senha:</span>
            <input
              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="flex justify-end">
            <Link
              className="text-xs font-medium text-[#1398B7] transition-colors hover:text-[#1398B7] sm:text-sm"
              to="/recuperar-senha"
            >
              Esqueceu a senha?
            </Link>
          </div>

          {error ? (
            <p className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          <GenflixCtaButton type="submit" disabled={isSubmitting} className="h-12 w-full px-5">
            {isSubmitting ? 'Entrando...' : 'Entrar com senha'}
          </GenflixCtaButton>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-[#5F7077]">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" className="font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]">
          Criar conta <ArrowRight className="inline h-3.5 w-3.5" />
        </Link>
      </div>
    </GenflixAuthLayout>
  )
}
