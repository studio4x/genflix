import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

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
      title="Acesso ao LMS"
      subtitle="O acesso de alunos aos cursos é iniciado pela plataforma principal da HomeCare Match."
    >
      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-sm font-bold leading-7 text-blue-900">
          Se você é aluno ou profissional cadastrado, volte para a HomeCare Match e acesse o curso por lá. A plataforma principal gera o token seguro que libera sua entrada neste LMS.
        </p>
        <a
          href="https://homecarematch.com.br"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-[#1473ff] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(20,115,255,0.22)] transition hover:bg-[#1067e6]"
        >
          Ir para HomeCare Match
        </a>
      </div>

      <form className="space-y-5 border-t border-slate-100 pt-6" onSubmit={handleSubmit}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Área restrita</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Login administrativo</h2>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-bold text-slate-800">E-mail administrativo</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[#1473ff] focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="block space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-slate-800">Senha</span>
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
          {isSubmitting ? 'Entrando...' : 'Entrar como admin'}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm font-medium text-slate-500">
        Alunos não usam senha local neste LMS.
      </div>
    </AuthShell>
  )
}
