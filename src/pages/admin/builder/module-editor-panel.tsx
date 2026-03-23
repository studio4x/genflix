import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createModule, deleteModule, updateModule, toErrorMessage } from '@/features/admin/content/api'
import { moduleFormSchema, type ModuleFormInput } from '@/features/admin/content/schemas'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Button } from '@/components/ui/button'

const initialForm: ModuleFormInput = {
  title: '',
  description: '',
  is_required: true,
}

export function ModuleEditorPanel() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId?: string }>()
  const navigate = useNavigate()
  const { courseTree, refreshTree } = useCourseBuilder()

  const isNew = moduleId === 'novo'

  // Local State
  const [form, setForm] = useState<ModuleFormInput>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) {
      setForm(initialForm)
      return
    }

    if (courseTree && moduleId) {
      const module = courseTree.modules.find(m => m.id === moduleId)
      if (module) {
        setForm({
          title: module.title,
          description: module.description ?? '',
          is_required: module.is_required,
        })
      }
    }
  }, [isNew, moduleId, courseTree])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!courseId) return

    const parsed = moduleFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (!isNew && moduleId) {
        await updateModule(moduleId, parsed.data)
      } else {
        const created = await createModule(courseId, parsed.data)
        await refreshTree()
        navigate(`/admin/cursos/${courseId}/builder/modulos/${created.id}`, { replace: true })
        return
      }
      await refreshTree()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!moduleId || isNew) return
    const confirmed = window.confirm('ATENÇÃO: Excluir este módulo? Todas as aulas serão removidas permanentemente.')
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteModule(moduleId)
      await refreshTree()
      navigate(`/admin/cursos/${courseId}/builder`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
       <div className="border-b border-slate-200 pb-5">
         <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
           {isNew ? 'Criar Novo Módulo' : 'Configurações do Módulo'}
         </h2>
         <p className="text-sm text-slate-500 mt-1">
           {isNew ? 'Adicione uma nova seção principal para agrupar as aulas do seu curso.' : 'Atualize os detalhes e restrições desta seção do curso.'}
         </p>
       </div>

       <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 md:p-8 space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-800">Capa / Título do Módulo <span className="text-rose-500">*</span></span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white placeholder:text-slate-400"
                placeholder="Ex: Fundamentos Básicos"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-800">Descrição Organizacional</span>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white resize-y placeholder:text-slate-400"
                placeholder="Detalhes para os alunos ou notas internas sobre este bloco."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>

            <label className="flex items-start gap-4 p-5 rounded-xl border border-blue-100 bg-blue-50/30 cursor-pointer hover:bg-blue-50/50 transition-colors">
              <div className="flex items-center h-6">
                <input
                  checked={form.is_required}
                  type="checkbox"
                  className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-600 shadow-sm"
                  onChange={(e) => setForm((prev) => ({ ...prev, is_required: e.target.checked }))}
                />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Exigir Conclusão deste Módulo</span>
                <span className="text-xs text-slate-500 mt-0.5 block">Se marcado, o aluno deverá concluir todas as aulas atreladas a este módulo para avançar no progresso total.</span>
              </div>
            </label>
         </div>

         {error && (
           <div className="mx-6 md:mx-8 mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600 flex items-start gap-2">
             <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             {error}
           </div>
         )}
         
         <div className="bg-slate-50 border-t border-slate-100 p-6 flex items-center justify-between">
           {!isNew && (
             <Button
               type="button"
               variant="outline"
               onClick={handleDelete}
               disabled={isDeleting || isSubmitting}
               className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
             >
               {isDeleting ? 'Excluindo...' : 'Excluir Módulo'}
             </Button>
           )}
           <div className={`flex gap-3 ${isNew ? 'w-full justify-end' : ''}`}>
             <Button 
               type="submit" 
               disabled={isSubmitting} 
               className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] shadow-sm font-bold"
             >
               {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
             </Button>
           </div>
         </div>
       </form>
    </div>
  )
}
