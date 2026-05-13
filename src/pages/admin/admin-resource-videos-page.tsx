import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  createResourcesItemsFallback,
  normalizeResourcesItems,
  resolveResourceVideoUrl,
} from '@/features/public/genflix-resource-items-editor'
import { fetchSiteAssets, fetchSiteContent, saveSiteContentEntry } from '@/features/site-editor/api'
import type { EditableListItem, SiteAsset } from '@/features/site-editor/types'

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
  buttonBackgroundColor: '#FFFFFF',
  buttonTextColor: '#0F7E99',
  buttonBorderColor: '#1398B7',
  buttonRadius: 999,
}

function normalizeIconName(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveMatchingLibraryIcon(item: EditableListItem, iconAssets: SiteAsset[]) {
  const label = normalizeIconName((item.label ?? item.title ?? item.id ?? '').trim())
  if (!label) return null

  for (const asset of iconAssets) {
    const originalName = typeof asset.metadata?.original_name === 'string' ? asset.metadata.original_name : ''
    const candidate = normalizeIconName((asset.alt ?? '').trim() || originalName)
    if (!candidate || !asset.public_url) continue
    if (candidate === label || candidate.includes(label) || label.includes(candidate)) {
      return asset
    }
  }

  return null
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
    buttonBackgroundColor: fromString('buttonBackgroundColor'),
    buttonTextColor: fromString('buttonTextColor'),
    buttonBorderColor: fromString('buttonBorderColor'),
    buttonRadius: fromNumber('buttonRadius', 0, 999),
  }
}

