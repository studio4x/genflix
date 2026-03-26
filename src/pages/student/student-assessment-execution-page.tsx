import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchAssessmentForExecution,
  fetchOwnAssessmentAttemptRequest,
  fetchOwnAssessmentReview,
  fetchStudentCourseAssessments,
  requestAssessmentAttemptRetry,
  submitAssessmentAttempt,
  toErrorMessage,
  type AssessmentAttemptRequest,
  type StudentCourseAssessmentSummary,
  type StudentAssessmentQuestionWithOptions,
  type StudentAssessmentReview,
  type SubmitAssessmentAttemptResult,
} from '@/features/student/assessments/api'
import { fetchStudentCourseContentWithProgress } from '@/features/student/courses/api'
import type { Assessment, AssessmentOption, StudentCourseModuleProgress } from '@/types/content'

function hashShuffleKey(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function shuffleQuestionOptionsForAttempt(
  questions: StudentAssessmentQuestionWithOptions[],
  attemptNumber: number,
) {
  return questions.map((question) => ({
    ...question,
    options: [...question.options].sort((optionA, optionB) => {
      const hashA = hashShuffleKey(`${question.id}:${optionA.id}:${attemptNumber}`)
      const hashB = hashShuffleKey(`${question.id}:${optionB.id}:${attemptNumber}`)

      if (hashA !== hashB) {
        return hashA - hashB
      }

      return optionA.id.localeCompare(optionB.id)
    }),
  }))
}

export function StudentAssessmentExecutionPage() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>()
  const navigate = useNavigate()
  const { roles } = useAuth()
  const isAdmin = roles.includes('admin')
  const { modules, assessments, setModules, setAssessments } = useOutletContext<{
    modules: StudentCourseModuleProgress[]
    assessments: StudentCourseAssessmentSummary[]
    setModules: (modules: StudentCourseModuleProgress[]) => void
    setAssessments: (assessments: StudentCourseAssessmentSummary[]) => void
  }>()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<StudentAssessmentQuestionWithOptions[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRequestingRetry, setIsRequestingRetry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitAssessmentAttemptResult | null>(null)
  const [review, setReview] = useState<StudentAssessmentReview | null>(null)
  const [attemptRequest, setAttemptRequest] = useState<AssessmentAttemptRequest | null>(null)
  const [activeAttemptNumber, setActiveAttemptNumber] = useState(1)

  const studentAssessment = useMemo(() => {
    return assessments?.find((item) => item.assessment_id === assessmentId)
  }, [assessments, assessmentId])

  const reviewAnswersByQuestion = useMemo(() => {
    return new Map(review?.answers.map((answer) => [answer.question_id, answer]) ?? [])
  }, [review])

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
        setError('Avaliacao nao encontrada.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const [{ assessment: assessmentData, questions: questionsData }, reviewData, requestData] = await Promise.all([
          fetchAssessmentForExecution(assessmentId),
          fetchOwnAssessmentReview(assessmentId),
          fetchOwnAssessmentAttemptRequest(assessmentId),
        ])

        setReview(reviewData)
        setAttemptRequest(requestData)
        setResult(null)
        setCurrentQuestionIndex(0)

        const nextAttemptNumber = reviewData.latestAttempt?.is_approved && Number(reviewData.latestAttempt.score_percent) >= 100
          ? reviewData.latestAttempt.attempt_number
          : (reviewData.latestAttempt?.attempt_number ?? 0) + 1

        setAssessment(assessmentData)
        setActiveAttemptNumber(nextAttemptNumber)
        setQuestions(shuffleQuestionOptionsForAttempt(questionsData, nextAttemptNumber))

        if (reviewData.latestAttempt?.is_approved && Number(reviewData.latestAttempt.score_percent) >= 100) {
          const correctSelections = Object.fromEntries(
            questionsData
              .map((question) => {
                const correctOption = question.question_type === 'single_choice'
                  ? question.options.find((option) => option.is_correct)
                  : null
                return correctOption ? [question.id, correctOption.id] : null
              })
              .filter((entry): entry is [string, string] => Boolean(entry)),
          )
          setSelectedOptions(correctSelections)
          setTextAnswers(
            Object.fromEntries(
              reviewData.answers
                .filter((answer) => Boolean(answer.answer_text))
                .map((answer) => [answer.question_id, answer.answer_text ?? '']),
            ),
          )
        } else {
          setSelectedOptions({})
          setTextAnswers({})
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
  const objectiveQuestionCount = useMemo(
    () => questions.filter((question) => question.question_type === 'single_choice').length,
    [questions],
  )
  const requiredCorrectAnswers = useMemo(() => {
    if (!assessment || objectiveQuestionCount === 0) {
      return 0
    }

    return Math.ceil((assessment.passing_score / 100) * objectiveQuestionCount)
  }, [assessment, objectiveQuestionCount])
  const approvalRequirementText = useMemo(() => {
    if (!assessment || objectiveQuestionCount === 0) {
      return null
    }

    const questionLabel = objectiveQuestionCount === 1 ? 'questão objetiva' : 'questões objetivas'
    return `Para aprovação, você precisa acertar pelo menos ${requiredCorrectAnswers} de ${objectiveQuestionCount} ${questionLabel} (${assessment.passing_score}% de aproveitamento).`
  }, [assessment, objectiveQuestionCount, requiredCorrectAnswers])

  const allQuestionsAnswered = useMemo(() => {
    return questions.every((question) => {
      if (question.question_type === 'essay_ai') {
        return Boolean(textAnswers[question.id]?.trim())
      }

      return Boolean(selectedOptions[question.id])
    })
  }, [questions, selectedOptions, textAnswers])

  const currentQuestionAnswered = useMemo(() => {
    if (!currentQuestion) return false
    if (currentQuestion.question_type === 'essay_ai') {
      return Boolean(textAnswers[currentQuestion.id]?.trim())
    }
    return Boolean(selectedOptions[currentQuestion.id])
  }, [currentQuestion, selectedOptions, textAnswers])

  const isModuleQuizLockedByLessons = useMemo(() => {
    if (isAdmin) return false
    if (!moduleForAssessment) return false
    return moduleForAssessment.lessons.length === 0 || !moduleForAssessment.lessons.every((lesson) => lesson.is_completed)
  }, [isAdmin, moduleForAssessment])

  const firstPendingLessonHref = useMemo(() => {
    if (!courseId || !moduleForAssessment) {
      return courseId ? `/aluno/cursos/${courseId}` : '/aluno/cursos'
    }

    const firstPendingLesson = moduleForAssessment.lessons.find((lesson) => !lesson.is_completed)
    const fallbackLesson = moduleForAssessment.lessons[0]
    const targetLesson = firstPendingLesson ?? fallbackLesson

    if (!targetLesson) {
      return `/aluno/cursos/${courseId}`
    }

    return `/aluno/cursos/${courseId}/player/aulas/${targetLesson.id}`
  }, [courseId, moduleForAssessment])

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

  const finalAssessmentBlockReason = useMemo(() => {
    if (!studentAssessment || studentAssessment.assessment_type !== 'final' || studentAssessment.state !== 'blocked') {
      return null
    }

    const incompleteModule = modules.find((module) => {
      if (!module.is_required) return false
      if (!module.lessons.every((lesson) => lesson.is_completed)) return true
      if (module.has_required_assessment && !module.required_assessment_approved) return true
      return false
    })

    if (!incompleteModule) {
      return {
        title: 'Prova Final Ainda Bloqueada',
        description: 'A prova final so e liberada depois que todos os requisitos obrigatorios do curso forem concluidos.',
      }
    }

    const blockingQuiz = assessments.find(
      (item) =>
        item.assessment_type === 'module' &&
        item.module_id === incompleteModule.id &&
        item.is_required,
    )

    if (blockingQuiz?.state === 'failed_limit') {
      return {
        title: 'Prova Final Bloqueada por Quiz Pendente',
        description: `A prova final ainda nao pode ser aberta porque o quiz "${blockingQuiz.title}" do modulo "${incompleteModule.title}" esta com o limite de tentativas atingido e ainda nao foi aprovado.`,
      }
    }

    if (blockingQuiz && !blockingQuiz.last_is_approved) {
      return {
        title: 'Prova Final Bloqueada por Quiz Pendente',
        description: `A prova final so sera liberada depois da aprovacao no quiz "${blockingQuiz.title}" do modulo "${incompleteModule.title}".`,
      }
    }

    return {
      title: 'Prova Final Bloqueada por Modulo Incompleto',
      description: `A prova final ainda nao pode ser aberta porque o modulo "${incompleteModule.title}" nao foi concluido por completo.`,
    }
  }, [assessments, modules, studentAssessment])

  async function refreshCourseState() {
    if (!courseId) return

    try {
      const [refreshedModules, refreshedAssessments] = await Promise.all([
        fetchStudentCourseContentWithProgress(courseId),
        fetchStudentCourseAssessments(courseId),
      ])
      setModules(refreshedModules)
      setAssessments(refreshedAssessments)
    } catch (refreshError) {
      console.error('Falha ao atualizar progresso:', refreshError)
    }
  }

  async function handleSubmit() {
    if (!assessmentId || !courseId || isPerfectApprovedReview) return

    setIsSubmitting(true)
    setError(null)

    try {
      const answers = questions.map((question) => (
        question.question_type === 'essay_ai'
          ? {
            question_id: question.id,
            answer_text: textAnswers[question.id]?.trim() ?? '',
            option_id: null,
          }
          : {
            question_id: question.id,
            option_id: selectedOptions[question.id] ?? null,
            answer_text: null,
          }
      ))

      const submissionResult = await submitAssessmentAttempt(assessmentId, answers)
      setResult(submissionResult)
      await refreshCourseState()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestRetry() {
    if (!assessmentId) return

    setIsRequestingRetry(true)
    setError(null)

    try {
      await requestAssessmentAttemptRetry(assessmentId)
      const [requestData] = await Promise.all([
        fetchOwnAssessmentAttemptRequest(assessmentId),
        refreshCourseState(),
      ])
      setAttemptRequest(requestData)
    } catch (requestError) {
      setError(toErrorMessage(requestError))
    } finally {
      setIsRequestingRetry(false)
    }
  }

  function handleOptionSelect(questionId: string, optionId: string) {
    if (isPerfectApprovedReview) return
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: optionId,
    }))
  }

  function handleEssayAnswerChange(questionId: string, answerText: string) {
    if (isPerfectApprovedReview) return
    setTextAnswers((prev) => ({
      ...prev,
      [questionId]: answerText,
    }))
  }

  if (isModuleQuizLockedByLessons && !result) {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in zoom-in-95 p-4 py-12 duration-500 md:py-24">
        <div className="overflow-hidden rounded-[40px] border border-amber-100 bg-white shadow-2xl shadow-amber-200/20">
          <div className="bg-gradient-to-b from-amber-50/60 to-white p-12 text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white bg-amber-100 text-amber-600 shadow-lg shadow-amber-100">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900">Quiz Ainda Bloqueado</h2>
            <p className="mt-4 font-medium leading-relaxed text-slate-500">
              Para realizar o quiz deste modulo, conclua todas as aulas do modulo primeiro.
            </p>
            <Button
              size="lg"
              className="mt-10 h-14 w-full rounded-2xl bg-slate-900 font-bold shadow-xl shadow-slate-200 hover:bg-slate-800"
              onClick={() => navigate(firstPendingLessonHref)}
            >
              Voltar para o Curso
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (studentAssessment?.state === 'failed_limit' && !result) {
    const hasPendingRequest = attemptRequest?.status === 'pending'
    const isRejectedRequest = attemptRequest?.status === 'rejected'

    return (
      <div className="mx-auto max-w-2xl animate-in fade-in zoom-in-95 p-4 py-12 duration-500 md:py-24">
        <div className="overflow-hidden rounded-[40px] border border-rose-100 bg-white shadow-2xl shadow-rose-200/20">
          <div className="bg-gradient-to-b from-rose-50/50 to-white p-12 text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white bg-rose-100 text-rose-600 shadow-lg shadow-rose-100">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900">Limite de Tentativas Atingido</h2>
            <p className="mt-4 font-medium leading-relaxed text-slate-500">
              Voce ja realizou todas as tentativas permitidas para este quiz ({studentAssessment.max_attempts} de {studentAssessment.max_attempts}) e nao obteve a pontuacao minima necessaria.
            </p>
            {approvalRequirementText ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left text-sm font-semibold text-amber-900">
                {approvalRequirementText}
              </div>
            ) : null}

            <div className="mt-8 rounded-3xl border border-slate-100 bg-slate-50 p-6 text-left">
              <div className="mb-2 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-sm font-bold text-slate-700">Proximo passo</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                {hasPendingRequest
                  ? 'Sua solicitacao de nova tentativa ja foi enviada e esta aguardando analise do administrador.'
                  : isRejectedRequest
                    ? 'Sua ultima solicitacao foi recusada. Se necessario, envie um novo pedido para que a equipe analise outra liberacao.'
                    : 'Voce pode enviar uma solicitacao de nova tentativa para analise do administrador diretamente por esta tela.'}
              </p>
              {attemptRequest?.admin_response ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Retorno do administrador</span>
                  <p className="mt-2 leading-relaxed">{attemptRequest.admin_response}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-14 flex-1 rounded-2xl bg-slate-900 font-bold shadow-xl shadow-slate-200 hover:bg-slate-800"
                onClick={() => navigate(`/aluno/cursos/${courseId}`)}
              >
                Voltar para o Curso
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 flex-1 rounded-2xl border-slate-300 font-bold text-slate-700 hover:bg-slate-50"
                disabled={hasPendingRequest || isRequestingRetry}
                onClick={() => void handleRequestRetry()}
              >
                {hasPendingRequest ? 'Solicitacao Enviada' : isRequestingRetry ? 'Enviando...' : 'Solicitar Nova Tentativa'}
              </Button>
            </div>
            {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  if (finalAssessmentBlockReason && !result) {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in zoom-in-95 p-4 py-12 duration-500 md:py-24">
        <div className="overflow-hidden rounded-[40px] border border-amber-100 bg-white shadow-2xl shadow-amber-200/20">
          <div className="bg-gradient-to-b from-amber-50/60 to-white p-12 text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white bg-amber-100 text-amber-600 shadow-lg shadow-amber-100">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.502-1.667 1.732-3L13.73 4c-.77-1.333-2.69-1.333-3.46 0L3.2 16c-.77 1.333.19 3 1.73 3z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900">{finalAssessmentBlockReason.title}</h2>
            <p className="mt-4 font-medium leading-relaxed text-slate-500">{finalAssessmentBlockReason.description}</p>
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
      <div className="mx-auto max-w-2xl animate-in fade-in zoom-in-95 p-4 py-8 duration-500 md:py-16">
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
              {result.score_mode === 'essay_only'
                ? result.is_approved
                  ? 'Resposta discursiva validada.'
                  : 'A resposta discursiva precisa de ajuste.'
                : result.is_approved
                  ? 'Parabéns! Você foi aprovado.'
                  : 'Nao foi desta vez.'}
            </h2>
            <div className="mt-4 flex flex-col items-center justify-center gap-1">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Nota Final</span>
              <span className={`text-6xl font-black tracking-tighter ${result.is_approved ? 'text-emerald-600' : 'text-rose-600'}`}>
                {result.score_percent}%
              </span>
            </div>
            {approvalRequirementText ? (
              <p className="mx-auto mt-5 max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
                {approvalRequirementText}
              </p>
            ) : null}
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

            {result.essay_feedbacks.length > 0 && (
              <div className="space-y-4 rounded-3xl border border-amber-100 bg-amber-50/50 p-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-amber-700">Feedback da IA</p>
                  <p className="mt-2 text-sm font-medium text-amber-900">
                    As questões discursivas são avaliadas separadamente e não somam pontos no quiz.
                  </p>
                </div>

                <div className="space-y-3">
                  {result.essay_feedbacks.map((feedback, index) => (
                    <div key={feedback.question_id} className="rounded-2xl border border-white/70 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Questão {index + 1}</p>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                          feedback.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {feedback.is_correct ? 'Correta' : 'Revisar'}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-900">{feedback.question_text}</h3>
                      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sua resposta</p>
                        <p className="mt-2 whitespace-pre-wrap">{feedback.answer_text}</p>
                      </div>
                      <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Comentário da IA</p>
                        <p className="mt-2 whitespace-pre-wrap">{feedback.feedback}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    const nextAttemptNumber = activeAttemptNumber + 1
                    setResult(null)
                    setSelectedOptions({})
                    setTextAnswers({})
                    setCurrentQuestionIndex(0)
                    setActiveAttemptNumber(nextAttemptNumber)
                    setQuestions((currentQuestions) => shuffleQuestionOptionsForAttempt(currentQuestions, nextAttemptNumber))
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
    return (
      <div className="mx-auto mt-20 max-w-2xl rounded-3xl border border-slate-200 bg-white p-12 text-center font-bold uppercase tracking-widest text-slate-500 shadow-sm">
        Nenhuma questao configurada para esta avaliacao.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl animate-in fade-in space-y-8 p-4 pb-32 duration-500 sm:p-8">
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
            Voce ja concluiu este quiz com 100%. As respostas corretas estao destacadas e uma nova tentativa nao e permitida.
          </div>
        )}

        {approvalRequirementText ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-900">
            {approvalRequirementText}
          </div>
        ) : null}

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
                {currentQuestion.question_type === 'essay_ai' && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
                    Resposta discursiva com validação por IA. Esta questão não gera pontos no quiz, mas você receberá feedback automático.
                  </div>
                )}
              </div>

              {currentQuestion.question_type === 'essay_ai' ? (
                <div className="mt-8 space-y-4">
                  <textarea
                    value={textAnswers[currentQuestion.id] ?? ''}
                    onChange={(event) => handleEssayAnswerChange(currentQuestion.id, event.target.value)}
                    readOnly={isPerfectApprovedReview}
                    className={`min-h-[220px] w-full rounded-[32px] border-2 px-6 py-6 text-lg leading-relaxed shadow-sm transition-all focus:ring-8 ${
                      isPerfectApprovedReview
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 focus:ring-emerald-100'
                        : 'border-slate-200 bg-white text-slate-700 focus:border-blue-300 focus:ring-blue-100'
                    }`}
                    placeholder="Escreva sua resposta com suas proprias palavras..."
                  />
                  {isPerfectApprovedReview && reviewAnswersByQuestion.get(currentQuestion.id)?.ai_feedback ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Feedback da IA</p>
                      <p className="mt-2 whitespace-pre-wrap">{reviewAnswersByQuestion.get(currentQuestion.id)?.ai_feedback}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </article>

        <footer className="sticky bottom-4 z-20 flex flex-col-reverse items-center justify-between gap-4 rounded-[32px] border border-white bg-white/50 p-6 shadow-xl shadow-slate-100 backdrop-blur-sm sm:flex-row">
          <Button
            variant="ghost"
            size="lg"
            className="h-14 w-full rounded-2xl px-8 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:w-auto"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((index) => index - 1)}
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
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="h-14 w-full rounded-[24px] bg-blue-600 px-12 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-200 transition-all hover:bg-blue-700 sm:w-auto"
              disabled={!currentQuestionAnswered}
              onClick={() => setCurrentQuestionIndex((index) => index + 1)}
            >
              PRÓXIMA QUESTÃO
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </footer>
      </main>
    </div>
  )
}
