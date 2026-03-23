import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourses,
  toErrorMessage,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

export function StudentDashboardPage() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadCourses() {
      try {
        const data = await fetchReleasedCourses()
        if (isMounted) {
          setCourses(data)
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

    void loadCourses()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Olá, {profile?.full_name?.split(' ')[0] ?? profile?.email?.split('@')[0] ?? 'Aluno'}!
        </h2>
        <p className="text-base text-slate-500">
          Bem-vindo(a) ao seu painel de aprendizado. Continue seu desenvolvimento profissional hoje.
        </p>
      </header>
      
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col justify-center rounded-2xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600/80">Cursos Disponíveis</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-blue-900">
                  {isLoading ? '-' : courses.length}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm" asChild>
              <Link to="/aluno/cursos">Acessar Cursos</Link>
            </Button>
          </div>
        </div>

        {/* Placeholder for future specific metrics */}
        <div className="flex flex-col justify-center rounded-2xl border border-slate-100 bg-slate-50/50 p-6 shadow-sm opacity-80">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Certificados</p>
              <span className="text-4xl font-extrabold text-slate-700">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
