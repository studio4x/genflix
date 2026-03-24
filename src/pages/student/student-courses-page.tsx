import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchReleasedCourses,
  toErrorMessage,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

export function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function loadCourses() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchReleasedCourses()
        if (isMounted) setCourses(data)
      } catch (loadError) {
        if (isMounted) setError(toErrorMessage(loadError))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void loadCourses()
    return () => { isMounted = false }
  }, [])

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-10">
        <div className="flex items-center gap-2 mb-2 font-black text-blue-600 uppercase tracking-widest text-[10px] bg-blue-50 px-3 py-1 rounded-full w-fit">
           Área do Aluno
        </div>
        <h2 className="text-4xl font-black tracking-tight text-slate-900">Meus Treinamentos</h2>
        <p className="text-lg font-medium text-slate-500 max-w-2xl">
          Sua jornada de desenvolvimento profissional começa aqui. Escolha um curso e acelere sua carreira.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[400px] rounded-[32px] bg-slate-100/50 animate-pulse border border-slate-50 shadow-sm" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-600 shadow-sm flex items-center gap-4 animate-in shake duration-500">
           <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           {error}
        </div>
      ) : null}

      {!isLoading && courses.length === 0 && !error ? (
        <div className="rounded-[40px] border-4 border-dashed border-slate-100 p-20 text-center bg-slate-50/30">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm border border-slate-100 text-slate-200 mb-6">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Caminho livre...</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto font-medium">
            Assim que novos treinamentos forem designados para você, eles aparecerão aqui para serem explorados.
          </p>
        </div>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <article 
            key={course.id} 
            className="group relative flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-500 overflow-hidden"
          >
            {/* THUMBNAIL AREA */}
            <Link to={`/aluno/cursos/${course.id}`} className="aspect-[16/9] w-full bg-slate-200 relative overflow-hidden block">
               {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
               ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <span className="text-4xl font-black text-white/10 uppercase tracking-tighter">LMS</span>
                  </div>
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 z-10" />
               
               {/* Workload Badge */}
               <div className="absolute top-4 right-4 z-20 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {course.workload_hours}h
               </div>

               {/* Interaction Overlay */}
               <div className="absolute inset-0 bg-blue-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                  <div className="bg-white text-blue-600 font-black rounded-2xl h-12 px-6 flex items-center justify-center shadow-xl">
                     Acessar Conteúdo
                  </div>
               </div>
            </Link>

            {/* CONTENT AREA */}
            <div className="p-8 flex flex-col flex-1 space-y-4">
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {course.title}
                </h3>
                <p className="mt-4 text-sm font-medium text-slate-500 line-clamp-2 leading-relaxed h-[40px]">
                  {course.description || "Inicie este treinamento para desenvolver novas competências e aprimorar seus resultados."}
                </p>
              </div>

              {/* CARD FOOTER */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                 <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponível</span>
                 </div>
                 <Link to={`/aluno/cursos/${course.id}`} className="text-blue-600 text-[11px] font-black uppercase tracking-widest hover:text-blue-700 transition-colors flex items-center gap-2 group/btn">
                    Começar Agora
                    <svg className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                 </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

