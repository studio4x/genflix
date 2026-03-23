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

function assessmentStateLabel(state: StudentCourseAssessmentSummary['state']) {
  if (state === 'blocked') return 'Bloqueada'
  if (state === 'approved') return 'Aprovada'
  if (state === 'failed_limit') return 'Limite Atingido'
  return 'Disponível'
}

function assessmentStateClasses(state: StudentCourseAssessmentSummary['state']) {
  if (state === 'blocked') return 'bg-slate-100 text-slate-500 border-slate-200'
  if (state === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (state === 'failed_limit') return 'bg-rose-50 text-rose-700 border-rose-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
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
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="animate-pulse text-sm font-medium text-slate-500">Preparando ambiente de aprendizado...</p>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">{error}</div>
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Este curso não está disponível para o seu perfil no momento. Se você acredita que isso é um erro, entre em contato com o suporte.
          </p>
        </div>
        <Button size="lg" className="bg-slate-900 hover:bg-slate-800" asChild>
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
    <div className="mx-auto max-w-5xl space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* Header and Metadados */}
      <header className="space-y-6">
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Link to="/aluno/cursos" className="hover:text-blue-600 transition-colors">Meus Cursos</Link>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-slate-900 truncate max-w-[200px] sm:max-w-xs">{course.title}</span>
        </nav>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4 max-w-3xl flex-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {course.title}
            </h1>
            {course.description && (
              <p className="text-base text-slate-500 leading-relaxed">
                {course.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-600">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {course.workload_hours} horas
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z" /></svg>
                {totalModules} Módulos
              </span>
            </div>
          </div>

          <div className="w-full lg:w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700">Seu Progresso</span>
              <span className="text-xl font-extrabold text-blue-600">{courseProgressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div 
                className="h-full rounded-full bg-blue-600 transition-all duration-1000 ease-out" 
                style={{ width: `${courseProgressPercent}%` }}
              />
            </div>
            {courseStatus?.is_completed && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Treinamento concluído!
              </p>
            )}
          </div>
        </div>
      </header>

      {courseStatus?.is_completed && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="space-y-1 text-center sm:text-left flex-1">
            <h3 className="text-2xl font-extrabold text-emerald-900 tracking-tight">Parabéns pela dedicação!</h3>
            <p className="text-emerald-700 font-medium leading-relaxed">
              Você completou com sucesso todos os requisitos deste treinamento. Seu esforço contribui para um atendimento de excelência.
            </p>
          </div>
          <div className="sm:ml-auto shrink-0 w-full sm:w-auto">
             <Button variant="outline" disabled size="lg" className="w-full bg-white border-emerald-200 text-emerald-700">Certificado (Breve)</Button>
          </div>
        </div>
      )}

      {/* Modules List */}
      <section className="space-y-6">
        <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
          Jornada de Aprendizado
        </h3>
        
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-[0.5px] md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
          {modules.map((module, index) => {
            const moduleAssessment = assessments.find(
              (a) => a.assessment_type === 'module' && a.module_id === module.id
            )
            const isBlocked = module.state === 'blocked'

            return (
              <article 
                key={module.id} 
                className={`relative flex items-start md:items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${isBlocked ? 'opacity-60 grayscale-[50%]' : ''}`}
              >
                {/* Timeline dot */}
                <div className={`mt-6 md:mt-0 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ${
                  module.state === 'completed' ? 'bg-emerald-500 text-white' : 
                  module.state === 'blocked' ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white'
                }`}>
                  {module.state === 'completed' ? (
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <span className="font-bold">{index + 1}</span>
                  )}
                </div>

                {/* Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300">
                  <div className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h4 className="text-lg font-bold text-slate-900 leading-tight">
                        {module.title}
                      </h4>
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ring-1 ring-inset ${moduleStateClasses(module.state)}`}>
                        {moduleStateLabel(module.state)}
                      </span>
                    </div>
                    
                    {module.description && (
                      <p className="text-sm text-slate-500 leading-relaxed mb-6">
                        {module.description}
                      </p>
                    )}

                    {!isBlocked ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                            <span className="uppercase tracking-wider">Aulas concluídas</span>
                            <span className="text-slate-700">{module.progress_percent}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-700 ${module.progress_percent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                              style={{ width: `${module.progress_percent}%` }}
                            />
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 border-t border-slate-100 pt-4">
                          {module.lessons.map((lesson) => (
                            <div key={lesson.id} className="py-3 group/lesson flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  disabled={isSavingLessonId === lesson.id}
                                  onClick={() => void handleToggleLessonCompletion(lesson.id, lesson.is_completed)}
                                  className={`mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                                    lesson.is_completed 
                                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                                      : 'bg-white border-slate-300 hover:border-blue-500 text-transparent hover:text-blue-100'
                                  }`}
                                >
                                   {isSavingLessonId === lesson.id ? (
                                     <svg className="animate-spin h-3 w-3 text-current" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                   ) : (
                                     <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                   )}
                                </button>
                                <div>
                                  <p className={`text-sm font-semibold transition-colors ${lesson.is_completed ? 'text-slate-500' : 'text-slate-800'}`}>
                                    {lesson.title}
                                    {lesson.is_required && (
                                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Obrigatória</span>
                                    )}
                                  </p>
                                  {lesson.youtube_url && !lesson.is_completed && (
                                    <a
                                      href={lesson.youtube_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                                    >
                                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                      Assistir Aula
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {moduleAssessment && (
                          <div className={`mt-4 rounded-xl border p-4 transition-all ${
                             moduleAssessment.state === 'blocked' ? 'border-slate-100 bg-slate-50' :
                             moduleAssessment.state === 'approved' ? 'border-emerald-100 bg-emerald-50/50' :
                             'border-blue-100 bg-blue-50/50'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <svg className={`h-4 w-4 ${moduleAssessment.state === 'approved' ? 'text-emerald-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <p className="text-sm font-bold text-slate-900">{moduleAssessment.title}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${assessmentStateClasses(moduleAssessment.state)}`}>
                                    {assessmentStateLabel(moduleAssessment.state)}
                                  </span>
                                  {moduleAssessment.last_score !== null && (
                                    <span className="text-xs font-semibold text-slate-600">
                                      Nota: {moduleAssessment.last_score}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                disabled={moduleAssessment.state === 'blocked' || moduleAssessment.state === 'failed_limit'}
                                className={moduleAssessment.state === 'approved' ? 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 shadow-sm' : 'bg-blue-600 hover:bg-blue-700 shadow-sm'}
                                asChild
                              >
                                <Link to={`/aluno/cursos/${courseId}/avaliacoes/${moduleAssessment.assessment_id}`}>
                                  {moduleAssessment.state === 'approved' ? 'Refazer (Opcional)' : 'Iniciar Avaliação'}
                                </Link>
                              </Button>
                            </div>
                            {moduleAssessment.state === 'blocked' && (
                              <p className="mt-3 text-[11px] font-medium text-slate-500">
                                Conclua todas as aulas para liberar esta avaliação.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-400 bg-slate-50 p-4 rounded-xl">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        O conteúdo ficará disponível na sua vez. Conclua os módulos anteriores.
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
                 {modules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-slate-500">Nenhum módulo publicado ainda para este curso.</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Avaliação Final */}
      {finalAssessment && (
        <section className="pt-8">
          <div className={`relative overflow-hidden rounded-3xl border-2 transition-all p-8 sm:p-10 ${
            finalAssessment.state === 'blocked' ? 'border-slate-200 bg-white' : 
            finalAssessment.state === 'approved' ? 'border-emerald-200 bg-emerald-50/50 shadow-lg shadow-emerald-100/50' : 
            finalAssessment.state === 'failed_limit' ? 'border-rose-200 bg-rose-50/50' :
            'border-blue-200 bg-gradient-to-br from-blue-50/80 to-white shadow-lg shadow-blue-100/50'
          }`}>
            <div className={`relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left ${finalAssessment.state === 'blocked' ? 'opacity-80' : ''}`}>
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                finalAssessment.state === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-600 text-white'
              }`}>
                {finalAssessment.state === 'blocked' ? (
                  <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                ) : (
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{finalAssessment.title}</h3>
                  <span className={`px-2.5 py-1 rounded-sm border text-[10px] font-bold uppercase tracking-widest ${assessmentStateClasses(finalAssessment.state)}`}>
                    {assessmentStateLabel(finalAssessment.state)}
                  </span>
                </div>
                <p className="text-base text-slate-500 max-w-2xl">
                  {finalAssessment.state === 'approved' 
                    ? 'Avaliação concluída com excelência. Se desejar, você pode refazê-la para melhorar sua nota.'
                    : 'Prove todos os seus conhecimentos adquiridos ao longo da jornada e conclua o curso definitivamente.'}
                </p>
                {finalAssessment.last_score !== null && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-bold shadow-sm ring-1 ring-slate-100 text-slate-700">
                      Sua Nota Oficial: {finalAssessment.last_score}%
                    </span>
                  </div>
                )}
              </div>
              <div className="shrink-0 w-full md:w-auto">
                <Button 
                  size="lg" 
                  className={`w-full md:w-auto h-14 px-8 text-base shadow-sm ${
                    finalAssessment.state === 'approved' ? 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={finalAssessment.state === 'blocked' || finalAssessment.state === 'failed_limit'}
                  asChild
                >
                  <Link to={`/aluno/cursos/${courseId}/avaliacoes/${finalAssessment.assessment_id}`}>
                    {finalAssessment.state === 'approved' ? 'Refazer Prova' : 'Iniciar Prova Final'}
                  </Link>
                </Button>
              </div>
            </div>
            {finalAssessment.state === 'blocked' && (
              <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col items-center justify-center gap-2 text-sm font-medium text-slate-500 text-center">
                Você deve concluir todos os módulos e avaliações modulares obrigatorios para liberar a certificação final.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
