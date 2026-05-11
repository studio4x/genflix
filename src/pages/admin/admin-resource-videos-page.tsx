import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  createResourcesItemsFallback,
  normalizeResourcesItems,
  resolveResourceVideoUrl,
} from '@/features/public/genflix-resource-items-editor'
import { fetchSiteContent, saveSiteContentEntry } from '@/features/site-editor/api'
import type { EditableListItem } from '@/features/site-editor/types'

function toMetadata(item: EditableListItem) {
  if (!item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata)) {
    return {} as Record<string, unknown>
  }
  return { ...item.metadata as Record<string, unknown> }
}

function normalizePopupEntry(value: unknown): { title: string; body: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  const lead = typeof record.lead === 'string' ? record.lead.trim() : ''
  const paragraphs = Array.isArray(record.paragraphs)
    ? record.paragraphs
      .map((paragraph) => (typeof paragraph === 'string' ? paragraph.trim() : ''))
      .filter(Boolean)
    : []
  const bullets = Array.isArray(record.bullets)
    ? record.bullets
      .map((bullet) => (typeof bullet === 'string' ? bullet.trim() : ''))
      .filter(Boolean)
    : []

  const bodyParts = [lead, ...paragraphs]
  if (bullets.length > 0) {
    bodyParts.push(bullets.map((bullet) => `- ${bullet}`).join('\n'))
  }

  const body = bodyParts.filter(Boolean).join('\n\n').trim()
  if (!title && !body) {
    return null
  }

  return { title, body }
}

function parsePopupBodyToParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function buildPopupJsonValue(title: string, body: string) {
  return {
    title: title.trim(),
    paragraphs: parsePopupBodyToParagraphs(body),
  }
}

function normalizeItemForSave(item: EditableListItem): EditableListItem {
  const metadata = toMetadata(item)
  const instructionalVideoUrl = typeof metadata.instructionalVideoUrl === 'string'
    ? metadata.instructionalVideoUrl.trim()
    : ''
  const popupTitle = typeof metadata.popupTitle === 'string' ? metadata.popupTitle.trim() : ''
  const popupBody = typeof metadata.popupBody === 'string' ? metadata.popupBody.trim() : ''
  const cardDescription = (item.description ?? '').trim()
  const resolvedPopupBody = popupBody || cardDescription

  if (instructionalVideoUrl === '') {
    delete metadata.instructionalVideoUrl
  } else {
    metadata.instructionalVideoUrl = instructionalVideoUrl
  }

  if (popupTitle === '') {
    delete metadata.popupTitle
  } else {
    metadata.popupTitle = popupTitle
  }

  if (resolvedPopupBody === '') {
    delete metadata.popupBody
  } else {
    metadata.popupBody = resolvedPopupBody
  }

  return {
    ...item,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  }
}

function resolvePopupPayload(item: EditableListItem) {
  const label = item.label?.trim() ?? ''
  if (!label) {
    return null
  }

  const metadata = toMetadata(item)
  const popupTitle = typeof metadata.popupTitle === 'string' ? metadata.popupTitle.trim() : ''
  const popupBody = typeof metadata.popupBody === 'string' ? metadata.popupBody.trim() : ''
  const cardDescription = (item.description ?? '').trim()

  return {
    label,
    title: popupTitle || label,
    body: popupBody || cardDescription,
  }
}

