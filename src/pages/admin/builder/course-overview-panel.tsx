import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Link } from 'react-router-dom'

export function CourseOverviewPanel() {
  const { courseTree } = useCourseBuilder()

  if (!courseTree) return null
  const { course, modules } = courseTree

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0)
  const totalDuration = modules.reduce((acc, m) => acc + m.lessons.reduce((lAcc, l) => lAcc + l.estimated_minutes, 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Visão Geral do Curso</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
          Este é o centro de controle do seu curso. Utilize o painel lateral para navegar, editar e construir a estrutura pedagógica.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z" /></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{modules.length}</span>
          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Módulos</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{totalLessons}</span>
          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Aulas</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <span className="text-3xl font-black text-slate-900">{Math.round(totalDuration / 60)}h {totalDuration % 60}m</span>
          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Estimativa</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Mapa do Curso</h3>
            <p className="text-sm text-slate-500">A hierarquia atual de aprendizado.</p>
          </div>
          <Link to={`/admin/cursos/${course.id}/builder/modulos/novo`} className="shrink-0 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Adicionar Módulo
          </Link>
        </div>
        
        <div className="p-6 space-y-6">
          {modules.length === 0 ? (
            <div className="text-center py-12">
               <p className="text-slate-500">Nenhum módulo criado ainda. Comece estruturando o curso.</p>
            </div>
          ) : (
            modules.map((m, mIdx) => (
              <div key={m.id} className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">
                      <span>Módulo {mIdx + 1}</span>
                      {m.is_required && <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Obrigatório</span>}
                    </div>
                    <h4 className="text-base font-bold text-slate-900">{m.title}</h4>
                  </div>
                  <Link to={`/admin/cursos/${course.id}/builder/modulos/${m.id}`} className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800">
                    Editar Módulo
                  </Link>
                </div>
                
                {m.lessons.length > 0 ? (
                  <div className="space-y-2 mt-4 pl-4 border-l-2 border-slate-100">
                    {m.lessons.map(l => (
                      <div key={l.id} className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                           <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           {l.title}
                        </span>
                        <Link to={`/admin/cursos/${course.id}/builder/modulos/${m.id}/aulas/${l.id}`} className="text-xs font-semibold text-slate-500 hover:text-blue-600">
                          Editar
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 pl-4 border-l-2 border-slate-100">
                     <p className="text-sm text-slate-400 italic">Nenhuma aula neste módulo.</p>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100">
                   <Link to={`/admin/cursos/${course.id}/builder/modulos/${m.id}/aulas/nova`} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Adicionar Aula
                   </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
