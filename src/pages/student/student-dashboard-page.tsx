import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchStartedCourseIds,
  fetchReleasedCourses,
  fetchStudentCoursesStatusMap,
  getStudentCourseJourneyStatus,
  toErrorMessage,
  type StudentCourseJourneyStatus,
  type StudentCourseStatus,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

function getFirstName(fullName: string | null | undefined, email: string | null | undefined) {
  if (fullName?.trim()) {
    return fullName.trim().split(' ')[0]
  }

  if (email?.trim()) {
    return email.split('@')[0]
  }

  return 'Aluno'
}

function sanitizeDescription(description: string | null) {
  if (!description) {
    return 'Conteúdo liberado para desenvolver sua prática profissional com mais segurança.'
  }

  return description.replace(/<[^>]*>?/gm, '').trim()
}

function getLearningActionLabel(hasStartedCourse: boolean) {
  return hasStartedCourse ? 'Continuar Aprendizado' : 'Iniciar Aprendizado'
}

export function StudentDashboardPage() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseStatuses, setCourseStatuses] = useState<Map<string, StudentCourseStatus | null>>(new Map())
  const [startedCourseIds, setStartedCourseIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const releasedCourses = await fetchReleasedCourses()
      const courseIds = releasedCourses.map((course) => course.id)
      const [statusMap, startedIds] = await Promise.all([
        fetchStudentCoursesStatusMap(courseIds),
        fetchStartedCourseIds(courseIds),
      ])
      setCourses(releasedCourses)
      setCourseStatuses(statusMap)
      setStartedCourseIds(startedIds)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const firstName = getFirstName(profile?.full_name, profile?.email)

  const journeySummary = useMemo(() => {
    let completed = 0
    let finalPending = 0
    let inProgress = 0

    for (const course of courses) {
      const journeyStatus: StudentCourseJourneyStatus = getStudentCourseJourneyStatus(courseStatuses.get(course.id) ?? null)
      if (journeyStatus === 'completed') {
        completed += 1
      } else if (journeyStatus === 'final_pending') {
        finalPending += 1
      } else {
        inProgress += 1
      }
    }

    return {
      total: courses.length,
      completed,
      finalPending,
      inProgress,
    }
  }, [courseStatuses, courses])

  const featuredCourse = useMemo(() => {
    return courses.find((course) => {
      const journeyStatus = getStudentCourseJourneyStatus(courseStatuses.get(course.id) ?? null)
      return journeyStatus !== 'completed'
    }) ?? courses[0] ?? null
  }, [courseStatuses, courses])

  const recommendedCourses = useMemo(() => {
    const prioritizedCourses = courses.filter((course) => {
      const journeyStatus = getStudentCourseJourneyStatus(courseStatuses.get(course.id) ?? null)
      return journeyStatus !== 'completed'
    })

    const source = prioritizedCourses.length > 0 ? prioritizedCourses : courses
    return source.slice(0, 2)
  }, [courseStatuses, courses])

  const featuredCourseLabel = featuredCourse ? getLearningActionLabel(startedCourseIds.has(featuredCourse.id)) : null

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-slate-100 pb-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Painel do Aluno
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Olá, {firstName}!</h2>
            <p className="text-base font-medium text-slate-500 sm:text-lg">{profile?.email}</p>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Gerencie sua jornada de aprendizado, acompanhe sua evolução e retome seus treinamentos com a mesma linguagem do ecossistema HomeCare Match.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadDashboard()}
          disabled={isLoading}
          className="h-12 rounded-2xl border-slate-200 px-5 font-bold text-slate-600"
        >
          <svg className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m14.836 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-14.837-2m14.837 2H15" />
          </svg>
          Atualizar Painel
        </Button>
      </header>

      {error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Cursos liberados</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{isLoading ? '-' : journeySummary.total}</p>
        </article>
        <article className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-500">Em andamento</p>
          <p className="mt-3 text-4xl font-black text-blue-700">{isLoading ? '-' : journeySummary.inProgress}</p>
        </article>
        <article className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">Prova final pendente</p>
          <p className="mt-3 text-4xl font-black text-amber-700">{isLoading ? '-' : journeySummary.finalPending}</p>
        </article>
        <article className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Concluídos</p>
          <p className="mt-3 text-4xl font-black text-emerald-700">{isLoading ? '-' : journeySummary.completed}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Acesso rápido</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Atalhos do aluno</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Link
                to="/aluno/cursos"
                className="flex items-center justify-between rounded-[24px] border border-blue-100 bg-blue-50 px-5 py-4 transition-all hover:border-blue-200 hover:bg-blue-100/60"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">Explorar meus cursos</p>
                    <p className="text-sm font-medium text-slate-500">Acesse todos os treinamentos liberados para sua conta.</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {featuredCourse ? (
                <Link
                  to={`/aluno/cursos/${featuredCourse.id}`}
                  className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 transition-all hover:border-slate-300 hover:bg-slate-100/70"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.868v4.264a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">{featuredCourseLabel}</p>
                      <p className="max-w-[460px] truncate text-sm font-medium text-slate-500">{featuredCourse.title}</p>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : null}
            </div>
          </article>

          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Destaque</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Próximos cursos recomendados</h3>
            </div>

            <div className="mt-5">
              {recommendedCourses.length > 0 ? (
                <div className="grid gap-5 xl:grid-cols-2">
                  {recommendedCourses.map((course) => {
                    const journeyStatus = getStudentCourseJourneyStatus(courseStatuses.get(course.id) ?? null)
                    const learningActionLabel = getLearningActionLabel(startedCourseIds.has(course.id))

                    return (
                      <article key={course.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                        <div className="relative overflow-hidden bg-slate-900" style={{ aspectRatio: '4 / 3' }}>
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover object-center" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-white/20">
                              <span className="text-4xl font-black uppercase tracking-[0.3em]">LMS</span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/65 to-transparent" />
                        </div>
                        <div className="space-y-4 p-5">
                          <div className="inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 shadow-sm">
                            {journeyStatus === 'completed'
                              ? 'Concluído'
                              : journeyStatus === 'final_pending'
                                ? 'Prova final pendente'
                                : 'Em andamento'}
                          </div>
                          <div>
                            <h4 className="line-clamp-2 text-xl font-black tracking-tight text-slate-900">{course.title}</h4>
                            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                              {sanitizeDescription(course.description)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Link
                              to={`/aluno/cursos/${course.id}`}
                              className="inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition-colors hover:bg-blue-700"
                            >
                              {learningActionLabel}
                            </Link>
                            <Link
                              to="/aluno/cursos"
                              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition-colors hover:text-slate-900"
                            >
                              Ver catálogo
                            </Link>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-base font-semibold text-slate-600">Nenhum curso liberado no momento.</p>
                  <p className="mt-2 text-sm text-slate-500">Assim que novos treinamentos forem atribuídos, eles aparecerão aqui.</p>
                </div>
              )}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Situação da conta</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Resumo do perfil</h3>
            </div>

            <div className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-900">Conta ativa para aprendizagem</p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">
                    Seus treinamentos liberados estão disponíveis para acesso e continuidade.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Nome</p>
                <p className="mt-2 text-sm font-bold text-slate-800">{profile?.full_name || 'Não informado'}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">E-mail</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-800">{profile?.email}</p>
              </div>
            </div>

            <Link
              to="/aluno/minha-conta"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              Editar meus dados
            </Link>
          </article>

          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Leitura rápida</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Status da jornada</h3>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <span className="text-sm font-bold text-slate-700">Cursos em andamento</span>
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  {journeySummary.inProgress}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <span className="text-sm font-bold text-slate-700">Aguardando prova final</span>
                <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  {journeySummary.finalPending}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <span className="text-sm font-bold text-slate-700">Cursos concluídos</span>
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  {journeySummary.completed}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
