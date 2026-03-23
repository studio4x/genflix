import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  fetchAssessmentForExecution,
  submitAssessmentAttempt,
  toErrorMessage,
  type StudentAssessmentQuestionWithOptions,
  type SubmitAssessmentAttemptResult,
} from '@/features/student/assessments/api'
import type { Assessment, AssessmentOption } from '@/types/content'

export function StudentAssessmentExecutionPage() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<StudentAssessmentQuestionWithOptions[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitAssessmentAttemptResult | null>(null)

  useEffect(() => {
    async function loadAssessment() {
      if (!assessmentId) {
        setError('Avaliacao nao encontrada.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const { assessment: assessmentData, questions: questionsData } = 
          await fetchAssessmentForExecution(assessmentId)
        
        setAssessment(assessmentData)
        setQuestions(questionsData)
      } catch (loadError) {
        setError(toErrorMessage(loadError))
      } finally {
        setIsLoading(false)
      }
    }

    void loadAssessment()
  }, [assessmentId])

  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const progressPercent = questions.length > 0 
    ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100) 
    : 0

  const allQuestionsAnswered = useMemo(() => {
    return questions.every((q) => selectedOptions[q.id])
  }, [questions, selectedOptions])

  async function handleSubmit() {
    if (!assessmentId) return
    
    setIsSubmitting(true)
    setError(null)

    try {
      const answers = Object.entries(selectedOptions).map(([question_id, option_id]) => ({
        question_id,
        option_id,
      }))

      const submissionResult = await submitAssessmentAttempt(assessmentId, answers)
      setResult(submissionResult)
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOptionSelect(questionId: string, optionId: string) {
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: optionId,
    }))
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">Preparando sua avaliacao...</p>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ops! Algo deu errado</h2>
        <p className="mt-2 text-slate-600">{error}</p>
        <Button className="mt-6" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className={`p-8 text-center ${result.is_approved ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full shadow-inner ${
              result.is_approved ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {result.is_approved ? (
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900">
              {result.is_approved ? 'Parabens! Voce foi aprovado.' : 'Nao foi desta vez.'}
            </h2>
            <p className="mt-2 text-lg font-medium text-slate-600">
              Sua nota final foi <span className="text-2xl font-bold text-slate-900">{result.score_percent}%</span>
            </p>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tentativa</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{result.attempt_number}/{result.max_attempts}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tentativas Restantes</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{result.remaining_attempts}</p>
              </div>
            </div>

            {!result.is_approved && result.remaining_attempts > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-semibold text-amber-900">Dica:</p>
                <p>Revise os conteudos do modulo antes de tentar novamente para garantir sua aprovacao.</p>
              </div>
            )}

            {!result.is_approved && result.remaining_attempts === 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold text-red-900">Atencao:</p>
                <p>Voce atingiu o limite de tentativas. Entre em contato com seu tutor ou suporte para orientacoes.</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button size="lg" asChild>
                <Link to={`/aluno/cursos/${courseId}`}>Voltar para o curso</Link>
              </Button>
              {!result.is_approved && result.remaining_attempts > 0 && (
                <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
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
    return <div className="p-8 text-center text-slate-600">Nenhuma questao disponivel para esta avaliacao.</div>
  }

  return (
    <div className="mx-auto max-w-3xl py-6 space-y-6">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">{assessment.title}</h2>
            <p className="text-sm text-slate-500">Questao {currentQuestionIndex + 1} de {questions.length}</p>
          </div>
          <div className="text-right">
             <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-500 hover:text-red-500">
               Sair da prova
             </Button>
          </div>
        </div>
        
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div 
            className="h-full bg-amber-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="space-y-8">
        <article className="rounded-2xl border bg-white p-6 shadow-sm sm:p-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <span className="inline-block rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Pergunta #{currentQuestionIndex + 1}
              </span>
              <h3 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">
                {currentQuestion.question_text}
              </h3>
            </div>

            <div className="grid gap-3">
              {currentQuestion.options.map((option: AssessmentOption) => {
                const isSelected = selectedOptions[currentQuestion.id] === option.id
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                    className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected 
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500 ring-offset-2' 
                        : 'border-slate-100 bg-white hover:border-amber-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <span className={`text-base font-medium ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>
                      {option.option_text}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </article>

        <footer className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="lg"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => i - 1)}
          >
            Anterior
          </Button>

          {isLastQuestion ? (
            <Button
              size="lg"
              className="px-8 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100"
              disabled={!allQuestionsAnswered || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Enviando...' : 'Finalizar Prova'}
            </Button>
          ) : (
            <Button
              size="lg"
              className="px-8 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-100"
              disabled={!selectedOptions[currentQuestion.id]}
              onClick={() => setCurrentQuestionIndex((i) => i + 1)}
            >
              Proxima Questao
            </Button>
          )}
        </footer>

        {!allQuestionsAnswered && isLastQuestion && (
          <p className="text-center text-xs font-medium text-amber-600 animate-pulse">
            * Responda todas as questoes para poder finalizar.
          </p>
        )}
      </main>
    </div>
  )
}
