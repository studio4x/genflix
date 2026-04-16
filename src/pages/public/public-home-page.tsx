import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCourseCard } from '@/components/public/genflix-course-card'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixCategoryTiles,
  genflixFeaturedCourses,
  genflixHeroImage,
  genflixNavLinks,
} from '@/features/public/genflix-site-content'

export function PublicHomePage() {
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
      <section id="inicio" className="bg-[#F2F7F9]">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <GenflixPublicHeader currentPage="home" navLinks={genflixNavLinks} />

          <div className="overflow-hidden rounded-[30px] bg-[#173039] shadow-[0_30px_70px_rgba(21,50,59,0.16)]">
            <div
              className="relative min-h-[500px] bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(23,48,57,0.84) 0%, rgba(23,48,57,0.7) 28%, rgba(23,48,57,0.18) 58%, rgba(23,48,57,0.12) 100%), url(${genflixHeroImage})` }}
            >
              <div className="flex min-h-[500px] items-center px-6 py-12 sm:px-10 lg:px-14">
                <div className="max-w-[520px]">
                  <h1 className="max-w-[420px] text-[2.35rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3rem]">
                    O conhecimento que a sua carreira estava esperando.
                  </h1>
                  <p className="mt-4 max-w-[410px] text-base leading-7 text-white/78">
                    As ferramentas de estudo para quem leva o aprendizado a sério.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.3)] transition-colors hover:bg-[#0A3640]"
                    >
                      Já sou inscrito
                    </Link>
                    <a
                      href="#newsletter"
                      className="inline-flex items-center justify-center rounded-full border border-white/22 bg-white/10 px-5 py-3 font-readex text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/16"
                    >
                      Quero me inscrever
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="mx-auto max-w-[520px] text-center">
            <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.25rem]">
              Explore por área de conhecimento
            </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {genflixCategoryTiles.map((category) => {
              const Icon = category.icon
              return (
                <article
                  key={category.label}
                  className="rounded-[18px] bg-[linear-gradient(135deg,#1398B7_0%,#0A3640_100%)] px-4 py-5 text-white shadow-[0_18px_35px_rgba(10,54,64,0.18)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="mb-7 flex h-9 w-9 items-center justify-center rounded-full border border-white/28 bg-white/10">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold leading-5">{category.label}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="destaques" className="bg-white pb-20 pt-6">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[580px]">
              <h2 className="text-[2.15rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.45rem]">
                Cursos em Destaque
              </h2>
              <p className="mt-3 text-base leading-7 text-[#60737a]">
                Cursos, trilhas e ferramentas de estudo para quem leva o aprendizado a sério.
              </p>
            </div>

            <Link
              to="/cursos"
              className="inline-flex items-center gap-2 self-start rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.22)] transition-colors hover:bg-[#0A3640]"
            >
              Conheça todos os cursos
            </Link>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {genflixFeaturedCourses.map((course) => (
              <GenflixCourseCard key={course.slug} course={course} />
            ))}
          </div>
        </div>
      </section>

      <GenflixNewsletterSection />
      <GenflixPublicFooter />
    </main>
  )
}
