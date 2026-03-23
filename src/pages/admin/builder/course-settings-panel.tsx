import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'

export function CourseSettingsPanel() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courseTree } = useCourseBuilder()
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft',
    thumbnail_url: ''
  })

  useEffect(() => {
    if (courseTree) {
      setForm({
        title: courseTree.course.title,
        description: courseTree.course.description ?? '',
        status: courseTree.course.status,
        thumbnail_url: courseTree.course.thumbnail_url ?? ''
      })
    }
  }, [courseTree])

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Configurações do Curso</h2>
        <p className="text-sm text-slate-500 mt-1">Gerencie as informações básicas e visibilidade do seu curso.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
         <div className="grid gap-6">
            <label className="block space-y-2">
               <span className="text-sm font-bold text-slate-800">Nome do Curso</span>
               <input 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
               />
            </label>

            <label className="block space-y-2">
               <span className="text-sm font-bold text-slate-800">Descrição</span>
               <textarea 
                  className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
               />
            </label>

            <div className="flex gap-4">
               <div className="flex-1 space-y-2">
                  <span className="text-sm font-bold text-slate-800 block">Status de Publicação</span>
                  <select 
                     className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                     value={form.status}
                     onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                     <option value="draft">Rascunho (Privado)</option>
                     <option value="published">Publicado (Visível para Alunos)</option>
                  </select>
               </div>
            </div>
         </div>

         <div className="pt-6 border-t border-slate-100 flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8">
               Salvar Configurações
            </Button>
         </div>
      </div>
    </div>
  )
}
