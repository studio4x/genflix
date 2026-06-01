import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixCourseCard } from '@/components/public/genflix-course-card'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import {
  genflixCatalogCourses,
  genflixNavLinks,
  type GenflixCourseItem,
} from '@/features/public/genflix-site-content'
import {
  fetchPublicCourseCategoriesFromSupabase,
  fetchPublicCoursesFromSupabase,
} from '@/features/public/genflix-public-content-api'
import {
  genflixStudyFeatureCardsFallback,
  genflixStudyFeatureCardsSchema,
  resolveStudyFeatureIconKey,
} from '@/features/public/genflix-study-feature-editor'
import {
  createSectionRegistryFallback,
  createSectionRegistrySchema,
  renderVisibleSectionList,
  resolveSectionRegistryEntryPrefix,
  resolveSectionRegistryPageKey,
  resolveSectionRegistryTemplateKey,
  SectionStructureControl,
} from '@/features/site-editor/section-registry'
import {
  EditableContainer,
  EditableButton,
  EditableList,
  EditableText,
  isEditableItemVisible,
  useEditableValue,
} from '@/features/site-editor/visual-editor'
import { renderSiteIconVisual } from '@/features/site-editor/site-icons'
import { cn } from '@/lib/utils'

const COURSES_PER_PAGE = 6

const coursesSectionTemplates = [
  {
    id: 'hero',
    label: 'Hero da p?gina Cursos',
    description: 'Bloco de abertura com busca e filtros da p?gina Cursos.',
  },
  {
    id: 'catalog',
    label: 'Catalogo de cursos',
    description: 'Bloco principal com a grade de cursos e paginacao.',
  },
  {
    id: 'features',
    label: 'Recursos em cursos',
    description: 'Bloco com recursos da plataforma e CTA final.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Bloco de captacao ao final da p?gina Cursos.',
    pageKey: 'global' as const,
  },
]

const coursesLayoutFallback = createSectionRegistryFallback(coursesSectionTemplates)
const coursesLayoutSchema = createSectionRegistrySchema({
  templates: coursesSectionTemplates,
  instancePrefix: 'courses.sections',
  instancePageKey: 'courses',
})

