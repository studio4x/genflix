import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourseById,
  fetchReleasedCourseContent,
  toErrorMessage,
  type CourseModuleWithLessons,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

export function StudentCourseDetailsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModuleWithLessons[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadCourse() {
      if (!courseId) {
        setError('Curso invalido.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const [courseResult, modulesResult] = await Promise.all([
          fetchReleasedCourseById(courseId),
          fetchReleasedCourseContent(courseId),
        ])

        if (isMounted) {
          setCourse(courseResult)
          setModules(modulesResult)
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

    void loadCourse()
    return () => {
      isMounted = false
    }
  }, [courseId])

  if (isLoading) {
    return <p className="text-sm text-slate-600">Carregando...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  if (!course) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Acesso nao liberado</h2>
        <p className="text-sm text-slate-600">
          Este curso nao esta liberado para seu usuario.
        </p>
        <Button type="button" variant="outline" asChild>
          <Link to="/aluno/cursos">Voltar para cursos liberados</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">{course.title}</h2>
      <p className="text-sm text-slate-600">Carga horaria: {course.workload_hours}h</p>
      {course.description ? (
        <p className="text-sm text-slate-600">{course.description}</p>
      ) : null}

      <div className="grid gap-3">
        {modules.map((module) => (
          <article key={module.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900">
              {module.position}. {module.title}
            </h3>
            {module.description ? (
              <p className="mt-1 text-sm text-slate-600">{module.description}</p>
            ) : null}

            <ul className="mt-3 space-y-2">
              {module.lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  {lesson.position}. {lesson.title}
                  {lesson.youtube_url ? (
                    <a
                      className="ml-2 text-blue-700 underline"
                      href={lesson.youtube_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      YouTube
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))}

        {modules.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum modulo publicado ainda.</p>
        ) : null}
      </div>
    </div>
  )
}
