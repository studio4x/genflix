import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import {
  genflixBlogPosts,
  genflixNavLinks,
  getGenflixBlogPostBySlug,
  type GenflixBlogPost,
} from '@/features/public/genflix-site-content'
import {
  fetchPublicBlogPostFromSupabase,
  fetchPublicBlogPostsFromSupabase,
} from '@/features/public/genflix-public-content-api'
import { supabase } from '@/services/supabase/client'

type DraftBlogPostRow = {
  slug: string
  title: string
  category: string | null
  excerpt: string | null
  image_url: string | null
  read_time: string | null
  author: string | null
  published_at: string | null
  content: unknown
  featured: boolean | null
  status: string | null
}

function toPostContent(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      }
      return typeof item === 'string' ? item : ''
    })
    .filter(Boolean)
}

function mapDraftRowToBlogPost(row: DraftBlogPostRow): GenflixBlogPost {
  return {
    slug: row.slug,
    title: row.title,
    category: row.category ?? 'GenFlix',
    excerpt: row.excerpt ?? '',
    image: row.image_url ?? '/images/genflix/home/featured-2.jpg',
    readTime: row.read_time ?? '5 min',
    author: row.author ?? 'Equipe GenFlix',
    publishedAt: row.published_at
      ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(row.published_at))
      : '',
    content: toPostContent(row.content),
    featured: Boolean(row.featured),
  }
}

export function PublicBlogPostPage() {
  const { slug = '' } = useParams()
  const { isLoading, user, roles } = useAuth()
  const isAdmin = roles.includes('admin')
  const waitingRoleResolution = !!user && roles.length === 0
  const [post, setPost] = useState<GenflixBlogPost | null>(() => getGenflixBlogPostBySlug(slug))
  const [relatedPosts, setRelatedPosts] = useState<GenflixBlogPost[]>(() =>
    genflixBlogPosts.filter((item) => item.slug !== slug).slice(0, 3),
  )
  const [isLoadingPost, setIsLoadingPost] = useState(true)
  const [isDraftPreview, setIsDraftPreview] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadPost() {
      setIsLoadingPost(true)
      try {
        const [publicPost, publicPosts] = await Promise.all([
          fetchPublicBlogPostFromSupabase(slug),
          fetchPublicBlogPostsFromSupabase(),
        ])

        let resolvedPost = publicPost
        let draftPreview = false

        if (!resolvedPost && isAdmin) {
          const previewResult = await supabase
            .from('blog_posts')
            .select('slug, title, category, excerpt, image_url, read_time, author, published_at, content, featured, status')
            .eq('slug', slug)
            .maybeSingle()

          if (!previewResult.error && previewResult.data) {
            resolvedPost = mapDraftRowToBlogPost(previewResult.data as DraftBlogPostRow)
            draftPreview = (previewResult.data as DraftBlogPostRow).status !== 'published'
          }
        }

        if (isMounted) {
          setPost(resolvedPost ?? getGenflixBlogPostBySlug(slug))
          setIsDraftPreview(draftPreview)
          setRelatedPosts(
            (publicPosts.length > 0 ? publicPosts : genflixBlogPosts)
              .filter((item) => item.slug !== slug)
              .slice(0, 3),
          )
        }
      } catch {
        if (isMounted) {
          setPost(getGenflixBlogPostBySlug(slug))
          setIsDraftPreview(false)
          setRelatedPosts(genflixBlogPosts.filter((item) => item.slug !== slug).slice(0, 3))
        }
      } finally {
        if (isMounted) {
          setIsLoadingPost(false)
        }
      }
    }

    void loadPost()

    return () => {
      isMounted = false
    }
  }, [isAdmin, slug])

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  if (isLoadingPost && !post) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando artigo...</p>
      </main>
    )
  }

  if (!post) {
    return <Navigate to="/blog" replace />
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="blog" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="blog-post" placementKey="hero" />

      <section className="bg-white pb-10 pt-6">
        <div className="public-site-container">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o blog
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1398B7]">
                  {post.category}
                </span>
                {isDraftPreview ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    Preview de rascunho (admin)
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#91a2a7]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {post.readTime}
                </span>
              </div>

              <h1 className="mt-5 max-w-[840px] text-[2.45rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-[#183139] sm:text-[2.95rem]">
                {post.title}
              </h1>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[#6f8187]">
                <span className="font-semibold text-[#183139]">{post.author}</span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#1398B7]" />
                  {post.publishedAt}
                </span>
              </div>

              <div className="mt-8 overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] shadow-[0_18px_40px_rgba(21,50,59,0.05)]">
                <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
              </div>

              <div className="mt-10 space-y-6 rounded-[28px] border border-[#D8E6EB] bg-white px-7 py-8 shadow-[0_16px_40px_rgba(21,50,59,0.04)] sm:px-10">
                <p className="text-lg leading-8 text-[#52676e]">{post.excerpt}</p>
                {post.content.map((paragraph) => (
                  <p key={paragraph} className="text-[15px] leading-8 text-[#52676e]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>

            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-[26px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_18px_40px_rgba(21,50,59,0.05)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#1398B7]">Resumo do artigo</p>
                <h2 className="mt-4 text-xl font-bold tracking-[-0.03em] text-[#183139]">{post.title}</h2>
                <p className="mt-4 text-sm leading-7 text-[#667980]">{post.excerpt}</p>
              </div>

              <div className="rounded-[26px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_18px_40px_rgba(21,50,59,0.05)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#1398B7]">Continuar explorando</p>
                <div className="mt-5 space-y-5">
                  {relatedPosts.map((item) => (
                    <article key={item.slug} className="rounded-[20px] border border-[#D8E6EB] bg-[#F2F7F9] p-4">
                      <span className="rounded-full bg-[#E8F6FA] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1398B7]">
                        {item.category}
                      </span>
                      <h3 className="mt-3 text-base font-bold leading-6 text-[#183139]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#6b7d84]">{item.excerpt}</p>
                      <Link
                        to={`/blog/${item.slug}`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1398B7] transition-colors hover:text-[#1398B7]"
                      >
                        Ler artigo
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <GenflixNewsletterSection />
      <GenflixPublicFooter />
    </main>
  )
}
