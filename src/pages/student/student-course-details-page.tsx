import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourseById,
  fetchStudentCourseContentWithProgress,
  setLessonCompletion,
  toErrorMessage,
} from '@/features/student/courses/api'
import {
  fetchStudentCourseAssessments,
  type StudentCourseAssessmentSummary,
} from '@/features/student/assessments/api'
import { fetchAdminCourseTree, type AdminCourseTree } from '@/features/admin/content/api'
import { exportModuleToPdf } from '@/features/student/content/pdf-exporter'
import { supabase } from '@/services/supabase/client'
import type { Course, ModuleLearningState, StudentCourseModuleProgress } from '@/types/content'

interface StudentCourseStatus {
  is_completed: boolean
  required_modules_total: number
  required_modules_completed: number
  has_required_final_assessment: boolean
  required_final_assessment_approved: boolean
}

function moduleStateLabel(state: ModuleLearningState) {
  if (state === 'blocked') return 'Bloqueado'
  if (state === 'completed') return 'Concluído'
  return 'Em Andamento'
}

function moduleStateClasses(state: ModuleLearningState) {
  if (state === 'blocked') return 'bg-slate-100 text-slate-500 ring-slate-200'
  if (state === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  return 'bg-blue-50 text-blue-700 ring-blue-200'
}

export function StudentCourseDetailsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user, roles } = useAuth()
  const isAdmin = roles.includes('admin')
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<StudentCourseModuleProgress[]>([])
  const [assessments, setAssessments] = useState<StudentCourseAssessmentSummary[]>([])
  const [courseStatus, setCourseStatus] = useState<StudentCourseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingLessonId, setIsSavingLessonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadCourseDetails() {
      if (!courseId) {
        setError('Curso inválido.')
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        if (isAdmin) {
          // Se for admin, buscamos a árvore completa do builder para bypassar qualquer trava de progresso no preview
          const tree: AdminCourseTree = await fetchAdminCourseTree(courseId)
          if (isMounted) {
            setCourse(tree.course)
            
            // Transformamos o formato do admin para o formato da grade do aluno
            const mappedModules: StudentCourseModuleProgress[] = tree.modules.map(m => ({
              id: m.id,
              course_id: m.course_id,
              position: m.position,
              title: m.title,
              description: m.description,
              is_required: m.is_required,
              state: 'in_progress', // Admins sempre podem ver
              is_unlocked: true,
              is_completed: false,
              required_lessons_total: m.lessons.filter(l => l.is_required).length,
              required_lessons_completed: 0,
              has_required_assessment: m.assessments.some(a => a.is_required),
              required_assessment_approved: false,
              progress_percent: 0,
              lessons: m.lessons.map(l => ({
                id: l.id,
                module_id: l.module_id,
                position: l.position,
                title: l.title,
                description: l.description,
                is_required: l.is_required,
                lesson_type: l.lesson_type,
                youtube_url: l.youtube_url,
                text_content: l.text_content,
                estimated_minutes: l.estimated_minutes,
                is_completed: false,
                completed_at: null
              }))
            }))
            
            setModules(mappedModules)
            
            // Mapeamos as avaliações simplificadamente para o admin
            const mappedAssessments: StudentCourseAssessmentSummary[] = [
              ...tree.courseAssessments.map(a => ({
                assessment_id: a.id,
                title: a.title,
                assessment_type: a.assessment_type,
                state: 'available' as const
              })),
              ...tree.modules.flatMap(m => m.assessments.map(a => ({
                assessment_id: a.id,
                title: a.title,
                assessment_type: a.assessment_type,
                module_id: m.id,
                state: 'available' as const
              })))
            ]
            setAssessments(mappedAssessments)
            setCourseStatus(null) 
          }
        } else {
          const [courseResult, modulesResult, assessmentsResult, statusResult] = await Promise.all([
            fetchReleasedCourseById(courseId),
            fetchStudentCourseContentWithProgress(courseId),
            fetchStudentCourseAssessments(courseId),
            supabase.rpc('get_student_course_status', { _course_id: courseId }),
          ])
          if (isMounted) {
            setCourse(courseResult)
            setModules(modulesResult)
            setAssessments(assessmentsResult)
            setCourseStatus(statusResult.data?.[0] as StudentCourseStatus ?? null)
          }
        }
      } catch (loadError) {
        if (isMounted) {
          setError(toErrorMessage(loadError))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadCourseDetails()
    return () => { isMounted = false }
  }, [courseId])

  async function handleToggleLessonCompletion(lessonId: string, isCurrentlyCompleted: boolean) {
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }
    setError(null)
    setIsSavingLessonId(lessonId)
    try {
      await setLessonCompletion({
        user_id: user.id,
        lesson_id: lessonId,
        is_completed: !isCurrentlyCompleted,
      })
      if (!courseId) return
      const [refreshedModules, refreshedAssessments, statusResult] = await Promise.all([
        fetchStudentCourseContentWithProgress(courseId),
        fetchStudentCourseAssessments(courseId),
        supabase.rpc('get_student_course_status', { _course_id: courseId }),
      ])
      setModules(refreshedModules)
      setAssessments(refreshedAssessments)
      setCourseStatus(statusResult.data?.[0] as StudentCourseStatus ?? null)
    } catch (toggleError) {
      setError(toErrorMessage(toggleError))
    } finally {
      setIsSavingLessonId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-6">
        <div className="relative h-16 w-16">
           <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
           <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        </div>
        <p className="animate-pulse text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Povoando seu ecossistema...</p>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-[32px] border border-rose-100 bg-rose-50 p-8 text-sm font-bold text-rose-600 shadow-sm flex items-center gap-4">{error}</div>
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 rounded-[48px] border border-slate-200 bg-white p-20 text-center shadow-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-[32px] bg-slate-50 text-slate-400 border border-slate-100">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Acesso Restrito</h2>
          <p className="text-base text-slate-500 leading-relaxed font-medium">
            Este conteúdo está em uma área restrita ou o curso ainda não foi liberado para você.
          </p>
        </div>
        <Button size="lg" className="bg-slate-900 hover:bg-slate-800 rounded-2xl h-14 px-8" asChild>
          <Link to="/aluno/cursos">Voltar aos meus cursos</Link>
        </Button>
      </div>
    )
  }

  const finalAssessment = assessments.find((a) => a.assessment_type === 'final')
  
  const totalCompleted = modules.filter(m => m.state === 'completed').length
  const totalModules = modules.length
  const courseProgressPercent = totalModules === 0 ? 0 : Math.round((totalCompleted / totalModules) * 100)

  return (
    <div className="space-y-12 pb-24 animate-in fade-in duration-700">
      
      {/* HERO SECTION */}
      <section className="relative rounded-[48px] overflow-hidden bg-slate-900 min-h-[400px] flex flex-col justify-end p-8 md:p-16 shadow-2xl">
         {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
         ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-950 opacity-100" />
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent z-10" />

         <div className="relative z-20 space-y-6 max-w-4xl">
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400">
              <Link to="/aluno/cursos" className="hover:text-white transition-colors">Meus Cursos</Link>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/60 truncate">{course.title}</span>
            </nav>

            <div className="space-y-4">
               <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                  {course.title}
               </h1>
               <div className="flex flex-wrap items-center gap-6">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     {course.workload_minutes} Minutos
                  </span>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z" /></svg>
                     {totalModules} Módulos
                  </span>
                  <div className="h-6 w-px bg-white/10 hidden md:block" />
                  <div className="flex items-center gap-3">
                     <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${courseProgressPercent}%` }} />
                     </div>
                     <span className="text-sm font-black text-white">{courseProgressPercent}% <span className="text-[10px] uppercase text-white/40 ml-1">Concluído</span></span>
                  </div>
               </div>
            </div>

            <div className="pt-4">
               <Button className="bg-white text-slate-900 hover:bg-slate-100 h-16 px-10 rounded-2xl font-black text-lg shadow-xl" asChild>
                  <Link to={modules[0]?.lessons[0] ? `/aluno/cursos/${courseId}/aulas/${modules[0].lessons[0].id}` : '#'}>
                     Continuar Aprendizado
                  </Link>
               </Button>
            </div>
         </div>
      </section>

      {/* CONGRATS ALERT */}
      {courseStatus?.is_completed && (
        <div className="rounded-[40px] bg-gradient-to-r from-emerald-500 to-teal-600 p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-emerald-200 animate-in zoom-in duration-700">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] bg-white/20 backdrop-blur-md text-white shadow-inner">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="space-y-2 text-center md:text-left flex-1">
            <h3 className="text-3xl font-black text-white leading-none">Missão Cumprida!</h3>
            <p className="text-emerald-50 text-lg font-medium">
              Você completou este curso com maestria. Seu empenho é o que define a qualidade HomeCare Match Academy.
            </p>
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white border-transparent text-emerald-700 font-black text-base hover:bg-emerald-50 shadow-lg">
             Baixar Certificado
          </Button>
        </div>
      )}

      {/* PERSISTENT PROGRESS BAR (HORIZONTAL) */}
      <section className="bg-white rounded-[32px] border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm animate-in slide-in-from-top-4 duration-700 delay-300">
         <div className="flex items-center gap-6">
            <div className="relative w-16 h-16 shrink-0">
               <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * courseProgressPercent) / 100} strokeLinecap="round" className="text-blue-600 transition-all duration-1000" />
               </svg>
               <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-slate-900">{courseProgressPercent}%</span>
               </div>
            </div>
            <div className="space-y-0.5">
               <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Resumo da Jornada</h5>
               <p className="text-sm font-bold text-slate-900">Seu progresso atual neste treinamento</p>
               <div className="flex items-center gap-2">
                  <div className="flex h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                     <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${courseProgressPercent}%` }} />
                  </div>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-8 w-full md:w-auto">
            <div className="flex flex-col items-center md:items-end gap-1 flex-1 md:flex-none">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Módulos</span>
               <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-slate-900">{totalCompleted} <span className="text-slate-300">/</span> {totalModules}</span>
                  <div className="px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-bold text-blue-600 border border-blue-100">
                     Concluídos
                  </div>
               </div>
            </div>

            {finalAssessment && (
               <div className="h-10 w-px bg-slate-100 hidden md:block" />
            )}

            {finalAssessment && (
               <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avaliação Final</p>
                     <p className={`text-xs font-bold ${finalAssessment.state === 'approved' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {finalAssessment.state === 'approved' ? 'Aprovado ✅' : 'Pendente'}
                     </p>
                  </div>
                  <Button asChild disabled={finalAssessment.state === 'blocked'} size="sm" className={`h-12 px-6 rounded-xl font-black ${
                     finalAssessment.state === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-blue-600'
                  }`}>
                     <Link to={`/aluno/cursos/${courseId}/avaliacoes/${finalAssessment.assessment_id}`}>
                        {finalAssessment.state === 'approved' ? 'Ver Resultado' : 'Iniciar Prova'}
                     </Link>
                  </Button>
               </div>
            )}
         </div>
      </section>
      
      {/* COURSE DESCRIPTION (NEW) */}
      {course.description && (
         <section className="bg-white rounded-[40px] border border-slate-100 p-10 md:p-14 space-y-8 animate-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="flex items-center gap-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Sobre este Treinamento</h3>
               <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div 
               className="text-lg font-medium text-slate-600 leading-relaxed ql-editor !p-0"
               dangerouslySetInnerHTML={{ __html: course.description }}
            />
         </section>
      )}

      {/* CURRICULUM CONTENT (FULL WIDTH) */}
      <div className="space-y-12">
         <div className="flex items-center gap-4">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Grade Curricular</h3>
            <div className="h-px flex-1 bg-slate-100" />
         </div>

         <div className="space-y-8">
            {modules.map((module, mIdx) => {
               const moduleAssessment = assessments.find(a => a.assessment_type === 'module' && a.module_id === module.id)
               const isBlocked = module.state === 'blocked'

               return (
                  <div key={module.id} className={`group ${isBlocked ? 'opacity-50' : ''}`}>
                     <div className="flex items-start gap-6">
                        <div className="hidden md:flex flex-col items-center gap-2 pt-2">
                           <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-all ${
                              module.state === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' :
                              isBlocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                           }`}>
                              {module.state === 'completed' ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : mIdx + 1}
                           </div>
                           <div className="w-0.5 flex-1 bg-slate-100 group-last:hidden min-h-[100px]" />
                        </div>

                        <div className="flex-1 space-y-6">
                           <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm group-hover:shadow-md transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                 <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{module.title}</h4>
                                 <div className="flex items-center gap-2">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${moduleStateClasses(module.state)}`}>
                                       {moduleStateLabel(module.state)}
                                    </span>
                                    {!isBlocked && (
                                       <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => void exportModuleToPdf(course!.title, module.title, module.id)}
                                          className="h-8 px-3 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-blue-600 flex items-center gap-1.5 transition-all"
                                       >
                                          <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 4h6m-6 4h1" /></svg>
                                          Baixar PDF
                                       </Button>
                                    )}
                                 </div>
                              </div>
                              <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">{module.description || "Inicie este módulo para explorar os fundamentos e técnicas deste tópico."}</p>

                              {!isBlocked ? (
                                 <div className="space-y-4">
                                       {module.lessons.map(lesson => (
                                          <div key={lesson.id} className="flex items-center gap-2 group/item">
                                             <button
                                                type="button"
                                                disabled={isSavingLessonId === lesson.id}
                                                onClick={(e) => {
                                                   e.preventDefault();
                                                   void handleToggleLessonCompletion(lesson.id, lesson.is_completed);
                                                }}
                                                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                                   lesson.is_completed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 hover:text-blue-500 shadow-inner'
                                                }`}
                                             >
                                                {isSavingLessonId === lesson.id ? (
                                                   <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                ) : lesson.is_completed ? (
                                                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                   <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                )}
                                             </button>
                                             <Link to={`/aluno/cursos/${courseId}/aulas/${lesson.id}`} className="flex-1 flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all">
                                                <div>
                                                   <p className={`text-sm font-bold ${lesson.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{lesson.title}</p>
                                                   {lesson.is_required && <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Obrigatória</span>}
                                                </div>
                                                <svg className="h-4 w-4 text-slate-300 transition-transform group-hover/item:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                             </Link>
                                          </div>
                                       ))}

                                    {moduleAssessment && (
                                       <div className={`mt-6 p-6 rounded-[24px] border border-dashed transition-all ${
                                          moduleAssessment.state === 'approved' ? 'bg-emerald-50/30 border-emerald-200' :
                                          moduleAssessment.state === 'blocked' ? 'bg-slate-50/50 border-slate-200 opacity-60' :
                                          'bg-blue-50/30 border-blue-200'
                                       }`}>
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                             <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${moduleAssessment.state === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                   </div>
                                                   <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{moduleAssessment.title}</span>
                                                </div>
                                                <p className="text-xs font-medium text-slate-400">Avaliação Obrigatória do Módulo</p>
                                             </div>
                                             <Button size="sm" asChild disabled={moduleAssessment.state === 'blocked'} className={`h-11 px-6 rounded-xl font-black ${moduleAssessment.state === 'approved' ? 'bg-white text-emerald-600 border-emerald-200 shadow-sm' : 'bg-blue-600'}`}>
                                                <Link to={`/aluno/cursos/${courseId}/avaliacoes/${moduleAssessment.assessment_id}`}>
                                                   {moduleAssessment.state === 'approved' ? 'Refazer Quiz' : 'Iniciar Quiz'}
                                                </Link>
                                             </Button>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              ) : (
                                 <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-[24px] border border-slate-100 text-slate-400">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    <span className="text-sm font-bold uppercase tracking-widest">Conteúdo Bloqueado</span>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
               )
            })}
         </div>
      </div>

    </div>
  )
}
