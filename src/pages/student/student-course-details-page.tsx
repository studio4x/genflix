import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { fetchStudentCourseStatus, fetchReleasedCourseById, fetchStudentCourseContentWithProgress, getStudentCourseJourneyStatus, setLessonCompletion, toErrorMessage, } from '@/features/student/courses/api';
import { fetchStudentCourseAssessments, type StudentCourseAssessmentSummary, } from '@/features/student/assessments/api';
import { fetchAdminCourseTree, type AdminCourseTree } from '@/features/admin/content/api';
import { exportModuleToPdf } from '@/features/student/content/pdf-exporter';
import { deleteLessonNote, fetchLessonNotes } from '@/features/student/notes/api';
import type { Course, LessonNote, ModuleLearningState, StudentCourseModuleProgress } from '@/types/content';
import type { StudentCourseStatus } from '@/features/student/courses/api';
function moduleStateLabel(state: ModuleLearningState) {
    if (state === 'blocked')
        return 'Bloqueado';
    if (state === 'completed')
        return 'Concluído';
    return 'Em Andamento';
}
function moduleStateClasses(state: ModuleLearningState) {
    if (state === 'blocked')
        return 'bg-slate-100 text-slate-500 ring-slate-200';
    if (state === 'completed')
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    return 'bg-blue-50 text-blue-700 ring-blue-200';
}
function sanitizeCourseDescriptionHtml(rawValue: string) {
    if (!rawValue.trim()) {
        return '';
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawValue, 'text/html');
    const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'base', 'meta', 'link']);
    Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
        const tagName = node.tagName.toLowerCase();
        if (blockedTags.has(tagName)) {
            node.remove();
            return;
        }
        Array.from(node.attributes).forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim().toLowerCase();
            if (name.startsWith('on')) {
                node.removeAttribute(attribute.name);
                return;
            }
            if ((name === 'href' || name === 'src') && (value.startsWith('javascript:') || value.startsWith('data:text/html'))) {
                node.removeAttribute(attribute.name);
            }
        });
    });
    return doc.body.innerHTML;
}
export function StudentCourseDetailsPage() {
    const { courseId } = useParams<{
        courseId: string;
    }>();
    const { user, roles } = useAuth();
    const isAdmin = roles.includes('admin');
    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<StudentCourseModuleProgress[]>([]);
    const [assessments, setAssessments] = useState<StudentCourseAssessmentSummary[]>([]);
    const [courseStatus, setCourseStatus] = useState<StudentCourseStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingLessonId, setIsSavingLessonId] = useState<string | null>(null);
    const [lessonNotes, setLessonNotes] = useState<LessonNote[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [deletingLessonNoteId, setDeletingLessonNoteId] = useState<string | null>(null);
    const [notesError, setNotesError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let isMounted = true;
        async function loadCourseDetails() {
            if (!courseId) {
                setError('Curso inválido.');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                if (isAdmin) {
                    // Se for admin, buscamos a árvore completa do builder para bypassar qualquer trava de progresso no preview
                    const tree: AdminCourseTree = await fetchAdminCourseTree(courseId);
                    if (isMounted) {
                        setCourse(tree.course);
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
                            starts_at: m.starts_at,
                            ends_at: m.ends_at,
                            module_pdf_file_name: m.module_pdf_file_name,
                            module_pdf_storage_path: m.module_pdf_storage_path,
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
                                starts_at: l.starts_at,
                                ends_at: l.ends_at,
                                is_completed: false,
                                completed_at: null
                            }))
                        }));
                        setModules(mappedModules);
                        // Mapeamos as avaliações simplificadamente para o admin
                        const mappedAssessments: StudentCourseAssessmentSummary[] = [
                            ...tree.courseAssessments.map(a => ({
                                assessment_id: a.id,
                                title: a.title,
                                assessment_type: a.assessment_type as 'module' | 'final',
                                module_id: null,
                                module_position: null,
                                description: a.description,
                                is_required: a.is_required,
                                passing_score: a.passing_score,
                                max_attempts: a.max_attempts,
                                is_active: a.is_active,
                                is_unlocked: true,
                                attempts_used: 0,
                                last_score: null,
                                last_is_approved: false,
                                remaining_attempts: a.max_attempts,
                                state: 'available' as const
                            })),
                            ...tree.modules.flatMap(m => m.assessments.map(a => ({
                                assessment_id: a.id,
                                title: a.title,
                                assessment_type: a.assessment_type as 'module' | 'final',
                                module_id: m.id,
                                module_position: m.position,
                                description: a.description,
                                is_required: a.is_required,
                                passing_score: a.passing_score,
                                max_attempts: a.max_attempts,
                                is_active: a.is_active,
                                is_unlocked: true,
                                attempts_used: 0,
                                last_score: null,
                                last_is_approved: false,
                                remaining_attempts: a.max_attempts,
                                state: 'available' as const
                            })))
                        ];
                        setAssessments(mappedAssessments);
                        setCourseStatus(null);
                    }
                }
                else {
                    const [courseResult, modulesResult, assessmentsResult, statusResult] = await Promise.all([
                        fetchReleasedCourseById(courseId),
                        fetchStudentCourseContentWithProgress(courseId),
                        fetchStudentCourseAssessments(courseId),
                        fetchStudentCourseStatus(courseId),
                    ]);
                    if (isMounted) {
                        setCourse(courseResult);
                        setModules(modulesResult);
                        setAssessments(assessmentsResult);
                        setCourseStatus(statusResult);
                    }
                }
            }
            catch (loadError) {
                if (isMounted) {
                    setError(toErrorMessage(loadError));
                }
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        void loadCourseDetails();
        return () => { isMounted = false; };
    }, [courseId]);
    async function handleToggleLessonCompletion(lessonId: string, isCurrentlyCompleted: boolean) {
        if (!user) {
            setError('Usuário não autenticado.');
            return;
        }
        setError(null);
        setIsSavingLessonId(lessonId);
        try {
            await setLessonCompletion({
                user_id: user.id,
                lesson_id: lessonId,
                is_completed: !isCurrentlyCompleted,
            });
            if (!courseId)
                return;
            const [refreshedModules, refreshedAssessments, statusResult] = await Promise.all([
                fetchStudentCourseContentWithProgress(courseId),
                fetchStudentCourseAssessments(courseId),
                fetchStudentCourseStatus(courseId),
            ]);
            setModules(refreshedModules);
            setAssessments(refreshedAssessments);
            setCourseStatus(statusResult);
        }
        catch (toggleError) {
            setError(toErrorMessage(toggleError));
        }
        finally {
            setIsSavingLessonId(null);
        }
    }
    useEffect(() => {
        let isMounted = true;
        async function loadLessonNotes() {
            if (!user)
                return;
            const lessonIds = modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
            if (lessonIds.length === 0) {
                if (isMounted) {
                    setLessonNotes([]);
                }
                return;
            }
            setIsLoadingNotes(true);
            setNotesError(null);
            try {
                const notes = await fetchLessonNotes(lessonIds);
                if (isMounted) {
                    setLessonNotes(notes);
                }
            }
            catch (notesError) {
                if (isMounted) {
                    setNotesError(toErrorMessage(notesError));
                }
            }
            finally {
                if (isMounted) {
                    setIsLoadingNotes(false);
                }
            }
        }
        void loadLessonNotes();
        return () => { isMounted = false; };
    }, [modules, user]);
    async function handleDeleteLessonNote(lessonId: string) {
        if (!user)
            return;
        setDeletingLessonNoteId(lessonId);
        setNotesError(null);
        try {
            await deleteLessonNote({
                user_id: user.id,
                lesson_id: lessonId,
            });
            setLessonNotes((current) => current.filter((note) => note.lesson_id !== lessonId));
        }
        catch (deleteError) {
            setNotesError(toErrorMessage(deleteError));
        }
        finally {
            setDeletingLessonNoteId(null);
        }
    }
    if (isLoading) {
        return (<div className="flex min-h-[400px] flex-col items-center justify-center space-y-6">
        <div className="relative h-16 w-16">
           <div className="absolute inset-0 rounded-full border-4 border-slate-100"/>
           <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"/>
        </div>
        <p className="animate-pulse text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Povoando seu ecossistema...</p>
      </div>);
    }
    if (error) {
        return <div className="rounded-[32px] border border-rose-100 bg-rose-50 p-8 text-sm font-bold text-rose-600 shadow-sm flex items-center gap-4">{error}</div>;
    }
    if (!course) {
        return (<div className="flex flex-col items-center justify-center space-y-6 rounded-[48px] border border-slate-200 bg-white p-20 text-center shadow-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-[32px] bg-slate-50 text-slate-400 border border-slate-100">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
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
      </div>);
    }
    const finalAssessment = assessments.find((a) => a.assessment_type === 'final');
    const courseJourneyStatus = getStudentCourseJourneyStatus(courseStatus);
    const hasStartedCourse = isAdmin ||
        Boolean(courseStatus?.is_completed) ||
        (courseStatus?.required_modules_completed ?? 0) > 0 ||
        modules.some((module) => module.lessons.some((lesson) => lesson.is_completed)) ||
        assessments.some((assessment) => assessment.attempts_used > 0 || assessment.last_score !== null || assessment.last_is_approved);
    const totalCompleted = modules.filter(m => m.state === 'completed').length;
    const totalModules = modules.length;
    const courseProgressPercent = totalModules === 0 ? 0 : Math.round((totalCompleted / totalModules) * 100);
    const lessonMetaById = new Map(modules.flatMap((module) => module.lessons.map((lesson) => [
        lesson.id,
        {
            lessonTitle: lesson.title,
            moduleTitle: module.title,
        },
    ] as const)));
    const sanitizedCourseDescription = course.description ? sanitizeCourseDescriptionHtml(course.description) : '';
    return (<div className="space-y-12 pb-24 animate-in fade-in duration-700">
      
      {/* HERO SECTION */}
      <section className="relative rounded-[48px] overflow-hidden bg-slate-900 min-h-[400px] flex flex-col justify-end p-8 md:p-16 shadow-2xl">
         {course.thumbnail_url ? (<img src={course.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40"/>) : (<div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-950 opacity-100"/>)}
         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent z-10"/>

         <div className="relative z-20 space-y-6 max-w-4xl">
            <div className="space-y-4">
               <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                  {course.title}
               </h1>
               <div className="flex flex-wrap items-center gap-6">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                     {course.workload_minutes} Minutos
                  </span>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11v9h-2v-9H7v9H5v-9H3V9h18v2h-2z"/></svg>
                     {totalModules} Módulos
                  </span>
                  <div className="h-6 w-px bg-white/10 hidden md:block"/>
                  <div className="flex items-center gap-3">
                     <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${courseProgressPercent}%` }}/>
                     </div>
                     <span className="text-sm font-black text-white">{courseProgressPercent}% <span className="text-[10px] uppercase text-white/40 ml-1">Concluído</span></span>
                  </div>
               </div>
            </div>

            <div className="pt-4">
               <Button className="bg-white text-slate-900 hover:bg-slate-100 h-16 px-10 rounded-2xl font-black text-lg shadow-xl" asChild>
                  <Link to={modules[0]?.lessons[0] ? `/aluno/cursos/${courseId}/player/aulas/${modules[0].lessons[0].id}` : '#'}>
                     {courseJourneyStatus === 'completed'
            ? 'Revisar Aprendizado'
            : hasStartedCourse
                ? 'Continuar Aprendizado'
                : 'Iniciar Aprendizado'}
                  </Link>
               </Button>
            </div>
         </div>
      </section>

      {/* CONGRATS ALERT */}
      {courseJourneyStatus === 'completed' && (<div className="rounded-[40px] bg-gradient-to-r from-emerald-500 to-teal-600 p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-emerald-200 animate-in zoom-in duration-700">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] bg-white/20 backdrop-blur-md text-white shadow-inner">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
          </div>
          <div className="space-y-2 text-center md:text-left flex-1">
            <h3 className="text-3xl font-black text-white leading-none">Missão Cumprida!</h3>
            <p className="text-emerald-50 text-lg font-medium">
              Você completou este curso com maestria. Seu empenho é o que define a qualidade da GenFlix Academy.
            </p>
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white border-transparent text-emerald-700 font-black text-base hover:bg-emerald-50 shadow-lg">
             Baixar Certificado
          </Button>
        </div>)}

      {courseJourneyStatus === 'final_pending' && (<div className="rounded-[40px] bg-gradient-to-r from-amber-400 to-orange-500 p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-amber-200 animate-in zoom-in duration-700">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] bg-white/20 backdrop-blur-md text-white shadow-inner">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M9 12h6"/>
            </svg>
          </div>
          <div className="space-y-2 text-center md:text-left flex-1">
            <h3 className="text-3xl font-black text-white leading-none">Conteúdo Concluído</h3>
            <p className="text-amber-50 text-lg font-medium">
              Você concluiu todos os módulos obrigatórios. Falta apenas realizar e ser aprovado na avaliação final para concluir o curso.
            </p>
          </div>
          {finalAssessment && (<Button asChild className="h-14 px-8 rounded-2xl bg-white text-orange-600 font-black text-base hover:bg-amber-50 shadow-lg">
              <Link to={`/aluno/cursos/${courseId}/player/avaliacoes/${finalAssessment.assessment_id}`}>
                Fazer Prova Final
              </Link>
            </Button>)}
        </div>)}

      {/* PERSISTENT PROGRESS BAR (HORIZONTAL) */}
      <section className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm animate-in slide-in-from-top-4 duration-700 delay-300">
         <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
         <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <div className="relative w-16 h-16 shrink-0">
               <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100"/>
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * courseProgressPercent) / 100} strokeLinecap="round" className="text-blue-600 transition-all duration-1000"/>
               </svg>
               <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-slate-900">{courseProgressPercent}%</span>
               </div>
            </div>
            <div className="space-y-0.5 min-w-0">
               <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Resumo da Jornada</h5>
               <p className="text-sm font-bold text-slate-900">Seu progresso atual neste treinamento</p>
               <div className="flex items-center gap-2">
                  <div className="flex h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                     <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${courseProgressPercent}%` }}/>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex w-fit min-w-fit flex-col items-start justify-center gap-1 self-start rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 lg:shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Módulos</span>
            <div className="flex items-end gap-2">
               <span className="text-3xl font-black leading-none text-slate-900">{totalCompleted}</span>
               <span className="text-2xl font-black leading-none text-slate-300">/</span>
               <span className="text-3xl font-black leading-none text-slate-900">{totalModules}</span>
            </div>
            <div className="inline-flex w-fit items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600 whitespace-nowrap">
               Concluídos
            </div>
         </div>
         </div>
      </section>
      
      {/* COURSE DESCRIPTION (NEW) */}
      {sanitizedCourseDescription && (<section className="bg-white rounded-[40px] border border-slate-100 p-10 md:p-14 space-y-8 animate-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="flex items-center gap-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Sobre este Treinamento</h3>
               <div className="h-px flex-1 bg-slate-100"/>
            </div>
            <div className="text-lg font-medium text-slate-600 leading-relaxed ql-editor !p-0" dangerouslySetInnerHTML={{ __html: sanitizedCourseDescription }}/>
         </section>)}

      {/* CURRICULUM CONTENT (FULL WIDTH) */}
      <div className="space-y-12">
         <div className="flex items-center gap-4">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Grade Curricular</h3>
            <div className="h-px flex-1 bg-slate-100"/>
         </div>

         <div className="space-y-8">
            {modules.map((module, mIdx) => {
            const moduleAssessments = assessments
                .filter((assessment) => assessment.assessment_type === 'module' && assessment.module_id === module.id)
                .sort((assessmentA, assessmentB) => assessmentA.title.localeCompare(assessmentB.title, 'pt-BR'));
            const isBlocked = module.state === 'blocked';
            const areAllModuleLessonsCompleted = module.lessons.length > 0 && module.lessons.every((lesson) => lesson.is_completed);
            const moduleQuizLockedByLessons = !isAdmin && !areAllModuleLessonsCompleted;
            return (<div key={module.id} className={`group ${isBlocked ? 'opacity-50' : ''}`}>
                     <div className="flex items-start gap-6">
                        <div className="hidden md:flex flex-col items-center gap-2 pt-2">
                           <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-all ${module.state === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' :
                    isBlocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}>
                              {module.state === 'completed' ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> : mIdx + 1}
                           </div>
                           <div className="w-0.5 flex-1 bg-slate-100 group-last:hidden min-h-[100px]"/>
                        </div>

                        <div className="flex-1 space-y-6">
                           <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm group-hover:shadow-md transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                 <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{module.title}</h4>
                                 <div className="flex items-center gap-2">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${moduleStateClasses(module.state)}`}>
                                       {moduleStateLabel(module.state)}
                                    </span>
                                    {!isBlocked && (<Button variant="outline" size="sm" onClick={() => void exportModuleToPdf(course!.title, module.title, module.id)} className="h-8 px-3 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-blue-600 flex items-center gap-1.5 transition-all">
                                          <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 4h6m-6 4h1"/></svg>
                                          Baixar PDF
                                       </Button>)}
                                 </div>
                              </div>
                              <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">{module.description || "Inicie este módulo para explorar os fundamentos e técnicas deste tópico."}</p>

                              {!isBlocked ? (<div className="space-y-4">
                                       {module.lessons.map(lesson => (<div key={lesson.id} className="flex items-center gap-2 group/item">
                                             <button type="button" disabled={isSavingLessonId === lesson.id} onClick={(e) => {
                            e.preventDefault();
                            void handleToggleLessonCompletion(lesson.id, lesson.is_completed);
                        }} className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${lesson.is_completed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 hover:text-blue-500 shadow-inner'}`}>
                                                {isSavingLessonId === lesson.id ? (<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : lesson.is_completed ? (<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>) : (<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>)}
                                             </button>
                                             <Link to={`/aluno/cursos/${courseId}/player/aulas/${lesson.id}`} className="flex-1 flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all">
                                                <div>
                                                   <p className={`text-sm font-bold ${lesson.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{lesson.title}</p>
                                                   {lesson.is_required && <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Obrigatória</span>}
                                                </div>
                                                <svg className="h-4 w-4 text-slate-300 transition-transform group-hover/item:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                                             </Link>
                                          </div>))}

                                    {moduleAssessments.map((moduleAssessment) => (<div key={moduleAssessment.assessment_id} className={`mt-6 p-6 rounded-[24px] border border-dashed transition-all ${moduleQuizLockedByLessons ? 'bg-amber-50/40 border-amber-200' :
                            moduleAssessment.state === 'approved' ? 'bg-emerald-50/30 border-emerald-200' :
                                moduleAssessment.state === 'blocked' ? 'bg-slate-50/50 border-slate-200 opacity-60' :
                                    'bg-blue-50/30 border-blue-200'}`}>
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                             <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${moduleQuizLockedByLessons
                            ? 'bg-amber-100 text-amber-600'
                            : moduleAssessment.state === 'approved'
                                ? 'bg-emerald-100 text-emerald-600'
                                : moduleAssessment.state === 'failed_limit'
                                    ? 'bg-rose-100 text-rose-600'
                                    : 'bg-blue-100 text-blue-600'}`}>
                                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                                   </div>
                                                   <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{moduleAssessment.title}</span>
                                                </div>
                                                <p className={`text-xs font-bold ${moduleQuizLockedByLessons ? 'text-amber-600' :
                            moduleAssessment.state === 'approved' ? 'text-emerald-600' :
                                moduleAssessment.state === 'failed_limit' ? 'text-rose-600' : 'text-slate-400'}`}>
                                                   {moduleQuizLockedByLessons ? 'Conclua todas as aulas do módulo para liberar o quiz' : moduleAssessment.state === 'approved' ? 'Aprovado ✅' :
                            moduleAssessment.state === 'failed_limit' ? 'Tentativas Esgotadas' : 'Avaliação Obrigatória do Módulo'}
                                                </p>
                                             </div>
                                             <Button size="sm" asChild disabled={moduleAssessment.state === 'blocked' || moduleQuizLockedByLessons} className={`h-11 px-6 rounded-xl font-black ${moduleAssessment.state === 'approved' ? 'bg-white text-emerald-600 border-emerald-200 shadow-sm' :
                            moduleAssessment.state === 'failed_limit' ? 'bg-white text-rose-600 border-rose-200 shadow-sm' : 'bg-blue-600'}`}>
                                                <Link to={`/aluno/cursos/${courseId}/player/avaliacoes/${moduleAssessment.assessment_id}`}>
                                                   {moduleQuizLockedByLessons ? 'Conclua todas as aulas do módulo para liberar o quiz' : moduleAssessment.state === 'approved' ? 'Refazer Quiz' :
                            moduleAssessment.state === 'failed_limit' ? 'Ver Status' : 'Iniciar Quiz'}
                                                </Link>
                                             </Button>
                                          </div>
                                       </div>))}
                                 </div>) : (<div className="flex items-center gap-4 bg-slate-50 p-6 rounded-[24px] border border-slate-100 text-slate-400">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                                    <span className="text-sm font-bold uppercase tracking-widest">Conteúdo Bloqueado</span>
                                 </div>)}
                           </div>
                        </div>
                     </div>
                  </div>);
        })}
         </div>
      </div>

      <section className="space-y-6">
         <div className="flex items-center gap-4">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Minhas Anotações</h3>
            <div className="h-px flex-1 bg-slate-100"/>
         </div>

         <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
            {notesError ? (<div className="rounded-[24px] border border-rose-100 bg-rose-50 px-6 py-6 text-sm font-medium text-rose-600">
                  {notesError}
               </div>) : isLoadingNotes ? (<div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-medium text-slate-500">
                  Carregando suas anotações...
               </div>) : lessonNotes.length === 0 ? (<div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-slate-500">
                     Você ainda não criou anotações neste curso. Abra uma aula e use o bloco de notas ao final da página.
                  </p>
               </div>) : (<div className="grid gap-4">
                  {lessonNotes.map((note) => {
                const lessonMeta = lessonMetaById.get(note.lesson_id);
                const updatedAt = new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                }).format(new Date(note.updated_at));
                return (<article key={note.id} className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
                           <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                 <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
                                       {lessonMeta?.moduleTitle ?? 'Módulo'}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500">
                                       Atualizada em {updatedAt}
                                    </span>
                                 </div>

                                 <h4 className="mt-3 text-lg font-black tracking-tight text-slate-900">
                                    {lessonMeta?.lessonTitle ?? 'Aula'}
                                 </h4>
                                 <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600">
                                    {note.note_text}
                                 </p>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                 <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white font-bold text-slate-700">
                                    <Link to={`/aluno/cursos/${courseId}/player/aulas/${note.lesson_id}`}>
                                       Abrir aula
                                    </Link>
                                 </Button>
                                 <Button type="button" variant="outline" disabled={deletingLessonNoteId === note.lesson_id} onClick={() => void handleDeleteLessonNote(note.lesson_id)} className="rounded-xl border-rose-200 bg-white font-bold text-rose-600 hover:bg-rose-50">
                                    {deletingLessonNoteId === note.lesson_id ? 'Excluindo...' : 'Excluir nota'}
                                 </Button>
                              </div>
                           </div>
                        </article>);
            })}
               </div>)}
         </div>
      </section>

    </div>);
}
