import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronDown, CirclePlay, X } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CourseCoverMedia } from '@/components/public/course-cover-media';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot';
import { fetchSiteContent } from '@/features/site-editor/api';
import { fetchPublicAuthorProfileFromSupabase, fetchPublicCourseDetailFromSupabase, fetchPublicCoursePlayerViewFromSupabase, type PublicAuthorProfile, type PublicCoursePlayerView } from '@/features/public/genflix-public-content-api';
import { genflixNavLinks, type GenflixCourseAuthor, type GenflixCourseDetail } from '@/features/public/genflix-site-content';
import { genflixStudyFeatureCardsFallback, genflixStudyFeatureCardsSchema } from '@/features/public/genflix-study-feature-editor';
import { CourseReviewsSection } from '@/features/reviews/course-reviews-section';
import { fetchGlobalReviewsEnabled } from '@/features/reviews/review-settings';
import { EditableList, isEditableItemVisible } from '@/features/site-editor/visual-editor';
import { normalizeResourcesItems } from '@/features/public/genflix-resource-items-editor';
import { sanitizeRichTextHtml } from '@/features/admin/content/content-blocks';
import type { EditableListItem } from '@/features/site-editor/types';
import { dispatchSiteViewItemEvent } from '@/features/site-editor/site-tracking';
import { renderSiteIconVisual } from '@/features/site-editor/site-icons';
import { resolveStudyFeatureIconKey } from '@/features/public/genflix-study-feature-editor';
import { cn } from '@/lib/utils';

