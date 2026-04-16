import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, BadgeCheck, ChevronDown, CirclePlay, Play, Sparkles } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixNavLinks,
  genflixStudyFeatures,
  getGenflixCourseBySlug,
  getGenflixCourseDetailBySlug,
  type GenflixCourseDetail,
} from '@/features/public/genflix-site-content'
import { fetchPublicCourseDetailFromSupabase } from '@/features/public/genflix-public-content-api'
import { startCourseCheckout } from '@/features/public/courses/api'
import { cn } from '@/lib/utils'

export function PublicCourseDetailsPage() {
  const { slug = '' } = useParams()
  const { isLoading, user, roles, session } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const staticCourse = useMemo(() => getGenflixCourseBySlug(slug), [slug])
  const staticDetail = useMemo(() => getGenflixCourseDetailBySlug(slug), [slug])
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(staticDetail)
  const [isLoadingDetail, setIsLoadingDetail] = useState(true)
  const [openModule, setOpenModule] = useState(0)
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadDetail() {
      setIsLoadingDetail(true)
      try {
        const publicDetail = await fetchPublicCourseDetailFromSupabase(slug)
        if (isMounted) {
          setDetail(publicDetail ?? staticDetail)
        }
      } catch {
        if (isMounted) {
          setDetail(staticDetail)
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false)
        }
      }
    }

    void loadDetail()

    return () => {
      isMounted = false
    }
  }, [slug, staticDetail])

  async function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detail) {
      return
    }

    setCheckoutError(null)
    setIsStartingCheckout(true)

    try {
      if (!session?.access_token) {
        throw new Error('Entre na sua conta GenFlix para iniciar a compra com segurança.')
      }

      if (!detail.id) {
        throw new Error('Este curso ainda não está disponível para checkout.')
      }

      const checkoutUrl = await startCourseCheckout(detail.id, session.access_token)
      window.location.href = checkoutUrl
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Nao foi possivel iniciar o checkout.')
    } finally {
      setIsStartingCheckout(false)
    }
  }

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  if (!isLoadingDetail && !staticCourse && !detail) {
    return <Navigate to="/cursos" replace />
  }

  if (!detail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando curso...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section className="bg-[#F2F7F9]">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-20 pt-6">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#1398B7]">
                {detail.categoryLine}
              </p>
              <h1 className="mt-3 max-w-[640px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
                {detail.title}
              </h1>
              <p className="mt-5 max-w-[720px] text-base leading-7 text-[#5f7178]">
                {detail.description}
              </p>

              <div className="mt-10 space-y-10">
                <section>
                  <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">Sobre o Curso</h2>
                  <div className="mt-4 space-y-4">
                    {detail.aboutParagraphs.map((paragraph) => (
                      <p key={paragraph} className="max-w-[760px] text-[15px] leading-7 text-[#5f7178]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">O que você vai aprender</h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {detail.outcomes.map((outcome) => (
                      <article
                        key={outcome.title}
                        className="rounded-[22px] border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <h3 className="mt-4 text-base font-bold text-[#183139]">{outcome.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-[#67797f]">{outcome.description}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">Conteúdo do curso</h2>
                  <div className="mt-5 space-y-3">
                    {detail.syllabus.map((module, index) => {
                      const isOpen = openModule === index
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
                                {module.lessonCount} aulas
                              </span>
                              <ChevronDown
                                className={cn('h-4 w-4 text-[#1398B7] transition-transform', isOpen ? 'rotate-180' : '')}
                              />
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-[#D8E6EB] px-5 pb-5 pt-4">
                              <p className="text-sm leading-7 text-[#667980]">{module.summary}</p>
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </section>
              </div>
            </div>

            <aside className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[26px] border border-[#D8E6EB] bg-white shadow-[0_24px_60px_rgba(21,50,59,0.08)]">
                <div className="relative aspect-[16/10] overflow-hidden bg-[#173039]">
                  <img
                    src={detail.coverImage}
                    alt={detail.title}
                    className="h-full w-full object-cover grayscale"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,31,36,0.08)_0%,rgba(11,31,36,0.54)_100%)]" />
                  <button
                    type="button"
                    className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/18 text-white backdrop-blur-sm transition-transform hover:scale-105"
                    aria-label="Assistir prévia"
                  >
                    <Play className="ml-1 h-6 w-6 fill-current" />
                  </button>
                </div>

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
                    <p className="mt-2 text-sm text-[#6a7b81]">{detail.secondaryPriceLabel}</p>
                  </div>

                  <form className="space-y-3" onSubmit={(event) => void handleCheckoutSubmit(event)}>
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F7077]">Nome</span>
                      <input
                        value={buyerName}
                        onChange={(event) => setBuyerName(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
                        placeholder="Seu nome"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F7077]">E-mail</span>
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={(event) => setBuyerEmail(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
                        placeholder="seu@email.com"
                      />
                    </label>

                    {checkoutError ? (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {checkoutError}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isStartingCheckout}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.24)] transition-colors hover:bg-[#0A3640] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isStartingCheckout ? 'Abrindo checkout...' : 'Comprar agora'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {detail.includedItems.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-3 text-sm text-[#5f7178]"
                      >
                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#1398B7]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[20px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-4">
                    <div className="flex items-start gap-3">
                      <CirclePlay className="mt-0.5 h-5 w-5 text-[#1398B7]" />
                      <div>
                        <p className="text-sm font-semibold text-[#183139]">Prévia de conteúdo</p>
                        <p className="mt-1 text-sm leading-6 text-[#6a7b81]">{detail.mentor.bio}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-[#F2F7F9] py-16">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="mx-auto max-w-[620px] text-center">
            <h2 className="text-[2.1rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.35rem]">
              Tudo que você precisa para aprender
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {genflixStudyFeatures.map((feature) => {
              const Icon = feature.icon
              return (
                <article
                  key={feature.title}
                  className="rounded-[20px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[#183139]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#6d7f85]">{feature.description}</p>
                </article>
              )
            })}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.22)] transition-colors hover:bg-[#0A3640]"
            >
              Ver todos os recursos
            </Link>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
