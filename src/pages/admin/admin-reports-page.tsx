import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { fetchCourses } from '@/features/admin/content/api'
import { fetchCompletionReport, type CompletionReport } from '@/features/admin/reports/api'
import type { Course } from '@/types/content'

export function AdminReportsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [reportData, setReportData] = useState<CompletionReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')
  const [searchEmail, setSearchEmail] = useState('')

  useEffect(() => {
    async function loadInitialData() {
      try {
        const coursesData = await fetchCourses()
        setCourses(coursesData)
        
        const report = await fetchCompletionReport({})
        setReportData(report)
      } catch (err) {
        setError('Erro ao carregar relatorios.')
      } finally {
        setIsLoading(false)
      }
    }
    void loadInitialData()
  }, [])

  const filteredData = useMemo(() => {
    return reportData.filter((item) => {
      const matchCourse = selectedCourseId === 'all' || item.course_title === courses.find(c => c.id === selectedCourseId)?.title
      const matchEmail = item.student_email.toLowerCase().includes(searchEmail.toLowerCase())
      return matchCourse && matchEmail
    })
  }, [reportData, selectedCourseId, searchEmail, courses])

  const handleExportCSV = () => {
    const headers = ['Aluno', 'Email', 'Curso', 'Status', 'Concluido Em', 'Ultima Atividade']
    const rows = filteredData.map(item => [
      item.student_name,
      item.student_email,
      item.course_title,
      item.is_completed ? 'Sim' : 'Nao',
      item.completed_at || '-',
      item.last_activity
    ])
    
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_aluno_${new Date().toISOString()}.csv`)
    link.click()
  }

  if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando relatorios...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Relatorios</h2>
          <p className="text-sm text-slate-600">Acompanhe o progresso geral dos alunos.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Filtrar por Curso</span>
          <select 
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="all">Todos os Cursos</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
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
            onChange={(e) => setSearchEmail(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Curso</th>
                <th className="px-6 py-4">Progresso</th>
                <th className="px-6 py-4">Concluido Em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                    {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
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
    </div>
  )
}
