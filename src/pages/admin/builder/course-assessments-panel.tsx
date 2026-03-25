import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Button } from '@/components/ui/button'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { importAssessmentContent, createFinalAssessment, createModuleAssessment, fetchFinalAssessment, fetchModuleAssessment } from '@/features/admin/assessments/api'
import { useAuth } from '@/app/providers/auth-provider'
import { toErrorMessage } from '@/features/admin/assessments/api'

export function CourseAssessmentsPanel() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courseTree, refreshTree } = useCourseBuilder()
  const { user } = useAuth()

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  
  // Se estiver importando para um módulo específico
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null)

  if (!courseTree) return null

  async function handleImportJson() {
    if (!user?.id || !courseId) return
    setIsImporting(true)
    setImportError(null)
    try {
      let cleanedJson = importJson.trim()
      const match = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match && match[1]) {
        cleanedJson = match[1].trim()
      } else {
        cleanedJson = cleanedJson.replace(/^```(json)?\s+/, '').replace(/\s+```$/, '').trim()
      }
      
      let data
      try {
        data = JSON.parse(cleanedJson)
      } catch (err1) {
        const fixedJson = cleanedJson.replace(/\n(?!\s*[\{\}\[\]",:0-9\-\.tfn])/g, '\\n')
        data = JSON.parse(fixedJson)
      }

      let assessmentId = null

      if (targetModuleId) {
        // Importar para módulo
        const existing = await fetchModuleAssessment(targetModuleId)
        if (existing) {
          assessmentId = existing.id
        } else {
          const mod = courseTree?.modules.find(m => m.id === targetModuleId)
          const newA = await createModuleAssessment(courseId, targetModuleId, {
            title: data.title || `Quiz: ${mod?.title || 'Módulo'}`,
            description: data.description || '',
            is_active: true,
            is_required: true,
            max_attempts: data.max_attempts || 3,
            passing_score: data.passing_score || 70
          }, user.id)
          assessmentId = newA.id
        }
      } else {
        // Importar para Avaliação Final
        const existing = await fetchFinalAssessment(courseId)
        if (existing) {
          assessmentId = existing.id
        } else {
          const newA = await createFinalAssessment(courseId, {
            title: data.title || 'Avaliação Final',
            description: data.description || '',
            is_active: true,
            is_required: true,
            max_attempts: data.max_attempts || 3,
            passing_score: data.passing_score || 70
          }, user.id)
          assessmentId = newA.id
        }
      }

      if (!assessmentId) throw new Error('Falha ao identificar avaliação de destino.')

      await importAssessmentContent(assessmentId, data)
      await refreshTree()
      setIsImportModalOpen(false)
      setImportJson('')
      setTargetModuleId(null)
    } catch (err: any) {
      console.error('Erro no import:', err)
      setImportError(toErrorMessage(err))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
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
                  <div className="flex items-center gap-2">
                     <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => { setTargetModuleId(null); setIsImportModalOpen(true); }}
                        className="text-blue-600 hover:bg-blue-50 font-bold"
                     >
                        <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Importar IA
                     </Button>
                     <Button size="sm" variant="outline" className="bg-white" asChild>
                        <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>
                          Configurar Final
                        </Link>
                     </Button>
                  </div>
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
                          <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={() => { setTargetModuleId(m.id); setIsImportModalOpen(true); }}
                             className="text-slate-400 hover:text-blue-600 font-bold h-8 w-8 p-0"
                             title="Importar de IA para este módulo"
                          >
                             <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </Button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* AI IMPORT MODAL */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl border border-white/20 overflow-y-auto max-h-[90vh] no-scrollbar animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                   <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Importar Avaliação (IA)</h3>
                      <p className="text-sm text-slate-500 mt-1 font-medium">
                        {targetModuleId ? 'Importando para um quiz de módulo.' : 'Importando para a Avaliação Final.'}
                      </p>
                   </div>
                   <button onClick={() => setIsImportModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>

                <div className="p-8 space-y-6">
                   <div className="space-y-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Código JSON Estruturado</span>
                      <textarea 
                         className="w-full h-80 font-mono text-xs p-6 bg-slate-900 text-emerald-400 rounded-2xl border border-slate-800 focus:ring-4 focus:ring-blue-100 transition-all no-scrollbar"
                         placeholder='{ "title": "...", "passing_score": 75, "questions": [...] }'
                         value={importJson}
                         onChange={e => setImportJson(e.target.value)}
                      />
                   </div>

                   {importError && (
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold animate-in slide-in-from-left-2 transition-all">
                         {importError}
                      </div>
                   )}
                </div>

                <div className="p-8 bg-slate-50/50 flex gap-4 border-t border-slate-100">
                   <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="flex-1 h-14 rounded-2xl font-bold text-slate-500">
                      Cancelar
                   </Button>
                   <Button 
                      onClick={handleImportJson}
                      disabled={isImporting || !importJson.trim()}
                      className="flex-[2] h-14 rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100"
                   >
                      {isImporting ? (
                         <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Importando...
                         </span>
                      ) : 'Importar Agora'}
                   </Button>
                </div>
             </div>
          </div>
        )}
    </>
  )
}
