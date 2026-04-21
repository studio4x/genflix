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
import {
  EditableButton,
  EditableImage,
  EditableList,
  EditableText,
  getEditableImagePresentation,
  isEditableItemVisible,
  useEditableValue,
  useSiteContentScope,
  useVisualEditorState,
} from '@/features/site-editor/visual-editor'
import { renderSiteIcon } from '@/features/site-editor/site-icons'
import type { EditableListItem, SitePageKey } from '@/features/site-editor/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const homeLayoutFallback: EditableListItem[] = [
  {
    id: 'home-hero',
    label: 'Hero principal',
    description: 'Bloco de abertura com imagem, título e CTAs principais.',
    metadata: {
      templateKey: 'hero',
    },
  },
  {
    id: 'home-categories',
    label: 'Áreas de conhecimento',
    description: 'Grade de categorias em destaque na home.',
    metadata: {
      templateKey: 'categories',
    },
  },
  {
    id: 'home-featured',
    label: 'Novidades',
    description: 'Listagem principal de cursos em destaque.',
    metadata: {
      templateKey: 'featured',
    },
  },
  {
    id: 'home-newsletter',
    label: 'Newsletter',
    description: 'Bloco final de captação de e-mail.',
    metadata: {
      templateKey: 'newsletter',
      pageKey: 'global',
    },
  },
]

const homeLayoutSchema = {
  kind: 'section-registry',
  itemName: 'bloco',
  addLabel: 'Adicionar bloco',
  instancePrefix: 'home.sections',
  instancePageKey: 'home',
  templates: [
    {
      id: 'hero',
      label: 'Hero principal',
      description: 'Abertura da home com imagem de fundo e CTAs.',
      item: {
        id: 'hero',
        label: 'Hero principal',
        description: 'Bloco de abertura com imagem, título e CTAs principais.',
        metadata: {
          templateKey: 'hero',
        },
      },
    },
    {
      id: 'categories',
      label: 'Áreas de conhecimento',
      description: 'Grade de áreas com cards editáveis e ordem controlada.',
      item: {
        id: 'categories',
        label: 'Áreas de conhecimento',
        description: 'Grade de categorias em destaque na home.',
        metadata: {
          templateKey: 'categories',
        },
      },
    },
    {
      id: 'featured',
      label: 'Novidades',
      description: 'Seção de listagem principal com CTA para cursos.',
      item: {
        id: 'featured',
        label: 'Novidades',
        description: 'Listagem principal de cursos em destaque.',
        metadata: {
          templateKey: 'featured',
        },
      },
    },
    {
      id: 'newsletter',
      label: 'Newsletter',
      description: 'Bloco de captação com imagem, texto e formulário.',
      item: {
        id: 'newsletter',
        label: 'Newsletter',
        description: 'Bloco final de captação de e-mail.',
        metadata: {
          templateKey: 'newsletter',
        },
      },
    },
  ],
}

const homeCategoryIconKeys: Record<string, string> = {
  Saude: 'heart-pulse',
  Saúde: 'heart-pulse',
  Juridicos: 'scale',
  Jurídicos: 'scale',
  Exatas: 'sigma',
  Gestao: 'briefcase-business',
  Gestão: 'briefcase-business',
  Humanas: 'landmark',
  'Psicanalise / Psicologia': 'brain-circuit',
  'Psicanálise / Psicologia': 'brain-circuit',
  'Interesse Geral': 'sparkles',
}

function getHomeSectionMetadata(item: EditableListItem) {
  return isRecord(item.metadata) ? item.metadata : {}
}

function resolveHomeSectionPrefix(item: EditableListItem, templateKey: string) {
  const metadata = getHomeSectionMetadata(item)
  const configuredPrefix = typeof metadata.entryPrefix === 'string' ? metadata.entryPrefix : null

  if (configuredPrefix) {
    return configuredPrefix
  }

  if (templateKey === 'hero') return 'home.hero'
  if (templateKey === 'categories') return 'home.categories'
  if (templateKey === 'featured') return 'home.featured'
  return 'global.newsletter'
}

function resolveHomeSectionPageKey(item: EditableListItem, templateKey: string): SitePageKey {
  const metadata = getHomeSectionMetadata(item)
  const configuredPageKey = typeof metadata.pageKey === 'string' ? metadata.pageKey : null

  if (configuredPageKey === 'global' || configuredPageKey === 'home') {
    return configuredPageKey
  }

  return templateKey === 'newsletter' ? 'global' : 'home'
}

function HomeStructureControl({ sections }: { sections: EditableListItem[] }) {
  const editor = useVisualEditorState()
  const scope = useSiteContentScope()

  if (!editor?.isEditing || !scope) {
    return null
  }

  return (
    <div className="public-site-container py-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => editor.openEditor({
            pageKey: 'home',
            entryKey: 'home.layout.sections',
            entryType: 'list',
            label: 'Estrutura da home',
            fallback: sections,
            schema: homeLayoutSchema,
            reload: scope.reload,
          })}
          className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] shadow-[0_18px_40px_rgba(6,27,33,0.08)] hover:bg-[#F2F7F9]"
        >
          Gerenciar blocos da home
        </button>
      </div>
    </div>
  )
}

