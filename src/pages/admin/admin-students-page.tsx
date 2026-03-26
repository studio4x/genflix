import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createStudent,
  fetchStudents,
  toErrorMessage,
  type AdminStudentListItem,
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

function formatDateTime(value: string) {
  if (!value) {
    return 'Nao informado'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Nao informado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

export function AdminStudentsPage() {
  const { session } = useAuth()
  const [form, setForm] = useState<StudentFormState>(initialForm)
  const [students, setStudents] = useState<AdminStudentListItem[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateStudentResponse | null>(null)

  useEffect(() => {
    async function loadStudents() {
      if (!session) {
        setStudents([])
        setIsLoadingStudents(false)
        setListError('Sessao expirada. Faca login novamente.')
        return
      }

      setIsLoadingStudents(true)
      setListError(null)
      try {
        const result = await fetchStudents(session)
        setStudents(result)
      } catch (loadError) {
        setListError(toErrorMessage(loadError))
      } finally {
        setIsLoadingStudents(false)
      }
    }

    void loadStudents()
  }, [session])

  const totals = useMemo(() => {
    return students.reduce(
      (accumulator, student) => ({
        students: accumulator.students + 1,
        enrolled: accumulator.enrolled + student.enrolled_courses_count,
        completed: accumulator.completed + student.completed_courses_count,
      }),
      {
        students: 0,
        enrolled: 0,
        completed: 0,
      },
    )
  }, [students])

  async function reloadStudents() {
    if (!session) {
      setListError('Sessao expirada. Faca login novamente.')
      return
    }

    setIsLoadingStudents(true)
    setListError(null)
    try {
      const result = await fetchStudents(session)
      setStudents(result)
    } catch (loadError) {
      setListError(toErrorMessage(loadError))
    } finally {
      setIsLoadingStudents(false)
    }
  }

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
      await reloadStudents()
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl pb-12">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestao de Alunos</h2>
        <p className="text-base text-slate-500">
          Cadastre novos alunos e acompanhe, no mesmo painel, os dados e o volume de cursos de cada conta.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Alunos cadastrados</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{totals.students}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cursos matriculados</p>
          <p className="mt-3 text-3xl font-black text-blue-700">{totals.enrolled}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cursos finalizados</p>
          <p className="mt-3 text-3xl font-black text-emerald-700">{totals.completed}</p>
        </article>
      </section>

      {created ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-900 leading-tight">Aluno cadastrado</h3>
              <p className="text-sm font-medium text-emerald-700">Conta criada e pronta para uso.</p>
            </div>
          </div>

          <div className="mb-6 space-y-4 rounded-xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-50 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">E-mail</span>
              <span className="text-base font-bold text-slate-900">{created.email}</span>
            </div>
            <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">Senha de acesso</span>
              {created.temporary_password ? (
                <div className="flex items-center gap-2">
                  <code className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-mono text-base font-bold text-amber-700">{created.temporary_password}</code>
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-amber-600">Gerada automaticamente</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 font-medium text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Definida manualmente pelo painel
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleReset} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 shadow-sm" size="lg">
            Cadastrar novo aluno
          </Button>
        </section>
      ) : (
        <form className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Novo cadastro</h3>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
            <label className="block space-y-2 md:col-span-2">
              <span className="flex items-center gap-1 text-sm font-bold text-slate-700">E-mail <span className="text-rose-500">*</span></span>
              <input
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              <span className="text-sm font-bold text-slate-700">Nome completo <span className="ml-1 font-normal text-slate-400">(Opcional, mas recomendado)</span></span>
              <input
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                type="text"
                placeholder="Ex: Joao da Silva"
                value={form.fullName}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, fullName: event.target.value }))
                }
                maxLength={120}
              />
            </label>

            <label className="block space-y-2 md:col-span-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                <span className="text-sm font-bold text-slate-700">Senha de acesso</span>
                <span className="shrink-0 rounded-md border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">Deixe em branco para auto-gerar</span>
              </div>
              <input
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                type="text"
                value={form.password}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="Ex: HcM@tch2026! (min. 10 chars com letras, numeros e simbolos)"
              />
            </label>

            {error ? (
              <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
                <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {error}
              </div>
            ) : null}

            <div className="md:col-span-2 flex justify-end border-t border-slate-100 pt-4">
              <Button type="submit" disabled={isSubmitting} size="lg" className="h-12 w-full px-8 text-base font-bold bg-blue-600 shadow-sm transition-all hover:bg-blue-700 sm:w-auto">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-current" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processando...
                  </span>
                ) : 'Cadastrar aluno'}
              </Button>
            </div>
          </div>
        </form>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Alunos cadastrados</h3>
            <p className="text-sm text-slate-500">Listagem administrativa com dados do perfil e totais por curso.</p>
          </div>
          <Button variant="outline" onClick={() => void reloadStudents()} disabled={isLoadingStudents}>
            {isLoadingStudents ? 'Atualizando...' : 'Atualizar lista'}
          </Button>
        </div>

        {listError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
            {listError}
          </div>
        ) : null}

        {isLoadingStudents ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">
            Nenhum aluno cadastrado ate o momento.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {students.map((student) => (
              <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-lg font-black tracking-tight text-slate-900">
                      {student.full_name?.trim() || 'Aluno sem nome informado'}
                    </h4>
                    <p className="text-sm font-medium text-slate-600">{student.email || 'E-mail nao informado'}</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Student
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID do aluno</p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-700">{student.id}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fuso horario</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{student.timezone}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Locale</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{student.locale}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atualizado em</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{formatDateTime(student.updated_at)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Matriculados</p>
                    <p className="mt-2 text-2xl font-black text-blue-700">{student.enrolled_courses_count}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Finalizados</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700">{student.completed_courses_count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Criado em</p>
                    <p className="mt-2 text-sm font-bold text-slate-700">{formatDateTime(student.created_at)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
