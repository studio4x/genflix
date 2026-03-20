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
      }
    }

    void loadCourses()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Dashboard do aluno</h2>
      <p className="text-sm text-slate-600">
        Bem-vindo, {profile?.full_name ?? profile?.email ?? 'aluno'}.
      </p>
      <p className="text-sm text-slate-600">Cursos liberados: {courses.length}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" asChild>
        <Link to="/aluno/cursos">Ver cursos liberados</Link>
      </Button>
    </div>
  )
}