function HomeHeroSection({
  entryPrefix,
  sectionId,
  pageKey = 'home',
}: {
  entryPrefix: string
  sectionId?: string
  pageKey?: SitePageKey
}) {
  const heroImage = useEditableValue(`${entryPrefix}.image`, { src: genflixHeroImage, alt: 'GenFlix' }, { pageKey })
  const legacyPrimaryCtaLabel = useEditableValue(`${entryPrefix}.primaryCta`, 'Já sou inscrito', { pageKey })
  const legacySecondaryCtaLabel = useEditableValue(`${entryPrefix}.secondaryCta`, 'Quero me inscrever', { pageKey })

  return (
    <EditableImage entryKey={`${entryPrefix}.image`} fallback={heroImage} label="Imagem do hero" pageKey={pageKey}>
      {(image) => (
        <section
          id={sectionId}
          className="relative overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(11, 38, 46, 0.84) 0%, rgba(11, 38, 46, 0.74) 28%, rgba(11, 38, 46, 0.36) 54%, rgba(11, 38, 46, 0.1) 100%), url(${typeof image.src === 'string' ? image.src : genflixHeroImage})`,
            backgroundPosition: getEditableImagePresentation(image).backgroundPosition,
            backgroundSize: getEditableImagePresentation(image).fit === 'contain' ? 'contain' : 'cover',
          }}
        >
          <div className="public-site-container flex min-h-[480px] items-center py-16 sm:py-20">
            <div className="max-w-[520px] text-white">
              <h1 className="max-w-[460px] text-[2.5rem] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-[3rem] md:text-[3.25rem]">
                <EditableText
                  entryKey={`${entryPrefix}.title`}
                  fallback="O conhecimento que a sua carreira estava esperando."
                  label="Título principal"
                  pageKey={pageKey}
                />
              </h1>
              <p className="mt-5 max-w-[420px] text-sm leading-7 text-white/78 sm:text-base">
                <EditableText
                  entryKey={`${entryPrefix}.subtitle`}
                  fallback="As ferramentas de estudo para quem leva o aprendizado a sério."
                  label="Subtítulo principal"
                  pageKey={pageKey}
                />
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <EditableButton
                  entryKey={`${entryPrefix}.primaryCta`}
                  fallback={{ label: legacyPrimaryCtaLabel, href: '/login', isInternal: true, tone: 'solid' }}
                  label="CTA principal do hero"
                  pageKey={pageKey}
                >
                  {(buttonValue) => buttonValue.isHidden === true ? null : (
                    <GenflixCtaButton asChild className="min-h-[48px] px-5" tone={buttonValue.tone === 'surface' || buttonValue.tone === 'ghost' ? buttonValue.tone : 'solid'}>
                      {buttonValue.isInternal === true ? (
                        <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/login'}>
                          {typeof buttonValue.label === 'string' ? buttonValue.label : 'Já sou inscrito'}
                        </Link>
                      ) : (
                        <a
                          href={typeof buttonValue.href === 'string' ? buttonValue.href : '#'}
                          target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                          rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                        >
                          {typeof buttonValue.label === 'string' ? buttonValue.label : 'Já sou inscrito'}
                        </a>
                      )}
                    </GenflixCtaButton>
                  )}
                </EditableButton>

                <EditableButton
                  entryKey={`${entryPrefix}.secondaryCta`}
                  fallback={{ label: legacySecondaryCtaLabel, href: '#newsletter', tone: 'surface' }}
                  label="CTA secundário do hero"
                  pageKey={pageKey}
                >
                  {(buttonValue) => buttonValue.isHidden === true ? null : (
                    <GenflixCtaButton asChild tone={buttonValue.tone === 'ghost' || buttonValue.tone === 'solid' ? buttonValue.tone : 'surface'} className="min-h-[48px] px-5">
                      <a
                        href={typeof buttonValue.href === 'string' ? buttonValue.href : '#newsletter'}
                        target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                        rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                      >
                        {typeof buttonValue.label === 'string' ? buttonValue.label : 'Quero me inscrever'}
                      </a>
                    </GenflixCtaButton>
                  )}
                </EditableButton>
              </div>
            </div>
          </div>
        </section>
      )}
    </EditableImage>
  )
}

