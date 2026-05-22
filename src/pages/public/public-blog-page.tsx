import { useEffect, useMemo, useState } from 'react'
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
import { fetchPublicBlogPostsFromSupabase } from '@/features/public/genflix-public-content-api'
import { fetchSiteContent } from '@/features/site-editor/api'
import { cn } from '@/lib/utils'

const POSTS_PER_PAGE = 6

export function PublicBlogPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [selectedFilter, setSelectedFilter] = useState<(typeof genflixBlogFilters)[number]>('Todos')
  const [currentPage, setCurrentPage] = useState(1)
  const [posts, setPosts] = useState<GenflixBlogPost[]>(genflixBlogPosts)
  const [sidebarImageUrl, setSidebarImageUrl] = useState('')
  const [sidebarImageAlt, setSidebarImageAlt] = useState('')

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

    async function loadSidebarImage() {
      try {
        const entries = await fetchSiteContent('blog')
        const imageEntry = entries.find((entry) => entry.page_key === 'blog' && entry.entry_key === 'blog.sidebar.image')
        const value = imageEntry?.value

        if (!isMounted) {
          return
        }

        if (typeof value === 'string') {
          setSidebarImageUrl(value)
          setSidebarImageAlt('')
          return
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const record = value as Record<string, unknown>
          setSidebarImageUrl(typeof record.url === 'string' ? record.url : '')
          setSidebarImageAlt(typeof record.alt === 'string' ? record.alt : '')
          return
        }

        setSidebarImageUrl('')
        setSidebarImageAlt('')
      } catch {
        if (isMounted) {
          setSidebarImageUrl('')
          setSidebarImageAlt('')
        }
      }
    }

    void loadSidebarImage()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedFilter === 'Todos') {
        return true
      }
      if (selectedFilter === 'Psicologia') {
        return post.category === 'Psicologia'
      }
      return post.category === selectedFilter
    })
  }, [posts, selectedFilter])

  const listingPosts = filteredPosts
  const pageCount = Math.max(1, Math.ceil(listingPosts.length / POSTS_PER_PAGE))
  const visibleCurrentPage = Math.min(currentPage, pageCount)

  const paginatedPosts = useMemo(() => {
    const start = (visibleCurrentPage - 1) * POSTS_PER_PAGE
    return listingPosts.slice(start, start + POSTS_PER_PAGE)
  }, [visibleCurrentPage, listingPosts])

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white font-manrope text-[#1f2e39]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-12 pt-10">
        <div className="public-site-container">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_224px]">
            <div>
              <BannerPlacementSlot pageKey="blog" placementKey="hero" />
            </div>

            <aside className="space-y-8">
              {sidebarImageUrl.trim() ? (
                <img
                  src={sidebarImageUrl}
                  alt={sidebarImageAlt || 'Imagem lateral do blog'}
                  className="h-[290px] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-[290px] bg-[#23b6a1]" />
              )}
              <div>
                <h2 className="text-3xl font-semibold leading-tight text-[#ff7a00]">Áreas do blog</h2>
                <div className="mt-6 flex items-center gap-8">
                  <span className="h-px flex-1 bg-[#3b3b3b]" />
                  <span className="h-px flex-1 bg-[#3b3b3b]" />
                </div>
                <div className="mt-8 space-y-3 text-lg leading-none text-[#2f4b7d]">
                  {genflixBlogFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setSelectedFilter(filter)
                        setCurrentPage(1)
                      }}
                      className={cn('block text-left transition-colors', selectedFilter === filter ? 'text-[#ff7a00]' : 'hover:text-[#ff7a00]')}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="public-site-container">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {paginatedPosts.map((post) => (
              <article key={post.slug} className="overflow-hidden rounded-[4px] border border-[#dfdfdf] bg-[#f5f5f5] shadow-sm">
                <div className="aspect-[16/9] overflow-hidden">
                  <img src={post.image} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
                </div>

                <div className="p-7">
                  <h3 className="text-2xl font-semibold leading-tight text-[#243a64]">{post.title}</h3>
                  <p className="mt-4 line-clamp-6 text-base leading-7 text-[#20364f]">{post.excerpt}</p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="mt-6 inline-flex items-center gap-1 text-sm font-semibold uppercase tracking-[0.08em] text-[#ff7a00] hover:text-[#e86f00]"
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
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
