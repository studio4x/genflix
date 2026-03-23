import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createLesson, deleteLesson, updateLesson, toErrorMessage } from '@/features/admin/content/api'
import { lessonFormSchema, type LessonFormInput } from '@/features/admin/content/schemas'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Button } from '@/components/ui/button'

const initialForm: LessonFormInput = {
  title: '',
  description: '',
  is_required: true,
  youtube_url: '',
  estimated_minutes: 0,
}

export function LessonEditorPanel() {
  const { courseId, moduleId, lessonId } = useParams<{ courseId: string; moduleId: string; lessonId?: string }>()
  const navigate = useNavigate()
  const { courseTree, refreshTree } = useCourseBuilder()

  const isNew = lessonId === 'nova'

  const [form, setForm] = useState<LessonFormInput>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) {
      setForm(initialForm)
      return
    }

    if (courseTree && lessonId) {
      // Find the lesson in the tree
      let found = null
      for (const m of courseTree.modules) {
        const lesson = m.lessons.find((l) => l.id === lessonId)
        if (lesson) {
          found = lesson
          break
        }
      }
      
      if (found) {
        setForm({
          title: found.title,
          description: found.description ?? '',
          is_required: found.is_required,
          youtube_url: found.youtube_url ?? '',
          estimated_minutes: found.estimated_minutes,
        })
      }
    }
  }, [isNew, lessonId, courseTree])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!moduleId || !courseId) return

    const parsed = lessonFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (!isNew && lessonId) {
        await updateLesson(lessonId, parsed.data)
      } else {
        const created = await createLesson(moduleId, parsed.data)
        await refreshTree()
        navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${created.id}`, { replace: true })
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
    if (!lessonId || isNew) return
    const confirmed = window.confirm('ATENÇÃO: Excluir esta aula permanentemente?')
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteLesson(lessonId)
      await refreshTree()
      navigate(`/admin/cursos/${courseId}/builder`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
       <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
         <div>
           <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
             {isNew ? 'Criar Nova Aula' : 'Editor de Aula'}
           </h2>
           <p className="text-sm text-slate-500 mt-1">
             {isNew ? 'Adicione o conteúdo em vídeo e informações textuais para esta aula.' : 'Ajuste os blocos de conteúdo multimídia da sua aula.'}
           </p>
         </div>
         {!isNew && (
           <Button variant="outline" size="sm" className="bg-white" onClick={() => navigate(`/admin/aulas/${lessonId}/materiais`)}>
             <svg className="h-4 w-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
             Gerenciar Materiais de Apoio
           </Button>
         )}
       </div>

       <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
         <div className="p-6 md:p-8 space-y-8 flex-1">
            
            {/* Bloco 1: Identificação */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 w-full mb-4">1. Identificação Básico</legend>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-800">Título da Aula <span className="text-rose-500">*</span></span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white placeholder:text-slate-400"
                  placeholder="Ex: Aula 1 - Princípios Básicos"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-800">Texto Guia (Descrição Opcional)</span>
                <textarea
                  className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white resize-y placeholder:text-slate-400"
                  placeholder="Descreva o conteúdo desta aula ou deixe notas para acompanhar o vídeo."
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
            </fieldset>

            {/* Bloco 2: Mídia */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 w-full mb-4">2. Configuração de Mídia</legend>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    URL do Vídeo Youtube
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:bg-white placeholder:text-slate-400"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={form.youtube_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, youtube_url: e.target.value }))}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-800">Duração Estimada (Min)</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white placeholder:text-slate-400"
                    type="number"
                    min={0}
                    placeholder="Ex: 15"
                    value={form.estimated_minutes === 0 ? '' : form.estimated_minutes}
                    onChange={(e) => setForm((prev) => ({ ...prev, estimated_minutes: Number(e.target.value || 0) }))}
                  />
                </label>
              </div>
            </fieldset>

            {/* Bloco 3: Regras */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 w-full mb-4">3. Restrições e Regras</legend>
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
                  <span className="text-sm font-bold text-slate-900 block">Marcar como Aula Obrigatória</span>
                  <span className="text-xs text-slate-500 mt-0.5 block">Se marcado, o aluno deverá concluir esta aula obrigatoriamente para atingir o 100% de aproveitamento.</span>
                </div>
              </label>
            </fieldset>

         </div>

         {error && (
           <div className="mx-6 md:mx-8 mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600 flex items-start gap-2">
             <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             {error}
           </div>
         )}
         
         <div className="bg-slate-50 border-t border-slate-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
           {!isNew && (
             <Button
               type="button"
               variant="outline"
               onClick={handleDelete}
               disabled={isDeleting || isSubmitting}
               className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 w-full sm:w-auto"
             >
               {isDeleting ? 'Excluindo...' : 'Remover Aula Permanentemente'}
             </Button>
           )}
           <div className={`flex gap-3 w-full sm:w-auto ${isNew ? 'sm:justify-end' : ''}`}>
             <Button 
               type="submit" 
               disabled={isSubmitting} 
               className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] shadow-sm font-bold"
             >
               {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
             </Button>
           </div>
         </div>
       </form>
    </div>
  )
}
