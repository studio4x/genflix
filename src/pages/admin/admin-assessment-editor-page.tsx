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

interface AdminAssessmentEditorPageProps {
  hideHeader?: boolean
}

export function AdminAssessmentEditorPage({ hideHeader }: AdminAssessmentEditorPageProps) {
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
      setError('Módulo inválido.')
      setIsLoading(false)
      return
    }

    if (scope === 'final' && !courseId) {
      setError('Curso inválido.')
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
          throw new Error('Módulo não encontrado.')
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
      setError('Usuário não autenticado.')
      return
    }

    const parsed = assessmentFormSchema.safeParse(assessmentForm)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos da avaliação.')
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
    document.getElementById('question-editor')?.scrollIntoView({ behavior: 'smooth' })
  }

  function resetQuestionForm() {
    setQuestionForm(initialQuestionForm)
    setEditingQuestionId(null)
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!assessment) {
      setError('Crie a avaliação antes de cadastrar questões.')
      return
    }

    const parsed = assessmentQuestionFormSchema.safeParse(questionForm)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos da questão.')
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
    const confirmed = window.confirm(`ATENÇÃO: Excluir a questão "${question.question_text}"?\n\nAs opções vinculadas também serão removidas.`)
    if (!confirmed) return

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
    document.getElementById('option-editor')?.scrollIntoView({ behavior: 'smooth' })
  }

  function resetOptionForm() {
    setOptionForm(initialOptionForm)
    setEditingOptionId(null)
  }

  async function handleOptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = assessmentOptionFormSchema.safeParse(optionForm)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos da opção.')
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
    const confirmed = window.confirm('Deseja realmente excluir esta opção?')
    if (!confirmed) return

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
    <div className={`space-y-8 animate-in fade-in duration-500 pb-12 relative max-w-[1400px] ${hideHeader ? 'p-0' : ''}`}>
      {!hideHeader && (
        <header className="space-y-4 border-b border-slate-100 pb-6">
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
            <Link to="/admin/cursos" className="hover:text-blue-600 transition-colors">Cursos</Link>
            <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            {course?.id ? (
              <>
                <Link to={`/admin/cursos/${course.id}/modulos`} className="hover:text-blue-600 transition-colors truncate max-w-[150px] sm:max-w-xs">{course.title}</Link>
                <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </>
            ) : null}
            <span className="text-slate-900 font-semibold">{scope === 'module' ? 'Avaliação Modular' : 'Avaliação Final'}</span>
          </nav>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {scope === 'module'
                ? `Avaliação do Módulo: ${module ? module.title : '...'}`
                : `Avaliação Final do Curso`}
            </h2>
            <p className="text-base text-slate-500 mt-1">
              Configure as regras, perguntas e alternativas que compõem esta avaliação.
            </p>
          </div>
        </header>
      )}

      {isLoading && !course && (
        <div className="flex justify-center p-12">
          <span className="text-sm font-medium text-slate-400 animate-pulse flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-slate-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Carregando dados...
          </span>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[450px_1fr] items-start">
        {/* Avaliação Settings Form */}
        <section className={`rounded-2xl border bg-white shadow-sm overflow-hidden sticky top-6 transition-all ${!assessment ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-200'}`}>
          <div className="p-5 flex items-center border-b bg-slate-50 border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm mr-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Painel da Avaliação</h3>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{assessment ? 'Configurações Atuais' : 'Ainda não criada'}</p>
            </div>
          </div>
          
          <form className="p-6 grid gap-5" onSubmit={handleAssessmentSubmit}>
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Título da Avaliação <span className="text-rose-500">*</span></span>
                <input
                  className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                  placeholder="Ex: Prova de Certificação Final"
                  value={assessmentForm.title}
                  onChange={(event) =>
                    setAssessmentForm((previous) => ({ ...previous, title: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Descrição (Opcional)</span>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y placeholder:text-slate-400"
                  placeholder="Instruções adicionais para os alunos."
                  value={assessmentForm.description}
                  onChange={(event) =>
                    setAssessmentForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Nota Mínima (%) <span className="text-rose-500">*</span></span>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Tentativas Máx. <span className="text-rose-500">*</span></span>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <select
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                
                <div className="flex flex-col justify-end pb-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                     <input
                      type="checkbox"
                      checked={assessmentForm.is_required}
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      onChange={(event) =>
                        setAssessmentForm((previous) => ({
                          ...previous,
                          is_required: event.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 select-none">Obrigatória</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Button type="submit" disabled={isSubmittingAssessment} size="lg" className={`w-full text-base font-bold shadow-sm ${assessment ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSubmittingAssessment
                  ? 'Salvando...'
                  : assessment
                    ? 'Atualizar Configurações'
                    : 'Criar Avaliação Inicial'}
              </Button>
            </div>
          </form>
        </section>

        {/* Questions and Options Section */}
        {assessment ? (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Banco de Questões ({questions.length})
              </h3>
            </div>

            {/* Question Editor */}
            <form id="question-editor" className={`rounded-xl border shadow-sm p-5 transition-all ${editingQuestionId ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white'}`} onSubmit={handleQuestionSubmit}>
              <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                {editingQuestionId ? (
                  <>
                    <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Editando Questão
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Adicionar Nova Questão
                  </>
                )}
              </h4>
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Enunciado / Pergunta <span className="text-rose-500">*</span></span>
                  <textarea
                    className="min-h-[80px] w-full rounded-lg border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
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
                <div className="grid grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">Pontuação <span className="text-rose-500">*</span></span>
                    <input
                      className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm"
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
                  <div className="flex flex-col justify-end pb-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={questionForm.is_required}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600"
                        onChange={(event) =>
                          setQuestionForm((previous) => ({
                            ...previous,
                            is_required: event.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm font-semibold text-slate-700">Questão Obrigatória</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className={`text-sm font-bold shadow-sm ${editingQuestionId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`} disabled={isSubmittingQuestion}>
                    {isSubmittingQuestion ? 'Salvando...' : editingQuestionId ? 'Salvar Questão' : 'Adicionar Questão'}
                  </Button>
                  {editingQuestionId ? (
                    <Button type="button" variant="outline" onClick={resetQuestionForm} className="border-slate-300">Cancelar</Button>
                  ) : null}
                </div>
              </div>
            </form>

            <div className="w-full h-px bg-slate-200 my-8"></div>

            {/* Option Editor */}
            <form id="option-editor" className={`rounded-xl border shadow-sm p-5 transition-all ${editingOptionId ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-slate-50'}`} onSubmit={handleOptionSubmit}>
              <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                {editingOptionId ? 'Editando Alternativa' : 'Cadastrar Nova Alternativa'}
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Vincular a qual Questão? <span className="text-rose-500">*</span></span>
                  <select
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm"
                    value={optionForm.question_id}
                    onChange={(event) =>
                      setOptionForm((previous) => ({
                        ...previous,
                        question_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">-- Selecione uma questão abaixo --</option>
                    {questions.map((question, idx) => (
                      <option key={question.id} value={question.id}>
                        {idx + 1}. {question.question_text.slice(0, 60)}{question.question_text.length > 60 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                
                <label className="block space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Texto da Alternativa <span className="text-rose-500">*</span></span>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm"
                    value={optionForm.option_text}
                    onChange={(event) =>
                      setOptionForm((previous) => ({
                        ...previous,
                        option_text: event.target.value,
                      }))
                    }
                    placeholder="Ex: Resposta verdadeira para a questão..."
                    required
                  />
                </label>
                
                <div className="flex items-center py-2 md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={optionForm.is_correct}
                      className="h-5 w-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600"
                      onChange={(event) =>
                        setOptionForm((previous) => ({
                          ...previous,
                          is_correct: event.target.checked,
                        }))
                      }
                    />
                    <span className="font-bold text-slate-900 bg-emerald-100/50 px-3 py-1 rounded-md border border-emerald-200 text-emerald-800">Esta é a alternativa CORRETA</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-2 md:col-span-2">
                  <Button type="submit" variant="secondary" className="bg-slate-900 text-white hover:bg-slate-800 font-bold shadow-sm" disabled={isSubmittingOption}>
                    {isSubmittingOption ? 'Salvando...' : editingOptionId ? 'Salvar Alternativa' : 'Cadastrar Alternativa'}
                  </Button>
                  {editingOptionId ? (
                    <Button type="button" variant="outline" onClick={resetOptionForm} className="border-slate-300">Cancelar</Button>
                  ) : null}
                </div>
              </div>
            </form>

            <div className="w-full h-px bg-slate-200 my-8"></div>

            {/* Questions List */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                Visualização do Questionário
              </h3>
              
              {questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                  <p className="text-slate-500 font-medium">O questionário está vazio.</p>
                  <p className="text-sm text-slate-400 mt-1">Utilize o formulário verde acima para adicionar a primeira questão.</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {questions.map((question, index) => (
                    <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 text-lg flex items-start gap-2">
                            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold mt-0.5">{index + 1}</span>
                            <span>{question.question_text}</span>
                          </h4>
                          <div className="flex items-center gap-3 pl-8">
                            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{question.points} {question.points === 1 ? 'ponto' : 'pontos'}</span>
                            <span className="text-slate-300">•</span>
                            {question.is_required ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Obrigatória</span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Opcional</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800" onClick={() => handleEditQuestion(question)}>Editar</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md" onClick={() => void handleDeleteQuestion(question)} title="Excluir questão">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </Button>
                        </div>
                      </div>

                      <div className="pl-8">
                        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Alternativas Cadastradas</h5>
                        <ul className="space-y-2">
                          {question.options.map((option, optIdx) => (
                            <li key={option.id} className={`flex items-start gap-3 rounded-lg border p-3 ${option.is_correct ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center font-bold text-xs uppercase rounded-full ${option.is_correct ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-300 text-slate-500'}`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              
                              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <span className={`text-sm ${option.is_correct ? 'font-bold text-emerald-900' : 'text-slate-700'}`}>
                                  {option.option_text}
                                  {option.is_correct && <span className="ml-2 inline-block text-[10px] font-black uppercase text-white bg-emerald-500 px-2 py-0.5 rounded tracking-widest">Gabarito</span>}
                                </span>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEditOption(option)}>Editar</Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-300 hover:text-rose-600 hover:bg-rose-50" onClick={() => void handleDeleteOption(option.id)}>
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </Button>
                                </div>
                              </div>
                            </li>
                          ))}
                          {question.options.length === 0 ? (
                            <li className="text-sm italic text-slate-400 p-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center">Nenhuma alternativa vinculada a esta questão. Utilize o formulário escuro acima.</li>
                          ) : null}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-slate-50/50 flex flex-col items-center justify-center">
             <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-300 mb-4">
               <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </div>
             <p className="text-lg font-bold text-slate-900 leading-tight">Avaliação não configurada</p>
             <p className="text-slate-500 mt-2 max-w-sm">
               Você precisa definir e salvar as regras básicas da avaliação no painel ao lado antes de adicionar questões.
             </p>
          </div>
        )}
      </div>
    </div>
  )
}