export function PublicCoursesPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [query, setQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('Todos')
  const [currentPage, setCurrentPage] = useState(1)
  const [courses, setCourses] = useState<GenflixCourseItem[]>(genflixCatalogCourses)
  const [configuredCategories, setConfiguredCategories] = useState<string[]>([])
  const coursesSections = useEditableValue('courses.layout.sections', coursesLayoutFallback, { pageKey: 'courses' })
  const searchPlaceholder = useEditableValue('courses.search.placeholder', 'Buscar curso, area ou instrutor...', { pageKey: 'courses' })

  useEffect(() => {
    let isMounted = true

    async function loadCourses() {
      try {
        const [publicCourses, publicCategories] = await Promise.all([
          fetchPublicCoursesFromSupabase(),
          fetchPublicCourseCategoriesFromSupabase(),
        ])
        if (isMounted && publicCourses.length > 0) {
          setCourses(publicCourses)
        }
        if (isMounted) {
          setConfiguredCategories(publicCategories)
        }
      } catch {
        if (isMounted) {
          setCourses(genflixCatalogCourses)
        }
      }
    }

    void loadCourses()

    return () => {
      isMounted = false
    }
  }, [])

  const availableFilters = useMemo(() => {
    if (configuredCategories.length > 0) {
      return ['Todos', ...configuredCategories]
    }

    const categoriesByKey = new Map<string, string>()

    for (const course of courses) {
      const category = course.category.trim()
      if (!category) {
        continue
      }

      const normalizedCategory = category.toLocaleLowerCase('pt-BR')
      if (!categoriesByKey.has(normalizedCategory)) {
        categoriesByKey.set(normalizedCategory, category)
      }
    }

    const categories = [...categoriesByKey.values()].sort((left, right) => left.localeCompare(right, 'pt-BR'))
    return ['Todos', ...categories]
  }, [configuredCategories, courses])

  useEffect(() => {
    if (!availableFilters.includes(selectedFilter)) {
      setSelectedFilter('Todos')
      setCurrentPage(1)
    }
  }, [availableFilters, selectedFilter])

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return courses.filter((course) => {
      const matchesFilter =
        selectedFilter === 'Todos'
          ? true
          : course.category.trim() === selectedFilter

      const matchesQuery = normalizedQuery
        ? [course.title, course.category, course.mentor, course.role]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery)
        : true

      return matchesFilter && matchesQuery
    })
  }, [courses, query, selectedFilter])

  const pageCount = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE))
  const visibleCurrentPage = Math.min(currentPage, pageCount)

  const paginatedCourses = useMemo(() => {
    const start = (visibleCurrentPage - 1) * COURSES_PER_PAGE
    return filteredCourses.slice(start, start + COURSES_PER_PAGE)
  }, [visibleCurrentPage, filteredCourses])

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  const visibleSections = coursesSections.filter(isEditableItemVisible)

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="courses" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="courses" placementKey="hero" />

      <SectionStructureControl
        buttonLabel="Gerenciar blocos da p?gina"
        pageKey="courses"
        entryKey="courses.layout.sections"
        label="Estrutura da p?gina Cursos"
        sections={coursesSections}
        schema={coursesLayoutSchema}
      />

      {renderVisibleSectionList(visibleSections, (item) => {
        const templateKey = resolveSectionRegistryTemplateKey(item)
        const sectionPageKey = resolveSectionRegistryPageKey(item, 'courses')
        const sectionEntryPrefix = resolveSectionRegistryEntryPrefix(item, `courses.sections.${templateKey}`)

        if (templateKey === 'hero') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Hero da p?gina Cursos" pageKey={sectionPageKey}>
              <section className="bg-white pb-14 pt-6">
                <div className="public-site-container">
                  <EditableContainer entryKey={`${sectionEntryPrefix}.card`} label="Container interno do Hero" pageKey={sectionPageKey}>
                    <div className="rounded-[4px] border border-[#D8E6EB] bg-[#F2F8FA] px-6 py-12 text-center shadow-[0_18px_40px_rgba(21,50,59,0.05)] sm:px-10">
                      <h1 className="mx-auto max-w-[520px] text-[2.45rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
                        <EditableText
                          entryKey="courses.hero.title"
                          fallback="Encontre o curso que vai mudar sua vida"
                          label="Titulo do catalogo"
                          pageKey={sectionPageKey}
                        />
                      </h1>

                      <div className="mx-auto mt-8 max-w-[1040px] space-y-4">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1398B7]" />
                          <input
                            value={query}
                            onChange={(event) => {
                              setQuery(event.target.value)
                              setCurrentPage(1)
                            }}
                            placeholder={searchPlaceholder}
                            className="h-14 w-full rounded-full border border-[#BEE3EA] bg-white pl-12 pr-5 text-sm text-[#183139] shadow-sm outline-none transition-colors placeholder:text-[#96a8ae] focus:border-[#1398B7]"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                          {availableFilters.map((filter) => (
                            <button
                              key={filter}
                              type="button"
                              onClick={() => {
                                setSelectedFilter(filter)
                                setCurrentPage(1)
                              }}
                              className={cn(
                                'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                selectedFilter === filter
                                  ? 'border-[#1398B7] bg-[#1398B7] text-white shadow-[0_10px_24px_rgba(19,152,183,0.22)]'
                                  : 'border-[#D8E6EB] bg-[#EBF3F5] text-[#15323B] hover:border-[#BEE3EA] hover:bg-[#E1EDF0] hover:text-[#15323B]',
                              )}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </EditableContainer>
                </div>
              </section>
            </EditableContainer>
          )
        }

        if (templateKey === 'catalog') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Catalogo da p?gina Cursos" pageKey={sectionPageKey}>
              <section className="bg-white pb-16">
                <EditableContainer entryKey={`${sectionEntryPrefix}.content`} label="Container interno do catalogo" pageKey={sectionPageKey}>
                  <div className="public-site-container">
                    <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                      {paginatedCourses.map((course) => (
                        <GenflixCourseCard key={course.slug} course={course} />
                      ))}
                    </div>

                    {filteredCourses.length === 0 ? (
                      <div className="mt-10 rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F2F8FA] px-6 py-12 text-center">
                        <p className="text-lg font-bold text-[#183139]">Nenhum curso encontrado com esse filtro.</p>
                        <p className="mt-3 text-sm text-[#6d7f85]">
                          <EditableText
                            entryKey="courses.empty.description"
                            fallback="Tente outra palavra-chave ou escolha uma categoria diferente."
                            label="Mensagem sem cursos"
                            pageKey={sectionPageKey}
                          />
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-10 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={visibleCurrentPage === 1}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#0A3640] transition-colors hover:bg-[#E8F6FA] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                            visibleCurrentPage === page
                              ? 'border-[#1398B7] bg-[#1398B7] text-white'
                              : 'border-[#D8E6EB] bg-white text-[#6d7f85] hover:bg-[#E8F6FA] hover:text-[#183139]',
                          )}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                        disabled={visibleCurrentPage === pageCount}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#0A3640] transition-colors hover:bg-[#E8F6FA] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </EditableContainer>
              </section>
            </EditableContainer>
          )
        }

        if (templateKey === 'features') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Recursos da p?gina Cursos" pageKey={sectionPageKey}>
              <section className="bg-[#F2F8FA] py-16">
                <EditableContainer entryKey={`${sectionEntryPrefix}.content`} label="Container interno de recursos" pageKey={sectionPageKey}>
                  <div className="public-site-container">
                    <div className="mx-auto max-w-[620px] text-center">
                      <h2 className="text-[2.1rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.35rem]">
                        <EditableText
                          entryKey="courses.features.title"
                          fallback="Muito alem do video"
                          label="Titulo de recursos em cursos"
                          pageKey={sectionPageKey}
                        />
                      </h2>
                      <p className="mt-3 text-base leading-7 text-[#183139]">
                        <EditableText
                          entryKey="courses.features.description"
                          fallback="Ferramentas pensadas para voc? aprender, fixar e revisar do seu jeito."
                          label="Descricao de recursos em cursos"
                          pageKey={sectionPageKey}
                        />
                      </p>
                    </div>

                    <EditableList
                      entryKey="courses.features.items"
                      fallback={genflixStudyFeatureCardsFallback}
                      label="Cards de recursos em cursos"
                      schema={genflixStudyFeatureCardsSchema}
                      pageKey={sectionPageKey}
                    >
                      {(items) => (
                        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                          {items.filter(isEditableItemVisible).map((item) => {
                            const iconColor = typeof item.metadata?.iconColor === 'string' ? item.metadata.iconColor : null
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
                            )
                          })}
                        </div>
                      )}
                    </EditableList>

                    <div className="mt-10 flex justify-center">
                      <EditableButton
                        entryKey="courses.features.cta"
                        fallback={{
                          label: 'Ver todos os recursos',
                          href: '/login',
                          isInternal: true,
                          tone: 'solid',
                        }}
                        label="CTA de recursos em cursos"
                        pageKey={sectionPageKey}
                      >
                        {(buttonValue) => buttonValue.isHidden === true ? null : (
                          <GenflixCtaButton asChild className="px-5 py-3">
                            {buttonValue.isInternal === true ? (
                              <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/login'}>
                                {typeof buttonValue.label === 'string' ? buttonValue.label : 'Ver todos os recursos'}
                              </Link>
                            ) : (
                              <a
                                href={typeof buttonValue.href === 'string' ? buttonValue.href : '/login'}
                                target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                                rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                              >
                                {typeof buttonValue.label === 'string' ? buttonValue.label : 'Ver todos os recursos'}
                              </a>
                            )}
                          </GenflixCtaButton>
                        )}
                      </EditableButton>
                    </div>
                  </div>
                </EditableContainer>
              </section>
            </EditableContainer>
          )
        }

        if (templateKey === 'newsletter') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Newsletter da p?gina Cursos" pageKey={sectionPageKey}>
              <GenflixNewsletterSection entryPrefix="courses.newsletter" pageKey={sectionPageKey} />
            </EditableContainer>
          )
        }

        return null
      })}

      <GenflixPublicFooter />
    </main>
  )
}
