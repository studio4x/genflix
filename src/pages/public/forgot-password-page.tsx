import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/pages/public/auth-shell'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe seu e-mail para receber o link de redefinição."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm text-slate-700">E-mail</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Enviar link'}
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
