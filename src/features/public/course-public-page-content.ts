import {
  getGenflixCourseBySlug,
  getGenflixCourseDetailBySlug,
  type GenflixCourseDetail,
  type GenflixCourseItem,
  type GenflixCourseModule,
  type GenflixCourseOutcome,
} from '@/features/public/genflix-site-content'

export type CoursePublicContentSource = 'real' | 'custom'

export interface CoursePublicBonusSection {
  enabled: boolean
  title: string
  description: string
}

export interface CoursePublicPageContent {
  categoryLine: string | null
  aboutParagraphs: string[]
  outcomes: GenflixCourseOutcome[]
  includedItems: string[]
  bonusSection: CoursePublicBonusSection | null
  contentSource: CoursePublicContentSource
  customSyllabus: GenflixCourseModule[]
}

export interface CoursePublicPageRowLike {
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
  price_cents: number | null
  currency: string | null
  public_page_content: unknown
}

const defaultCourseImage = '/images/genflix/home/featured-1.jpg'
const defaultOutcomeFallbacks: GenflixCourseOutcome[] = [
  {
    title: 'Avancar com clareza',
    description: 'Siga uma trilha organizada para transformar conteúdo em progresso real.',
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
    description: 'A matrícula é liberada automaticamente após confirmação do pagamento.',
  },
]

const defaultIncludedItems = [
  'Acesso ao curso',
  'Aulas e materiais publicados',
  'Player com progresso',
  'Certificado quando previsto',
  'Suporte da plataforma',
  'Atualizacoes do curso',
]

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeOutcome(value: unknown): GenflixCourseOutcome | null {
  if (!isRecord(value)) {
    return null
  }

  const title = trimString(value.title)
  const description = trimString(value.description)

  if (!title || !description) {
    return null
  }

  return { title, description }
}

function normalizeModule(value: unknown): GenflixCourseModule | null {
  if (!isRecord(value)) {
    return null
  }

  const title = trimString(value.title)
  if (!title) {
    return null
  }

  const items = Array.isArray(value.items)
    ? value.items.map((item) => trimString(item)).filter(Boolean)
    : []

  const lessonCountValue = typeof value.lessonCount === 'number' && Number.isFinite(value.lessonCount)
    ? Math.max(0, Math.round(value.lessonCount))
    : items.length

  return {
    title,
    lessonCount: lessonCountValue,
    summary: trimString(value.summary),
    items,
    lessonLabel: trimString(value.lessonLabel) || undefined,
  }
}

function normalizeBonusSection(value: unknown): CoursePublicBonusSection | null {
  if (!isRecord(value)) {
    return null
  }

  const title = trimString(value.title)
  const description = trimString(value.description)
  const enabled = value.enabled !== false

  if (!title && !description) {
    return null
  }

  return {
    enabled,
    title: title || 'Prévia de conteúdo',
    description,
  }
}

export function normalizeCoursePublicPageContent(value: unknown): CoursePublicPageContent {
  if (!isRecord(value)) {
    return {
      categoryLine: null,
      aboutParagraphs: [],
      outcomes: [],
      includedItems: [],
      bonusSection: null,
      contentSource: 'custom',
      customSyllabus: [],
    }
  }

  return {
    categoryLine: trimString(value.categoryLine) || null,
    aboutParagraphs: Array.isArray(value.aboutParagraphs)
      ? value.aboutParagraphs.map((item) => trimString(item)).filter(Boolean)
      : [],
    outcomes: Array.isArray(value.outcomes)
      ? value.outcomes.map(normalizeOutcome).filter((item): item is GenflixCourseOutcome => Boolean(item))
      : [],
    includedItems: Array.isArray(value.includedItems)
      ? value.includedItems.map((item) => trimString(item)).filter(Boolean)
      : [],
    bonusSection: normalizeBonusSection(value.bonusSection),
    contentSource: value.contentSource === 'real' ? 'real' : 'custom',
    customSyllabus: Array.isArray(value.customSyllabus)
      ? value.customSyllabus.map(normalizeModule).filter((item): item is GenflixCourseModule => Boolean(item))
      : [],
  }
}

function formatPrice(row: CoursePublicPageRowLike) {
  const explicitPrice = trimString(row.price_label)
  if (explicitPrice) {
    return explicitPrice
  }

  if (!row.price_cents) {
    return 'Consulte valores'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: row.currency || 'BRL',
  }).format(row.price_cents / 100)
}

