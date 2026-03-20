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
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Cursos liberados</h2>
      <p className="text-sm text-slate-600">
        Esta lista mostra somente os cursos com liberacao ativa para seu usuario.
      </p>

      {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isLoading && courses.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhum curso liberado no momento.</p>
      ) : null}

      <div className="grid gap-3">
        {courses.map((course) => (
          <article key={course.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900">{course.title}</h3>
              <p className="text-sm text-slate-600">
                Carga horaria: {course.workload_hours}h
              </p>
              {course.description ? (
                <p className="text-sm text-slate-600">{course.description}</p>
              ) : null}
              <Button type="button" variant="outline" asChild>
                <Link to={`/aluno/cursos/${course.id}`}>Abrir curso</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
