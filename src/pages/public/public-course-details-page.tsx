import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronDown, CirclePlay } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CourseCoverMedia } from '@/components/public/course-cover-media';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot';
import { fetchSiteContent } from '@/features/site-editor/api';
import { fetchPublicCourseDetailFromSupabase } from '@/features/public/genflix-public-content-api';
import { genflixNavLinks, type GenflixCourseDetail } from '@/features/public/genflix-site-content';
import { genflixStudyFeatureCardsFallback, genflixStudyFeatureCardsSchema } from '@/features/public/genflix-study-feature-editor';
import { CourseReviewsSection } from '@/features/reviews/course-reviews-section';
import { EditableList, isEditableItemVisible } from '@/features/site-editor/visual-editor';
import { normalizeResourcesItems } from '@/features/public/genflix-resource-items-editor';
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

export function PublicCourseDetailsPage() {
  const { slug = '' } = useParams();
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [openModule, setOpenModule] = useState(0);
  const [resourceCatalog, setResourceCatalog] = useState<EditableListItem[]>([]);
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
              <h1 className="mt-4 max-w-none text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3.1rem] lg:whitespace-nowrap lg:text-[3.4rem] xl:text-[3.7rem]">
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
                  {detail.aboutParagraphs.map((paragraph) => (
                    <p key={paragraph} className="max-w-[760px] text-[15px] leading-7 text-[#5f7178]">
                      {paragraph}
                    </p>
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
            </div>

            <aside className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[26px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <div className="space-y-6 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D9F0F5] text-sm font-extrabold text-[#0A3640]">
                      {detail.mentor.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#183139]">{detail.mentor.name}</p>
                      <p className="text-xs leading-5 text-[#6a7b81]">{detail.mentor.role}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#1398B7]">
                      {detail.priceLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7178]">em até 12x no cartão de crédito</p>
                    <p className="mt-2 text-sm text-[#6a7b81]">{detail.secondaryPriceLabel}</p>
                  </div>

                  <GenflixCtaButton asChild className="w-full px-5 py-3">
                    <Link to={`/cursos/${slug}/preview`}>Acessar gratuitamente uma aula</Link>
                  </GenflixCtaButton>

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
                        <p className="text-sm font-semibold text-[#183139]">Recursos do curso</p>
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    {detail.includedItems.map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-3 text-sm text-[#5f7178]">
                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#1398B7]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {detail.showReviews !== false ? <CourseReviewsSection courseId={detail.id} courseTitle={detail.title} /> : null}

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
