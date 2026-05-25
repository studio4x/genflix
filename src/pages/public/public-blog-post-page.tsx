import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeftCircle, Send } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixNavLinks,
  getGenflixBlogPostBySlug,
  type GenflixBlogPost,
} from '@/features/public/genflix-site-content'
import { fetchPublicBlogPostFromSupabase } from '@/features/public/genflix-public-content-api'
import { supabase } from '@/services/supabase/client'

type DraftBlogPostRow = {
  id?: string
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

type AdminPreviewPayload = {
  slug: string
  title: string
  category?: string
  excerpt?: string
  image?: string
  readTime?: string
  author?: string
  publishedAt?: string | null
  contentHtml?: string
  status?: string
  savedAt?: number
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

function contentHtmlToParagraphs(html: string) {
  if (!html.trim()) {
    return []
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const blocks = Array.from(doc.body.querySelectorAll('p,li,h2,h3,h4,h5,h6'))
    .map((item) => item.textContent?.trim() ?? '')
    .filter(Boolean)

  if (blocks.length > 0) {
    return blocks
  }

  const fallback = (doc.body.textContent ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  return fallback
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

function mapAdminPreviewToBlogPost(preview: AdminPreviewPayload): GenflixBlogPost {
  return {
    slug: preview.slug,
    title: preview.title || 'Rascunho sem título',
    category: preview.category || 'Sem categoria',
    excerpt: preview.excerpt || '',
    image: preview.image || '/images/genflix/home/featured-2.jpg',
    readTime: preview.readTime || '1 min',
    author: preview.author || 'Admin GenFlix',
    publishedAt: preview.publishedAt
      ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(preview.publishedAt))
      : '',
    content: contentHtmlToParagraphs(preview.contentHtml ?? ''),
    featured: false,
  }
}

export function PublicBlogPostPage() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { isLoading, user, roles } = useAuth()
  const isAdmin = roles.includes('admin')
  const isAdminPreviewRequest = searchParams.get('preview') === 'admin'
  const previewKey = searchParams.get('previewKey') || `slug:${slug}`
  const waitingRoleResolution = !!user && roles.length === 0
  const canUseAdminPreviewPayload = isAdmin || (isAdminPreviewRequest && !!user && waitingRoleResolution)
  const [post, setPost] = useState<GenflixBlogPost | null>(() => getGenflixBlogPostBySlug(slug))
  const [isLoadingPost, setIsLoadingPost] = useState(true)
  const [isDraftPreview, setIsDraftPreview] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadPost() {
      setIsLoadingPost(true)
      try {
        let resolvedPost: GenflixBlogPost | null = null
        let draftPreview = false

        try {
          resolvedPost = await fetchPublicBlogPostFromSupabase(slug)
        } catch {
          resolvedPost = null
        }

        if (!resolvedPost && isAdmin) {
          const previewQuery = supabase
            .from('blog_posts')
            .select('id, slug, title, category, excerpt, image_url, read_time, author, published_at, content, featured, status')

          const previewResult = previewKey.startsWith('id:')
            ? await previewQuery.eq('id', previewKey.slice(3)).maybeSingle()
            : await previewQuery.eq('slug', slug).maybeSingle()

          if (!previewResult.error && previewResult.data) {
            resolvedPost = mapDraftRowToBlogPost(previewResult.data as DraftBlogPostRow)
            draftPreview = (previewResult.data as DraftBlogPostRow).status !== 'published'
          }
        }

        if (!resolvedPost && isAdminPreviewRequest && canUseAdminPreviewPayload) {
          const keys = [`admin_blog_preview:${previewKey}`, `admin_blog_preview:slug:${slug}`]
          for (const storageKey of keys) {
            try {
              const raw = localStorage.getItem(storageKey)
              if (!raw) continue
              const parsed = JSON.parse(raw) as AdminPreviewPayload
              if (parsed?.slug === slug) {
                resolvedPost = mapAdminPreviewToBlogPost(parsed)
                draftPreview = (parsed.status ?? 'draft') !== 'published'
                break
              }
            } catch {
              // noop
            }
          }
        }

        if (isMounted) {
          setPost(resolvedPost ?? getGenflixBlogPostBySlug(slug))
          setIsDraftPreview(draftPreview)
        }
      } catch {
        if (isMounted) {
          setPost(getGenflixBlogPostBySlug(slug))
          setIsDraftPreview(false)
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
  }, [canUseAdminPreviewPayload, isAdmin, isAdminPreviewRequest, previewKey, slug])

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
    <main className="min-h-screen bg-[#f4f4f4] font-manrope text-[#1f2e39]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-16 pt-1">
        <div className="public-site-container max-w-[1140px]">
          <article>
            <div className="overflow-hidden bg-black">
              <img src={post.image} alt={post.title} className="h-[500px] w-full object-contain" />
            </div>

            {isDraftPreview ? (
              <p className="mt-4 text-center text-sm font-semibold uppercase tracking-[0.15em] text-amber-700">Preview de rascunho (admin)</p>
            ) : null}

            <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
              <h1 className="font-lora text-[42px] leading-[1.12] text-[#008f9c] sm:text-[48px] lg:text-[56px]">
                {post.title}
              </h1>

              <div className="space-y-5 font-lora text-[19px] leading-[1.7] text-[#343434]">
                <p>{post.excerpt}</p>
                {post.content.map((paragraph, index) => (
                  <p key={`${post.slug}-paragraph-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          </article>

          <section className="mt-12 flex flex-wrap items-center justify-center gap-6 pb-4 lg:mt-14 lg:justify-between lg:gap-10">
            <Link
              to="/blog"
              className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-full border border-[#00808f] px-6 text-sm font-semibold uppercase tracking-[0.02em] text-[#032b36] transition-colors hover:bg-[#e6f4f6]"
            >
              <ArrowLeftCircle className="h-4 w-4" />
              Voltar para o blog
            </Link>

            <Link
              to="/contato"
              className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-full border border-[#00808f] px-6 text-sm font-semibold uppercase tracking-[0.02em] text-[#032b36] transition-colors hover:bg-[#e6f4f6]"
            >
              <Send className="h-4 w-4" />
              Fale conosco
            </Link>
          </section>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
