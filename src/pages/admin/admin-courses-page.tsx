import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
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

export function AdminCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [form, setForm] = useState<CourseFormInput>(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setForm(initialForm)
    setEditingCourseId(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      setError('Usuario nao autenticado.')
      return
    }

    const parsed = courseFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
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
    setEditingCourseId(course.id)
    setForm({
      title: course.title,
      description: course.description ?? '',
      status: course.status,
      workload_hours: course.workload_hours,
    })
    setError(null)
  }

  async function handleDelete(course: Course) {
    const confirmed = window.confirm(
      `Excluir o curso "${course.title}"? Essa acao remove modulos e aulas relacionados.`,
    )
    if (!confirmed) {
      return
    }

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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Cursos</h2>
        <p className="text-sm text-slate-600">
          Gerencie cadastro de cursos (Sprint 2).
        </p>
      </div>

      <form
        className="grid gap-4 rounded-lg border bg-slate-50 p-4"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-700">Titulo</span>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-700">Status</span>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as CourseFormInput['status'],
                }))
              }
            >
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">Descricao</span>
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </label>

        <label className="space-y-1 md:max-w-40">
          <span className="text-sm text-slate-700">Carga horaria (h)</span>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min={0}
            value={form.workload_hours}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                workload_hours: Number(event.target.value || 0),
              }))
            }
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Salvando...'
              : isEditing
                ? 'Atualizar curso'
                : 'Criar curso'}
          </Button>
          {isEditing ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancelar edicao
            </Button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Cursos cadastrados
        </h3>

        {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}

        {!isLoading && courses.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum curso cadastrado.</p>
        ) : null}

        <div className="grid gap-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className="rounded-lg border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900">{course.title}</h4>
                  <p className="text-sm text-slate-600">
                    Status: {course.status} | Carga horaria: {course.workload_hours}h
                  </p>
                  {course.description ? (
                    <p className="text-sm text-slate-600">{course.description}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleEdit(course)}
                  >
                    Editar
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link to={`/admin/cursos/${course.id}/liberacoes`}>
                      Liberacoes
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                  >
                    <Link to={`/admin/cursos/${course.id}/modulos`}>Modulos</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDelete(course)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