export function AdminResourceVideosPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'style'>('items')
  const [items, setItems] = useState<EditableListItem[]>(createResourcesItemsFallback())
  const [cardStyle, setCardStyle] = useState<ResourceCardStyleSettings>({ ...defaultCardStyle })
  const [isLoading, setIsLoading] = useState(true)
  const [iconLibraryAssets, setIconLibraryAssets] = useState<SiteAsset[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [savingCardIndex, setSavingCardIndex] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const configuredCount = useMemo(
    () => items.filter((item) => resolveResourceVideoUrl(item) !== '').length,
    [items],
  )

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        const [entries, assets] = await Promise.all([
          fetchSiteContent('resources'),
          fetchSiteAssets(240),
        ])
        const resourcesEntry = entries.find((entry) => entry.page_key === 'resources' && entry.entry_key === 'resources.items')
        const styleEntry = entries.find((entry) => entry.page_key === 'resources' && entry.entry_key === 'resources.cardStyle')
        const iconAssets = assets.filter((asset) => {
          const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
            ? asset.metadata as Record<string, unknown>
            : null
          const entryKey = typeof metadata?.entry_key === 'string' ? metadata.entry_key : ''
          const mimeType = typeof asset.mime_type === 'string' ? asset.mime_type.toLowerCase() : ''
          return entryKey === 'icon-library' && mimeType.includes('svg')
        })

        if (isMounted) {
          const normalizedItems = normalizeResourcesItems(resourcesEntry?.value)
          const nextItems = normalizedItems.map((item) => {
            const metadata = toMetadata(item)
            const hasIconSet = typeof metadata.iconImageUrl === 'string' && metadata.iconImageUrl.trim() !== ''
            if (hasIconSet) {
              return item
            }
            const matchedAsset = resolveMatchingLibraryIcon(item, iconAssets)
            if (!matchedAsset?.public_url) {
              return item
            }
            return {
              ...item,
              metadata: {
                ...metadata,
                iconImageUrl: matchedAsset.public_url,
                iconImageAlt: matchedAsset.alt ?? item.label ?? item.title ?? 'Icone',
                iconImageAssetId: matchedAsset.id,
              },
            }
          })

          const changedIcons = nextItems.some((item, index) => {
            const before = toMetadata(normalizedItems[index])
            const after = toMetadata(item)
            return before.iconImageUrl !== after.iconImageUrl || before.iconImageAssetId !== after.iconImageAssetId
          })

          if (changedIcons) {
            await saveSiteContentEntry({
              pageKey: 'resources',
              entryKey: 'resources.items',
              entryType: 'list',
              value: nextItems.map(normalizeItemForSave),
              schema: {
                kind: 'default',
                itemName: 'recurso',
                addLabel: 'Adicionar recurso',
              },
            })
          }

          setItems(nextItems)
          setCardStyle(parseCardStyle(styleEntry?.value))
          setIconLibraryAssets(iconAssets)
        }
      } catch (loadError) {
        if (isMounted) {
          setItems(createResourcesItemsFallback())
          setCardStyle({ ...defaultCardStyle })
          setIconLibraryAssets([])
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

  function updateCardLabel(index: number, nextValue: string) {
    updateItem(index, (item) => ({ ...item, label: nextValue }))
  }

  function updateCardDescription(index: number, nextValue: string) {
    updateItem(index, (item) => ({ ...item, description: nextValue }))
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

  function updateItemLibraryIcon(index: number, asset: SiteAsset) {
    updateItem(index, (item) => {
      const metadata = toMetadata(item)
      metadata.iconImageUrl = asset.public_url ?? ''
      metadata.iconImageAlt = asset.alt ?? item.label ?? item.title ?? 'Icone'
      metadata.iconImageAssetId = asset.id
      return { ...item, metadata: Object.keys(metadata).length > 0 ? metadata : undefined }
    })
  }

  function updateItemColor(index: number, color: string) {
    updateItem(index, (item) => {
      const metadata = toMetadata(item)
      metadata.iconColor = color
      metadata.itemColor = color
      return { ...item, metadata: metadata }
    })
  }

  function resetItemColor(index: number) {
    updateItem(index, (item) => {
      const metadata = toMetadata(item)
      delete metadata.itemColor
      delete metadata.iconColor
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
      await saveSiteContentEntry({
        pageKey: 'resources',
        entryKey: 'resources.cardStyle',
        entryType: 'json',
        value: cardStyle,
        schema: { kind: 'resources-card-style' },
      })
      setMessage('Padrao dos cards salvo com sucesso.')
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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Recursos</p>
        <h1 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Recursos</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#5F7077]">
          Edite os cards de recursos por item e tambem o padrao visual global que sera aplicado na pagina publica.
        </p>
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
            <div className="grid gap-4">
              {items.map((item, index) => {
                const metadata = toMetadata(item)
                const currentVideoUrl = typeof metadata.instructionalVideoUrl === 'string' ? metadata.instructionalVideoUrl : ''
                const readMoreEnabled = metadata.readMoreEnabled === true
                const readMoreContent = typeof metadata.readMoreContent === 'string' ? metadata.readMoreContent : ''
                const currentIconImageUrl = typeof metadata.iconImageUrl === 'string' ? metadata.iconImageUrl : ''
                const currentIconImageAssetId = typeof metadata.iconImageAssetId === 'string' ? metadata.iconImageAssetId : ''
                const selectedLibraryAsset = currentIconImageAssetId
                  ? iconLibraryAssets.find((asset) => asset.id === currentIconImageAssetId)
                  : iconLibraryAssets.find((asset) => (asset.public_url ?? '') === currentIconImageUrl)
                const suggestedLibraryAsset = resolveMatchingLibraryIcon(item, iconLibraryAssets)
                const effectiveLibraryAsset = selectedLibraryAsset ?? suggestedLibraryAsset
                const currentItemColor = typeof metadata.itemColor === 'string' ? metadata.itemColor : defaultCardStyle.iconColor
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

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Titulo do card</span>
                        <input
                          value={item.label ?? ''}
                          onChange={(event) => updateCardLabel(index, event.target.value)}
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Icone (biblioteca)</span>
                        <div className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#15323b]">
                              {effectiveLibraryAsset?.public_url ? (
                                <img
                                  src={effectiveLibraryAsset.public_url}
                                  alt={effectiveLibraryAsset.alt ?? 'Icone da biblioteca'}
                                  className="h-4 w-4 object-contain"
                                />
                              ) : (
                                <span className="inline-flex h-4 w-4 rounded-full border border-[#D8E6EB] bg-white" />
                              )}
                              <span>
                                {effectiveLibraryAsset
                                  ? (effectiveLibraryAsset.alt ?? 'Icone da biblioteca')
                                  : 'Sem SVG sugerido para este item'}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                if (suggestedLibraryAsset) {
                                  updateItemLibraryIcon(index, suggestedLibraryAsset)
                                }
                              }}
                              disabled={!suggestedLibraryAsset}
                              className="h-8 rounded-[10px] border-[#D8E6EB] px-2 text-[10px] font-black uppercase tracking-[0.12em]"
                            >
                              Usar sugestao
                            </Button>
                          </div>
                          {iconLibraryAssets.length > 0 ? (
                            <div className="border-t border-[#D8E6EB] pt-3">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">SVGs enviados na biblioteca</p>
                              <div className="grid max-h-52 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                                {iconLibraryAssets.map((asset) => {
                                  const isSelected = effectiveLibraryAsset?.id === asset.id
                                  const assetLabel = asset.alt ?? 'Icone SVG'
                                  return (
                                    <button
                                      key={asset.id}
                                      type="button"
                                      onClick={() => updateItemLibraryIcon(index, asset)}
                                      className={`flex items-center gap-2 rounded-[10px] border px-2 py-2 text-left text-xs font-semibold transition ${
                                        isSelected
                                          ? 'border-[#1398B7] bg-[#E8F6FA] text-[#0F7E99]'
                                          : 'border-[#D8E6EB] bg-white text-[#15323b] hover:border-[#9bcddb] hover:bg-[#F2F7F9]'
                                      }`}
                                    >
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#D8E6EB] bg-white">
                                        {asset.public_url ? (
                                          <img src={asset.public_url} alt={assetLabel} className="h-4 w-4 object-contain" />
                                        ) : null}
                                      </span>
                                      <span className="truncate">{assetLabel}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </label>

                      <label className="grid gap-2 md:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Descricao</span>
                        <textarea
                          value={item.description ?? ''}
                          onChange={(event) => updateCardDescription(index, event.target.value)}
                          rows={4}
                          className="rounded-[14px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Cor do item</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={currentItemColor}
                            onChange={(event) => updateItemColor(index, event.target.value)}
                            className="h-11 w-full rounded-[14px] border border-[#D8E6EB] bg-white px-2"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => resetItemColor(index)}
                            className="h-11 rounded-[14px] border-[#D8E6EB] px-3 text-[10px] font-black uppercase tracking-[0.12em]"
                          >
                            Padrao
                          </Button>
                        </div>
                      </label>

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
        </form>
      )}
    </div>
  )
}
