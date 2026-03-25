import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchReleasedCourses,
  fetchStudentCoursesStatusMap,
  getStudentCourseJourneyStatus,
  toErrorMessage,
  type StudentCourseStatus,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

function formatCourseWorkload(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) {
    return `${remainingMinutes}min`
  }

  if (remainingMinutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainingMinutes}m`
}

function sanitizeCourseCardDescription(description: string | null) {
  if (!description) {
    return 'Inicie este treinamento para desenvolver novas competencias e aprimorar seus resultados.'
  }

  return description
    .replace(/<[^>]*>?/gm, '')
    .replace(/^descri[cç][aã]o do curso[:\s-]*/i, '')
    .trim()
}

export function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseStatuses, setCourseStatuses] = useState<Map<string, StudentCourseStatus | null>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadCourses() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchReleasedCourses()
        const statusMap = await fetchStudentCoursesStatusMap(data.map((course) => course.id))

        if (isMounted) {
          setCourses(data)
          setCourseStatuses(statusMap)
        }
      } catch (loadError) {
        if (isMounted) setError(toErrorMessage(loadError))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadCourses()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-10">
        <div className="mb-2 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-black text-[10px] uppercase tracking-widest text-blue-600">
          Area do Aluno
        </div>
        <h2 className="text-4xl font-black tracking-tight text-slate-900">Meus Treinamentos</h2>
        <p className="max-w-2xl text-lg font-medium text-slate-500">
          Sua jornada de desenvolvimento profissional comeca aqui. Escolha um curso e acelere sua carreira.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-[400px] animate-pulse rounded-[32px] border border-slate-50 bg-slate-100/50 shadow-sm" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-4 rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-600 shadow-sm animate-in shake duration-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      ) : null}

      {!isLoading && courses.length === 0 && !error ? (
        <div className="rounded-[40px] border-4 border-dashed border-slate-100 bg-slate-50/30 p-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-100 bg-white text-slate-200 shadow-sm">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-800">Caminho livre...</h3>
          <p className="mx-auto mt-2 max-w-sm font-medium text-slate-500">
            Assim que novos treinamentos forem designados para voce, eles aparecerao aqui para serem explorados.
          </p>
        </div>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
        {courses.map((course) => {
          const courseStatus = courseStatuses.get(course.id) ?? null
          const journeyStatus = getStudentCourseJourneyStatus(courseStatus)

          const footerStatus = journeyStatus === 'completed'
            ? {
                dotClass: 'bg-emerald-500',
                label: 'Curso Concluido',
                cta: 'Ver Curso',
              }
            : journeyStatus === 'final_pending'
              ? {
                  dotClass: 'bg-amber-500',
                  label: 'Conteudo Concluido | Prova Final Pendente',
                  cta: 'Fazer Prova Final',
                }
              : {
                  dotClass: 'bg-blue-500 animate-pulse',
                  label: 'Em Andamento',
                  cta: 'Comecar Agora',
                }

          return (
            <article
              key={course.id}
              className="group relative flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm transition-all duration-500 hover:border-blue-200 hover:shadow-2xl"
            >
              <Link to={`/aluno/cursos/${course.id}`} className="relative block w-full overflow-hidden bg-slate-200" style={{ aspectRatio: '4/3' }}>
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900">
                    <span className="text-4xl font-black uppercase tracking-tighter text-white/10">LMS</span>
                  </div>
                )}

                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/60 bg-slate-900/65 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 backdrop-blur-md">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatCourseWorkload(course.workload_minutes)}
                </div>

                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-blue-600/90 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-12 items-center justify-center rounded-2xl bg-white px-6 font-black text-blue-600 shadow-xl">
                    Acessar Conteudo
                  </div>
                </div>
              </Link>

              <div className="flex flex-1 flex-col space-y-4 p-8">
                <div className="flex-1">
                  <h3 className="line-clamp-2 text-xl font-black leading-tight tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                    {course.title}
                  </h3>
                  <p className="mt-4 line-clamp-2 h-[40px] text-sm font-medium leading-relaxed text-slate-500">
                    {sanitizeCourseCardDescription(course.description)}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-5 border-t border-slate-50 pt-6">
                  <div className="flex items-start gap-1">
                    <div className={`h-2 w-2 rounded-full ${footerStatus.dotClass}`} />
                    <span className="max-w-full text-[10px] font-black uppercase tracking-widest leading-relaxed text-slate-400">
                      {footerStatus.label}
                    </span>
                  </div>
                  <Link
                    to={`/aluno/cursos/${course.id}`}
                    className="group/btn flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:text-blue-700"
                  >
                    {footerStatus.cta}
                    <svg className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
