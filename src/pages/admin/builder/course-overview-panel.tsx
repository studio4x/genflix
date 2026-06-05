import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import { useAuth } from '@/app/providers/auth-provider';
import { analyzeModuleWithAi, createModuleAiReviewHistory, fetchModuleAiReviewHistory, formatAiReviewCost, formatAiReviewTokens, getAiProviderLabel, markModuleAiReviewApplied, type ModuleAiReviewHistoryEntry, type ModuleAiReviewResult, } from '@/features/admin/ai-review/api';
import { deleteLesson, deleteModule, importCourseContent, toErrorMessage, } from '@/features/admin/content/api';
import { FooterActionsPanel } from '@/features/admin/content/footer-actions-panel';
import { deleteAssessment } from '@/features/admin/assessments/api';
import { publishBuilderNotice } from '@/lib/builder-notice';
import { Button } from '@/components/ui/button';
function AiReviewUsageSummary({ review }: {
    review: Pick<ModuleAiReviewResult, 'ai_provider' | 'ai_model' | 'token_count_method' | 'input_tokens' | 'output_tokens' | 'total_tokens' | 'estimated_cost_usd'>;
}) {
    return (<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provedor</p>
        <p className="mt-2 text-sm font-bold text-slate-900">{getAiProviderLabel(review.ai_provider)}</p>
        <p className="mt-1 text-xs text-slate-500">{review.ai_model ?? "Modelo indisponível"}</p>
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
    </div>);
}
export function CourseOverviewPanel() {
    const { courseTree, refreshTree } = useCourseBuilder();
    const { user } = useAuth();
    const [isAnalyzingModuleId, setIsAnalyzingModuleId] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisTarget, setAnalysisTarget] = useState<{
        moduleId: string;
        moduleTitle: string;
    } | null>(null);
    const [analysisResult, setAnalysisResult] = useState<ModuleAiReviewResult | null>(null);
    const [isApplyingFixes, setIsApplyingFixes] = useState(false);
    const [didApplyCurrentAnalysis, setDidApplyCurrentAnalysis] = useState(false);
    const [applyFeedback, setApplyFeedback] = useState<{
        moduleId: string;
        moduleTitle: string;
        appliedAt: string;
        issuesCount: number;
    } | null>(null);
    const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
    const [reviewHistoryByModule, setReviewHistoryByModule] = useState<Record<string, ModuleAiReviewHistoryEntry[]>>({});
    const [historyTarget, setHistoryTarget] = useState<{
        moduleId: string;
        moduleTitle: string;
    } | null>(null);
    const [repeatReviewPrompt, setRepeatReviewPrompt] = useState<{
        moduleId: string;
        moduleTitle: string;
        latestReview: ModuleAiReviewHistoryEntry;
    } | null>(null);
    useEffect(() => {
        if (!analysisTarget || !analysisResult)
            return;
        function handleEscapeKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
            }
        }
        window.addEventListener('keydown', handleEscapeKey, true);
        return () => window.removeEventListener('keydown', handleEscapeKey, true);
    }, [analysisTarget, analysisResult]);
    const course = courseTree?.course ?? null;
    const modules = courseTree?.modules ?? [];
    useEffect(() => {
        let isActive = true;
        async function loadReviewHistory() {
            try {
                const moduleIds = (courseTree?.modules ?? []).map((module) => module.id);
                const reviews = await fetchModuleAiReviewHistory(moduleIds);
                if (!isActive)
                    return;
                const grouped = reviews.reduce<Record<string, ModuleAiReviewHistoryEntry[]>>((acc, review) => {
                    const current = acc[review.module_id] ?? [];
                    current.push(review);
                    acc[review.module_id] = current;
                    return acc;
                }, {});
                setReviewHistoryByModule(grouped);
            }
            catch (err) {
                if (!isActive)
                    return;
                setAnalysisError(toErrorMessage(err));
            }
        }
        void loadReviewHistory();
        return () => {
            isActive = false;
        };
    }, [courseTree]);
    const totalLessons = modules.reduce((acc, module) => acc + module.lessons.length, 0);
    const totalDuration = modules.reduce((acc, module) => {
        const lessonsDuration = module.lessons.reduce((lessonAcc, lesson) => lessonAcc + lesson.estimated_minutes, 0);
        const assessmentsDuration = module.assessments.reduce((assessmentAcc, assessment) => assessmentAcc + assessment.estimated_minutes, 0);
        return acc + lessonsDuration + assessmentsDuration;
    }, 0) + (courseTree?.courseAssessments ?? []).reduce((assessmentAcc, assessment) => assessmentAcc + assessment.estimated_minutes, 0);
    async function handleAnalyzeModule(moduleId: string, moduleTitle: string, forceNewReview = false) {
        if (!course)
            return;
        const latestReview = (reviewHistoryByModule[moduleId] ?? [])[0] ?? null;
        if (latestReview && !forceNewReview) {
            setRepeatReviewPrompt({
                moduleId,
                moduleTitle,
                latestReview,
            });
            return;
        }
        setIsAnalyzingModuleId(moduleId);
        setAnalysisError(null);
        setDidApplyCurrentAnalysis(false);
        setRepeatReviewPrompt(null);
        setCurrentReviewId(null);
        try {
            const result = await analyzeModuleWithAi({
                courseId: course.id,
                moduleId,
            });
            if (user?.id) {
                try {
                    const savedReview = await createModuleAiReviewHistory({
                        courseId: course.id,
                        moduleId,
                        userId: user.id,
                        result,
                    });
                    setCurrentReviewId(savedReview.id);
                    setReviewHistoryByModule((previous) => ({
                        ...previous,
                        [moduleId]: [savedReview, ...(previous[moduleId] ?? [])],
                    }));
                }
                catch (historyError) {
                    setAnalysisError(`A análise foi concluída, mas o histórico não foi salvo: ${toErrorMessage(historyError)}`);
                }
            }
            setAnalysisTarget({ moduleId, moduleTitle });
            setAnalysisResult(result);
        }
        catch (err) {
            setAnalysisError(toErrorMessage(err));
        }
        finally {
            setIsAnalyzingModuleId(null);
        }
    }
    async function handleApplyAiFixes() {
        if (!course || !analysisTarget || !analysisResult?.corrected_module || didApplyCurrentAnalysis)
            return;
        setIsApplyingFixes(true);
        setAnalysisError(null);
        publishBuilderNotice({
            type: 'pending',
            title: 'Aplicando ajustes da IA',
            message: `O módulo "${analysisTarget.moduleTitle}" est\u00e1 sendo atualizado agora.`,
            details: [
                `Módulo em processamento: ${analysisTarget.moduleTitle}`,
                `Pontos identificados na análise: ${analysisResult.issues.length}`,
                'Aguarde a confirma\u00e7\u00e3o final antes de sair da tela.',
            ],
        });
        try {
            await importCourseContent(course.id, [analysisResult.corrected_module], false, analysisTarget.moduleId);
            await refreshTree();
            if (currentReviewId && user?.id) {
                try {
                    const updatedReview = await markModuleAiReviewApplied(currentReviewId, user.id);
                    if (updatedReview) {
                        setReviewHistoryByModule((previous) => ({
                            ...previous,
                            [updatedReview.module_id]: (previous[updatedReview.module_id] ?? []).map((review) => review.id === updatedReview.id ? updatedReview : review),
                        }));
                    }
                }
                catch (historyError) {
                    setAnalysisError(`Os ajustes foram aplicados, mas o hist\u00f3rico n\u00e3o foi atualizado: ${toErrorMessage(historyError)}`);
                }
            }
            setDidApplyCurrentAnalysis(true);
            const appliedAtIso = new Date().toISOString();
            setApplyFeedback({
                moduleId: analysisTarget.moduleId,
                moduleTitle: analysisTarget.moduleTitle,
                appliedAt: appliedAtIso,
                issuesCount: analysisResult.issues.length,
            });
            publishBuilderNotice({
                type: 'success',
                title: 'Ajustes da IA conclu\u00eddos',
                message: `Os ajustes foram aplicados ao m\u00f3dulo "${analysisTarget.moduleTitle}".`,
                details: [
                    `M\u00f3dulo atualizado: ${analysisTarget.moduleTitle}`,
                    `Hor\u00e1rio: ${new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                    }).format(new Date(appliedAtIso))}`,
                    `Pontos processados: ${analysisResult.issues.length}`,
                    analysisResult.ready_to_publish ? 'Status do m\u00f3dulo: pronto para publicar.' : "Status do m\u00f3dulo: ainda requer revis\u00e3o manual.",
                ],
            });
        }
        catch (err) {
            const message = toErrorMessage(err);
            setAnalysisError(message);
            publishBuilderNotice({
                type: 'error',
                title: 'Falha ao aplicar ajustes da IA',
                message: `Não foi possível concluir os ajustes no módulo "${analysisTarget.moduleTitle}".`,
                details: [
                    `Módulo: ${analysisTarget.moduleTitle}`,
                    `Erro retornado: ${message}`,
                    'Nenhuma confirma\u00e7\u00e3o de salvamento foi recebida.',
                ],
            });
        }
        finally {
            setIsApplyingFixes(false);
        }
    }
    async function handleDeleteModule(moduleId: string, moduleTitle: string) {
        if (!window.confirm(`ATEN\u00c7\u00c3O: Excluir o m\u00f3dulo "${moduleTitle}"

Todas as aulas e quizzes vinculados serão removidos permanentemente.`)) {
            return;
        }
        try {
            await deleteModule(moduleId);
            await refreshTree();
        }
        catch (err) {
            setAnalysisError(toErrorMessage(err));
        }
    }
    async function handleDeleteLesson(lessonId: string, lessonTitle: string) {
        if (!window.confirm(`ATEN\u00c7\u00c3O: Excluir a aula "${lessonTitle}"

Todos os materiais vinculados serão removidos permanentemente.`)) {
            return;
        }
        try {
            await deleteLesson(lessonId);
            await refreshTree();
        }
        catch (err) {
            setAnalysisError(toErrorMessage(err));
        }
    }
    async function handleDeleteAssessment(assessmentId: string, assessmentTitle: string, isFinalAssessment = false) {
        const confirmMessage = isFinalAssessment
            ? `CUIDADO: Excluir a avaliação final "${assessmentTitle}"

Todas as quest\u00f5es, estudos de caso e tentativas vinculadas serão removidos permanentemente.` : `CUIDADO: Excluir o quiz "${assessmentTitle}"

Todas as quest\u00f5es, estudos de caso e tentativas vinculadas serão removidos permanentemente.`;
        if (!window.confirm(confirmMessage)) {
            return;
        }
        try {
            await deleteAssessment(assessmentId);
            await refreshTree();
        }
        catch (err) {
            setAnalysisError(toErrorMessage(err));
        }
    }
    if (!courseTree || !course)
        return null;
    return (<div className="w-full space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{'Vis\u00e3o Geral do Curso'}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          {'Este \u00e9 o centro de controle do seu curso. Utilize o painel lateral para navegar, editar e construir a estrutura pedag\u00f3gica.'}
        </p>
      </div>

      {analysisError && (<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600">
          {analysisError}
        </div>)}
      {applyFeedback && (<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Ajustes aplicados com sucesso no módulo <strong>{applyFeedback.moduleTitle}</strong> em{' '}
          {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium',
            }).format(new Date(applyFeedback.appliedAt))}
          . {applyFeedback.issuesCount > 0 ? `${applyFeedback.issuesCount} ponto(s) foram processados.` : "Nenhum ponto crítico foi apontado nesta análise."}
        </div>)}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z"/></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{modules.length}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Módulos</span>
        </div>

        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{totalLessons}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Aulas</span>
        </div>

        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{Math.round(totalDuration / 60)}h {totalDuration % 60}m</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Estimativa</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Mapa do Curso</h3>
            <p className="text-sm text-slate-500">A hierarquia atual de aprendizado.</p>
          </div>
          <Link to={`/admin/cursos/${course.id}/builder/modulos/novo`} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Adicionar Módulo
          </Link>
        </div>

        <div className="space-y-6 p-6">
          {modules.length === 0 ? (<div className="py-12 text-center">
              <p className="text-slate-500">Nenhum módulo criado ainda. Comece estruturando o curso.</p>
            </div>) : (modules.map((module, moduleIndex) => (<div key={module.id} className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      <span>Módulo {moduleIndex + 1}</span>
                      {module.is_required && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Obrigatório</span>}
                    </div>
                    <h4 className="text-base font-bold text-slate-900">{module.title}</h4>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {reviewHistoryByModule[module.id]?.length ? (<Button type="button" variant="outline" size="sm" className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900" onClick={() => setHistoryTarget({ moduleId: module.id, moduleTitle: module.title })}>Últimas revisões
                      </Button>) : null}
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => void handleAnalyzeModule(module.id, module.title)} disabled={isAnalyzingModuleId === module.id}>
                      {isAnalyzingModuleId === module.id ? 'Analisando...' : 'Analisar com IA'}
                    </Button>
                    <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Editar Módulo
                    </Link>
                    <button type="button" onClick={() => void handleDeleteModule(module.id, module.title)} className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500" title="Excluir módulo">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {module.lessons.length > 0 || module.assessments.length > 0 ? (<div className="mt-4 space-y-2 border-l-2 border-slate-100 pl-4">
                    {module.lessons.map((lesson) => (<div key={lesson.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          {lesson.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/aulas/${lesson.id}`} className="text-xs font-semibold text-slate-500 hover:text-blue-600">
                            Editar
                          </Link>
                          <button type="button" onClick={() => void handleDeleteLesson(lesson.id, lesson.title)} className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500" title="Excluir aula">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </div>))}

                    {module.assessments.map((assessment) => (<div key={assessment.id} className="flex items-center justify-between gap-4 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-amber-900">
                          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          {assessment.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/avaliacoes/${assessment.id}`} className="text-xs font-semibold text-amber-700 hover:text-amber-900">
                            Editar Quiz
                          </Link>
                          <button type="button" onClick={() => void handleDeleteAssessment(assessment.id, assessment.title)} className="rounded-lg p-1.5 text-amber-300 transition-colors hover:bg-rose-50 hover:text-rose-500" title="Excluir quiz">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </div>))}
                  </div>) : (<div className="mt-4 border-l-2 border-slate-100 pl-4">
                    <p className="text-sm italic text-slate-400">Nenhuma aula ou quiz neste módulo.</p>
                  </div>)}

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/aulas/nova`} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Adicionar Aula
                    </Link>
                    <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/avaliacoes/nova`} className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Adicionar Quiz
                    </Link>
                  </div>
                </div>
              </div>)))}
        </div>
      </div>

      <FooterActionsPanel
        scope="course"
        courseId={course.id}
        title="Botões globais do curso"
        description="Configure arquivos e links disponíveis em todas as aulas deste curso."
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{'Avalia\u00e7\u00e3o Final'}</h3>
            <p className="text-sm text-slate-500">Gerencie a prova final e sua exclusão.</p>
          </div>
          <Link to={`/admin/cursos/${course.id}/builder/assessments/final`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">{'Editar Avalia\u00e7\u00e3o'}
          </Link>
        </div>
        <div className="p-6">
          {courseTree.courseAssessments.length > 0 ? (<div className="space-y-3">
              {courseTree.courseAssessments.map((assessment) => (<div key={assessment.id} className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-emerald-900">{assessment.title}</p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">{`Nota mínima ${assessment.passing_score}% · ${assessment.max_attempts} tentativa(s)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/admin/cursos/${course.id}/builder/assessments/final`} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                      Editar
                    </Link>
                    <button type="button" onClick={() => void handleDeleteAssessment(assessment.id, assessment.title, true)} className="rounded-lg p-2 text-emerald-300 transition-colors hover:bg-rose-50 hover:text-rose-500" title="Excluir avaliação final">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>))}
            </div>) : (<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Nenhuma avaliação final criada ainda.
            </div>)}
        </div>
      </div>

      {analysisTarget && analysisResult && (<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300" onMouseDown={(event) => event.stopPropagation()}>
          <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-8">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Análise com IA do Módulo</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{analysisTarget.moduleTitle}</p>
              </div>
              <button onClick={() => {
                setAnalysisTarget(null);
                setAnalysisResult(null);
            }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="space-y-6 p-8">
              {didApplyCurrentAnalysis && analysisTarget && (<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-black text-emerald-700">Ajustes aplicados com sucesso neste módulo.</p>
                  <p className="mt-2 text-sm text-emerald-700">O conteúdo foi atualizado e salvo. Revise o módulo para confirmar o resultado final.
                  </p>
                  <Link to={`/admin/cursos/${course.id}/builder/modulos/${analysisTarget.moduleId}`} className="mt-4 inline-flex items-center rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100">Revisar módulo atualizado
                  </Link>
                </div>)}

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
              <AiReviewUsageSummary review={analysisResult}/>

              <div className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Pontos a ajustar</h4>
                {analysisResult.issues.length === 0 ? (<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">Nenhum ajuste relevante foi apontado pela IA para este módulo.
                  </div>) : (analysisResult.issues.map((issue) => (<div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${issue.severity === 'critical'
                    ? 'bg-rose-100 text-rose-700'
                    : issue.severity === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : issue.severity === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'}`}>
                          {issue.severity}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {issue.category}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{issue.location}</span>
                      </div>
                      <h5 className="mt-3 text-base font-black text-slate-900">{issue.title}</h5>
                      <div className="mt-4 grid gap-4 lg:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Como est? hoje</p>
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
                    </div>)))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-8 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="h-12 rounded-2xl px-8 font-black text-slate-600" onClick={() => {
                setAnalysisTarget(null);
                setAnalysisResult(null);
                setDidApplyCurrentAnalysis(false);
            }}>Fechar Análise
              </Button>
              <Button className="h-12 rounded-2xl bg-blue-600 px-8 font-black shadow-xl shadow-blue-100 hover:bg-blue-700" disabled={!analysisResult.corrected_module || isApplyingFixes || didApplyCurrentAnalysis} onClick={() => void handleApplyAiFixes()}>
                {isApplyingFixes ? 'Aplicando Ajustes...' : didApplyCurrentAnalysis ? 'Ajustes Aplicados' : 'Implementar Ajustes'}
              </Button>
            </div>
          </div>
        </div>)}
      {repeatReviewPrompt && (<div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="border-b border-slate-100 p-8">
              <h3 className="text-xl font-black tracking-tight text-slate-900">{'Este m\u00f3dulo j\u00e1 possui an\u00e1lise com IA'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{'O módulo '}<strong>{repeatReviewPrompt.moduleTitle}</strong>{' já possui uma análise salva. Última revisão em '}
                {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium',
            }).format(new Date(repeatReviewPrompt.latestReview.created_at))}. Revise abaixo o resultado salvo ou inicie uma nova análise.
              </p>
            </div>
            <div className="space-y-4 p-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Resumo da última análise</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{repeatReviewPrompt.latestReview.summary}</p>
                <div className="mt-4">
                  <AiReviewUsageSummary review={repeatReviewPrompt.latestReview}/>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    Score {repeatReviewPrompt.latestReview.quality_score}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {repeatReviewPrompt.latestReview.issues.length} ajuste(s)
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${repeatReviewPrompt.latestReview.applied_at
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'}`}>
                    {repeatReviewPrompt.latestReview.applied_at ? 'Ajustes aplicados' : "Ajustes não aplicados"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-8 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="h-12 rounded-2xl px-8 font-black text-slate-600" onClick={() => setRepeatReviewPrompt(null)}>
                Fechar
              </Button>
              <Button type="button" variant="outline" className="h-12 rounded-2xl border-slate-200 px-8 font-black text-slate-700" onClick={() => {
                setHistoryTarget({
                    moduleId: repeatReviewPrompt.moduleId,
                    moduleTitle: repeatReviewPrompt.moduleTitle,
                });
            }}>Ver revisões
              </Button>
              <Button type="button" className="h-12 rounded-2xl bg-blue-600 px-8 font-black shadow-xl shadow-blue-100 hover:bg-blue-700" onClick={() => void handleAnalyzeModule(repeatReviewPrompt.moduleId, repeatReviewPrompt.moduleTitle, true)}>Fazer nova análise
              </Button>
            </div>
          </div>
        </div>)}
      {historyTarget && (<div className="fixed inset-0 z-[112] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-8">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Histórico de revisões com IA</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{historyTarget.moduleTitle}</p>
              </div>
              <button type="button" onClick={() => setHistoryTarget(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="space-y-4 p-8">
              {(reviewHistoryByModule[historyTarget.moduleId] ?? []).length === 0 ? (<div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">Nenhuma revisão anterior foi encontrada para este módulo.
                </div>) : ((reviewHistoryByModule[historyTarget.moduleId] ?? []).map((review, reviewIndex) => (<div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Revisão {reviewIndex + 1}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                }).format(new Date(review.created_at))}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${review.ready_to_publish ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {review.ready_to_publish ? 'Pronto para publicar' : 'Requer ajustes'}
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                        Score {review.quality_score}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${review.applied_at ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {review.applied_at
                    ? `Ajustes aplicados em ${new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                    }).format(new Date(review.applied_at))}`
                    : "Ajustes não aplicados"}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-700">{review.summary}</p>
                    <div className="mt-4">
                      <AiReviewUsageSummary review={review}/>
                    </div>
                    <div className="mt-4 space-y-3">
                      {review.issues.length === 0 ? (<div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Nenhum ajuste foi apontado nesta revisão.
                        </div>) : (review.issues.map((issue) => (<div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                          </div>)))}
                    </div>
                  </div>)))}
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 p-8">
              <Button type="button" variant="ghost" className="h-12 rounded-2xl px-8 font-black text-slate-600" onClick={() => setHistoryTarget(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>)}
    </div>);
}
