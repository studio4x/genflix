import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { fetchCourses } from '@/features/admin/content/api'
import {
  fetchAssessmentAttemptRequests,
  fetchCompletionReport,
  reviewAssessmentAttemptRequest,
  type AssessmentAttemptRequestReportItem,
  type CompletionReport,
} from '@/features/admin/reports/api'
import type { Course } from '@/types/content'

type ReviewDecision = 'approved' | 'rejected'

export function AdminReportsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [reportData, setReportData] = useState<CompletionReport[]>([])
  const [attemptRequests, setAttemptRequests] = useState<AssessmentAttemptRequestReportItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReviewingRequestId, setIsReviewingRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')
  const [searchEmail, setSearchEmail] = useState('')
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [extraAttemptsByRequest, setExtraAttemptsByRequest] = useState<Record<string, string>>({})
  const [adminResponseByRequest, setAdminResponseByRequest] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true)
      setError(null)
      try {
        const [coursesData, report, requests] = await Promise.all([
          fetchCourses(),
          fetchCompletionReport({}),
          fetchAssessmentAttemptRequests(),
        ])

        setCourses(coursesData)
        setReportData(report)
        setAttemptRequests(requests)
      } catch {
        setError('Erro ao carregar relatorios.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadInitialData()
  }, [])

  const filteredData = useMemo(() => {
    return reportData.filter((item) => {
      const selectedCourseTitle = courses.find((course) => course.id === selectedCourseId)?.title
      const matchCourse = selectedCourseId === 'all' || item.course_title === selectedCourseTitle
      const matchEmail = item.student_email.toLowerCase().includes(searchEmail.toLowerCase())
      return matchCourse && matchEmail
    })
  }, [reportData, selectedCourseId, searchEmail, courses])

  const filteredRequests = useMemo(() => {
    return attemptRequests.filter((item) => {
      const selectedCourseTitle = courses.find((course) => course.id === selectedCourseId)?.title
      const matchCourse = selectedCourseId === 'all' || item.course_title === selectedCourseTitle
      const matchEmail = item.student_email.toLowerCase().includes(searchEmail.toLowerCase())
      const matchStatus = requestFilter === 'all' || item.status === requestFilter
      return matchCourse && matchEmail && matchStatus
    })
  }, [attemptRequests, courses, requestFilter, searchEmail, selectedCourseId])

  const pendingRequestsCount = useMemo(
    () => attemptRequests.filter((item) => item.status === 'pending').length,
    [attemptRequests],
  )

  const handleExportCSV = () => {
    const headers = ['Aluno', 'Email', 'Curso', 'Status', 'Concluido Em', 'Ultima Atividade']
    const rows = filteredData.map((item) => [
      item.student_name,
      item.student_email,
      item.course_title,
      item.is_completed ? 'Sim' : 'Nao',
      item.completed_at || '-',
      item.last_activity,
    ])

    const csvContent = [headers, ...rows].map((entry) => entry.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_aluno_${new Date().toISOString()}.csv`)
    link.click()
  }

  async function handleReviewRequest(
    request: AssessmentAttemptRequestReportItem,
    decision: ReviewDecision,
  ) {
    const extraAttemptsRaw = extraAttemptsByRequest[request.request_id] ?? '1'
    const extraAttempts = Math.max(1, Number.parseInt(extraAttemptsRaw, 10) || 1)
    const adminResponse = adminResponseByRequest[request.request_id] ?? ''

    setIsReviewingRequestId(request.request_id)
    setError(null)

    try {
      await reviewAssessmentAttemptRequest({
        requestId: request.request_id,
        decision,
        extraAttempts,
        adminResponse,
      })

      const refreshedRequests = await fetchAssessmentAttemptRequests()
      setAttemptRequests(refreshedRequests)
    } catch {
      setError('Falha ao analisar solicitacao de nova tentativa.')
    } finally {
      setIsReviewingRequestId(null)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando relatorios...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Relatorios</h2>
          <p className="text-sm text-slate-600">Acompanhe o progresso geral dos alunos e as solicitacoes de nova tentativa.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Filtrar por Curso</span>
          <select
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            value={selectedCourseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
          >
            <option value="all">Todos os Cursos</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Buscar por Email</span>
          <input
            type="text"
            placeholder="Digite o email do aluno..."
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            value={searchEmail}
            onChange={(event) => setSearchEmail(event.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Solicitacoes</span>
          <select
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            value={requestFilter}
            onChange={(event) => setRequestFilter(event.target.value as typeof requestFilter)}
          >
            <option value="pending">Pendentes</option>
            <option value="all">Todas</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Recusadas</option>
          </select>
        </label>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-bold uppercase text-blue-600">Pendentes Agora</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{pendingRequestsCount}</p>
          <p className="text-xs text-slate-500">Solicitacoes aguardando analise</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Solicitacoes de nova tentativa</h3>
          <p className="text-sm text-slate-600">Aprove ou recuse pedidos de reabertura de quiz quando o aluno esgotar as tentativas.</p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Aluno</th>
                  <th className="px-6 py-4">Avaliacao</th>
                  <th className="px-6 py-4">Tentativas</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Analise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((request) => {
                  const isPending = request.status === 'pending'
                  const isReviewing = isReviewingRequestId === request.request_id

                  return (
                    <tr key={request.request_id} className="align-top hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{request.student_name ?? request.student_email}</p>
                        <p className="text-xs text-slate-500">{request.student_email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{request.assessment_title}</p>
                        <p className="text-xs text-slate-500">{request.course_title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {request.assessment_type === 'module'
                            ? `Quiz do modulo ${request.module_title ?? '-'}`
                            : 'Avaliacao final'}
                        </p>
                        {request.requested_message ? (
                          <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{request.requested_message}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{request.attempts_used} / {request.effective_max_attempts}</p>
                        <p className="text-xs text-slate-500">Base: {request.base_max_attempts} | Extras: {request.total_extra_attempts}</p>
                        <p className="mt-1 text-xs text-slate-500">Ultima nota: {request.last_score ?? '-'}%</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          request.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : request.status === 'rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {request.status === 'approved'
                            ? 'Aprovada'
                            : request.status === 'rejected'
                              ? 'Recusada'
                              : 'Pendente'}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">
                          Solicitada em {new Date(request.requested_at).toLocaleString('pt-BR')}
                        </p>
                        {request.admin_response ? (
                          <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{request.admin_response}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        {isPending ? (
                          <div className="space-y-3">
                            <label className="block space-y-1">
                              <span className="text-xs font-bold uppercase text-slate-500">Tentativas extras</span>
                              <input
                                type="number"
                                min={1}
                                className="w-28 rounded-md border border-slate-200 px-3 py-2 text-sm"
                                value={extraAttemptsByRequest[request.request_id] ?? '1'}
                                onChange={(event) =>
                                  setExtraAttemptsByRequest((prev) => ({
                                    ...prev,
                                    [request.request_id]: event.target.value,
                                  }))
                                }
                              />
                            </label>

                            <label className="block space-y-1">
                              <span className="text-xs font-bold uppercase text-slate-500">Resposta ao aluno</span>
                              <textarea
                                className="min-h-24 w-full min-w-64 rounded-md border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Mensagem opcional para registrar a decisao."
                                value={adminResponseByRequest[request.request_id] ?? ''}
                                onChange={(event) =>
                                  setAdminResponseByRequest((prev) => ({
                                    ...prev,
                                    [request.request_id]: event.target.value,
                                  }))
                                }
                              />
                            </label>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={isReviewing}
                                onClick={() => void handleReviewRequest(request, 'approved')}
                              >
                                Liberar Tentativas
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-rose-200 text-rose-700 hover:bg-rose-50"
                                disabled={isReviewing}
                                onClick={() => void handleReviewRequest(request, 'rejected')}
                              >
                                Recusar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            {request.reviewed_at
                              ? `Analisada em ${new Date(request.reviewed_at).toLocaleString('pt-BR')}`
                              : 'Solicitacao finalizada.'}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Nenhuma solicitacao encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Progresso de conclusao</h3>
          <p className="text-sm text-slate-600">Visao consolidada do andamento dos cursos pelos alunos.</p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Aluno</th>
                  <th className="px-6 py-4">Curso</th>
                  <th className="px-6 py-4">Progresso</th>
                  <th className="px-6 py-4">Concluido Em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((item, idx) => (
                  <tr key={`${item.student_email}-${item.course_title}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{item.student_name}</p>
                      <p className="text-xs text-slate-500">{item.student_email}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{item.course_title}</td>
                    <td className="px-6 py-4">
                      {item.is_completed ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">Concluido</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">Em curso</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.completed_at ? new Date(item.completed_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
