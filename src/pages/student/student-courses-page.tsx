import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourses,
  toErrorMessage,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

export function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function loadCourses() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchReleasedCourses()
        if (isMounted) setCourses(data)
      } catch (loadError) {
        if (isMounted) setError(toErrorMessage(loadError))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void loadCourses()
    return () => { isMounted = false }
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Meus Cursos</h2>
        <p className="text-base text-slate-500">
          Explore os treinamentos disponíveis e acelere sua carreira.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {!isLoading && courses.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nenhum curso liberado</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">
            Assim que novos treinamentos forem designados para você, eles aparecerão aqui.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <article 
            key={course.id} 
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-blue-300 hover:shadow-lg hover:-translate-y-1"
          >
            <div className="p-6 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-tight line-clamp-2">
                  {course.title}
                </h3>
                <div className="mt-2 flex items-center gap-2 overflow-hidden text-sm font-medium text-slate-500">
                  <span className="flex items-center gap-1 shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {course.workload_hours}h
                  </span>
                </div>
              </div>
              {course.description ? (
                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                  {course.description}
                </p>
              ) : null}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm transition-all" asChild>
                <Link to={`/aluno/cursos/${course.id}`}>Acessar Curso</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
