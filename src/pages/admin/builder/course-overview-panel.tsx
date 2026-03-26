import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { analyzeModuleWithAi, type ModuleAiReviewResult } from '@/features/admin/ai-review/api'
import { importCourseContent, toErrorMessage } from '@/features/admin/content/api'
import { Button } from '@/components/ui/button'

export function CourseOverviewPanel() {
  const { courseTree, refreshTree } = useCourseBuilder()
  const [isAnalyzingModuleId, setIsAnalyzingModuleId] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisTarget, setAnalysisTarget] = useState<{ moduleId: string; moduleTitle: string } | null>(null)
  const [analysisResult, setAnalysisResult] = useState<ModuleAiReviewResult | null>(null)
  const [isApplyingFixes, setIsApplyingFixes] = useState(false)

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

  if (!courseTree) return null
  const { course, modules } = courseTree

  const totalLessons = modules.reduce((acc, module) => acc + module.lessons.length, 0)
  const totalDuration = modules.reduce((acc, module) => {
    const lessonsDuration = module.lessons.reduce((lessonAcc, lesson) => lessonAcc + lesson.estimated_minutes, 0)
    const assessmentsDuration = module.assessments.reduce((assessmentAcc, assessment) => assessmentAcc + assessment.estimated_minutes, 0)
    return acc + lessonsDuration + assessmentsDuration
  }, 0) + courseTree.courseAssessments.reduce((assessmentAcc, assessment) => assessmentAcc + assessment.estimated_minutes, 0)

  async function handleAnalyzeModule(moduleId: string, moduleTitle: string) {
    setIsAnalyzingModuleId(moduleId)
    setAnalysisError(null)

    try {
      const result = await analyzeModuleWithAi({
        courseId: course.id,
        moduleId,
      })
      setAnalysisTarget({ moduleId, moduleTitle })
      setAnalysisResult(result)
    } catch (err) {
      setAnalysisError(toErrorMessage(err))
    } finally {
      setIsAnalyzingModuleId(null)
    }
  }

  async function handleApplyAiFixes() {
    if (!analysisTarget || !analysisResult?.corrected_module) return

    setIsApplyingFixes(true)
    setAnalysisError(null)

    try {
      await importCourseContent(course.id, [analysisResult.corrected_module], false, analysisTarget.moduleId)
      await refreshTree()
      setAnalysisResult(null)
      setAnalysisTarget(null)
    } catch (err) {
      setAnalysisError(toErrorMessage(err))
    } finally {
      setIsApplyingFixes(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Visao Geral do Curso</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Este e o centro de controle do seu curso. Utilize o painel lateral para navegar, editar e construir a estrutura pedagogica.
        </p>
      </div>

      {analysisError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600">
          {analysisError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z" /></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{modules.length}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Modulos</span>
        </div>

        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{totalLessons}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Aulas</span>
        </div>

        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
          <Link to={`/admin/cursos/${course.id}/builder/modulos/novo`} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Adicionar Modulo
          </Link>
        </div>

        <div className="space-y-6 p-6">
          {modules.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-slate-500">Nenhum modulo criado ainda. Comece estruturando o curso.</p>
            </div>
          ) : (
            modules.map((module, moduleIndex) => (
              <div key={module.id} className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      <span>Modulo {moduleIndex + 1}</span>
                      {module.is_required && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Obrigatorio</span>}
                    </div>
                    <h4 className="text-base font-bold text-slate-900">{module.title}</h4>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => void handleAnalyzeModule(module.id, module.title)}
                      disabled={isAnalyzingModuleId === module.id}
                    >
                      {isAnalyzingModuleId === module.id ? 'Analisando...' : 'Analisar com IA'}
                    </Button>
                    <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                      Editar Modulo
                    </Link>
                  </div>
                </div>

                {module.lessons.length > 0 || module.assessments.length > 0 ? (
                  <div className="mt-4 space-y-2 border-l-2 border-slate-100 pl-4">
                    {module.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {lesson.title}
                        </span>
                        <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/aulas/${lesson.id}`} className="text-xs font-semibold text-slate-500 hover:text-blue-600">
                          Editar
                        </Link>
                      </div>
                    ))}

                    {module.assessments.map((assessment) => (
                      <div key={assessment.id} className="flex items-center justify-between gap-4 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-amber-900">
                          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          {assessment.title}
                        </span>
                        <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/avaliacoes/${assessment.id}`} className="text-xs font-semibold text-amber-700 hover:text-amber-900">
                          Editar Quiz
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 border-l-2 border-slate-100 pl-4">
                    <p className="text-sm italic text-slate-400">Nenhuma aula ou quiz neste modulo.</p>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Link to={`/admin/cursos/${course.id}/builder/modulos/${module.id}/aulas/nova`} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Adicionar Aula
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
                onClick={() => {
                  setAnalysisTarget(null)
                  setAnalysisResult(null)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 p-8">
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
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                          issue.severity === 'critical'
                            ? 'bg-rose-100 text-rose-700'
                            : issue.severity === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : issue.severity === 'medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                        }`}>
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
                className="h-12 rounded-2xl bg-blue-600 px-8 font-black shadow-xl shadow-blue-100 hover:bg-blue-700"
                disabled={!analysisResult.corrected_module || isApplyingFixes}
                onClick={() => void handleApplyAiFixes()}
              >
                {isApplyingFixes ? 'Aplicando Ajustes...' : 'Implementar Ajustes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
