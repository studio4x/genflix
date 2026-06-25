import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CourseCoverMedia } from '@/components/public/course-cover-media';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot';
import { fetchPublicCourseDetailFromSupabase } from '@/features/public/genflix-public-content-api';
import { genflixStudyFeatureCardsFallback, genflixStudyFeatureCardsSchema } from '@/features/public/genflix-study-feature-editor';
import { genflixNavLinks, type GenflixCourseDetail } from '@/features/public/genflix-site-content';
import { CourseReviewsSection } from '@/features/reviews/course-reviews-section';
import { EditableList, isEditableItemVisible } from '@/features/site-editor/visual-editor';
import { dispatchSiteViewItemEvent } from '@/features/site-editor/site-tracking';
import { renderSiteIconVisual } from '@/features/site-editor/site-icons';
import { resolveStudyFeatureIconKey } from '@/features/public/genflix-study-feature-editor';
import { cn } from '@/lib/utils';

function parsePriceLabelToNumber(priceLabel: string) {
  const normalized = priceLabel.replace(/\s+/g, '').replace(/[R$]/gi, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function PublicCourseDetailsPage() {
  const { slug = '' } = useParams();
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [openModule, setOpenModule] = useState(0);
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
          <div className="grid items-center gap-8 lg:grid-cols-[180px_minmax(0,1fr)_minmax(380px,0.92fr)] lg:gap-10">
            <div className="flex justify-center lg:justify-start">
              {detail.logoUrl ? (
                <div className="flex h-32 w-32 items-center justify-center rounded-[28px] border border-white/18 bg-white/10 p-5 shadow-[0_16px_32px_rgba(5,24,32,0.18)] backdrop-blur-sm sm:h-36 sm:w-36">
                  <img src={detail.logoUrl} alt={`Logo do curso ${detail.title}`} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-[28px] border border-white/18 bg-white/10 text-[1.9rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_32px_rgba(5,24,32,0.18)] backdrop-blur-sm sm:h-36 sm:w-36">
                  {detail.mentor.initials}
                </div>
              )}
            </div>

            <div className="max-w-[720px]">
              <p className="inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white/82">
                {detail.categoryLine || 'Curso'}
              </p>
              <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3.1rem]">
                {detail.title}
              </h1>
              <GenflixCtaButton asChild tone="surface" className="mt-8 h-12 px-6 text-[15px] font-bold shadow-none">
                <Link to={`/checkout/pagamento/${slug}`}>Comprar agora</Link>
              </GenflixCtaButton>
            </div>

            <div className="lg:justify-self-end">
              <div className="overflow-hidden rounded-[26px] border border-white/16 bg-[#173039] shadow-[0_28px_60px_rgba(5,24,32,0.28)]">
                <div className="aspect-video">
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

      <section className="bg-white py-20">
        <div className="public-site-container">
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
