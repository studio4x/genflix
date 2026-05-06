import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'

type BlogStatus = 'draft' | 'scheduled' | 'published' | 'archived'

type BlogPostRecord = {
  id: string
  title: string
  slug: string
  category: string | null
  excerpt: string | null
  image_url: string | null
  read_time: string | null
  author: string | null
  published_at: string | null
  content: unknown
  featured: boolean | null
  status: BlogStatus | null
  display_order: number | null
  created_at: string
  updated_at: string
}

type BlogPostFormState = {
  title: string
  slug: string
  category: string
  excerpt: string
  imageUrl: string
  readTime: string
  author: string
  status: BlogStatus
  publishedAt: string
  featured: boolean
  displayOrder: string
  content: string
}

const DEFAULT_FORM_STATE: BlogPostFormState = {
  title: '',
  slug: '',
  category: '',
  excerpt: '',
  imageUrl: '',
  readTime: '',
  author: '',
  status: 'draft',
  publishedAt: '',
  featured: false,
  displayOrder: '',
  content: '',
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

function normalizeContentToTextarea(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim()
        }
        if (entry && typeof entry === 'object' && 'text' in entry) {
          const textValue = (entry as { text?: unknown }).text
          return typeof textValue === 'string' ? textValue.trim() : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
  }

  if (typeof value === 'string') {
    return value
  }

  return ''
}

function normalizeContentToPayload(value: string) {
  return value
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)
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

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

