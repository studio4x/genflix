import { useEffect, useMemo, useState } from 'react'
import { FileText, LifeBuoy, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  createSupportFaq,
  deleteSupportFaq,
  fetchAdminSupportFaqs,
  fetchSupportFaqEvents,
  fetchSupportFaqSuggestions,
  fetchSupportSettings,
  updateSupportFaq,
} from '@/features/support/api'
import type { SupportFaqItem, SupportFaqSuggestionItem } from '@/features/support/types'
import { getOrderedSupportCategories } from '@/lib/support-sla'

type AdminFaqTab = 'artigos' | 'categorias' | 'feedback' | 'sugestoes' | 'analytics'
type ArticleStatusFilter = 'all' | 'draft' | 'published'
type PeriodFilter = '7d' | '30d' | '90d'

type FaqDraft = {
  category_key: string
  question: string
  answer: string
  sort_order: number
  is_published: boolean
}

type FaqCategoryOption = {
  key: string
  label: string
  description: string
  source: 'sla' | 'faq'
}

const emptyDraft: FaqDraft = {
  category_key: 'general',
  question: '',
  answer: '',
  sort_order: 0,
  is_published: true,
}

function normalizeSearchParams(params: URLSearchParams) {
  return {
    tab: (params.get('tab') as AdminFaqTab) || 'artigos',
    query: params.get('q') || '',
    status: (params.get('status') as ArticleStatusFilter) || 'all',
    category: params.get('category') || 'all',
    period: (params.get('period') as PeriodFilter) || '30d',
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

function toFaqCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function formatFaqCategoryLabel(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export function AdminSupportFaqPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = normalizeSearchParams(searchParams)
  const [searchInput, setSearchInput] = useState(filters.query)

  const [faqs, setFaqs] = useState<SupportFaqItem[]>([])
  const [faqSuggestions, setFaqSuggestions] = useState<SupportFaqSuggestionItem[]>([])
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSupportSettings>> | null>(null)
  const [newDraft, setNewDraft] = useState<FaqDraft>(emptyDraft)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState<string | 'new' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [faqEvents, setFaqEvents] = useState<Awaited<ReturnType<typeof fetchSupportFaqEvents>>>([])
  const [manualFaqCategories, setManualFaqCategories] = useState<string[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')

  const periodDays = filters.period === '7d' ? 7 : filters.period === '90d' ? 90 : 30

  async function loadData() {
    setIsRefreshing(true)
    setErrorMessage(null)

    try {
      const [faqRows, supportSettings, events, suggestions] = await Promise.all([
        fetchAdminSupportFaqs(),
        fetchSupportSettings(),
        fetchSupportFaqEvents(periodDays),
        fetchSupportFaqSuggestions(periodDays),
      ])

      setFaqs(faqRows)
      setSettings(supportSettings)
      setFaqEvents(events)
      setFaqSuggestions(suggestions)
      setNewDraft((current) => ({ ...current, sort_order: faqRows.length + 1 }))
      setSelectedArticleId((current) => current ?? faqRows[0]?.id ?? null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar os dados. Tente novamente.')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [filters.period])

  useEffect(() => {
    setSearchInput(filters.query)
  }, [filters.query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        if (searchInput.trim()) {
          next.set('q', searchInput.trim())
        } else {
          next.delete('q')
        }
        return next
      }, { replace: true })
    }, 400)

    return () => window.clearTimeout(timer)
  }, [searchInput, setSearchParams])

  const categories = useMemo(() => getOrderedSupportCategories(settings?.sla), [settings?.sla])

  const faqCategoryOptions = useMemo<FaqCategoryOption[]>(() => {
    const optionMap = new Map<string, FaqCategoryOption>()

    categories.forEach((item) => {
      optionMap.set(item.key, {
        key: item.key,
        label: item.label,
        description: item.description,
        source: 'sla',
      })
    })

    faqs.forEach((item) => {
      if (optionMap.has(item.category_key)) {
        return
      }

      optionMap.set(item.category_key, {
        key: item.category_key,
        label: formatFaqCategoryLabel(item.category_key),
        description: 'Categoria personalizada da FAQ.',
        source: 'faq',
      })
    })

    manualFaqCategories.forEach((categoryKey) => {
      if (optionMap.has(categoryKey)) {
        return
      }

      optionMap.set(categoryKey, {
        key: categoryKey,
        label: formatFaqCategoryLabel(categoryKey),
        description: 'Categoria personalizada da FAQ.',
        source: 'faq',
      })
    })

    return [...optionMap.values()].sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'sla' ? -1 : 1
      }
      return a.label.localeCompare(b.label, 'pt-BR')
    })
  }, [categories, faqs, manualFaqCategories])

  const categoryLabelMap = useMemo(
    () => new Map(faqCategoryOptions.map((item) => [item.key, item.label])),
    [faqCategoryOptions],
  )

  const filteredFaqs = useMemo(() => {
    return faqs
      .filter((item) => {
        const matchesStatus = filters.status === 'all'
          || (filters.status === 'published' && Boolean(item.is_published))
          || (filters.status === 'draft' && !item.is_published)
        const matchesCategory = filters.category === 'all' || item.category_key === filters.category
        const normalizedQuery = filters.query.trim().toLowerCase()
        const matchesQuery = normalizedQuery.length === 0
          || item.question.toLowerCase().includes(normalizedQuery)
          || item.answer.toLowerCase().includes(normalizedQuery)
        return matchesStatus && matchesCategory && matchesQuery
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [faqs, filters.category, filters.query, filters.status])

  const selectedArticle = useMemo(
    () => filteredFaqs.find((item) => item.id === selectedArticleId) ?? filteredFaqs[0] ?? null,
    [filteredFaqs, selectedArticleId],
  )

  const kpis = useMemo(() => {
    const published = faqs.filter((item) => Boolean(item.is_published)).length
    const drafts = faqs.length - published
    return {
      published,
      drafts,
      suggestions: faqSuggestions.length,
    }
  }, [faqs, faqSuggestions.length])

  const feedbackSummary = useMemo(() => {
    const helpful = faqEvents.filter((item) => item.event_type === 'helpful').length
    const notHelpful = faqEvents.filter((item) => item.event_type === 'not_helpful').length
    const totalVotes = helpful + notHelpful
    const helpfulRate = totalVotes > 0 ? Math.round((helpful / totalVotes) * 100) : 0
    return { helpful, notHelpful, totalVotes, helpfulRate }
  }, [faqEvents])

  const analyticsSummary = useMemo(() => {
    const noResultRows = faqEvents.filter((item) => item.event_type === 'search_no_result')
    const noResultCount = noResultRows.length
    const topQueriesMap = new Map<string, number>()

    noResultRows.forEach((row) => {
      const key = row.query?.trim().toLowerCase()
      if (!key) {
        return
      }
      topQueriesMap.set(key, (topQueriesMap.get(key) ?? 0) + 1)
    })

    const topQueries = [...topQueriesMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return { noResultCount, topQueries }
  }, [faqEvents])

  const suggestionsSummary = useMemo(() => {
    const categoryCounts = new Map<string, number>()
    faqSuggestions.forEach((item) => {
      categoryCounts.set(item.category_key, (categoryCounts.get(item.category_key) ?? 0) + 1)
    })

    return {
      total: faqSuggestions.length,
      topCategories: [...categoryCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    }
  }, [faqSuggestions])

  function updateSearchParam(key: string, value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value && value !== 'all') {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    }, { replace: true })
  }

  function updateDraft(id: string, patch: Partial<FaqDraft>) {
    setFaqs((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function toMutationPayload(item: FaqDraft | SupportFaqItem): FaqDraft {
    return {
      category_key: item.category_key,
      question: item.question.trim(),
      answer: item.answer.trim(),
      sort_order: Number(item.sort_order) || 0,
      is_published: Boolean(item.is_published),
    }
  }

  async function handleSaveExisting(item: SupportFaqItem) {
    setIsSaving(item.id)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updated = await updateSupportFaq(item.id, toMutationPayload(item))
      setFaqs((current) => current.map((entry) => (entry.id === item.id ? updated : entry)))
      setSuccessMessage('Alteracoes salvas com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar a FAQ.')
    } finally {
      setIsSaving(null)
    }
  }

  async function handleCreate() {
    if (!newDraft.question.trim() || !newDraft.answer.trim()) {
      setErrorMessage('Revise os campos obrigatorios antes de publicar.')
      return
    }

    setIsSaving('new')
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const created = await createSupportFaq(toMutationPayload(newDraft))
      setFaqs((current) => [...current, created].sort((a, b) => a.sort_order - b.sort_order))
      setSelectedArticleId(created.id)
      setNewDraft({
        ...emptyDraft,
        sort_order: faqs.length + 2,
      })
      setSuccessMessage('Alteracoes salvas com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a FAQ.')
    } finally {
      setIsSaving(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Confirmar exclusao do artigo de FAQ?')) {
      return
    }

    setIsSaving(id)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await deleteSupportFaq(id)
      setFaqs((current) => current.filter((item) => item.id !== id))
      setSelectedArticleId((current) => (current === id ? null : current))
      setSuccessMessage('Alteracoes salvas com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir a FAQ.')
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[26px] border border-[#D8E6EB] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1398B7]">FAQ Admin</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">Modulo de FAQ</h1>
          <p className="mt-2 text-sm font-medium text-[#5F7077]">Gestao editorial, categorizacao e visao operacional da base de ajuda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filters.period}
            onChange={(event) => updateSearchParam('period', event.target.value)}
            className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
          >
            <option value="7d">Periodo: 7 dias</option>
            <option value="30d">Periodo: 30 dias</option>
            <option value="90d">Periodo: 90 dias</option>
          </select>
          <Button type="button" variant="outline" className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]">
            Exportar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData()}
            disabled={isRefreshing}
            className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-[#D8E6EB] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Artigos publicados</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{kpis.published}</p>
        </article>
        <article className="rounded-[24px] border border-[#D8E6EB] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Rascunhos</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{kpis.drafts}</p>
        </article>
        <article className="rounded-[24px] border border-[#D8E6EB] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Helpful rate</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">--</p>
        </article>
        <article className="rounded-[24px] border border-[#D8E6EB] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Sugestoes recebidas</p>
          <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{kpis.suggestions}</p>
        </article>
      </section>

      <section className="rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(['artigos', 'categorias', 'feedback', 'sugestoes', 'analytics'] as AdminFaqTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => updateSearchParam('tab', tab)}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition-colors ${
                filters.tab === tab
                  ? 'bg-[#1398B7] text-white'
                  : 'bg-[#F8FBFC] text-[#5F7077] hover:bg-[#EBF3F5]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage}</div>
        ) : null}
        {successMessage ? (
          <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{successMessage}</div>
        ) : null}

        {filters.tab === 'artigos' ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 xl:grid-cols-[180px_180px_1fr]">
              <select
                value={filters.status}
                onChange={(event) => updateSearchParam('status', event.target.value)}
                className="h-11 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-sm font-semibold text-[#15323b] outline-none"
              >
                <option value="all">Status: Todos</option>
                <option value="published">Status: Published</option>
                <option value="draft">Status: Draft</option>
              </select>

              <select
                value={filters.category}
                onChange={(event) => updateSearchParam('category', event.target.value)}
                className="h-11 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-sm font-semibold text-[#15323b] outline-none"
              >
                <option value="all">Categoria: Todas</option>
                    {faqCategoryOptions.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
              </select>

              <label className="flex h-11 items-center gap-2 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3">
                <Search className="h-4 w-4 text-[#8BA0A7]" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar pergunta, resposta ou tag..."
                  className="w-full bg-transparent text-sm font-semibold text-[#15323b] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
              <div className="overflow-hidden rounded-[22px] border border-[#D8E6EB]">
                {isLoading ? (
                  <p className="p-5 text-sm font-semibold text-[#5F7077]">Carregando dados do FAQ...</p>
                ) : filteredFaqs.length === 0 ? (
                  <p className="p-5 text-sm font-semibold text-[#5F7077]">Nenhum item encontrado com os filtros atuais.</p>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#F2F7F9] text-left">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Pergunta</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Categoria</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFaqs.map((item) => (
                        <tr
                          key={item.id}
                          className={`cursor-pointer border-t border-[#D8E6EB] transition-colors hover:bg-[#F8FBFC] ${selectedArticle?.id === item.id ? 'bg-[#F2FBFF]' : ''}`}
                          onClick={() => setSelectedArticleId(item.id)}
                        >
                          <td className="px-4 py-3 font-semibold text-[#15323b]">{item.question}</td>
                          <td className="px-4 py-3 text-[#5F7077]">{categoryLabelMap.get(item.category_key) ?? item.category_key}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${
                                item.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.is_published ? 'published' : 'draft'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleDelete(item.id)
                                }}
                                disabled={isSaving === item.id}
                                className="h-8 rounded-full px-3 text-xs font-black"
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <aside className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <h3 className="font-readex text-lg font-semibold text-[#15323b]">Painel de detalhes</h3>
                {!selectedArticle ? (
                  <p className="mt-3 text-sm font-semibold text-[#5F7077]">Selecione um artigo para editar o conteudo.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <select
                      value={selectedArticle.category_key}
                      onChange={(event) => updateDraft(selectedArticle.id, { category_key: event.target.value })}
                      className="h-10 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                    >
                      {faqCategoryOptions.map((category) => (
                        <option key={category.key} value={category.key}>{category.label}</option>
                      ))}
                    </select>
                    <input
                      value={selectedArticle.question}
                      onChange={(event) => updateDraft(selectedArticle.id, { question: event.target.value })}
                      className="h-10 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                      placeholder="Pergunta"
                    />
                    <textarea
                      value={selectedArticle.answer}
                      onChange={(event) => updateDraft(selectedArticle.id, { answer: event.target.value })}
                      className="min-h-28 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-medium text-[#15323b] outline-none"
                      placeholder="Resposta"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={selectedArticle.sort_order}
                        onChange={(event) => updateDraft(selectedArticle.id, { sort_order: Number(event.target.value) })}
                        className="h-10 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                      />
                      <label className="flex h-10 items-center gap-2 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b]">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedArticle.is_published)}
                          onChange={(event) => updateDraft(selectedArticle.id, { is_published: event.target.checked })}
                        />
                        Publicado
                      </label>
                    </div>
                    <div className="rounded-[12px] border border-[#D8E6EB] bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Preview</p>
                      <p className="mt-2 text-sm font-black text-[#15323b]">{selectedArticle.question}</p>
                      <p className="mt-2 text-sm leading-6 text-[#5F7077]">{selectedArticle.answer}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleSaveExisting(selectedArticle)}
                      disabled={isSaving === selectedArticle.id}
                      className="h-10 rounded-[12px] border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#15323b]"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Salvar alteracoes
                    </Button>
                  </div>
                )}
              </aside>
            </div>

            <article className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Nova pergunta frequente</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-[180px_120px_1fr]">
                <select
                  value={newDraft.category_key}
                  onChange={(event) => setNewDraft((current) => ({ ...current, category_key: event.target.value }))}
                  className="h-10 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                >
                  {faqCategoryOptions.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newDraft.sort_order}
                  onChange={(event) => setNewDraft((current) => ({ ...current, sort_order: Number(event.target.value) }))}
                  className="h-10 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                  placeholder="Ordem"
                />
                <label className="flex h-10 items-center gap-2 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b]">
                  <input
                    type="checkbox"
                    checked={newDraft.is_published}
                    onChange={(event) => setNewDraft((current) => ({ ...current, is_published: event.target.checked }))}
                  />
                  Publicado
                </label>
              </div>
              <input
                value={newDraft.question}
                onChange={(event) => setNewDraft((current) => ({ ...current, question: event.target.value }))}
                placeholder="Pergunta"
                className="mt-2 h-10 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
              />
              <textarea
                value={newDraft.answer}
                onChange={(event) => setNewDraft((current) => ({ ...current, answer: event.target.value }))}
                placeholder="Resposta"
                className="mt-2 min-h-24 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-medium text-[#15323b] outline-none"
              />
              <Button type="button" onClick={() => void handleCreate()} disabled={isSaving === 'new'} className="mt-3 h-11 w-full rounded-[12px] px-4 text-sm font-black">
                Nova pergunta frequente
              </Button>
            </article>
          </div>
        ) : null}

        {filters.tab === 'categorias' ? (
          <div className="mt-5 rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-[#1398B7]" />
              <p className="text-sm font-semibold text-[#15323b]">FAQ Admin / Categorias</p>
            </div>
            <p className="mt-2 text-sm text-[#5F7077]">Categorias usadas na FAQ. Voce pode adicionar novas categorias personalizadas diretamente por esta aba.</p>
            <div className="mt-4 rounded-[14px] border border-[#D8E6EB] bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Nova categoria</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Ex.: Certificados"
                  className="h-10 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const categoryKey = toFaqCategoryKey(newCategoryName)
                    if (!categoryKey) {
                      setErrorMessage('Informe um nome valido para criar a categoria.')
                      return
                    }
                    if (faqCategoryOptions.some((item) => item.key === categoryKey)) {
                      setErrorMessage('Essa categoria ja existe.')
                      return
                    }

                    setManualFaqCategories((current) => [...current, categoryKey])
                    setNewDraft((current) => ({ ...current, category_key: categoryKey }))
                    setNewCategoryName('')
                    setErrorMessage(null)
                    setSuccessMessage('Categoria adicionada com sucesso.')
                  }}
                  className="h-10 rounded-[12px] px-4 text-sm font-black"
                >
                  Adicionar categoria
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {faqCategoryOptions.map((category) => (
                <div key={category.key} className="flex items-center justify-between rounded-[12px] border border-[#D8E6EB] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-bold text-[#15323b]">{category.label}</p>
                    <p className="text-xs text-[#5F7077]">{category.description}</p>
                  </div>
                  <span className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#1398B7]">
                    {category.source === 'sla' ? 'SLA' : 'FAQ'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {filters.tab === 'feedback' ? (
          <div className="mt-5 rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1398B7]" />
              <p className="text-sm font-semibold text-[#15323b]">FAQ Admin / Feedback</p>
            </div>
            <p className="mt-2 text-sm text-[#5F7077]">Esta aba mostra votos de utilidade enviados na secao de perguntas frequentes da pagina publica de suporte.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[14px] border border-[#D8E6EB] bg-white p-3">
                <p className="text-xs font-semibold text-[#5F7077]">Votos uteis</p>
                <p className="mt-1 text-xl font-black text-emerald-700">{feedbackSummary.helpful}</p>
              </article>
              <article className="rounded-[14px] border border-[#D8E6EB] bg-white p-3">
                <p className="text-xs font-semibold text-[#5F7077]">Votos nao uteis</p>
                <p className="mt-1 text-xl font-black text-rose-700">{feedbackSummary.notHelpful}</p>
              </article>
              <article className="rounded-[14px] border border-[#D8E6EB] bg-white p-3">
                <p className="text-xs font-semibold text-[#5F7077]">Helpful rate</p>
                <p className="mt-1 text-xl font-black text-[#15323b]">{feedbackSummary.helpfulRate}%</p>
              </article>
            </div>
          </div>
        ) : null}

        {filters.tab === 'sugestoes' ? (
          <div className="mt-5 rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1398B7]" />
              <p className="text-sm font-semibold text-[#15323b]">FAQ Admin / Sugestoes</p>
            </div>
            <p className="mt-2 text-sm text-[#5F7077]">Sugestoes enviadas pelos usuarios quando a busca nao encontra correspondencia na pagina publica de suporte.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[14px] border border-[#D8E6EB] bg-white p-3">
                <p className="text-xs font-semibold text-[#5F7077]">Total de sugestoes</p>
                <p className="mt-1 text-xl font-black text-[#15323b]">{suggestionsSummary.total}</p>
              </article>
              <article className="rounded-[14px] border border-[#D8E6EB] bg-white p-3">
                <p className="text-xs font-semibold text-[#5F7077]">Categorias mais pedidas</p>
                <p className="mt-1 text-sm font-semibold text-[#15323b]">
                  {suggestionsSummary.topCategories.length > 0
                    ? suggestionsSummary.topCategories.map(([key]) => categoryLabelMap.get(key) ?? key).join(', ')
                    : '-'}
                </p>
              </article>
            </div>
            <div className="mt-4 overflow-hidden rounded-[18px] border border-[#D8E6EB] bg-white">
              {faqSuggestions.length === 0 ? (
                <p className="p-4 text-sm font-semibold text-[#5F7077]">Nenhuma sugestao recebida no periodo.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#F2F7F9] text-left">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Busca</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Sugestao</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Categoria</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faqSuggestions.map((item) => (
                      <tr key={item.id} className="border-t border-[#D8E6EB]">
                        <td className="px-4 py-3 font-semibold text-[#15323b]">{item.search_query}</td>
                        <td className="px-4 py-3 text-[#5F7077]">{item.suggested_question}</td>
                        <td className="px-4 py-3 text-[#5F7077]">{categoryLabelMap.get(item.category_key) ?? item.category_key}</td>
                        <td className="px-4 py-3 text-[#5F7077]">{formatDateTime(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        {filters.tab === 'analytics' ? (
          <div className="mt-5 rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#15323b]">FAQ Admin / Analytics</p>
            </div>
            <p className="mt-2 text-sm text-[#5F7077]">Esta aba consolida eventos de busca sem resultado capturados na busca de FAQ da pagina publica de suporte.</p>
            <div className="mt-4 rounded-[14px] border border-[#D8E6EB] bg-white p-3">
              <p className="text-xs font-semibold text-[#5F7077]">Buscas sem resultado no periodo</p>
              <p className="mt-1 text-xl font-black text-[#15323b]">{analyticsSummary.noResultCount}</p>
            </div>
            <div className="mt-3 rounded-[14px] border border-[#D8E6EB] bg-white p-3">
              <p className="text-xs font-semibold text-[#5F7077]">Top termos sem resposta</p>
              {analyticsSummary.topQueries.length === 0 ? (
                <p className="mt-2 text-sm text-[#5F7077]">Nenhuma busca sem resultado registrada no periodo.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-[#15323b]">
                  {analyticsSummary.topQueries.map(([query, count]) => (
                    <li key={query} className="flex items-center justify-between">
                      <span>{query}</span>
                      <span className="font-black">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
