import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PasswordField } from '@/components/forms/password-field'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixAuthLayout } from '@/components/public/genflix-auth-layout'
import { LegalDocumentModal } from '@/components/public/legal-document-modal'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import type { LegalDocumentKey } from '@/features/public/legal-documents'
import { genflixHeroImage } from '@/features/public/genflix-public-media'

export function SignUpPage() {
  const navigate = useNavigate()
  const { user, roles, isLoading, signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openDocument, setOpenDocument] = useState<LegalDocumentKey | null>(null)

  const waitingRoleResolution = !!user && roles.length === 0
  const hasMinimumLength = useMemo(() => password.length >= 8, [password])

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

    if (!fullName.trim()) {
      setError('Informe seu nome completo.')
      return
    }

    if (!hasMinimumLength) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }

    if (!acceptTerms) {
      setError('Você precisa concordar com os Termos de Uso e a Pol?pr?tica de Privacidade.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await signUp(fullName, email, password)

      if (result.needsEmailConfirmation) {
        setMessage('Conta criada. Confira seu e-mail para confirmar o acesso ? GenFlix.')
      } else {
        navigate('/aluno', { replace: true })
      }
    } catch (submitError) {
      const submitMessage =
        submitError instanceof Error ? submitError.message : 'Falha ao criar a conta.'
      setError(submitMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <GenflixAuthLayout
      entryPrefix="global.auth.signup"
      title="Comece sua jornada"
      subtitle="Crie sua conta e acesse tudo agora."
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
          <Link
            to="/criar-conta"
            className="border-b-2 border-[#1398B7] pb-3 text-[#1398B7]"
          >
            Criar conta
          </Link>
        </div>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#4f656c]">Nome completo:</span>
          <input
            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            required
          />
        </label>

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

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#4f656c]">Senha:</span>
          <PasswordField
            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Crie uma senha"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#4f656c]">Confirmar senha:</span>
          <PasswordField
            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="flex items-start gap-3 rounded-[14px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm leading-6 text-[#5a6d73]">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#D8E6EB] text-[#1398B7] focus:ring-[#1398B7]"
          />
          <span>
            Concordo com os{' '}
            <button
              type="button"
              onClick={() => setOpenDocument('terms')}
              className="font-semibold text-[#1398B7] hover:text-[#1398B7]"
            >
              Termos de Uso
            </button>{' '}
            e{' '}
            <button
              type="button"
              onClick={() => setOpenDocument('privacy')}
              className="font-semibold text-[#1398B7] hover:text-[#1398B7]"
            >
              Pol?pr?tica de Privacidade
            </button>
            .
          </span>
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
          {isSubmitting ? 'Criando conta...' : 'Criar conta gr?tis'}
        </GenflixCtaButton>

        <div className="flex items-center gap-4 py-1">
          <span className="h-px flex-1 bg-[#D8E6EB]" />
          <span className="text-xs font-medium text-[#8BA0A7]">ou continue com</span>
          <span className="h-px flex-1 bg-[#D8E6EB]" />
        </div>

        <button
          type="button"
          disabled
          className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#0f4a54]/30 bg-white px-5 font-manrope text-sm font-semibold text-[#17323a] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#EDF4F6] text-sm font-bold text-[#1398B7]">
            G
          </span>
          Cadastrar com o Google
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-[#5F7077]">
        Ja tem conta?{' '}
        <Link to="/login" className="font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]">
          Entrar <ArrowRight className="inline h-3.5 w-3.5" />
        </Link>
      </div>

      {openDocument ? (
        <LegalDocumentModal documentKey={openDocument} onClose={() => setOpenDocument(null)} />
      ) : null}
    </GenflixAuthLayout>
  )
}
