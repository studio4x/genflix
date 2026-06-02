import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { splitContent } from '@/features/admin/content/content-blocks';
import { ContentBlocksRenderer } from '@/features/admin/content/content-blocks-renderer';
import { getLessonFooterActionIconName, getLessonFooterButtonClassName, renderButtonTemplateIcon, } from '@/features/admin/content/button-template-icons';
import { fetchMaterials, fetchLessonFooterActions, getSignedMaterialUrl, getSignedLessonFooterActionUrl, } from '@/features/admin/content/api';
import type { StudentCourseAssessmentSummary } from '@/features/student/assessments/api';
import { exportLicensedModulePdf, exportModuleToPdf, } from '@/features/student/content/pdf-exporter';
import { LessonAudioPlayer } from '@/features/student/lesson-audio/lesson-audio-player';
import { LessonNotesPanel } from '@/features/student/notes/lesson-notes-panel';
import { fetchStudentCourseContentWithProgress, setLessonCompletion, toErrorMessage, } from '@/features/student/courses/api';
import { supabase } from '@/services/supabase/client';
import type { Lesson, LessonFooterAction, StudentCourseModuleProgress, StudentLessonWithProgress, } from '@/types/content';
function getLessonVideoSource(url: string | null): {
    type: 'youtube';
    value: string;
} | {
    type: 'direct';
    value: string;
} | {
    type: 'asset';
} | null {
    if (!url)
        return null;
    if (url.startsWith('asset:')) {
        return { type: 'asset' };
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return { type: 'youtube', value: match[2] };
    }
    const isDirectVideo = /^https?:\/\/[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?$/i.test(url);
    if (isDirectVideo) {
        return { type: 'direct', value: url };
    }
    return null;
}
export function StudentLessonPage() {
    const { courseId, lessonId } = useParams<{
        courseId: string;
        lessonId: string;
    }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { course, modules, assessments, setModules } = useOutletContext<{
        course: {
            title: string;
        };
        modules: StudentCourseModuleProgress[];
        assessments: StudentCourseAssessmentSummary[];
        setModules: (modules: StudentCourseModuleProgress[]) => void;
    }>();
    const [isTogglingCompletion, setIsTogglingCompletion] = useState(false);
    const [activeLessonDetails, setActiveLessonDetails] = useState<Lesson | null>(null);
    const [footerActions, setFooterActions] = useState<LessonFooterAction[]>([]);
    const [isLoadingFooterActions, setIsLoadingFooterActions] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [protectedVideoPlaybackUrl, setProtectedVideoPlaybackUrl] = useState<string | null>(null);
    const [isLoadingProtectedVideo, setIsLoadingProtectedVideo] = useState(false);
    useEffect(() => {
        async function loadActiveLesson() {
            if (!lessonId)
                return;
            try {
                const [{ data, error }, footerActionsResult] = await Promise.all([
                    supabase
                        .from('lessons')
                        .select('*')
                        .eq('id', lessonId)
                        .single(),
                    fetchLessonFooterActions(lessonId),
                ]);
                if (!error && data) {
                    setActiveLessonDetails(data);
                }
                setFooterActions(footerActionsResult.filter((action) => action.is_active));
            }
            catch (err) {
                console.error('Erro ao buscar detalhes da aula:', err);
            }
        }
        void loadActiveLesson();
        window.scrollTo(0, 0);
    }, [lessonId]);
    let currentLesson: StudentLessonWithProgress | null = null;
    const timeline: {
        moduleId: string;
        lessonId?: string;
        assessmentId?: string;
        type: 'lesson' | 'quiz';
        isBlocked: boolean;
        title: string;
        is_completed: boolean;
    }[] = [];
    for (const module of modules) {
        for (const lesson of module.lessons) {
            timeline.push({
                moduleId: module.id,
                lessonId: lesson.id,
                type: 'lesson',
                isBlocked: module.state === 'blocked' || module.state === 'blocked_by_schedule',
                title: lesson.title,
                is_completed: lesson.is_completed,
            });
            if (lesson.id === lessonId) {
                currentLesson = lesson;
            }
        }
    }
    const currentIndex = timeline.findIndex((item) => item.lessonId === lessonId);
    const prevItem = currentIndex > 0 ? timeline[currentIndex - 1] : null;
    const nextItem = currentIndex < timeline.length - 1 ? timeline[currentIndex + 1] : null;
    const currentModule = currentLesson
        ? modules.find((module) => module.id === currentLesson.module_id) ?? null
        : null;
    const isLastLessonOfModule = Boolean(currentModule &&
        currentModule.lessons[currentModule.lessons.length - 1]?.id === currentLesson?.id);
    const nextModuleQuiz = currentModule
        ? (assessments
            .filter((assessment) => assessment.assessment_type === 'module' && assessment.module_id === currentModule.id)
            .sort((assessmentA, assessmentB) => assessmentA.title.localeCompare(assessmentB.title, 'pt-BR'))
            .at(0) ?? null)
        : null;
    const nextAction = isLastLessonOfModule && nextModuleQuiz
        ? {
            label: "Ir para o Quiz do Mdulo",
            disabled: false,
            onClick: () => navigate(`/aluno/cursos/${courseId}/player/avaliacoes/${nextModuleQuiz.assessment_id}`),
        }
        : {
            label: 'Proxima Aula',
            disabled: !nextItem || nextItem.isBlocked,
            onClick: () => navigate(`/aluno/cursos/${courseId}/player/aulas/${nextItem!.lessonId}`),
        };
    if (!currentLesson) {
        return (<div className="flex flex-col items-center justify-center p-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[32px] bg-slate-100 text-slate-400">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900">Aula n?o encontrada</h2>
        <p className="mt-2 text-slate-500">O contedo solicitado pode ter sido movido, expirado ou ainda n?o foi liberado.</p>
        <Button onClick={() => navigate(`/aluno/cursos/${courseId}`)} className="mt-8 rounded-2xl">
          Voltar ao curso
        </Button>
      </div>);
    }
    const videoUrl = activeLessonDetails?.youtube_url || currentLesson.youtube_url;
    const textContent = activeLessonDetails?.text_content || currentLesson.text_content;
    const lessonType = activeLessonDetails?.lesson_type || currentLesson.lesson_type;
    const videoSource = getLessonVideoSource(videoUrl);
    useEffect(() => {
        async function resolveProtectedVideoUrl() {
            if (!lessonId || videoSource?.type !== 'asset') {
                setProtectedVideoPlaybackUrl(null);
                setIsLoadingProtectedVideo(false);
                return;
            }
            const materialId = videoUrl?.startsWith('asset:')
                ? videoUrl.slice('asset:'.length).trim()
                : '';
            if (!materialId) {
                setProtectedVideoPlaybackUrl(null);
                setIsLoadingProtectedVideo(false);
                return;
            }
            setIsLoadingProtectedVideo(true);
            try {
                const lessonMaterials = await fetchMaterials(lessonId);
                const linkedMaterial = lessonMaterials.find((material) => material.id === materialId);
                if (!linkedMaterial?.storage_path) {
                    setProtectedVideoPlaybackUrl(null);
                    return;
                }
                const signedUrl = await getSignedMaterialUrl(linkedMaterial.storage_path, 60 * 60 * 6);
                setProtectedVideoPlaybackUrl(signedUrl);
            }
            catch {
                setProtectedVideoPlaybackUrl(null);
            }
            finally {
                setIsLoadingProtectedVideo(false);
            }
        }
        void resolveProtectedVideoUrl();
    }, [lessonId, videoSource?.type, videoUrl]);
    async function handleToggleCompletion() {
        if (!user || !currentLesson)
            return;
        setIsTogglingCompletion(true);
        try {
            await setLessonCompletion({
                user_id: user.id,
                lesson_id: currentLesson.id,
                is_completed: !currentLesson.is_completed,
            });
            const refreshedModules = await fetchStudentCourseContentWithProgress(courseId!);
            setModules(refreshedModules);
        }
        catch (err) {
            alert(toErrorMessage(err));
        }
        finally {
            setIsTogglingCompletion(false);
        }
    }
    async function handleOpenFooterAction(action: LessonFooterAction) {
        setIsLoadingFooterActions(true);
        try {
            if (action.action_type === 'url' && action.url) {
                window.open(action.url, '_blank', 'noopener,noreferrer');
                return;
            }
            if (action.storage_path) {
                const signedUrl = await getSignedLessonFooterActionUrl(action.storage_path);
                window.open(signedUrl, '_blank', 'noopener,noreferrer');
            }
        }
        catch (err) {
            alert(toErrorMessage(err));
        }
        finally {
            setIsLoadingFooterActions(false);
        }
    }
    async function handleDownloadModulePdf() {
        if (!currentModule)
            return;
        setIsGeneratingPdf(true);
        try {
            if (currentModule.module_pdf_storage_path) {
                await exportLicensedModulePdf(currentModule.title, currentModule.module_pdf_storage_path);
            }
            else {
                await exportModuleToPdf(course.title, currentModule.title, currentModule.id);
            }
        }
        catch (err) {
            alert(toErrorMessage(err));
        }
        finally {
            setIsGeneratingPdf(false);
        }
    }
    return (<div className="mx-auto max-w-[1440px] animate-in fade-in space-y-8 p-4 pb-32 duration-500 sm:p-8">
      <div className="space-y-4 border-b border-slate-100 pb-8 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
              Aula Atual
            </span>
            {lessonType === 'hybrid' && (<span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Video + Texto
              </span>)}
          </div>

          {currentModule ? (<Button type="button" variant="outline" disabled={isGeneratingPdf} onClick={() => void handleDownloadModulePdf()} className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900">
              {isGeneratingPdf ? 'Gerando PDF...' : "Baixar PDF do Mdulo"}
            </Button>) : null}
        </div>

        <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
          {currentLesson.title}
        </h1>

        {(activeLessonDetails?.description || currentLesson.description) && (<div className="max-w-5xl text-lg font-medium leading-relaxed text-slate-500">
            {activeLessonDetails?.description || currentLesson.description}
          </div>)}
      </div>

      {(lessonType === 'video' || lessonType === 'hybrid') && videoSource?.type === 'youtube' && (<div className="mx-auto aspect-video w-[70%] animate-in zoom-in-95 overflow-hidden rounded-[32px] bg-black shadow-2xl ring-1 ring-slate-900/10 duration-500">
          <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${videoSource.value}rel=0&modestbranding=1&showinfo=0`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
        </div>)}

      {(lessonType === 'video' || lessonType === 'hybrid') && videoSource?.type === 'direct' && (<div className="mx-auto aspect-video w-[70%] animate-in zoom-in-95 overflow-hidden rounded-[32px] bg-black shadow-2xl ring-1 ring-slate-900/10 duration-500">
          <video className="h-full w-full" controls preload="metadata" src={videoSource.value}>Seu navegador n?o suporta reproduo de video.
          </video>
        </div>)}

      {(lessonType === 'video' || lessonType === 'hybrid') && videoSource?.type === 'asset' && isLoadingProtectedVideo && (<div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-700">
          <p className="text-sm font-semibold">Carregando video protegido...</p>
        </div>)}

      {(lessonType === 'video' || lessonType === 'hybrid') && videoSource?.type === 'asset' && !isLoadingProtectedVideo && protectedVideoPlaybackUrl && (<div className="mx-auto aspect-video w-[70%] animate-in zoom-in-95 overflow-hidden rounded-[32px] bg-black shadow-2xl ring-1 ring-slate-900/10 duration-500">
          <video className="h-full w-full" controls preload="metadata" src={protectedVideoPlaybackUrl}>Seu navegador n?o suporta reproduo de video.
          </video>
        </div>)}

      {(lessonType === 'video' || lessonType === 'hybrid') && videoSource?.type === 'asset' && !isLoadingProtectedVideo && !protectedVideoPlaybackUrl && (<div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-sm font-semibold">N?o foi possvel carregar o video protegido dest? aula. Tente novamente em instantes.
          </p>
        </div>)}

      {(lessonType === 'text' || lessonType === 'hybrid') && textContent && (<div className="space-y-6">
          <LessonAudioPlayer lessonId={currentLesson.id}/>

          <div className="w-full animate-in slide-in-from-bottom-4 overflow-hidden rounded-[40px] border border-slate-100 bg-white shadow-sm duration-700">
            <div className="p-8 sm:p-12 xl:p-16">
              <ContentBlocksRenderer blocks={splitContent(textContent)} className="lesson-content-html min-h-[100px]"/>
            </div>
          </div>
        </div>)}

      {lessonType === 'file' && !textContent && (<div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-sm font-semibold">Esta aula e consumida pelos materiais do m?dulo. Use a secao "Botoes e Recursos" abaixo para acessar os ficheiros.
          </p>
        </div>)}

      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
              Botoes e Recursos
            </span>
            <span className="text-xs font-medium text-slate-500">Arquivos e links extras dest? aula
            </span>
          </div>
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          {footerActions.length === 0 ? (<div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-500">Nenhum recurso adicional configurado para est? aula.
              </p>
            </div>) : (<div className="flex flex-wrap gap-3">
              {footerActions.map((action) => (<Button key={action.id} type="button" variant="outline" disabled={isLoadingFooterActions} onClick={() => void handleOpenFooterAction(action)} className={getLessonFooterButtonClassName(action.template)}>
                  {renderButtonTemplateIcon(getLessonFooterActionIconName(action))}
                  {action.label ?? action.file_name ?? action.template?.default_label ?? 'Recurso'}
                </Button>))}
            </div>)}
        </div>
      </div>

      {user ? (<LessonNotesPanel lessonId={currentLesson.id} userId={user.id}/>) : null}

      <div className="sticky bottom-4 z-20 mt-12 flex flex-col gap-4 rounded-[32px] border-t border-slate-200 bg-white/80 p-6 pt-8 shadow-xl shadow-slate-200/50 backdrop-blur-md">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={isTogglingCompletion} onClick={handleToggleCompletion} className={`flex items-center gap-2 rounded-xl px-6 py-3 font-bold transition-all ${currentLesson.is_completed
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700'}`}>
              {isTogglingCompletion ? (<svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>) : currentLesson.is_completed ? (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>) : (<svg className="h-5 w-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>)}
              {currentLesson.is_completed ? 'Aula Concluida' : 'Marcar como Concluida'}
            </button>

            {footerActions.map((action) => (<Button key={action.id} variant="outline" onClick={() => void handleOpenFooterAction(action)} className={getLessonFooterButtonClassName(action.template)}>
                {renderButtonTemplateIcon(getLessonFooterActionIconName(action))}
                {action.label ?? action.file_name ?? action.template?.default_label ?? 'Abrir'}
              </Button>))}
          </div>

          <div className="flex w-full items-center gap-3 xl:w-auto">
            <Button variant="outline" disabled={!prevItem || prevItem.isBlocked} onClick={() => navigate(`/aluno/cursos/${courseId}/player/aulas/${prevItem!.lessonId}`)} className="h-12 flex-1 rounded-xl sm:flex-none">
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              Anterior
            </Button>
            <Button className="h-12 flex-1 rounded-xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800 sm:flex-none" disabled={nextAction.disabled} onClick={nextAction.onClick}>
              {nextAction.label}
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>);
}
