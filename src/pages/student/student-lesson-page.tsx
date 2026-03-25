import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import 'react-quill/dist/quill.snow.css'
import {
  fetchReleasedCourseById,
  fetchStudentCourseContentWithProgress,
  setLessonCompletion,
  toErrorMessage,
} from '@/features/student/courses/api'
import type { Course, StudentCourseModuleProgress, StudentLessonWithProgress } from '@/types/content'

// Utility to extract standard youtube ID
function extractVideoId(url: string | null) {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export function StudentLessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<StudentCourseModuleProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false)

  const [activeLessonDetails, setActiveLessonDetails] = useState<any>(null)

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      if (!courseId) return
      setIsLoading(true)
      try {
        const [courseResult, modulesResult] = await Promise.all([
          fetchReleasedCourseById(courseId),
          fetchStudentCourseContentWithProgress(courseId),
        ])
        if (isMounted) {
          setCourse(courseResult)
          setModules(modulesResult)
        }
      } catch (err) {
        if (isMounted) setError(toErrorMessage(err))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void loadData()
    return () => { isMounted = false }
  }, [courseId])

  useEffect(() => {
    async function loadActiveLesson() {
      if (!lessonId) return
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single()
        
        if (!error && data) {
          setActiveLessonDetails(data)
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes da aula:', err)
      }
    }
    void loadActiveLesson()
  }, [lessonId])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="animate-pulse text-sm font-medium text-slate-500">Preparando a sala de aula...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Oops! Algo deu errado.</h2>
          <p className="text-sm text-slate-500">{error || 'Curso não encontrado.'}</p>
          <Button onClick={() => navigate('/aluno/cursos')}>Voltar aos meus cursos</Button>
        </div>
      </div>
    )
  }

  // Find the exact lesson details
  let currentLesson: StudentLessonWithProgress | null = null
  
  // Flatten timeline to find prev/next
  const timeline: { moduleId: string; lessonId: string; isBlocked: boolean; title: string, is_completed: boolean }[] = []
  
  for (const m of modules) {
    for (const l of m.lessons) {
      timeline.push({
        moduleId: m.id,
        lessonId: l.id,
        isBlocked: m.state === 'blocked',
        title: l.title,
        is_completed: l.is_completed
      })
      if (l.id === lessonId) {
        currentLesson = l
      }
    }
  }

  const currentIndex = timeline.findIndex(item => item.lessonId === lessonId)
  const prevItem = currentIndex > 0 ? timeline[currentIndex - 1] : null
  const nextItem = currentIndex < timeline.length - 1 ? timeline[currentIndex + 1] : null

  // If lesson doesn't exist, generic fallback
  if (!currentLesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Aula não encontrada</h2>
          <Button onClick={() => navigate(`/aluno/cursos/${courseId}`)}>Voltar ao curso</Button>
        </div>
      </div>
    )
  }

  const videoUrl = activeLessonDetails?.youtube_url || currentLesson.youtube_url
  const textContent = activeLessonDetails?.text_content || currentLesson.text_content
  const lessonType = activeLessonDetails?.lesson_type || currentLesson.lesson_type
  
  const videoId = extractVideoId(videoUrl)

  async function handleToggleCompletion() {
    if (!user || !currentLesson) return
    setIsTogglingCompletion(true)
    try {
      await setLessonCompletion({
        user_id: user.id,
        lesson_id: currentLesson.id,
        is_completed: !currentLesson.is_completed,
      })
      
      // Recarregar progresso para atualizar os checks na barra lateral
      const refreshedModules = await fetchStudentCourseContentWithProgress(courseId!)
      setModules(refreshedModules)
    } catch (err) {
      alert(toErrorMessage(err))
    } finally {
      setIsTogglingCompletion(false)
    }
  }

  // Calculate global progress
  const totalCompleted = modules.filter(m => m.state === 'completed').length
  const totalModules = modules.length
  const courseProgressPercent = totalModules === 0 ? 0 : Math.round((totalCompleted / totalModules) * 100)

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900">
      {/* SIDEBAR */}
      <aside className={`shrink-0 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 min-h-[64px]">
          <Link to={`/aluno/cursos/${courseId}`} className="text-sm font-bold text-slate-700 hover:text-blue-600 flex items-center gap-2 truncate">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="truncate">{course.title}</span>
          </Link>
        </div>
        
        <div className="flex items-center p-4 border-b border-slate-100 bg-slate-50">
           <div className="w-full">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                <span>Progresso</span>
                <span>{courseProgressPercent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-blue-600 transition-all duration-1000" 
                  style={{ width: `${courseProgressPercent}%` }}
                />
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {modules.map((m, mIdx) => (
            <div key={m.id} className="mb-4">
              <div className="px-4 py-2 sticky top-0 bg-white z-10">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest leading-tight">
                  MÓDULO {mIdx + 1}
                </h4>
                <p className="text-sm font-bold text-slate-500 truncate mt-0.5" title={m.title}>{m.title}</p>
              </div>
              <div className="mt-1 space-y-0.5 px-2">
                {m.lessons.map((l) => {
                  const isActive = l.id === lessonId
                  const isBlocked = m.state === 'blocked'
                  return (
                    <Link
                      key={l.id}
                      to={isBlocked ? '#' : `/aluno/cursos/${courseId}/aulas/${l.id}`}
                      className={`group flex items-start gap-3 rounded-lg p-2.5 transition-all text-sm ${
                        isBlocked ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-slate-100/80 cursor-pointer'
                      } ${isActive ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                      onClick={(e) => {
                        if (isBlocked) e.preventDefault()
                      }}
                    >
                      <div className={`mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        l.is_completed 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : isActive ? 'border-blue-500 border-2' : 'bg-white border-slate-300'
                      }`}>
                         {l.is_completed ? (
                           <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                         ) : isActive ? (
                           <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                         ) : null}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className={`truncate font-medium ${isActive ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                          {l.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                          {l.lesson_type === 'video' ? (
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          ) : l.lesson_type === 'text' ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          ) : (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          )}
                          {l.estimated_minutes} min
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* TOPBAR */}
        <header className="shrink-0 h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M4 6h16M4 12h16M4 18h16" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1 border-l border-slate-200 pl-4">{currentLesson.title}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!prevItem || prevItem.isBlocked}
              onClick={() => navigate(`/aluno/cursos/${courseId}/aulas/${prevItem!.lessonId}`)}
              className="hidden sm:flex"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Anterior
            </Button>
            <Button
              size="sm"
              className="bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 hidden sm:flex"
              disabled={!nextItem || nextItem.isBlocked}
              onClick={() => navigate(`/aluno/cursos/${courseId}/aulas/${nextItem!.lessonId}`)}
            >
              Próxima
              <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Button>
          </div>
        </header>

        {/* LESSON CONTENT SCROLL AREA */}
        <div className="flex-1 overflow-y-auto w-full">
           <div className="mx-auto max-w-5xl p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 pb-24">
                          {/* TITLE AREA TOP */}
               <div className="space-y-4 pt-4 border-b border-slate-100 pb-8">
                 <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                       Aula Atual
                    </span>
                    {activeLessonDetails?.lesson_type === 'hybrid' && (
                       <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                          Vídeo + Texto
                       </span>
                    )}
                 </div>
                 <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">{currentLesson.title}</h1>
                 {(activeLessonDetails?.description || currentLesson.description) && (
                   <div className="text-lg font-medium text-slate-500 leading-relaxed max-w-3xl">
                     {activeLessonDetails?.description || currentLesson.description}
                   </div>
                 )}
               </div>

               {/* VIDEO PLAYER AREA */}
               {((lessonType === 'video' || lessonType === 'hybrid') && videoId) && (
                  <div className="w-full aspect-video rounded-[32px] overflow-hidden bg-black shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-500">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
               )}

               {/* TEXT CONTENT AREA */}
               {(lessonType === 'text' || lessonType === 'hybrid') && textContent && (
                <div className="w-full bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                   <div className="p-8 sm:p-12">
                      <div className="ql-container ql-snow border-none">
                         <div 
                            className="ql-editor !p-0 prose prose-slate prose-lg max-w-none text-slate-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: textContent }}
                         />
                      </div>
                   </div>
                   
                   <style>{`
                      .ql-editor table { width: 100% !important; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
                      .ql-editor th { background: #f8fafc; text-align: left; padding: 12px 16px; border-bottom: 2px solid #e2e8f0; font-weight: 800; color: #2563eb; }
                      .ql-editor td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
                      .ql-editor tr:nth-child(even) { background: #fcfcfd; }
                      .ql-editor p { margin-bottom: 1.25em; }
                      .ql-editor h3 { color: #0f172a; font-weight: 900; margin-top: 2em; margin-bottom: 1em; }
                      .ql-editor ul, .ql-editor ol { margin-bottom: 1.5em; }
                   `}</style>
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200 mt-12">
                 <button
                    disabled={isTogglingCompletion}
                    onClick={handleToggleCompletion}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                      currentLesson.is_completed 
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                 >
                    {isTogglingCompletion ? (
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : currentLesson.is_completed ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="h-5 w-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    {currentLesson.is_completed ? 'Aula Concluída' : 'Marcar como Concluída'}
                 </button>

                 <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      disabled={!prevItem || prevItem.isBlocked}
                      onClick={() => navigate(`/aluno/cursos/${courseId}/aulas/${prevItem!.lessonId}`)}
                      className="flex-1 sm:flex-none h-12"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Anterior
                    </Button>
                    <Button
                      className="flex-1 sm:flex-none h-12 bg-blue-600 hover:bg-blue-700 text-white text-base shadow-sm"
                      disabled={!nextItem || nextItem.isBlocked}
                      onClick={() => navigate(`/aluno/cursos/${courseId}/aulas/${nextItem!.lessonId}`)}
                    >
                      Próxima Aula
                      <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
