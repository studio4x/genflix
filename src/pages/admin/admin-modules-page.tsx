import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import {
  createModule,
  deleteModule,
  exportModuleContent,
  fetchCourse,
  fetchModules,
  moveModule,
  toErrorMessage,
  updateModule,
} from '@/features/admin/content/api'
import { downloadJsonFile } from '@/lib/download'
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
  const [exportingModuleId, setExportingModuleId] = useState<string | null>(null)
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
      setError('Curso inválido.')
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
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!courseId) {
      setError('Curso inválido.')
      return
    }

    const parsed = moduleFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setError(null)
  }

  async function handleDelete(module: CourseModule) {
    const confirmed = window.confirm(
      `ATENÇÃO: Excluir o módulo "${module.title}"?\n\nTodas as aulas vinculadas serão removidas permanentemente.`,
    )
    if (!confirmed) return

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
    if (currentIndex < 0) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const target = modules[targetIndex]
    if (!target) return

    try {
      await moveModule(current, target)
      await loadData()
    } catch (moveError) {
      setError(toErrorMessage(moveError))
    }
  }

  async function handleExportModule(module: CourseModule) {
    setExportingModuleId(module.id)
    setError(null)
    try {
      const exportData = await exportModuleContent(module.id)
      downloadJsonFile(`modulo_${module.title}`, exportData)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setExportingModuleId(null)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="space-y-4 border-b border-slate-100 pb-6">
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Link to="/admin/cursos" className="hover:text-blue-600 transition-colors">Cursos</Link>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-slate-900 truncate max-w-[200px] sm:max-w-xs">{course?.title || 'Carregando...'}</span>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-slate-900">Módulos</span>
        </nav>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestão de Módulos</h2>
          <p className="text-base text-slate-500 mt-1">
            Organize os módulos do curso de forma sequencial.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] items-start">
        {/* Form Column */}
        <section className={`rounded-2xl border bg-white shadow-sm overflow-hidden sticky top-6 transition-all ${isEditing ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
          <div className={`p-5 min-h-[64px] flex items-center border-b ${isEditing ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {isEditing ? (
                <>
                  <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Editando Módulo
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Novo Módulo
                </>
              )}
            </h3>
          </div>
          
          <form className="p-6 grid gap-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Título do Módulo <span className="text-rose-500">*</span></span>
                <input
                  className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                  placeholder="Ex: Introdução aos Cuidados"
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

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Descrição</span>
                <textarea
                  className="min-h-[100px] w-full rounded-lg border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y placeholder:text-slate-400"
                  placeholder="Visão geral sobre o módulo (opcional)."
                  value={form.description}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      form: { ...prev.form, description: event.target.value },
                    }))
                  }
                />
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  checked={form.is_required}
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      form: { ...prev.form, is_required: event.target.checked },
                    }))
                  }
                />
                <span className="text-sm font-semibold text-slate-900 select-none">Módulo Obrigatório para Conclusão</span>
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
                  : (isEditing ? 'Salvar Alterações' : 'Cadastrar Módulo')}
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
              Módulos Cadastrados ({modules.length})
            </h3>
            {isLoading && <span className="text-sm font-medium text-slate-400 animate-pulse">Carregando...</span>}
          </div>

          {!isLoading && modules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-slate-50/50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </div>
              <p className="text-slate-500 font-medium">Nenhum módulo cadastrado ainda.</p>
              <p className="text-sm text-slate-400 mt-1">Utilize o formulário ao lado para criar a estrutura do curso.</p>
            </div>
          ) : null}

          <div className="space-y-3">
            {modules.map((module, index) => (
              <article
                key={module.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                  editingModuleId === module.id ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-4 sm:p-5 flex gap-4">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => void handleMove(module, 'up')}
                      disabled={index === 0}
                      title="Mover para cima"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </Button>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                      {module.position}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => void handleMove(module, 'down')}
                      disabled={index === modules.length - 1}
                      title="Mover para baixo"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Button>
                  </div>

                  <div className="flex-1 space-y-2 py-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-slate-900 leading-tight">{module.title}</h4>
                          {module.is_required ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">Obrigatório</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">Opcional</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          onClick={() => handleEdit(module)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => void handleDelete(module)}
                          title="Excluir Módulo"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </Button>
                      </div>
                    </div>
                    
                    {module.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{module.description}</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-4 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-sm"
                    onClick={() => void handleExportModule(module)}
                    disabled={exportingModuleId === module.id}
                  >
                    {exportingModuleId === module.id ? 'Exportando...' : 'Exportar JSON'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-4 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-sm" asChild>
                    <Link to={`/admin/cursos/${courseId}/builder/assessments`}>Avaliações</Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-4 text-xs font-bold bg-white border-slate-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 shadow-sm" asChild>
                    <Link to={`/admin/modulos/${module.id}/aulas`}>
                      <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      Gerenciar Aulas
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
