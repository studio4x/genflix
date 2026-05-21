import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
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
    <main className="min-h-screen bg-white font-manrope text-[#1f2e39]">
      <GenflixPublicHeader currentPage="blog" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="blog-post" placementKey="hero" />

      <section className="pb-14 pt-8">
        <div className="public-site-container max-w-[1040px]">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f4b7d] hover:text-[#1f3760]">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o blog
          </Link>

          <article className="mt-6">
            <div className="overflow-hidden border border-[#cdcdcd] bg-white shadow-sm">
              <img src={post.image} alt={post.title} className="h-[220px] w-full object-cover sm:h-[320px] lg:h-[430px]" />
            </div>

            <h1 className="mt-10 text-center text-3xl font-semibold leading-tight text-[#ff7a00] sm:text-4xl">
              {post.title}
            </h1>

            {isDraftPreview ? (
              <p className="mt-4 text-center text-sm font-semibold uppercase tracking-[0.15em] text-amber-700">Preview de rascunho (admin)</p>
            ) : null}

            <div className="mt-8 space-y-4 text-base leading-8 text-[#5f6570]">
              <p className="font-semibold">Introdução</p>
              <p>{post.excerpt}</p>
              {post.content.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <section className="mt-16 grid gap-14 lg:grid-cols-2">
            <div>
              <h2 className="text-center text-2xl font-light leading-tight text-[#646872] sm:text-3xl">Compartilhe ou imprima esta postagem</h2>
              <div className="mt-16 h-px w-full bg-[#7f7f7f]" />
              <p className="mt-8 text-center text-2xl font-light leading-tight text-[#646872] sm:text-3xl">Siga-nos nas redes sociais</p>
            </div>

            <div>
              <h2 className="text-center text-2xl font-light leading-tight text-[#646872] sm:text-3xl">Envie-nos o seu comentário</h2>

              <form className="mt-8 space-y-3" onSubmit={(event) => event.preventDefault()}>
                <input
                  type="text"
                  placeholder="Seu nome"
                  className="h-12 w-full rounded-full border border-[#808798] bg-transparent px-4 text-sm text-[#666c76] outline-none placeholder:text-[#666c76]"
                />
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  className="h-12 w-full rounded-full border border-[#808798] bg-transparent px-4 text-sm text-[#666c76] outline-none placeholder:text-[#666c76]"
                />
                <input
                  type="email"
                  placeholder="Repita seu e-mail"
                  className="h-12 w-full rounded-full border border-[#808798] bg-transparent px-4 text-sm text-[#666c76] outline-none placeholder:text-[#666c76]"
                />
                <textarea
                  rows={4}
                  placeholder="Seu comentário"
                  className="w-full rounded-[26px] border border-[#808798] bg-transparent px-4 py-3 text-sm text-[#666c76] outline-none placeholder:text-[#666c76]"
                />

                <label className="flex items-start gap-2 text-sm leading-6 text-[#4e61a3]">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#b85c3a]" defaultChecked />
                  <span>Concordo com os termos da política de privacidade e responsabilidade do site.</span>
                </label>

                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#ff7a00] text-sm font-semibold uppercase tracking-[0.16em] text-[#223247] hover:bg-[#fff5ea]"
                >
                  <span className="text-sm">➤</span>
                  Enviar
                </button>
              </form>
            </div>
          </section>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
