import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import {
  createModule,
  deleteModule,
  fetchCourse,
  fetchModules,
  moveModule,
  toErrorMessage,
  updateModule,
} from '@/features/admin/content/api'
import {
  moduleFormSchema,
  type ModuleFormInput,
} from '@/features/admin/content/schemas'
import type { Course, CourseModule } from '@/types/content'

const initialForm: ModuleFormInput = {
  title: '',
  description: '',
  is_required: true,
}

interface ModuleEditorDraft {
  form: ModuleFormInput
  editingModuleId: string | null
}

const initialDraft: ModuleEditorDraft = {
  form: initialForm,
  editingModuleId: null,
}

export function AdminModulesPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draftStorageKey = useMemo(
    () => `admin:modules:${courseId ?? 'unknown'}:editor-draft`,
    [courseId],
  )
  const { state: draft, setState: setDraft, clear: clearDraft } =
    useLocalStorageState<ModuleEditorDraft>(draftStorageKey, initialDraft)
  const form = draft.form
  const editingModuleId = draft.editingModuleId

  const isEditing = useMemo(() => !!editingModuleId, [editingModuleId])

  const loadData = useCallback(async () => {
    if (!courseId) {
      setError('Curso invalido.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [courseResult, modulesResult] = await Promise.all([
        fetchCourse(courseId),
        fetchModules(courseId),
      ])
      setCourse(courseResult)
      setModules(modulesResult)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function resetForm() {
    clearDraft()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!courseId) {
      setError('Curso invalido.')
      return
    }

    const parsed = moduleFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (editingModuleId) {
        await updateModule(editingModuleId, parsed.data)
      } else {
        await createModule(courseId, parsed.data)
      }
      await loadData()
      resetForm()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEdit(module: CourseModule) {
    setDraft({
      editingModuleId: module.id,
      form: {
        title: module.title,
        description: module.description ?? '',
        is_required: module.is_required,
      },
    })
    setError(null)
  }

  async function handleDelete(module: CourseModule) {
    const confirmed = window.confirm(
      `Excluir o modulo "${module.title}"? As aulas relacionadas serao removidas.`,
    )
    if (!confirmed) {
      return
    }

    try {
      await deleteModule(module.id)
      await loadData()
      if (editingModuleId === module.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  async function handleMove(current: CourseModule, direction: 'up' | 'down') {
    const currentIndex = modules.findIndex((item) => item.id === current.id)
    if (currentIndex < 0) {
      return
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const target = modules[targetIndex]
    if (!target) {
      return
    }

    try {
      await moveModule(current, target)
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
          <span>/</span>
          <span>Modulos</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Modulos do curso {course ? `"${course.title}"` : ''}
        </h2>
      </div>

      <form
        className="grid gap-4 rounded-lg border bg-slate-50 p-4"
        onSubmit={handleSubmit}
      >
        <label className="space-y-1">
          <span className="text-sm text-slate-700">Titulo do modulo</span>
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
          Modulo obrigatorio
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Salvando...'
              : isEditing
                ? 'Atualizar modulo'
                : 'Criar modulo'}
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
        {modules.map((module, index) => (
          <article key={module.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900">
                  {module.position}. {module.title}
                </h3>
                <p className="text-sm text-slate-600">
                  Obrigatorio: {module.is_required ? 'Sim' : 'Nao'}
                </p>
                {module.description ? (
                  <p className="text-sm text-slate-600">{module.description}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleMove(module, 'up')}
                  disabled={index === 0}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleMove(module, 'down')}
                  disabled={index === modules.length - 1}
                >
                  Descer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEdit(module)}
                >
                  Editar
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={`/admin/modulos/${module.id}/aulas`}>Aulas</Link>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDelete(module)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </article>
        ))}

        {!isLoading && modules.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum modulo cadastrado.</p>
        ) : null}
      </div>
    </div>
  )
}
