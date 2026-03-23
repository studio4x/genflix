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
        setError('Avaliação não encontrada.')
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Preparando ambiente de prova...</p>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm border border-red-200">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ops! Algo deu errado</h2>
        <p className="mt-2 text-slate-600">{error}</p>
        <Button size="lg" className="mt-6 bg-slate-900 hover:bg-slate-800" onClick={() => navigate(-1)}>Voltar para o Curso</Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl py-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl shadow-sm mb-6 bg-white border border-slate-200">
          <span className="font-bold text-2xl leading-none text-blue-600">HM</span>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
          <div className={`p-10 text-center ${result.is_approved ? 'bg-gradient-to-b from-emerald-50 to-white' : 'bg-gradient-to-b from-rose-50 to-white'}`}>
            <div className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-sm border ${
              result.is_approved ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-rose-100 text-rose-600 border-rose-200'
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
              <span className={`text-5xl font-black tracking-tighter ${result.is_approved ? 'text-emerald-600' : 'text-rose-600'}`}>
                {result.score_percent}%
              </span>
            </div>
          </div>
          
          <div className="p-8 sm:p-10 space-y-8 bg-white">
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tentativa</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">{result.attempt_number}<span className="text-xl text-slate-400">/{result.max_attempts}</span></p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tentativas Restantes</p>
                <p className={`mt-1 text-3xl font-extrabold ${result.remaining_attempts === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {result.remaining_attempts}
                </p>
              </div>
            </div>

            {!result.is_approved && result.remaining_attempts > 0 && (
              <div className="flex gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900">Dica de Estudo</h4>
                  <p className="mt-1 text-sm text-blue-800 leading-relaxed">Revise os conteúdos do módulo com calma antes de tentar novamente para garantir sua aprovação. Todo o material continuará disponível.</p>
                </div>
              </div>
            )}

            {!result.is_approved && result.remaining_attempts === 0 && (
              <div className="flex gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-rose-900">Atenção Especial</h4>
                  <p className="mt-1 text-sm text-rose-800 leading-relaxed">Você atingiu o limite de tentativas. Entre em contato com seu tutor ou suporte da plataforma para orientações sobre como prosseguir.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" className="flex-1 shrink-0 h-14 bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200" asChild>
                <Link to={`/aluno/cursos/${courseId}`}>Voltar para o Curso</Link>
              </Button>
              {!result.is_approved && result.remaining_attempts > 0 && (
                <Button variant="outline" size="lg" className="flex-1 shrink-0 h-14 border-slate-300 shadow-sm hover:bg-slate-50 text-slate-700" onClick={() => window.location.reload()}>
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
    return <div className="p-12 text-center text-slate-500 font-medium border border-slate-200 rounded-2xl bg-white shadow-sm max-w-2xl mx-auto">Nenhuma questão configurada para esta avaliação no momento.</div>
  }

  return (
    <div className="mx-auto max-w-4xl py-6 md:py-10 space-y-8 min-h-screen animate-in fade-in duration-500">
      <header className="sticky top-0 z-10 -mx-6 px-6 pb-6 pt-6 bg-slate-50/90 backdrop-blur-md md:static md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">{assessment.title}</h2>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                LMS Assessment
              </span>
              <span className="text-sm font-medium text-slate-500">Questão {currentQuestionIndex + 1} de {questions.length}</span>
            </div>
          </div>
          <div className="md:text-right">
             <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-500 hover:text-rose-500 hover:bg-rose-50 -ml-4 md:ml-0 transition-colors">
               <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               Sair da Prova
             </Button>
          </div>
        </div>
        
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/60 shadow-inner">
          <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="space-y-8">
        <article className="rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-100/50 overflow-hidden">
          <div className="p-8 sm:p-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <span className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Questão {currentQuestionIndex + 1}
                </span>
                <h3 className="text-2xl font-extrabold leading-snug text-slate-900 tracking-tight sm:text-3xl">
                  {currentQuestion.question_text}
                </h3>
              </div>

              <div className="grid gap-4 mt-8">
                {currentQuestion.options.map((option: AssessmentOption) => {
                  const isSelected = selectedOptions[currentQuestion.id] === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                      className={`group relative flex items-center gap-5 rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/50 shadow-md ring-4 ring-blue-600/10' 
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm'
                      }`}
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white scale-110 shadow-sm' : 'border-slate-300 bg-slate-50 group-hover:border-blue-300 group-hover:bg-white'
                      }`}>
                        {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
                      </div>
                      <span className={`text-[1.05rem] sm:text-lg font-medium leading-relaxed transition-colors ${isSelected ? 'text-blue-900 font-semibold' : 'text-slate-700 group-hover:text-slate-900'}`}>
                        {option.option_text}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </article>

        <footer className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto h-14 px-8 border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold shadow-sm"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => i - 1)}
          >
            Anterior
          </Button>

          {isLastQuestion ? (
            <div className="w-full sm:w-auto flex flex-col items-center">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-10 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 font-bold text-base transition-all"
                disabled={!allQuestionsAnswered || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Processando envio...' : 'Finalizar Prova Oficial'}
                {!isSubmitting && (
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                )}
              </Button>
              {!allQuestionsAnswered && (
                <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-wider text-rose-500 animate-pulse">
                  Responda todas as questões para finalizar
                </p>
              )}
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full sm:w-auto h-14 px-10 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 font-bold text-base transition-all"
              disabled={!selectedOptions[currentQuestion.id]}
              onClick={() => setCurrentQuestionIndex((i) => i + 1)}
            >
              Avançar Questão
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </Button>
          )}
        </footer>
      </main>
    </div>
  )
}
