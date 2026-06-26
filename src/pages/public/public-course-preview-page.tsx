import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, CirclePlay, Lock, Play } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CourseCoverMedia } from '@/components/public/course-cover-media';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { ContentBlocksRenderer } from '@/features/admin/content/content-blocks-renderer';
import { splitContent } from '@/features/admin/content/content-blocks';
import { fetchPublicCourseDetailFromSupabase, fetchPublicCoursePlayerViewFromSupabase, type PublicCoursePlayerLesson, type PublicCoursePlayerModule, type PublicCoursePlayerView, } from '@/features/public/genflix-public-content-api';
import { genflixNavLinks } from '@/features/public/genflix-site-content';
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

function getLessonTypeLabel(lessonType: PublicCoursePlayerLesson['lessonType']) {
    switch (lessonType) {
        case 'text':
            return 'Texto';
        case 'hybrid':
            return 'Video + Texto';
        case 'file':
            return 'Arquivo';
        default:
            return 'Video';
    }
}

function countAccessibleLessons(module: PublicCoursePlayerModule) {
    return module.lessons.filter((lesson) => lesson.isUnlocked).length;
}

function PublicLessonViewer({ lesson, courseTitle }: { lesson: PublicCoursePlayerLesson; courseTitle: string; }) {
    const videoSource = getLessonVideoSource(lesson.youtubeUrl);
    const typeLabel = getLessonTypeLabel(lesson.lessonType);

    if (!lesson.isUnlocked) {
        return (
            <article className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <div className="border-b border-[#D8E6EB] px-5 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">
                        <Lock className="h-4 w-4" />
                        Aula bloqueada
                    </div>
                    <h2 className="mt-3 text-[2rem] font-extrabold leading-[0.96] tracking-[-0.04em] text-[#183139]">
                        {lesson.title}
                    </h2>
                    {lesson.description ? <p className="mt-3 text-sm leading-7 text-[#5f7178]">{lesson.description}</p> : null}
                </div>

                <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                    <div className="rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-5 py-7">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F6FA] text-[#1398B7]">
                            <Lock className="h-7 w-7" />
                        </div>
                        <p className="mt-4 text-center text-sm font-black uppercase tracking-[0.22em] text-[#1398B7]">
                            Conteudo restrito
                        </p>
                        <p className="mt-3 text-center text-sm leading-7 text-[#5f7178]">
                            Esta aula aparece na estrutura do curso, mas fica bloqueada no preview publico. Somente aulas gratuitas ou liberadas podem ser abertas sem acesso adquirido.
                        </p>
                    </div>

                    <div className="rounded-[24px] bg-[#10242b] p-5 text-white">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/60">
                            {courseTitle}
                        </p>
                        <h3 className="mt-2 text-xl font-black tracking-tight">
                            {lesson.title}
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                            <span className="rounded-full bg-white/10 px-3 py-1 text-white/90">
                                {typeLabel}
                            </span>
                            {lesson.isFreePreview ? (
                                <span className="rounded-full bg-[#1398B7] px-3 py-1 text-white">
                                    Acesso livre
                                </span>
                            ) : (
                                <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">
                                    Liberacao futura
                                </span>
                            )}
                        </div>
                        <p className="mt-4 text-sm leading-7 text-white/72">
                            Use a estrutura ao lado para ver como o curso fica depois da compra. As aulas bloqueadas continuam visiveis, mas sem abertura do conteudo.
                        </p>
                    </div>
                </div>
            </article>
        );
    }

    return (
        <article className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
            <div className="border-b border-[#D8E6EB] px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">
                    <CirclePlay className="h-4 w-4" />
                    Aula liberada
                </div>
                <h2 className="mt-3 text-[2rem] font-extrabold leading-[0.96] tracking-[-0.04em] text-[#183139]">
                    {lesson.title}
                </h2>
                {lesson.description ? <p className="mt-3 text-sm leading-7 text-[#5f7178]">{lesson.description}</p> : null}
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                    {lesson.lessonType === 'video' || lesson.lessonType === 'hybrid' ? (
                        <div className="overflow-hidden rounded-[24px] bg-[#10242b]">
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
                    ) : (
                        <div className="rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-5 py-7">
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
                                {lesson.lessonType === 'text' ? 'Aula em texto' : 'Aula em arquivo'}
                            </p>
                            <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                                {lesson.lessonType === 'text'
                                    ? 'Este conteudo libera a leitura direta sem player de video.'
                                    : 'Este conteudo usa os materiais do modulo para a experiencia completa.'}
                            </p>
                        </div>
                    )}

                    {lesson.lessonType === 'text' || lesson.lessonType === 'hybrid' ? (
                        lesson.textContent ? (
                            <ContentBlocksRenderer blocks={splitContent(lesson.textContent)} className="lesson-content-html min-h-[100px]" />
                        ) : (
                            <div className="rounded-[22px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-5 py-6 text-sm leading-7 text-[#5f7178]">
                                Esta aula nao possui conteudo textual adicional.
                            </div>
                        )
                    ) : (
                        <div className="rounded-[22px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-5 py-6 text-sm leading-7 text-[#5f7178]">
                            {lesson.lessonType === 'file'
                                ? 'Esta aula e consumida pelos materiais do curso e fica disponivel para alunos com acesso ativo.'
                                : 'A aula fica liberada quando o conteudo estiver pronto para o preview publico.'}
                        </div>
                    )}
                </div>

                <aside className="rounded-[24px] bg-[#F8FCFD] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Resumo da aula</p>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-[#183139]">
                        {lesson.title}
                    </h3>
                    <div className="mt-4 space-y-3 text-sm text-[#5f7178]">
                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                            <span className="font-semibold text-[#183139]">Tipo</span>
                            <span className="font-bold text-[#1398B7]">{typeLabel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                            <span className="font-semibold text-[#183139]">Duracao</span>
                            <span className="font-bold text-[#1398B7]">
                                {lesson.estimatedMinutes > 0 ? `${lesson.estimatedMinutes} min` : 'Sem duracao informada'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                            <span className="font-semibold text-[#183139]">Acesso</span>
                            <span className="font-bold text-emerald-600">Liberado</span>
                        </div>
                    </div>
                </aside>
            </div>
        </article>
    );
}

function LockedCourseCallout({
    courseTitle,
    lesson,
    slug,
    firstAccessibleLessonId,
}: {
    courseTitle: string;
    lesson: PublicCoursePlayerLesson;
    slug: string;
    firstAccessibleLessonId: string | null;
}) {
    return (
        <div className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">
                <Lock className="h-4 w-4" />
                Aula bloqueada
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#183139]">
                {lesson.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f7178]">
                O preview publico mostra a mesma estrutura do player do aluno, mas apenas as aulas gratuitas ou liberadas podem ser abertas.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
                {firstAccessibleLessonId ? (
                    <GenflixCtaButton asChild>
                        <Link to={`/cursos/${slug}/preview/aulas/${firstAccessibleLessonId}`}>Ir para a primeira aula liberada</Link>
                    </GenflixCtaButton>
                ) : null}
                <GenflixCtaButton asChild tone="surface">
                    <Link to={`/checkout/pagamento/${slug}`}>Comprar acesso ao curso</Link>
                </GenflixCtaButton>
                <GenflixCtaButton asChild tone="ghost">
                    <Link to={`/cursos/${slug}`}>Voltar aos detalhes</Link>
                </GenflixCtaButton>
            </div>

            <div className="mt-6 grid gap-4 rounded-[24px] bg-[#F8FCFD] p-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">{courseTitle}</p>
                    <p className="mt-2 text-sm leading-7 text-[#5f7178]">
                        A aula selecionada segue visivel na navegacao, mas o conteudo interno continua protegido ate o acesso ser liberado.
                    </p>
                </div>
                <div className="rounded-[20px] bg-[#10242b] px-4 py-4 text-white">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/60">Status</p>
                    <p className="mt-2 text-lg font-black">Bloqueada</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                        Sem acesso ao player completo.
                    </p>
                </div>
            </div>
        </div>
    );
}

function PreviewSidebar({
    modules,
    currentLessonId,
    onLessonClick,
    openModuleIndex,
    setOpenModuleIndex,
}: {
    modules: PublicCoursePlayerModule[];
    currentLessonId: string | null;
    onLessonClick: (lessonId: string) => void;
    openModuleIndex: number;
    setOpenModuleIndex: Dispatch<SetStateAction<number>>;
}) {
    return (
        <aside className="space-y-4">
            <div className="rounded-[26px] border border-[#D8E6EB] bg-white p-5 shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">Visualizacao do curso</p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-[#183139]">Aulas liberadas e bloqueadas</h2>
                <p className="mt-2 text-sm leading-7 text-[#5f7178]">
                    O preview exibe toda a trilha. As aulas gratuitas ou liberadas podem ser abertas; as demais ficam com cadeado.
                </p>
            </div>

            <div className="space-y-3">
                {modules.length ? modules.map((module, moduleIndex) => {
                    const isOpen = openModuleIndex === moduleIndex;
                    const accessibleLessons = countAccessibleLessons(module);
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
                                <div className="flex items-center gap-3">
                                    <span className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[11px] font-black text-[#1398B7]">
                                        {accessibleLessons}/{module.lessons.length || 0} liberadas
                                    </span>
                                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#1398B7] transition-transform', isOpen ? 'rotate-180' : '')} />
                                </div>
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
                                                    onClick={() => {
                                                        if (lesson.isUnlocked) {
                                                            onLessonClick(lesson.id);
                                                        }
                                                    }}
                                                    disabled={!lesson.isUnlocked}
                                                    aria-disabled={!lesson.isUnlocked}
                                                    className={cn(
                                                        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition',
                                                        lesson.isUnlocked
                                                            ? isActive
                                                                ? 'border-[#1398B7] bg-[#E8F6FA]'
                                                                : 'border-[#D8E6EB] bg-[#F8FCFD] hover:border-[#1398B7]/40'
                                                            : 'cursor-not-allowed border-dashed border-[#D8E6EB] bg-[#F8FCFD] opacity-80',
                                                    )}
                                                >
                                                    <span className={cn(
                                                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                                                        lesson.isUnlocked ? 'bg-[#1398B7] text-white' : 'bg-white text-[#A6B5BA] ring-1 ring-[#D8E6EB]',
                                                    )}>
                                                        {lesson.isUnlocked ? lessonIndex + 1 : <Lock className="h-4 w-4" />}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-bold text-[#183139]">{lesson.title}</span>
                                                        <span className="mt-1 block text-xs leading-5 text-[#6a7b81]">
                                                            {lesson.isUnlocked
                                                                ? `${lesson.estimatedMinutes > 0 ? `${lesson.estimatedMinutes} min` : 'Aula liberada'}`
                                                                : 'Aula bloqueada'}
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
                        Ainda nao existem aulas publicas disponiveis neste curso.
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
    const [player, setPlayer] = useState<PublicCoursePlayerView | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openModuleIndex, setOpenModuleIndex] = useState(0);

    useEffect(() => {
        let isMounted = true;
        async function loadPreview() {
            setIsLoading(true);
            setError(null);
            try {
                const [courseDetail, playerView] = await Promise.all([
                    fetchPublicCourseDetailFromSupabase(slug),
                    fetchPublicCoursePlayerViewFromSupabase(slug),
                ]);
                if (!isMounted) {
                    return;
                }
                setCourse(courseDetail);
                setPlayer(playerView);
            }
            catch (loadError) {
                if (isMounted) {
                    setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar a visualizacao do curso.');
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
        if (!player) {
            return null;
        }
        for (const module of player.modules) {
            const match = module.lessons.find((lesson) => lesson.id === lessonId);
            if (match) {
                return match;
            }
        }
        return null;
    }, [lessonId, player]);

    const fallbackLesson = useMemo(() => {
        if (!player) {
            return null;
        }
        const accessibleLesson = player.modules.flatMap((module) => module.lessons).find((lesson) => lesson.isUnlocked) ?? null;
        if (accessibleLesson) {
            return accessibleLesson;
        }
        return player.modules[0]?.lessons[0] ?? null;
    }, [player]);

    const currentLesson = requestedLesson ?? fallbackLesson;
    const currentModule = useMemo(() => {
        if (!player || !currentLesson) {
            return null;
        }
        for (const module of player.modules) {
            if (module.lessons.some((lesson) => lesson.id === currentLesson.id)) {
                return module;
            }
        }
        return null;
    }, [currentLesson, player]);

    useEffect(() => {
        if (!player) {
            return;
        }
        const targetLessonId = player.firstAccessibleLessonId ?? player.firstLessonId;
        if (!targetLessonId) {
            return;
        }
        if (lessonId && requestedLesson) {
            return;
        }
        if (lessonId === targetLessonId) {
            return;
        }
        navigate(`/cursos/${slug}/preview/aulas/${targetLessonId}`, { replace: true });
    }, [lessonId, navigate, player, requestedLesson, slug]);

    useEffect(() => {
        if (!player || !currentLesson) {
            return;
        }
        setOpenModuleIndex((current) => {
            const moduleIndex = player.modules.findIndex((module) => module.lessons.some((lesson) => lesson.id === currentLesson.id));
            return moduleIndex >= 0 ? moduleIndex : current;
        });
    }, [currentLesson, player]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
                <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando visualizacao...</p>
            </main>
        );
    }

    if (error || !course || !player) {
        return <Navigate to={`/cursos/${slug}`} replace />;
    }

    const isCurrentLessonAccessible = currentLesson?.isUnlocked ?? false;
    const totalLessons = player.modules.reduce((sum, module) => sum + module.lessons.length, 0);
    const accessibleLessons = player.modules.reduce((sum, module) => sum + countAccessibleLessons(module), 0);

    return (
        <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
            <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />

            <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0D728E_0%,#0B667F_100%)] text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
                <div className="public-site-container relative py-10 lg:py-14">
                    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:gap-12">
                        <div className="min-w-0">
                            <p className="inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white/82">
                                Visualizacao publica do curso
                            </p>
                            <h1 className="mt-4 max-w-none break-words text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3.1rem] lg:text-[3.4rem] xl:text-[3.7rem]">
                                {course.title}
                            </h1>
                            <p className="mt-4 max-w-[760px] text-base leading-7 text-white/78">
                                Veja a mesma estrutura que o aluno encontra depois da compra. Apenas as aulas gratuitas ou liberadas podem ser abertas neste modo publico.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <GenflixCtaButton asChild tone="surface" className="h-12 px-6 text-[15px] font-bold shadow-none">
                                    <Link to={`/checkout/pagamento/${slug}`}>Comprar agora</Link>
                                </GenflixCtaButton>
                                <Link to={`/cursos/${slug}`} className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/14">
                                    Voltar aos detalhes
                                </Link>
                            </div>

                            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                                <div className="rounded-[20px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">Aulas totais</p>
                                    <p className="mt-2 text-2xl font-black">{totalLessons}</p>
                                </div>
                                <div className="rounded-[20px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">Liberadas</p>
                                    <p className="mt-2 text-2xl font-black">{accessibleLessons}</p>
                                </div>
                                <div className="rounded-[20px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">Bloqueadas</p>
                                    <p className="mt-2 text-2xl font-black">{Math.max(totalLessons - accessibleLessons, 0)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="lg:justify-self-end">
                            <div className="overflow-hidden rounded-[26px] border border-white/16 bg-[#173039] shadow-[0_28px_60px_rgba(5,24,32,0.28)] lg:w-[420px] xl:w-[440px]">
                                <div className="aspect-[16/9]">
                                    <CourseCoverMedia
                                        src={course.coverImage}
                                        videoSrc={course.heroVideoUrl}
                                        alt={course.title}
                                        title={course.title}
                                        category={course.categoryLine}
                                        initials={course.mentor.initials}
                                        className="h-full"
                                        placeholderClassName="p-6"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white pb-16 pt-8">
                <div className="public-site-container">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px]">
                        <div className="space-y-6">
                            <div className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Link to={`/cursos/${slug}`} className="text-xs font-black uppercase tracking-[0.24em] text-[#1398B7] hover:text-[#0A3640]">
                                        Voltar para o curso
                                    </Link>
                                    {currentModule ? (
                                        <span className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">
                                            Modulo {player.modules.findIndex((module) => module.id === currentModule.id) + 1}
                                        </span>
                                    ) : null}
                                </div>
                                <h2 className="mt-4 text-[1.8rem] font-black tracking-[-0.04em] text-[#183139]">
                                    {currentLesson?.title || 'Selecione uma aula no painel ao lado'}
                                </h2>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f7178]">
                                    {currentLesson?.isUnlocked
                                        ? 'O conteudo liberado abre diretamente no player. As demais aulas continuam visiveis, mas bloqueadas.'
                                        : 'A aula selecionada aparece bloqueada. Escolha uma aula liberada ou compre o curso para liberar toda a trilha.'}
                                </p>
                            </div>

                            {currentLesson ? (
                                isCurrentLessonAccessible ? (
                                    <PublicLessonViewer lesson={currentLesson} courseTitle={course.title} />
                                ) : (
                                    <LockedCourseCallout
                                        courseTitle={course.title}
                                        lesson={currentLesson}
                                        slug={slug}
                                        firstAccessibleLessonId={player.firstAccessibleLessonId}
                                    />
                                )
                            ) : (
                                <div className="rounded-[28px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-6 py-10 text-sm leading-7 text-[#5f7178]">
                                    Este curso ainda nao possui aulas publicas disponiveis.
                                </div>
                            )}
                        </div>

                        <PreviewSidebar
                            modules={player.modules}
                            currentLessonId={currentLesson?.id ?? null}
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
