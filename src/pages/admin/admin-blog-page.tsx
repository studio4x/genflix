import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Button } from '@/components/ui/button'
import { AdminBlogCommentsPanel } from '@/features/blog/admin-blog-comments-panel'
import { fetchSiteAssets, fetchSiteContent, saveSiteContentEntry, uploadSiteAsset } from '@/features/site-editor/api'
import type { SiteAsset } from '@/features/site-editor/types'
import { supabase } from '@/services/supabase/client'
import { Eye, Pencil, Trash2 } from 'lucide-react'

type ArticleStatus = 'draft' | 'scheduled' | 'published'

type SeoFields = {
  seo_title: string
  seo_description: string
  seo_canonical_url: string
  seo_robots: string
  seo_og_title: string
  seo_og_description: string
  seo_og_image_url: string
}

type BlogArticleRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content_html: string | null
  cover_image_url: string | null
  status: ArticleStatus | null
  featured: boolean | null
  author_id: string | null
  category_id: string | null
  published_at: string | null
  scheduled_publish_at: string | null
  reading_time_minutes: number | null
  focus_keyword: string | null
  seo_title: string | null
  seo_description: string | null
  seo_canonical_url: string | null
  seo_robots: string | null
  seo_og_title: string | null
  seo_og_description: string | null
  seo_og_image_url: string | null
  created_at: string
  updated_at: string
}

type BlogCategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  is_active: boolean | null
  display_order: number | null
  schema_json: string | null
  seo_title: string | null
  seo_description: string | null
  seo_canonical_url: string | null
  seo_robots: string | null
  seo_og_title: string | null
  seo_og_description: string | null
  seo_og_image_url: string | null
}

type BlogTagRow = {
  id: string
  name: string
  slug: string
  description: string | null
  seo_title: string | null
  seo_description: string | null
  seo_canonical_url: string | null
  seo_robots: string | null
  seo_og_title: string | null
  seo_og_description: string | null
  seo_og_image_url: string | null
}

type BlogArticleTagRow = {
  article_id: string
  tag_id: string
}

type LegacyBlogPostRow = {
  id: string
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
  created_at: string
  updated_at: string
}

type ArticleFormState = SeoFields & {
  title: string
  slug: string
  excerpt: string
  coverImageUrl: string
  status: ArticleStatus
  publishedAt: string
  scheduledPublishAt: string
  featured: boolean
  categoryId: string
  tagIds: string[]
  contentHtml: string
  focusKeyword: string
  readingTimeMinutes: number
}

type CategoryFormState = SeoFields & {
  name: string
  slug: string
  description: string
  parentId: string
  isActive: boolean
  displayOrder: string
  schemaJson: string
}

type TagFormState = SeoFields & {
  name: string
  slug: string
  description: string
}

type BlogSidebarImageSlide = {
  url: string
  alt: string
  linkUrl: string
}

type BlogSidebarImageMode = 'single' | 'carousel'

type BlogSidebarBlock = {
  id: string
  mode: BlogSidebarImageMode
  slides: BlogSidebarImageSlide[]
}