function HomeCategoriesSection({
  entryPrefix,
  pageKey = 'home',
}: {
  entryPrefix: string
  pageKey?: SitePageKey
}) {
  const categoryItems = useEditableValue(
    `${entryPrefix}.items`,
    genflixCategoryTiles.map((category) => ({
      id: category.label,
      label: category.label,
      metadata: {
        iconKey: homeCategoryIconKeys[category.label] ?? 'sparkles',
      },
    })),
    { pageKey },
  )

  return (
    <section className="border-b border-[#D8E6EB] bg-[#FFF9F3] py-14 sm:py-16">
      <div className="public-site-container">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#15323B] sm:text-[2.25rem]">
            <EditableText
              entryKey={`${entryPrefix}.title`}
              fallback="Cursos por área de conhecimento"
              label="Título de categorias"
              pageKey={pageKey}
            />
          </h2>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <EditableList
            entryKey={`${entryPrefix}.items`}
            fallback={categoryItems}
            label="Categorias da home"
            pageKey={pageKey}
          >
            {(items) => items.filter(isEditableItemVisible).map((item) => {
              const category = genflixCategoryTiles.find((tile) => tile.label === item.label) ?? genflixCategoryTiles[0]
              const iconKey = typeof item.metadata?.iconKey === 'string'
                ? item.metadata.iconKey
                : homeCategoryIconKeys[category.label] ?? 'sparkles'

              return (
                <article
                  key={item.id}
                  className="min-h-[124px] rounded-[4px] bg-[linear-gradient(180deg,#1BA8C5_0%,#0A3640_100%)] px-4 py-4 text-white shadow-[0_18px_30px_rgba(10,54,64,0.14)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center text-white/95">
                    {renderSiteIcon(iconKey, 'h-5 w-5')}
                  </div>
                  <p className="mt-3 text-[15px] font-semibold leading-6 tracking-[-0.02em]">{item.label}</p>
                </article>
              )
            })}
          </EditableList>
        </div>
      </div>
    </section>
  )
}

function HomeFeaturedSection({
  entryPrefix,
  sectionId,
  pageKey = 'home',
}: {
  entryPrefix: string
  sectionId?: string
  pageKey?: SitePageKey
}) {
  const legacyFeaturedCtaLabel = useEditableValue(`${entryPrefix}.cta`, 'Conheça todos os cursos', { pageKey })

  return (
    <section id={sectionId} className="bg-white py-16 sm:py-20">
      <div className="public-site-container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#15323B] sm:text-[2.25rem]">
              <EditableText entryKey={`${entryPrefix}.title`} fallback="Novidades" label="Título de cursos em destaque" pageKey={pageKey} />
            </h2>
          </div>

          <EditableButton
            entryKey={`${entryPrefix}.cta`}
            fallback={{ label: legacyFeaturedCtaLabel, href: '/cursos', isInternal: true, tone: 'solid' }}
            label="CTA de cursos em destaque"
            pageKey={pageKey}
          >
            {(buttonValue) => buttonValue.isHidden === true ? null : (
              <GenflixCtaButton asChild className="min-h-[44px] px-4 text-[13px] self-start" tone={buttonValue.tone === 'surface' || buttonValue.tone === 'ghost' ? buttonValue.tone : 'solid'}>
                {buttonValue.isInternal === true ? (
                  <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/cursos'}>
                    {typeof buttonValue.label === 'string' ? buttonValue.label : 'Conheça todos os cursos'}
                  </Link>
                ) : (
                  <a
                    href={typeof buttonValue.href === 'string' ? buttonValue.href : '#'}
                    target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                    rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                  >
                    {typeof buttonValue.label === 'string' ? buttonValue.label : 'Conheça todos os cursos'}
                  </a>
                )}
              </GenflixCtaButton>
            )}
          </EditableButton>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {genflixFeaturedCourses.map((course) => (
            <GenflixCourseCard key={course.slug} course={course} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function PublicHomePage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const homeSections = useEditableValue('home.layout.sections', homeLayoutFallback, { pageKey: 'home' })

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242B] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  const visibleSections = homeSections.filter(isEditableItemVisible)
  const templateOccurrences = new Map<string, number>()

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section className="border-b border-white/10 bg-[linear-gradient(90deg,#1C7082_0%,#0F5562_100%)]">
        <div className="public-site-container">
          <GenflixPublicHeader currentPage="home" navLinks={genflixNavLinks} />
        </div>
      </section>

      <HomeStructureControl sections={homeSections} />

      {visibleSections.map((section) => {
        const metadata = getHomeSectionMetadata(section)
        const templateKey = typeof metadata.templateKey === 'string' ? metadata.templateKey : 'hero'
        const occurrence = templateOccurrences.get(templateKey) ?? 0
        templateOccurrences.set(templateKey, occurrence + 1)
        const entryPrefix = resolveHomeSectionPrefix(section, templateKey)
        const pageKey = resolveHomeSectionPageKey(section, templateKey)

        if (templateKey === 'hero') {
          return <HomeHeroSection key={section.id} entryPrefix={entryPrefix} sectionId={occurrence === 0 ? 'inicio' : `inicio-${occurrence + 1}`} pageKey={pageKey} />
        }

        if (templateKey === 'categories') {
          return <HomeCategoriesSection key={section.id} entryPrefix={entryPrefix} pageKey={pageKey} />
        }

        if (templateKey === 'featured') {
          return <HomeFeaturedSection key={section.id} entryPrefix={entryPrefix} sectionId={occurrence === 0 ? 'destaques' : `destaques-${occurrence + 1}`} pageKey={pageKey} />
        }

        if (templateKey === 'newsletter') {
          return <GenflixNewsletterSection key={section.id} id={occurrence === 0 ? 'newsletter' : `newsletter-${occurrence + 1}`} entryPrefix={entryPrefix} pageKey={pageKey} />
        }

        return null
      })}

      <GenflixPublicFooter />
    </main>
  )
}
