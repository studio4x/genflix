import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
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
import { EditableImage, EditableList, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'

export function PublicHomePage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const heroImage = useEditableValue('home.hero.image', { src: genflixHeroImage, alt: 'GenFlix' })
  const categoryItems = useEditableValue(
    'home.categories.items',
    genflixCategoryTiles.map((category) => ({
      id: category.label,
      label: category.label,
    })),
  )

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section id="inicio" className="bg-[#F2F7F9] pt-4">
        <div className="public-site-container">
          <GenflixPublicHeader currentPage="home" navLinks={genflixNavLinks} />

          <div className="overflow-hidden rounded-[30px] bg-[#173039] shadow-[0_30px_70px_rgba(21,50,59,0.16)]">
            <EditableImage entryKey="home.hero.image" fallback={heroImage} label="Imagem do hero">
              {(image) => (
                <div
                  className="relative min-h-[500px] bg-cover bg-center"
                  style={{ backgroundImage: `linear-gradient(90deg, rgba(23,48,57,0.84) 0%, rgba(23,48,57,0.7) 28%, rgba(23,48,57,0.18) 58%, rgba(23,48,57,0.12) 100%), url(${typeof image.src === 'string' ? image.src : genflixHeroImage})` }}
                >
                  <div className="flex min-h-[500px] items-center px-6 py-12 sm:px-10 lg:px-14">
                    <div className="max-w-[520px]">
                      <h1 className="max-w-[420px] text-[2.35rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3rem]">
                        <EditableText
                          entryKey="home.hero.title"
                          fallback="O conhecimento que a sua carreira estava esperando."
                          label="Título principal"
                        />
                      </h1>
                      <p className="mt-4 max-w-[410px] text-base leading-7 text-white/78">
                        <EditableText
                          entryKey="home.hero.subtitle"
                          fallback="As ferramentas de estudo para quem leva o aprendizado a sério."
                          label="Subtítulo principal"
                        />
                      </p>

                      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <GenflixCtaButton asChild className="min-h-[52px] px-6">
                          <Link to="/login">
                            <EditableText entryKey="home.hero.primaryCta" fallback="Já sou inscrito" label="CTA principal" />
                          </Link>
                        </GenflixCtaButton>
                        <GenflixCtaButton asChild tone="surface" className="min-h-[52px] px-6">
                          <a href="#newsletter">
                            <EditableText entryKey="home.hero.secondaryCta" fallback="Quero me inscrever" label="CTA secundário" />
                          </a>
                        </GenflixCtaButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </EditableImage>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-14">
        <div className="public-site-container">
          <div className="mx-auto max-w-[520px] text-center">
            <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.25rem] lg:whitespace-nowrap">
              <EditableText
                entryKey="home.categories.title"
                fallback="Explore por área de conhecimento"
                label="Título de categorias"
              />
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <EditableList entryKey="home.categories.items" fallback={categoryItems} label="Categorias da home">
              {(items) => items.filter(isEditableItemVisible).map((item) => {
                const category = genflixCategoryTiles.find((tile) => tile.label === item.label) ?? genflixCategoryTiles[0]
                const Icon = category.icon
                return (
                  <article
                    key={item.id}
                    className="rounded-[18px] bg-[linear-gradient(135deg,#1398B7_0%,#0A3640_100%)] px-4 py-5 text-white shadow-[0_18px_35px_rgba(10,54,64,0.18)] transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="mb-7 flex h-9 w-9 items-center justify-center rounded-full border border-white/28 bg-white/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold leading-5">{item.label}</p>
                  </article>
                )
              })}
            </EditableList>
          </div>
        </div>
      </section>

      <section id="destaques" className="bg-white pb-16 pt-2">
        <div className="public-site-container">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[580px]">
              <h2 className="text-[2.15rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.45rem]">
                <EditableText entryKey="home.featured.title" fallback="Mais recentes" label="Título de cursos em destaque" />
              </h2>
              <p className="mt-3 text-base leading-7 text-[#60737a]">
                <EditableText
                  entryKey="home.featured.description"
                  fallback="Cursos, trilhas e ferramentas de estudo para quem leva o aprendizado a sério."
                  label="Descrição de cursos em destaque"
                />
              </p>
            </div>

            <GenflixCtaButton asChild className="min-h-[52px] px-6 self-start">
              <Link to="/cursos">
                <EditableText entryKey="home.featured.cta" fallback="Conheça todos os cursos" label="CTA de cursos em destaque" />
              </Link>
            </GenflixCtaButton>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
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
