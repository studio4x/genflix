import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Grip, ImagePlus, Layers, Plus, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  createSiteBanner,
  deleteSiteBanner,
  duplicateSiteBanner,
  fetchSiteBanners,
  reorderSiteBanners,
  toggleSiteBannerActive,
  updateSiteBanner,
} from '@/features/banners/api'
import { bannerThemeStyles } from '@/features/banners/presets'
import {
  bannerElementLabels,
  bannerThemePresetOptions,
  bannerTonePresetOptions,
  cloneBannerLayout,
  type SiteBanner,
  type SiteBannerCta,
  type SiteBannerLayoutItem,
  type SiteBannerLayoutKey,
} from '@/features/banners/types'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { uploadSiteAsset } from '@/features/site-editor/api'
import { cn } from '@/lib/utils'

type BannerDragState = {
  key: SiteBannerLayoutKey
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
}

function cloneBanner(banner: SiteBanner): SiteBanner {
  return {
    ...banner,
    layoutDesktop: cloneBannerLayout(banner.layoutDesktop),
    primaryCta: banner.primaryCta ? { ...banner.primaryCta } : null,
    secondaryCta: banner.secondaryCta ? { ...banner.secondaryCta } : null,
  }
}

function normalizePercent(value: number) {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [movedItem] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, movedItem)
  return next
}

function getDraftSignature(banner: SiteBanner | null) {
  if (!banner) {
    return ''
  }

  return JSON.stringify({
    name: banner.name,
    title: banner.title,
    subtitle: banner.subtitle,
    body: banner.body,
    backgroundAssetId: banner.backgroundAssetId,
    backgroundUrl: banner.backgroundUrl,
    themePreset: banner.themePreset,
    layoutDesktop: banner.layoutDesktop,
    primaryCta: banner.primaryCta,
    secondaryCta: banner.secondaryCta,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder,
  })
}

function PreviewCta({
  cta,
  className,
}: {
  cta: SiteBannerCta
  className?: string
}) {
  return (
    <GenflixCtaButton type="button" tone={cta.tonePreset} className={cn('h-12 w-full justify-between px-5', className)}>
      {cta.label || 'CTA'}
    </GenflixCtaButton>
  )
}

function BannerCanvasElement({
  elementKey,
  item,
  children,
  onPointerDown,
}: {
  elementKey: SiteBannerLayoutKey
  item: SiteBannerLayoutItem
  children: React.ReactNode
  onPointerDown: (key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLDivElement>) => void
}) {
  if (!item.visible) {
    return null
  }

  return (
    <div
      className="group absolute cursor-grab active:cursor-grabbing"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        zIndex: item.zIndex,
      }}
      onPointerDown={(event) => onPointerDown(elementKey, event)}
    >
      <div className="pointer-events-none absolute -left-2 -top-2 inline-flex items-center gap-1 rounded-full border border-[#D8E6EB] bg-white/95 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#15323b] shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
        <Grip className="h-3 w-3" />
        {bannerElementLabels[elementKey]}
      </div>
      {children}
    </div>
  )
}

