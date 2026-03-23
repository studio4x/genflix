import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/providers/auth-provider'
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
  type AssessmentQuestionWithOptions
} from '@/features/admin/assessments/api'
import { fetchModule } from '@/features/admin/content/api'
import type { Assessment, CourseModule } from '@/types/content'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'

export function AssessmentBuilderPanel() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId?: string }>()
  const { user } = useAuth()
  const { refreshTree } = useCourseBuilder()

  const [module, setModule] = useState<CourseModule | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<AssessmentQuestionWithOptions[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isFinal = !moduleId

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!isFinal && moduleId) {
        const [mod, assess] = await Promise.all([
          fetchModule(moduleId),
          fetchModuleAssessment(moduleId)
        ])
        setModule(mod)
        setAssessment(assess)
        if (assess) {
          const qs = await fetchAssessmentQuestions(assess.id)
          setQuestions(qs)
        }
      } else if (courseId) {
        const assess = await fetchFinalAssessment(courseId)
        setAssessment(assess)
        if (assess) {
          const qs = await fetchAssessmentQuestions(assess.id)
          setQuestions(qs)
        }
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [courseId, moduleId, isFinal])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // --- Handlers for Assessment Settings ---
  async function handleCreateAssessment() {
     if (!user || !courseId) return
     setIsLoading(true)
     try {
        const initialData = {
           title: isFinal ? 'Avaliação Final' : `Quiz: ${module?.title || 'Novo Módulo'}`,
           description: '',
           is_required: true,
           passing_score: 70,
           max_attempts: 3,
           is_active: true
        }
        if (!isFinal && moduleId) {
           await createModuleAssessment(courseId, moduleId, initialData, user.id)
        } else {
           await createFinalAssessment(courseId, initialData, user.id)
        }
        await loadData()
        await refreshTree()
     } catch (err) {
        setError(toErrorMessage(err))
     } finally {
        setIsLoading(false)
     }
  }

  async function handleUpdateAssessment(updates: Partial<Assessment>) {
     if (!assessment) return
     try {
        await updateAssessment(assessment.id, {
           title: updates.title ?? assessment.title,
           description: updates.description ?? assessment.description ?? '',
           is_required: updates.is_required ?? assessment.is_required,
           passing_score: updates.passing_score ?? assessment.passing_score,
           max_attempts: updates.max_attempts ?? assessment.max_attempts,
           is_active: updates.is_active ?? assessment.is_active
        })
        setAssessment(prev => prev ? ({ ...prev, ...updates }) : null)
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  // --- Handlers for Questions ---
  async function handleAddQuestion() {
     if (!assessment) return
     try {
        await createAssessmentQuestion(assessment.id, {
           question_text: 'Nova Pergunta...',
           is_required: true,
           points: 1
        })
        await loadData()
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  async function handleUpdateQuestion(questionId: string, text: string) {
     try {
        await updateAssessmentQuestion(questionId, { question_text: text, is_required: true, points: 1 })
        setQuestions(prev => prev.map(q => q.id === questionId ? ({ ...q, question_text: text }) : q))
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  async function handleDeleteQuestion(questionId: string) {
     if (!window.confirm("Excluir esta pergunta e todas as suas opções?")) return
     try {
        await deleteAssessmentQuestion(questionId)
        setQuestions(prev => prev.filter(q => q.id !== questionId))
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  // --- Handlers for Options ---
  async function handleAddOption(questionId: string) {
     try {
        await createAssessmentOption({
           question_id: questionId,
           option_text: 'Nova opção...',
           is_correct: false
        })
        await loadData()
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  async function handleUpdateOption(optionId: string, text: string, isCorrect: boolean) {
     try {
        await updateAssessmentOption(optionId, { option_text: text, is_correct: isCorrect })
        // If we set one as correct, others for this question should be incorrect in the local state for UX
        setQuestions(prev => prev.map(q => {
           const hasOption = q.options.some(o => o.id === optionId)
           if (hasOption) {
              return {
                 ...q,
                 options: q.options.map(o => {
                    if (o.id === optionId) return { ...o, option_text: text, is_correct: isCorrect }
                    if (isCorrect) return { ...o, is_correct: false }
                    return o
                 })
              }
           }
           return q
        }))
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  async function handleDeleteOption(optionId: string) {
     try {
        await deleteAssessmentOption(optionId)
        setQuestions(prev => prev.map(q => ({
           ...q,
           options: q.options.filter(o => o.id !== optionId)
        })))
     } catch (err) {
        setError(toErrorMessage(err))
     }
  }

  if (isLoading && !assessment) {
     return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  if (!assessment) {
     return (
        <div className="max-w-2xl mx-auto py-20 text-center space-y-6 animate-in fade-in zoom-in duration-500">
           <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-blue-200">
              <svg className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800">Nenhum Quiz Encontrado</h2>
              <p className="text-slate-500">Este módulo ainda não possui uma avaliação configurada.</p>
           </div>
           <Button onClick={handleCreateAssessment} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-lg ring-4 ring-blue-50">
              Criar Quiz Agora
           </Button>
        </div>
     )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* HEADER & QUICK SETTINGS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
         <div className="flex-1 space-y-1">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">Assessment Builder</span>
            <input 
               className="w-full text-3xl font-black text-slate-900 border-none bg-transparent p-0 focus:ring-0 placeholder:text-slate-300"
               value={assessment.title}
               onChange={e => handleUpdateAssessment({ title: e.target.value })}
               placeholder="Título do Quiz..."
            />
            <input 
               className="w-full text-sm font-medium text-slate-500 border-none bg-transparent p-0 focus:ring-0 placeholder:text-slate-400"
               value={assessment.description ?? ''}
               onChange={e => handleUpdateAssessment({ description: e.target.value })}
               placeholder="Breve descrição ou instruções para o aluno..."
            />
         </div>
         <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="px-3 border-r border-slate-200 text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Média p/ Aprovação</p>
               <input 
                  type="number" 
                  className="w-12 text-center font-black text-blue-600 bg-transparent border-none p-0 focus:ring-0" 
                  value={assessment.passing_score}
                  onChange={e => handleUpdateAssessment({ passing_score: Number(e.target.value) })}
               />
               <span className="text-xs font-bold text-blue-600">%</span>
            </div>
            <div className="px-3 text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Tentativas</p>
               <input 
                  type="number" 
                  className="w-12 text-center font-black text-blue-600 bg-transparent border-none p-0 focus:ring-0" 
                  value={assessment.max_attempts}
                  onChange={e => handleUpdateAssessment({ max_attempts: Number(e.target.value) })}
               />
            </div>
         </div>
      </div>

      {error && (
         <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
         </div>
      )}

      {/* QUESTIONS LIST */}
      <div className="space-y-6">
         {questions.map((q, idx) => (
            <div key={q.id} className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
               {/* Question Header */}
               <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex items-start gap-4">
                  <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center font-black text-slate-400 text-lg">
                     {idx + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                     <textarea 
                        className="w-full font-bold text-slate-800 border-none bg-transparent p-0 focus:ring-0 resize-none placeholder:text-slate-300"
                        value={q.question_text}
                        onChange={e => handleUpdateQuestion(q.id, e.target.value)}
                        placeholder="Escreva sua pergunta aqui..."
                        rows={2}
                     />
                  </div>
                  <button 
                     onClick={() => handleDeleteQuestion(q.id)}
                     className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                     <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h5" /></svg>
                  </button>
               </div>

               {/* Options Section */}
               <div className="p-6 space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Alternativas de Resposta</p>
                  <div className="grid gap-3">
                     {q.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-3 group/opt">
                           <button 
                              onClick={() => handleUpdateOption(opt.id, opt.option_text, !opt.is_correct)}
                              className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${opt.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 hover:border-emerald-300'}`}
                           >
                              {opt.is_correct && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                           </button>
                           <input 
                              className={`flex-1 text-sm border-none bg-slate-50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-100 transition-all ${opt.is_correct ? 'font-bold text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}
                              value={opt.option_text}
                              onChange={e => handleUpdateOption(opt.id, e.target.value, opt.is_correct)}
                              placeholder="Descreva a alternativa..."
                           />
                           <button 
                              onClick={() => handleDeleteOption(opt.id)}
                              className="opacity-0 group-hover/opt:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all"
                           >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                           </button>
                        </div>
                     ))}
                  </div>

                  <button 
                     onClick={() => handleAddOption(q.id)}
                     className="w-full py-3 mt-2 rounded-xl border-2 border-dashed border-slate-100 text-xs font-bold text-slate-400 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     Adicionar Alternativa
                  </button>
               </div>
            </div>
         ))}

         {/* Add Question Button */}
         <button 
            onClick={handleAddQuestion}
            className="w-full py-12 rounded-3xl border-4 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-blue-100 hover:bg-blue-50/30 hover:text-blue-600 transition-all"
         >
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border-2 border-slate-100">
               <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <div className="text-center">
               <p className="text-lg font-black uppercase tracking-widest">Nova Pergunta</p>
               <p className="text-xs font-medium">Clique para adicionar uma nova questão ao quiz.</p>
            </div>
         </button>
      </div>

    </div>
  )
}
