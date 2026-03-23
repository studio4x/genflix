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
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    const parsed = createStudentFormSchema.safeParse({
      email: form.email.trim().toLowerCase(),
      fullName: form.fullName.trim() || undefined,
      password: form.password.trim() || undefined,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
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

  function handleReset() {
    setCreated(null)
    setForm(initialForm)
    setError(null)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl pb-12">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Cadastro de Alunos</h2>
        <p className="text-base text-slate-500">
          Crie novos usuários com perfil de aluno (student) na plataforma de forma rápida e segura.
        </p>
      </header>

      {created ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-900 leading-tight">Aluno Cadastrado!</h3>
              <p className="text-sm font-medium text-emerald-700">Conta criada e pronta para uso.</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-emerald-100 p-6 space-y-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center py-2 border-b border-slate-50">
              <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">E-mail (Login)</span>
              <span className="text-base font-bold text-slate-900">{created.email}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center py-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">Senha de Acesso</span>
              {created.temporary_password ? (
                <div className="flex items-center gap-2">
                  <code className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-mono font-bold border border-amber-200 text-base">{created.temporary_password}</code>
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md uppercase tracking-wider">Gerada Automáticamente</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Definida manualmente pelo painel
                </div>
              )}
            </div>
          </div>
          
          <Button onClick={handleReset} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 shadow-sm" size="lg">
            Cadastrar Novo Aluno
          </Button>
        </section>
      ) : (
        <form className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" onSubmit={handleSubmit}>
          <div className="border-b border-slate-100 bg-slate-50 p-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Novo Cadastro</h3>
          </div>
          
          <div className="p-6 md:p-8 grid gap-6 md:grid-cols-2">
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700 flex items-center gap-1">E-mail <span className="text-rose-500">*</span></span>
              <input
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                type="email"
                placeholder="nome@email.com"
                value={form.email}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, email: event.target.value }))
                }
                required
              />
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Nome Completo <span className="text-slate-400 font-normal ml-1">(Opcional mas recomendado)</span></span>
              <input
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                type="text"
                placeholder="Ex: João da Silva"
                value={form.fullName}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, fullName: event.target.value }))
                }
                maxLength={120}
              />
            </label>

            <label className="block space-y-2 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-sm font-bold text-slate-700">Senha de Acesso</span>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 shrink-0">Deixe em branco para auto-gerar</span>
              </div>
              <input
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                type="text"
                value={form.password}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="Ex: HcM@tch2026! (mín. 10 chars com letras, números e símbolos)"
              />
            </label>

            {error ? (
              <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 flex items-start gap-3">
                <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {error}
              </div>
            ) : null}

            <div className="md:col-span-2 pt-4 border-t border-slate-100 flex justify-end">
              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto px-8 h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-sm transition-all">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processando...
                  </span>
                ) : 'Cadastrar Aluno'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
