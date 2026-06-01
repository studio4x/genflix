import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createFinalAssessment,
  createModuleAssessment,
  deleteAssessment,
  exportFinalAssessmentContent,
  fetchFinalAssessment,
  importAssessmentContent,
  toErrorMessage,
} from '@/features/admin/assessments/api'
import { downloadJsonFile } from '@/lib/download'

export function CourseAssessmentsPanel() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courseTree, refreshTree } = useCourseBuilder()
  const { user } = useAuth()

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [isExportingFinal, setIsExportingFinal] = useState(false)
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null)

  if (!courseTree) return null
  const tree = courseTree

  async function handleImportJson() {
    if (!user?.id || !courseId) return

    setIsImporting(true)
    setImportError(null)

    try {
      let cleanedJson = importJson.trim()
      const match = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match?.[1]) {
        cleanedJson = match[1].trim()
      } else {
        cleanedJson = cleanedJson.replace(/^```(json)?\s+/, '').replace(/\s+```$/, '').trim()
      }

      let data
      try {
        data = JSON.parse(cleanedJson)
      } catch {
        const fixedJson = cleanedJson.replace(/\n(?!\s*(?:\{|\}|\[|\]|"|,|:|[0-9]|-|\.|t|f|n))/g, '\\n')
        data = JSON.parse(fixedJson)
      }

      let assessmentId: string | null = null

      if (targetModuleId) {
        const moduleItem = tree.modules.find((module) => module.id === targetModuleId)
        const newAssessment = await createModuleAssessment(courseId, targetModuleId, {
          title: data.title || `Quiz: ${moduleItem?.title || 'Módulo'}`,
          description: data.description || '',
          is_active: true,
          is_required: true,
          max_attempts: data.max_attempts || 3,
          passing_score: data.passing_score || 70,
          estimated_minutes: data.estimated_minutes || 10,
        }, user.id)
        assessmentId = newAssessment.id
      } else {
        const existing = await fetchFinalAssessment(courseId)
        if (existing) {
          assessmentId = existing.id
        } else {
          const newAssessment = await createFinalAssessment(courseId, {
            title: data.title || 'Avaliação Final',
            description: data.description || '',
            is_active: true,
            is_required: true,
            max_attempts: data.max_attempts || 3,
            passing_score: data.passing_score || 70,
            estimated_minutes: data.estimated_minutes || 10,
          }, user.id)
          assessmentId = newAssessment.id
        }
      }

      if (!assessmentId) {
        throw new Error('Falha ao identificar avaliação de destino.')
      }

      await importAssessmentContent(assessmentId, data)
      await refreshTree()
      setIsImportModalOpen(false)
      setImportJson('')
      setTargetModuleId(null)
    } catch (error) {
      console.error('Erro no import:', error)
      setImportError(toErrorMessage(error))
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDeleteAssessment(assessmentId: string) {
    if (!window.confirm('CUIDADO: Tem certeza que deseja excluir permanentemente esta avaliação? Esta ação removerá todas as questões vinculadas e não pode ser desfeita.')) {
      return
    }

    setIsImporting(true)
    try {
      await deleteAssessment(assessmentId)
      await refreshTree()
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Falha ao excluir avaliação. Verifique as dependências.')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleExportFinalAssessment() {
    if (!courseId) return

    setIsExportingFinal(true)
    try {
      const exportData = await exportFinalAssessmentContent(courseId)
      const courseTitle = tree.course.title || 'curso'
      downloadJsonFile(`avaliacao_final_${courseTitle}`, exportData)
    } catch (error) {
      setImportError(toErrorMessage(error))
    } finally {
      setIsExportingFinal(false)
    }
  }

  return (
    <>
      <div className="w-full animate-in space-y-6 pb-20 fade-in duration-500">
        <div className="border-b border-slate-200 pb-5">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Gestão de Avaliações</h2>
          <p className="mt-1 text-sm text-slate-500">Veja todos os quizzes e avaliações finais do curso em um só lugar.</p>
        </div>

        <div className="grid gap-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Avaliação Final do Curso</h3>
                  <p className="text-xs text-slate-500">Exibida ao fim de todos os módulos para certificação.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleExportFinalAssessment()}
                  className="font-bold text-slate-600 hover:bg-slate-100"
                  disabled={isExportingFinal}
                >
                  <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {isExportingFinal ? 'Exportando...' : 'Exportar JSON'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTargetModuleId(null)
                    setIsImportModalOpen(true)
                  }}
                  className="font-bold text-blue-600 hover:bg-blue-50"
                >
                  <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Importar IA
                </Button>

                <Button size="sm" variant="outline" className="bg-white" asChild>
                  <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>
                    Configurar Final
                  </Link>
                </Button>
              </div>
            </div>

            <div className="p-6">
              {courseTree.courseAssessments.length > 0 ? (
                courseTree.courseAssessments.map((assessment) => (
                  <div key={assessment.id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/20 p-4">
                    <div>
                      <p className="font-bold leading-tight text-emerald-900">{assessment.title}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase text-emerald-600">
                        Quiz de certificação • Nota mínima {assessment.passing_score}%
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="font-bold hover:bg-emerald-100" asChild>
                        <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>Editar</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteAssessment(assessment.id)}
                        className="h-8 w-8 p-0 font-bold text-slate-400 hover:text-red-500"
                        title="Excluir Avaliação Final"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 py-8 text-center">
                  <p className="text-sm text-slate-400">Nenhuma avaliação final configurada.</p>
                  <Button variant="link" size="sm" className="mt-2 font-bold" asChild>
                    <Link to={`/admin/cursos/${courseId}/builder/assessments/final`}>Criar Prova Final</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="border-b border-slate-100 pb-3 text-sm font-black uppercase tracking-widest text-slate-400">
              Quizzes por Módulo
            </h3>

            <div className="grid gap-4">
              {courseTree.modules.map((module, index) => (
                <div key={module.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 text-center text-xs font-black text-slate-300">M{index + 1}</div>
                    <div>
                      <p className="font-bold leading-tight text-slate-900">{module.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {module.assessments.length === 0 ? 'Sem quiz associado' : `${module.assessments.length} quiz(zes)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" className="font-bold text-blue-600 hover:bg-blue-50" asChild>
                      <Link to={`/admin/cursos/${courseId}/builder/m?dulos/${module.id}/avalia??es/nova`}>Adicionar Quiz</Link>
                    </Button>

                    {module.assessments.map((assessment) => (
                      <div key={assessment.id} className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="bg-white" asChild>
                          <Link to={`/admin/cursos/${courseId}/builder/m?dulos/${module.id}/avalia??es/${assessment.id}`}>Editar Quiz</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteAssessment(assessment.id)}
                          className="h-8 w-8 p-0 font-bold text-slate-400 hover:text-red-500"
                          title="Excluir Quiz do Módulo"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTargetModuleId(module.id)
                        setIsImportModalOpen(true)
                      }}
                      className="h-8 w-8 p-0 font-bold text-slate-400 hover:text-blue-600"
                      title="Importar de IA para este módulo"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="no-scrollbar max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 p-8">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Importar Avaliação (IA)</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {targetModuleId ? 'Importando para um novo quiz de módulo.' : 'Importando para a Avaliação Final.'}
                </p>
              </div>

              <button
                onClick={() => setIsImportModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 p-8">
              <div className="space-y-2">
                <span className="pl-1 text-xs font-black uppercase tracking-widest text-slate-400">Código JSON Estruturado</span>
                <textarea
                  className="no-scrollbar h-80 w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 font-mono text-xs text-emerald-400 transition-all focus:ring-4 focus:ring-blue-100"
                  placeholder='{ "title": "...", "passing_score": 75, "questions": [...] }'
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                />
              </div>

              {importError && (
                <div className="animate-in rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600 slide-in-from-left-2 transition-all">
                  {importError}
                </div>
              )}
            </div>

            <div className="flex gap-4 border-t border-slate-100 bg-slate-50/50 p-8">
              <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="h-14 flex-1 rounded-2xl font-bold text-slate-500">
                Cancelar
              </Button>
              <Button
                onClick={() => void handleImportJson()}
                disabled={isImporting || !importJson.trim()}
                className="h-14 flex-[2] rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100"
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importando...
                  </span>
                ) : 'Importar Agora'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
