import type {
  GenflixBlogPost,
  GenflixCourseDetail,
  GenflixCourseItem,
} from '@/features/public/genflix-site-content'

interface PublicCourseRow {
  id: string
  slug: string | null
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  cover_image_url: string | null
  marketing_title: string | null
  marketing_description: string | null
  mentor_name: string | null
  mentor_role: string | null
  mentor_bio: string | null
  mentor_initials: string | null
  price_label: string | null
  secondary_price_label: string | null
  price_cents: number
  currency: string
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

const defaultCourseImage = '/images/genflix/home/featured-1.jpg'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const publicCourseSelect =
  'id, slug, title, description, category, thumbnail_url, cover_image_url, marketing_title, marketing_description, mentor_name, mentor_role, mentor_bio, mentor_initials, price_label, secondary_price_label, price_cents, currency, display_order'
const publicBlogPostSelect =
  'slug, title, category, excerpt, image_url, read_time, author, published_at, content, featured'

async function fetchPublicRows<T>(path: string, searchParams: URLSearchParams): Promise<T[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuração pública do Supabase ausente.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}?${searchParams.toString()}`, {
    headers: {
      apikey: supabaseAnonKey,
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Não foi possível carregar o conteúdo público.')
  }

  return (await response.json()) as T[]
}

function formatPrice(row: PublicCourseRow) {
  if (row.price_label?.trim()) {
    return row.price_label
  }

  if (!row.price_cents) {
    return 'Consulte valores'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: row.currency || 'BRL',
  }).format(row.price_cents / 100)
}

function getInitials(row: PublicCourseRow) {
  if (row.mentor_initials?.trim()) {
    return row.mentor_initials.trim().slice(0, 4).toUpperCase()
  }

  const source = row.mentor_name?.trim() || row.title
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function toCourseItem(row: PublicCourseRow): GenflixCourseItem {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.marketing_title?.trim() || row.title,
    category: row.category ?? 'Curso',
    mentor: row.mentor_name?.trim() || 'Equipe GenFlix',
    role: row.mentor_role?.trim() || 'Curadoria de conteudo',
    image: row.cover_image_url || row.thumbnail_url || defaultCourseImage,
    initials: getInitials(row),
  }
}

function toCourseDetail(row: PublicCourseRow): GenflixCourseDetail {
  const item = toCourseItem(row)
  const description = row.marketing_description?.trim() || row.description || ''

  return {
    id: row.id,
    slug: item.slug,
    categoryLine: `${item.category.toUpperCase()} - ONLINE`,
    title: item.title,
    coverImage: item.image,
    description,
    aboutParagraphs: [
      description || 'Curso publicado no catalogo GenFlix com trilha estruturada para aprendizado digital.',
      'A experiencia combina aulas, recursos de apoio, atividades e acesso organizado pelo player da plataforma.',
    ],
    outcomes: [
      {
        title: 'Avancar com clareza',
        description: 'Siga uma trilha organizada para transformar conteudo em progresso real.',
      },
      {
        title: 'Aprender com recursos de apoio',
        description: 'Use aulas, materiais e exercicios para reforcar o estudo.',
      },
      {
        title: 'Acompanhar seu progresso',
        description: 'Visualize etapas concluidas e continue de onde parou.',
      },
      {
        title: 'Receber acesso imediato',
        description: 'A matricula e liberada automaticamente apos confirmacao do pagamento.',
      },
    ],
    syllabus: [
      {
        title: 'Primeiros passos',
        lessonCount: 2,
        summary: 'Introducao, orientacoes de estudo e plano inicial de aplicacao.',
      },
      {
        title: 'Desenvolvimento da trilha',
        lessonCount: 6,
        summary: 'Aulas centrais, atividades praticas e materiais complementares.',
      },
      {
        title: 'Revisao e fechamento',
        lessonCount: 2,
        summary: 'Consolidacao dos principais pontos e proximos passos.',
      },
    ],
    mentor: {
      name: item.mentor,
      role: item.role,
      bio: row.mentor_bio?.trim() || 'Criador responsavel pela experiencia de aprendizagem deste curso.',
      initials: item.initials,
    },
    priceLabel: formatPrice(row),
    secondaryPriceLabel: row.secondary_price_label?.trim() || 'Checkout seguro e acesso liberado apos pagamento',
    includedItems: [
      'Acesso ao curso',
      'Aulas e materiais publicados',
      'Player com progresso',
      'Certificado quando previsto',
      'Suporte da plataforma',
      'Atualizacoes do curso',
    ],
  }
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

  return row ? toCourseDetail(row) : null
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
