import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  fetchAssessmentForExecution,
  submitAssessmentAttempt,
  fetchStudentCourseAssessments,
  toErrorMessage,
  type StudentAssessmentQuestionWithOptions,
  type SubmitAssessmentAttemptResult,
} from '@/features/student/assessments/api'
import { fetchStudentCourseContentWithProgress } from '@/features/student/courses/api'
import type { Assessment, AssessmentOption } from '@/types/content'

export function StudentAssessmentExecutionPage() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>()
  const navigate = useNavigate()
  const { setModules, setAssessments } = useOutletContext<{ setModules: (m: any) => void, setAssessments: (a: any) => void }>()

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
        setResult(null)
        setCurrentQuestionIndex(0)
        setSelectedOptions({})
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
    return questions.every((q) => selectedOptions[q.id])
  }, [questions, selectedOptions])

  async function handleSubmit() {
    if (!assessmentId || !courseId) return
    
    setIsSubmitting(true)
    setError(null)

    try {
      const answers = Object.entries(selectedOptions).map(([question_id, option_id]) => ({
        question_id,
        option_id,
      }))

      const submissionResult = await submitAssessmentAttempt(assessmentId, answers)
      setResult(submissionResult)

      // Se passou, atualizar o progresso na sidebar do player
      if (submissionResult.is_approved) {
         try {
            const [refreshedModules, refreshedAssessments] = await Promise.all([
               fetchStudentCourseContentWithProgress(courseId),
               fetchStudentCourseAssessments(courseId)
            ])
            setModules(refreshedModules)
            setAssessments(refreshedAssessments)
         } catch (refreshErr) {
            console.error('Falha ao atualizar progresso:', refreshErr)
         }
      }
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
        <p className="text-sm font-medium text-slate-500 animate-pulse font-bold uppercase tracking-widest">Preparando ambiente de prova...</p>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="mx-auto max-w-2xl mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm border border-red-200">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ops! Algo deu errado</h2>
        <p className="mt-2 text-slate-600">{error}</p>
        <Button size="lg" className="mt-6 bg-slate-900 hover:bg-slate-800 rounded-2xl" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl py-8 md:py-16 animate-in fade-in zoom-in-95 duration-500 p-4">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
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
              <span className={`text-6xl font-black tracking-tighter ${result.is_approved ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo Restante</p>
                <p className={`mt-1 text-3xl font-extrabold ${result.remaining_attempts === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {result.remaining_attempts}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" className="flex-1 shrink-0 h-14 bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 rounded-2xl font-bold" onClick={() => navigate(`/aluno/cursos/${courseId}`)}>
                Ir para o Dashboard
              </Button>
              {!result.is_approved && result.remaining_attempts > 0 && (
                <Button variant="outline" size="lg" className="flex-1 shrink-0 h-14 border-slate-300 shadow-sm hover:bg-slate-50 text-slate-700 rounded-2xl font-bold" onClick={() => setResult(null)}>
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
    return <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest border border-slate-200 rounded-3xl bg-white shadow-sm max-w-2xl mx-auto mt-20">Nenhuma questão configurada para esta avaliação.</div>
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 pb-32">
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
             <div className="flex items-center gap-3 mb-1">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">
                    AVALIAÇÃO OFICIAL
                </span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest italic">
                    {assessment.title}
                </span>
             </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">Questão {currentQuestionIndex + 1} de {questions.length}</h2>
          </div>
        </div>
        
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/60 shadow-inner p-0.5">
          <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out rounded-full shadow-lg shadow-blue-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="space-y-8">
        <article className="rounded-[48px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="p-8 sm:p-14">
            <div className="space-y-10">
              <div className="space-y-6">
                <span className="inline-block rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">
                  PERGUNTA {currentQuestionIndex + 1}
                </span>
                <h3 className="text-2xl font-black leading-snug text-slate-900 tracking-tight sm:text-4xl">
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
                      className={`group relative flex items-center gap-5 rounded-[32px] border-2 p-6 text-left transition-all duration-300 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/50 shadow-xl ring-8 ring-blue-600/5' 
                          : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-lg' : 'border-slate-200 bg-white group-hover:border-blue-300'
                      }`}>
                        {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white animate-in zoom-in-50" />}
                      </div>
                      <span className={`text-lg sm:text-xl font-bold leading-relaxed transition-colors ${isSelected ? 'text-blue-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        {option.option_text}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </article>

        <footer className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-6 rounded-[32px] border border-white shadow-xl shadow-slate-100 sticky bottom-4 z-20">
          <Button
            variant="ghost"
            size="lg"
            className="w-full sm:w-auto h-14 px-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 font-black uppercase tracking-widest text-xs rounded-2xl"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => i - 1)}
          >
            Questão Anterior
          </Button>

          {isLastQuestion ? (
            <div className="w-full sm:w-auto flex flex-col items-center">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-12 bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-200 font-black uppercase tracking-widest text-sm transition-all rounded-[24px] text-white"
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
              className="w-full sm:w-auto h-14 px-12 bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 font-black uppercase tracking-widest text-sm transition-all rounded-[24px] text-white"
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
