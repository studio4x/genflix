import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createAssessmentOption,
  createAssessmentQuestion,
  createFinalAssessment,
  createModuleAssessment,
  deleteAssessmentOption,
  deleteAssessmentQuestion,
  fetchAssessmentQuestions,
  fetchFinalAssessment,
  fetchModuleAssessment,
  toErrorMessage,
  updateAssessment,
  updateAssessmentOption,
  updateAssessmentQuestion,
  type AssessmentQuestionWithOptions,
} from '@/features/admin/assessments/api'
import {
  assessmentFormSchema,
  assessmentOptionFormSchema,
  assessmentQuestionFormSchema,
  type AssessmentFormInput,
  type AssessmentOptionFormInput,
  type AssessmentQuestionFormInput,
} from '@/features/admin/assessments/schemas'
import { fetchCourse, fetchModule } from '@/features/admin/content/api'
import type { Assessment, Course, CourseModule } from '@/types/content'

const initialAssessmentForm: AssessmentFormInput = {
  title: '',
  description: '',
  is_required: true,
  passing_score: 70,
  max_attempts: 3,
  is_active: true,
}

const initialQuestionForm: AssessmentQuestionFormInput = {
  question_text: '',
  is_required: true,
  points: 1,
}

const initialOptionForm: AssessmentOptionFormInput = {
  question_id: '',
  option_text: '',
  is_correct: false,
}

