import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  createResourcesItemsFallback,
  normalizeResourcesItems,
  resolveResourceVideoUrl,
} from '@/features/public/genflix-resource-items-editor'
import {
  fetchSiteContent,
  fetchSiteContentVersions,
  restoreSiteContentVersion,
  saveSiteContentEntry,
} from '@/features/site-editor/api'
import type { EditableListItem, SiteContentVersion } from '@/features/site-editor/types'

type ResourceCardStyleSettings = {
  cardBackgroundColor: string
  cardBorderColor: string
  cardBorderWidth: number
  cardBorderRadius: number
  cardShadow: string
  titleColor: string
  titleFontSize: number
  titleFontWeight: number
  descriptionColor: string
  descriptionFontSize: number
  descriptionLineHeight: number
  iconBackgroundColor: string
  iconColor: string
  iconSize: number
  buttonBackgroundColor: string
  buttonTextColor: string
  buttonBorderColor: string
  buttonRadius: number
}

const defaultCardStyle: ResourceCardStyleSettings = {
  cardBackgroundColor: '#F2F7F9',
  cardBorderColor: '#D8E6EB',
  cardBorderWidth: 1,
  cardBorderRadius: 18,
  cardShadow: '0 16px 36px rgba(21,50,59,0.04)',
  titleColor: '#183139',
  titleFontSize: 16,
  titleFontWeight: 700,
  descriptionColor: '#667980',
  descriptionFontSize: 14,
  descriptionLineHeight: 1.75,
  iconBackgroundColor: '#E8F6FA',
  iconColor: '#1398B7',
  iconSize: 18,
  buttonBackgroundColor: '#FFFFFF',
  buttonTextColor: '#0F7E99',
  buttonBorderColor: '#1398B7',
  buttonRadius: 999,
}

function toMetadata(item: EditableListItem) {
  if (!item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata)) {
    return {} as Record<string, unknown>
  }
  return { ...item.metadata as Record<string, unknown> }
}

function normalizeItemForSave(item: EditableListItem): EditableListItem {
  const metadata = toMetadata(item)
  const instructionalVideoUrl = typeof metadata.instructionalVideoUrl === 'string'
    ? metadata.instructionalVideoUrl.trim()
    : ''

  if (instructionalVideoUrl === '') {
    delete metadata.instructionalVideoUrl
  } else {
    metadata.instructionalVideoUrl = instructionalVideoUrl
  }

  const readMoreContent = typeof metadata.readMoreContent === 'string'
    ? metadata.readMoreContent.trim()
    : ''
  const readMoreEnabled = metadata.readMoreEnabled === true

  if (!readMoreEnabled || readMoreContent === '') {
    delete metadata.readMoreEnabled
    delete metadata.readMoreContent
  } else {
    metadata.readMoreEnabled = true
    metadata.readMoreContent = readMoreContent
  }

  return {
    ...item,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  }
}

function parseCardStyle(rawValue: unknown): ResourceCardStyleSettings {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { ...defaultCardStyle }
  }

  const value = rawValue as Record<string, unknown>
  const fromNumber = (field: keyof ResourceCardStyleSettings, min: number, max: number) => {
    const current = value[field]
    return typeof current === 'number' && Number.isFinite(current)
      ? Math.min(max, Math.max(min, current))
      : defaultCardStyle[field] as number
  }
  const fromString = (field: keyof ResourceCardStyleSettings) => {
    const current = value[field]
    return typeof current === 'string' && current.trim() !== ''
      ? current.trim()
      : defaultCardStyle[field] as string
  }

  return {
    cardBackgroundColor: fromString('cardBackgroundColor'),
    cardBorderColor: fromString('cardBorderColor'),
    cardBorderWidth: fromNumber('cardBorderWidth', 0, 12),
    cardBorderRadius: fromNumber('cardBorderRadius', 0, 64),
    cardShadow: fromString('cardShadow'),
    titleColor: fromString('titleColor'),
    titleFontSize: fromNumber('titleFontSize', 10, 48),
    titleFontWeight: fromNumber('titleFontWeight', 300, 900),
    descriptionColor: fromString('descriptionColor'),
    descriptionFontSize: fromNumber('descriptionFontSize', 10, 32),
    descriptionLineHeight: fromNumber('descriptionLineHeight', 1, 3),
    iconBackgroundColor: fromString('iconBackgroundColor'),
    iconColor: fromString('iconColor'),
    iconSize: fromNumber('iconSize', 12, 36),
    buttonBackgroundColor: fromString('buttonBackgroundColor'),
    buttonTextColor: fromString('buttonTextColor'),
    buttonBorderColor: fromString('buttonBorderColor'),
    buttonRadius: fromNumber('buttonRadius', 0, 999),
  }
}

