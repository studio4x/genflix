import { useEffect, useRef } from 'react'
import { CheckCircle2, Clock3, Mail, ShieldCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import {
  SITE_PURCHASE_EVENT_NAME,
  type SitePurchaseTrackingEventDetail,
} from '@/features/site-editor/site-tracking'

function readParam(value: string | null, fallback: string) {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

export function PublicCheckoutConfirmationPage() {
  const [searchParams] = useSearchParams()
  const purchaseDispatchedRef = useRef(false)
  const courseId = searchParams.get('courseId')?.trim() ?? ''
  const courseTitle = readParam(searchParams.get('courseTitle'), 'seu curso')
  const courseCurrency = readParam(searchParams.get('currency'), 'BRL')
  const courseValue = Number.parseFloat(searchParams.get('courseValue')?.trim() ?? '')
  const courseRoute = courseId ? `/aluno/cursos/${courseId}` : '/aluno/cursos'

  useEffect(() => {
    if (purchaseDispatchedRef.current || typeof window === 'undefined' || !courseId) {
      return
    }

    if (!Number.isFinite(courseValue) || courseValue <= 0) {
      return
    }

    const purchaseEvent: SitePurchaseTrackingEventDetail = {
      courseId,
      courseTitle,
      currency: courseCurrency,
      transactionId: courseId,
      value: courseValue,
    }

    purchaseDispatchedRef.current = true
    window.dispatchEvent(new CustomEvent(SITE_PURCHASE_EVENT_NAME, { detail: purchaseEvent }))
  }, [courseCurrency, courseId, courseTitle, courseValue])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,152,183,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#f2f7f9_42%,#eef5f7_100%)] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-16 pt-8 sm:pt-12">
        <div className="public-site-container">
          <div className="mx-auto max-w-[820px] overflow-hidden rounded-[32px] border border-[#d8e6eb] bg-white shadow-[0_28px_70px_rgba(21,50,59,0.08)]">
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
              <aside className="flex min-h-[320px] flex-col justify-between bg-[linear-gradient(160deg,#0a3640_0%,#1398b7_100%)] px-7 py-8 text-white sm:px-10 sm:py-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/72">Checkout concluído</p>
                    <p className="mt-1 text-sm font-medium text-white/84">Seu acesso está em processamento.</p>
                  </div>
                </div>

                <div className="max-w-[300px]">
                  <h1 className="text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.06em] sm:text-[3rem]">
                    Inscrição confirmada
                  </h1>
                  <p className="mt-4 text-base leading-7 text-white/82">
                    A compra de <strong>{courseTitle}</strong> foi registrada com sucesso e estamos preparando a liberação do seu acesso.
                  </p>
                </div>
              </aside>

              <div className="px-7 py-8 sm:px-10 sm:py-10">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398b7]">Próximos passos</p>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[#183139]">
                  Fique atento aos detalhes da sua inscrição
                </h2>
                <p className="mt-3 max-w-[520px] text-sm leading-7 text-[#5f7077]">
                  Você já pode seguir normalmente. Assim que o pagamento for consolidado, o acesso ao curso ficará disponível na sua área do aluno.
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

                  <GenflixCtaButton asChild className="mt-2 h-12 px-5">
                    <Link to={courseRoute}>
                      Acessar curso comprado
                    </Link>
                  </GenflixCtaButton>
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
