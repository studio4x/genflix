import { useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createStudent,
  toErrorMessage,
  type CreateStudentResponse,
} from '@/features/admin/students/api'
import { createStudentFormSchema } from '@/features/admin/students/schemas'

interface StudentFormState {
  email: string
  fullName: string
  password: string
}

const initialForm: StudentFormState = {
  email: '',
  fullName: '',
  password: '',
}

export function AdminStudentsPage() {
  const { session } = useAuth()
  const [form, setForm] = useState<StudentFormState>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateStudentResponse | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) {
      setError('Sessao expirada. Faca login novamente.')
      return
    }

    const parsed = createStudentFormSchema.safeParse({
      email: form.email.trim().toLowerCase(),
      fullName: form.fullName.trim() || undefined,
      password: form.password.trim() || undefined,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setCreated(null)

    try {
      const result = await createStudent(parsed.data, session)
      setCreated(result)
      setForm(initialForm)
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Cadastro de alunos</h2>
        <p className="text-sm text-slate-600">
          Crie usuarios com role <strong>student</strong> diretamente pelo painel admin.
        </p>
      </div>

      <form className="space-y-4 rounded-lg border bg-slate-50 p-4" onSubmit={handleSubmit}>
        <label className="space-y-1">
          <span className="text-sm text-slate-700">E-mail</span>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, email: event.target.value }))
            }
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">Nome completo (opcional)</span>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="text"
            value={form.fullName}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, fullName: event.target.value }))
            }
            maxLength={120}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">
            Senha temporaria (opcional, se vazio sera gerada automaticamente)
          </span>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="text"
            value={form.password}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, password: event.target.value }))
            }
            placeholder="Min. 10 caracteres com maiuscula, minuscula, numero e simbolo"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Criando aluno...' : 'Criar aluno'}
        </Button>
      </form>

      {created ? (
        <section className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Aluno criado com sucesso</h3>
          <p className="text-sm text-green-800">E-mail: {created.email}</p>
          {created.temporary_password ? (
            <p className="text-sm text-green-800">
              Senha temporaria gerada: <code>{created.temporary_password}</code>
            </p>
          ) : (
            <p className="text-sm text-green-800">
              Senha definida manualmente no cadastro.
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}
