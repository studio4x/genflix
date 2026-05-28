import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixBlogFilters,
  genflixBlogPosts,
  genflixNavLinks,
  type GenflixBlogPost,
} from '@/features/public/genflix-site-content'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import {
  fetchPublicBlogCategoriesFromSupabase,
  fetchPublicBlogPostsFromSupabase,
} from '@/features/public/genflix-public-content-api'
import { createDefaultBlogStyleSettings, normalizeBlogStyleSettings, type BlogStyleSettings } from '@/features/blog/blog-style-settings'
import { fetchSiteContent } from '@/features/site-editor/api'
import { EditableText, useSiteContentScope } from '@/features/site-editor/visual-editor'
import { fixMojibakeText } from '@/lib/text-encoding'
import { cn } from '@/lib/utils'

const POSTS_PER_PAGE = 6
const SIDEBAR_SLIDE_INTERVAL_MS = 4000

type BlogSidebarImageSlide = {
  url: string
  alt: string
  linkUrl: string
}

type BlogSidebarImageMode = 'single' | 'carousel'

type BlogSidebarBlock = {
  mode: BlogSidebarImageMode
  slides: BlogSidebarImageSlide[]
}

type BlogCategoryFilter = {
  id: string
  name: string
  slug: string
}

function normalizeFilterValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function slugifyFilterValue(value: string) {
  return normalizeFilterValue(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function matchesPostCategory(postCategory: string | null, filter: BlogCategoryFilter) {
  const normalizedPostCategory = normalizeFilterValue(postCategory ?? '')
  const normalizedFilterName = normalizeFilterValue(filter.name)
  const normalizedFilterSlug = normalizeFilterValue(filter.slug)
  const normalizedFilterId = normalizeFilterValue(filter.id)

  return (
    normalizedPostCategory === normalizedFilterId ||
    normalizedPostCategory === normalizedFilterName ||
    normalizedPostCategory === normalizedFilterSlug ||
    normalizedPostCategory === slugifyFilterValue(filter.name) ||
    normalizedPostCategory === slugifyFilterValue(filter.slug)
  )
}

function getGridCoverImageUrl(imageUrl: string) {
  if (!imageUrl.trim()) {
    return imageUrl
  }

  try {
    const parsed = new URL(imageUrl)
    const storageMarker = '/storage/v1/object/public/'
    const renderMarker = '/storage/v1/render/image/public/'

    if (parsed.pathname.includes(storageMarker)) {
      parsed.pathname = parsed.pathname.replace(storageMarker, renderMarker)
      parsed.searchParams.set('width', '960')
      parsed.searchParams.set('height', '720')
      parsed.searchParams.set('resize', 'cover')
      parsed.searchParams.set('quality', '72')
      parsed.searchParams.set('format', 'webp')
      return parsed.toString()
    }

    if (parsed.pathname.includes(renderMarker)) {
      parsed.searchParams.set('width', '960')
      parsed.searchParams.set('height', '720')
      parsed.searchParams.set('resize', 'cover')
      parsed.searchParams.set('quality', '72')
      parsed.searchParams.set('format', 'webp')
      return parsed.toString()
    }
  } catch {
    return imageUrl
  }

  return imageUrl
}

export function PublicBlogPage() {
  const { isLoading, user, roles } = useAuth()
  const siteContentScope = useSiteContentScope()
  const waitingRoleResolution = !!user && roles.length === 0
  const waitingSiteContent = siteContentScope?.isReady === false
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [posts, setPosts] = useState<GenflixBlogPost[]>(genflixBlogPosts)
  const [blogCategories, setBlogCategories] = useState<BlogCategoryFilter[]>([])
  const [sidebarBlocks, setSidebarBlocks] = useState<BlogSidebarBlock[]>([])
  const [sidebarCarouselTick, setSidebarCarouselTick] = useState(0)
  const [blogStyleSettings, setBlogStyleSettings] = useState<BlogStyleSettings>(createDefaultBlogStyleSettings())

  useEffect(() => {
    let isMounted = true

    async function loadPosts() {
      try {
        const publicPosts = await fetchPublicBlogPostsFromSupabase()
        if (isMounted && publicPosts.length > 0) {
          setPosts(publicPosts)
        }
      } catch {
        if (isMounted) {
          setPosts(genflixBlogPosts)
        }
      }
    }

    void loadPosts()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadStyleSettings() {
      try {
        const entries = await fetchSiteContent('blog')
        const styleEntry = entries.find((entry) => entry.page_key === 'blog' && entry.entry_key === 'blog.style.settings')
        if (!isMounted) {
          return
        }
        setBlogStyleSettings(normalizeBlogStyleSettings(styleEntry?.value))
      } catch {
        if (isMounted) {
          setBlogStyleSettings(createDefaultBlogStyleSettings())
        }
      }
    }

    void loadStyleSettings()
    return () => {
      isMounted = false
    }
  }, [])

  const blogGridStyleVars = useMemo(() => {
    const card = blogStyleSettings.card
    return {
      '--blog-card-bg': card.container.backgroundColor || undefined,
      '--blog-card-border': card.container.borderColor || undefined,
      '--blog-card-radius': card.container.borderRadius || undefined,
      '--blog-card-padding': card.container.padding || undefined,
      '--blog-card-min-height': card.container.minHeight || undefined,
      '--blog-card-image-fit': card.container.imageObjectFit || undefined,
      '--blog-card-title-font-family': card.text.title.fontFamily || undefined,
      '--blog-card-title-font-size': card.text.title.fontSize || undefined,
      '--blog-card-title-font-weight': card.text.title.fontWeight || undefined,
      '--blog-card-title-line-height': card.text.title.lineHeight || undefined,
      '--blog-card-title-letter-spacing': card.text.title.letterSpacing || undefined,
      '--blog-card-title-color': card.text.title.color || undefined,
      '--blog-card-description-font-family': card.text.description.fontFamily || undefined,
      '--blog-card-description-font-size': card.text.description.fontSize || undefined,
      '--blog-card-description-font-weight': card.text.description.fontWeight || undefined,
      '--blog-card-description-line-height': card.text.description.lineHeight || undefined,
      '--blog-card-description-letter-spacing': card.text.description.letterSpacing || undefined,
      '--blog-card-description-color': card.text.description.color || undefined,
      '--blog-card-link-font-family': card.text.link.fontFamily || undefined,
      '--blog-card-link-font-size': card.text.link.fontSize || undefined,
      '--blog-card-link-font-weight': card.text.link.fontWeight || undefined,
      '--blog-card-link-line-height': card.text.link.lineHeight || undefined,
      '--blog-card-link-letter-spacing': card.text.link.letterSpacing || undefined,
      '--blog-card-link-color': card.text.link.color || undefined,
    } as CSSProperties
  }, [blogStyleSettings])

  useEffect(() => {
    let isMounted = true

    async function loadBlogCategories() {
      try {
        const rows = await fetchPublicBlogCategoriesFromSupabase()
        if (isMounted && rows.length > 0) {
          setBlogCategories(rows)
          return
        }
      } catch {
        // fallback abaixo
      }

      if (isMounted) {
        setBlogCategories(
          genflixBlogFilters
            .filter((filter) => filter !== 'Todos')
            .map((name) => ({
              id: slugifyFilterValue(name),
              name,
              slug: slugifyFilterValue(name),
            })),
        )
      }
    }

    void loadBlogCategories()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (selectedFilter === 'all' || blogCategories.length === 0) {
      return
    }

    const normalizedSelectedFilter = normalizeFilterValue(selectedFilter)
    const matchedCategory = blogCategories.find((category) => {
      return (
        normalizeFilterValue(category.id) === normalizedSelectedFilter ||
        normalizeFilterValue(category.name) === normalizedSelectedFilter ||
        normalizeFilterValue(category.slug) === normalizedSelectedFilter ||
        slugifyFilterValue(category.name) === selectedFilter ||
        slugifyFilterValue(category.slug) === selectedFilter
      )
    })

    if (matchedCategory && matchedCategory.id !== selectedFilter) {
      setSelectedFilter(matchedCategory.id)
    }
  }, [blogCategories, selectedFilter])

  useEffect(() => {
    let isMounted = true

    async function loadSidebarImage() {
      try {
        const entries = await fetchSiteContent('blog')
        const imageEntry = entries.find((entry) => entry.page_key === 'blog' && entry.entry_key === 'blog.sidebar.image')
        const value = imageEntry?.value

        if (!isMounted) {
          return
        }

        if (typeof value === 'string') {
          setSidebarBlocks([{ mode: 'single', slides: [{ url: value, alt: '', linkUrl: '' }] }])
          return
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const record = value as Record<string, unknown>
          const blocksValue = Array.isArray(record.blocks) ? record.blocks : []
          const parsedBlocks = blocksValue
            .map((block) => {
              if (!block || typeof block !== 'object' || Array.isArray(block)) {
                return null
              }
              const mappedBlock = block as Record<string, unknown>
              const parsedSlides = (Array.isArray(mappedBlock.slides) ? mappedBlock.slides : [])
                .map((slide) => {
                  if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
                    return null
                  }
                  const image = slide as Record<string, unknown>
                  return {
                    url: typeof image.url === 'string' ? image.url : '',
                    alt: typeof image.alt === 'string' ? image.alt : '',
                    linkUrl: typeof image.linkUrl === 'string' ? image.linkUrl : '',
                  } satisfies BlogSidebarImageSlide
                })
                .filter((slide): slide is BlogSidebarImageSlide => Boolean(slide && slide.url))

              if (parsedSlides.length === 0) {
                return null
              }

              return {
                mode: mappedBlock.mode === 'carousel' ? 'carousel' : 'single',
                slides: parsedSlides,
              } satisfies BlogSidebarBlock
            })
            .filter((block): block is BlogSidebarBlock => Boolean(block))

          if (parsedBlocks.length > 0) {
            setSidebarBlocks(parsedBlocks)
            setSidebarCarouselTick(0)
            return
          }

          const slidesValue = Array.isArray(record.slides) ? record.slides : []
          const parsedSlides = slidesValue
            .map((slide) => {
              if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
                return null
              }
              const image = slide as Record<string, unknown>
              return {
                url: typeof image.url === 'string' ? image.url : '',
                alt: typeof image.alt === 'string' ? image.alt : '',
                linkUrl: typeof image.linkUrl === 'string' ? image.linkUrl : '',
              } satisfies BlogSidebarImageSlide
            })
            .filter((slide): slide is BlogSidebarImageSlide => Boolean(slide && slide.url))

          if (parsedSlides.length > 0) {
            setSidebarBlocks([{ mode: record.mode === 'carousel' ? 'carousel' : 'single', slides: parsedSlides }])
            setSidebarCarouselTick(0)
            return
          }

          const legacyUrl = typeof record.url === 'string' ? record.url : ''
          if (legacyUrl) {
            setSidebarBlocks([{
              mode: 'single',
              slides: [{
                url: legacyUrl,
                alt: typeof record.alt === 'string' ? record.alt : '',
                linkUrl: typeof record.linkUrl === 'string' ? record.linkUrl : '',
              }],
            }])
            setSidebarCarouselTick(0)
            return
          }
          setSidebarBlocks([])
          setSidebarCarouselTick(0)
          return
        }

        setSidebarBlocks([])
        setSidebarCarouselTick(0)
      } catch {
        if (isMounted) {
          setSidebarBlocks([])
          setSidebarCarouselTick(0)
        }
      }
    }

    void loadSidebarImage()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const hasCarousel = sidebarBlocks.some((block) => block.mode === 'carousel' && block.slides.length > 1)
    if (!hasCarousel) {
      return
    }

    const intervalId = window.setInterval(() => {
      setSidebarCarouselTick((current) => current + 1)
    }, SIDEBAR_SLIDE_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [sidebarBlocks])

  const filteredPosts = useMemo(() => {
    if (selectedFilter === 'all') {
      return posts
    }

    const selectedCategory = blogCategories.find((category) => category.id === selectedFilter)
    return posts.filter((post) => {
      if (selectedCategory) {
        return matchesPostCategory(post.category, selectedCategory)
      }

      return normalizeFilterValue(post.category ?? '') === normalizeFilterValue(selectedFilter)
    })
  }, [blogCategories, posts, selectedFilter])

  const categoryFilters = useMemo(() => {
    if (blogCategories.length > 0) {
      return blogCategories
    }

    return genflixBlogFilters
      .filter((filter) => filter !== 'Todos')
      .map((name) => ({
        id: slugifyFilterValue(name),
        name,
        slug: slugifyFilterValue(name),
      }))
  }, [blogCategories])

  const listingPosts = filteredPosts
  const pageCount = Math.max(1, Math.ceil(listingPosts.length / POSTS_PER_PAGE))
  const visibleCurrentPage = Math.min(currentPage, pageCount)

  const paginatedPosts = useMemo(() => {
    const start = (visibleCurrentPage - 1) * POSTS_PER_PAGE
    return listingPosts.slice(start, start + POSTS_PER_PAGE)
  }, [visibleCurrentPage, listingPosts])

  if (isLoading || waitingRoleResolution || waitingSiteContent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white font-manrope text-[#1f2e39]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-16 pt-10">
        <div className="public-site-container">
          <div className="space-y-10">
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-[#243a64] sm:text-5xl">
                <EditableText entryKey="blog.hero.title" fallback="Blog GenFlix" label="Título da página Blog" pageKey="blog" />
              </h1>
              <p className="mt-3 text-base leading-7 text-[#20364f] sm:text-lg">
                <EditableText
                  entryKey="blog.hero.subtitle"
                  fallback="Conteúdos para aprofundar seu aprendizado e aplicar o conhecimento com mais confiança."
                  label="Subtítulo da página Blog"
                  pageKey="blog"
                />
              </p>
            </div>

            <BannerPlacementSlot pageKey="blog" placementKey="hero" />

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_224px]">
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-4 text-[#1f2e39]">
                  <span className="text-base font-medium leading-none sm:text-lg">Filtre por Áreas:</span>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[18px] leading-none sm:gap-x-5 sm:text-[20px]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFilter('all')
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[16px] font-semibold leading-none transition-colors sm:text-[17px]',
                        selectedFilter === 'all'
                          ? 'border-[#ff7a00] bg-[#ff7a00] text-white'
                          : 'border-[#ffb57a] bg-[#fff3e8] text-[#ff7a00] hover:border-[#ff7a00] hover:bg-[#ffe6d0]',
                      )}
                    >
                      Todos
                    </button>

                    {categoryFilters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => {
                          setSelectedFilter(filter.id)
                          setCurrentPage(1)
                        }}
                        className={cn(
                          'whitespace-nowrap text-[18px] leading-none transition-colors sm:text-[20px]',
                          selectedFilter === filter.id ? 'text-[#ff7a00]' : 'hover:text-[#ff7a00]',
                        )}
                      >
                        {filter.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="blog-grid-theme grid gap-8 md:grid-cols-2 xl:grid-cols-3" style={blogGridStyleVars}>
                  {paginatedPosts.map((post) => (
                    <article key={post.slug} className="blog-grid-card flex h-full flex-col overflow-hidden rounded-[4px] border border-[#dfdfdf] bg-[#f5f5f5] shadow-sm">
                      <div className="aspect-[1920/500] overflow-hidden">
                        <img
                          src={getGridCoverImageUrl((post as GenflixBlogPost & { cardImage?: string }).cardImage ?? post.image)}
                          alt={post.title}
                          className="blog-grid-card-image h-full w-full object-cover object-center bg-[#e9ecef]"
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                        />
                      </div>

                      <div className="blog-grid-card-content flex min-h-[360px] flex-1 flex-col p-7">
                        <h3 className="blog-grid-card-title text-2xl font-semibold leading-tight text-[#243a64]">
                          <Link to={`/blog/${post.slug}`} className="transition-colors hover:text-[#ff7a00]">
                            {fixMojibakeText(post.title)}
                          </Link>
                        </h3>
                        <p className="blog-grid-card-description mt-4 min-h-[10.5rem] line-clamp-6 text-base leading-7 text-[#20364f]">
                          {fixMojibakeText(post.seoDescription)}
                        </p>
                        <Link
                          to={`/blog/${post.slug}`}
                          className="blog-grid-card-link mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold uppercase tracking-[0.08em] text-[#ff7a00] hover:text-[#e86f00]"
                        >
                          Leia mais
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>

                {paginatedPosts.length === 0 ? (
                  <div className="mt-10 rounded-[4px] border border-dashed border-[#d8d8d8] bg-[#f8f8f8] px-6 py-12 text-center">
                    <p className="text-lg font-semibold text-[#20364f]">Nenhum artigo encontrado com esse filtro.</p>
                  </div>
                ) : null}

                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={visibleCurrentPage === 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8d8d8] bg-white text-[#20364f] transition-colors hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-40"
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
                          ? 'border-[#243a64] bg-[#243a64] text-white'
                          : 'border-[#d8d8d8] bg-white text-[#20364f] hover:bg-[#f4f4f4]',
                      )}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                    disabled={visibleCurrentPage === pageCount}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8d8d8] bg-white text-[#20364f] transition-colors hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <aside className="space-y-6">
                {sidebarBlocks.length > 0 ? sidebarBlocks.map((block, blockIndex) => {
                  const hasCarousel = block.mode === 'carousel' && block.slides.length > 1
                  const activeSlideIndex = hasCarousel ? (sidebarCarouselTick % block.slides.length) : 0
                  const fallbackSlide = block.slides[0]

                  if (!fallbackSlide?.url) {
                    return <div key={`sidebar-block-${blockIndex}`} className="aspect-[7/10] w-full bg-[#23b6a1]" />
                  }

                  if (!hasCarousel) {
                    return fallbackSlide.linkUrl.trim() ? (
                      <a key={`sidebar-block-${blockIndex}`} href={fallbackSlide.linkUrl} className="block cursor-pointer">
                        <img
                          src={fallbackSlide.url}
                          alt={fallbackSlide.alt || 'Imagem lateral do blog'}
                          className="aspect-[7/10] w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <img
                        key={`sidebar-block-${blockIndex}`}
                        src={fallbackSlide.url}
                        alt={fallbackSlide.alt || 'Imagem lateral do blog'}
                        className="aspect-[7/10] w-full object-cover"
                        loading="lazy"
                      />
                    )
                  }

                  return (
                    <div key={`sidebar-block-${blockIndex}`} className="aspect-[7/10] w-full overflow-hidden">
                      <div
                        className="flex h-full w-full transition-transform duration-700 ease-in-out"
                        style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
                      >
                        {block.slides.map((slide, slideIndex) => (
                          <div key={`sidebar-block-${blockIndex}-slide-${slideIndex}`} className="h-full w-full shrink-0">
                            {slide.linkUrl.trim() ? (
                              <a href={slide.linkUrl} className="block h-full w-full cursor-pointer">
                                <img
                                  src={slide.url}
                                  alt={slide.alt || 'Imagem lateral do blog'}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ) : (
                              <img
                                src={slide.url}
                                alt={slide.alt || 'Imagem lateral do blog'}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }) : (
                  <div className="aspect-[7/10] w-full bg-[#23b6a1]" />
                )}
              </aside>
            </div>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}

