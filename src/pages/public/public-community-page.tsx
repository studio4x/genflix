import { CirclePlay } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixCommunityItems,
  genflixNavLinks,
} from '@/features/public/genflix-site-content'

export function PublicCommunityPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section className="bg-[#F2F7F9]">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <GenflixPublicHeader currentPage="community" navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-14 pt-6">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="mx-auto max-w-[760px] text-center">
            <h1 className="text-[2.35rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.8rem]">
              Tire dúvidas, troque experiências e aprofunde o que aprendeu.
            </h1>
            <p className="mx-auto mt-4 max-w-[720px] text-base leading-7 text-[#61737a]">
              Escolha sua comunidade, entre na conversa e leve o aprendizado além da tela. Aqui as dúvidas viram debate
              e o debate vira conhecimento.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {genflixCommunityItems.map((item) => {
              const Icon = item.icon

              return (
                <article
                  key={item.label}
                  className="group rounded-[14px] bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] px-4 py-4 text-white shadow-[0_10px_20px_rgba(10,54,64,0.18)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/24 bg-white/10">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="mt-5 text-sm font-semibold leading-5">{item.label}</h2>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white pb-16">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="grid gap-8 overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_20px_46px_rgba(21,50,59,0.05)] lg:grid-cols-[1fr_0.9fr] lg:p-8">
            <div className="relative overflow-hidden rounded-[22px] bg-[#173039]">
              <img
                src="/images/genflix/home/featured-6.jpg"
                alt="Comunidade GenFlix"
                className="h-full w-full object-cover grayscale"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,31,36,0.18)_0%,rgba(11,31,36,0.5)_100%)]" />
              <button
                type="button"
                aria-label="Assistir vídeo institucional"
                className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/36 bg-white/12 text-white backdrop-blur-sm transition-transform hover:scale-105"
              >
                <CirclePlay className="h-8 w-8 fill-current" />
              </button>
            </div>

            <div className="flex items-center">
              <div className="max-w-[460px]">
                <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.1rem]">
                  Texto de apoio
                </h2>
                <p className="mt-4 text-[15px] leading-8 text-[#5f7178]">
                  Oferecer a profissionais e estudantes universitários conteúdos modernos, objetivos e práticos, a
                  preços justos, para que a compreensão aconteça de verdade. Nas comunidades da GenFlix, esse
                  conhecimento ganha continuidade em conversas, trocas e repertório compartilhado.
                </p>
                <p className="mt-4 text-[15px] leading-8 text-[#5f7178]">
                  O espaço foi pensado para aproximar quem aprende, estimular o debate e transformar dúvidas em avanço
                  concreto. Cada área reúne temas, experiências e perspectivas que ajudam a estender o estudo para além
                  da aula.
                </p>

                <div className="mt-8">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.24)] transition-colors hover:bg-[#0A3640]"
                  >
                    Entrar para participar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GenflixNewsletterSection />
      <GenflixPublicFooter />
    </main>
  )
}
