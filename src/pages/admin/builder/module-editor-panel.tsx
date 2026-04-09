import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-provider'
import {
  analyzeModuleWithAi,
  createModuleAiReviewHistory,
  fetchModuleAiReviewHistory,
  formatAiReviewCost,
  formatAiReviewTokens,
  getAiProviderLabel,
  markModuleAiReviewApplied,
  type ModuleAiReviewHistoryEntry,
  type ModuleAiReviewResult,
} from '@/features/admin/ai-review/api'
import {
  createModule,
  deleteModule,
  deleteModulePdf,
  importCourseContent,
  toErrorMessage,
  updateModule,
  uploadModulePdf,
} from '@/features/admin/content/api'
import { moduleFormSchema, type ModuleFormInput } from '@/features/admin/content/schemas'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { publishBuilderNotice } from '@/lib/builder-notice'
import { Button } from '@/components/ui/button'

const initialForm: ModuleFormInput = {
  title: '',
  description: '',
  is_required: true,
  starts_at: '',
  ends_at: '',
  release_days_after_enrollment: '',
}

function AiReviewUsageSummary({ review }: {
  review: Pick<ModuleAiReviewResult, 'ai_provider' | 'ai_model' | 'token_count_method' | 'input_tokens' | 'output_tokens' | 'total_tokens' | 'estimated_cost_usd'>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provedor</p>
        <p className="mt-2 text-sm font-bold text-slate-900">{getAiProviderLabel(review.ai_provider)}</p>
        <p className="mt-1 text-xs text-slate-500">{review.ai_model ?? 'Modelo indisponivel'}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entrada</p>
        <p className="mt-2 text-sm font-bold text-slate-900">{formatAiReviewTokens(review.input_tokens)}</p>
        <p className="mt-1 text-xs text-slate-500">tokens de prompt</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saida</p>
        <p className="mt-2 text-sm font-bold text-slate-900">{formatAiReviewTokens(review.output_tokens)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {review.token_count_method === 'actual' ? 'tokens reais' : 'tokens estimados'}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo</p>
        <p className="mt-2 text-sm font-bold text-slate-900">{formatAiReviewCost(review.estimated_cost_usd)}</p>
        <p className="mt-1 text-xs text-slate-500">Total: {formatAiReviewTokens(review.total_tokens)}</p>
      </div>
    </div>
  )
}

export function ModuleEditorPanel() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId?: string }>()
  const navigate = useNavigate()
  const { courseTree, refreshTree } = useCourseBuilder()
  const { user } = useAuth()

  const isNew = moduleId === 'novo'

  // Local State
  const [form, setForm] = useState<ModuleFormInput>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewHistory, setReviewHistory] = useState<ModuleAiReviewHistoryEntry[]>([])
  const [isLoadingReviewHistory, setIsLoadingReviewHistory] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisTarget, setAnalysisTarget] = useState<{ moduleId: string; moduleTitle: string } | null>(null)
  const [analysisResult, setAnalysisResult] = useState<ModuleAiReviewResult | null>(null)
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null)
  const [isApplyingFixes, setIsApplyingFixes] = useState(false)
  const [didApplyCurrentAnalysis, setDidApplyCurrentAnalysis] = useState(false)
  const [repeatReviewPrompt, setRepeatReviewPrompt] = useState<ModuleAiReviewHistoryEntry | null>(null)
  const [isAppliedAdjustmentsModalOpen, setIsAppliedAdjustmentsModalOpen] = useState(false)

  useEffect(() => {
    if (isNew) {
      setForm(initialForm)
      return
    }

    if (courseTree && moduleId) {
      const module = courseTree.modules.find(m => m.id === moduleId)
      if (module) {
        setForm({
          title: module.title,
          description: module.description ?? '',
          is_required: module.is_required,
          starts_at: module.starts_at ? module.starts_at.slice(0, 16) : '',
          ends_at: module.ends_at ? module.ends_at.slice(0, 16) : '',
          release_days_after_enrollment: module.release_days_after_enrollment != null
            ? String(module.release_days_after_enrollment)
            : '',
        })
      }
    }
  }, [isNew, moduleId, courseTree])

  useEffect(() => {
    if (isNew || !moduleId) {
      setReviewHistory([])
      return
    }

    const targetModuleId = moduleId
    let isActive = true
    setIsLoadingReviewHistory(true)

    async function loadReviewHistory() {
      try {
        const history = await fetchModuleAiReviewHistory([targetModuleId])
        if (!isActive) return
        setReviewHistory(history)
      } catch (err) {
        if (!isActive) return
        setError(toErrorMessage(err))
      } finally {
        if (isActive) {
          setIsLoadingReviewHistory(false)
        }
      }
    }

    void loadReviewHistory()

    return () => {
      isActive = false
    }
  }, [isNew, moduleId])

  useEffect(() => {
    if (!analysisTarget || !analysisResult) return

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('keydown', handleEscapeKey, true)
    return () => window.removeEventListener('keydown', handleEscapeKey, true)
  }, [analysisTarget, analysisResult])

  const currentModule = !isNew && moduleId && courseTree
    ? courseTree.modules.find((module) => module.id === moduleId) ?? null
    : null

  const appliedReviews = reviewHistory.filter((review) => Boolean(review.applied_at))

  async function handleAnalyzeWithAi(forceNewReview = false) {
    if (!courseId || !moduleId || !currentModule) return

    const latestReview = reviewHistory[0] ?? null
    if (latestReview && !forceNewReview) {
      setRepeatReviewPrompt(latestReview)
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setDidApplyCurrentAnalysis(false)
    setRepeatReviewPrompt(null)
    setCurrentReviewId(null)

    try {
      const result = await analyzeModuleWithAi({
        courseId,
        moduleId,
      })

      if (user?.id) {
        try {
          const savedReview = await createModuleAiReviewHistory({
            courseId,
            moduleId,
            userId: user.id,
            result,
          })
          setCurrentReviewId(savedReview.id)
          setReviewHistory((previous) => [savedReview, ...previous])
        } catch (historyError) {
          setError(`A analise foi concluida, mas o historico nao foi salvo: ${toErrorMessage(historyError)}`)
        }
      }

      setAnalysisTarget({
        moduleId,
        moduleTitle: currentModule.title,
      })
      setAnalysisResult(result)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleApplyAiFixes() {
    if (!courseId || !moduleId || !currentModule || !analysisTarget || !analysisResult?.corrected_module || didApplyCurrentAnalysis) return

    setIsApplyingFixes(true)
    setError(null)
    publishBuilderNotice({
      type: 'pending',
      title: 'Aplicando ajustes da IA',
      message: `O modulo "${currentModule.title}" esta sendo atualizado agora.`,
      details: [
        `Modulo em processamento: ${currentModule.title}`,
        `Pontos identificados na analise: ${analysisResult.issues.length}`,
        'Aguarde a confirmacao final antes de sair da tela.',
      ],
    })

    try {
      const appliedAtIso = new Date().toISOString()

      await importCourseContent(courseId, [analysisResult.corrected_module], false, moduleId)
      await refreshTree()

      if (currentReviewId && user?.id) {
        try {
          const updatedReview = await markModuleAiReviewApplied(currentReviewId, user.id)
          if (updatedReview) {
            setReviewHistory((previous) => previous.map((review) => (
              review.id === updatedReview.id ? updatedReview : review
            )))
          }
        } catch (historyError) {
          setError(`Os ajustes foram aplicados, mas o historico nao foi atualizado: ${toErrorMessage(historyError)}`)
        }
      }

      setDidApplyCurrentAnalysis(true)
      publishBuilderNotice({
        type: 'success',
        title: 'Ajustes da IA concluidos',
        message: `Os ajustes foram aplicados ao modulo "${currentModule.title}".`,
        details: [
          `Modulo atualizado: ${currentModule.title}`,
          `Horario: ${new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'medium',
          }).format(new Date(appliedAtIso))}`,
          `Pontos processados: ${analysisResult.issues.length}`,
          analysisResult.ready_to_publish ? 'Status do modulo: pronto para publicar.' : 'Status do modulo: ainda requer revisao manual.',
        ],
      })
    } catch (err) {
      const message = toErrorMessage(err)
      setError(message)
      publishBuilderNotice({
        type: 'error',
        title: 'Falha ao aplicar ajustes da IA',
        message: `Nao foi possivel concluir os ajustes no modulo "${currentModule.title}".`,
        details: [
          `Modulo: ${currentModule.title}`,
          `Erro retornado: ${message}`,
          'Nenhuma confirmacao de salvamento foi recebida.',
        ],
      })
    } finally {
      setIsApplyingFixes(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!courseId) return

    const parsed = moduleFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (!isNew && moduleId) {
        await updateModule(moduleId, parsed.data)
      } else {
        const created = await createModule(courseId, parsed.data)
        await refreshTree()
        navigate(`/admin/cursos/${courseId}/builder/modulos/${created.id}`, { replace: true })
        return
      }
      await refreshTree()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!moduleId || isNew) return
    const confirmed = window.confirm('ATENÇÃO: Excluir este módulo? Todas as aulas serão removidas permanentemente.')
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteModule(moduleId)
      await refreshTree()
      navigate(`/admin/cursos/${courseId}/builder`)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleModulePdfUpload(file: File) {
    if (!moduleId) return

    try {
      await uploadModulePdf(moduleId, file)
      await refreshTree()
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  async function handleDeleteModulePdf() {
    if (!currentModule) return
    if (!window.confirm('Remover o PDF base deste modulo?')) return

    try {
      await deleteModulePdf(currentModule)
      await refreshTree()
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-6 animate-in fade-in duration-500">
       <div className="border-b border-slate-200 pb-5">
         <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
           {isNew ? 'Criar Novo Módulo' : 'Configurações do Módulo'}
         </h2>
         <p className="text-sm text-slate-500 mt-1">
           {isNew ? 'Adicione uma nova seção principal para agrupar as aulas do seu curso.' : 'Atualize os detalhes e restrições desta seção do curso.'}
         </p>
       </div>

       {!isNew && currentModule && (
         <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
           <Button
             type="button"
             variant="outline"
             onClick={() => void handleAnalyzeWithAi()}
             disabled={isAnalyzing || isSubmitting || isDeleting}
             className="h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
           >
             {isAnalyzing ? 'Analisando...' : 'Analisar com IA'}
           </Button>
           {appliedReviews.length > 0 && (
             <Button
               type="button"
               variant="outline"
               onClick={() => setIsAppliedAdjustmentsModalOpen(true)}
               disabled={isLoadingReviewHistory}
               className="h-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
             >
               Ver ajustes realizados
             </Button>
           )}
           {isLoadingReviewHistory ? (
             <span className="text-xs font-semibold text-slate-400">Carregando historico de revisoes...</span>
           ) : reviewHistory.length > 0 ? (
             <span className="text-xs font-semibold text-slate-500">
               Ultima revisao em{' '}
               {new Intl.DateTimeFormat('pt-BR', {
                 dateStyle: 'short',
                 timeStyle: 'medium',
               }).format(new Date(reviewHistory[0].created_at))}
             </span>
           ) : (
             <span className="text-xs font-semibold text-slate-400">Nenhuma revisao com IA registrada para este modulo.</span>
           )}
         </div>
       )}

       <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 md:p-8 space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-800">Capa / Título do Módulo <span className="text-rose-500">*</span></span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white placeholder:text-slate-400"
                placeholder="Ex: Fundamentos Básicos"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-800">Descrição Organizacional</span>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white resize-y placeholder:text-slate-400"
                placeholder="Detalhes para os alunos ou notas internas sobre este bloco."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>

            <label className="flex items-start gap-4 p-5 rounded-xl border border-blue-100 bg-blue-50/30 cursor-pointer hover:bg-blue-50/50 transition-colors">
              <div className="flex items-center h-6">
                <input
                  checked={form.is_required}
                  type="checkbox"
                  className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-600 shadow-sm"
                  onChange={(e) => setForm((prev) => ({ ...prev, is_required: e.target.checked }))}
                />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Exigir Conclusão deste Módulo</span>
                <span className="text-xs text-slate-500 mt-0.5 block">Se marcado, o aluno deverá concluir todas as aulas atreladas a este módulo para avançar no progresso total.</span>
              </div>
            </label>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Liberação Programada</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-700">Liberar em</span>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    value={form.starts_at ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-700">Expirar em</span>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    value={form.ends_at ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-1">
                    <span className="block text-sm font-bold text-slate-800">Liberar após X dias da inscrição no curso</span>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Use esta opção para liberar o módulo automaticamente após um período contado desde a inscrição do aluno.
                    </p>
                  </div>
                  <label className="block space-y-2 md:min-w-[220px]">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Quantidade de dias</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      value={form.release_days_after_enrollment ?? ''}
                      onChange={(event) => setForm((prev) => ({ ...prev, release_days_after_enrollment: event.target.value }))}
                      placeholder="Ex.: 7"
                    />
                  </label>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Se preencher uma data e também um número de dias, as duas regras serão cumulativas. O módulo só libera quando ambas forem atendidas.
              </p>
            </div>

            {!isNew ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">PDF Base do Modulo</p>
                    <h4 className="mt-2 text-lg font-black text-slate-900">
                      {currentModule?.module_pdf_file_name ?? 'Nenhum PDF enviado'}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      O aluno receberá uma cópia licenciada com marca d&apos;água e identificação individual.
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
                    Enviar PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void handleModulePdfUpload(file)
                        }
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>

                {currentModule?.module_pdf_storage_path ? (
                  <div className="mt-4 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => void handleDeleteModulePdf()}
                    >
                      Remover PDF
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
         </div>

         {error && (
           <div className="mx-6 md:mx-8 mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600 flex items-start gap-2">
             <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             {error}
           </div>
         )}
         
         <div className="bg-slate-50 border-t border-slate-100 p-6 flex items-center justify-between">
           {!isNew && (
             <Button
               type="button"
               variant="outline"
               onClick={handleDelete}
               disabled={isDeleting || isSubmitting}
               className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
             >
               {isDeleting ? 'Excluindo...' : 'Excluir Módulo'}
             </Button>
           )}
           <div className={`flex gap-3 ${isNew ? 'w-full justify-end' : ''}`}>
             <Button 
               type="submit" 
               disabled={isSubmitting} 
               className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] shadow-sm font-bold"
             >
               {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
             </Button>
           </div>
         </div>
        </form>
        {repeatReviewPrompt && currentModule && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-2xl rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="border-b border-slate-100 p-8">
                <h3 className="text-xl font-black tracking-tight text-slate-900">Este modulo ja possui analise com IA</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  O modulo <strong>{currentModule.title}</strong> ja possui uma analise salva. A ultima revisao foi em{' '}
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  }).format(new Date(repeatReviewPrompt.created_at))}
                  . Revise abaixo o resultado salvo ou inicie uma nova analise.
                </p>
              </div>
              <div className="space-y-4 p-8">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Resumo da ultima analise</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{repeatReviewPrompt.summary}</p>
                  <div className="mt-4">
                    <AiReviewUsageSummary review={repeatReviewPrompt} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                      Score {repeatReviewPrompt.quality_score}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {repeatReviewPrompt.issues.length} ajuste(s)
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      repeatReviewPrompt.applied_at
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {repeatReviewPrompt.applied_at ? 'Ajustes aplicados' : 'Ajustes nao aplicados'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-8 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-2xl px-8 font-black text-slate-600"
                  onClick={() => setRepeatReviewPrompt(null)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-blue-600 px-8 font-black shadow-xl shadow-blue-100 hover:bg-blue-700"
                  onClick={() => void handleAnalyzeWithAi(true)}
                >
                  Fazer nova analise
                </Button>
              </div>
            </div>
          </div>
        )}
        {analysisTarget && analysisResult && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-8">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">Analise com IA do Modulo</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">{analysisTarget.moduleTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAnalysisTarget(null)
                    setAnalysisResult(null)
                    setDidApplyCurrentAnalysis(false)
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6 p-8">
                {didApplyCurrentAnalysis && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-sm font-black text-emerald-700">Ajustes aplicados com sucesso neste modulo.</p>
                    <p className="mt-2 text-sm text-emerald-700">
                      O conteudo foi atualizado e salvo. Revise os campos e o conteudo pedagogico para confirmar o resultado final.
                    </p>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Score de Qualidade</p>
                    <p className="mt-3 text-5xl font-black tracking-tighter text-slate-900">{analysisResult.quality_score}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">de 100</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Resumo da IA</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{analysisResult.summary}</p>
                    <div className="mt-4 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-slate-50 text-slate-600">
                      {analysisResult.ready_to_publish ? 'Pronto para publicar' : 'Requer ajustes antes de publicar'}
                    </div>
                  </div>
                </div>
                <AiReviewUsageSummary review={analysisResult} />
                <div className="space-y-3">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Pontos a ajustar</h4>
                  {analysisResult.issues.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
                      Nenhum ajuste relevante foi apontado pela IA para este modulo.
                    </div>
                  ) : (
                    analysisResult.issues.map((issue) => (
                      <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {issue.category}
                          </span>
                          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                            {issue.severity}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{issue.location}</span>
                        </div>
                        <h5 className="mt-3 text-base font-black text-slate-900">{issue.title}</h5>
                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Como esta hoje</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{issue.current_state}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Como deve ficar</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{issue.suggested_result}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajuste recomendado</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{issue.recommended_fix}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-8 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-2xl px-8 font-black text-slate-600"
                  onClick={() => {
                    setAnalysisTarget(null)
                    setAnalysisResult(null)
                    setDidApplyCurrentAnalysis(false)
                  }}
                >
                  Fechar Analise
                </Button>
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-blue-600 px-8 font-black shadow-xl shadow-blue-100 hover:bg-blue-700"
                  disabled={!analysisResult.corrected_module || isApplyingFixes || didApplyCurrentAnalysis}
                  onClick={() => void handleApplyAiFixes()}
                >
                  {isApplyingFixes ? 'Aplicando Ajustes...' : didApplyCurrentAnalysis ? 'Ajustes Aplicados' : 'Implementar Ajustes'}
                </Button>
              </div>
            </div>
          </div>
        )}
        {isAppliedAdjustmentsModalOpen && (
          <div className="fixed inset-0 z-[112] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-8">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">Ajustes realizados com IA</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">{currentModule?.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAppliedAdjustmentsModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 p-8">
                {appliedReviews.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                    Nenhum ajuste aplicado com IA foi encontrado para este modulo.
                  </div>
                ) : (
                  appliedReviews.map((review, index) => (
                    <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                          Ajuste {index + 1}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                          Revisado em {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          }).format(new Date(review.created_at))}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          Aplicado em {review.applied_at ? new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          }).format(new Date(review.applied_at)) : 'pendente'}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-slate-700">{review.summary}</p>
                      <div className="mt-4">
                        <AiReviewUsageSummary review={review} />
                      </div>
                      <div className="mt-4 space-y-3">
                        {review.issues.length === 0 ? (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                            Nenhum ajuste foi apontado nesta revisao.
                          </div>
                        ) : (
                          review.issues.map((issue) => (
                            <div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                                  {issue.category}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  {issue.severity}
                                </span>
                                <span className="text-xs font-bold text-slate-400">{issue.location}</span>
                              </div>
                              <p className="mt-3 text-sm font-black text-slate-900">{issue.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">{issue.recommended_fix}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 p-8">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-2xl px-8 font-black text-slate-600"
                  onClick={() => setIsAppliedAdjustmentsModalOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
     </div>
  )
}
