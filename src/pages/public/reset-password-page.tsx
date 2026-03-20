import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/pages/public/auth-shell'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasMinimumLength = useMemo(() => password.length >= 8, [password])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!hasMinimumLength) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas nao conferem.')
      return
    }

    setIsSubmitting(true)

    try {
      await updatePassword(password)
      setMessage('Senha atualizada com sucesso. Voce ja pode fazer login.')
      setPassword('')
      setConfirmPassword('')
    } catch (submitError) {
      const submitMessage =
        submitError instanceof Error
          ? submitError.message
          : 'Falha ao redefinir senha.'
      setError(submitMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Redefinir senha"
      subtitle="Defina sua nova senha para continuar."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm text-slate-700">Nova senha</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-700">Confirmar senha</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
        </Button>
      </form>

      <div className="mt-4 text-sm text-slate-600">
        <Link className="text-slate-900 underline" to="/login">
          Voltar para login
        </Link>
      </div>
    </AuthShell>
  )
}
