import { useEffect, useMemo, useState, type FormEvent } from 'react'

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

export function AdminResourceVideosPage() {
  const [items, setItems] = useState<EditableListItem[]>(createResourcesItemsFallback())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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
        const entries = await fetchSiteContent('resources')
        const resourcesEntry = entries.find((entry) => entry.page_key === 'resources' && entry.entry_key === 'resources.items')
        const normalized = normalizeResourcesItems(resourcesEntry?.value)
        if (isMounted) {
          setItems(normalized)
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const normalizedItems = items.map((item) => {
        const metadata = toMetadata(item)
        const instructionalVideoUrl = typeof metadata.instructionalVideoUrl === 'string'
          ? metadata.instructionalVideoUrl.trim()
          : ''

        if (instructionalVideoUrl === '') {
          delete metadata.instructionalVideoUrl
        } else {
          metadata.instructionalVideoUrl = instructionalVideoUrl
        }

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

      setItems(normalizedItems)
      setMessage('Videos de instrucao salvos com sucesso.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar os videos dos recursos.')
    } finally {
      setIsSaving(false)
    }
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

                <p className="mt-2 text-sm leading-6 text-[#5F7077]">{item.description || 'Sem descricao cadastrada.'}</p>

                <label className="mt-4 grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Link do video de instrucao</span>
                  <input
                    value={currentVideoUrl}
                    onChange={(event) => updateVideoUrl(index, event.target.value)}
                    placeholder="https://..."
                    className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  />
                </label>
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