function createSidebarBlockId() {
  return `sidebar-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptySidebarSlide(): BlogSidebarImageSlide {
  return { url: '', alt: '', linkUrl: '' }
}

function createEmptySidebarBlock(): BlogSidebarBlock {
  return {
    id: createSidebarBlockId(),
    mode: 'single',
    slides: [createEmptySidebarSlide()],
  }
}

const DEFAULT_SEO: SeoFields = {
  seo_title: '',
  seo_description: '',
  seo_canonical_url: '',
  seo_robots: 'index,follow',
  seo_og_title: '',
  seo_og_description: '',
  seo_og_image_url: '',
}

const DEFAULT_ARTICLE_FORM: ArticleFormState = {
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  status: 'draft',
  publishedAt: '',
  scheduledPublishAt: '',
  featured: false,
  categoryId: '__none__',
  tagIds: [],
  contentHtml: '',
  focusKeyword: '',
  readingTimeMinutes: 1,
  ...DEFAULT_SEO,
}

const DEFAULT_CATEGORY_FORM: CategoryFormState = {
  name: '',
  slug: '',
  description: '',
  parentId: '__none__',
  isActive: true,
  displayOrder: '',
  schemaJson: '',
  ...DEFAULT_SEO,
}

const DEFAULT_TAG_FORM: TagFormState = {
  name: '',
  slug: '',
  description: '',
  ...DEFAULT_SEO,
}

const DEFAULT_INLINE_CATEGORY_FORM: CategoryFormState = {
  ...DEFAULT_CATEGORY_FORM,
}

const TABLES = {
  articles: 'blog_articles',
  categories: 'blog_categories',
  tags: 'blog_tags',
  articleTags: 'blog_article_tags',
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusLabel(status: ArticleStatus | null) {
  if (status === 'scheduled') {
    return 'Agendado'
  }
  if (status === 'published') {
    return 'Publicado'
  }
  return 'Rascunho'
}

function removeInternalH1(html: string) {
  if (!html.trim()) {
    return ''
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll('h1').forEach((h1) => {
    const h2 = doc.createElement('h2')
    h2.innerHTML = h1.innerHTML
    h1.replaceWith(h2)
  })

  return doc.body.innerHTML
}

function stripHtml(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function calculateReadingTimeMinutes(contentHtml: string) {
  const plainText = stripHtml(contentHtml)
  const words = plainText ? plainText.split(' ').length : 0
  const minutes = Math.ceil(words / 200)
  return Math.max(1, minutes)
}

function legacyContentToHtml(value: unknown) {
  if (Array.isArray(value)) {
    const paragraphs = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
    return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')
  }

  if (typeof value === 'string') {
    return `<p>${value.trim()}</p>`
  }

  return ''
}

function parseLegacyReadTime(readTime: string | null, fallbackHtml: string) {
  const extracted = readTime?.match(/\d+/)?.[0]
  if (!extracted) {
    return calculateReadingTimeMinutes(fallbackHtml)
  }

  const numeric = Number(extracted)
  return Number.isNaN(numeric) ? calculateReadingTimeMinutes(fallbackHtml) : Math.max(1, numeric)
}

function normalizeLegacyStatus(status: string | null, publishedAt: string | null): ArticleStatus {
  if (status === 'scheduled') {
    return 'scheduled'
  }
  if (status === 'published' || publishedAt) {
    return 'published'
  }
  return 'draft'
}

function mapLegacyPostToArticle(post: LegacyBlogPostRow): BlogArticleRow {
  const contentHtml = legacyContentToHtml(post.content)
  const readingTime = parseLegacyReadTime(post.read_time, contentHtml)
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    content_html: contentHtml,
    cover_image_url: post.image_url ?? null,
    status: normalizeLegacyStatus(post.status, post.published_at),
    featured: Boolean(post.featured),
    author_id: post.author ?? null,
    category_id: post.category ?? null,
    published_at: post.published_at,
    scheduled_publish_at: null,
    reading_time_minutes: readingTime,
    focus_keyword: null,
    seo_title: null,
    seo_description: null,
    seo_canonical_url: null,
    seo_robots: 'index,follow',
    seo_og_title: null,
    seo_og_description: null,
    seo_og_image_url: null,
    created_at: post.created_at,
    updated_at: post.updated_at,
  }
}

function getCategoryPath(category: BlogCategoryRow, categories: BlogCategoryRow[]) {
  const byId = new Map(categories.map((item) => [item.id, item]))
  const path: string[] = [category.name]
  let parentId = category.parent_id

  while (parentId) {
    const parent = byId.get(parentId)
    if (!parent) {
      break
    }
    path.unshift(parent.name)
    parentId = parent.parent_id
  }

  return path.join(' > ')
}

function buildCategoryOptions(categories: BlogCategoryRow[]) {
  const byParent = new Map<string, BlogCategoryRow[]>()
  const roots: BlogCategoryRow[] = []

  categories.forEach((category) => {
    if (!category.parent_id) {
      roots.push(category)
      return
    }

    const list = byParent.get(category.parent_id) ?? []
    list.push(category)
    byParent.set(category.parent_id, list)
  })

  const sortByOrder = (a: BlogCategoryRow, b: BlogCategoryRow) => {
    const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER
    const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) {
      return orderA - orderB
    }
    return a.name.localeCompare(b.name, 'pt-BR')
  }

  roots.sort(sortByOrder)
  byParent.forEach((entries) => entries.sort(sortByOrder))

  const options: Array<{ id: string; label: string }> = []

  function walk(node: BlogCategoryRow, trail: string[]) {
    const nextTrail = [...trail, node.name]
    options.push({ id: node.id, label: nextTrail.join(' > ') })
    const children = byParent.get(node.id) ?? []
    children.forEach((child) => walk(child, nextTrail))
  }

  roots.forEach((root) => walk(root, []))
  return options
}

function getSeoValidationHints(form: ArticleFormState) {
  const hints: string[] = []
  const slug = form.slug.toLowerCase()
  const title = form.title.toLowerCase()
  const excerpt = form.excerpt.toLowerCase()
  const focus = form.focusKeyword.trim().toLowerCase()

  if (!focus) {
    hints.push('Defina uma palavra-chave de foco para melhorar as sugest?es de SEO.')
  } else {
    if (!slug.includes(slugify(focus))) {
      hints.push('A palavra-chave de foco ainda n?o aparece no slug.')
    }
    if (!title.includes(focus)) {
      hints.push('A palavra-chave de foco n?o est? presente no t?tulo do artigo.')
    }
    if (!excerpt.includes(focus)) {
      hints.push('A palavra-chave de foco n?o aparece no excerpt.')
    }
  }

  if (form.seo_title.trim().length < 25 || form.seo_title.trim().length > 60) {
    hints.push('O t?tulo SEO ideal fica entre 25 e 60 caracteres.')
  }

  if (form.seo_description.trim().length < 70 || form.seo_description.trim().length > 160) {
    hints.push('A SEO description ideal fica entre 70 e 160 caracteres.')
  }

  return hints
}

function suggestFocusKeyword(form: ArticleFormState) {
  const base = `${form.title} ${form.excerpt}`.trim()
  if (!base) {
    return ''
  }

  const words = base
    .toLowerCase()
    .split(/[^a-z0-9?-?]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 3)

  const stopWords = new Set(['para', 'como', 'com', 'sem', 'uma', 'das', 'dos', 'que', 'sobre', 'pela', 'pelo', 'mais'])
  const filtered = words.filter((entry) => !stopWords.has(entry))

  if (filtered.length >= 2) {
    return `${filtered[0]} ${filtered[1]}`
  }

  return filtered[0] ?? ''
}

function suggestExistingTagsWithHeuristic(form: ArticleFormState, tags: BlogTagRow[]) {
  const corpus = `${form.title} ${form.excerpt} ${stripHtml(form.contentHtml)}`.toLowerCase()
  return tags
    .filter((tag) => corpus.includes(tag.name.toLowerCase()) || corpus.includes(tag.slug.toLowerCase()))
    .map((tag) => tag.id)
}

function suggestNewTagNames(form: ArticleFormState, tags: BlogTagRow[]) {
  const corpus = `${form.title} ${form.excerpt} ${stripHtml(form.contentHtml)} ${form.focusKeyword}`.toLowerCase()
  const existingSlugs = new Set(tags.map((tag) => tag.slug))
  const stopWords = new Set(['para', 'como', 'com', 'sem', 'uma', 'das', 'dos', 'que', 'sobre', 'pela', 'pelo', 'mais', 'este', 'essa'])

  const candidates = corpus
    .split(/[^a-z0-9?-?]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 5 && !stopWords.has(entry))

  const unique: string[] = []
  for (const candidate of candidates) {
    const normalizedSlug = slugify(candidate)
    if (!normalizedSlug || existingSlugs.has(normalizedSlug)) {
      continue
    }
    if (!unique.includes(candidate)) {
      unique.push(candidate)
    }
    if (unique.length >= 5) {
      break
    }
  }

  return unique
}

export function AdminBlogPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'articles' | 'categories' | 'tags' | 'layout' | 'comments'>(searchParams.get('tab') === 'comments' ? 'comments' : 'articles')
  const [articleView, setArticleView] = useState<'list' | 'editor'>('list')
  const [isLegacyMode, setIsLegacyMode] = useState(true)
  const [isCategoryCrudAvailable, setIsCategoryCrudAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingArticle, setIsSavingArticle] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [articleSuccessMessage, setArticleSuccessMessage] = useState<string | null>(null)
  const [blogSidebarBlocks, setBlogSidebarBlocks] = useState<BlogSidebarBlock[]>([createEmptySidebarBlock()])
  const [isSavingLayout, setIsSavingLayout] = useState(false)
  const [isUploadingLayoutImage, setIsUploadingLayoutImage] = useState(false)
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false)
  const [mediaLibraryAssets, setMediaLibraryAssets] = useState<SiteAsset[]>([])
  const [isLoadingMediaLibrary, setIsLoadingMediaLibrary] = useState(false)
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('')

  const [articles, setArticles] = useState<BlogArticleRow[]>([])
  const [categories, setCategories] = useState<BlogCategoryRow[]>([])
  const [tags, setTags] = useState<BlogTagRow[]>([])
  const [articleTagRows, setArticleTagRows] = useState<BlogArticleTagRow[]>([])

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)

  const [articleSearch, setArticleSearch] = useState('')
  const [articleStatusFilter, setArticleStatusFilter] = useState<'all' | ArticleStatus>('all')

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', activeTab)
    setSearchParams(next, { replace: true })
  }, [activeTab, searchParams, setSearchParams])

  useEffect(() => {
    if (activeTab === 'categories' && !isCategoryCrudAvailable) {
      setActiveTab('articles')
    }
  }, [activeTab, isCategoryCrudAvailable])

  const [isArticleSlugTouched, setIsArticleSlugTouched] = useState(false)
  const [isCategorySlugTouched, setIsCategorySlugTouched] = useState(false)
  const [isTagSlugTouched, setIsTagSlugTouched] = useState(false)

  const [articleForm, setArticleForm] = useState<ArticleFormState>(DEFAULT_ARTICLE_FORM)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(DEFAULT_CATEGORY_FORM)
  const [tagForm, setTagForm] = useState<TagFormState>(DEFAULT_TAG_FORM)
  const [inlineCategoryForm, setInlineCategoryForm] = useState<CategoryFormState>(DEFAULT_INLINE_CATEGORY_FORM)
  const [showInlineCategoryForm, setShowInlineCategoryForm] = useState(false)

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories])
  const seoHints = useMemo(() => getSeoValidationHints(articleForm), [articleForm])

  const articleTagMap = useMemo(() => {
    const map = new Map<string, string[]>()
    articleTagRows.forEach((row) => {
      const list = map.get(row.article_id) ?? []
      list.push(row.tag_id)
      map.set(row.article_id, list)
    })
    return map
  }, [articleTagRows])

  const statusSummary = useMemo(() => {
    return articles.reduce(
      (acc, article) => {
        const status = article.status ?? 'draft'
        acc.total += 1
        acc[status] += 1
        if (article.featured) {
          acc.featured += 1
        }
        return acc
      },
      { total: 0, draft: 0, scheduled: 0, published: 0, featured: 0 } as Record<'total' | 'draft' | 'scheduled' | 'published' | 'featured', number>,
    )
  }, [articles])

  const filteredArticles = useMemo(() => {
    const normalized = articleSearch.trim().toLowerCase()
    return articles.filter((article) => {
      const matchesStatus = articleStatusFilter === 'all' ? true : (article.status ?? 'draft') === articleStatusFilter
      const categoryPath = article.category_id
        ? getCategoryPath(categories.find((item) => item.id === article.category_id) ?? {
          id: '',
          name: '',
          slug: '',
          description: null,
          parent_id: null,
          is_active: null,
          display_order: null,
          schema_json: null,
          seo_title: null,
          seo_description: null,
          seo_canonical_url: null,
          seo_robots: null,
          seo_og_title: null,
          seo_og_description: null,
          seo_og_image_url: null,
        }, categories)
        : 'sem categoria'

      const matchesSearch = normalized
        ? [article.title, article.slug, article.excerpt ?? '', categoryPath].join(' ').toLowerCase().includes(normalized)
        : true
      return matchesStatus && matchesSearch
    })
  }, [articles, articleSearch, articleStatusFilter, categories])

  async function loadLegacyData() {
    const legacyResult = await supabase
      .from('blog_posts')
      .select('*')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(300)

    if (legacyResult.error) {
      setErrorMessage(legacyResult.error.message)
      setIsLoading(false)
      return
    }

    const mapped = ((legacyResult.data ?? []) as LegacyBlogPostRow[]).map(mapLegacyPostToArticle)
    setArticles(mapped)
    setCategories([])
    setTags([])
    setArticleTagRows([])
    setIsLegacyMode(true)
    setActiveTab('articles')
    setIsLoading(false)
  }

  async function loadCategoriesData() {
    const categoriesResult = await supabase
      .from(TABLES.categories)
      .select('*')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (categoriesResult.error) {
      if (categoriesResult.error.message.includes(`Could not find the table 'public.${TABLES.categories}'`)) {
        setCategories([])
        setIsCategoryCrudAvailable(false)
        return
      }
      setErrorMessage(categoriesResult.error.message)
      return
    }

    setIsCategoryCrudAvailable(true)
    setCategories((categoriesResult.data ?? []) as BlogCategoryRow[])
  }

  async function loadAllData() {
    setIsLoading(true)
    setErrorMessage(null)
    await loadLegacyData()
    await loadCategoriesData()
    await loadBlogLayoutSettings()
  }
  useEffect(() => {
    void loadAllData()
  }, [])

  useEffect(() => {
    let isMounted = true
    setIsLoadingMediaLibrary(true)

    void fetchSiteAssets(120)
      .then((assets) => {
        if (!isMounted) {
          return
        }
        setMediaLibraryAssets(assets.filter((asset) => (asset.mime_type ?? '').startsWith('image/')))
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar a biblioteca de midia.')
      })
      .finally(() => {
        if (!isMounted) {
          return
        }
        setIsLoadingMediaLibrary(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function loadBlogLayoutSettings() {
    try {
      const entries = await fetchSiteContent('blog')
      const layoutEntry = entries.find((entry) => entry.page_key === 'blog' && entry.entry_key === 'blog.sidebar.image')
      const value = layoutEntry?.value

      if (typeof value === 'string') {
        setBlogSidebarBlocks([{
          id: createSidebarBlockId(),
          mode: 'single',
          slides: [{ url: value, alt: '', linkUrl: '' }],
        }])
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
            const mappedSlides = (Array.isArray(mappedBlock.slides) ? mappedBlock.slides : [])
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

            return {
              id: createSidebarBlockId(),
              mode: mappedBlock.mode === 'carousel' ? 'carousel' : 'single',
              slides: mappedSlides.length > 0 ? mappedSlides : [createEmptySidebarSlide()],
            } satisfies BlogSidebarBlock
          })
          .filter((block): block is BlogSidebarBlock => Boolean(block))

        if (parsedBlocks.length > 0) {
          setBlogSidebarBlocks(parsedBlocks)
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
          setBlogSidebarBlocks([{
            id: createSidebarBlockId(),
            mode: record.mode === 'carousel' ? 'carousel' : 'single',
            slides: parsedSlides,
          }])
          return
        }

        const legacyUrl = typeof record.url === 'string' ? record.url : ''
        if (legacyUrl) {
          setBlogSidebarBlocks([{
            id: createSidebarBlockId(),
            mode: 'single',
            slides: [{
              url: legacyUrl,
              alt: typeof record.alt === 'string' ? record.alt : '',
              linkUrl: typeof record.linkUrl === 'string' ? record.linkUrl : '',
            }],
          }])
          return
        }

        setBlogSidebarBlocks([createEmptySidebarBlock()])
        return
      }

      setBlogSidebarBlocks([createEmptySidebarBlock()])
    } catch {
      setBlogSidebarBlocks([createEmptySidebarBlock()])
    }
  }

  async function handleUploadBlogSidebarImage(file: File | null, blockIndex: number, slideIndex: number) {
    if (!file) {
      return
    }

    setIsUploadingLayoutImage(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const uploaded = await uploadSiteAsset(file, {
        alt: file.name,
        pageKey: 'blog',
        entryKey: 'blog.sidebar.image',
      })
      if (uploaded.public_url) {
        const uploadedUrl = uploaded.public_url ?? ''
        setBlogSidebarBlocks((currentBlocks) => currentBlocks.map((block, currentBlockIndex) => {
          if (currentBlockIndex !== blockIndex) {
            return block
          }
          return {
            ...block,
            slides: block.slides.map((slide, currentSlideIndex) => (
              currentSlideIndex === slideIndex
                ? { ...slide, url: uploadedUrl }
                : slide
            )),
          }
        }))
      }
      if (uploaded.alt) {
        const uploadedAlt = uploaded.alt ?? ''
        setBlogSidebarBlocks((currentBlocks) => currentBlocks.map((block, currentBlockIndex) => {
          if (currentBlockIndex !== blockIndex) {
            return block
          }
          return {
            ...block,
            slides: block.slides.map((slide, currentSlideIndex) => (
              currentSlideIndex === slideIndex
                ? { ...slide, alt: uploadedAlt }
                : slide
            )),
          }
        }))
      }
      setSuccessMessage('Imagem enviada com sucesso. Clique em "Salvar configuraÃ§Ã£o lateral" para publicar.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel enviar a imagem.')
    } finally {
      setIsUploadingLayoutImage(false)
    }
  }

  async function handleUploadArticleCoverImage(file: File | null) {
    if (!file) {
      return
    }

    setIsUploadingCoverImage(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const uploaded = await uploadSiteAsset(file, {
        alt: articleForm.title.trim() || file.name,
        pageKey: 'blog',
        entryKey: 'article.cover_image_url',
      })
      if (uploaded.public_url) {
        setArticleForm((current) => ({ ...current, coverImageUrl: uploaded.public_url ?? current.coverImageUrl }))
      }
      setMediaLibraryAssets((current) => [uploaded, ...current.filter((asset) => asset.id !== uploaded.id)])
      setSuccessMessage('Imagem de capa enviada com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel enviar a imagem de capa.')
    } finally {
      setIsUploadingCoverImage(false)
    }
  }

  function handleApplyCoverFromLibrary() {
    if (!selectedMediaAssetId) {
      setErrorMessage('Selecione uma imagem da biblioteca antes de aplicar.')
      return
    }

    const selectedAsset = mediaLibraryAssets.find((asset) => asset.id === selectedMediaAssetId)
    if (!selectedAsset || !selectedAsset.public_url) {
      setErrorMessage('Nao foi possivel aplicar a imagem selecionada.')
      return
    }

    setArticleForm((current) => ({ ...current, coverImageUrl: selectedAsset.public_url ?? current.coverImageUrl }))
    setSuccessMessage('Imagem de capa aplicada da biblioteca de midia.')
    setIsMediaLibraryOpen(false)
  }

  async function handleSaveBlogLayoutImage() {
    setIsSavingLayout(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await saveSiteContentEntry({
        pageKey: 'blog',
        entryKey: 'blog.sidebar.image',
        entryType: 'image',
        value: {
          blocks: blogSidebarBlocks.map((block) => ({
            mode: block.mode,
            slides: block.slides.map((slide) => ({
              url: slide.url.trim(),
              alt: slide.alt.trim(),
              linkUrl: slide.linkUrl.trim(),
            })).filter((slide) => slide.url),
          })).filter((block) => block.slides.length > 0),
        },
        schema: {
          kind: 'blog-sidebar-stack',
        },
      })
      setSuccessMessage('ConfiguraÃ§Ãµes da lateral do blog salvas com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar a imagem lateral.')
    } finally {
      setIsSavingLayout(false)
    }
  }

  function resetArticleForm() {
    setSelectedArticleId(null)
    setIsArticleSlugTouched(false)
    setArticleForm(DEFAULT_ARTICLE_FORM)
    setShowInlineCategoryForm(false)
    setInlineCategoryForm(DEFAULT_INLINE_CATEGORY_FORM)
    setArticleSuccessMessage(null)
  }

  function handleCreateArticle() {
    resetArticleForm()
    setArticleView('editor')
  }

  function handleOpenArticlePreview() {
    if (!articleForm.slug) {
      return
    }

    const previewKey = selectedArticleId ? `id:${selectedArticleId}` : `slug:${articleForm.slug}`
    const previewPayload = {
      slug: articleForm.slug,
      title: articleForm.title.trim() || 'Rascunho sem t?tulo',
      category: 'Sem categoria',
      excerpt: articleForm.excerpt.trim(),
      image: articleForm.coverImageUrl.trim() || '/images/genflix/home/featured-2.jpg',
      readTime: `${Math.max(1, articleForm.readingTimeMinutes)} min`,
      author: user?.email ?? 'Admin GenFlix',
      publishedAt: articleForm.publishedAt || null,
      contentHtml: articleForm.contentHtml,
      status: articleForm.status,
      savedAt: Date.now(),
    }

    try {
      localStorage.setItem(`admin_blog_preview:${previewKey}`, JSON.stringify(previewPayload))
      localStorage.setItem(`admin_blog_preview:slug:${articleForm.slug}`, JSON.stringify(previewPayload))
    } catch {
      // noop
    }

    const params = new URLSearchParams({
      preview: 'admin',
      previewKey,
    })

    window.open(`/blog/${articleForm.slug}?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  function handleOpenArticleFromList(slug: string) {
    if (!slug) {
      return
    }
    window.open(`/blog/${slug}`, '_blank', 'noopener,noreferrer')
  }

  function resetCategoryForm() {
    setSelectedCategoryId(null)
    setIsCategorySlugTouched(false)
    setCategoryForm(DEFAULT_CATEGORY_FORM)
  }

  function resetTagForm() {
    setSelectedTagId(null)
    setIsTagSlugTouched(false)
    setTagForm(DEFAULT_TAG_FORM)
  }

  function populateArticleForm(article: BlogArticleRow) {
    setSelectedArticleId(article.id)
    setIsArticleSlugTouched(true)
    setArticleForm({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt ?? '',
      coverImageUrl: article.cover_image_url ?? '',
      status: article.status ?? 'draft',
      publishedAt: toDateTimeLocal(article.published_at),
      scheduledPublishAt: toDateTimeLocal(article.scheduled_publish_at),
      featured: Boolean(article.featured),
      categoryId: article.category_id ?? '__none__',
      tagIds: articleTagMap.get(article.id) ?? [],
      contentHtml: article.content_html ?? '',
      focusKeyword: article.focus_keyword ?? '',
      readingTimeMinutes: article.reading_time_minutes ?? calculateReadingTimeMinutes(article.content_html ?? ''),
      seo_title: article.seo_title ?? '',
      seo_description: article.seo_description ?? '',
      seo_canonical_url: article.seo_canonical_url ?? '',
      seo_robots: article.seo_robots ?? 'index,follow',
      seo_og_title: article.seo_og_title ?? '',
      seo_og_description: article.seo_og_description ?? '',
      seo_og_image_url: article.seo_og_image_url ?? '',
    })
    setSuccessMessage(null)
    setErrorMessage(null)
    setArticleSuccessMessage(null)
    setArticleView('editor')
  }

  function populateCategoryForm(category: BlogCategoryRow) {
    setSelectedCategoryId(category.id)
    setIsCategorySlugTouched(true)
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentId: category.parent_id ?? '__none__',
      isActive: category.is_active ?? true,
      displayOrder: category.display_order == null ? '' : String(category.display_order),
      schemaJson: category.schema_json ?? '',
      seo_title: category.seo_title ?? '',
      seo_description: category.seo_description ?? '',
      seo_canonical_url: category.seo_canonical_url ?? '',
      seo_robots: category.seo_robots ?? 'index,follow',
      seo_og_title: category.seo_og_title ?? '',
      seo_og_description: category.seo_og_description ?? '',
      seo_og_image_url: category.seo_og_image_url ?? '',
    })
  }

  function populateTagForm(tag: BlogTagRow) {
    setSelectedTagId(tag.id)
    setIsTagSlugTouched(true)
    setTagForm({
      name: tag.name,
      slug: tag.slug,
      description: tag.description ?? '',
      seo_title: tag.seo_title ?? '',
      seo_description: tag.seo_description ?? '',
      seo_canonical_url: tag.seo_canonical_url ?? '',
      seo_robots: tag.seo_robots ?? 'index,follow',
      seo_og_title: tag.seo_og_title ?? '',
      seo_og_description: tag.seo_og_description ?? '',
      seo_og_image_url: tag.seo_og_image_url ?? '',
    })
  }

  async function saveArticleWithStatus(nextStatus?: ArticleStatus | null) {
    setErrorMessage(null)
    setSuccessMessage(null)
    setArticleSuccessMessage(null)

    const title = articleForm.title.trim()
    const slug = articleForm.slug.trim()
    const cleanedHtml = removeInternalH1(articleForm.contentHtml)
    const readingTime = calculateReadingTimeMinutes(cleanedHtml)
    const effectiveStatus = nextStatus ?? articleForm.status

    if (!title || !slug) {
      setErrorMessage('Informe título e slug do artigo.')
      return
    }

    if (effectiveStatus === 'scheduled' && !articleForm.scheduledPublishAt) {
      setErrorMessage('Para agendar, informe a data/hora de agendamento.')
      return
    }

    setIsSavingArticle(true)

    const legacyPayload = {
      title,
      slug,
      category: articleForm.categoryId === '__none__' ? null : articleForm.categoryId,
      excerpt: articleForm.excerpt.trim() || null,
      image_url: articleForm.coverImageUrl.trim() || null,
      read_time: `${readingTime} min`,
      author: user?.id ?? null,
      published_at: effectiveStatus === 'published'
        ? (articleForm.publishedAt ? new Date(articleForm.publishedAt).toISOString() : new Date().toISOString())
        : null,
      content: stripHtml(cleanedHtml)
        .split('. ')
        .map((entry) => entry.trim())
        .filter(Boolean),
      featured: articleForm.featured,
      status: effectiveStatus,
    }

    const legacyResult = selectedArticleId
      ? await supabase.from('blog_posts').update(legacyPayload).eq('id', selectedArticleId).select('*').single()
      : await supabase.from('blog_posts').insert(legacyPayload).select('*').single()

    if (legacyResult.error) {
      setErrorMessage(legacyResult.error.message)
      setIsSavingArticle(false)
      return
    }

    await loadAllData()
    const savedLegacy = mapLegacyPostToArticle(legacyResult.data as LegacyBlogPostRow)
    populateArticleForm(savedLegacy)
    setArticleForm((current) => ({
      ...current,
      status: effectiveStatus,
      contentHtml: cleanedHtml,
      readingTimeMinutes: readingTime,
    }))
    setArticleSuccessMessage('Artigo salvo com sucesso.')
    setIsSavingArticle(false)
  }

  async function handleDeleteArticle(articleToDelete?: BlogArticleRow) {
    const target = articleToDelete ?? articles.find((item) => item.id === selectedArticleId)
    if (!target) {
      return
    }

    const shouldDelete = window.confirm(`Deseja excluir o artigo "${target.title}"?`)
    if (!shouldDelete) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)

    const deleteLegacy = await supabase.from('blog_posts').delete().eq('id', target.id)
    if (deleteLegacy.error) {
      setErrorMessage(deleteLegacy.error.message)
      return
    }

    await loadAllData()
    if (!selectedArticleId || selectedArticleId === target.id) {
      resetArticleForm()
    }
    setArticleView('list')
    setSuccessMessage('Artigo exclu?do com sucesso.')
  }

  async function handleSaveCategory(inline = false) {
    const form = inline ? inlineCategoryForm : categoryForm
    const selectedId = inline ? null : selectedCategoryId

    const name = form.name.trim()
    const slug = form.slug.trim()
    if (!name || !slug) {
      setErrorMessage('Informe nome e slug da categoria.')
      return
    }

    setIsSavingCategory(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const payload = {
      name,
      slug,
      description: form.description.trim() || null,
      parent_id: form.parentId === '__none__' ? null : form.parentId,
      is_active: form.isActive,
      display_order: form.displayOrder.trim() ? Number(form.displayOrder) : 0,
      schema_json: form.schemaJson.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_canonical_url: form.seo_canonical_url.trim() || null,
      seo_robots: form.seo_robots.trim() || 'index,follow',
      seo_og_title: form.seo_og_title.trim() || null,
      seo_og_description: form.seo_og_description.trim() || null,
      seo_og_image_url: form.seo_og_image_url.trim() || null,
    }

    if (payload.display_order != null && Number.isNaN(payload.display_order)) {
      setErrorMessage('Ordem da categoria inválida.')
      setIsSavingCategory(false)
      return
    }

    const result = selectedId
      ? await supabase.from(TABLES.categories).update(payload).eq('id', selectedId).select('*').single()
      : await supabase.from(TABLES.categories).insert(payload).select('*').single()

    if (result.error) {
      setErrorMessage(result.error.message)
      setIsSavingCategory(false)
      return
    }

    const saved = result.data as BlogCategoryRow
    await loadAllData()

    if (inline) {
      setShowInlineCategoryForm(false)
      setInlineCategoryForm(DEFAULT_INLINE_CATEGORY_FORM)
      setArticleForm((current) => ({ ...current, categoryId: saved.id }))
      setSuccessMessage('Categoria/subcategoria criada e vinculada ao artigo.')
    } else {
      setSelectedCategoryId(saved.id)
      populateCategoryForm(saved)
      setSuccessMessage('Categoria salva com sucesso.')
    }

    setIsSavingCategory(false)
  }

  async function handleDeleteCategory() {
    if (!selectedCategoryId) {
      return
    }

    const selected = categories.find((item) => item.id === selectedCategoryId)
    if (!selected) {
      return
    }

    const shouldDelete = window.confirm(`Deseja excluir a categoria "${selected.name}"?`)
    if (!shouldDelete) {
      return
    }

    const result = await supabase.from(TABLES.categories).delete().eq('id', selectedCategoryId)
    if (result.error) {
      setErrorMessage(result.error.message)
      return
    }

    await loadAllData()
    resetCategoryForm()
    setSuccessMessage('Categoria exclu?da com sucesso.')
  }

  async function handleSaveTag() {
    const name = tagForm.name.trim()
    const slug = tagForm.slug.trim()

    if (!name || !slug) {
      setErrorMessage('Informe nome e slug da tag.')
      return
    }

    setIsSavingTag(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const payload = {
      name,
      slug,
      description: tagForm.description.trim() || null,
      seo_title: tagForm.seo_title.trim() || null,
      seo_description: tagForm.seo_description.trim() || null,
      seo_canonical_url: tagForm.seo_canonical_url.trim() || null,
      seo_robots: tagForm.seo_robots.trim() || 'index,follow',
      seo_og_title: tagForm.seo_og_title.trim() || null,
      seo_og_description: tagForm.seo_og_description.trim() || null,
      seo_og_image_url: tagForm.seo_og_image_url.trim() || null,
    }

    const result = selectedTagId
      ? await supabase.from(TABLES.tags).update(payload).eq('id', selectedTagId).select('*').single()
      : await supabase.from(TABLES.tags).insert(payload).select('*').single()

    if (result.error) {
      setErrorMessage(result.error.message)
      setIsSavingTag(false)
      return
    }

    const saved = result.data as BlogTagRow
    await loadAllData()
    setSelectedTagId(saved.id)
    populateTagForm(saved)
    setSuccessMessage('Tag salva com sucesso.')
    setIsSavingTag(false)
  }

  async function handleDeleteTag() {
    if (!selectedTagId) {
      return
    }

    const selected = tags.find((item) => item.id === selectedTagId)
    if (!selected) {
      return
    }

    const shouldDelete = window.confirm(`Deseja excluir a tag "${selected.name}"?`)
    if (!shouldDelete) {
      return
    }

    const deleteLinks = await supabase.from(TABLES.articleTags).delete().eq('tag_id', selectedTagId)
    if (deleteLinks.error) {
      setErrorMessage(deleteLinks.error.message)
      return
    }

    const deleteTag = await supabase.from(TABLES.tags).delete().eq('id', selectedTagId)
    if (deleteTag.error) {
      setErrorMessage(deleteTag.error.message)
      return
    }

    await loadAllData()
    resetTagForm()
    setSuccessMessage('Tag exclu?da sem quebrar relacionamentos de artigos.')
  }

  async function handleFillTagsWithAI() {
    const suggestedIds = suggestExistingTagsWithHeuristic(articleForm, tags)
    if (suggestedIds.length === 0) {
      setSuccessMessage('Nenhuma tag existente foi sugerida automaticamente.')
      return
    }

    setArticleForm((current) => ({
      ...current,
      tagIds: Array.from(new Set([...current.tagIds, ...suggestedIds])),
    }))
    setSuccessMessage('Tags existentes preenchidas com IA (heur?stica sem?ntica local).')
  }

  async function handleSuggestAndCreateTags() {
    const suggestedNames = suggestNewTagNames(articleForm, tags)
    if (suggestedNames.length === 0) {
      setSuccessMessage('Nenhuma nova tag foi sugerida.')
      return
    }

    const rowsToInsert = suggestedNames.map((name) => ({
      name: name[0].toUpperCase() + name.slice(1),
      slug: slugify(name),
      description: null,
      seo_title: null,
      seo_description: null,
      seo_canonical_url: null,
      seo_robots: 'index,follow',
      seo_og_title: null,
      seo_og_description: null,
      seo_og_image_url: null,
    }))

    const insertResult = await supabase.from(TABLES.tags).insert(rowsToInsert).select('*')
    if (insertResult.error) {
      setErrorMessage(insertResult.error.message)
      return
    }

    const created = (insertResult.data ?? []) as BlogTagRow[]
    await loadAllData()

    setArticleForm((current) => ({
      ...current,
      tagIds: Array.from(new Set([...current.tagIds, ...created.map((tag) => tag.id)])),
    }))

    setSuccessMessage(`Foram sugeridas e criadas ${created.length} novas tags.`)
  }

  function renderSeoFields(
    value: SeoFields,
    onChange: (next: SeoFields) => void,
    labelPrefix: string,
  ) {
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {labelPrefix} TÃ­tulo SEO
            <input
              value={value.seo_title}
              onChange={(event) => onChange({ ...value, seo_title: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {labelPrefix} URL can?nica
            <input
              value={value.seo_canonical_url}
              onChange={(event) => onChange({ ...value, seo_canonical_url: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          {labelPrefix} DescriÃ§Ã£o SEO
          <textarea
            value={value.seo_description}
            onChange={(event) => onChange({ ...value, seo_description: event.target.value })}
            rows={2}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#1398B7]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {labelPrefix} Robots
            <input
              value={value.seo_robots}
              onChange={(event) => onChange({ ...value, seo_robots: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
              placeholder="index,follow"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {labelPrefix} URL da imagem OG
            <input
              value={value.seo_og_image_url}
              onChange={(event) => onChange({ ...value, seo_og_image_url: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {labelPrefix} TÃ­tulo OG
            <input
              value={value.seo_og_title}
              onChange={(event) => onChange({ ...value, seo_og_title: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {labelPrefix} DescriÃ§Ã£o OG
            <input
              value={value.seo_og_description}
              onChange={(event) => onChange({ ...value, seo_og_description: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
            />
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isMediaLibraryOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0A3640]/50 px-4 py-6">
          <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[#D8E6EB] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D8E6EB] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Biblioteca de midia</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Escolher imagem de capa</h2>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsMediaLibraryOpen(false)} className="rounded-xl border-[#D8E6EB]">
                Fechar
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {isLoadingMediaLibrary ? (
                <p className="text-sm font-semibold text-[#5F7077]">Carregando biblioteca...</p>
              ) : mediaLibraryAssets.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-4 py-6 text-sm font-semibold text-[#5F7077]">
                  Nenhuma imagem encontrada na biblioteca de midia.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {mediaLibraryAssets.map((asset) => {
                    const isSelected = selectedMediaAssetId === asset.id
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedMediaAssetId(asset.id)}
                        className={`overflow-hidden rounded-[16px] border bg-white text-left transition-all ${isSelected ? 'border-[#1398B7] ring-2 ring-[#1398B7]/20' : 'border-[#D8E6EB] hover:border-[#B8D8E1]'}`}
                      >
                        <div className="aspect-[16/9] w-full bg-[#EAF2F5]">
                          {asset.public_url ? <img src={asset.public_url} alt={asset.alt ?? 'Imagem'} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="space-y-1 px-3 py-2">
                          <p className="truncate text-xs font-black text-[#15323b]">{asset.alt ?? 'Imagem sem nome'}</p>
                          <p className="text-[11px] font-semibold text-[#5F7077]">{new Date(asset.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#D8E6EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsMediaLibraryOpen(false)} className="h-11 w-full rounded-xl border-[#D8E6EB] sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleApplyCoverFromLibrary}
                disabled={!selectedMediaAssetId}
                className="h-11 w-full rounded-xl bg-[#1398B7] px-4 text-center text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-[#1089A5] sm:w-auto"
              >
                Usar imagem selecionada
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Blog</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Blog e conteúdo</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => void loadAllData()} className="rounded-2xl border-[#D8E6EB]">
            Atualizar
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('articles')
            setArticleView('list')
          }}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${activeTab === 'articles' ? 'border-[#1398B7] bg-[#1398B7] text-white' : 'border-[#D8E6EB] bg-white text-[#15323b]'}`}
        >
          Artigos
        </button>
        {isCategoryCrudAvailable ? (
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${activeTab === 'categories' ? 'border-[#1398B7] bg-[#1398B7] text-white' : 'border-[#D8E6EB] bg-white text-[#15323b]'}`}
          >
            Categorias
          </button>
        ) : null}
        {!isLegacyMode ? (
          <button
            type="button"
            onClick={() => setActiveTab('tags')}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${activeTab === 'tags' ? 'border-[#1398B7] bg-[#1398B7] text-white' : 'border-[#D8E6EB] bg-white text-[#15323b]'}`}
          >
            Tags
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setActiveTab('layout')}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${activeTab === 'layout' ? 'border-[#1398B7] bg-[#1398B7] text-white' : 'border-[#D8E6EB] bg-white text-[#15323b]'}`}
        >
          Layout do blog
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('comments')}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${activeTab === 'comments' ? 'border-[#1398B7] bg-[#1398B7] text-white' : 'border-[#D8E6EB] bg-white text-[#15323b]'}`}
        >
          Comentarios
        </button>
      </section>

      {activeTab === 'comments' ? (
        <AdminBlogCommentsPanel />
      ) : null}

      {activeTab === 'articles' ? (
        <section className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4"><p className="text-xs font-bold uppercase text-[#5F7077]">Total</p><p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.total}</p></div>
            <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4"><p className="text-xs font-bold uppercase text-[#5F7077]">Rascunhos</p><p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.draft}</p></div>
            <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4"><p className="text-xs font-bold uppercase text-[#5F7077]">Agendados</p><p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.scheduled}</p></div>
            <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4"><p className="text-xs font-bold uppercase text-[#5F7077]">PublicaÃ§Ã£o</p><p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.published}</p></div>
            <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4"><p className="text-xs font-bold uppercase text-[#5F7077]">Destaque</p><p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.featured}</p></div>
          </section>

          <section className="grid gap-6">
            {articleView === 'editor' ? (
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black tracking-tight text-[#15323b]">{selectedArticleId ? 'Editar artigo' : 'Novo artigo'}</h2>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setArticleView('list')}>Voltar para lista</Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={resetArticleForm}>Limpar</Button>
                  {articleForm.slug ? (
                    <Button type="button" variant="outline" className="rounded-xl" onClick={handleOpenArticlePreview}>
                      Visualizar artigo
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  TÃ­tulo
                  <input
                    value={articleForm.title}
                    onChange={(event) => {
                      const nextTitle = event.target.value
                      setArticleForm((current) => ({
                        ...current,
                        title: nextTitle,
                        slug: isArticleSlugTouched ? current.slug : slugify(nextTitle),
                      }))
                    }}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Slug
                  <input
                    value={articleForm.slug}
                    onChange={(event) => {
                      setIsArticleSlugTouched(true)
                      setArticleForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                    }}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Status
                    <select
                      value={articleForm.status}
                      onChange={(event) => setArticleForm((current) => ({ ...current, status: event.target.value as ArticleStatus }))}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
                    >
                      <option value="draft">Rascunho</option>
                      <option value="scheduled">Agendado</option>
                      <option value="published">PublicaÃ§Ã£o</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Categoria
                    <select
                      value={articleForm.categoryId}
                      onChange={(event) => {
                        const selected = event.target.value
                        if (selected === '__create__') {
                          setShowInlineCategoryForm(true)
                          return
                        }
                        setArticleForm((current) => ({ ...current, categoryId: selected }))
                      }}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1398B7]"
                    >
                      <option value="__none__">Sem categoria</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                      <option value="__create__">+ Criar categoria/subcategoria</option>
                    </select>
                  </label>
                </div>

                {showInlineCategoryForm ? (
                  <div className="space-y-3 rounded-2xl border border-dashed border-[#BEE3EA] bg-[#F4FBFD] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1398B7]">Criar categoria inline</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Nome
                        <input
                          value={inlineCategoryForm.name}
                          onChange={(event) => setInlineCategoryForm((current) => ({
                            ...current,
                            name: event.target.value,
                            slug: slugify(event.target.value),
                          }))}
                          className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Slug
                        <input
                          value={inlineCategoryForm.slug}
                          onChange={(event) => setInlineCategoryForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
                          className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Descrição
                      <textarea
                        value={inlineCategoryForm.description}
                        onChange={(event) => setInlineCategoryForm((current) => ({ ...current, description: event.target.value }))}
                        rows={2}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" className="rounded-xl bg-[#1398B7] hover:bg-[#0A3640]" onClick={() => void handleSaveCategory(true)} disabled={isSavingCategory}>
                        {isSavingCategory ? 'Salvando...' : 'Criar e vincular'}
                      </Button>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowInlineCategoryForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Publicado em
                    <input
                      type="datetime-local"
                      value={articleForm.publishedAt}
                      onChange={(event) => setArticleForm((current) => ({ ...current, publishedAt: event.target.value }))}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Agendar para
                    <input
                      type="datetime-local"
                      value={articleForm.scheduledPublishAt}
                      onChange={(event) => setArticleForm((current) => ({ ...current, scheduledPublishAt: event.target.value }))}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Tempo de leitura (auto)
                  <input
                    value={String(articleForm.readingTimeMinutes)}
                    readOnly
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Resumo
                  <textarea
                    value={articleForm.excerpt}
                    onChange={(event) => setArticleForm((current) => ({ ...current, excerpt: event.target.value }))}
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                  />
                </label>

                <section className="space-y-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1398B7]">SEO do artigo</p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="grid flex-1 gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Palavra-chave foco
                        <input
                          value={articleForm.focusKeyword}
                          onChange={(event) => setArticleForm((current) => ({ ...current, focusKeyword: event.target.value }))}
                          className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-5 rounded-xl"
                        onClick={() => setArticleForm((current) => ({ ...current, focusKeyword: suggestFocusKeyword(current) }))}
                      >
                        Sugerir palavra-chave
                      </Button>
                    </div>
                  </div>

                  {seoHints.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                      {seoHints.map((hint) => (
                        <p key={hint}>{hint}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                      SEO b?sico do artigo est? consistente com a palavra-chave de foco.
                    </div>
                  )}

                  {renderSeoFields(
                    articleForm,
                    (next) => setArticleForm((current) => ({ ...current, ...next })),
                    'Artigo',
                  )}
                </section>

                {!isLegacyMode ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Tags (relacionamento em blog_article_tags)</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {tags.map((tag) => {
                        const checked = articleForm.tagIds.includes(tag.id)
                        return (
                          <label key={tag.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => setArticleForm((current) => ({
                                ...current,
                                tagIds: event.target.checked
                                  ? [...current.tagIds, tag.id]
                                  : current.tagIds.filter((entry) => entry !== tag.id),
                              }))}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            #{tag.name}
                          </label>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => void handleFillTagsWithAI()}>
                        Preencher tags com IA
                      </Button>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => void handleSuggestAndCreateTags()}>
                        Sugerir e criar novas tags
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                    Tags e relacionamento avan?ado est?o indispon?veis no modelo atual do blog.
                  </div>
                )}

                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={articleForm.featured}
                    onChange={(event) => setArticleForm((current) => ({ ...current, featured: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Artigo em destaque
                </label>

                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Conteúdo (content_html)</p>
                  <RichTextEditor
                    value={articleForm.contentHtml}
                    onChange={(nextHtml) => {
                      const reading = calculateReadingTimeMinutes(removeInternalH1(nextHtml))
                      setArticleForm((current) => ({
                        ...current,
                        contentHtml: nextHtml,
                        readingTimeMinutes: reading,
                      }))
                    }}
                    showRawHtmlToggle
                    showHeadingHints
                  />
                </div>

                <section className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1398B7]">Imagem de capa</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#15323b]">Upload de imagem</h3>
                  <p className="mt-2 text-sm font-medium text-[#5F7077]">
                    Recomendado: JPG, PNG ou WEBP. Defina a imagem de capa do artigo usando upload ou biblioteca de mídia.
                  </p>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-2xl border border-[#D8E6EB] bg-[#EAF2F5]">
                      <div className="aspect-[4/3] w-full">
                        {articleForm.coverImageUrl ? (
                          <img src={articleForm.coverImageUrl} alt={articleForm.title || 'Imagem de capa'} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-semibold text-[#5F7077]">
                            Nenhuma capa definida
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#D8E6EB] p-4">
                      <p className="text-lg font-black tracking-tight text-[#15323b]">Enviar nova imagem</p>
                      <p className="mt-1 text-sm font-medium text-[#5F7077]">Após escolher a imagem, salve o artigo para manter a alteração.</p>

                      <label className="mt-3 grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        URL da capa
                        <input
                          value={articleForm.coverImageUrl}
                          onChange={(event) => setArticleForm((current) => ({ ...current, coverImageUrl: event.target.value }))}
                          className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                        />
                      </label>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-[#1398B7] px-3 text-center text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-[#1089A5]">
                          {isUploadingCoverImage ? 'Enviando...' : 'Escolher arquivo'}
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/*"
                            disabled={isUploadingCoverImage}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null
                              void handleUploadArticleCoverImage(file)
                              event.currentTarget.value = ''
                            }}
                            className="sr-only"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsMediaLibraryOpen(true)}
                          disabled={isLoadingMediaLibrary || isUploadingCoverImage}
                          className="h-10 rounded-xl border-[#D8E6EB] text-xs font-black uppercase tracking-[0.08em]"
                        >
                          Abrir biblioteca
                        </Button>
                      </div>

                      {articleForm.coverImageUrl ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <a
                            href={articleForm.coverImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-black text-[#1398B7] hover:text-[#0A3640]"
                          >
                            Abrir imagem atual
                          </a>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setArticleForm((current) => ({ ...current, coverImageUrl: '' }))}
                            className="h-8 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-700 hover:bg-rose-50"
                          >
                            Remover imagem
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap gap-2 border-t border-[#D8E6EB] pt-4">
                  <Button type="button" className="rounded-xl bg-[#1398B7] hover:bg-[#0A3640]" onClick={() => void saveArticleWithStatus('draft')} disabled={isSavingArticle}>
                    {isSavingArticle ? 'Salvando...' : 'Salvar rascunho'}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void saveArticleWithStatus('published')} disabled={isSavingArticle}>
                    Publicar
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void saveArticleWithStatus('draft')} disabled={isSavingArticle}>
                    Despublicar
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void saveArticleWithStatus('scheduled')} disabled={isSavingArticle}>
                    Agendar
                  </Button>
                  {selectedArticleId ? (
                    <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50" onClick={() => void handleDeleteArticle()}>
                      Excluir
                    </Button>
                  ) : null}
                </div>
                {articleSuccessMessage ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                    {articleSuccessMessage}
                  </div>
                ) : null}
              </div>
              </article>
            ) : null}

            {articleView === 'list' ? (
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-black tracking-tight text-[#15323b]">Lista de artigos</h2>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="rounded-xl bg-[#1398B7] hover:bg-[#0A3640]" onClick={handleCreateArticle}>
                    Novo artigo
                  </Button>
                  <input
                    value={articleSearch}
                    onChange={(event) => setArticleSearch(event.target.value)}
                    placeholder="Buscar por t?tulo, slug ou categoria..."
                    className="h-10 min-w-[220px] rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-medium text-[#15323b] outline-none focus:border-[#1398B7]"
                  />
                  <select
                    value={articleStatusFilter}
                    onChange={(event) => setArticleStatusFilter(event.target.value as 'all' | ArticleStatus)}
                    className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  >
                    <option value="all">Todos os status</option>
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Agendado</option>
                    <option value="published">PublicaÃ§Ã£o</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <p className="py-8 text-sm font-medium text-[#6d7f84]">Carregando artigos...</p>
              ) : filteredArticles.length === 0 ? (
                <p className="py-8 text-sm font-medium text-[#6d7f84]">Nenhum artigo encontrado.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                    <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                      <tr>
                        <th className="px-4 py-3">TÃ­tulo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3">PublicaÃ§Ã£o</th>
                        <th className="px-4 py-3">Leitura</th>
                        <th className="px-4 py-3">AÃ§Ãµes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8E6EB]">
                      {filteredArticles.map((article) => {
                        const category = categories.find((item) => item.id === article.category_id)
                        const categoryLabel = category ? getCategoryPath(category, categories) : 'Sem categoria'
                        return (
                          <tr
                            key={article.id}
                            className={`cursor-pointer transition-colors hover:bg-[#F8FBFC] ${selectedArticleId === article.id ? 'bg-[#E8F6FA]' : ''}`}
                            onClick={() => populateArticleForm(article)}
                          >
                            <td className="px-4 py-3">
                              <p className="font-black text-[#15323b]">{article.title}</p>
                              <p className="mt-1 text-xs font-semibold text-[#6d7f84]">/{article.slug}</p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#15323b]">{statusLabel(article.status)}</td>
                            <td className="px-4 py-3 font-semibold text-[#5F7077]">{categoryLabel}</td>
                            <td className="px-4 py-3 font-semibold text-[#5F7077]">{formatDateTime(article.published_at)}</td>
                            <td className="px-4 py-3 font-semibold text-[#5F7077]">{article.reading_time_minutes ?? 1} min</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  title="Visualizar artigo"
                                  aria-label="Visualizar artigo"
                                  className="h-8 w-8 rounded-lg p-0"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleOpenArticleFromList(article.slug)
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  title="Editar artigo"
                                  aria-label="Editar artigo"
                                  className="h-8 w-8 rounded-lg p-0"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    populateArticleForm(article)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  title="Excluir artigo"
                                  aria-label="Excluir artigo"
                                  className="h-8 w-8 rounded-lg border-red-200 p-0 text-red-700 hover:bg-red-50"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleDeleteArticle(article)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </article>
            ) : null}
          </section>
        </section>
      ) : null}

      {activeTab === 'categories' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight text-[#15323b]">{selectedCategoryId ? 'Editar categoria' : 'Nova categoria'}</h2>
              <Button type="button" variant="outline" className="rounded-xl" onClick={resetCategoryForm}>Limpar</Button>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Nome
                  <input
                    value={categoryForm.name}
                    onChange={(event) => {
                      const nextName = event.target.value
                      setCategoryForm((current) => ({
                        ...current,
                        name: nextName,
                        slug: isCategorySlugTouched ? current.slug : slugify(nextName),
                      }))
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Slug
                  <input
                    value={categoryForm.slug}
                    onChange={(event) => {
                      setIsCategorySlugTouched(true)
                      setCategoryForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Descrição
                <textarea
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                  rows={2}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                />
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={categoryForm.isActive}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Categoria ativa
              </label>

              {selectedCategoryId ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Categoria pai
                      <select
                        value={categoryForm.parentId}
                        onChange={(event) => setCategoryForm((current) => ({ ...current, parentId: event.target.value }))}
                        className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                      >
                        <option value="__none__">Raiz</option>
                        {categoryOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Ordem
                      <input
                        value={categoryForm.displayOrder}
                        onChange={(event) => setCategoryForm((current) => ({ ...current, displayOrder: event.target.value }))}
                        className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    schema_json
                    <textarea
                      value={categoryForm.schemaJson}
                      onChange={(event) => setCategoryForm((current) => ({ ...current, schemaJson: event.target.value }))}
                      rows={2}
                      className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-medium text-slate-800"
                    />
                  </label>

                </>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-[#D8E6EB] pt-3">
                <Button type="button" className="rounded-xl bg-[#1398B7] hover:bg-[#0A3640]" onClick={() => void handleSaveCategory(false)} disabled={isSavingCategory}>
                  {isSavingCategory ? 'Salvando...' : 'Salvar categoria'}
                </Button>
                {selectedCategoryId ? (
                  <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50" onClick={() => void handleDeleteCategory()}>
                    Excluir categoria
                  </Button>
                ) : null}
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
            <h2 className="text-lg font-black tracking-tight text-[#15323b]">Categorias e subcategorias</h2>
            <div className="mt-4 space-y-2">
              {categories.length === 0 ? (
                <p className="text-sm font-medium text-[#6d7f84]">Nenhuma categoria cadastrada.</p>
              ) : categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => populateCategoryForm(category)}
                  className={`block w-full rounded-xl border px-4 py-3 text-left transition ${selectedCategoryId === category.id ? 'border-[#1398B7] bg-[#E8F6FA]' : 'border-[#D8E6EB] bg-white hover:bg-[#F8FBFC]'}`}
                >
                  <p className="text-sm font-black text-[#15323b]">{getCategoryPath(category, categories)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6d7f84]">/{category.slug}</p>
                </button>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'tags' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight text-[#15323b]">{selectedTagId ? 'Editar tag' : 'Nova tag'}</h2>
              <Button type="button" variant="outline" className="rounded-xl" onClick={resetTagForm}>Limpar</Button>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Nome
                  <input
                    value={tagForm.name}
                    onChange={(event) => {
                      const nextName = event.target.value
                      setTagForm((current) => ({
                        ...current,
                        name: nextName,
                        slug: isTagSlugTouched ? current.slug : slugify(nextName),
                      }))
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Slug
                  <input
                    value={tagForm.slug}
                    onChange={(event) => {
                      setIsTagSlugTouched(true)
                      setTagForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                DescriÃ§Ã£o
                <textarea
                  value={tagForm.description}
                  onChange={(event) => setTagForm((current) => ({ ...current, description: event.target.value }))}
                  rows={2}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                />
              </label>

              {renderSeoFields(
                tagForm,
                (next) => setTagForm((current) => ({ ...current, ...next })),
                'Tag',
              )}

              <div className="flex flex-wrap gap-2 border-t border-[#D8E6EB] pt-3">
                <Button type="button" className="rounded-xl bg-[#1398B7] hover:bg-[#0A3640]" onClick={() => void handleSaveTag()} disabled={isSavingTag}>
                  {isSavingTag ? 'Salvando...' : 'Salvar tag'}
                </Button>
                {selectedTagId ? (
                  <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50" onClick={() => void handleDeleteTag()}>
                    Excluir tag
                  </Button>
                ) : null}
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
            <h2 className="text-lg font-black tracking-tight text-[#15323b]">Tags cadastradas</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tags.length === 0 ? (
                <p className="text-sm font-medium text-[#6d7f84]">Nenhuma tag cadastrada.</p>
              ) : tags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => populateTagForm(tag)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${selectedTagId === tag.id ? 'border-[#1398B7] bg-[#E8F6FA]' : 'border-[#D8E6EB] bg-white hover:bg-[#F8FBFC]'}`}
                >
                  <p className="text-sm font-black text-[#15323b]">#{tag.name}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6d7f84]">/{tag.slug} ? robots: {tag.seo_robots ?? 'index,follow'}</p>
                </button>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'layout' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
            <h2 className="text-lg font-black tracking-tight text-[#15323b]">Blocos laterais da home do blog</h2>
            <p className="mt-2 text-sm font-medium text-[#5F7077]">
              Estes blocos aparecem na barra lateral direita da pÃ¡gina <code>/blog</code>, um abaixo do outro.
            </p>
            <p className="mt-1 text-xs font-semibold text-[#6d7f84]">
              RecomendaÃ§Ã£o de upload: <strong>640x920 px</strong> (proporÃ§Ã£o <strong>7:10</strong>), formato JPG ou WebP.
            </p>

            <div className="mt-4 grid gap-3">
              {blogSidebarBlocks.map((block, blockIndex) => (
                <div key={block.id} className="rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">
                      Bloco lateral {blockIndex + 1}
                    </p>
                    {blogSidebarBlocks.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBlogSidebarBlocks((current) => current.filter((_, currentIndex) => currentIndex !== blockIndex))
                        }}
                        className="text-xs font-black uppercase tracking-[0.16em] text-red-600 hover:text-red-700"
                      >
                        Remover bloco
                      </button>
                    ) : null}
                  </div>

                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Tipo de exibiÃ§Ã£o
                    <select
                      value={block.mode}
                      onChange={(event) => {
                        const nextMode = event.target.value as BlogSidebarImageMode
                        setBlogSidebarBlocks((current) => current.map((currentBlock, currentIndex) => (
                          currentIndex === blockIndex
                            ? { ...currentBlock, mode: nextMode }
                            : currentBlock
                        )))
                      }}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                    >
                      <option value="single">Imagem ?nica</option>
                      <option value="carousel">Carrossel / slider</option>
                    </select>
                  </label>

                  <div className="mt-3 grid gap-3">
                    {block.slides.map((slide, slideIndex) => (
                      <div key={`block-${blockIndex}-slide-${slideIndex}`} className="rounded-xl border border-[#D8E6EB] bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">
                            {block.mode === 'single' ? 'Imagem' : `Slide ${slideIndex + 1}`}
                          </p>
                          {block.mode === 'carousel' && block.slides.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setBlogSidebarBlocks((current) => current.map((currentBlock, currentIndex) => {
                                  if (currentIndex !== blockIndex) {
                                    return currentBlock
                                  }
                                  return {
                                    ...currentBlock,
                                    slides: currentBlock.slides.filter((_, currentSlideIndex) => currentSlideIndex !== slideIndex),
                                  }
                                }))
                              }}
                              className="text-xs font-black uppercase tracking-[0.16em] text-red-600 hover:text-red-700"
                            >
                              Remover
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-3">
                          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            URL da imagem
                            <input
                              value={slide.url}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                setBlogSidebarBlocks((current) => current.map((currentBlock, currentIndex) => {
                                  if (currentIndex !== blockIndex) {
                                    return currentBlock
                                  }
                                  return {
                                    ...currentBlock,
                                    slides: currentBlock.slides.map((currentSlide, currentSlideIndex) => (
                                      currentSlideIndex === slideIndex ? { ...currentSlide, url: nextValue } : currentSlide
                                    )),
                                  }
                                }))
                              }}
                              placeholder="https://..."
                              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Link da imagem (URL de clique ao tocar/clicar na imagem)
                            <input
                              value={slide.linkUrl}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                setBlogSidebarBlocks((current) => current.map((currentBlock, currentIndex) => {
                                  if (currentIndex !== blockIndex) {
                                    return currentBlock
                                  }
                                  return {
                                    ...currentBlock,
                                    slides: currentBlock.slides.map((currentSlide, currentSlideIndex) => (
                                      currentSlideIndex === slideIndex ? { ...currentSlide, linkUrl: nextValue } : currentSlide
                                    )),
                                  }
                                }))
                              }}
                              placeholder="https://..."
                              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Texto alternativo (ALT)
                            <input
                              value={slide.alt}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                setBlogSidebarBlocks((current) => current.map((currentBlock, currentIndex) => {
                                  if (currentIndex !== blockIndex) {
                                    return currentBlock
                                  }
                                  return {
                                    ...currentBlock,
                                    slides: currentBlock.slides.map((currentSlide, currentSlideIndex) => (
                                      currentSlideIndex === slideIndex ? { ...currentSlide, alt: nextValue } : currentSlide
                                    )),
                                  }
                                }))
                              }}
                              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Enviar arquivo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null
                                void handleUploadBlogSidebarImage(file, blockIndex, slideIndex)
                                event.currentTarget.value = ''
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {block.mode === 'carousel' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBlogSidebarBlocks((current) => current.map((currentBlock, currentIndex) => (
                          currentIndex === blockIndex
                            ? { ...currentBlock, slides: [...currentBlock.slides, createEmptySidebarSlide()] }
                            : currentBlock
                        )))
                      }}
                      className="mt-3 h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-black uppercase tracking-[0.12em] text-[#15323b] hover:bg-[#F8FBFC]"
                    >
                      Adicionar imagem ao slider
                    </button>
                  ) : null}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setBlogSidebarBlocks((current) => [...current, createEmptySidebarBlock()])}
                className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-black uppercase tracking-[0.12em] text-[#15323b] hover:bg-[#F8FBFC]"
              >
                Adicionar novo bloco lateral
              </button>

              <div className="flex flex-wrap gap-2 border-t border-[#D8E6EB] pt-4">
                <Button type="button" className="rounded-xl bg-[#1398B7] hover:bg-[#0A3640]" onClick={() => void handleSaveBlogLayoutImage()} disabled={isSavingLayout || isUploadingLayoutImage}>
                  {isSavingLayout ? 'Salvando...' : 'Salvar blocos laterais'}
                </Button>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#5F7077]">Preview</h3>
            <div className="mt-4 space-y-4">
              {blogSidebarBlocks.map((block) => {
                const firstSlide = block.slides[0]
                return (
                  <div key={`preview-${block.id}`} className="overflow-hidden rounded-[8px] border border-[#D8E6EB] bg-[#F8FBFC]">
                    {firstSlide?.url?.trim() ? (
                      <img
                        src={firstSlide.url}
                        alt={firstSlide.alt || 'Imagem lateral do blog'}
                        className="aspect-[7/10] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[7/10] w-full bg-[#23b6a1]" />
                    )}
                  </div>
                )
              })}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  )
}




