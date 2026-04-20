import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixBlogFilters,
  genflixBlogPosts,
  genflixFeaturedBlogPost,
  genflixNavLinks,
  type GenflixBlogPost,
} from '@/features/public/genflix-site-content'
import { fetchPublicBlogPostsFromSupabase } from '@/features/public/genflix-public-content-api'
import { EditableText, useEditableValue } from '@/features/site-editor/visual-editor'
import { cn } from '@/lib/utils'

const POSTS_PER_PAGE = 6

export function PublicBlogPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [query, setQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<(typeof genflixBlogFilters)[number]>('Todos')
  const [currentPage, setCurrentPage] = useState(1)
  const [posts, setPosts] = useState<GenflixBlogPost[]>(genflixBlogPosts)
  const searchPlaceholder = useEditableValue('blog.search.placeholder', 'Buscar curso, área ou instrutor...')

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

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return posts.filter((post) => {
      const matchesFilter =
        selectedFilter === 'Todos'
          ? true
          : selectedFilter === 'Psicologia'
            ? post.category === 'Psicologia'
            : post.category === selectedFilter

      const matchesQuery = normalizedQuery
        ? [post.title, post.category, post.excerpt, post.author].join(' ').toLowerCase().includes(normalizedQuery)
        : true

      return matchesFilter && matchesQuery
    })
  }, [posts, query, selectedFilter])

  const featuredPost = filteredPosts.find((post) => post.featured) ?? filteredPosts[0] ?? genflixFeaturedBlogPost
  const listingPosts = filteredPosts.filter((post) => post.slug !== featuredPost.slug)
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
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section className="bg-[#F2F7F9] pt-4">
        <div className="public-site-container">
          <GenflixPublicHeader currentPage="blog" navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-12 pt-6">
        <div className="public-site-container">
          <div className="rounded-[28px] bg-[#F2F7F9] px-6 py-12 text-center shadow-[0_18px_40px_rgba(21,50,59,0.04)] sm:px-10">
            <h1 className="mx-auto max-w-[640px] text-[2.35rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.8rem]">
              <EditableText
                entryKey="blog.hero.title"
                fallback="Conteúdo feito por quem ensina, para quem quer ir além."
                label="Título do blog"
              />
            </h1>
            <p className="mx-auto mt-4 max-w-[620px] text-base leading-7 text-[#61737a]">
              <EditableText
                entryKey="blog.hero.description"
                fallback="Textos para quem aprende com curiosidade: dicas, reflexões e novidades das áreas que você estuda."
                label="Descrição do blog"
              />
            </p>

            <div className="mx-auto mt-8 max-w-[560px]">
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
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-14">
        <div className="public-site-container">
          <div className="grid gap-8 rounded-[26px] border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_36px_rgba(21,50,59,0.04)] lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:p-8">
            <div className="overflow-hidden rounded-[24px]">
              <img
                src={featuredPost.image}
                alt={featuredPost.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1398B7]">
                  {featuredPost.category}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#97a8ad]">
                  {featuredPost.readTime}
                </span>
              </div>

              <h2 className="mt-4 text-[1.7rem] font-bold leading-tight tracking-[-0.04em] text-[#183139]">
                {featuredPost.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#61737a]">{featuredPost.excerpt}</p>

              <div className="mt-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#183139]">{featuredPost.author}</p>
                  <p className="text-xs text-[#8ea0a6]">{featuredPost.publishedAt}</p>
                </div>

                <GenflixCtaButton asChild className="px-4 py-2">
                  <Link to={`/blog/${featuredPost.slug}`}>
                    <EditableText entryKey="blog.featured.cta" fallback="Ler artigo" label="CTA do artigo destacado" />
                  </Link>
                </GenflixCtaButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-16">
        <div className="public-site-container">
          <div className="flex flex-wrap items-center gap-3">
            {genflixBlogFilters.map((filter) => (
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
                    : 'border-[#D8E6EB] bg-white text-[#6d7f85] hover:border-[#BEE3EA] hover:text-[#183139]',
                )}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {paginatedPosts.map((post) => (
              <article
                key={post.slug}
                className="overflow-hidden rounded-[22px] border border-[#D8E6EB] bg-white shadow-[0_20px_50px_rgba(19,152,183,0.08)] transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(19,152,183,0.16)]"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={post.image} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1398B7]">
                      {post.category}
                    </span>
                    <span className="text-xs text-[#97a8ad]">{post.readTime}</span>
                  </div>

                  <h3 className="text-lg font-bold leading-tight text-[#183139]">{post.title}</h3>
                  <p className="text-sm leading-7 text-[#61737a]">{post.excerpt}</p>

                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]"
                  >
                    Ler artigo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {paginatedPosts.length === 0 ? (
            <div className="mt-10 rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F2F7F9] px-6 py-12 text-center">
              <p className="text-lg font-bold text-[#183139]">Nenhum artigo encontrado com esse filtro.</p>
              <p className="mt-3 text-sm text-[#6d7f85]">
                <EditableText
                  entryKey="blog.empty.description"
                  fallback="Tente outra palavra-chave ou escolha uma categoria diferente."
                  label="Mensagem sem artigos"
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
      </section>

      <GenflixNewsletterSection />
      <GenflixPublicFooter />
    </main>
  )
}
