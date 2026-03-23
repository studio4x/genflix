import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import {
  createCourse,
  deleteCourse,
  fetchCourses,
  toErrorMessage,
  updateCourse,
} from '@/features/admin/content/api'
import {
  courseFormSchema,
  type CourseFormInput,
} from '@/features/admin/content/schemas'
import type { Course } from '@/types/content'

const initialForm: CourseFormInput = {
  title: '',
  description: '',
  status: 'draft',
  workload_hours: 0,
}

interface CourseEditorDraft {
  form: CourseFormInput
  editingCourseId: string | null
}

const initialDraft: CourseEditorDraft = {
  form: initialForm,
  editingCourseId: null,
}

export function AdminCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { state: draft, setState: setDraft, clear: clearDraft } =
    useLocalStorageState<CourseEditorDraft>('admin:courses:editor-draft', initialDraft)
    
  const form = draft.form
  const editingCourseId = draft.editingCourseId
  const isEditing = useMemo(() => !!editingCourseId, [editingCourseId])

  async function loadCourses() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchCourses()
      setCourses(data)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCourses()
  }, [])

  function resetForm() {
    clearDraft()
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }

    const parsed = courseFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      if (editingCourseId) {
        await updateCourse(editingCourseId, parsed.data)
      } else {
        await createCourse(parsed.data, user.id)
      }
      await loadCourses()
      resetForm()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEdit(course: Course) {
    setDraft({
      editingCourseId: course.id,
      form: {
        title: course.title,
        description: course.description ?? '',
        status: course.status,
        workload_hours: course.workload_hours,
      },
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setError(null)
  }

  async function handleDelete(course: Course) {
    const confirmed = window.confirm(
      `ATENÇÃO: Deseja realmente excluir o curso "${course.title}"?\n\nEssa ação é irreversível e removerá todos os módulos e aulas relacionados.`
    )
    if (!confirmed) return

    setError(null)
    try {
      await deleteCourse(course.id)
      await loadCourses()
      if (editingCourseId === course.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestão de Cursos</h2>
        <p className="text-base text-slate-500">
          Crie, edite e gerencie o catálogo de cursos disponíveis na plataforma.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] items-start">
        {/* Form Column */}
        <section className={`rounded-2xl border bg-white shadow-sm overflow-hidden sticky top-6 transition-all ${isEditing ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
          <div className={`p-5 min-h-[64px] flex items-center border-b ${isEditing ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {isEditing ? (
                <>
                  <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Editando Curso
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Novo Curso
                </>
              )}
            </h3>
          </div>
          
          <form className="p-6 grid gap-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Título do Curso <span className="text-rose-500">*</span></span>
                <input
                  className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                  placeholder="Ex: Formação em Cuidados Básicos"
                  value={form.title}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      form: { ...prev.form, title: event.target.value },
                    }))
                  }
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <select
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={form.status}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        form: {
                          ...prev.form,
                          status: event.target.value as CourseFormInput['status'],
                        },
                      }))
                    }
                  >
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Carga Horária (h) <span className="text-rose-500">*</span></span>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    type="number"
                    min={0}
                    value={form.workload_hours === 0 ? '' : form.workload_hours}
                    placeholder="Ex: 40"
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        form: {
                          ...prev.form,
                          workload_hours: Number(event.target.value || 0),
                        },
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Descrição</span>
                <textarea
                  className="min-h-[120px] w-full rounded-lg border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y placeholder:text-slate-400"
                  placeholder="Descreva os objetivos e o público-alvo deste curso."
                  value={form.description}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      form: { ...prev.form, description: event.target.value },
                    }))
                  }
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 flex items-start gap-2">
                <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} size="lg" className={`w-full text-sm font-bold shadow-sm ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSubmitting
                  ? (isEditing ? 'Atualizando...' : 'Salvando...')
                  : (isEditing ? 'Salvar Alterações' : 'Cadastrar Curso')}
              </Button>
              {isEditing ? (
                <Button type="button" variant="outline" onClick={resetForm} className="w-full text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-slate-200">
                  Cancelar Edição
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        {/* List Column */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Catálogo de Cursos ({courses.length})
            </h3>
            {isLoading && <span className="text-sm font-medium text-slate-400 animate-pulse">Carregando...</span>}
          </div>

          {!isLoading && courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-slate-50/50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <p className="text-slate-500 font-medium">Nenhum curso cadastrado ainda.</p>
              <p className="text-sm text-slate-400 mt-1">Utilize o formulário ao lado para criar o primeiro curso.</p>
            </div>
          ) : null}

          <div className="grid gap-4">
            {courses.map((course) => (
              <article
                key={course.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
                  editingCourseId === course.id ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-5 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">{course.title}</h4>
                        {course.status === 'published' && (
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500" title="Publicado" />
                        )}
                        {course.status === 'draft' && (
                          <span className="flex h-2 w-2 rounded-full bg-slate-300" title="Rascunho" />
                        )}
                        {course.status === 'archived' && (
                          <span className="flex h-2 w-2 rounded-full bg-rose-500" title="Arquivado" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider">
                         <span className={
                           course.status === 'published' ? 'text-emerald-600' : 
                           course.status === 'draft' ? 'text-slate-500' : 'text-rose-600'
                         }>
                           {course.status === 'published' ? 'Publicado' : course.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                         </span>
                         <span className="text-slate-300">•</span>
                         <span className="text-slate-500">{course.workload_hours} horas</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-3 text-xs font-semibold rounded-md ${editingCourseId === course.id ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'}`}
                        onClick={() => handleEdit(course)}
                      >
                        {editingCourseId === course.id ? 'Editando' : 'Editar'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        onClick={() => void handleDelete(course)}
                        title="Excluir curso"
                      >
                         <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         <span className="sr-only">Excluir</span>
                      </Button>
                    </div>
                  </div>
                  
                  {course.description ? (
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{course.description}</p>
                  ) : null}
                </div>

                <div className="bg-slate-50 border-t border-slate-100 p-3 sm:px-5 flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap flex-1 justify-end gap-2 w-full">
                    <Button type="button" variant="outline" size="sm" className="h-9 px-4 text-xs font-extrabold bg-blue-600 border-transparent text-white hover:bg-blue-700 shadow-sm flex-1 sm:flex-none justify-center" asChild>
                      <Link to={`/admin/cursos/${course.id}/builder`}>
                        <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z" /></svg>
                        Construtor do Curso
                      </Link>
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 px-4 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm flex-1 sm:flex-none justify-center" asChild>
                      <Link to={`/admin/cursos/${course.id}/avaliacao-final`}>Avaliação Final</Link>
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 px-4 text-xs font-semibold bg-white border-slate-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 shadow-sm flex-1 sm:flex-none justify-center" asChild>
                      <Link to={`/admin/cursos/${course.id}/liberacoes`}>
                        <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                        Acessos
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
