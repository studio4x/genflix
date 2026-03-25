import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, Outlet } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourseById,
  fetchStudentCourseContentWithProgress,
  toErrorMessage,
} from '@/features/student/courses/api'
import {
  fetchStudentCourseAssessments,
  type StudentCourseAssessmentSummary,
} from '@/features/student/assessments/api'
import { fetchAdminCourseTree, type AdminCourseTree } from '@/features/admin/content/api'
import type { Course, StudentCourseModuleProgress } from '@/types/content'

export function StudentCoursePlayerLayout() {
  const { courseId, lessonId, assessmentId } = useParams<{ courseId: string; lessonId?: string; assessmentId?: string }>()
  const navigate = useNavigate()
  const { roles } = useAuth()
  
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<StudentCourseModuleProgress[]>([])
  const [assessments, setAssessments] = useState<StudentCourseAssessmentSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      if (!courseId) return
      setIsLoading(true)
      const isAdmin = roles.includes('admin')
      try {
        if (isAdmin) {
          const tree: AdminCourseTree = await fetchAdminCourseTree(courseId)
          if (isMounted) {
            setCourse(tree.course)
            setModules(tree.modules.map(m => ({
              id: m.id,
              course_id: m.course_id,
              position: m.position,
              title: m.title,
              description: m.description,
              is_required: m.is_required,
              state: 'in_progress',
              is_unlocked: true,
              is_completed: false,
              required_lessons_total: m.lessons.filter(l => l.is_required).length,
              required_lessons_completed: 0,
              has_required_assessment: m.assessments.some(a => a.is_required),
              required_assessment_approved: false,
              progress_percent: 0,
              lessons: m.lessons.map(l => ({
                id: l.id,
                module_id: l.module_id,
                position: l.position,
                title: l.title,
                description: l.description,
                is_required: l.is_required,
                lesson_type: l.lesson_type,
                youtube_url: l.youtube_url,
                text_content: l.text_content,
                estimated_minutes: l.estimated_minutes,
                is_completed: false,
                completed_at: null
              }))
            })))
            setAssessments([
               ...tree.courseAssessments.map(a => ({
                 assessment_id: a.id,
                 title: a.title,
                 assessment_type: a.assessment_type as 'module' | 'final',
                 module_id: null,
                 module_position: null,
                 description: a.description,
                 is_required: a.is_required,
                 passing_score: a.passing_score,
                 max_attempts: a.max_attempts,
                 is_active: a.is_active,
                 is_unlocked: true,
                 attempts_used: 0,
                 last_score: null,
                 last_is_approved: false,
                 remaining_attempts: a.max_attempts,
                 state: 'available' as const
               })),
               ...tree.modules.flatMap(m => m.assessments.map(a => ({
                 assessment_id: a.id,
                 title: a.title,
                 assessment_type: a.assessment_type as 'module' | 'final',
                 module_id: m.id,
                 module_position: m.position,
                 description: a.description,
                 is_required: a.is_required,
                 passing_score: a.passing_score,
                 max_attempts: a.max_attempts,
                 is_active: a.is_active,
                 is_unlocked: true,
                 attempts_used: 0,
                 last_score: null,
                 last_is_approved: false,
                 remaining_attempts: a.max_attempts,
                 state: 'available' as const
               })))
            ])
          }
        } else {
          const [courseResult, modulesResult, assessmentsResult] = await Promise.all([
            fetchReleasedCourseById(courseId),
            fetchStudentCourseContentWithProgress(courseId),
            fetchStudentCourseAssessments(courseId),
          ])
          if (isMounted) {
            setCourse(courseResult)
            setModules(modulesResult)
            setAssessments(assessmentsResult)
          }
        }
      } catch (err) {
        if (isMounted) setError(toErrorMessage(err))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void loadData()
    return () => { isMounted = false }
  }, [courseId, roles])

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
                      to={isBlocked ? '#' : `/aluno/cursos/${courseId}/player/aulas/${l.id}`}
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

                {/* MODULAR QUIZZES IN SIDEBAR */}
                {(() => {
                   const moduleQuiz = assessments.find(a => a.assessment_type === 'module' && a.module_id === m.id)
                   if (!moduleQuiz) return null
                   const isLocked = m.state === 'blocked' || moduleQuiz.state === 'blocked'
                   const isFailedLimit = moduleQuiz.state === 'failed_limit'
                   const isActive = moduleQuiz.assessment_id === assessmentId
                   const isApproved = moduleQuiz.state === 'approved'

                   return (
                      <Link 
                         key={moduleQuiz.assessment_id} 
                         to={isLocked ? '#' : `/aluno/cursos/${courseId}/player/avaliacoes/${moduleQuiz.assessment_id}`}
                         onClick={(e) => isLocked && e.preventDefault()}
                         className={`relative mt-2 p-3 rounded-2xl border-2 transition-all group flex items-start gap-3 ${
                            isLocked ? 'opacity-50 cursor-not-allowed grayscale bg-slate-50 border-slate-100' :
                            isFailedLimit ? 'border-rose-100 bg-rose-50/30 hover:border-rose-200' :
                            isActive ? 'border-blue-600 bg-blue-50 shadow-md ring-4 ring-blue-600/5' : 
                            isApproved ? 'border-emerald-100 bg-emerald-50/50' :
                            'border-slate-100 bg-white hover:border-blue-200'
                         }`}
                      >
                         <div className={`mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-lg border transition-colors ${
                           isApproved ? 'bg-emerald-500 border-emerald-500 text-white' : 
                           isFailedLimit ? 'bg-rose-100 border-rose-200 text-rose-500' :
                           'bg-white border-blue-400 text-blue-500'
                         }`}>
                           {isApproved ? (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                           ) : (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                           )}
                         </div>
                         <div className="flex-1 overflow-hidden">
                            <p className={`truncate font-black text-[10px] uppercase tracking-tighter ${isFailedLimit ? 'text-rose-600' : 'text-blue-600'}`}>
                               {isFailedLimit ? 'TENTATIVAS ESGOTADAS' : 'QUIZ DO MÓDULO'}
                            </p>
                            <p className={`truncate font-bold ${isApproved ? 'text-emerald-700' : isFailedLimit ? 'text-rose-900' : 'text-slate-700'}`}>{moduleQuiz.title}</p>
                         </div>
                      </Link>
                   )
                })()}
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
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1 border-l border-slate-200 pl-4 uppercase tracking-wider text-[10px]">{course.title}</h2>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-3">
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seu Progresso</p>
                 <p className="text-xs font-bold text-slate-900">{courseProgressPercent}% Conclruído</p>
               </div>
               <div className="h-8 w-px bg-slate-100" />
             </div>
             <Link to={`/aluno/cursos/${courseId}`} className="text-xs font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">
               Sair do Player
             </Link>
          </div>
        </header>

        {/* CONTENT (Outlet) */}
        <div className="flex-1 overflow-y-auto w-full no-scrollbar">
           <Outlet context={{ modules, assessments, setModules, setAssessments }} />
        </div>
      </main>
    </div>
  )
}
