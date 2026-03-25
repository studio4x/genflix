import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

import { createLesson, deleteLesson, updateLesson, toErrorMessage } from '@/features/admin/content/api'
import { lessonFormSchema, type LessonFormInput } from '@/features/admin/content/schemas'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Button } from '@/components/ui/button'

const initialForm: LessonFormInput = {
  title: '',
  description: '',
  is_required: true,
  lesson_type: 'video',
  youtube_url: '',
  text_content: '',
  estimated_minutes: 0,
}

// Custom toolbar for ReactQuill
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'blockquote', 'code-block'],
    ['clean']
  ],
}

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'link', 'blockquote', 'code-block',
  'table', 'table-row', 'table-cell'
]

export function LessonEditorPanel() {
  const { courseId, moduleId, lessonId } = useParams<{ courseId: string; moduleId: string; lessonId?: string }>()
  const navigate = useNavigate()
  const { courseTree, refreshTree } = useCourseBuilder()

  const isNew = lessonId === 'nova'

  const [form, setForm] = useState<LessonFormInput>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')

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
        const textContent = found.text_content ?? ''
        setForm({
          title: found.title,
          description: found.description ?? '',
          is_required: found.is_required,
          lesson_type: found.lesson_type,
          youtube_url: found.youtube_url ?? '',
          text_content: textContent,
          estimated_minutes: found.estimated_minutes,
        })
        
        // Se o conteúdo tiver tabela, forçar modo HTML para não estragar
        if (textContent.includes('<table')) {
          setEditorMode('html')
        }
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
       <style>{`
         .quill { background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0 !important; }
         .ql-toolbar { border: none !important; border-bottom: 1px solid #f1f5f9 !important; background: #f8fafc; }
         .ql-container { border: none !important; min-height: 400px; font-family: inherit; font-size: 16px; }
         .ql-editor { min-height: 400px; padding: 20px 24px; color: #1e293b; line-height: 1.6; }
         .ql-editor.ql-blank::before { color: #94a3b8; font-style: normal; }
         .ql-editor h1, .ql-editor h2, .ql-editor h3 { font-weight: 800; color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; }
         .ql-editor p { margin-bottom: 1em; }
         
         /* Estilos para Tabelas no Editor */
         .ql-editor table { width: 100% !important; border-collapse: collapse; margin: 24px 0; }
         .ql-editor th { background: #f8fafc; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; }
         .ql-editor td { padding: 8px 12px; border: 1px solid #e2e8f0; vertical-align: top; }
       `}</style>

       <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isNew ? 'Criar Nova Aula' : 'Editor de Aula'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure o formato pedagógico e o conteúdo da sua aula.
            </p>
          </div>
          {!isNew && (
            <Button variant="outline" size="sm" className="bg-white px-4 h-10 font-bold border-slate-200" onClick={() => navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${lessonId}/materiais`)}>
              <svg className="h-4 w-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              Materiais de Apoio
            </Button>
          )}
       </div>

       <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 space-y-10 flex-1">
             
             {/* Bloco 1: Identificação */}
             <fieldset className="space-y-4">
               <legend className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 w-full mb-6 flex items-center gap-2">
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">01</span>
                 Identificação da Aula
               </legend>
               
               <label className="block space-y-2">
                 <span className="text-sm font-bold text-slate-800">Título da Aula <span className="text-rose-500">*</span></span>
                 <input
                   className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white placeholder:text-slate-400"
                   placeholder="Ex: Princípios de Atendimento Home Care"
                   value={form.title}
                   onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                   required
                 />
               </label>

               <label className="block space-y-2">
                 <span className="text-sm font-bold text-slate-800">Descrição Curta (Opcional)</span>
                 <textarea
                   className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white resize-y placeholder:text-slate-400"
                   placeholder="Uma breve introdução sobre o que será abordado."
                   value={form.description}
                   onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                 />
               </label>
             </fieldset>

             {/* Bloco 2: Formato */}
             <fieldset className="space-y-6">
               <legend className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 w-full mb-6 flex items-center gap-2">
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">02</span>
                 Formato Pedagógico
               </legend>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-100/80 p-1.5 rounded-2xl">
                 <button
                   type="button"
                   onClick={() => setForm(prev => ({ ...prev, lesson_type: 'video' }))}
                   className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'video' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                   Apenas Vídeo
                 </button>
                 <button
                   type="button"
                   onClick={() => setForm(prev => ({ ...prev, lesson_type: 'text' }))}
                   className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'text' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   Apenas Texto
                 </button>
                 <button
                   type="button"
                   onClick={() => setForm(prev => ({ ...prev, lesson_type: 'hybrid' }))}
                   className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'hybrid' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                   Vídeo + Texto
                 </button>
               </div>

               {(form.lesson_type === 'video' || form.lesson_type === 'hybrid') && (
                 <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="block space-y-2">
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <svg className="h-4 w-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        Link do YouTube
                      </span>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-100 focus:bg-white placeholder:text-slate-400"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={form.youtube_url}
                        onChange={(e) => setForm((prev) => ({ ...prev, youtube_url: e.target.value }))}
                      />
                    </label>
                 </div>
               )}

                {(form.lesson_type === 'text' || form.lesson_type === 'hybrid') && (
                  <div className="animate-in slide-in-from-top-2 duration-300 space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">Conteúdo da Aula</span>
                        
                        {/* EDITOR MODE TOGGLE */}
                        <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200 shadow-sm">
                           <button 
                              type="button" 
                              onClick={() => setEditorMode('visual')}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${editorMode === 'visual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              Visual
                           </button>
                           <button 
                              type="button" 
                              onClick={() => setEditorMode('html')}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${editorMode === 'html' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              Código HTML
                           </button>
                        </div>
                     </div>

                     {editorMode === 'visual' ? (
                        <ReactQuill
                          theme="snow"
                          value={form.text_content}
                          onChange={(val) => setForm(prev => ({ ...prev, text_content: val }))}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder="Escreva aqui o conteúdo textual detalhado da sua aula..."
                        />
                     ) : (
                        <textarea
                          className="w-full min-h-[400px] p-6 font-mono text-[13px] bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 transition-all focus:ring-4 focus:ring-blue-100 shadow-inner no-scrollbar leading-relaxed"
                          value={form.text_content}
                          onChange={(e) => setForm(prev => ({ ...prev, text_content: e.target.value }))}
                          placeholder="Cole ou edite seu código HTML aqui..."
                        />
                     )}
                  </div>
                )}

               <div className="pt-4 border-t border-slate-50">
                 <label className="block space-y-2 max-w-[200px]">
                   <span className="text-sm font-bold text-slate-800">Carga Horária Estimada (Min)</span>
                   <input
                     className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white placeholder:text-slate-400"
                     type="number"
                     min={0}
                     placeholder="Ex: 20"
                     value={form.estimated_minutes === 0 ? '' : form.estimated_minutes}
                     onChange={(e) => setForm((prev) => ({ ...prev, estimated_minutes: Number(e.target.value || 0) }))}
                   />
                 </label>
               </div>
             </fieldset>

             {/* Bloco 3: Regras */}
             <fieldset className="space-y-4">
               <legend className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 w-full mb-6 flex items-center gap-2">
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">03</span>
                 Configurações de Conclusão
               </legend>
               <label className="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/20 cursor-pointer hover:bg-blue-50/40 transition-colors shadow-sm">
                 <div className="flex items-center h-6">
                   <input
                     checked={form.is_required}
                     type="checkbox"
                     className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-600 shadow-sm transition-all"
                     onChange={(e) => setForm((prev) => ({ ...prev, is_required: e.target.checked }))}
                   />
                 </div>
                 <div>
                   <span className="text-sm font-bold text-slate-900 block">Marcar como Aula Obrigatória</span>
                   <span className="text-[11px] text-slate-500 mt-1 block leading-relaxed">Se ativado, esta aula deve ser visualizada/lida para que o aluno receba o certificado de conclusão do curso.</span>
                 </div>
               </label>
             </fieldset>

          </div>

          {error && (
            <div className="mx-6 md:mx-8 mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600 flex items-start gap-2 animate-pulse">
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
                className="border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 w-full sm:w-auto transition-all"
              >
                {isDeleting ? 'Excluindo...' : 'Remover Aula'}
              </Button>
            )}
            <div className={`flex gap-3 w-full sm:w-auto ${isNew ? 'sm:justify-end' : ''}`}>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 shadow-md font-bold transition-all active:scale-95"
              >
                {isSubmitting ? 'Salvando...' : (isNew ? 'Criar Aula' : 'Salvar Alterações')}
              </Button>
            </div>
          </div>
       </form>
    </div>
  )
}
