import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createStudent,
  fetchStudents,
  resetStudentPassword,
  toErrorMessage,
  type AdminStudentListItem,
  type CreateStudentResponse,
  type ResetStudentPasswordResponse,
} from '@/features/admin/students/api'
import { createStudentFormSchema } from '@/features/admin/students/schemas'

interface StudentFormState {
  email: string
  fullName: string
  password: string
}

interface PasswordResetFeedback extends ResetStudentPasswordResponse {
  copied: boolean
}

const DEFAULT_STUDENTS_PER_PAGE = 10
const STUDENTS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

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

function buildPagination(currentPage: number, totalPages: number) {
  if (totalPages <= 1) {
    return [1]
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((pageA, pageB) => pageA - pageB)
}

export function AdminStudentsPage() {
  const { session } = useAuth()
  const [form, setForm] = useState<StudentFormState>(initialForm)
  const [students, setStudents] = useState<AdminStudentListItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [studentsPerPage, setStudentsPerPage] = useState(DEFAULT_STUDENTS_PER_PAGE)
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateStudentResponse | null>(null)
  const [passwordResetFeedback, setPasswordResetFeedback] = useState<PasswordResetFeedback | null>(null)
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null)

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

  const totalPages = Math.max(1, Math.ceil(students.length / studentsPerPage))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * studentsPerPage
    return students.slice(startIndex, startIndex + studentsPerPage)
  }, [currentPage, students, studentsPerPage])

  const pageButtons = useMemo(() => buildPagination(currentPage, totalPages), [currentPage, totalPages])

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
    setPasswordResetFeedback(null)

    try {
      const result = await createStudent(parsed.data, session)
      setCreated(result)
      setForm(initialForm)
      setCurrentPage(1)
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

  async function handleResetStudentPassword(student: AdminStudentListItem) {
    if (!session) {
      setListError('Sessao expirada. Faca login novamente.')
      return
    }

    const shouldContinue = window.confirm(
      `Redefinir a senha de ${student.full_name?.trim() || student.email || 'este aluno'}? Uma nova senha temporaria sera gerada e a senha anterior deixara de funcionar.`,
    )

    if (!shouldContinue) {
      return
    }

    setResettingStudentId(student.id)
    setListError(null)

    try {
      const result = await resetStudentPassword(student.id, session)
      setPasswordResetFeedback({ ...result, copied: false })
    } catch (resetError) {
      setListError(toErrorMessage(resetError))
    } finally {
      setResettingStudentId(null)
    }
  }

  async function handleCopyTemporaryPassword() {
    if (!passwordResetFeedback) {
      return
    }

    try {
      await navigator.clipboard.writeText(passwordResetFeedback.temporary_password)
      setPasswordResetFeedback((previous) => (previous ? { ...previous, copied: true } : previous))
    } catch {
      setListError('Nao foi possivel copiar a senha automaticamente. Copie manualmente.')
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Gestao de Alunos</h2>
        <p className="max-w-3xl text-sm font-medium text-slate-500 sm:text-base">
          Cadastre novos alunos e acompanhe a base em uma listagem paginada, com metricas de matricula e conclusao por conta.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Alunos cadastrados</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{totals.students}</p>
          </article>
          <article className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-500">Cursos matriculados</p>
            <p className="mt-3 text-3xl font-black text-blue-700">{totals.enrolled}</p>
          </article>
          <article className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Cursos finalizados</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{totals.completed}</p>
          </article>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          {created ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-emerald-900">Aluno cadastrado</h3>
                  <p className="text-sm font-medium text-emerald-700">Conta criada e pronta para uso.</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">E-mail</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{created.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Senha de acesso</p>
                  {created.temporary_password ? (
                    <code className="mt-1 inline-flex rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-sm font-bold text-amber-700">
                      {created.temporary_password}
                    </code>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-700">Definida manualmente no painel</p>
                  )}
                </div>
              </div>

              <Button onClick={handleReset} className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700">
                Cadastrar novo aluno
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Novo cadastro</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Criar aluno</h3>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">E-mail</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  type="email"
                  placeholder="nome@email.com"
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Nome completo</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  type="text"
                  placeholder="Ex: Joao da Silva"
                  value={form.fullName}
                  onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))}
                  maxLength={120}
                />
              </label>

              <label className="block space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Senha de acesso</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Auto-gerada se vazio</span>
                </div>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  type="text"
                  placeholder="Ex: HcM@tch2026!"
                  value={form.password}
                  onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-2xl bg-blue-600 text-base font-black hover:bg-blue-700"
              >
                {isSubmitting ? 'Processando...' : 'Cadastrar aluno'}
              </Button>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Alunos cadastrados</h3>
            <p className="text-sm font-medium text-slate-500">
              Visualizacao em lista com todas as informacoes do aluno. Escolha quantos registros deseja exibir por pagina.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              <span>Por pagina</span>
              <select
                value={studentsPerPage}
                onChange={(event) => {
                  const nextPageSize = Number(event.target.value)
                  setStudentsPerPage(nextPageSize)
                  setCurrentPage(1)
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700 outline-none transition-colors focus:border-blue-300"
              >
                {STUDENTS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              {students.length} aluno(s)
            </div>
            <Button variant="outline" onClick={() => void reloadStudents()} disabled={isLoadingStudents} className="rounded-2xl">
              {isLoadingStudents ? 'Atualizando...' : 'Atualizar lista'}
            </Button>
          </div>
        </div>

        {listError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
            {listError}
          </div>
        ) : null}

        {passwordResetFeedback ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">Nova senha temporaria</p>
                <h4 className="text-xl font-black tracking-tight text-amber-950">Senha redefinida com sucesso</h4>
                <p className="text-sm font-medium text-amber-800">
                  Use esta senha para o aluno <span className="font-black">{passwordResetFeedback.email}</span>. Ao entrar, ele ja pode trocar a senha na conta.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordResetFeedback(null)}
                className="rounded-2xl border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
              >
                Fechar
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <code className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-sm font-black text-amber-700">
                {passwordResetFeedback.temporary_password}
              </code>
              <Button
                type="button"
                onClick={() => void handleCopyTemporaryPassword()}
                className="rounded-2xl bg-amber-600 hover:bg-amber-700"
              >
                {passwordResetFeedback.copied ? 'Senha copiada' : 'Copiar senha'}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoadingStudents ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
            Nenhum aluno cadastrado ate o momento.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-[24px] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Aluno</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">ID</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Fuso / Locale</th>
                      <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Matriculados</th>
                      <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Finalizados</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Criado em</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Atualizado em</th>
                      <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedStudents.map((student) => (
                      <tr key={student.id} className="align-top transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <div className="min-w-[220px]">
                            <p className="text-sm font-black text-slate-900">
                              {student.full_name?.trim() || 'Aluno sem nome informado'}
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-600">{student.email || 'E-mail nao informado'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <code className="block min-w-[220px] whitespace-pre-wrap break-all text-xs font-bold text-slate-600">
                            {student.id}
                          </code>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[160px]">
                            <p className="text-sm font-bold text-slate-800">{student.timezone}</p>
                            <p className="mt-1 text-sm font-medium text-slate-500">{student.locale}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex min-w-14 justify-center rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-lg font-black text-blue-700">
                            {student.enrolled_courses_count}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex min-w-14 justify-center rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-lg font-black text-emerald-700">
                            {student.completed_courses_count}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                          {formatDateTime(student.created_at)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                          {formatDateTime(student.updated_at)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[180px] justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleResetStudentPassword(student)}
                              disabled={resettingStudentId === student.id}
                              className="rounded-2xl border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                            >
                              {resettingStudentId === student.id ? 'Redefinindo...' : 'Redefinir senha'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-500">
                Exibindo {(currentPage - 1) * studentsPerPage + 1} a {Math.min(currentPage * studentsPerPage, students.length)} de {students.length} aluno(s)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl"
                >
                  Anterior
                </Button>
                {pageButtons.map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-10 rounded-xl ${page === currentPage ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl"
                >
                  Proxima
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
