import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createSupportFaq, deleteSupportFaq, fetchAdminSupportFaqs, fetchSupportSettings, updateSupportFaq } from '@/features/support/api'
import type { SupportFaqItem, SupportTicketCategory } from '@/features/support/types'
import { getOrderedSupportCategories } from '@/lib/support-sla'

type FaqDraft = {
  category_key: SupportTicketCategory
  question: string
  answer: string
  sort_order: number
  is_published: boolean
}

const emptyDraft: FaqDraft = {
  category_key: 'general',
  question: '',
  answer: '',
  sort_order: 0,
  is_published: true,
}

export function AdminSupportFaqPage() {
  const [faqs, setFaqs] = useState<SupportFaqItem[]>([])
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSupportSettings>> | null>(null)
  const [newDraft, setNewDraft] = useState<FaqDraft>(emptyDraft)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState<string | 'new' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadData() {
    setIsRefreshing(true)
    setErrorMessage(null)
    try {
      const [faqRows, supportSettings] = await Promise.all([
        fetchAdminSupportFaqs(),
        fetchSupportSettings(),
      ])
      setFaqs(faqRows)
      setSettings(supportSettings)
      setNewDraft((current) => ({ ...current, sort_order: faqRows.length + 1 }))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar as FAQs.')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const categories = useMemo(
    () => getOrderedSupportCategories(settings?.sla),
    [settings?.sla],
  )

  const categoryLabelMap = useMemo(() => new Map(categories.map((item) => [item.key, item.label])), [categories])

  function updateDraft(id: string, patch: Partial<FaqDraft>) {
    setFaqs((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
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
    try {
      const updated = await updateSupportFaq(item.id, toMutationPayload(item))
      setFaqs((current) => current.map((entry) => entry.id === item.id ? updated : entry))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar a FAQ.')
    } finally {
      setIsSaving(null)
    }
  }

  async function handleCreate() {
    if (!newDraft.question.trim() || !newDraft.answer.trim()) {
      setErrorMessage('Preencha pergunta e resposta para criar uma FAQ.')
      return
    }

    setIsSaving('new')
    setErrorMessage(null)
    try {
      const created = await createSupportFaq(toMutationPayload(newDraft))
      setFaqs((current) => [...current, created].sort((a, b) => a.sort_order - b.sort_order))
      setNewDraft({
        ...emptyDraft,
        sort_order: faqs.length + 2,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a FAQ.')
    } finally {
      setIsSaving(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir esta FAQ?')) {
      return
    }

    setIsSaving(id)
    setErrorMessage(null)
    try {
      await deleteSupportFaq(id)
      setFaqs((current) => current.filter((item) => item.id !== id))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir a FAQ.')
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Suporte</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">FAQ e Ajuda</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            Cadastre, edite e publique perguntas frequentes para a pagina publica de suporte.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData()}
          disabled={isRefreshing}
          className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar lista
        </Button>
      </header>

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <h2 className="font-readex text-xl font-semibold text-[#15323b]">Nova pergunta</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-[180px_140px_140px_1fr]">
          <select
            value={newDraft.category_key}
            onChange={(event) => setNewDraft((current) => ({ ...current, category_key: event.target.value as SupportTicketCategory }))}
            className="h-11 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-sm font-semibold text-[#15323b] outline-none"
          >
            {categories.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={newDraft.sort_order}
            onChange={(event) => setNewDraft((current) => ({ ...current, sort_order: Number(event.target.value) }))}
            className="h-11 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-sm font-semibold text-[#15323b] outline-none"
            placeholder="Ordem"
          />
          <label className="flex h-11 items-center gap-2 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-sm font-semibold text-[#15323b]">
            <input
              type="checkbox"
              checked={newDraft.is_published}
              onChange={(event) => setNewDraft((current) => ({ ...current, is_published: event.target.checked }))}
            />
            Publicada
          </label>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSaving === 'new'}
            className="h-11 rounded-[14px] px-4 text-sm font-black"
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar FAQ
          </Button>
        </div>
        <input
          value={newDraft.question}
          onChange={(event) => setNewDraft((current) => ({ ...current, question: event.target.value }))}
          placeholder="Pergunta"
          className="mt-3 h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-sm font-semibold text-[#15323b] outline-none"
        />
        <textarea
          value={newDraft.answer}
          onChange={(event) => setNewDraft((current) => ({ ...current, answer: event.target.value }))}
          placeholder="Resposta"
          className="mt-3 min-h-24 w-full rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-2 text-sm font-medium text-[#15323b] outline-none"
        />
      </section>

      <section className="rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <h2 className="font-readex text-xl font-semibold text-[#15323b]">Perguntas existentes</h2>
        {isLoading ? (
          <p className="mt-4 text-sm font-semibold text-[#5F7077]">Carregando FAQs...</p>
        ) : faqs.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-[#5F7077]">Nenhuma FAQ cadastrada.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {faqs.map((item) => (
              <article key={item.id} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <div className="grid gap-3 lg:grid-cols-[180px_140px_140px_1fr_1fr]">
                  <select
                    value={item.category_key}
                    onChange={(event) => updateDraft(item.id, { category_key: event.target.value as SupportTicketCategory })}
                    className="h-10 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category.key} value={category.key}>{category.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.sort_order}
                    onChange={(event) => updateDraft(item.id, { sort_order: Number(event.target.value) })}
                    className="h-10 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                  />
                  <label className="flex h-10 items-center gap-2 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b]">
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_published)}
                      onChange={(event) => updateDraft(item.id, { is_published: event.target.checked })}
                    />
                    Publicada
                  </label>
                  <div className="self-center text-xs font-semibold text-[#5F7077]">
                    Categoria: {categoryLabelMap.get(item.category_key) ?? item.category_key}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleSaveExisting(item)}
                      disabled={isSaving === item.id}
                      className="h-10 rounded-[12px] border-[#D8E6EB] bg-white px-4 text-xs font-black text-[#15323b]"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleDelete(item.id)}
                      disabled={isSaving === item.id}
                      className="h-10 rounded-[12px] px-4 text-xs font-black"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
                <input
                  value={item.question}
                  onChange={(event) => updateDraft(item.id, { question: event.target.value })}
                  className="mt-3 h-10 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                />
                <textarea
                  value={item.answer}
                  onChange={(event) => updateDraft(item.id, { answer: event.target.value })}
                  className="mt-3 min-h-24 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-medium text-[#15323b] outline-none"
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