function getInitials(row: CoursePublicPageRowLike) {
  const explicitInitials = trimString(row.mentor_initials)
  if (explicitInitials) {
    return explicitInitials.slice(0, 4).toUpperCase()
  }

  const source = trimString(row.mentor_name) || row.title
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function buildCoursePublicCatalogItem(row: CoursePublicPageRowLike): GenflixCourseItem {
  const slug = row.slug ?? row.id
  const staticCourse = getGenflixCourseBySlug(slug)

  return {
    id: row.id,
    slug,
    title: trimString(row.marketing_title) || row.title || staticCourse?.title || 'Curso GenFlix',
    category: trimString(row.category) || staticCourse?.category || 'Curso',
    mentor: trimString(row.mentor_name) || staticCourse?.mentor || 'Equipe GenFlix',
    role: trimString(row.mentor_role) || staticCourse?.role || 'Curadoria de conteúdo',
    image: trimString(row.cover_image_url) || trimString(row.thumbnail_url) || staticCourse?.image || defaultCourseImage,
    initials: getInitials(row),
    mentorImage: staticCourse?.mentorImage,
  }
}

export function buildCoursePublicDetail(
  row: CoursePublicPageRowLike,
  options?: {
    realSyllabus?: GenflixCourseModule[]
  },
): GenflixCourseDetail {
  const item = buildCoursePublicCatalogItem(row)
  const staticDetail = getGenflixCourseDetailBySlug(item.slug)
  const content = normalizeCoursePublicPageContent(row.public_page_content)
  const fallbackDescription =
    trimString(row.marketing_description) ||
    trimString(row.description) ||
    staticDetail?.description ||
    ''
  const fallbackBonusDescription =
    trimString(row.mentor_bio) ||
    staticDetail?.bonusSection.description ||
    staticDetail?.mentor.bio ||
    ''
  const bonusSection = content.bonusSection
    ? {
      enabled: content.bonusSection.enabled,
      title: content.bonusSection.title || 'Prévia de conteúdo',
      description: content.bonusSection.description || fallbackBonusDescription,
    }
    : {
      enabled: Boolean(fallbackBonusDescription),
      title: staticDetail?.bonusSection.title || 'Prévia de conteúdo',
      description: fallbackBonusDescription,
    }

  const syllabus =
    content.contentSource === 'real' && options?.realSyllabus?.length
      ? options.realSyllabus
      : content.customSyllabus.length
        ? content.customSyllabus
        : staticDetail?.syllabus ?? [
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
            title: 'Revisão e fechamento',
            lessonCount: 2,
            summary: 'Consolidação dos principais pontos e próximos passos.',
          },
        ]

  return {
    id: row.id,
    slug: item.slug,
    categoryLine:
      content.categoryLine ||
      staticDetail?.categoryLine ||
      `${item.category.toUpperCase()} - ONLINE`,
    title: item.title,
    coverImage: item.image,
    description: fallbackDescription,
    aboutParagraphs: content.aboutParagraphs.length
      ? content.aboutParagraphs
      : staticDetail?.aboutParagraphs ?? [
        fallbackDescription || 'Curso publicado no catalogo GenFlix com trilha estruturada para aprendizado digital.',
        'A experiência combina aulas, recursos de apoio, atividades e acesso organizado pelo player da plataforma.',
      ],
    outcomes: content.outcomes.length
      ? content.outcomes
      : staticDetail?.outcomes ?? defaultOutcomeFallbacks,
    syllabus,
    mentor: {
      name: trimString(row.mentor_name) || staticDetail?.mentor.name || item.mentor,
      role: trimString(row.mentor_role) || staticDetail?.mentor.role || item.role,
      bio:
        trimString(row.mentor_bio) ||
        staticDetail?.mentor.bio ||
        'Criador responsável pela experiência de aprendizagem deste curso.',
      initials: item.initials,
    },
    priceLabel: formatPrice(row),
    secondaryPriceLabel:
      trimString(row.secondary_price_label) ||
      staticDetail?.secondaryPriceLabel ||
      'Checkout seguro e acesso liberado após pagamento',
    includedItems: content.includedItems.length
      ? content.includedItems
      : staticDetail?.includedItems ?? defaultIncludedItems,
    bonusSection,
  }
}