export function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPostRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BlogStatus>('all')
  const [isSlugTouched, setIsSlugTouched] = useState(false)
  const [form, setForm] = useState<BlogPostFormState>(DEFAULT_FORM_STATE)

  async function loadPosts() {
    setIsLoading(true)
    setErrorMessage(null)

    const result = await supabase
      .from('blog_posts')
      .select('*')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(250)

    if (result.error) {
      setErrorMessage(result.error.message)
      setIsLoading(false)
      return
    }

    setPosts((result.data ?? []) as BlogPostRecord[])
    setIsLoading(false)
  }

  useEffect(() => {
    void loadPosts()
  }, [])

  const filteredPosts = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()

    return posts.filter((post) => {
      const matchesStatus = statusFilter === 'all' ? true : (post.status ?? 'draft') === statusFilter
      const matchesSearch = normalizedTerm
        ? [post.title, post.slug, post.author ?? '', post.category ?? ''].join(' ').toLowerCase().includes(normalizedTerm)
        : true

      return matchesStatus && matchesSearch
    })
  }, [posts, searchTerm, statusFilter])

  const statusSummary = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        const status = post.status ?? 'draft'
        acc.total += 1
        acc[status] += 1
        if (post.featured) {
          acc.featured += 1
        }
        return acc
      },
      { total: 0, draft: 0, scheduled: 0, published: 0, archived: 0, featured: 0 } as Record<'total' | 'draft' | 'scheduled' | 'published' | 'archived' | 'featured', number>,
    )
  }, [posts])

  function resetForm() {
    setSelectedPostId(null)
    setIsSlugTouched(false)
    setForm(DEFAULT_FORM_STATE)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  function populateForm(post: BlogPostRecord) {
    setSelectedPostId(post.id)
    setIsSlugTouched(true)
    setForm({
      title: post.title,
      slug: post.slug,
      category: post.category ?? '',
      excerpt: post.excerpt ?? '',
      imageUrl: post.image_url ?? '',
      readTime: post.read_time ?? '',
      author: post.author ?? '',
      status: post.status ?? 'draft',
      publishedAt: toDateTimeLocal(post.published_at),
      featured: Boolean(post.featured),
      displayOrder: post.display_order == null ? '' : String(post.display_order),
      content: normalizeContentToTextarea(post.content),
    })
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  async function handleSavePost() {
    setErrorMessage(null)
    setSuccessMessage(null)

    const title = form.title.trim()
    const slug = form.slug.trim()

    if (!title || !slug) {
      setErrorMessage('Informe pelo menos titulo e slug do artigo.')
      return
    }

    const payload = {
      title,
      slug,
      category: form.category.trim() || null,
      excerpt: form.excerpt.trim() || null,
      image_url: form.imageUrl.trim() || null,
      read_time: form.readTime.trim() || null,
      author: form.author.trim() || null,
      status: form.status,
      featured: form.featured,
      display_order: form.displayOrder.trim() ? Number(form.displayOrder) : null,
      published_at: form.status === 'published'
        ? (form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString())
        : (form.publishedAt ? new Date(form.publishedAt).toISOString() : null),
      content: normalizeContentToPayload(form.content),
    }

    if (payload.display_order != null && Number.isNaN(payload.display_order)) {
      setErrorMessage('A ordem de exibicao precisa ser um numero inteiro valido.')
      return
    }

    setIsSaving(true)

    const result = selectedPostId
      ? await supabase.from('blog_posts').update(payload).eq('id', selectedPostId).select('*').single()
      : await supabase.from('blog_posts').insert(payload).select('*').single()

    setIsSaving(false)

    if (result.error) {
      setErrorMessage(result.error.message)
      return
    }

    const savedPost = result.data as BlogPostRecord
    setPosts((current) => {
      if (selectedPostId) {
        return current.map((entry) => (entry.id === savedPost.id ? savedPost : entry))
      }
      return [savedPost, ...current]
    })
    setSelectedPostId(savedPost.id)
    setSuccessMessage(selectedPostId ? 'Artigo atualizado com sucesso.' : 'Artigo criado com sucesso.')
  }

  async function handleDeletePost() {
    if (!selectedPostId) {
      return
    }

    const selectedPost = posts.find((entry) => entry.id === selectedPostId)
    if (!selectedPost) {
      return
    }

    const shouldDelete = window.confirm(`Deseja excluir o artigo "${selectedPost.title}"?`)
    if (!shouldDelete) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)

    const result = await supabase.from('blog_posts').delete().eq('id', selectedPostId)
    if (result.error) {
      setErrorMessage(result.error.message)
      return
    }

    setPosts((current) => current.filter((entry) => entry.id !== selectedPostId))
    resetForm()
    setSuccessMessage('Artigo removido com sucesso.')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Blog</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Blog e conteudo</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            Gerencie os artigos que aparecem na area publica do blog, com status de publicacao, destaque e ordem de exibicao.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => void loadPosts()} className="rounded-2xl border-[#D8E6EB]">
            Atualizar
          </Button>
          <Button type="button" onClick={resetForm} className="rounded-2xl bg-[#1398B7] hover:bg-[#0A3640]">
            Novo artigo
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Total</p>
          <p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.total}</p>
        </div>
        <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Publicados</p>
          <p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.published}</p>
        </div>
        <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Rascunhos</p>
          <p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.draft}</p>
        </div>
        <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Agendados</p>
          <p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.scheduled}</p>
        </div>
        <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Arquivados</p>
          <p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.archived}</p>
        </div>
        <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Em destaque</p>
          <p className="mt-2 text-2xl font-black text-[#15323b]">{statusSummary.featured}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
          <h2 className="text-lg font-black tracking-tight text-[#15323b]">
            {selectedPostId ? 'Editar artigo' : 'Criar artigo'}
          </h2>
          <p className="mt-2 text-sm font-medium text-[#6d7f84]">
            Funcionalidades de criacao/revisao com IA nao foram aplicadas neste modulo.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
              Titulo
              <input
                value={form.title}
                onChange={(event) => {
                  const nextTitle = event.target.value
                  setForm((current) => ({
                    ...current,
                    title: nextTitle,
                    slug: isSlugTouched ? current.slug : slugify(nextTitle),
                  }))
                }}
                className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="Titulo do artigo"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
              Slug
              <input
                value={form.slug}
                onChange={(event) => {
                  setIsSlugTouched(true)
                  setForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                }}
                className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="exemplo-artigo-genflix"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                Categoria
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  placeholder="Saude, Direito..."
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                Autor
                <input
                  value={form.author}
                  onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
                  className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  placeholder="Equipe GenFlix"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as BlogStatus }))}
                  className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                >
                  <option value="draft">Rascunho</option>
                  <option value="scheduled">Agendado</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                Publicar em
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
                  className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                Tempo de leitura
                <input
                  value={form.readTime}
                  onChange={(event) => setForm((current) => ({ ...current, readTime: event.target.value }))}
                  className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  placeholder="6 min de leitura"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                Ordem de exibicao
                <input
                  value={form.displayOrder}
                  onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))}
                  className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  placeholder="1"
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
              URL da capa
              <input
                value={form.imageUrl}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                className="h-11 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="https://..."
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
              Excerpt
              <textarea
                value={form.excerpt}
                onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
                rows={3}
                className="rounded-xl border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-medium text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="Resumo para cards e listagem"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5F7077]">
              Conteudo (paragrafos separados por linha em branco)
              <textarea
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                rows={9}
                className="rounded-xl border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-medium text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="Primeiro paragrafo..."
              />
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2 text-sm font-semibold text-[#15323b]">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
                className="h-4 w-4 rounded border-[#D8E6EB]"
              />
              Marcar como artigo em destaque
            </label>

            <div className="flex flex-wrap gap-3 border-t border-[#D8E6EB] pt-4">
              <Button
                type="button"
                onClick={() => void handleSavePost()}
                disabled={isSaving}
                className="rounded-2xl bg-[#1398B7] hover:bg-[#0A3640]"
              >
                {isSaving ? 'Salvando...' : 'Salvar artigo'}
              </Button>
              {selectedPostId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDeletePost()}
                  className="rounded-2xl border-red-200 text-red-700 hover:bg-red-50"
                >
                  Excluir artigo
                </Button>
              ) : null}
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5">
          <div className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black tracking-tight text-[#15323b]">Lista de artigos</h2>
            <div className="flex flex-wrap gap-2">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por titulo, slug, autor..."
                className="h-10 min-w-[220px] rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-medium text-[#15323b] outline-none focus:border-[#1398B7]"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | BlogStatus)}
                className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
              >
                <option value="all">Todos status</option>
                <option value="draft">Rascunho</option>
                <option value="scheduled">Agendado</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <p className="py-8 text-sm font-medium text-[#6d7f84]">Carregando artigos...</p>
          ) : filteredPosts.length === 0 ? (
            <p className="py-8 text-sm font-medium text-[#6d7f84]">Nenhum artigo encontrado.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                  <tr>
                    <th className="px-4 py-3">Titulo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Publicacao</th>
                    <th className="px-4 py-3">Destaque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E6EB]">
                  {filteredPosts.map((post) => (
                    <tr
                      key={post.id}
                      className={`cursor-pointer transition-colors hover:bg-[#F8FBFC] ${selectedPostId === post.id ? 'bg-[#E8F6FA]' : ''}`}
                      onClick={() => populateForm(post)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-black text-[#15323b]">{post.title}</p>
                        <p className="mt-1 text-xs font-semibold text-[#6d7f84]">/{post.slug}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#15323b]">{post.status ?? 'draft'}</td>
                      <td className="px-4 py-3 font-semibold text-[#5F7077]">{post.category ?? '-'}</td>
                      <td className="px-4 py-3 font-semibold text-[#5F7077]">{formatDateTime(post.published_at)}</td>
                      <td className="px-4 py-3 font-semibold text-[#5F7077]">{post.featured ? 'Sim' : 'Nao'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}
