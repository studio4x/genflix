import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { CourseCoverMedia } from '@/components/public/course-cover-media'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks, getGenflixCourseDetailBySlug, type GenflixCourseDetail } from '@/features/public/genflix-site-content'
import { fetchPublicCourseDetailFromSupabase } from '@/features/public/genflix-public-content-api'
import { startCourseCheckout } from '@/features/public/courses/api'

function formatPriceLabel(label: string) {
  return label.trim() || 'Investimento disponível'
}

export function PublicCheckoutPage() {
  const { slug = '' } = useParams()
  const { isLoading, session, user, profile } = useAuth()
  const staticDetail = useMemo(() => getGenflixCourseDetailBySlug(slug), [slug])
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(staticDetail)
  const [isLoadingDetail, setIsLoadingDetail] = useState(true)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)

  const courseRoute = `/cursos/${slug}`

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

  async function handleContinue() {
    if (!detail) {
      return
    }

    setCheckoutError(null)
    setIsStartingCheckout(true)

    try {
      if (!session?.access_token) {
        throw new Error('Entre na sua conta GenFlix para continuar a compra.')
      }

      if (!detail.id) {
        throw new Error('Este curso ainda não está disponível para checkout.')
      }

      const checkoutUrl = await startCourseCheckout(detail.id, session.access_token, {
        buyerName: profile?.full_name || user?.user_metadata?.full_name,
        buyerEmail: profile?.email || user?.email,
      })

      window.location.href = checkoutUrl
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Não foi possível iniciar o checkout.')
    } finally {
      setIsStartingCheckout(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  if (!isLoadingDetail && !staticDetail && !detail) {
    return <Navigate to="/cursos" replace />
  }

  if (!detail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando checkout...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,152,183,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#f2f7f9_42%,#eef5f7_100%)] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-16 pt-8 sm:pt-12">
        <div className="public-site-container">
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-[32px] border border-[#d8e6eb] bg-white shadow-[0_28px_70px_rgba(21,50,59,0.08)]">
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
              <aside className="flex min-h-[320px] flex-col justify-between bg-[linear-gradient(160deg,#0a3640_0%,#1398b7_100%)] px-7 py-8 text-white sm:px-10 sm:py-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/72">Checkout intermediário</p>
                    <p className="mt-1 text-sm font-medium text-white/84">Seu acesso está quase pronto.</p>
                  </div>
                </div>

                <div className="mt-8 max-w-[340px] space-y-5">
                  <h1 className="text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.06em] sm:text-[3rem]">
                    Quase lá! Vamos finalizar sua inscrição.
                  </h1>
                  <p className="text-base leading-7 text-white/82">
                    Você está prestes a concluir a compra de <strong>{detail.title}</strong> em um ambiente seguro, com confirmação automática após o pagamento.
                  </p>
                </div>

                <div className="mt-8 overflow-hidden rounded-[24px] border border-white/14 bg-white/8 backdrop-blur-sm">
                  <div className="relative aspect-[4/3] bg-[#173039]">
                    <CourseCoverMedia
                      src={detail.coverImage}
                      alt={detail.title}
                      title={detail.title}
                      category={detail.categoryLine}
                      initials={detail.mentor.initials}
                      imageClassName="grayscale"
                      placeholderClassName="p-6"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,54,64,0.04)_0%,rgba(10,54,64,0.58)_100%)]" />
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Resumo do curso</p>
                      <p className="mt-2 text-xl font-bold leading-tight text-white">{detail.title}</p>
                    </div>
                    <p className="text-sm leading-7 text-white/80">{detail.description}</p>
                  </div>
                </div>
              </aside>

              <div className="px-7 py-8 sm:px-10 sm:py-10">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398b7]">Próximos passos</p>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[#183139]">
                  Fique atento aos detalhes da sua inscrição
                </h2>
                <p className="mt-3 max-w-[520px] text-sm leading-7 text-[#5f7077]">
                  Revise o investimento, siga para o checkout e conclua o pagamento. Assim que o Asaas confirmar a transação, o acesso ao curso será liberado automaticamente.
                </p>

                <div className="mt-8 grid gap-4">
                  <div className="flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Confira seu e-mail</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        Enviaremos os detalhes da compra e os próximos avisos por e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Liberação automática</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        Após a confirmação do pagamento, o curso será liberado automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Processamento em andamento</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        A atualização do acesso pode levar alguns instantes dependendo do meio de pagamento.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[#d8e6eb] bg-white p-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398b7]">Resumo financeiro</p>
                        <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">Investimento único</h3>
                      </div>
                      <CreditCard className="h-7 w-7 text-[#1398b7]" />
                    </div>
                    <div className="mt-6 space-y-3 rounded-[20px] bg-[#f2f7f9] p-4">
                      <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#5f7077]">
                        <span>Valor do curso</span>
                        <span>{formatPriceLabel(detail.priceLabel)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#5f7077]">
                        <span>Condição</span>
                        <span>{detail.secondaryPriceLabel}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#d8e6eb] bg-[#f8fbfc] px-4 py-3 text-sm text-[#5f7077]">
                      <Sparkles className="h-4 w-4 text-[#1398b7]" />
                      <span>Ambiente seguro, confirmação automática e acesso liberado após o pagamento.</span>
                    </div>
                  </div>

                  {checkoutError ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                      {checkoutError}
                    </p>
                  ) : null}

                  <GenflixCtaButton
                    type="button"
                    disabled={isStartingCheckout}
                    onClick={() => void handleContinue()}
                    className="w-full px-5 py-3"
                  >
                    {isStartingCheckout ? 'Abrindo checkout...' : 'Continuar para pagamento'}
                  </GenflixCtaButton>

                  <Link
                    to={courseRoute}
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#1398b7] transition-colors hover:text-[#0a3640]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao curso
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
