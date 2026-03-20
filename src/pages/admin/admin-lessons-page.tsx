import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import {
  createLesson,
  deleteLesson,
  fetchLessons,
  fetchModule,
  moveLesson,
  toErrorMessage,
  updateLesson,
} from '@/features/admin/content/api'
import {
  lessonFormSchema,
  type LessonFormInput,
} from '@/features/admin/content/schemas'
import type { CourseModule, Lesson } from '@/types/content'

const initialForm: LessonFormInput = {
  title: '',
  description: '',
  is_required: true,
  youtube_url: '',
  estimated_minutes: 0,
}

interface LessonEditorDraft {
  form: LessonFormInput
  editingLessonId: string | null
}

const initialDraft: LessonEditorDraft = {
  form: initialForm,
  editingLessonId: null,
}

export function AdminLessonsPage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const [module, setModule] = useState<CourseModule | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draftStorageKey = useMemo(
    () => `admin:lessons:${moduleId ?? 'unknown'}:editor-draft`,
    [moduleId],
  )
  const { state: draft, setState: setDraft, clear: clearDraft } =
    useLocalStorageState<LessonEditorDraft>(draftStorageKey, initialDraft)
  const form = draft.form
  const editingLessonId = draft.editingLessonId

  const isEditing = useMemo(() => !!editingLessonId, [editingLessonId])

  const loadData = useCallback(async () => {
    if (!moduleId) {
      setError('Modulo invalido.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [moduleResult, lessonsResult] = await Promise.all([
        fetchModule(moduleId),
        fetchLessons(moduleId),
      ])
      setModule(moduleResult)
      setLessons(lessonsResult)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [moduleId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function resetForm() {
    clearDraft()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!moduleId) {
      setError('Modulo invalido.')
      return
    }

    const parsed = lessonFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (editingLessonId) {
        await updateLesson(editingLessonId, parsed.data)
      } else {
        await createLesson(moduleId, parsed.data)
      }
      await loadData()
      resetForm()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEdit(lesson: Lesson) {
    setDraft({
      editingLessonId: lesson.id,
      form: {
        title: lesson.title,
        description: lesson.description ?? '',
        is_required: lesson.is_required,
        youtube_url: lesson.youtube_url ?? '',
        estimated_minutes: lesson.estimated_minutes,
      },
    })
    setError(null)
  }

  async function handleDelete(lesson: Lesson) {
    const confirmed = window.confirm(
      `Excluir a aula "${lesson.title}"? Materiais relacionados serao removidos.`,
    )
    if (!confirmed) {
      return
    }

    try {
      await deleteLesson(lesson.id)
      await loadData()
      if (editingLessonId === lesson.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  async function handleMove(current: Lesson, direction: 'up' | 'down') {
    const currentIndex = lessons.findIndex((item) => item.id === current.id)
    if (currentIndex < 0) {
      return
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const target = lessons[targetIndex]
    if (!target) {
      return
    }

    try {
      await moveLesson(current, target)
      await loadData()
    } catch (moveError) {
      setError(toErrorMessage(moveError))
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link className="underline" to="/admin/cursos">
            Cursos
          </Link>
          {module ? (
            <>
              <span>/</span>
              <Link className="underline" to={`/admin/cursos/${module.course_id}/modulos`}>
                Modulos
              </Link>
            </>
          ) : null}
          <span>/</span>
          <span>Aulas</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Aulas do modulo {module ? `"${module.title}"` : ''}
        </h2>
      </div>

      <form
        className="grid gap-4 rounded-lg border bg-slate-50 p-4"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-700">Titulo da aula</span>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
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

          <label className="space-y-1">
            <span className="text-sm text-slate-700">Duracao estimada (min)</span>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="number"
              min={0}
              value={form.estimated_minutes}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  form: {
                    ...prev.form,
                    estimated_minutes: Number(event.target.value || 0),
                  },
                }))
              }
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">URL do YouTube</span>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="https://www.youtube.com/watch?v=..."
            value={form.youtube_url}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                form: { ...prev.form, youtube_url: event.target.value },
              }))
            }
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">Descricao</span>
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={form.description}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                form: { ...prev.form, description: event.target.value },
              }))
            }
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            checked={form.is_required}
            type="checkbox"
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                form: { ...prev.form, is_required: event.target.checked },
              }))
            }
          />
          Aula obrigatoria
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Salvando...'
              : isEditing
                ? 'Atualizar aula'
                : 'Criar aula'}
          </Button>
          {isEditing ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancelar edicao
            </Button>
          ) : null}
        </div>
      </form>

      {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}

      <div className="grid gap-3">
        {lessons.map((lesson, index) => (
          <article key={lesson.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900">
                  {lesson.position}. {lesson.title}
                </h3>
                <p className="text-sm text-slate-600">
                  Obrigatoria: {lesson.is_required ? 'Sim' : 'Nao'} | Duracao:{' '}
                  {lesson.estimated_minutes} min
                </p>
                {lesson.youtube_url ? (
                  <a
                    className="text-sm text-blue-700 underline"
                    href={lesson.youtube_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir video no YouTube
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">Sem URL de YouTube.</p>
                )}
                {lesson.description ? (
                  <p className="text-sm text-slate-600">{lesson.description}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleMove(lesson, 'up')}
                  disabled={index === 0}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleMove(lesson, 'down')}
                  disabled={index === lessons.length - 1}
                >
                  Descer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEdit(lesson)}
                >
                  Editar
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={`/admin/aulas/${lesson.id}/materiais`}>Materiais</Link>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDelete(lesson)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </article>
        ))}

        {!isLoading && lessons.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhuma aula cadastrada.</p>
        ) : null}
      </div>
    </div>
  )
}