function summarizeCardStyleVersion(rawValue: unknown) {
  const style = parseCardStyle(rawValue)
  return `Fundo ${style.cardBackgroundColor} · Borda ${style.cardBorderColor} (${style.cardBorderWidth}px) · Ícone ${style.iconSize}px · Título ${style.titleColor}`
}

export function AdminResourceVideosPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'style'>('items')
  const [items, setItems] = useState<EditableListItem[]>(createResourcesItemsFallback())
  const [cardStyle, setCardStyle] = useState<ResourceCardStyleSettings>({ ...defaultCardStyle })
  const [cardStyleVersions, setCardStyleVersions] = useState<SiteContentVersion[]>([])
  const [isLoadingCardStyleVersions, setIsLoadingCardStyleVersions] = useState(false)
  const [restoringCardStyleVersionId, setRestoringCardStyleVersionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingCardIndex, setSavingCardIndex] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const configuredCount = useMemo(
    () => items.filter((item) => resolveResourceVideoUrl(item) !== '').length,
    [items],
  )

  async function loadCardStyleVersions(entryId: string | null) {
    if (!entryId) {
      setCardStyleVersions([])
      return
    }

    setIsLoadingCardStyleVersions(true)
    try {
      const versions = await fetchSiteContentVersions(entryId)
      setCardStyleVersions(versions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o historico do padrao dos cards.')
    } finally {
      setIsLoadingCardStyleVersions(false)
    }
  }

  async function reloadResourcesData() {
    const entries = await fetchSiteContent('resources')
    const resourcesEntry = entries.find((entry) => entry.page_key === 'resources' && entry.entry_key === 'resources.items')
    const styleEntry = entries.find((entry) => entry.page_key === 'resources' && entry.entry_key === 'resources.cardStyle')

    setItems(normalizeResourcesItems(resourcesEntry?.value))
    setCardStyle(parseCardStyle(styleEntry?.value))
    await loadCardStyleVersions(styleEntry?.id ?? null)
  }

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        if (isMounted) {
          await reloadResourcesData()
        }
      } catch (loadError) {
        if (isMounted) {
          setItems(createResourcesItemsFallback())
          setCardStyle({ ...defaultCardStyle })
          setCardStyleVersions([])
          setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os recursos.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  function updateItem(index: number, updater: (item: EditableListItem) => EditableListItem) {
    setItems((current) => current.map((item, currentIndex) => (currentIndex === index ? updater(item) : item)))
  }

  function updateVideoUrl(index: number, nextValue: string) {
    updateItem(index, (item) => {
      const metadata = toMetadata(item)
      const trimmed = nextValue.trim()
      if (trimmed === '') {
        delete metadata.instructionalVideoUrl
      } else {
        metadata.instructionalVideoUrl = trimmed
      }
      return { ...item, metadata: Object.keys(metadata).length > 0 ? metadata : undefined }
    })
  }

  function updateReadMoreEnabled(index: number, enabled: boolean) {
    updateItem(index, (item) => {
      const metadata = toMetadata(item)
      if (enabled) {
        metadata.readMoreEnabled = true
      } else {
        delete metadata.readMoreEnabled
        delete metadata.readMoreContent
      }
      return { ...item, metadata: Object.keys(metadata).length > 0 ? metadata : undefined }
    })
  }

  function updateReadMoreContent(index: number, nextValue: string) {
    updateItem(index, (item) => {
      const metadata = toMetadata(item)
      const trimmed = nextValue.trim()
      if (trimmed === '') {
        delete metadata.readMoreContent
      } else {
        metadata.readMoreContent = trimmed
      }
      return { ...item, metadata: Object.keys(metadata).length > 0 ? metadata : undefined }
    })
  }

  async function saveResources(targetIndex: number | null = null) {
    setIsSaving(true)
    setSavingCardIndex(targetIndex)
    setMessage(null)
    setError(null)

    try {
      const normalizedItems = items.map(normalizeItemForSave)
      await saveSiteContentEntry({
        pageKey: 'resources',
        entryKey: 'resources.items',
        entryType: 'list',
        value: normalizedItems,
        schema: {
          kind: 'default',
          itemName: 'recurso',
          addLabel: 'Adicionar recurso',
        },
      })

      setItems(normalizedItems)
      setMessage(targetIndex === null ? 'Recursos salvos com sucesso.' : `Recurso ${targetIndex + 1} salvo com sucesso.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar os dados dos recursos.')
    } finally {
      setIsSaving(false)
      setSavingCardIndex(null)
    }
  }

  async function saveCardStyle(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const normalizedItems = items.map((item) => {
        const metadata = toMetadata(item)
        delete metadata.iconSize
        return {
          ...item,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }
      })

      await saveSiteContentEntry({
        pageKey: 'resources',
        entryKey: 'resources.items',
        entryType: 'list',
        value: normalizedItems,
        schema: {
          kind: 'default',
          itemName: 'recurso',
          addLabel: 'Adicionar recurso',
        },
      })

      await saveSiteContentEntry({
        pageKey: 'resources',
        entryKey: 'resources.cardStyle',
        entryType: 'json',
        value: cardStyle,
        schema: { kind: 'resources-card-style' },
      })
      await reloadResourcesData()
      setMessage('Padrao dos cards salvo com sucesso. Os tamanhos individuais dos icones foram resetados e o tamanho global passou a valer para todos os recursos, ate que algum item seja editado individualmente no editor visual.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar o padrao dos cards.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleItemsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveResources(null)
  }

  async function handleRestoreCardStyleVersion(version: SiteContentVersion) {
    const confirmed = window.confirm('Deseja reverter o padrão dos cards para esta revisão? Esta ação cria uma nova revisão.')
    if (!confirmed) return

    setMessage(null)
    setError(null)
    setRestoringCardStyleVersionId(version.id)

    try {
      await restoreSiteContentVersion(version)
      await reloadResourcesData()
      setMessage('Revisão do padrão dos cards restaurada com sucesso.')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Nao foi possivel restaurar esta revisao do padrao dos cards.')
    } finally {
      setRestoringCardStyleVersionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Recursos</p>
        <h1 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Recursos</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#5F7077]">
          Edite os cards de recursos por item e tambem o padrao visual global que sera aplicado na pagina publica.
        </p>
        <div className="max-w-4xl rounded-[16px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-900">
          O tamanho do icone definido nesta pagina e global. Ao salvar esse tamanho global, os tamanhos configurados individualmente no editor visual sao resetados para que todos os recursos passem a seguir o novo padrao. Se depois disso um recurso for editado individualmente no editor visual, o tamanho definido naquele recurso sobrescrevera o tamanho global apenas para ele.
        </div>
      </header>

      <section className="rounded-[20px] border border-[#D8E6EB] bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
              activeTab === 'items' ? 'bg-[#1398B7] text-white' : 'bg-[#F2F7F9] text-[#5F7077]'
            }`}
          >
            Itens de recursos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
              activeTab === 'style' ? 'bg-[#1398B7] text-white' : 'bg-[#F2F7F9] text-[#5F7077]'
            }`}
          >
            Padrao dos cards
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      {activeTab === 'items' ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Total de recursos</p>
              <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{items.length}</p>
            </article>
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Com video</p>
              <p className="mt-2 font-readex text-3xl font-semibold text-[#0F7E99]">{configuredCount}</p>
            </article>
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Sem video</p>
              <p className="mt-2 font-readex text-3xl font-semibold text-[#A04A34]">{Math.max(items.length - configuredCount, 0)}</p>
            </article>
          </section>

          <form onSubmit={(event) => void handleItemsSubmit(event)} className="space-y-4">
            <div className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FCFD] px-5 py-4 text-sm font-semibold leading-6 text-[#4F636A]">
              Os demais campos dos recursos (titulo, icone, descricao e cor) devem ser editados pelo editor visual. O tamanho global do icone fica na aba "Padrao dos cards". Se um recurso receber tamanho proprio no editor visual, ele sobrescreve o tamanho global.
            </div>

            <div className="grid gap-4">
              {items.map((item, index) => {
                const metadata = toMetadata(item)
                const currentVideoUrl = typeof metadata.instructionalVideoUrl === 'string' ? metadata.instructionalVideoUrl : ''
                const readMoreEnabled = metadata.readMoreEnabled === true
                const readMoreContent = typeof metadata.readMoreContent === 'string' ? metadata.readMoreContent : ''
                const isConfigured = resolveResourceVideoUrl(item) !== ''

                return (
                  <article key={item.id || `${item.label}-${index}`} className="rounded-[20px] border border-[#D8E6EB] bg-white px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Recurso {index + 1}</p>
                        <h2 className="mt-1 text-lg font-bold text-[#15323b]">{item.label || item.title || `Recurso ${index + 1}`}</h2>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                          isConfigured
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-[#D8E6EB] bg-[#F2F7F9] text-[#5F7077]'
                        }`}
                      >
                        {isConfigured ? 'Video ativo' : 'Sem video'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Link do video</span>
                        <input
                          value={currentVideoUrl}
                          onChange={(event) => updateVideoUrl(index, event.target.value)}
                          placeholder="https://..."
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                    </div>

                    <label className="mt-4 flex items-center justify-between rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-3 text-sm font-semibold text-[#15323b]">
                      <span>Ativar botao "Leia mais" neste recurso</span>
                      <input
                        type="checkbox"
                        checked={readMoreEnabled}
                        onChange={(event) => updateReadMoreEnabled(index, event.target.checked)}
                      />
                    </label>

                    {readMoreEnabled ? (
                      <label className="mt-4 grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Conteudo do "Leia mais"</span>
                        <textarea
                          value={readMoreContent}
                          onChange={(event) => updateReadMoreContent(index, event.target.value)}
                          rows={6}
                          className="rounded-[14px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                    ) : null}

                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        onClick={() => void saveResources(index)}
                        disabled={isSaving || isLoading}
                        className="rounded-none bg-[#1398B7] font-black text-white hover:bg-[#0F7E99]"
                      >
                        {isSaving && savingCardIndex === index ? 'Salvando...' : 'Salvar recurso'}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving || isLoading} className="rounded-none bg-[#1398B7] font-black text-white hover:bg-[#0F7E99]">
                {isSaving ? 'Salvando...' : 'Salvar todos os recursos'}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <form onSubmit={(event) => void saveCardStyle(event)} className="space-y-5">
          <section className="grid gap-4 rounded-[20px] border border-[#D8E6EB] bg-white p-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Background do card</span>
              <input type="color" value={cardStyle.cardBackgroundColor} onChange={(e) => setCardStyle((p) => ({ ...p, cardBackgroundColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Borda do card</span>
              <input type="color" value={cardStyle.cardBorderColor} onChange={(e) => setCardStyle((p) => ({ ...p, cardBorderColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Espessura da borda (px)</span>
              <input type="number" min={0} max={12} value={cardStyle.cardBorderWidth} onChange={(e) => setCardStyle((p) => ({ ...p, cardBorderWidth: Number(e.target.value) || 0 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Curvatura do card (px)</span>
              <input type="number" min={0} max={64} value={cardStyle.cardBorderRadius} onChange={(e) => setCardStyle((p) => ({ ...p, cardBorderRadius: Number(e.target.value) || 0 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Sombra CSS do card</span>
              <input value={cardStyle.cardShadow} onChange={(e) => setCardStyle((p) => ({ ...p, cardShadow: e.target.value }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
          </section>

          <section className="grid gap-4 rounded-[20px] border border-[#D8E6EB] bg-white p-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Cor do titulo</span>
              <input type="color" value={cardStyle.titleColor} onChange={(e) => setCardStyle((p) => ({ ...p, titleColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Tamanho do titulo (px)</span>
              <input type="number" min={10} max={48} value={cardStyle.titleFontSize} onChange={(e) => setCardStyle((p) => ({ ...p, titleFontSize: Number(e.target.value) || 16 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Peso do titulo</span>
              <input type="number" min={300} max={900} step={100} value={cardStyle.titleFontWeight} onChange={(e) => setCardStyle((p) => ({ ...p, titleFontWeight: Number(e.target.value) || 700 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Cor da descricao</span>
              <input type="color" value={cardStyle.descriptionColor} onChange={(e) => setCardStyle((p) => ({ ...p, descriptionColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Tamanho da descricao (px)</span>
              <input type="number" min={10} max={32} value={cardStyle.descriptionFontSize} onChange={(e) => setCardStyle((p) => ({ ...p, descriptionFontSize: Number(e.target.value) || 14 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Line-height da descricao</span>
              <input type="number" min={1} max={3} step={0.1} value={cardStyle.descriptionLineHeight} onChange={(e) => setCardStyle((p) => ({ ...p, descriptionLineHeight: Number(e.target.value) || 1.75 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
          </section>

          <section className="grid gap-4 rounded-[20px] border border-[#D8E6EB] bg-white p-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Background do icone</span>
              <input type="color" value={cardStyle.iconBackgroundColor} onChange={(e) => setCardStyle((p) => ({ ...p, iconBackgroundColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Cor padrao do icone</span>
              <input type="color" value={cardStyle.iconColor} onChange={(e) => setCardStyle((p) => ({ ...p, iconColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Tamanho global do icone (px)</span>
              <input type="number" min={12} max={36} value={cardStyle.iconSize} onChange={(e) => setCardStyle((p) => ({ ...p, iconSize: Math.min(36, Math.max(12, Number(e.target.value) || 18)) }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
            <div className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-3 text-sm font-semibold leading-6 text-[#4F636A]">
              Ao salvar aqui, esse tamanho vira o padrao global da pagina e limpa os tamanhos individuais antigos. Depois, se voce ajustar um recurso especifico no editor visual, aquele recurso passa a usar o tamanho proprio dele.
            </div>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Background do botao</span>
              <input type="color" value={cardStyle.buttonBackgroundColor} onChange={(e) => setCardStyle((p) => ({ ...p, buttonBackgroundColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Cor do texto do botao</span>
              <input type="color" value={cardStyle.buttonTextColor} onChange={(e) => setCardStyle((p) => ({ ...p, buttonTextColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Cor da borda do botao</span>
              <input type="color" value={cardStyle.buttonBorderColor} onChange={(e) => setCardStyle((p) => ({ ...p, buttonBorderColor: e.target.value }))} className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2" />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Raio do botao (px)</span>
              <input type="number" min={0} max={999} value={cardStyle.buttonRadius} onChange={(e) => setCardStyle((p) => ({ ...p, buttonRadius: Number(e.target.value) || 0 }))} className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4" />
            </label>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || isLoading}
              onClick={() => setCardStyle({ ...defaultCardStyle })}
              className="rounded-none border-[#D8E6EB] bg-white font-black text-[#15323b] hover:bg-[#F2F7F9]"
            >
              Redefinir para padrao
            </Button>
            <Button type="submit" disabled={isSaving || isLoading} className="rounded-none bg-[#1398B7] font-black text-white hover:bg-[#0F7E99]">
              {isSaving ? 'Salvando...' : 'Salvar padrao dos cards'}
            </Button>
          </div>

          <section className="rounded-[20px] border border-[#D8E6EB] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1398B7]">Historico de revisoes</p>
                <h2 className="mt-1 text-lg font-bold text-[#15323b]">Revisões do padrão dos cards</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5F7077]">
                  Cada salvamento desta aba gera uma nova revisão. Ao reverter uma revisão, o padrão global dos cards volta para aquele estado e uma nova revisão é criada automaticamente.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {isLoadingCardStyleVersions ? (
                <div className="rounded-[16px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-4 py-4 text-sm font-semibold text-[#5F7077]">
                  Carregando histórico...
                </div>
              ) : cardStyleVersions.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-4 py-4 text-sm font-semibold text-[#5F7077]">
                  Nenhuma revisão registrada para o padrão dos cards ainda.
                </div>
              ) : cardStyleVersions.slice(0, 12).map((version, index) => (
                <article key={version.id} className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
                        Revisão {cardStyleVersions.length - index} · {new Date(version.created_at).toLocaleString('pt-BR')}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                        {version.change_reason ?? 'alteração'} · {version.changed_by ?? 'usuário não identificado'}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#15323b]">
                        {summarizeCardStyleVersion(version.next_value)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSaving || isLoading || restoringCardStyleVersionId === version.id}
                      onClick={() => void handleRestoreCardStyleVersion(version)}
                      className="rounded-none border-[#D8E6EB] bg-white font-black text-[#15323b] hover:bg-[#F2F7F9]"
                    >
                      {restoringCardStyleVersionId === version.id ? 'Revertendo...' : 'Reverter'}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </form>
      )}
    </div>
  )
}