export function AdminAssessmentEditorPage() {
  const { courseId, moduleId } = useParams<{ courseId?: string; moduleId?: string }>()
  const { user } = useAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [module, setModule] = useState<CourseModule | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<AssessmentQuestionWithOptions[]>([])
  const [assessmentForm, setAssessmentForm] =
    useState<AssessmentFormInput>(initialAssessmentForm)
  const [questionForm, setQuestionForm] =
    useState<AssessmentQuestionFormInput>(initialQuestionForm)
  const [optionForm, setOptionForm] = useState<AssessmentOptionFormInput>(initialOptionForm)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false)
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false)
  const [isSubmittingOption, setIsSubmittingOption] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scope = useMemo(() => {
    if (moduleId) {
      return 'module'
    }
    return 'final'
  }, [moduleId])

  const loadData = useCallback(async () => {
    if (scope === 'module' && !moduleId) {
      setError('Modulo invalido.')
      setIsLoading(false)
      return
    }

    if (scope === 'final' && !courseId) {
      setError('Curso invalido.')
      setIsLoading(false)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      if (scope === 'module' && moduleId) {
        const moduleResult = await fetchModule(moduleId)
        setModule(moduleResult)
        if (!moduleResult?.course_id) {
          throw new Error('Modulo nao encontrado.')
        }

        const [courseResult, assessmentResult] = await Promise.all([
          fetchCourse(moduleResult.course_id),
          fetchModuleAssessment(moduleId),
        ])
        setCourse(courseResult)
        setAssessment(assessmentResult)
        if (assessmentResult) {
          setAssessmentForm({
            title: assessmentResult.title,
            description: assessmentResult.description ?? '',
            is_required: assessmentResult.is_required,
            passing_score: Number(assessmentResult.passing_score),
            max_attempts: assessmentResult.max_attempts,
            is_active: assessmentResult.is_active,
          })
          setQuestions(await fetchAssessmentQuestions(assessmentResult.id))
        } else {
          setAssessmentForm(initialAssessmentForm)
          setQuestions([])
        }
      } else if (scope === 'final' && courseId) {
        const [courseResult, assessmentResult] = await Promise.all([
          fetchCourse(courseId),
          fetchFinalAssessment(courseId),
        ])
        setCourse(courseResult)
        setModule(null)
        setAssessment(assessmentResult)
        if (assessmentResult) {
          setAssessmentForm({
            title: assessmentResult.title,
            description: assessmentResult.description ?? '',
            is_required: assessmentResult.is_required,
            passing_score: Number(assessmentResult.passing_score),
            max_attempts: assessmentResult.max_attempts,
            is_active: assessmentResult.is_active,
          })
          setQuestions(await fetchAssessmentQuestions(assessmentResult.id))
        } else {
          setAssessmentForm(initialAssessmentForm)
          setQuestions([])
        }
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [courseId, moduleId, scope])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAssessmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      setError('Usuario nao autenticado.')
      return
    }

    const parsed = assessmentFormSchema.safeParse(assessmentForm)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos da avaliacao.')
      return
    }

    setError(null)
    setIsSubmittingAssessment(true)
    try {
      if (assessment) {
        await updateAssessment(assessment.id, parsed.data)
      } else if (scope === 'module' && moduleId && course?.id) {
        await createModuleAssessment(course.id, moduleId, parsed.data, user.id)
      } else if (scope === 'final' && course?.id) {
        await createFinalAssessment(course.id, parsed.data, user.id)
      }
      await loadData()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmittingAssessment(false)
    }
  }

  function handleEditQuestion(question: AssessmentQuestionWithOptions) {
    setEditingQuestionId(question.id)
    setQuestionForm({
      question_text: question.question_text,
      is_required: question.is_required,
      points: Number(question.points),
    })
  }

  function resetQuestionForm() {
    setQuestionForm(initialQuestionForm)
    setEditingQuestionId(null)
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!assessment) {
      setError('Crie a avaliacao antes de cadastrar questoes.')
      return
    }

    const parsed = assessmentQuestionFormSchema.safeParse(questionForm)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos da questao.')
      return
    }

    setError(null)
    setIsSubmittingQuestion(true)
    try {
      if (editingQuestionId) {
        await updateAssessmentQuestion(editingQuestionId, parsed.data)
      } else {
        await createAssessmentQuestion(assessment.id, parsed.data)
      }
      resetQuestionForm()
      await loadData()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmittingQuestion(false)
    }
  }

  async function handleDeleteQuestion(question: AssessmentQuestionWithOptions) {
    const confirmed = window.confirm(`Excluir a questao "${question.question_text}"?`)
    if (!confirmed) {
      return
    }

    try {
      await deleteAssessmentQuestion(question.id)
      await loadData()
      if (editingQuestionId === question.id) {
        resetQuestionForm()
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  function handleEditOption(option: { id: string; question_id: string; option_text: string; is_correct: boolean }) {
    setEditingOptionId(option.id)
    setOptionForm({
      question_id: option.question_id,
      option_text: option.option_text,
      is_correct: option.is_correct,
    })
  }

  function resetOptionForm() {
    setOptionForm(initialOptionForm)
    setEditingOptionId(null)
  }

  async function handleOptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = assessmentOptionFormSchema.safeParse(optionForm)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos da opcao.')
      return
    }

    setError(null)
    setIsSubmittingOption(true)
    try {
      if (editingOptionId) {
        await updateAssessmentOption(editingOptionId, {
          option_text: parsed.data.option_text,
          is_correct: parsed.data.is_correct,
        })
      } else {
        await createAssessmentOption(parsed.data)
      }
      resetOptionForm()
      await loadData()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmittingOption(false)
    }
  }

  async function handleDeleteOption(optionId: string) {
    const confirmed = window.confirm('Excluir esta opcao?')
    if (!confirmed) {
      return
    }

    try {
      await deleteAssessmentOption(optionId)
      await loadData()
      if (editingOptionId === optionId) {
        resetOptionForm()
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link className="underline" to="/admin/cursos">
            Cursos
          </Link>
          {course?.id ? (
            <>
              <span>/</span>
              <Link className="underline" to={`/admin/cursos/${course.id}/modulos`}>
                Modulos
              </Link>
            </>
          ) : null}
          <span>/</span>
          <span>{scope === 'module' ? 'Avaliacao de modulo' : 'Avaliacao final'}</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          {scope === 'module'
            ? `Avaliacao do modulo ${module ? `"${module.title}"` : ''}`
            : `Avaliacao final do curso ${course ? `"${course.title}"` : ''}`}
        </h2>
      </div>

      {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form className="grid gap-4 rounded-lg border bg-slate-50 p-4" onSubmit={handleAssessmentSubmit}>
        <label className="space-y-1">
          <span className="text-sm text-slate-700">Titulo da avaliacao</span>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={assessmentForm.title}
            onChange={(event) =>
              setAssessmentForm((previous) => ({ ...previous, title: event.target.value }))
            }
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">Descricao</span>
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={assessmentForm.description}
            onChange={(event) =>
              setAssessmentForm((previous) => ({
                ...previous,
                description: event.target.value,
              }))
            }
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-slate-700">Nota minima (%)</span>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="number"
              min={0}
              max={100}
              value={assessmentForm.passing_score}
              onChange={(event) =>
                setAssessmentForm((previous) => ({
                  ...previous,
                  passing_score: Number(event.target.value || 0),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-700">Tentativas maximas</span>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="number"
              min={1}
              max={20}
              value={assessmentForm.max_attempts}
              onChange={(event) =>
                setAssessmentForm((previous) => ({
                  ...previous,
                  max_attempts: Number(event.target.value || 1),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-700">Status</span>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={assessmentForm.is_active ? 'active' : 'inactive'}
              onChange={(event) =>
                setAssessmentForm((previous) => ({
                  ...previous,
                  is_active: event.target.value === 'active',
                }))
              }
            >
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={assessmentForm.is_required}
            onChange={(event) =>
              setAssessmentForm((previous) => ({
                ...previous,
                is_required: event.target.checked,
              }))
            }
          />
          Avaliacao obrigatoria
        </label>

        <Button type="submit" disabled={isSubmittingAssessment}>
          {isSubmittingAssessment
            ? 'Salvando...'
            : assessment
              ? 'Atualizar avaliacao'
              : 'Criar avaliacao'}
        </Button>
      </form>

      {assessment ? (
        <>
          <form className="grid gap-3 rounded-lg border bg-slate-50 p-4" onSubmit={handleQuestionSubmit}>
            <h3 className="font-semibold text-slate-900">
              {editingQuestionId ? 'Editar questao' : 'Nova questao'}
            </h3>
            <label className="space-y-1">
              <span className="text-sm text-slate-700">Pergunta</span>
              <textarea
                className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                value={questionForm.question_text}
                onChange={(event) =>
                  setQuestionForm((previous) => ({
                    ...previous,
                    question_text: event.target.value,
                  }))
                }
                required
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm text-slate-700">Pontuacao</span>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={questionForm.points}
                  onChange={(event) =>
                    setQuestionForm((previous) => ({
                      ...previous,
                      points: Number(event.target.value || 1),
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={questionForm.is_required}
                  onChange={(event) =>
                    setQuestionForm((previous) => ({
                      ...previous,
                      is_required: event.target.checked,
                    }))
                  }
                />
                Questao obrigatoria
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmittingQuestion}>
                {isSubmittingQuestion
                  ? 'Salvando...'
                  : editingQuestionId
                    ? 'Atualizar questao'
                    : 'Adicionar questao'}
              </Button>
              {editingQuestionId ? (
                <Button type="button" variant="outline" onClick={resetQuestionForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>

          <form className="grid gap-3 rounded-lg border bg-slate-50 p-4" onSubmit={handleOptionSubmit}>
            <h3 className="font-semibold text-slate-900">
              {editingOptionId ? 'Editar opcao' : 'Nova opcao'}
            </h3>
            <label className="space-y-1">
              <span className="text-sm text-slate-700">Questao</span>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={optionForm.question_id}
                onChange={(event) =>
                  setOptionForm((previous) => ({
                    ...previous,
                    question_id: event.target.value,
                  }))
                }
                required
              >
                <option value="">Selecione a questao</option>
                {questions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.position}. {question.question_text}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-700">Texto da opcao</span>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={optionForm.option_text}
                onChange={(event) =>
                  setOptionForm((previous) => ({
                    ...previous,
                    option_text: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={optionForm.is_correct}
                onChange={(event) =>
                  setOptionForm((previous) => ({
                    ...previous,
                    is_correct: event.target.checked,
                  }))
                }
              />
              Opcao correta
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmittingOption}>
                {isSubmittingOption
                  ? 'Salvando...'
                  : editingOptionId
                    ? 'Atualizar opcao'
                    : 'Adicionar opcao'}
              </Button>
              {editingOptionId ? (
                <Button type="button" variant="outline" onClick={resetOptionForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Questoes cadastradas
            </h3>
            <div className="grid gap-3">
              {questions.map((question) => (
                <article key={question.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">
                      {question.position}. {question.question_text}
                    </p>
                    <p className="text-sm text-slate-600">
                      Pontos: {question.points} | Obrigatoria: {question.is_required ? 'Sim' : 'Nao'}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {question.options.map((option) => (
                      <li
                        key={option.id}
                        className="flex flex-wrap items-center justify-between rounded border bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span>
                          {option.position}. {option.option_text}{' '}
                          {option.is_correct ? '(Correta)' : ''}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditOption(option)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteOption(option.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </li>
                    ))}
                    {question.options.length === 0 ? (
                      <li className="text-sm text-slate-600">Sem opcoes nesta questao.</li>
                    ) : null}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="outline" onClick={() => handleEditQuestion(question)}>
                      Editar questao
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleDeleteQuestion(question)}
                    >
                      Excluir questao
                    </Button>
                  </div>
                </article>
              ))}
              {questions.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhuma questao cadastrada.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Salve a avaliacao para habilitar cadastro de questoes e opcoes.
        </p>
      )}
    </div>
  )
}

