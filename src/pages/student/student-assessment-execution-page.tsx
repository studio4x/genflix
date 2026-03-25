import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchAssessmentForExecution,
  fetchOwnAssessmentReview,
  fetchStudentCourseAssessments,
  submitAssessmentAttempt,
  toErrorMessage,
  type StudentAssessmentQuestionWithOptions,
  type StudentAssessmentReview,
  type SubmitAssessmentAttemptResult,
} from '@/features/student/assessments/api'
import { fetchStudentCourseContentWithProgress } from '@/features/student/courses/api'
import type { Assessment, AssessmentOption, StudentCourseModuleProgress } from '@/types/content'

export function StudentAssessmentExecutionPage() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>()
  const navigate = useNavigate()
  const { roles } = useAuth()
  const isAdmin = roles.includes('admin')
  const { modules, assessments, setModules, setAssessments } = useOutletContext<{
    modules: StudentCourseModuleProgress[]
    assessments: any[]
    setModules: (m: any) => void
    setAssessments: (a: any) => void
  }>()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<StudentAssessmentQuestionWithOptions[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitAssessmentAttemptResult | null>(null)
  const [review, setReview] = useState<StudentAssessmentReview | null>(null)

  const studentAssessment = useMemo(() => {
    return assessments?.find((item) => item.assessment_id === assessmentId || item.id === assessmentId)
  }, [assessments, assessmentId])

  const moduleForAssessment = useMemo(() => {
    if (!studentAssessment?.module_id) return null
    return modules.find((module) => module.id === studentAssessment.module_id) ?? null
  }, [studentAssessment, modules])

  const isPerfectApprovedReview = useMemo(() => {
    return Boolean(review?.latestAttempt?.is_approved && Number(review.latestAttempt.score_percent) >= 100)
  }, [review])

  useEffect(() => {
    async function loadAssessment() {
      if (!assessmentId) {
        setError('Avaliação não encontrada.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const [{ assessment: assessmentData, questions: questionsData }, reviewData] = await Promise.all([
          fetchAssessmentForExecution(assessmentId),
          fetchOwnAssessmentReview(assessmentId),
        ])

        setAssessment(assessmentData)
        setQuestions(questionsData)
        setReview(reviewData)
        setResult(null)
        setCurrentQuestionIndex(0)

        if (reviewData.latestAttempt?.is_approved && Number(reviewData.latestAttempt.score_percent) >= 100) {
          const correctSelections = Object.fromEntries(
            questionsData
              .map((question) => {
                const correctOption = question.options.find((option) => option.is_correct)
                return correctOption ? [question.id, correctOption.id] : null
              })
              .filter((entry): entry is [string, string] => Boolean(entry)),
          )
          setSelectedOptions(correctSelections)
        } else {
          setSelectedOptions({})
        }
      } catch (loadError) {
        setError(toErrorMessage(loadError))
      } finally {
        setIsLoading(false)
      }
    }

    void loadAssessment()
    window.scrollTo(0, 0)
  }, [assessmentId])

  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const progressPercent = questions.length > 0
    ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
    : 0

  const allQuestionsAnswered = useMemo(() => {
    return questions.every((question) => selectedOptions[question.id])
  }, [questions, selectedOptions])

  const isModuleQuizLockedByLessons = useMemo(() => {
    if (isAdmin) return false
    if (!moduleForAssessment) return false
    return moduleForAssessment.lessons.length === 0 || !moduleForAssessment.lessons.every((lesson) => lesson.is_completed)
  }, [isAdmin, moduleForAssessment])

  const approvedAction = useMemo(() => {
    if (!courseId || !studentAssessment || studentAssessment.assessment_type !== 'module' || !studentAssessment.module_id) {
      return {
        label: 'Ir para o Dashboard',
        href: courseId ? `/aluno/cursos/${courseId}` : '/aluno/cursos',
      }
    }

    const sortedModules = [...modules].sort((a, b) => a.position - b.position)
    const currentModuleIndex = sortedModules.findIndex((module) => module.id === studentAssessment.module_id)
    const nextModuleWithLessons = sortedModules
      .slice(currentModuleIndex + 1)
      .find((module) => module.lessons.length > 0)

    if (nextModuleWithLessons) {
      return {
        label: 'Ir para o Próximo Módulo',
        href: `/aluno/cursos/${courseId}/player/aulas/${nextModuleWithLessons.lessons[0].id}`,
      }
    }

    const finalAssessment = assessments.find((item) => item.assessment_type === 'final')
    if (finalAssessment) {
      return {
        label: 'Ir para a Prova Final',
        href: `/aluno/cursos/${courseId}/player/avaliacoes/${finalAssessment.assessment_id}`,
      }
    }

    return {
      label: 'Ir para o Dashboard',
      href: `/aluno/cursos/${courseId}`,
    }
  }, [assessments, courseId, modules, studentAssessment])

  async function handleSubmit() {
    if (!assessmentId || !courseId || isPerfectApprovedReview) return

    setIsSubmitting(true)
    setError(null)

    try {
      const answers = Object.entries(selectedOptions).map(([question_id, option_id]) => ({
        question_id,
        option_id,
      }))

      const submissionResult = await submitAssessmentAttempt(assessmentId, answers)
      setResult(submissionResult)

      try {
        const [refreshedModules, refreshedAssessments] = await Promise.all([
          fetchStudentCourseContentWithProgress(courseId),
          fetchStudentCourseAssessments(courseId),
        ])
        setModules(refreshedModules)
        setAssessments(refreshedAssessments)
      } catch (refreshErr) {
        console.error('Falha ao atualizar progresso:', refreshErr)
      }
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOptionSelect(questionId: string, optionId: string) {
    if (isPerfectApprovedReview) return
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: optionId,
    }))
  }

  if (isModuleQuizLockedByLessons && !result) {
    return (
      <div className="mx-auto max-w-2xl p-4 py-12 md:py-24 animate-in fade-in zoom-in-95 duration-500">
        <div className="overflow-hidden rounded-[40px] border border-amber-100 bg-white shadow-2xl shadow-amber-200/20">
          <div className="bg-gradient-to-b from-amber-50/60 to-white p-12 text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white bg-amber-100 text-amber-600 shadow-lg shadow-amber-100">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900">Quiz Ainda Bloqueado</h2>
            <p className="mt-4 font-medium leading-relaxed text-slate-500">
              Para realizar o quiz deste módulo, conclua todas as aulas do módulo primeiro.
            </p>
            <Button
              size="lg"
              className="mt-10 h-14 w-full rounded-2xl bg-slate-900 font-bold shadow-xl shadow-slate-200 hover:bg-slate-800"
              onClick={() => navigate(`/aluno/cursos/${courseId}`)}
            >
              Voltar para o Curso
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (studentAssessment?.state === 'failed_limit' && !result) {
    return (
      <div className="mx-auto max-w-2xl p-4 py-12 md:py-24 animate-in fade-in zoom-in-95 duration-500">
        <div className="overflow-hidden rounded-[40px] border border-rose-100 bg-white shadow-2xl shadow-rose-200/20">
          <div className="bg-gradient-to-b from-rose-50/50 to-white p-12 text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white bg-rose-100 text-rose-600 shadow-lg shadow-rose-100">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900">Limite de Tentativas Atingido</h2>
            <p className="mt-4 font-medium leading-relaxed text-slate-500">
              Você já realizou todas as tentativas permitidas para este quiz ({studentAssessment.max_attempts} de {studentAssessment.max_attempts}) e não obteve a pontuação mínima necessária.
            </p>
            <div className="mt-8 rounded-3xl border border-slate-100 bg-slate-50 p-6 text-left">
              <div className="mb-2 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-sm font-bold text-slate-700">O que acontece agora?</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                O acesso a esta avaliação está bloqueado para seu usuário. Entre em contato com o suporte ou com seu gestor para solicitar uma nova oportunidade, se aplicável ao seu plano de estudos.
              </p>
            </div>
            <Button
              size="lg"
              className="mt-10 h-14 w-full rounded-2xl bg-slate-900 font-bold shadow-xl shadow-slate-200 hover:bg-slate-800"
              onClick={() => navigate(`/aluno/cursos/${courseId}`)}
            >
              Voltar para o Curso
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="animate-pulse text-sm font-bold uppercase tracking-widest text-slate-500">Preparando ambiente de prova...</p>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-200 bg-red-100 text-red-600 shadow-sm">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ops! Algo deu errado</h2>
        <p className="mt-2 text-slate-600">{error}</p>
        <Button size="lg" className="mt-6 rounded-2xl bg-slate-900 hover:bg-slate-800" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl p-4 py-8 md:py-16 animate-in fade-in zoom-in-95 duration-500">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
          <div className={`p-10 text-center ${result.is_approved ? 'bg-gradient-to-b from-emerald-50 to-white' : 'bg-gradient-to-b from-rose-50 to-white'}`}>
            <div className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border shadow-sm ${
              result.is_approved ? 'border-emerald-200 bg-emerald-100 text-emerald-600' : 'border-rose-200 bg-rose-100 text-rose-600'
            }`}>
              {result.is_approved ? (
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h2 className={`text-3xl font-extrabold tracking-tight ${result.is_approved ? 'text-emerald-900' : 'text-rose-900'}`}>
              {result.is_approved ? 'Parabéns! Você foi aprovado.' : 'Não foi desta vez.'}
            </h2>
            <div className="mt-4 flex flex-col items-center justify-center gap-1">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Nota Final</span>
              <span className={`text-6xl font-black tracking-tighter ${result.is_approved ? 'text-emerald-600' : 'text-rose-600'}`}>
                {result.score_percent}%
              </span>
            </div>
          </div>

          <div className="space-y-8 bg-white p-8 sm:p-10">
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tentativa</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">{result.attempt_number}<span className="text-xl text-slate-400">/{result.max_attempts}</span></p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo Restante</p>
                <p className={`mt-1 text-3xl font-extrabold ${result.remaining_attempts === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {result.remaining_attempts}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <Button
                size="lg"
                className="h-14 flex-1 shrink-0 rounded-2xl bg-slate-900 font-bold shadow-xl shadow-slate-200 hover:bg-slate-800"
                onClick={() => navigate(result.is_approved ? approvedAction.href : `/aluno/cursos/${courseId}`)}
              >
                {result.is_approved ? approvedAction.label : 'Ir para o Dashboard'}
              </Button>
              {!result.is_approved && result.remaining_attempts > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 flex-1 shrink-0 rounded-2xl border-slate-300 text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => {
                    setResult(null)
                    setSelectedOptions({})
                    setCurrentQuestionIndex(0)
                  }}
                >
                  Tentar Novamente
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!assessment || questions.length === 0) {
    return <div className="mx-auto mt-20 max-w-2xl rounded-3xl border border-slate-200 bg-white p-12 text-center font-bold uppercase tracking-widest text-slate-500 shadow-sm">Nenhuma questão configurada para esta avaliação.</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 pb-32 sm:p-8 animate-in fade-in duration-500">
      <header className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="mb-1 flex items-center gap-3">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100">
                AVALIAÇÃO OFICIAL
              </span>
              <span className="text-xs font-black uppercase tracking-widest italic text-slate-400">
                {assessment.title}
              </span>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-4xl">Questão {currentQuestionIndex + 1} de {questions.length}</h2>
          </div>
        </div>

        {isPerfectApprovedReview && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
            Você já concluiu este quiz com 100%. As respostas corretas estão destacadas e uma nova tentativa não é permitida.
          </div>
        )}

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/60 p-0.5 shadow-inner">
          <div
            className="h-full rounded-full bg-blue-600 shadow-lg shadow-blue-200 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="space-y-8">
        <article className="overflow-hidden rounded-[48px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
          <div className="p-8 sm:p-14">
            <div className="space-y-10">
              <div className="space-y-6">
                <span className="inline-block rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
                  PERGUNTA {currentQuestionIndex + 1}
                </span>
                <h3 className="text-2xl font-black leading-snug tracking-tight text-slate-900 sm:text-4xl">
                  {currentQuestion.question_text}
                </h3>
              </div>

              <div className="mt-8 grid gap-4">
                {currentQuestion.options.map((option: AssessmentOption) => {
                  const isSelected = selectedOptions[currentQuestion.id] === option.id
                  const isCorrect = option.is_correct
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                      disabled={isPerfectApprovedReview}
                      className={`group relative flex items-center gap-5 rounded-[32px] border-2 p-6 text-left transition-all duration-300 ${
                        isPerfectApprovedReview && isCorrect
                          ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                          : isSelected
                            ? 'border-blue-600 bg-blue-50/50 shadow-xl ring-8 ring-blue-600/5'
                            : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-slate-50'
                      } ${isPerfectApprovedReview ? 'cursor-default' : ''}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isPerfectApprovedReview && isCorrect
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                            : 'border-slate-200 bg-white group-hover:border-blue-300'
                      }`}>
                        {(isPerfectApprovedReview && isCorrect) || isSelected ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-white" />
                        ) : null}
                      </div>
                      <span className={`text-lg font-bold leading-relaxed transition-colors sm:text-xl ${
                        isPerfectApprovedReview && isCorrect
                          ? 'text-emerald-900'
                          : isSelected
                            ? 'text-blue-900'
                            : 'text-slate-600 group-hover:text-slate-900'
                      }`}>
                        {option.option_text}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </article>

        <footer className="sticky bottom-4 z-20 flex flex-col-reverse items-center justify-between gap-4 rounded-[32px] border border-white bg-white/50 p-6 shadow-xl shadow-slate-100 backdrop-blur-sm sm:flex-row">
          <Button
            variant="ghost"
            size="lg"
            className="h-14 w-full rounded-2xl px-8 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:w-auto"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => i - 1)}
          >
            Questão Anterior
          </Button>

          {isPerfectApprovedReview ? (
            <Button
              size="lg"
              className="h-14 w-full rounded-[24px] bg-slate-900 px-12 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 sm:w-auto"
              onClick={() => navigate(approvedAction.href)}
            >
              {approvedAction.label}
            </Button>
          ) : isLastQuestion ? (
            <div className="flex w-full flex-col items-center sm:w-auto">
              <Button
                size="lg"
                className="h-14 w-full rounded-[24px] bg-emerald-600 px-12 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-emerald-200 transition-all hover:bg-emerald-700 sm:w-auto"
                disabled={!allQuestionsAnswered || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'ENVIANDO RESPOSTAS...' : 'FINALIZAR AVALIAÇÃO'}
                {!isSubmitting && (
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="h-14 w-full rounded-[24px] bg-blue-600 px-12 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-200 transition-all hover:bg-blue-700 sm:w-auto"
              disabled={!selectedOptions[currentQuestion.id]}
              onClick={() => setCurrentQuestionIndex((i) => i + 1)}
            >
              PRÓXIMA QUESTÃO
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </Button>
          )}
        </footer>
      </main>
    </div>
  )
}
