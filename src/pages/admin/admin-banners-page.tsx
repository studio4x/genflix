import { useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, Save, Send, Trash2 } from 'lucide-react'
import { Puck, Render, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'

import { Button } from '@/components/ui/button'
import {
  createSiteBanner,
  deleteSiteBanner,
  fetchSiteBanners,
  reorderSiteBanners,
  toggleSiteBannerActive,
  updateSiteBanner,
} from '@/features/banners/api'
import { mapEditorStateToBannerPayload } from '@/features/banners/puck'
import { bannerThemePresetOptions, bannerTonePresetOptions, type BannerEditorState, type SiteBanner } from '@/features/banners/types'
import { uploadSiteAsset } from '@/features/site-editor/api'
import { bannerThemeStyles } from '@/features/banners/presets'

const editorConfig: any = {
  root: {
    fields: {
      backgroundUrl: { type: 'text', label: 'Imagem de fundo (URL)' },
      themePreset: { type: 'select', label: 'Tema', options: bannerThemePresetOptions.map((item) => ({ label: item.label, value: item.value })) },
      height: { type: 'number', label: 'Altura (px)', min: 320, max: 1200 },
    },
      render: ({ children, backgroundUrl, themePreset, height }: any) => {
      const theme = bannerThemeStyles[(themePreset as SiteBanner['themePreset']) ?? 'light-strong']
      return (
        <section style={{ height: `${height || 560}px` }} className="relative overflow-hidden rounded-2xl border border-slate-200">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `${theme.overlay}, url(${backgroundUrl || '/images/genflix/home/hero.jpg'})` }}
          />
          <div className="relative h-full w-full">{children}</div>
        </section>
      )
    },
  },
  components: {
    title: {
      fields: {
        text: { type: 'text', label: 'Titulo' },
        x: { type: 'number', label: 'X', min: 0 },
        y: { type: 'number', label: 'Y', min: 0 },
        width: { type: 'number', label: 'Largura %', min: 10, max: 100 },
        textColor: { type: 'text', label: 'Cor do texto' },
        visible: { type: 'radio', label: 'Visivel', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
      },
      render: ({ text, x, y, width, textColor, visible }: any) => visible === 'false' ? <></> : (
        <h2 className="absolute text-5xl font-extrabold leading-[0.95] tracking-tight" style={{ left: `${x || 0}px`, top: `${y || 0}px`, width: `${width || 40}%`, color: textColor || '#fff' }}>{text}</h2>
      ),
    },
    subtitle: {
      fields: {
        text: { type: 'textarea', label: 'Subtitulo' },
        x: { type: 'number', label: 'X', min: 0 },
        y: { type: 'number', label: 'Y', min: 0 },
        width: { type: 'number', label: 'Largura %', min: 10, max: 100 },
        textColor: { type: 'text', label: 'Cor do texto' },
        visible: { type: 'radio', label: 'Visivel', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
      },
      render: ({ text, x, y, width, textColor, visible }: any) => visible === 'false' ? <></> : (
        <p className="absolute text-base leading-7" style={{ left: `${x || 0}px`, top: `${y || 0}px`, width: `${width || 40}%`, color: textColor || '#EAF6F8' }}>{text}</p>
      ),
    },
    body: {
      fields: {
        text: { type: 'textarea', label: 'Texto complementar' },
        x: { type: 'number', label: 'X', min: 0 },
        y: { type: 'number', label: 'Y', min: 0 },
        width: { type: 'number', label: 'Largura %', min: 10, max: 100 },
        textColor: { type: 'text', label: 'Cor do texto' },
        visible: { type: 'radio', label: 'Visivel', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
      },
      render: ({ text, x, y, width, textColor, visible }: any) => visible === 'false' ? <></> : (
        <p className="absolute text-sm leading-7" style={{ left: `${x || 0}px`, top: `${y || 0}px`, width: `${width || 40}%`, color: textColor || '#D7E9EE' }}>{text}</p>
      ),
    },
    primaryCta: {
      fields: {
        label: { type: 'text', label: 'Texto CTA' },
        href: { type: 'text', label: 'Link' },
        tonePreset: { type: 'select', label: 'Preset CTA', options: bannerTonePresetOptions.map((item) => ({ label: item.label, value: item.value })) },
        isInternal: { type: 'radio', label: 'Interno', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
        openInNewTab: { type: 'radio', label: 'Nova aba', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
        x: { type: 'number', label: 'X', min: 0 },
        y: { type: 'number', label: 'Y', min: 0 },
        width: { type: 'number', label: 'Largura %', min: 10, max: 100 },
        textColor: { type: 'text', label: 'Cor texto' },
        backgroundColor: { type: 'text', label: 'Cor botao' },
        visible: { type: 'radio', label: 'Visivel', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
      },
      render: ({ label, x, y, width, textColor, backgroundColor, visible }: any) => visible === 'false' ? <></> : (
        <button type="button" className="absolute h-12 rounded-xl px-5 text-sm font-semibold" style={{ left: `${x || 0}px`, top: `${y || 0}px`, width: `${width || 24}%`, color: textColor || '#fff', backgroundColor: backgroundColor || '#0A3640' }}>{label || 'CTA principal'}</button>
      ),
    },
    secondaryCta: {
      fields: {
        label: { type: 'text', label: 'Texto CTA' },
        href: { type: 'text', label: 'Link' },
        tonePreset: { type: 'select', label: 'Preset CTA', options: bannerTonePresetOptions.map((item) => ({ label: item.label, value: item.value })) },
        isInternal: { type: 'radio', label: 'Interno', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
        openInNewTab: { type: 'radio', label: 'Nova aba', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
        x: { type: 'number', label: 'X', min: 0 },
        y: { type: 'number', label: 'Y', min: 0 },
        width: { type: 'number', label: 'Largura %', min: 10, max: 100 },
        textColor: { type: 'text', label: 'Cor texto' },
        backgroundColor: { type: 'text', label: 'Cor botao' },
        visible: { type: 'radio', label: 'Visivel', options: [{ label: 'Sim', value: 'true' }, { label: 'Nao', value: 'false' }] },
      },
      render: ({ label, x, y, width, textColor, backgroundColor, visible }: any) => visible === 'false' ? <></> : (
        <button type="button" className="absolute h-12 rounded-xl px-5 text-sm font-semibold" style={{ left: `${x || 0}px`, top: `${y || 0}px`, width: `${width || 24}%`, color: textColor || '#183139', backgroundColor: backgroundColor || '#fff' }}>{label || 'CTA secundario'}</button>
      ),
    },
  },
}

function boolFromEditor(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function normalizeEditorState(state: BannerEditorState): BannerEditorState {
  return {
    ...state,
    content: state.content.map((item) => {
      if (item.type === 'title' || item.type === 'subtitle' || item.type === 'body') {
        return { ...item, props: { ...item.props, visible: boolFromEditor(item.props.visible, true) } }
      }
      if (item.type === 'primaryCta' || item.type === 'secondaryCta') {
        return {
          ...item,
          props: {
            ...item.props,
            visible: boolFromEditor(item.props.visible, true),
            isInternal: boolFromEditor(item.props.isInternal, true),
            openInNewTab: boolFromEditor(item.props.openInNewTab, false),
          },
        }
      }
      return item
    }),
  }
}

function asEditorData(state: BannerEditorState): Data {
  return {
    root: (state.root ?? {}) as any,
    content: state.content.map((item, index) => ({ type: item.type, props: item.props, id: `${item.type}-${index}` })),
  }
}

function fromEditorData(data: Data): BannerEditorState {
  return {
    root: data.root as BannerEditorState['root'],
    content: (data.content ?? []).map((item) => ({ type: item.type as BannerEditorState['content'][number]['type'], props: (item.props ?? {}) as Record<string, unknown> })),
  }
}

export function AdminBannersPage() {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const rows = await fetchSiteBanners()
      setBanners(rows)
      setSelectedId(rows[0]?.id ?? null)
      setLoading(false)
    })().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar banners.')
      setLoading(false)
    })
  }, [])

  const selected = banners.find((item) => item.id === selectedId) ?? null

  async function refresh(preferredId?: string) {
    const rows = await fetchSiteBanners()
    setBanners(rows)
    setSelectedId(preferredId ?? rows[0]?.id ?? null)
  }

  async function saveDraft(nextState: BannerEditorState) {
    if (!selected) return
    setSaving(true)
    setError(null)
    const normalized = normalizeEditorState(nextState)

    try {
      const updated = await updateSiteBanner({
        id: selected.id,
        editorStateDesktop: mode === 'desktop' ? normalized : selected.editorStateDesktop,
        editorStateMobile: mode === 'mobile' ? normalized : selected.editorStateMobile,
      })
      setBanners((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage('Rascunho salvo com sucesso.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar rascunho.')
    } finally {
      setSaving(false)
    }
  }

  async function publishCurrent() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const payload = mapEditorStateToBannerPayload(selected.editorStateDesktop, selected.editorStateMobile, selected)
      const updated = await updateSiteBanner({
        id: selected.id,
        ...payload,
      })
      setBanners((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage('Banner publicado e sincronizado com a home.')
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Falha ao publicar banner.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadBackground(file: File) {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const asset = await uploadSiteAsset(file, { pageKey: 'home', entryKey: `banner:${selected.id}:background` })
      const current = mode === 'desktop' ? selected.editorStateDesktop : selected.editorStateMobile
      const next = {
        ...current,
        root: {
          props: {
            ...(current.root?.props ?? {}),
            backgroundUrl: asset.public_url ?? '',
          },
        },
      } satisfies BannerEditorState
      await saveDraft(next)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha no upload da imagem.')
    } finally {
      setSaving(false)
    }
  }

  async function createBanner() {
    setSaving(true)
    try {
      const created = await createSiteBanner()
      await refresh(created.id)
      setMessage('Novo banner criado.')
    } finally {
      setSaving(false)
    }
  }

  async function removeBanner() {
    if (!selected) return
    if (!window.confirm(`Excluir banner "${selected.name}"?`)) return
    setSaving(true)
    try {
      await deleteSiteBanner(selected.id)
      await refresh()
      setMessage('Banner removido.')
    } finally {
      setSaving(false)
    }
  }

  async function moveBanner(direction: -1 | 1) {
    if (!selected) return
    const from = banners.findIndex((item) => item.id === selected.id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= banners.length) return
    const reordered = [...banners]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    await reorderSiteBanners(reordered.map((item) => item.id))
    await refresh(selected.id)
  }

  if (loading) {
    return <div className="p-8">Carregando banners...</div>
  }

  const activeState = selected ? (mode === 'desktop' ? selected.editorStateDesktop : selected.editorStateMobile) : null

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void createBanner()} disabled={saving}><Plus className="mr-2 h-4 w-4" />Novo banner</Button>
        <Button type="button" variant="outline" onClick={() => setMode(mode === 'desktop' ? 'mobile' : 'desktop')}>{mode === 'desktop' ? 'Desktop' : 'Mobile'}</Button>
        <Button type="button" variant="outline" onClick={() => selected && void toggleSiteBannerActive(selected.id, !selected.isActive).then(() => refresh(selected.id))} disabled={!selected}>
          {selected?.isActive ? <><EyeOff className="mr-2 h-4 w-4" />Desativar</> : <><Eye className="mr-2 h-4 w-4" />Ativar</>}
        </Button>
        <Button type="button" variant="outline" onClick={() => void moveBanner(-1)} disabled={!selected}>Subir</Button>
        <Button type="button" variant="outline" onClick={() => void moveBanner(1)} disabled={!selected}>Descer</Button>
        <Button type="button" variant="outline" onClick={() => void removeBanner()} disabled={!selected}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
      </header>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Lista de banners</p>
          <div className="space-y-2">
            {banners.map((banner) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setSelectedId(banner.id)}
                className={`w-full rounded-xl border p-3 text-left ${banner.id === selectedId ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200 bg-white'}`}
              >
                <p className="text-sm font-semibold text-slate-900">{banner.name}</p>
                <p className="text-xs text-slate-500">{banner.isActive ? 'Publicado' : 'Rascunho/Inativo'}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          {selected && activeState ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={selected.name}
                  onChange={(event) => setBanners((current) => current.map((item) => item.id === selected.id ? { ...item, name: event.target.value } : item))}
                  className="h-10 min-w-[260px] rounded-lg border border-slate-300 px-3 text-sm"
                />
                <Button type="button" variant="outline" disabled={saving} onClick={() => void updateSiteBanner({ id: selected.id, name: selected.name }).then((updated) => setBanners((current) => current.map((item) => item.id === updated.id ? updated : item)))}>
                  <Save className="mr-2 h-4 w-4" />Salvar nome
                </Button>
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
                  Upload fundo
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void uploadBackground(file)
                  }} />
                </label>
                <Button type="button" disabled={saving} onClick={() => void publishCurrent()}>
                  <Send className="mr-2 h-4 w-4" />Publicar banner
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <Puck config={editorConfig} data={asEditorData(activeState)} onPublish={(data) => void saveDraft(fromEditorData(data))} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">Preview render (Puck)</p>
                <Render config={editorConfig} data={asEditorData(activeState)} />
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">Nenhum banner selecionado.</div>
          )}
        </section>
      </div>
    </div>
  )
}
