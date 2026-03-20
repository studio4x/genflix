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
import type { Course, ModuleLearningState, StudentCourseModuleProgress } from '@/types/content'

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

export function StudentCourseDetailsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<StudentCourseModuleProgress[]>([])
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
        const [courseResult, modulesResult] = await Promise.all([
          fetchReleasedCourseById(courseId),
          fetchStudentCourseContentWithProgress(courseId),
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
      const refreshed = await fetchStudentCourseContentWithProgress(courseId)
      setModules(refreshed)
    } catch (toggleError) {
      setError(toErrorMessage(toggleError))
    } finally {
      setIsSavingLessonId(null)
    }
  }

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">
                {module.position}. {module.title}
              </h3>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${moduleStateClasses(module.state)}`}
              >
                {moduleStateLabel(module.state)}
              </span>
            </div>
            {module.description ? (
              <p className="mt-1 text-sm text-slate-600">{module.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-600">
              Progresso do modulo: {module.progress_percent}% | Aulas obrigatorias:{' '}
              {module.required_lessons_completed}/{module.required_lessons_total}
            </p>
            {module.has_required_assessment ? (
              <p className="mt-1 text-xs text-slate-600">
                Avaliacao obrigatoria: {module.required_assessment_approved ? 'Aprovada' : 'Pendente'}
              </p>
            ) : null}

            {module.state === 'blocked' ? (
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Modulo bloqueado. Conclua o modulo anterior para liberar este conteudo.
              </p>
            ) : null}

            {module.state !== 'blocked' ? (
              <ul className="mt-3 space-y-2">
                {module.lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p>
                          {lesson.position}. {lesson.title}{' '}
                          {lesson.is_required ? (
                            <span className="text-xs text-slate-500">(Obrigatoria)</span>
                          ) : (
                            <span className="text-xs text-slate-500">(Opcional)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-600">
                          Estado da aula: {lesson.is_completed ? 'Concluida' : 'Em andamento'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={lesson.is_completed ? 'outline' : 'default'}
                        disabled={isSavingLessonId === lesson.id}
                        onClick={() =>
                          void handleToggleLessonCompletion(lesson.id, lesson.is_completed)
                        }
                      >
                        {isSavingLessonId === lesson.id
                          ? 'Salvando...'
                          : lesson.is_completed
                            ? 'Desmarcar conclusao'
                            : 'Marcar como concluida'}
                      </Button>
                    </div>
                    {lesson.youtube_url ? (
                      <a
                        className="mt-2 inline-block text-blue-700 underline"
                        href={lesson.youtube_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir no YouTube
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {module.state !== 'blocked' && module.lessons.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Nenhuma aula neste modulo.</p>
            ) : null}
          </article>
        ))}

        {modules.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum modulo publicado ainda.</p>
        ) : null}
      </div>
    </div>
  )
}
