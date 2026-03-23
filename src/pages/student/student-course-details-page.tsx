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
  if (state === 'blocked') {
    return 'Bloqueado'
  }
  if (state === 'completed') {
    return 'Concluido'
  }
  return 'Em andamento'
}

function moduleStateClasses(state: ModuleLearningState) {
  if (state === 'blocked') {
    return 'bg-slate-200 text-slate-700'
  }
  if (state === 'completed') {
    return 'bg-green-100 text-green-700'
  }
  return 'bg-amber-100 text-amber-700'
}

function assessmentStateLabel(state: StudentCourseAssessmentSummary['state']) {
  if (state === 'blocked') return 'Bloqueada'
  if (state === 'approved') return 'Aprovada'
  if (state === 'failed_limit') return 'Limite de tentativas'
  return 'Disponivel'
}

function assessmentStateClasses(state: StudentCourseAssessmentSummary['state']) {
  if (state === 'blocked') return 'bg-slate-200 text-slate-700'
  if (state === 'approved') return 'bg-green-100 text-green-700'
  if (state === 'failed_limit') return 'bg-red-100 text-red-700'
  return 'bg-blue-100 text-blue-700'
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
        setError('Curso invalido.')
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
    return () => {
      isMounted = false
    }
  }, [courseId])

  async function handleToggleLessonCompletion(
    lessonId: string,
    isCurrentlyCompleted: boolean,
  ) {
    if (!user) {
      setError('Usuario nao autenticado.')
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

      if (!courseId) {
        return
      }
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
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="animate-pulse text-sm text-slate-600">Carregando detalhes do curso...</p>
      </div>
    )
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</p>
  }

  if (!course) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Acesso nao liberado</h2>
        <p className="text-sm text-slate-600">
          Este curso nao esta liberado para seu usuario. Se voce acredita que isso e um erro, entre em contato com o suporte.
        </p>
        <Button size="lg" asChild>
          <Link to="/aluno/cursos">Voltar para cursos liberados</Link>
        </Button>
      </div>
    )
  }

  const finalAssessment = assessments.find((a) => a.assessment_type === 'final')

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {courseStatus?.is_completed && (
        <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6 shadow-lg shadow-green-100 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-2xl font-extrabold text-green-900">Parabens! Curso Concluido.</h3>
            <p className="text-green-700 font-medium">Voce completou todos os requisitos e finalizou este treinamento com sucesso.</p>
          </div>
          <div className="sm:ml-auto">
             <Button className="bg-green-600 hover:bg-green-700" size="lg">Emitir Certificado</Button>
          </div>
        </div>
      )}

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Link to="/aluno/cursos" className="hover:text-amber-600 transition-colors">Meus Cursos</Link>
          <span>/</span>
          <span className="font-medium text-slate-900">{course.title}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{course.title}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Carga horaria: {course.workload_hours}h
              </span>
              <span>•</span>
              <span>{modules.length} {modules.length === 1 ? 'Modulo' : 'Modulos'}</span>
            </div>
          </div>
        </div>
        {course.description ? (
          <p className="max-w-3xl text-base text-slate-600 leading-relaxed">{course.description}</p>
        ) : null}
      </header>

      <section className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          Conteudo do Curso
        </h3>
        
        <div className="grid gap-4">
          {modules.map((module) => {
            const moduleAssessment = assessments.find(
              (a) => a.assessment_type === 'module' && a.module_id === module.id
            )

            return (
              <article 
                key={module.id} 
                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
                  module.state === 'blocked' ? 'opacity-80' : 'hover:border-amber-200 hover:shadow-md'
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                        module.state === 'completed' ? 'bg-green-100 text-green-700' : 
                        module.state === 'blocked' ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {module.position}
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">
                        {module.title}
                      </h4>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${moduleStateClasses(module.state)}`}
                    >
                      {moduleStateLabel(module.state)}
                    </span>
                  </div>
                  
                  {module.description ? (
                    <p className="mt-2 text-sm text-slate-600">{module.description}</p>
                  ) : null}

                  {module.state !== 'blocked' && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                          <span>Progresso do modulo</span>
                          <span>{module.progress_percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div 
                            className="h-full rounded-full bg-amber-500 transition-all duration-500" 
                            style={{ width: `${module.progress_percent}%` }}
                          />
                        </div>
                      </div>

                      <ul className="space-y-2">
                        {module.lessons.map((lesson) => (
                          <li 
                            key={lesson.id}
                            className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
                          >
                            <div className="flex gap-3">
                              <div className="mt-1">
                                {lesson.is_completed ? (
                                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {lesson.title}
                                  {lesson.is_required && (
                                    <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-400">Obrigatoria</span>
                                  )}
                                </p>
                                {lesson.youtube_url && (
                                  <a
                                    href={lesson.youtube_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                                  >
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                    Assistir no YouTube
                                  </a>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={lesson.is_completed ? 'ghost' : 'outline'}
                              className={lesson.is_completed ? 'text-slate-500' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}
                              disabled={isSavingLessonId === lesson.id}
                              onClick={() => void handleToggleLessonCompletion(lesson.id, lesson.is_completed)}
                            >
                              {isSavingLessonId === lesson.id
                                ? '...'
                                : lesson.is_completed
                                  ? 'Concluida'
                                  : 'Marcar concluida'}
                            </Button>
                          </li>
                        ))}
                      </ul>

                      {moduleAssessment && (
                        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{moduleAssessment.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${assessmentStateClasses(moduleAssessment.state)}`}>
                                    {assessmentStateLabel(moduleAssessment.state)}
                                  </span>
                                  {moduleAssessment.last_score !== null && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Nota: {moduleAssessment.last_score}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              disabled={moduleAssessment.state === 'blocked' || moduleAssessment.state === 'failed_limit'}
                              variant={moduleAssessment.state === 'approved' ? 'outline' : 'default'}
                              asChild
                            >
                              <Link to={`/aluno/cursos/${courseId}/avaliacoes/${moduleAssessment.assessment_id}`}>
                                {moduleAssessment.state === 'approved' ? 'Refazer (Opcional)' : 'Fazer Avaliacao'}
                              </Link>
                            </Button>
                          </div>
                          {moduleAssessment.state === 'blocked' && (
                            <p className="mt-2 text-[10px] text-slate-500 italic">
                              * Conclua todas as aulas obrigatorias para liberar esta avaliacao.
                            </p>
                          )}
                          {moduleAssessment.state === 'failed_limit' && (
                            <p className="mt-2 text-[10px] text-red-500 font-medium">
                              * Voce atingiu o limite de {moduleAssessment.max_attempts} tentativas. Entre em contato com o suporte.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {module.state === 'blocked' && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Conteudo bloqueado ate a conclusao dos modulos anteriores.
                    </div>
                  )}
                </div>
              </article>
            )
          })}

          {modules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-slate-500">Nenhum modulo publicado ainda para este curso.</p>
            </div>
          ) : null}
        </div>
      </section>

      {finalAssessment && (
        <section className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Avaliacao Final</h3>
          <article className={`rounded-xl border overflow-hidden transition-all ${
            finalAssessment.state === 'blocked' ? 'bg-slate-50 border-slate-200' : 
            finalAssessment.state === 'approved' ? 'bg-green-50/30 border-green-100' : 'bg-amber-50/30 border-amber-100'
          }`}>
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    finalAssessment.state === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">{finalAssessment.title}</h4>
                    <p className="text-sm text-slate-600 mt-0.5">Prove seus conhecimentos e conclua o curso com sucesso.</p>
                    <div className="flex items-center gap-3 mt-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${assessmentStateClasses(finalAssessment.state)}`}>
                        {assessmentStateLabel(finalAssessment.state)}
                      </span>
                      {finalAssessment.last_score !== null && (
                        <span className="text-xs font-bold text-slate-700">
                          Pontuagem atual: {finalAssessment.last_score}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className={finalAssessment.state === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                  disabled={finalAssessment.state === 'blocked' || finalAssessment.state === 'failed_limit'}
                  asChild
                >
                  <Link to={`/aluno/cursos/${courseId}/avaliacoes/${finalAssessment.assessment_id}`}>
                    {finalAssessment.state === 'approved' ? 'Refazer Avaliacao' : 'Iniciar Prova Final'}
                  </Link>
                </Button>
              </div>
              
              {finalAssessment.state === 'blocked' && (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-medium border-t pt-4">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  A prova final so sera liberada apos a conclusao de todos os modulos obrigatorios do curso.
                </div>
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  )
}
