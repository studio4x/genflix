import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { fetchAdminCourseTree, toErrorMessage, importCourseContent } from '@/features/admin/content/api'
import type { AdminCourseTree } from '@/features/admin/content/api'


interface BuilderContextData {
  courseTree: AdminCourseTree | null
  refreshTree: () => Promise<void>
  isLoading: boolean
}

const BuilderContext = createContext<BuilderContextData | undefined>(undefined)

export function useCourseBuilder() {
  const context = useContext(BuilderContext)
  if (!context) {
    throw new Error('useCourseBuilder must be used within AdminCourseBuilderLayout')
  }
  return context
}

export function AdminCourseBuilderLayout() {
  const { courseId } = useParams<{ courseId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [courseTree, setCourseTree] = useState<AdminCourseTree | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // local toggle for sidebar (so users can collapse it if needed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // AI Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [clearExisting, setClearExisting] = useState(false)

  const refreshTree = async () => {
    if (!courseId) return
    setIsLoading(true)
    setError(null)
    try {
      const tree = await fetchAdminCourseTree(courseId)
      setCourseTree(tree)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshTree()
  }, [courseId])

  async function handleImport() {
    if (!courseId) return
    setIsImporting(true)
    setImportError(null)
    try {
      // 1. Limpeza inteligente do JSON (Remove markdown e quebras de linha que quebram o parse)
      let cleanedJson = importJson.trim()
      
      // Remove blocos de código markdown (```json ... ```)
      if (cleanedJson.startsWith('```')) {
        const parts = cleanedJson.split('```')
        cleanedJson = parts.length >= 3 ? parts[1].replace(/^json\s+/, '').trim() : cleanedJson
      }

      // Tentar limpar quebras de linha literais dentro de strings (problema comum com Claude/GPT)
      // Substituímos quebras de linha manuais por \n literal para o JSON.parse aceitar
      // (Esta é uma limpeza básica, mas resolve 90% dos casos de IA)
      cleanedJson = cleanedJson.replace(/\n(?!"\s*[}\],:])/g, '\\n')
      // Se a limpeza acima for agressiva e quebrar o JSON estrutural, o try/catch cuidará
      
      let data
      try {
        data = JSON.parse(cleanedJson)
      } catch (parseErr) {
        // Fallback: Tenta o parse original se o cleaned falhar por algum motivo
        data = JSON.parse(importJson.trim().replace(/^```json/, '').replace(/```$/, '').trim())
      }

      await importCourseContent(courseId, data, clearExisting)
      await refreshTree()
      setIsImportModalOpen(false)
      setImportJson('')
      setClearExisting(false)
    } catch (err) {
      console.error('Erro no import:', err)
      setImportError(err instanceof Error ? err.message : 'JSON inválido ou erro na importação.')
    } finally {
      setIsImporting(false)
    }
  }

  if (isLoading && !courseTree) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error || !courseTree) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800">Falha ao carregar o curso</h2>
        <p className="text-slate-500 mb-4">{error}</p>
        <Button onClick={() => navigate('/admin/cursos')}>Voltar aos Cursos</Button>
      </div>
    )
  }

  const { course, modules } = courseTree
  
  // Nav paths
  const coursePath = `/admin/cursos/${courseId}/builder`
  const isCourseHome = location.pathname === coursePath

  return (
    <BuilderContext.Provider value={{ courseTree, refreshTree, isLoading }}>
      <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
        
        {/* TOPBAR */}
        <header className="shrink-0 h-14 border-b border-slate-200 bg-white shadow-sm z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/cursos')} className="text-slate-500 hover:text-slate-900 -ml-2">
               <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
               Voltar
            </Button>
            <div className="h-5 border-l border-slate-200"></div>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M4 6h16M4 12h16M4 18h16" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <h1 className="text-sm font-bold text-slate-800 line-clamp-1 ml-1">{course.title}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${course.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {course.status === 'published' ? 'Publicado' : 'Rascunho'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="hidden md:flex h-8" asChild>
               <a href={`/aluno/cursos/${course.id}`} target="_blank" rel="noreferrer">
                 <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                 Visualizar
               </a>
            </Button>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* SIDEBAR - COURSE TREE */}
          <aside className={`shrink-0 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${isSidebarOpen ? 'w-80 lg:w-96' : 'w-0 overflow-hidden'}`}>
            <div className="flex-1 overflow-y-auto w-full no-scrollbar p-3 space-y-1">
              {/* Course Root */}
              <Link 
                to={coursePath} 
                className={`group flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${isCourseHome ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`p-1.5 rounded-md ${isCourseHome ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <span className="truncate">Visão Geral do Curso</span>
                </div>
              </Link>
              
              {/* Modules tree */}
              {modules.map((m, mIdx) => (
                <div key={m.id} className="pt-2">
                  <Link 
                    to={`/admin/cursos/${courseId}/builder/modulos/${m.id}`}
                    className={`group flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${location.pathname.includes(`/modulos/${m.id}`) && !location.pathname.includes('/aulas/') ? 'bg-slate-100 font-bold text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-800 font-medium hover:bg-slate-100/50'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 text-center text-[10px] font-extrabold text-slate-400">M{mIdx+1}</div>
                      <span className="truncate">{m.title}</span>
                    </div>
                  </Link>

                  <div className="ml-7 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                    {m.lessons.map(l => {
                      const isActiveLesson = location.pathname.includes(`/aulas/${l.id}`);
                      return (
                        <Link
                          key={l.id}
                          to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/aulas/${l.id}`}
                          className={`group flex items-center justify-between py-1.5 px-2 rounded-md text-[13px] transition-colors ${isActiveLesson ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                        >
                           <div className="flex items-center gap-2 truncate">
                             {l.lesson_type === 'video' ? (
                               <svg className={`h-3.5 w-3.5 shrink-0 ${isActiveLesson ? 'text-blue-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                             ) : (
                               <svg className={`h-3.5 w-3.5 shrink-0 ${isActiveLesson ? 'text-blue-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                             )}
                             <span className="truncate">{l.title}</span>
                           </div>
                        </Link>
                      )
                    })}

                    {m.assessments.map(a => {
                      const isActiveAssessment = location.pathname.includes(`/avaliacoes/${a.id}`);
                      return (
                        <Link
                          key={a.id}
                          to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/avaliacoes/${a.id}`}
                          className={`group flex items-center justify-between py-1.5 px-2 rounded-md text-[13px] transition-colors ${isActiveAssessment ? 'bg-amber-50 text-amber-700 font-semibold border border-amber-100' : 'text-slate-600 hover:text-slate-900 hover:bg-amber-50/50'}`}
                        >
                           <div className="flex items-center gap-2 truncate">
                             <svg className={`h-3.5 w-3.5 shrink-0 ${isActiveAssessment ? 'text-amber-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                             <span className="truncate">{a.title}</span>
                           </div>
                        </Link>
                      )
                    })}
                    
                    {/* Add Lesson/Quiz quick actions */}
                    <div className="flex items-center gap-1 mt-1">
                      <Link to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/aulas/nova`} className="flex-1 flex items-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Aula
                      </Link>
                      <Link to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/avaliacoes/nova`} className="flex-1 flex items-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] font-bold text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Quiz
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Module Quick Action */}
              <div className="pt-4 pb-2">
                 <Link to={`/admin/cursos/${courseId}/builder/modulos/novo`} className="flex items-center gap-2 p-2 rounded-lg text-sm font-bold text-blue-600 border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Novo Módulo
                 </Link>
              </div>

              {/* Additional nodes like Course Settings, Advanced */}
              <div className="pt-4 border-t border-slate-100 space-y-1">
                 <Link to={`/admin/cursos/${courseId}/builder/settings`} className="group flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Configurações do Curso
                 </Link>
                 <Link to={`/admin/cursos/${courseId}/builder/assessments`} className="group flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Gerenciar Avaliações
                 </Link>

                 <div className="pt-4 mt-4 border-t border-slate-100">
                    <Button 
                       variant="outline" 
                       size="sm" 
                       className="w-full text-[11px] font-black text-blue-600 border-blue-200 bg-blue-50/20 hover:bg-blue-600 hover:text-white transition-all h-10 gap-2 rounded-xl"
                       onClick={() => setIsImportModalOpen(true)}
                    >
                       <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       Importar Conteúdo (IA)
                    </Button>
                 </div>
              </div>
            </div>
          </aside>

          {/* IMPORT MODAL */}
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
               <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl border border-white/20 overflow-y-auto max-h-[95vh] no-scrollbar animate-in zoom-in-95 duration-300">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Importação em Massa (IA)</h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Cole o JSON gerado pela sua IA favorita abaixo.</p>
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
                           placeholder='[ { "title": "Módulo 1", "lessons": [...] } ]'
                           value={importJson}
                           onChange={e => setImportJson(e.target.value)}
                        />
                     </div>

                     {importError && (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold animate-in slide-in-from-left-2 transition-all">
                           {importError}
                        </div>
                     )}

                     <label className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 cursor-pointer group">
                        <input 
                           type="checkbox" 
                           checked={clearExisting}
                           onChange={e => setClearExisting(e.target.checked)}
                           className="h-5 w-5 rounded-lg border-amber-200 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="flex-1">
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-amber-900">Substituir conteúdo atual</span>
                              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                           </div>
                           <p className="text-[11px] text-amber-600 font-bold mt-0.5">Se marcado, todos os módulos, aulas e quizzes atuais deste curso serão apagados.</p>
                        </div>
                     </label>
                  </div>

                  <div className="p-8 bg-slate-50/50 flex gap-4 border-t border-slate-100">
                     <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="flex-1 h-14 rounded-2xl font-bold text-slate-500">
                        Cancelar
                     </Button>
                     <Button 
                        onClick={handleImport}
                        disabled={isImporting || !importJson.trim()}
                        className="flex-[2] h-14 rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100"
                     >
                        {isImporting ? (
                           <span className="flex items-center gap-2">
                              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Importando Módulos...
                           </span>
                        ) : 'Iniciar Importação'}
                     </Button>
                  </div>
               </div>
            </div>
          )}

          {/* MAIN CANVAS */}
          <main className="flex-1 h-full bg-slate-50/50 relative overflow-y-auto w-full border-t border-slate-100 shadow-inner">
             <div className="absolute inset-0 p-4 md:p-8">
               <Outlet />
             </div>
          </main>
        </div>
      </div>
    </BuilderContext.Provider>
  )
}
