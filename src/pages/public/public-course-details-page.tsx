import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CourseCoverMedia } from '@/components/public/course-cover-media';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot';
import { fetchSiteContent } from '@/features/site-editor/api';
import { fetchPublicCourseDetailFromSupabase, fetchPublicCoursePlayerViewFromSupabase, type PublicCoursePlayerView } from '@/features/public/genflix-public-content-api';
import { genflixNavLinks, type GenflixCourseDetail } from '@/features/public/genflix-site-content';
import { genflixStudyFeatureCardsFallback, genflixStudyFeatureCardsSchema } from '@/features/public/genflix-study-feature-editor';
import { CourseReviewsSection } from '@/features/reviews/course-reviews-section';
import { fetchGlobalReviewsEnabled } from '@/features/reviews/review-settings';
import { EditableList, isEditableItemVisible } from '@/features/site-editor/visual-editor';
import { normalizeResourcesItems } from '@/features/public/genflix-resource-items-editor';
import { sanitizeRichTextHtml } from '@/features/admin/content/content-blocks';
import { formatCourseInstallmentLabel } from '@/features/public/course-public-page-content';
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

export function PublicCourseDetailsPage() {
  const { slug = '' } = useParams();
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(null);
  const [playerView, setPlayerView] = useState<PublicCoursePlayerView | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [openModule, setOpenModule] = useState(0);
  const [resourceCatalog, setResourceCatalog] = useState<EditableListItem[]>([]);
  const [globalReviewsEnabled, setGlobalReviewsEnabled] = useState(true);
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
  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="course-detail" placementKey="hero" />

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0D728E_0%,#0B667F_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
        <div className="public-site-container relative py-10 lg:py-14">
          <div className="grid items-center gap-8 lg:grid-cols-[255px_minmax(0,1.2fr)_420px] lg:gap-12 xl:grid-cols-[270px_minmax(0,1.3fr)_440px]">
            <div className="flex justify-center lg:justify-start">
              {detail.logoUrl ? (
                <img
                  src={detail.logoUrl}
                  alt={`Logo do curso ${detail.title}`}
                  className="h-48 w-48 object-contain sm:h-[13.5rem] sm:w-[13.5rem] lg:h-[15rem] lg:w-[15rem]"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-[28px] bg-white/10 text-[1.9rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_32px_rgba(5,24,32,0.18)] backdrop-blur-sm sm:h-[13.5rem] sm:w-[13.5rem] lg:h-[15rem] lg:w-[15rem]">
                  {detail.mentor.initials}
                </div>
              )}
            </div>

            <div className="min-w-0 max-w-none">
              <h1 className="mt-4 max-w-none break-words text-[2.6rem] font-extrabold leading-[0.94] tracking-[0px] text-white sm:text-[3.1rem] lg:text-[3.4rem] xl:text-[3.7rem]">
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
                <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">Autoria</h2>
                {detail.authorContent ? (
                  <div
                    className="rich-text-content mt-4 max-w-[760px] text-[15px] leading-7 text-[#000000] [&_p]:mb-4 [&_p:last-child]:mb-0 [&_h1]:my-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-bold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-2 [&_a]:text-[#1398B7] [&_a]:underline [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                    dangerouslySetInnerHTML={{ __html: renderAboutParagraphHtml(detail.authorContent) ?? '' }}
                  />
                ) : null}
              </section>

              <section>
                <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">Sobre o curso</h2>
                <div className="mt-4 space-y-4">
                  {detail.aboutParagraphs.map((paragraph, index) => (
                    <div
                      key={`${detail.slug}-about-${index}`}
                      className="rich-text-content max-w-[760px] text-[15px] leading-7 text-[#000000] [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:my-4 [&_ol]:my-4 [&_li]:mb-2 [&_a]:text-[#000000] [&_a]:underline [&_a]:hover:text-[#000000]"
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
            </div>

            <aside className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[26px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <div className="space-y-6 p-6">
                  <div>
                    <p className="text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#1398B7]">
                      {detail.priceLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7178]">{formatCourseInstallmentLabel(detail.priceCents)}</p>
                    <p className="mt-2 text-sm text-[#6a7b81]">{detail.secondaryPriceLabel}</p>
                  </div>

                  {playerEntryHref ? (
                    <GenflixCtaButton asChild tone="surface" className="w-full border-white bg-[#f78902] px-5 py-3 text-white shadow-[0_5px_0_#1151B1,0_10px_18px_rgba(17,81,177,0.2)] hover:border-white hover:bg-[#f78902] hover:shadow-[0_6px_0_#1151B1,0_12px_22px_rgba(17,81,177,0.24)] [&>span:last-child]:bg-white [&>span:last-child]:text-[#1151B1]">
                      <Link to={playerEntryHref}>Assista a uma aula gratuita</Link>
                    </GenflixCtaButton>
                  ) : (
                    <GenflixCtaButton tone="surface" className="w-full border-white bg-[#f78902] px-5 py-3 text-white shadow-[0_5px_0_#1151B1,0_10px_18px_rgba(17,81,177,0.2)] hover:border-white hover:bg-[#f78902] hover:shadow-[0_6px_0_#1151B1,0_12px_22px_rgba(17,81,177,0.24)] [&>span:last-child]:bg-white [&>span:last-child]:text-[#1151B1]" disabled>
                      Assista a uma aula gratuita
                    </GenflixCtaButton>
                  )}

                  <GenflixCtaButton asChild className="w-full px-5 py-3">
                    <Link to={`/checkout/pagamento/${slug}`}>Comprar agora</Link>
                  </GenflixCtaButton>

                  {selectedResourceItems.length ? (
                    <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4 shadow-[0_12px_28px_rgba(21,50,59,0.04)]">
                      <div>
                        <h2 className="text-[1.45rem] font-bold leading-none tracking-[0px] text-[#183139]">Recursos didáticos deste curso</h2>
                        <Link to="/recursos" className="mt-2 inline-block text-xs font-semibold text-[#1398B7] underline underline-offset-2 transition hover:text-[#0F7E99]">Saiba mais sobre esses recursos</Link>
                      </div>
                      <div className="mt-4 space-y-1">
                        {selectedResourceItems.map((item) => {
                          return (
                            <p key={item.id} className="border-b border-[#E7F0F3] py-2 text-sm font-bold leading-5 text-[#183139] last:border-b-0">{item.title ?? item.label ?? 'Recurso'}</p>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
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

      <GenflixPublicFooter />
    </main>
  );
}
