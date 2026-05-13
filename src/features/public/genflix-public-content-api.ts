import {
  buildCoursePublicCatalogItem,
  buildCoursePublicDetail,
  normalizeCoursePublicPageContent,
  type CoursePublicPageRowLike,
} from '@/features/public/course-public-page-content'
import type {
  GenflixBlogPost,
  GenflixCourseDetail,
  GenflixCourseItem,
  GenflixCourseModule,
} from '@/features/public/genflix-site-content'

interface PublicCourseRow extends CoursePublicPageRowLike {
  display_order: number
}

interface PublicBlogPostRow {
  slug: string
  title: string
  category: string | null
  excerpt: string | null
  image_url: string | null
  read_time: string | null
  author: string | null
  published_at: string | null
  content: unknown
  featured: boolean
}

interface PublicCourseCategoryRow {
  name: string
  slug: string
  display_order: number
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const publicCourseSelect =
  'id, slug, title, description, category, thumbnail_url, cover_image_url, marketing_title, marketing_description, mentor_name, mentor_role, mentor_bio, mentor_initials, price_label, secondary_price_label, price_cents, currency, public_page_content, display_order'
const publicBlogPostSelect =
  'slug, title, category, excerpt, image_url, read_time, author, published_at, content, featured'

async function fetchPublicRows<T>(path: string, searchParams: URLSearchParams): Promise<T[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuração pública do Supabase ausente.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}?${searchParams.toString()}`, {
    cache: 'no-store',
    headers: {
      apikey: supabaseAnonKey,
      'cache-control': 'no-store, max-age=0',
      pragma: 'no-cache',
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Não foi possível carregar o conteúdo público.')
  }

  return (await response.json()) as T[]
}

function toCourseItem(row: PublicCourseRow): GenflixCourseItem {
  return buildCoursePublicCatalogItem(row)
}

function normalizeOutlineModule(value: unknown): GenflixCourseModule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const row = value as { title?: unknown; items?: unknown }
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  const items = Array.isArray(row.items)
    ? row.items.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : []

  if (!title) {
    return null
  }

  return {
    title,
    lessonCount: items.length,
    summary: items.length ? `${items.length} itens liberados nesta etapa.` : 'Sem itens publicados nesta etapa.',
    items,
    lessonLabel: items.length === 1 ? 'item' : 'itens',
  }
}

async function fetchPublicCourseOutline(courseId: string): Promise<GenflixCourseModule[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuracao publica do Supabase ausente.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_course_outline`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      'cache-control': 'no-store, max-age=0',
      pragma: 'no-cache',
    },
    body: JSON.stringify({ _course_id: courseId }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Nao foi possivel carregar o outline publico do curso.')
  }

  const payload = (await response.json()) as unknown
  return Array.isArray(payload)
    ? payload.map(normalizeOutlineModule).filter((item): item is GenflixCourseModule => Boolean(item))
    : []
}

async function toCourseDetail(row: PublicCourseRow): Promise<GenflixCourseDetail> {
  const content = normalizeCoursePublicPageContent(row.public_page_content)
  const realSyllabus = content.contentSource === 'real'
    ? await fetchPublicCourseOutline(row.id).catch(() => [])
    : []

  return buildCoursePublicDetail(row, { realSyllabus })
}

function toBlogPost(row: PublicBlogPostRow): GenflixBlogPost {
  const content = Array.isArray(row.content)
    ? row.content
      .map((item) => {
        if (item && typeof item === 'object' && 'text' in item) {
          const text = (item as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        }
        return typeof item === 'string' ? item : ''
      })
      .filter(Boolean)
    : []

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
    content,
    featured: row.featured,
  }
}

export async function fetchPublicCoursesFromSupabase() {
  const params = new URLSearchParams({
    select: publicCourseSelect,
    status: 'eq.published',
    is_public: 'eq.true',
    order: 'display_order.asc',
  })
  const rows = await fetchPublicRows<PublicCourseRow>('courses', params)

  return rows.map(toCourseItem)
}

export async function fetchPublicCourseDetailFromSupabase(slug: string) {
  const params = new URLSearchParams({
    select: publicCourseSelect,
    status: 'eq.published',
    is_public: 'eq.true',
    slug: `eq.${slug}`,
    limit: '1',
  })
  const [row] = await fetchPublicRows<PublicCourseRow>('courses', params)

  return row ? await toCourseDetail(row) : null
}

export async function fetchPublicBlogPostsFromSupabase() {
  const params = new URLSearchParams({
    select: publicBlogPostSelect,
    status: 'eq.published',
    order: 'display_order.asc,published_at.desc',
  })
  const rows = await fetchPublicRows<PublicBlogPostRow>('blog_posts', params)

  return rows.map(toBlogPost)
}

export async function fetchPublicBlogPostFromSupabase(slug: string) {
  const params = new URLSearchParams({
    select: publicBlogPostSelect,
    status: 'eq.published',
    slug: `eq.${slug}`,
    limit: '1',
  })
  const [row] = await fetchPublicRows<PublicBlogPostRow>('blog_posts', params)

  return row ? toBlogPost(row) : null
}

export async function fetchPublicCourseCategoriesFromSupabase() {
  const params = new URLSearchParams({
    select: 'name,slug,display_order',
    is_active: 'eq.true',
    order: 'display_order.asc,name.asc',
  })
  const rows = await fetchPublicRows<PublicCourseCategoryRow>('course_categories', params)
  return rows.map((row) => row.name.trim()).filter(Boolean)
}
