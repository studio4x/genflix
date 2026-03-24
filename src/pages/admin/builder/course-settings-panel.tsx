import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { updateCourse, uploadCourseThumbnail, toErrorMessage } from '@/features/admin/content/api'
import { courseFormSchema } from '@/features/admin/content/schemas'

export function CourseSettingsPanel() {
  const { courseTree, refreshTree } = useCourseBuilder()
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    workload_minutes: 0,
    thumbnail_url: ''
  })
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (courseTree) {
      setForm({
        title: courseTree.course.title || '',
        description: courseTree.course.description ?? '',
        status: (courseTree.course.status as any) || 'draft',
        workload_minutes: courseTree.course.workload_minutes || 0,
        thumbnail_url: courseTree.course.thumbnail_url ?? ''
      })
    }
  }, [courseTree])

  async function handleThumbnailUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploadingThumbnail(true)

    try {
      const url = await uploadCourseThumbnail(file)
      setForm(f => ({ ...f, thumbnail_url: url }))
    } catch (err) {
      setError('Falha ao subir imagem. Tente novamente.')
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseTree) return

    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    try {
      const parsed = courseFormSchema.safeParse(form)
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      }

      await updateCourse(courseTree.course.id, parsed.data)
      await refreshTree()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Detalhes Principais</h2>
        <p className="text-sm text-slate-500 mt-1">Essas informações definem como os alunos verão seu curso no catálogo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
         {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-sm tracking-tight animate-in slide-in-from-top-2 duration-300">
               {error}
            </div>
         )}
         
         {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold text-sm tracking-tight animate-in slide-in-from-top-2 duration-300">
               Configurações salvas com sucesso!
            </div>
         )}

         <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 md:p-10 space-y-10">
            {/* THUMBNAIL UPLOAD AREA */}
            <div className="space-y-4">
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Capa do Curso (1024x768)</span>
               <div 
                  className={`relative group aspect-[4/3] w-full rounded-[24px] border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
                     form.thumbnail_url ? 'border-transparent' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50'
                  }`}
               >
                  {form.thumbnail_url ? (
                     <>
                        <img src={form.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                           <p className="text-white font-black text-sm uppercase tracking-widest">Alterar Imagem</p>
                           <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, thumbnail_url: '' }))} className="bg-white/20 border-white/40 text-white hover:bg-white hover:text-slate-900 font-bold">Remover</Button>
                        </div>
                     </>
                  ) : (
                     <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className={`h-16 w-16 rounded-[20px] bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:rotate-6 transition-all duration-300 ${isUploadingThumbnail ? 'animate-pulse' : ''}`}>
                           {isUploadingThumbnail ? (
                              <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           ) : (
                              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           )}
                        </div>
                        <div className="space-y-1">
                           <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Upload da Capa</p>
                           <p className="text-xs font-medium text-slate-400">Arraste ou clique para selecionar (JPG, PNG ou WEBP)</p>
                        </div>
                     </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Selecionar imagem da capa" />
               </div>
            </div>

            <div className="grid gap-8">
               <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Curso</span>
                  <input 
                     className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                     placeholder="Ex: Primeiros Socorros Avançado"
                     value={form.title}
                     onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                     required
                  />
               </label>

               <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Detalhada</span>
                  <textarea 
                     className="w-full min-h-[160px] font-medium rounded-[24px] border border-slate-200 bg-slate-100/50 px-6 py-5 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all leading-relaxed"
                     placeholder="Fale sobre os objetivos e o público-alvo do curso..."
                     value={form.description}
                     onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
               </label>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <label className="block space-y-2">
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Duração (Minutos)</span>
                     <input 
                        type="number"
                        className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                        placeholder="00"
                        min={0}
                        value={form.workload_minutes}
                        onChange={e => setForm(f => ({ ...f, workload_minutes: Number(e.target.value) }))}
                        required
                     />
                  </label>

                  <label className="block space-y-2">
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Status de Publicação</span>
                     <select 
                        className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                        value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                     >
                        <option value="draft">Rascunho (Privado)</option>
                        <option value="published">Publicado (Visível para Alunos)</option>
                        <option value="archived">Arquivado (Desativado)</option>
                     </select>
                  </label>
               </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex justify-end">
               <Button 
                  type="submit"
                  disabled={isSubmitting || isUploadingThumbnail}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 h-16 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
               >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Salvando...
                    </>
                  ) : 'Salvar Alterações'}
               </Button>
            </div>
         </div>
      </form>
    </div>
  )
}