export function AdminBannersPage() {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SiteBanner | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<BannerDragState | null>(null)

  const selectedBanner = useMemo(
    () => banners.find((banner) => banner.id === selectedBannerId) ?? null,
    [banners, selectedBannerId],
  )
  const isDirty = useMemo(
    () => getDraftSignature(draft) !== getDraftSignature(selectedBanner),
    [draft, selectedBanner],
  )

  async function loadBanners(preferredBannerId?: string | null) {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchSiteBanners()
      setBanners(rows)

      const nextSelectedId = preferredBannerId && rows.some((banner) => banner.id === preferredBannerId)
        ? preferredBannerId
        : rows[0]?.id ?? null

      setSelectedBannerId(nextSelectedId)
      setDraft(nextSelectedId ? cloneBanner(rows.find((banner) => banner.id === nextSelectedId) ?? rows[0]) : null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os banners.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBanners()
  }, [])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current
      const stage = stageRef.current

      if (!dragState || !stage) {
        return
      }

      const rect = stage.getBoundingClientRect()
      const deltaX = ((event.clientX - dragState.startClientX) / rect.width) * 100
      const deltaY = ((event.clientY - dragState.startClientY) / rect.height) * 100

      setDraft((current) => {
        if (!current) {
          return current
        }

        const currentItem = current.layoutDesktop[dragState.key]
        const nextX = normalizePercent(clamp(dragState.startX + deltaX, 0, 100 - currentItem.width))
        const nextY = normalizePercent(clamp(dragState.startY + deltaY, 0, 92))

        return {
          ...current,
          layoutDesktop: {
            ...current.layoutDesktop,
            [dragState.key]: {
              ...current.layoutDesktop[dragState.key],
              x: nextX,
              y: nextY,
            },
          },
        }
      })
    }

    function handlePointerUp(event: PointerEvent) {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      dragStateRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  function setDraftField<K extends keyof SiteBanner>(field: K, value: SiteBanner[K]) {
    setDraft((current) => current ? { ...current, [field]: value } : current)
  }

  function setLayoutItem(key: SiteBannerLayoutKey, updater: (item: SiteBannerLayoutItem) => SiteBannerLayoutItem) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        layoutDesktop: {
          ...current.layoutDesktop,
          [key]: updater(current.layoutDesktop[key]),
        },
      }
    })
  }

  function setCta(which: 'primaryCta' | 'secondaryCta', updater: (cta: SiteBannerCta | null) => SiteBannerCta | null) {
    setDraft((current) => current ? {
      ...current,
      [which]: updater(current[which]),
    } : current)
  }

  function maybeChangeSelection(nextId: string) {
    if (nextId === selectedBannerId) {
      return
    }

    if (isDirty && !window.confirm('Existem alteracoes nao salvas neste banner. Deseja descartar e trocar de item?')) {
      return
    }

    const nextBanner = banners.find((banner) => banner.id === nextId)
    setSelectedBannerId(nextId)
    setDraft(nextBanner ? cloneBanner(nextBanner) : null)
    setMessage(null)
    setError(null)
  }

  async function handleCreateBanner() {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const created = await createSiteBanner()
      await loadBanners(created.id)
      setMessage('Novo banner criado. Configure o conteudo e salve quando terminar.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Nao foi possivel criar o banner.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicateBanner() {
    if (!selectedBanner) {
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const duplicated = await duplicateSiteBanner(selectedBanner)
      await loadBanners(duplicated.id)
      setMessage('Banner duplicado com sucesso.')
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Nao foi possivel duplicar o banner.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBanner() {
    if (!selectedBanner) {
      return
    }

    if (!window.confirm(`Deseja realmente excluir o banner "${selectedBanner.name}"?`)) {
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      await deleteSiteBanner(selectedBanner.id)
      const fallbackBannerId = banners.find((banner) => banner.id !== selectedBanner.id)?.id ?? null
      await loadBanners(fallbackBannerId)
      setMessage('Banner excluido com sucesso.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nao foi possivel excluir o banner.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBanner() {
    if (!draft) {
      return
    }

    if (!draft.title.trim()) {
      setError('O titulo do banner e obrigatorio.')
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const updated = await updateSiteBanner({
        id: draft.id,
        name: draft.name.trim() || 'Banner sem nome',
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        body: draft.body.trim(),
        backgroundAssetId: draft.backgroundAssetId,
        backgroundUrl: draft.backgroundUrl,
        themePreset: draft.themePreset,
        layoutDesktop: draft.layoutDesktop,
        primaryCta: draft.primaryCta,
        secondaryCta: draft.secondaryCta,
        isActive: draft.isActive,
        sortOrder: draft.sortOrder,
      })

      setBanners((current) => current.map((banner) => banner.id === updated.id ? updated : banner))
      setDraft(cloneBanner(updated))
      setMessage('Banner salvo com sucesso.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar o banner.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(banner: SiteBanner) {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const updated = await toggleSiteBannerActive(banner.id, !banner.isActive)
      setBanners((current) => current.map((item) => item.id === banner.id ? updated : item))
      if (selectedBannerId === banner.id) {
        setDraft(cloneBanner(updated))
      }
      setMessage(updated.isActive ? 'Banner ativado.' : 'Banner desativado.')
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Nao foi possivel alterar o status do banner.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveBanner(bannerId: string, direction: -1 | 1) {
    const fromIndex = banners.findIndex((banner) => banner.id === bannerId)
    const toIndex = fromIndex + direction

    if (fromIndex < 0 || toIndex < 0 || toIndex >= banners.length) {
      return
    }

    const reordered = moveItem(banners, fromIndex, toIndex).map((banner, index) => ({
      ...banner,
      sortOrder: index,
    }))

    setBanners(reordered)
    if (draft) {
      const reorderedCurrent = reordered.find((banner) => banner.id === draft.id)
      if (reorderedCurrent) {
        setDraft(cloneBanner(reorderedCurrent))
      }
    }

    try {
      await reorderSiteBanners(reordered.map((banner) => banner.id))
      setMessage('Ordem dos banners atualizada.')
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'Nao foi possivel atualizar a ordem.')
      await loadBanners(selectedBannerId)
    }
  }

  async function handleBackgroundUpload(file: File | null) {
    if (!file || !draft) {
      return
    }

    setUploadingImage(true)
    setMessage(null)
    setError(null)

    try {
      const asset = await uploadSiteAsset(file, {
        alt: draft.name || file.name,
        pageKey: 'home',
        entryKey: `banner:${draft.id}:background`,
      })

      setDraft((current) => current ? {
        ...current,
        backgroundAssetId: asset.id,
        backgroundUrl: asset.public_url ?? current.backgroundUrl,
      } : current)
      setMessage('Imagem do banner enviada. Salve para publicar a troca.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nao foi possivel enviar a imagem.')
    } finally {
      setUploadingImage(false)
    }
  }

  function handleCanvasPointerDown(key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLDivElement>) {
    if (!draft) {
      return
    }

    const currentItem = draft.layoutDesktop[key]
    dragStateRef.current = {
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentItem.x,
      startY: currentItem.y,
    }
  }

  const theme = draft ? bannerThemeStyles[draft.themePreset] : null
  const canvasTitle = draft?.title.trim() || 'Titulo do banner'
  const canvasSubtitle = draft?.subtitle.trim() || 'Subtitulo opcional'
  const canvasBody = draft?.body.trim() || 'Texto complementar opcional'

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Home</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Banners</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
            Cadastre o carrossel principal da home, organize a ordem dos slides e defina manualmente quais banners ficam ativos no site.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void handleCreateBanner()} disabled={saving} className="rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]">
            <Plus className="mr-2 h-4 w-4" />
            Novo banner
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleDuplicateBanner()} disabled={!selectedBanner || saving} className="rounded-2xl border-[#D8E6EB]">
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleDeleteBanner()} disabled={!selectedBanner || saving} className="rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Lista de banners</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">{banners.length} cadastrado(s)</h2>
              </div>
              <div className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#1398B7]">
                Home hero
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="text-sm font-semibold text-[#5F7077]">Carregando banners...</p>
              ) : banners.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-[#5F7077]">Nenhum banner cadastrado ainda.</p>
                  <Button type="button" onClick={() => void handleCreateBanner()} className="mt-4 rounded-2xl bg-[#1398B7] font-black text-white hover:bg-[#1089A5]">
                    Criar primeiro banner
                  </Button>
                </div>
              ) : banners.map((banner, index) => {
                const isSelected = banner.id === selectedBannerId

                return (
                  <article
                    key={banner.id}
                    className={cn(
                      'rounded-[24px] border p-4 transition-all',
                      isSelected ? 'border-[#1398B7] bg-[#E8F6FA]' : 'border-[#D8E6EB] bg-[#F8FBFC] hover:border-[#B8D8E1]',
                    )}
                  >
                    <button type="button" onClick={() => maybeChangeSelection(banner.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#15323b]">{banner.name}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-[#5F7077]">{banner.title}</p>
                        </div>
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                          banner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
                        )}>
                          {banner.isActive ? 'Ativo' : 'Rascunho'}
                        </span>
                      </div>
                    </button>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#5F7077]">
                        <Layers className="h-3.5 w-3.5" />
                        Ordem {index + 1}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void handleMoveBanner(banner.id, -1)} disabled={index === 0 || saving} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white text-[#5F7077] hover:bg-[#F2F7F9] disabled:opacity-50">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => void handleMoveBanner(banner.id, 1)} disabled={index === banners.length - 1 || saving} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white text-[#5F7077] hover:bg-[#F2F7F9] disabled:opacity-50">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => void handleToggleActive(banner)} disabled={saving} className={cn(
                          'inline-flex h-8 items-center justify-center gap-1 rounded-xl border px-3 text-[11px] font-black uppercase tracking-[0.12em]',
                          banner.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#D8E6EB] bg-white text-[#5F7077]',
                        )}>
                          {banner.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {banner.isActive ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </article>
        </aside>

        <section className="space-y-6">
          {!draft ? (
            <div className="rounded-[28px] border border-dashed border-[#D8E6EB] bg-white px-6 py-12 text-center text-sm font-semibold text-[#5F7077] shadow-sm">
              Selecione um banner na lista ou crie um novo para editar.
            </div>
          ) : (
            <>
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Editor do banner</p>
                    <h2 className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{draft.name || 'Banner sem nome'}</h2>
                    <p className="mt-2 text-sm font-semibold text-[#5F7077]">Canvas desktop livre com mobile responsivo automatico. Arraste os blocos para compor o slide.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => setDraft(selectedBanner ? cloneBanner(selectedBanner) : null)} disabled={!isDirty || saving} className="rounded-2xl border-[#D8E6EB]">
                      Reverter alteracoes
                    </Button>
                    <Button type="button" onClick={() => void handleSaveBanner()} disabled={saving || uploadingImage} className="rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]">
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Salvando...' : 'Salvar banner'}
                    </Button>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
                  <div className="space-y-4">
                    <div
                      ref={stageRef}
                      className="relative overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-[#0A3640] shadow-[0_24px_60px_rgba(10,54,64,0.16)]"
                      style={{ aspectRatio: '1280 / 507' }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `${theme?.overlay ?? ''}, url(${draft.backgroundUrl})`,
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                        }}
                      />

                      <BannerCanvasElement elementKey="title" item={draft.layoutDesktop.title} onPointerDown={handleCanvasPointerDown}>
                        <div className={cn('rounded-[18px] border border-dashed border-white/18 bg-black/6 px-2 py-1.5', theme?.previewSurfaceClass)}>
                          <p className={cn('text-[2rem] font-extrabold leading-[0.92] tracking-[-0.05em]', theme?.titleClass)}>
                            {canvasTitle}
                          </p>
                        </div>
                      </BannerCanvasElement>

                      <BannerCanvasElement elementKey="subtitle" item={draft.layoutDesktop.subtitle} onPointerDown={handleCanvasPointerDown}>
                        <div className={cn('rounded-[18px] border border-dashed border-white/18 bg-black/6 px-2 py-1.5', theme?.previewSurfaceClass)}>
                          <p className={cn('text-sm leading-7 sm:text-base', theme?.textClass)}>
                            {canvasSubtitle}
                          </p>
                        </div>
                      </BannerCanvasElement>

                      <BannerCanvasElement elementKey="body" item={draft.layoutDesktop.body} onPointerDown={handleCanvasPointerDown}>
                        <div className={cn('rounded-[18px] border border-dashed border-white/18 bg-black/6 px-2 py-1.5', theme?.previewSurfaceClass)}>
                          <p className={cn('text-[15px] leading-7', theme?.bodyClass)}>
                            {canvasBody}
                          </p>
                        </div>
                      </BannerCanvasElement>

                      {draft.primaryCta?.visible ? (
                        <BannerCanvasElement elementKey="primaryCta" item={draft.layoutDesktop.primaryCta} onPointerDown={handleCanvasPointerDown}>
                          <PreviewCta cta={{ ...draft.primaryCta, label: draft.primaryCta.label || 'CTA principal' }} />
                        </BannerCanvasElement>
                      ) : null}

                      {draft.secondaryCta?.visible ? (
                        <BannerCanvasElement elementKey="secondaryCta" item={draft.layoutDesktop.secondaryCta} onPointerDown={handleCanvasPointerDown}>
                          <PreviewCta cta={{ ...draft.secondaryCta, label: draft.secondaryCta.label || 'CTA secundario' }} />
                        </BannerCanvasElement>
                      ) : null}
                    </div>

                    <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-xs font-semibold leading-6 text-[#5F7077]">
                      O preview acima representa apenas o desktop. No mobile, a home empilha os elementos visiveis automaticamente em ordem editorial.
                    </div>
                  </div>

                  <div className="space-y-5">
                    <section className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                      <h3 className="font-readex text-lg font-semibold text-[#15323b]">Conteudo e imagem</h3>

                      <div className="mt-4 space-y-4">
                        <label className="grid gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Nome interno</span>
                          <input
                            value={draft.name}
                            onChange={(event) => setDraftField('name', event.target.value)}
                            className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Titulo</span>
                          <textarea
                            value={draft.title}
                            onChange={(event) => setDraftField('title', event.target.value)}
                            rows={3}
                            className="rounded-[16px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Subtitulo</span>
                          <textarea
                            value={draft.subtitle}
                            onChange={(event) => setDraftField('subtitle', event.target.value)}
                            rows={2}
                            className="rounded-[16px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Texto complementar</span>
                          <textarea
                            value={draft.body}
                            onChange={(event) => setDraftField('body', event.target.value)}
                            rows={3}
                            className="rounded-[16px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Preset visual</span>
                          <select
                            value={draft.themePreset}
                            onChange={(event) => setDraftField('themePreset', event.target.value as SiteBanner['themePreset'])}
                            className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                          >
                            {bannerThemePresetOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>

                        <div className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Imagem de fundo</p>
                              <p className="mt-2 truncate text-sm font-semibold text-[#15323b]">{draft.backgroundUrl || 'Nenhuma imagem definida'}</p>
                            </div>
                            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl bg-[#1398B7] px-4 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-[#1089A5]">
                              <ImagePlus className="mr-2 h-4 w-4" />
                              {uploadingImage ? 'Enviando...' : 'Trocar'}
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,image/*"
                                disabled={uploadingImage}
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null
                                  void handleBackgroundUpload(file)
                                  event.currentTarget.value = ''
                                }}
                                className="sr-only"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                      <h3 className="font-readex text-lg font-semibold text-[#15323b]">Composicao desktop</h3>
                      <div className="mt-4 space-y-3">
                        {(Object.keys(bannerElementLabels) as SiteBannerLayoutKey[]).map((layoutKey) => {
                          const item = draft.layoutDesktop[layoutKey]

                          return (
                            <div key={layoutKey} className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black text-[#15323b]">{bannerElementLabels[layoutKey]}</p>
                                <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">
                                  <input
                                    type="checkbox"
                                    checked={item.visible}
                                    onChange={(event) => setLayoutItem(layoutKey, (current) => ({ ...current, visible: event.target.checked }))}
                                  />
                                  Visivel
                                </label>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Largura</span>
                                  <input
                                    type="range"
                                    min={18}
                                    max={62}
                                    step={1}
                                    value={item.width}
                                    onChange={(event) => setLayoutItem(layoutKey, (current) => ({
                                      ...current,
                                      width: Number(event.target.value),
                                      x: normalizePercent(clamp(current.x, 0, 100 - Number(event.target.value))),
                                    }))}
                                  />
                                  <span className="text-xs font-semibold text-[#5F7077]">{item.width}%</span>
                                </label>

                                <div className="grid gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Camada</span>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setLayoutItem(layoutKey, (current) => ({ ...current, zIndex: Math.max(1, current.zIndex - 1) }))} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">-</button>
                                    <div className="flex-1 rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-2 text-center text-sm font-black text-[#15323b]">{item.zIndex}</div>
                                    <button type="button" onClick={() => setLayoutItem(layoutKey, (current) => ({ ...current, zIndex: current.zIndex + 1 }))} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">+</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>

                    {([
                      { key: 'primaryCta', title: 'CTA principal' },
                      { key: 'secondaryCta', title: 'CTA secundario' },
                    ] as const).map(({ key, title }) => {
                      const cta = draft[key]

                      return (
                        <section key={key} className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-readex text-lg font-semibold text-[#15323b]">{title}</h3>
                            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">
                              <input
                                type="checkbox"
                                checked={cta?.visible ?? false}
                                onChange={(event) => setCta(key, (current) => {
                                  const base = current ?? {
                                    label: title,
                                    href: '#',
                                    isInternal: true,
                                    openInNewTab: false,
                                    tonePreset: key === 'primaryCta' ? 'solid' : 'surface',
                                    visible: true,
                                  }
                                  return {
                                    ...base,
                                    visible: event.target.checked,
                                  }
                                })}
                              />
                              Usar no banner
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <label className="grid gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Texto do botao</span>
                              <input
                                value={cta?.label ?? ''}
                                onChange={(event) => setCta(key, (current) => ({
                                  ...(current ?? {
                                    href: '#',
                                    isInternal: true,
                                    openInNewTab: false,
                                    tonePreset: key === 'primaryCta' ? 'solid' : 'surface',
                                    visible: true,
                                  }),
                                  label: event.target.value,
                                } as SiteBannerCta))}
                                className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Link</span>
                              <input
                                value={cta?.href ?? ''}
                                onChange={(event) => setCta(key, (current) => ({
                                  ...(current ?? {
                                    label: title,
                                    isInternal: true,
                                    openInNewTab: false,
                                    tonePreset: key === 'primaryCta' ? 'solid' : 'surface',
                                    visible: true,
                                  }),
                                  href: event.target.value,
                                } as SiteBannerCta))}
                                className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                              />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Preset do botao</span>
                                <select
                                  value={cta?.tonePreset ?? (key === 'primaryCta' ? 'solid' : 'surface')}
                                  onChange={(event) => setCta(key, (current) => ({
                                    ...(current ?? {
                                      label: title,
                                      href: '#',
                                      isInternal: true,
                                      openInNewTab: false,
                                      visible: true,
                                    }),
                                    tonePreset: event.target.value as SiteBannerCta['tonePreset'],
                                  } as SiteBannerCta))}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                >
                                  {bannerTonePresetOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tipo de link</span>
                                <select
                                  value={cta?.isInternal === false ? 'external' : 'internal'}
                                  onChange={(event) => setCta(key, (current) => ({
                                    ...(current ?? {
                                      label: title,
                                      href: '#',
                                      openInNewTab: false,
                                      tonePreset: key === 'primaryCta' ? 'solid' : 'surface',
                                      visible: true,
                                    }),
                                    isInternal: event.target.value === 'internal',
                                    openInNewTab: event.target.value === 'external',
                                  } as SiteBannerCta))}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                >
                                  <option value="internal">Interno</option>
                                  <option value="external">Externo</option>
                                </select>
                              </label>
                            </div>
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </div>
              </article>
            </>
          )}
        </section>
      </section>
    </div>
  )
}
