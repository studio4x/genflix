import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourseById,
  fetchStudentCourseContentWithProgress,
  setLessonCompletion,
  toErrorMessage,
} from '@/features/student/courses/api'
import {
  fetchStudentCourseAssessments,
  type StudentCourseAssessmentSummary,
} from '@/features/student/assessments/api'
import { supabase } from '@/services/supabase/client'
import type { Course, ModuleLearningState, StudentCourseModuleProgress } from '@/types/content'

interface StudentCourseStatus {
  is_completed: boolean
  required_modules_total: number
  required_modules_completed: number
  has_required_final_assessment: boolean
  required_final_assessment_approved: boolean
}

function moduleStateLabel(state: ModuleLearningState) {
  if (state === 'blocked') return 'Bloqueado'
  if (state === 'completed') return 'Concluído'
  return 'Em Andamento'
}

function moduleStateClasses(state: ModuleLearningState) {
  if (state === 'blocked') return 'bg-slate-100 text-slate-500 ring-slate-200'
  if (state === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  return 'bg-blue-50 text-blue-700 ring-blue-200'
}

export function StudentCourseDetailsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<StudentCourseModuleProgress[]>([])
  const [assessments, setAssessments] = useState<StudentCourseAssessmentSummary[]>([])
  const [courseStatus, setCourseStatus] = useState<StudentCourseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingLessonId, setIsSavingLessonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadCourseDetails() {
      if (!courseId) {
        setError('Curso inválido.')
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const [courseResult, modulesResult, assessmentsResult, statusResult] = await Promise.all([
          fetchReleasedCourseById(courseId),
          fetchStudentCourseContentWithProgress(courseId),
          fetchStudentCourseAssessments(courseId),
          supabase.rpc('get_student_course_status', { _course_id: courseId }),
        ])
        if (isMounted) {
          setCourse(courseResult)
          setModules(modulesResult)
          setAssessments(assessmentsResult)
          setCourseStatus(statusResult.data?.[0] as StudentCourseStatus ?? null)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(toErrorMessage(loadError))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadCourseDetails()
    return () => { isMounted = false }
  }, [courseId])

  async function handleToggleLessonCompletion(lessonId: string, isCurrentlyCompleted: boolean) {
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }
    setError(null)
    setIsSavingLessonId(lessonId)
    try {
      await setLessonCompletion({
        user_id: user.id,
        lesson_id: lessonId,
        is_completed: !isCurrentlyCompleted,
      })
      if (!courseId) return
      const [refreshedModules, refreshedAssessments, statusResult] = await Promise.all([
        fetchStudentCourseContentWithProgress(courseId),
        fetchStudentCourseAssessments(courseId),
        supabase.rpc('get_student_course_status', { _course_id: courseId }),
      ])
      setModules(refreshedModules)
      setAssessments(refreshedAssessments)
      setCourseStatus(statusResult.data?.[0] as StudentCourseStatus ?? null)
    } catch (toggleError) {
      setError(toErrorMessage(toggleError))
    } finally {
      setIsSavingLessonId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-6">
        <div className="relative h-16 w-16">
           <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
           <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        </div>
        <p className="animate-pulse text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Povoando seu ecossistema...</p>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-[32px] border border-rose-100 bg-rose-50 p-8 text-sm font-bold text-rose-600 shadow-sm flex items-center gap-4">{error}</div>
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 rounded-[48px] border border-slate-200 bg-white p-20 text-center shadow-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-[32px] bg-slate-50 text-slate-400 border border-slate-100">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Acesso Restrito</h2>
          <p className="text-base text-slate-500 leading-relaxed font-medium">
            Este conteúdo está em uma área restrita ou o curso ainda não foi liberado para você.
          </p>
        </div>
        <Button size="lg" className="bg-slate-900 hover:bg-slate-800 rounded-2xl h-14 px-8" asChild>
          <Link to="/aluno/cursos">Voltar aos meus cursos</Link>
        </Button>
      </div>
    )
  }

  const finalAssessment = assessments.find((a) => a.assessment_type === 'final')
  
  const totalCompleted = modules.filter(m => m.state === 'completed').length
  const totalModules = modules.length
  const courseProgressPercent = totalModules === 0 ? 0 : Math.round((totalCompleted / totalModules) * 100)

  return (
    <div className="space-y-12 pb-24 animate-in fade-in duration-700">
      
      {/* HERO SECTION */}
      <section className="relative rounded-[48px] overflow-hidden bg-slate-900 min-h-[400px] flex flex-col justify-end p-8 md:p-16 shadow-2xl">
         {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
         ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-950 opacity-100" />
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent z-10" />

         <div className="relative z-20 space-y-6 max-w-4xl">
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400">
              <Link to="/aluno/cursos" className="hover:text-white transition-colors">Meus Cursos</Link>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/60 truncate">{course.title}</span>
            </nav>

            <div className="space-y-4">
               <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                  {course.title}
               </h1>
               <div className="flex flex-wrap items-center gap-6">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     {course.workload_hours} Horas
                  </span>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z" /></svg>
                     {totalModules} Módulos
                  </span>
                  <div className="h-6 w-px bg-white/10 hidden md:block" />
                  <div className="flex items-center gap-3">
                     <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${courseProgressPercent}%` }} />
                     </div>
                     <span className="text-sm font-black text-white">{courseProgressPercent}% <span className="text-[10px] uppercase text-white/40 ml-1">Concluído</span></span>
                  </div>
               </div>
            </div>

            <div className="pt-4">
               <Button className="bg-white text-slate-900 hover:bg-slate-100 h-16 px-10 rounded-2xl font-black text-lg shadow-xl" asChild>
                  <Link to={modules[0]?.lessons[0] ? `/aluno/cursos/${courseId}/aulas/${modules[0].lessons[0].id}` : '#'}>
                     Continuar Aprendizado
                  </Link>
               </Button>
            </div>
         </div>
      </section>

      {/* CONGRATS ALERT */}
      {courseStatus?.is_completed && (
        <div className="rounded-[40px] bg-gradient-to-r from-emerald-500 to-teal-600 p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-emerald-200 animate-in zoom-in duration-700">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] bg-white/20 backdrop-blur-md text-white shadow-inner">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="space-y-2 text-center md:text-left flex-1">
            <h3 className="text-3xl font-black text-white leading-none">Missão Cumprida!</h3>
            <p className="text-emerald-50 text-lg font-medium">
              Você completou este curso com maestria. Seu empenho é o que define a qualidade HomeCare Match.
            </p>
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white border-transparent text-emerald-700 font-black text-base hover:bg-emerald-50 shadow-lg">
             Baixar Certificado
          </Button>
        </div>
      )}

      {/* CURRICULUM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">
         
         <div className="space-y-12">
            <div className="flex items-center gap-4">
               <h3 className="text-3xl font-black text-slate-900 tracking-tight">Grade Curricular</h3>
               <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="space-y-8">
               {modules.map((module, mIdx) => {
                  const moduleAssessment = assessments.find(a => a.assessment_type === 'module' && a.module_id === module.id)
                  const isBlocked = module.state === 'blocked'

                  return (
                     <div key={module.id} className={`group ${isBlocked ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-6">
                           <div className="hidden md:flex flex-col items-center gap-2 pt-2">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-all ${
                                 module.state === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' :
                                 isBlocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                              }`}>
                                 {module.state === 'completed' ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : mIdx + 1}
                              </div>
                              <div className="w-0.5 flex-1 bg-slate-100 group-last:hidden min-h-[100px]" />
                           </div>

                           <div className="flex-1 space-y-6">
                              <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm group-hover:shadow-md transition-all">
                                 <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                    <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{module.title}</h4>
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${moduleStateClasses(module.state)}`}>
                                       {moduleStateLabel(module.state)}
                                    </span>
                                 </div>
                                 <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">{module.description || "Inicie este módulo para explorar os fundamentos e técnicas deste tópico."}</p>

                                 {!isBlocked ? (
                                    <div className="space-y-4">
                                          {module.lessons.map(lesson => (
                                             <div key={lesson.id} className="flex items-center gap-2 group/item">
                                                <button
                                                   type="button"
                                                   disabled={isSavingLessonId === lesson.id}
                                                   onClick={(e) => {
                                                      e.preventDefault();
                                                      void handleToggleLessonCompletion(lesson.id, lesson.is_completed);
                                                   }}
                                                   className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                                      lesson.is_completed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 hover:text-blue-500 shadow-inner'
                                                   }`}
                                                >
                                                   {isSavingLessonId === lesson.id ? (
                                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                   ) : lesson.is_completed ? (
                                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                   ) : (
                                                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                   )}
                                                </button>
                                                <Link to={`/aluno/cursos/${courseId}/aulas/${lesson.id}`} className="flex-1 flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all">
                                                   <div>
                                                      <p className={`text-sm font-bold ${lesson.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{lesson.title}</p>
                                                      {lesson.is_required && <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Obrigatória</span>}
                                                   </div>
                                                   <svg className="h-4 w-4 text-slate-300 transition-transform group-hover/item:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </Link>
                                             </div>
                                          ))}

                                       {moduleAssessment && (
                                          <div className={`mt-6 p-6 rounded-[24px] border border-dashed transition-all ${
                                             moduleAssessment.state === 'approved' ? 'bg-emerald-50/30 border-emerald-200' :
                                             moduleAssessment.state === 'blocked' ? 'bg-slate-50/50 border-slate-200 opacity-60' :
                                             'bg-blue-50/30 border-blue-200'
                                          }`}>
                                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                                <div className="space-y-1">
                                                   <div className="flex items-center gap-2">
                                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${moduleAssessment.state === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                         <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                      </div>
                                                      <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{moduleAssessment.title}</span>
                                                   </div>
                                                   <p className="text-xs font-medium text-slate-400">Avaliação Obrigatória do Módulo</p>
                                                </div>
                                                <Button size="sm" asChild disabled={moduleAssessment.state === 'blocked'} className={`h-11 px-6 rounded-xl font-black ${moduleAssessment.state === 'approved' ? 'bg-white text-emerald-600 border-emerald-200 shadow-sm' : 'bg-blue-600'}`}>
                                                   <Link to={`/aluno/cursos/${courseId}/avaliacoes/${moduleAssessment.assessment_id}`}>
                                                      {moduleAssessment.state === 'approved' ? 'Refazer Quiz' : 'Iniciar Quiz'}
                                                   </Link>
                                                </Button>
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-[24px] border border-slate-100 text-slate-400">
                                       <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                       <span className="text-sm font-bold uppercase tracking-widest">Conteúdo Bloqueado</span>
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  )
               })}
            </div>
         </div>

         {/* SIDEBAR */}
         <aside className="space-y-8 sticky top-8">
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 space-y-8">
               <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Resumo da Jornada</h5>
                  <div className="relative w-32 h-32 mx-auto">
                     <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * courseProgressPercent) / 100} strokeLinecap="round" className="text-blue-600 transition-all duration-1000" />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-900">{courseProgressPercent}%</span>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <span className="text-slate-500 uppercase">Módulos</span>
                     <span className="text-slate-900">{totalCompleted} / {totalModules}</span>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-medium text-slate-400 leading-relaxed uppercase tracking-widest">
                        {courseStatus?.is_completed ? "Todos os requisitos foram atendidos." : "Complete todos os módulos para liberar o certificado final."}
                     </p>
                  </div>
               </div>
            </div>

            {finalAssessment && (
               <div className={`p-8 rounded-[40px] border transition-all ${
                  finalAssessment.state === 'approved' ? 'bg-emerald-500 text-white shadow-emerald-100 border-emerald-400 shadow-2xl' :
                  finalAssessment.state === 'blocked' ? 'bg-white text-slate-400 border-slate-100 shadow-sm opacity-60' :
                  'bg-blue-600 text-white shadow-blue-100 border-blue-500 shadow-2xl'
               }`}>
                  <div className="space-y-6">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${finalAssessment.state === 'approved' ? 'bg-white/20' : 'bg-white/10'} backdrop-blur-sm`}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                     </div>
                     <div className="space-y-2">
                        <h4 className="text-xl font-black tracking-tight">{finalAssessment.title}</h4>
                        <p className="text-sm font-medium opacity-80 leading-relaxed">
                           {finalAssessment.state === 'approved' ? "Você foi aprovado! Baixe seu certificado acima." : "Teste final para consolidar seu conhecimento."}
                        </p>
                     </div>
                     <Button asChild disabled={finalAssessment.state === 'blocked'} className={`w-full h-14 rounded-2xl font-black ${
                        finalAssessment.state === 'approved' ? 'bg-white text-emerald-600 hover:bg-emerald-50' : 'bg-white text-blue-600 hover:bg-slate-50'
                     }`}>
                        <Link to={`/aluno/cursos/${courseId}/avaliacoes/${finalAssessment.assessment_id}`}>
                           {finalAssessment.state === 'approved' ? 'Refazer Prova' : 'Iniciar Prova Final'}
                        </Link>
                     </Button>
                  </div>
               </div>
            )}
         </aside>
      </div>

    </div>
  )
}
