import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Button } from '@/components/ui/button'
import { Link, useParams } from 'react-router-dom'

export function CourseAssessmentsPanel() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courseTree } = useCourseBuilder()

  if (!courseTree) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Gestão de Avaliações</h2>
        <p className="text-sm text-slate-500 mt-1">Veja todos os quizzes e avaliações finais do curso em um só lugar.</p>
      </div>

      <div className="grid gap-6">
         {/* Course Final Assessment Section */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                     <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Avaliação Final do Curso</h3>
                    <p className="text-xs text-slate-500">Exibida ao fim de todos os módulos para certificação.</p>
                  </div>
               </div>
               <Button size="sm" variant="outline" className="bg-white" asChild>
                  <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>
                    Configurar Final
                  </Link>
               </Button>
            </div>
            
            <div className="p-6">
               {courseTree.courseAssessments.length > 0 ? (
                 courseTree.courseAssessments.map(a => (
                   <div key={a.id} className="flex items-center justify-between p-4 rounded-xl border border-emerald-100 bg-emerald-50/20">
                      <div>
                         <p className="font-bold text-emerald-900 leading-tight">{a.title}</p>
                         <p className="text-[11px] text-emerald-600 font-medium uppercase mt-1">Quiz de Certificação • Nota mínima {a.passing_score}%</p>
                      </div>
                      <Button variant="ghost" size="sm" className="hover:bg-emerald-100 font-bold" asChild>
                        <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>Editar</Link>
                      </Button>
                   </div>
                 ))
               ) : (
                 <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-400">Nenhuma avaliação final configurada.</p>
                    <Button variant="link" size="sm" className="mt-2 font-bold" asChild>
                      <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>Criar Prova Final</Link>
                    </Button>
                 </div>
               )}
            </div>
         </div>

         {/* Module Quizzes List */}
         <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Quizzes por Módulo</h3>
            
            <div className="grid gap-4">
               {courseTree.modules.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 text-center text-xs font-black text-slate-300">M{courseTree.modules.findIndex(mod => mod.id === m.id) + 1}</div>
                        <div>
                           <p className="font-bold text-slate-900 leading-tight">{m.title}</p>
                           <p className="text-xs text-slate-500 mt-1">{m.assessments.length === 0 ? 'Sem quiz associado' : `${m.assessments.length} quiz(zes)`}</p>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        {m.assessments.length > 0 ? (
                          m.assessments.map(a => (
                            <Button key={a.id} variant="outline" size="sm" className="bg-white" asChild>
                              <Link to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/avaliacoes/${a.id}`}>Editar Quiz</Link>
                            </Button>
                          ))
                        ) : (
                           <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 font-bold" asChild>
                              <Link to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/avaliacoes/nova`}>Adicionar Quiz</Link>
                           </Button>
                        )}
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  )
}