export function AdminResourceVideosPage() {
  const [items, setItems] = useState<EditableListItem[]>(createResourcesItemsFallback())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingCardIndex, setSavingCardIndex] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const popupBaselineRef = useRef<Map<string, { title: string; body: string }>>(new Map())

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
        const entries = await fetchSiteContent('resources')
        const resourcesEntry = entries.find((entry) => entry.page_key === 'resources' && entry.entry_key === 'resources.items')
        const normalized = normalizeResourcesItems(resourcesEntry?.value)
        const popupEntries = new Map(
          entries
            .filter((entry) => entry.page_key === 'resources' && entry.entry_key.startsWith('resources.popup.'))
            .map((entry) => [entry.entry_key, normalizePopupEntry(entry.value)]),
        )
        const popupBaseline = new Map<string, { title: string; body: string }>()
        for (const [entryKey, value] of popupEntries.entries()) {
          if (!value) {
            continue
          }

          const label = entryKey.replace('resources.popup.', '').trim()
          if (label) {
            popupBaseline.set(label, value)
          }
        }

        const mergedWithPopupEntries = normalized.map((item) => {
          const label = item.label?.trim() ?? ''
          if (!label) {
            return item
          }

          const popupEntry = popupEntries.get(`resources.popup.${label}`)
          if (!popupEntry) {
            return item
          }

          const metadata = toMetadata(item)
          const currentTitle = typeof metadata.popupTitle === 'string' ? metadata.popupTitle.trim() : ''
          const currentBody = typeof metadata.popupBody === 'string' ? metadata.popupBody.trim() : ''

          if (!currentTitle && popupEntry.title) {
            metadata.popupTitle = popupEntry.title
          }

          if (!currentBody && popupEntry.body) {
            metadata.popupBody = popupEntry.body
          }

          return {
            ...item,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          }
        })

        if (isMounted) {
          popupBaselineRef.current = popupBaseline
          setItems(mergedWithPopupEntries)
        }
      } catch (loadError) {
        if (isMounted) {
          setItems(createResourcesItemsFallback())
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

  function updateVideoUrl(index: number, nextValue: string) {
    setItems((current) => current.map((item, currentIndex) => {
      if (currentIndex !== index) {
        return item
      }

      const metadata = toMetadata(item)
      const trimmed = nextValue.trim()

      if (trimmed === '') {
        delete metadata.instructionalVideoUrl
      } else {
        metadata.instructionalVideoUrl = trimmed
      }

      return {
        ...item,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }
    }))
  }

  function updateCardLabel(index: number, nextValue: string) {
    setItems((current) => current.map((item, currentIndex) => (
      currentIndex === index
        ? {
          ...item,
          label: nextValue,
        }
        : item
    )))
  }

  function updateCardDescription(index: number, nextValue: string) {
    setItems((current) => current.map((item, currentIndex) => (
      currentIndex === index
        ? {
          ...item,
          description: nextValue,
        }
        : item
    )))
  }

  function updatePopupField(index: number, field: 'popupTitle' | 'popupBody', nextValue: string) {
    setItems((current) => current.map((item, currentIndex) => {
      if (currentIndex !== index) {
        return item
      }

      const metadata = toMetadata(item)
      const trimmed = nextValue.trim()

      if (trimmed === '') {
        delete metadata[field]
      } else {
        metadata[field] = nextValue
      }

      return {
        ...item,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }
    }))
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

      const popupItems = targetIndex === null
        ? normalizedItems
        : normalizedItems[targetIndex]
          ? [normalizedItems[targetIndex]]
          : []

      await Promise.all(popupItems.map(async (item) => {
        const payload = resolvePopupPayload(item)
        if (!payload) {
          return
        }

        const baseline = popupBaselineRef.current.get(payload.label)
        if (baseline && baseline.title.trim() === payload.title && baseline.body.trim() === payload.body) {
          return
        }

        await saveSiteContentEntry({
          pageKey: 'resources',
          entryKey: `resources.popup.${payload.label}`,
          entryType: 'json',
          value: buildPopupJsonValue(payload.title, payload.body),
          schema: {},
        })
      }))

      setItems(normalizedItems)
      popupBaselineRef.current = new Map(
        normalizedItems.map((item) => {
          const payload = resolvePopupPayload(item)
          if (!payload) {
            return ['', { title: '', body: '' }] as const
          }

          return [payload.label, { title: payload.title, body: payload.body }] as const
        }).filter(([label]) => label.length > 0),
      )
      setMessage(targetIndex === null ? 'Videos de instrucao salvos com sucesso.' : `Recurso ${targetIndex + 1} salvo com sucesso.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar os dados dos recursos.')
    } finally {
      setIsSaving(false)
      setSavingCardIndex(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveResources(null)
  }

  async function handleSaveCard(index: number) {
    await saveResources(index)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Recursos</p>
        <h1 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Videos de Instrucao</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#5F7077]">
          Cadastre o link de video para cada recurso da pagina publica. Somente os recursos com video configurado exibem o botao
          &quot;Ver video de instrucao&quot;.
        </p>
      </header>

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

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div className="grid gap-4">
          {items.map((item, index) => {
            const currentVideoUrl = (() => {
              const metadata = toMetadata(item)
              return typeof metadata.instructionalVideoUrl === 'string' ? metadata.instructionalVideoUrl : ''
            })()
            const popupTitle = (() => {
              const metadata = toMetadata(item)
              return typeof metadata.popupTitle === 'string' ? metadata.popupTitle : ''
            })()
            const popupBody = (() => {
              const metadata = toMetadata(item)
              return typeof metadata.popupBody === 'string' ? metadata.popupBody : ''
            })()

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
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Texto do card: titulo</span>
                    <input
                      value={item.label ?? ''}
                      onChange={(event) => updateCardLabel(index, event.target.value)}
                      placeholder="Ex.: Videos (mas nao apenas)"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Texto do card: descricao</span>
                    <textarea
                      value={item.description ?? ''}
                      onChange={(event) => updateCardDescription(index, event.target.value)}
                      rows={4}
                      placeholder="Texto exibido no card do recurso."
                      className="rounded-[14px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Texto do popup: titulo</span>
                    <input
                      value={popupTitle}
                      onChange={(event) => updatePopupField(index, 'popupTitle', event.target.value)}
                      placeholder="Ex.: Videos? Claro, mas nao apenas"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Texto do popup: conteudo</span>
                    <textarea
                      value={popupBody}
                      onChange={(event) => updatePopupField(index, 'popupBody', event.target.value)}
                      rows={6}
                      placeholder="Conteudo exibido no popup ao clicar no recurso."
                      className="rounded-[14px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                </div>

                <label className="mt-4 grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Link do video de instrucao</span>
                  <input
                    value={currentVideoUrl}
                    onChange={(event) => updateVideoUrl(index, event.target.value)}
                    placeholder="https://..."
                    className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  />
                </label>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleSaveCard(index)}
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
            {isSaving ? 'Salvando...' : 'Salvar videos dos recursos'}
          </Button>
          <span className="text-xs font-semibold text-[#5F7077]">
            {isLoading ? 'Carregando recursos...' : 'Recursos sem video nao exibem o botao na pagina publica.'}
          </span>
        </div>
      </form>
    </div>
  )
}