function parsePriceLabelToNumber(priceLabel: string) {
  const normalized = priceLabel.replace(/\s+/g, '').replace(/[R$]/gi, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function ResourceSaibaMaisLink({ href, className }: { href: string; className: string; }) {
  const normalizedHref = href.trim() || '/recursos';
  const content = (
    <>
      <span>Saiba mais</span>
      <ArrowRight className="h-3.5 w-3.5" />
    </>
  );

  if (isExternalHref(normalizedHref)) {
    return (
      <a href={normalizedHref} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={normalizedHref} className={className}>
      {content}
    </Link>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderAboutParagraphHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed) ? trimmed : `<p>${escapeHtml(trimmed)}</p>`;

  return sanitizeRichTextHtml(normalizedHtml);
}

function buildFallbackAuthorProfile(author: GenflixCourseAuthor): PublicAuthorProfile {
  return {
    userId: author.authorId,
    publicSlug: author.slug,
    publicTitle: author.title || author.name,
    publicShortBio: author.shortBio,
    publicLongBio: author.longBio || author.shortBio,
    publicAreas: author.areas,
    publicEducation: author.education,
    publicExperience: author.experience,
    publicPhotoUrl: author.photoUrl,
    publicWebsiteUrl: author.websiteUrl,
    publicInstagramUrl: author.instagramUrl,
    publicLinkedinUrl: author.linkedinUrl,
    publicYoutubeUrl: author.youtubeUrl,
    payoutName: author.name,
    fullName: author.name,
    avatarUrl: author.photoUrl,
    courses: [],
  };
}

function AuthorProfileModal({
  author,
  profile,
  isLoading,
  onClose,
}: {
  author: GenflixCourseAuthor;
  profile: PublicAuthorProfile | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const displayProfile = profile ?? buildFallbackAuthorProfile(author);
  const hasSocialLinks = Boolean(
    displayProfile.publicWebsiteUrl ||
      displayProfile.publicInstagramUrl ||
      displayProfile.publicLinkedinUrl ||
      displayProfile.publicYoutubeUrl,
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[#061b21]/72 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="author-profile-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[#F2F8FA] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Perfil público do autor</p>
            <h2 id="author-profile-modal-title" className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
              {displayProfile.publicTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F7077]">
              {isLoading
                ? 'Carregando dados públicos do perfil...'
                : 'Os dados abaixo são os campos públicos configurados para este autor.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] text-[#5F7077] transition-colors hover:bg-white"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <section className="grid gap-6 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <div className="flex justify-center md:justify-start">
                  {displayProfile.publicPhotoUrl ? (
                    <img
                      src={displayProfile.publicPhotoUrl}
                      alt={displayProfile.publicTitle}
                      className="h-36 w-36 rounded-[30px] border border-[#D8E6EB] object-cover shadow-[0_16px_36px_rgba(21,50,59,0.08)]"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-[30px] bg-[#D9F0F5] text-[2rem] font-black uppercase tracking-[0.12em] text-[#0A3640]">
                      {(displayProfile.publicTitle || displayProfile.fullName || 'A').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="inline-flex rounded-full border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-[#1398B7]">
                    Autor GenFlix
                  </p>
                  <h3 className="mt-4 break-words text-[2.2rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-[#183139] sm:text-[2.7rem]">
                    {displayProfile.publicTitle}
                  </h3>
                  {displayProfile.publicShortBio ? (
                    <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f7178]">{displayProfile.publicShortBio}</p>
                  ) : (
                    <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f7178]">
                      Perfil público em construção.
                    </p>
                  )}
                  {displayProfile.publicAreas.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {displayProfile.publicAreas.map((area) => (
                        <span
                          key={area}
                          className="rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0F7E99]"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_16px_40px_rgba(21,50,59,0.05)]">
                <h3 className="text-[1.35rem] font-bold tracking-[-0.03em] text-[#183139]">Sobre o autor</h3>
                <div className="mt-4 space-y-4 text-[15px] leading-8 text-[#5f7178]">
                  {displayProfile.publicLongBio ? (
                    <p>{displayProfile.publicLongBio}</p>
                  ) : displayProfile.publicShortBio ? (
                    <p>{displayProfile.publicShortBio}</p>
                  ) : (
                    <p>Perfil público em construção.</p>
                  )}
                </div>
              </article>

              <div className="grid gap-4 md:grid-cols-2">
                {displayProfile.publicEducation ? (
                  <article className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FCFD] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Formação</p>
                    <p className="mt-3 text-sm leading-7 text-[#5f7178]">{displayProfile.publicEducation}</p>
                  </article>
                ) : null}
                {displayProfile.publicExperience ? (
                  <article className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FCFD] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Experiência</p>
                    <p className="mt-3 text-sm leading-7 text-[#5f7178]">{displayProfile.publicExperience}</p>
                  </article>
                ) : null}
              </div>

              {displayProfile.courses.length ? (
                <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_16px_40px_rgba(21,50,59,0.05)]">
                  <div>
                    <h3 className="text-[1.35rem] font-bold tracking-[-0.03em] text-[#183139]">Cursos vinculados</h3>
                    <p className="mt-1 text-sm leading-6 text-[#6a7b81]">
                      Cursos em que este autor participa como coautor de conteúdo.
                    </p>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {displayProfile.courses.map((course) => (
                      <article key={course.id} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
                        <p className="text-sm font-semibold text-[#183139]">{course.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6a7b81]">{course.category ?? 'Curso'}</p>
                        <Link
                          to={`/cursos/${course.slug}`}
                          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1398B7] transition hover:text-[#0F7E99]"
                        >
                          <span>Abrir curso</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </article>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>

            <aside className="space-y-5">
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_16px_40px_rgba(21,50,59,0.05)]">
                <h3 className="text-[1.35rem] font-bold tracking-[-0.03em] text-[#183139]">Contato e redes</h3>
                <div className="mt-5 space-y-3">
                  {displayProfile.publicWebsiteUrl ? (
                    <a
                      href={displayProfile.publicWebsiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-semibold text-[#183139] transition hover:border-[#1398B7]/40 hover:text-[#0F7E99]"
                    >
                      Website
                    </a>
                  ) : null}
                  {displayProfile.publicInstagramUrl ? (
                    <a
                      href={displayProfile.publicInstagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-semibold text-[#183139] transition hover:border-[#1398B7]/40 hover:text-[#0F7E99]"
                    >
                      Instagram
                    </a>
                  ) : null}
                  {displayProfile.publicLinkedinUrl ? (
                    <a
                      href={displayProfile.publicLinkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-semibold text-[#183139] transition hover:border-[#1398B7]/40 hover:text-[#0F7E99]"
                    >
                      LinkedIn
                    </a>
                  ) : null}
                  {displayProfile.publicYoutubeUrl ? (
                    <a
                      href={displayProfile.publicYoutubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-semibold text-[#183139] transition hover:border-[#1398B7]/40 hover:text-[#0F7E99]"
                    >
                      YouTube
                    </a>
                  ) : null}
                  {!hasSocialLinks ? <p className="text-sm leading-7 text-[#6a7b81]">Nenhuma rede social foi informada ainda.</p> : null}
                </div>
              </article>

              {isLoading ? (
                <article className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FCFD] p-5">
                  <p className="text-sm font-semibold text-[#183139]">Atualizando perfil público</p>
                  <p className="mt-2 text-sm leading-7 text-[#6a7b81]">
                    Estamos carregando os campos configurados no cadastro público do autor.
                  </p>
                </article>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicCourseDetailsPage() {
  const { slug = '' } = useParams();
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(null);
  const [playerView, setPlayerView] = useState<PublicCoursePlayerView | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [openModule, setOpenModule] = useState(0);
  const [resourceCatalog, setResourceCatalog] = useState<EditableListItem[]>([]);
  const [globalReviewsEnabled, setGlobalReviewsEnabled] = useState(true);
  const [activeAuthor, setActiveAuthor] = useState<GenflixCourseAuthor | null>(null);
  const [activeAuthorProfile, setActiveAuthorProfile] = useState<PublicAuthorProfile | null>(null);
  const [isAuthorProfileLoading, setIsAuthorProfileLoading] = useState(false);
  const trackedCourseRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      setIsLoadingDetail(true);
      try {
        const publicDetail = await fetchPublicCourseDetailFromSupabase(slug);
        if (isMounted) {
          setDetail(publicDetail);
        }
      } catch {
        if (isMounted) {
          setDetail(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let isMounted = true;

    async function loadPlayerView() {
      try {
        const publicPlayerView = await fetchPublicCoursePlayerViewFromSupabase(slug);
        if (isMounted) {
          setPlayerView(publicPlayerView);
        }
      } catch {
        if (isMounted) {
          setPlayerView(null);
        }
      }
    }

    void loadPlayerView();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let isMounted = true;

    async function loadGlobalReviewsSetting() {
      try {
        const enabled = await fetchGlobalReviewsEnabled();
        if (isMounted) {
          setGlobalReviewsEnabled(enabled);
        }
      } catch {
        if (isMounted) {
          setGlobalReviewsEnabled(true);
        }
      }
    }

    void loadGlobalReviewsSetting();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!detail) {
      return;
    }

    const courseId = detail.id?.trim() || detail.slug.trim();
    if (!courseId || trackedCourseRef.current === courseId) {
      return;
    }

    trackedCourseRef.current = courseId;
    dispatchSiteViewItemEvent({
      courseId,
      courseTitle: detail.title,
      currency: 'BRL',
      value: parsePriceLabelToNumber(detail.priceLabel),
    });
  }, [detail]);

  useEffect(() => {
    let isMounted = true;

    async function loadResources() {
      try {
        const entries = await fetchSiteContent('resources');
        const resourcesEntry = entries.find((entry) => entry.entry_key === 'resources.items');
        if (isMounted) {
          setResourceCatalog(normalizeResourcesItems(resourcesEntry?.value));
        }
      } catch {
        if (isMounted) {
          setResourceCatalog([]);
        }
      }
    }

    void loadResources();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeAuthor) {
      setActiveAuthorProfile(null);
      setIsAuthorProfileLoading(false);
      return;
    }

    let isMounted = true;
    const authorSlug = activeAuthor.slug;

    async function loadAuthorProfile() {
      setIsAuthorProfileLoading(true);
      try {
        const publicProfile = await fetchPublicAuthorProfileFromSupabase(authorSlug);
        if (isMounted) {
          setActiveAuthorProfile(publicProfile);
        }
      } catch {
        if (isMounted) {
          setActiveAuthorProfile(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthorProfileLoading(false);
        }
      }
    }

    void loadAuthorProfile();

    return () => {
      isMounted = false;
    };
  }, [activeAuthor]);

  const selectedResourceItems = detail?.resourceItemIds?.length
    ? resourceCatalog.filter((item) => detail.resourceItemIds?.includes(item.id))
    : [];

  if (!isLoadingDetail && !detail) {
    return <Navigate to="/cursos" replace />;
  }

  if (!detail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando curso...</p>
      </main>
    );
  }

  const playerEntryHref = detail.id
    ? playerView?.firstAccessibleLessonId
      ? `/aluno/cursos/${detail.id}/player/aulas/${playerView.firstAccessibleLessonId}`
      : `/aluno/cursos/${detail.id}/player`
    : null;
  const freeLessonCtaColors = {
    buttonBackgroundColor: '#f78902',
    buttonTextColor: '#ffffff',
    iconBackgroundColor: 'rgba(255, 255, 255, 0.18)',
    iconTextColor: '#ffffff',
  };
  const courseBenefitsCardTitle = 'O que você recebe';
  const courseInvestmentCardTitle = 'Seu investimento';

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="course-detail" placementKey="hero" />

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0D728E_0%,#0B667F_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
        <div className="public-site-container relative py-10 lg:py-14">
          <div className="grid items-center gap-8 lg:grid-cols-[170px_minmax(0,1.35fr)_420px] lg:gap-12 xl:grid-cols-[180px_minmax(0,1.45fr)_440px]">
            <div className="flex justify-center lg:justify-start">
              {detail.logoUrl ? (
                <img
                  src={detail.logoUrl}
                  alt={`Logo do curso ${detail.title}`}
                  className="h-32 w-32 object-contain sm:h-36 sm:w-36 lg:h-40 lg:w-40"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-[28px] bg-white/10 text-[1.9rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_32px_rgba(5,24,32,0.18)] backdrop-blur-sm sm:h-36 sm:w-36 lg:h-40 lg:w-40">
                  {detail.mentor.initials}
                </div>
              )}
            </div>

            <div className="min-w-0 max-w-none">
              <p className="inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white/82">
                {detail.categoryLine || 'Curso'}
              </p>
              <h1 className="mt-4 max-w-none break-words text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3.1rem] lg:text-[3.4rem] xl:text-[3.7rem]">
                {detail.title}
              </h1>
              <GenflixCtaButton asChild tone="surface" className="mt-8 h-12 px-6 text-[15px] font-bold shadow-none">
                <Link to={`/checkout/pagamento/${slug}`}>Comprar agora</Link>
              </GenflixCtaButton>
            </div>

            <div className="lg:justify-self-end">
              <div className="overflow-hidden rounded-[26px] border border-white/16 bg-[#173039] shadow-[0_28px_60px_rgba(5,24,32,0.28)] lg:w-[420px] xl:w-[440px]">
                <div className="aspect-[16/9]">
                  <CourseCoverMedia
                    src={detail.coverImage}
                    videoSrc={detail.heroVideoUrl}
                    alt={detail.title}
                    title={detail.title}
                    category={detail.categoryLine}
                    initials={detail.mentor.initials}
                    className="h-full"
                    placeholderClassName="p-6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-20 pt-4">
        <div className="public-site-container">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="max-w-[820px] space-y-10">
              <section>
                <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">Sobre o curso</h2>
                <div className="mt-4 space-y-4">
                  {detail.aboutParagraphs.map((paragraph, index) => (
                    <div
                      key={`${detail.slug}-about-${index}`}
                      className="rich-text-content max-w-[760px] text-[15px] leading-7 text-[#5f7178] [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:my-4 [&_ol]:my-4 [&_li]:mb-2 [&_a]:text-[#1398B7] [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: renderAboutParagraphHtml(paragraph) ?? '' }}
                    />
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">Conteúdo do curso</h2>
                <div className="mt-5 space-y-3">
                  {detail.syllabus.map((module, index) => {
                    const isOpen = openModule === index;

                    return (
                      <article
                        key={module.title}
                        className="overflow-hidden rounded-[18px] border border-[#D8E6EB] bg-white shadow-[0_12px_24px_rgba(21,50,59,0.03)]"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenModule((current) => (current === index ? -1 : index))}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#183139]">{module.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[#5F7077]">
                              Módulo {index + 1}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-[#1398B7] px-3 py-1 text-[11px] font-bold text-white">
                              {module.lessonCount} {module.lessonLabel ?? 'aulas'}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 text-[#1398B7] transition-transform',
                                isOpen ? 'rotate-180' : '',
                              )}
                            />
                          </div>
                        </button>

                        {isOpen ? (
                          <div className="border-t border-[#D8E6EB] px-5 pb-5 pt-4">
                            {module.items?.length ? (
                              <div className="space-y-2">
                                {module.items.map((item) => (
                                  <div
                                    key={`${module.title}-${item}`}
                                    className="rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm font-semibold text-[#5f7178]"
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm leading-7 text-[#667980]">{module.summary}</p>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">AUTOR(ES) DO CURSO</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {detail.authors.map((author) => (
                    <article
                      key={author.authorId}
                      className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-5 shadow-[0_12px_24px_rgba(21,50,59,0.04)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#D9F0F5] text-sm font-extrabold text-[#0A3640]">
                          {author.photoUrl ? (
                            <img src={author.photoUrl} alt={author.name} className="h-full w-full object-cover" />
                          ) : (
                            <span>{author.name.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#183139]">{author.name}</p>
                          <p className="mt-1 text-xs leading-5 text-[#6a7b81]">{author.title}</p>
                        </div>
                      </div>

                      {author.shortBio ? (
                        <p className="mt-4 text-sm leading-6 text-[#5f7178]">{author.shortBio}</p>
                      ) : null}

                      {author.areas.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {author.areas.map((area) => (
                            <span key={`${author.authorId}-${area}`} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0F7E99]">
                              {area}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveAuthor(author)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1398B7] transition hover:text-[#0F7E99]"
                        >
                          <span>Saiba mais</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[26px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <div className="space-y-6 p-6">
                  <div>
                    <p className="text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#1398B7]">
                      {detail.priceLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7178]">em até 12x no cartão de crédito</p>
                    <p className="mt-2 text-sm text-[#6a7b81]">{detail.secondaryPriceLabel}</p>
                  </div>

                  {playerEntryHref ? (
                    <GenflixCtaButton asChild className="w-full px-5 py-3" customColors={freeLessonCtaColors}>
                      <Link to={playerEntryHref}>Assista a uma aula Gratuita</Link>
                    </GenflixCtaButton>
                  ) : (
                    <GenflixCtaButton className="w-full px-5 py-3" disabled customColors={freeLessonCtaColors}>
                      Assista a uma aula Gratuita
                    </GenflixCtaButton>
                  )}

                  <GenflixCtaButton asChild className="w-full px-5 py-3">
                    <Link to={`/checkout/pagamento/${slug}`}>Comprar agora</Link>
                  </GenflixCtaButton>

                  {detail.bonusSection.enabled && detail.bonusSection.description.trim().length > 0 ? (
                    <div className="rounded-[20px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-4">
                      <div className="flex items-start gap-3">
                        <CirclePlay className="mt-0.5 h-5 w-5 text-[#1398B7]" />
                        <div>
                          <p className="text-sm font-semibold text-[#183139]">{detail.bonusSection.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#6a7b81]">{detail.bonusSection.description}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedResourceItems.length ? (
                    <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4 shadow-[0_12px_28px_rgba(21,50,59,0.04)]">
                      <div>
                        <p className="text-sm font-semibold text-[#183139]">Recursos disponíveis</p>
                        <p className="mt-1 text-xs leading-5 text-[#6a7b81]">Acesse os materiais e recursos que acompanham este curso.</p>
                      </div>
                      <div className="mt-4 space-y-2.5">
                        {selectedResourceItems.map((item) => {
                          const resourceHref = typeof item.href === 'string' && item.href.trim() !== '' ? item.href.trim() : '/recursos';

                          return (
                            <div key={item.id} className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 flex-1 text-sm font-bold leading-6 text-[#183139]">{item.title ?? item.label ?? 'Recurso'}</p>
                                <ResourceSaibaMaisLink href={resourceHref} className="inline-flex items-center gap-1 whitespace-nowrap pt-0.5 text-xs font-semibold text-[#1398B7] transition hover:text-[#0F7E99]" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4 shadow-[0_12px_28px_rgba(21,50,59,0.04)]">
                    <div>
                      <p className="text-sm font-semibold text-[#183139]">{courseBenefitsCardTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6a7b81]">Tudo o que já está incluído na sua jornada neste curso.</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {detail.includedItems.map((item) => (
                        <div key={item} className="flex items-center gap-2 rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-3 text-sm text-[#5f7178]">
                          <BadgeCheck className="h-4 w-4 shrink-0 text-[#1398B7]" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4 shadow-[0_12px_28px_rgba(21,50,59,0.04)]">
                    <div>
                      <p className="text-sm font-semibold text-[#183139]">{courseInvestmentCardTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6a7b81]">Garanta seu acesso agora e comece a estudar sem esperar.</p>
                    </div>
                    <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-4">
                      <p className="text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#1398B7]">
                        {detail.priceLabel}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7178]">
                        em até 12x no cartão de crédito
                      </p>
                      <p className="mt-2 text-sm text-[#6a7b81]">{detail.secondaryPriceLabel}</p>
                    </div>

                    <GenflixCtaButton asChild className="mt-4 w-full px-5 py-3">
                      <Link to={`/checkout/pagamento/${slug}`}>Comprar agora</Link>
                    </GenflixCtaButton>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {detail.showReviews !== false && globalReviewsEnabled ? <CourseReviewsSection courseId={detail.id} courseTitle={detail.title} /> : null}

      <section className="bg-[#F2F7F9] py-16">
        <div className="public-site-container">
          <div className="mx-auto max-w-[620px] text-center">
            <h2 className="text-[2.1rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.35rem]">
              Tudo que você precisa para aprender
            </h2>
          </div>

          <EditableList
            entryKey="courses.features.items"
            fallback={genflixStudyFeatureCardsFallback}
            label="Cards de recursos em cursos"
            schema={genflixStudyFeatureCardsSchema}
          >
            {(items) => (
              <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.filter(isEditableItemVisible).map((item) => {
                  const iconColor = typeof item.metadata?.iconColor === 'string' ? item.metadata.iconColor : null;

                  return (
                    <article
                      key={item.id}
                      className="rounded-[20px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                        {renderSiteIconVisual({
                          iconKey: resolveStudyFeatureIconKey(item),
                          iconAlt: item.label ?? item.title ?? 'Recurso',
                          iconColor,
                          className: 'h-5 w-5',
                        })}
                      </div>
                      <h3 className="mt-5 text-lg font-bold text-[#183139]">{item.title ?? item.label ?? 'Card'}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#6d7f85]">{item.description ?? ''}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </EditableList>

          <div className="mt-10 flex justify-center">
            <GenflixCtaButton asChild className="px-5 py-3">
              <Link to="/login">Ver todos os recursos</Link>
            </GenflixCtaButton>
          </div>
        </div>
      </section>

      {activeAuthor ? (
        <AuthorProfileModal
          author={activeAuthor}
          profile={activeAuthorProfile}
          isLoading={isAuthorProfileLoading}
          onClose={() => setActiveAuthor(null)}
        />
      ) : null}

      <GenflixPublicFooter />
    </main>
  );
}
