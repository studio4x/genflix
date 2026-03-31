import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/pages/public/auth-shell'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, signIn, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Falha no login'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Portal de Acesso"
      subtitle="Entre com sua conta para acessar a plataforma de cursos da HomeCare Match."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-bold text-slate-800">E-mail</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[#1473ff] focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="block space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-slate-800">Senha</span>
            <Link
              className="text-sm font-medium text-[#1473ff] transition-colors hover:text-[#1067e6]"
              to="/recuperar-senha"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[#1473ff] focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <Button
          className="h-14 w-full rounded-2xl bg-[#1473ff] text-base font-black text-white shadow-[0_16px_35px_rgba(20,115,255,0.24)] hover:bg-[#1067e6]"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm font-medium text-slate-500">
        Acesso exclusivo para profissionais cadastrados na HomeCare Match.
      </div>
    </AuthShell>
  )
}
