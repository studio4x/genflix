import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, CirclePlay, Play } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ContentBlocksRenderer } from '@/features/admin/content/content-blocks-renderer';
import { splitContent } from '@/features/admin/content/content-blocks';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { genflixNavLinks } from '@/features/public/genflix-site-content';
import { fetchPublicCourseDetailFromSupabase, fetchPublicCourseFreePreviewFromSupabase, type PublicCourseFreePreviewLesson, type PublicCourseFreePreviewModule, } from '@/features/public/genflix-public-content-api';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { cn } from '@/lib/utils';

function getLessonVideoSource(url: string | null): {
    type: 'youtube';
    value: string;
} | {
    type: 'direct';
    value: string;
} | null {
    if (!url) {
        return null;
    }
    const trimmed = url.trim();
    if (!trimmed) {
        return null;
    }
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    if (match && match[2].length === 11) {
        return { type: 'youtube', value: match[2] };
    }
    const isDirectVideo = /^https?:\/\/[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?$/i.test(trimmed);
    if (isDirectVideo) {
        return { type: 'direct', value: trimmed };
    }
    return null;
}

function FreeLessonPlayer({ lesson }: { lesson: PublicCourseFreePreviewLesson }) {
    const videoSource = getLessonVideoSource(lesson.youtubeUrl);
    return (
        <article className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
            <div className="border-b border-[#D8E6EB] px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">
                    <CirclePlay className="h-4 w-4" />
                    Aula gratuita
                </div>
                <h1 className="mt-3 text-[2rem] font-extrabold leading-[0.96] tracking-[-0.04em] text-[#183139]">
                    {lesson.title}
                </h1>
                {lesson.description ? <p className="mt-3 text-sm leading-7 text-[#5f7178]">{lesson.description}</p> : null}
            </div>

            <div className="bg-[#10242b]">
                <div className="aspect-video w-full">
                    {videoSource ? (
                        videoSource.type === 'youtube' ? (
                            <iframe
                                title={lesson.title}
                                src={`https://www.youtube.com/embed/${videoSource.value}`}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        ) : (
                            <video src={videoSource.value} controls playsInline className="h-full w-full object-contain bg-black" />
                        )
                    ) : (
                        <div className="flex h-full w-full items-center justify-center px-8 text-center text-white/80">
                            <div>
                                <Play className="mx-auto h-10 w-10 text-white/70" />
                                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em]">Video indisponivel nesta aula</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-5">
                {lesson.textContent ? (
                    <ContentBlocksRenderer blocks={splitContent(lesson.textContent)} className="lesson-content-html min-h-[100px]" />
                ) : (
                    <p className="text-sm leading-7 text-[#5f7178]">Esta aula gratuita não possui conteúdo textual adicional.</p>
                )}
            </div>
        </article>
    );
}

function PreviewSidebar({ modules, currentLessonId, onLessonClick, openModuleIndex, setOpenModuleIndex, }: {
    modules: PublicCourseFreePreviewModule[];
    currentLessonId: string | null;
    onLessonClick: (lessonId: string) => void;
    openModuleIndex: number;
    setOpenModuleIndex: Dispatch<SetStateAction<number>>;
}) {
    return (
        <aside className="space-y-4">
            <div className="rounded-[26px] border border-[#D8E6EB] bg-white p-5 shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">Preview gratuito</p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-[#183139]">Aulas liberadas</h2>
                <p className="mt-2 text-sm leading-7 text-[#5f7178]">Somente aulas marcadas como gratuitas aparecem aqui. Não há progresso, notas ou recursos pagos nesta visão.</p>
            </div>

            <div className="space-y-3">
                {modules.length ? modules.map((module, moduleIndex) => {
                    const isOpen = openModuleIndex === moduleIndex;
                    return (
                        <article key={module.id} className="overflow-hidden rounded-[22px] border border-[#D8E6EB] bg-white shadow-[0_12px_24px_rgba(21,50,59,0.03)]">
                            <button
                                type="button"
                                onClick={() => setOpenModuleIndex(isOpen ? -1 : moduleIndex)}
                                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                            >
                                <div>
                                    <p className="text-sm font-bold text-[#183139]">{module.title}</p>
                                    {module.description ? <p className="mt-1 text-xs leading-5 text-[#6a7b81]">{module.description}</p> : null}
                                </div>
                                <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#1398B7] transition-transform', isOpen ? 'rotate-180' : '')} />
                            </button>

                            {isOpen ? (
                                <div className="border-t border-[#D8E6EB] p-3">
                                    <div className="space-y-2">
                                        {module.lessons.map((lesson, lessonIndex) => {
                                            const isActive = lesson.id === currentLessonId;
                                            return (
                                                <button
                                                    key={lesson.id}
                                                    type="button"
                                                    onClick={() => onLessonClick(lesson.id)}
                                                    className={cn(
                                                        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition',
                                                        isActive ? 'border-[#1398B7] bg-[#E8F6FA]' : 'border-[#D8E6EB] bg-[#F8FCFD] hover:border-[#1398B7]/40',
                                                    )}
                                                >
                                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1398B7] text-[11px] font-black text-white">
                                                        {lessonIndex + 1}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-bold text-[#183139]">{lesson.title}</span>
                                                        <span className="mt-1 block text-xs leading-5 text-[#6a7b81]">
                                                            {lesson.estimatedMinutes > 0 ? `${lesson.estimatedMinutes} min` : 'Aula gratuita'}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                        </article>
                    );
                }) : (
                    <div className="rounded-[22px] border border-dashed border-[#D8E6EB] bg-white px-4 py-6 text-sm leading-7 text-[#5f7178]">
                        Ainda não existem aulas marcadas como gratuitas neste curso.
                    </div>
                )}
            </div>
        </aside>
    );
}

export function PublicCoursePreviewPage() {
    const { slug = '', lessonId = '' } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState<Awaited<ReturnType<typeof fetchPublicCourseDetailFromSupabase>> | null>(null);
    const [preview, setPreview] = useState<Awaited<ReturnType<typeof fetchPublicCourseFreePreviewFromSupabase>> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openModuleIndex, setOpenModuleIndex] = useState(0);

    useEffect(() => {
        let isMounted = true;
        async function loadPreview() {
            setIsLoading(true);
            setError(null);
            try {
                const [courseDetail, freePreview] = await Promise.all([
                    fetchPublicCourseDetailFromSupabase(slug),
                    fetchPublicCourseFreePreviewFromSupabase(slug),
                ]);
                if (!isMounted) {
                    return;
                }
                setCourse(courseDetail);
                setPreview(freePreview);
            }
            catch (loadError) {
                if (isMounted) {
                    setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a prévia gratuita.');
                }
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        void loadPreview();
        return () => {
            isMounted = false;
        };
    }, [slug]);

    const requestedLesson = useMemo(() => {
        if (!preview) {
            return null;
        }
        for (const module of preview.modules) {
            const match = module.lessons.find((lesson) => lesson.id === lessonId);
            if (match) {
                return match;
            }
        }
        return null;
    }, [lessonId, preview]);
    const currentLesson = requestedLesson ?? preview?.modules[0]?.lessons[0] ?? null;

    useEffect(() => {
        if (!preview) {
            return;
        }
        if (!preview.firstFreeLessonId) {
            return;
        }
        if (!lessonId || !requestedLesson) {
            navigate(`/cursos/${slug}/preview/aulas/${preview.firstFreeLessonId}`, { replace: true });
        }
    }, [lessonId, navigate, preview, requestedLesson, slug]);

    useEffect(() => {
        if (!preview || !currentLesson) {
            return;
        }
        setOpenModuleIndex((current) => {
            const moduleIndex = preview.modules.findIndex((module) => module.lessons.some((lesson) => lesson.id === currentLesson.id));
            return moduleIndex >= 0 ? moduleIndex : current;
        });
    }, [currentLesson, preview]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
                <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando prévia gratuita...</p>
            </main>
        );
    }

    if (error || !course || !preview) {
        return <Navigate to={`/cursos/${slug}`} replace />;
    }

    if (!preview.firstFreeLessonId || !currentLesson) {
        return (
            <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
                <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />
                <section className="public-site-container py-16">
                    <div className="rounded-[28px] border border-[#D8E6EB] bg-white p-8 shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Prévia gratuita</p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#183139]">Nenhuma aula gratuita disponível</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5f7178]">
                            Este curso ainda não tem aulas marcadas como gratuitas no builder. Volte para a página do curso e escolha outra opção.
                        </p>
                        <div className="mt-6">
                            <GenflixCtaButton asChild>
                                <Link to={`/cursos/${slug}`}>Voltar para o curso</Link>
                            </GenflixCtaButton>
                        </div>
                    </div>
                </section>
                <GenflixPublicFooter />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
            <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />
            <section className="bg-white pb-16 pt-4">
                <div className="public-site-container">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                        <div>
                            <Link to={`/cursos/${slug}`} className="text-xs font-black uppercase tracking-[0.24em] text-[#1398B7] hover:text-[#0A3640]">
                                Voltar para o curso
                            </Link>
                            <h1 className="mt-4 max-w-[760px] text-[2.4rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.9rem]">
                                {course.title}
                            </h1>
                            <p className="mt-4 max-w-[760px] text-base leading-7 text-[#5f7178]">
                                Experimente a primeira aula gratuita antes de comprar. O preview mostra apenas o conteúdo liberado.
                            </p>

                            <div className="mt-8">
                                <FreeLessonPlayer lesson={currentLesson} />
                            </div>
                        </div>

                        <PreviewSidebar
                            modules={preview.modules}
                            currentLessonId={currentLesson.id}
                            onLessonClick={(nextLessonId) => navigate(`/cursos/${slug}/preview/aulas/${nextLessonId}`)}
                            openModuleIndex={openModuleIndex}
                            setOpenModuleIndex={setOpenModuleIndex}
                        />
                    </div>
                </div>
            </section>
            <GenflixPublicFooter />
        </main>
    );
}
