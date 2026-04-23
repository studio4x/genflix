import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, Grip, ImagePlus, Layers, Monitor, Plus, Save, Smartphone, Trash2 } from 'lucide-react'

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
  cloneBannerElementStyles,
  cloneBannerLayout,
  type SiteBanner,
  type SiteBannerCta,
  type SiteBannerColorKey,
  type SiteBannerElementStyle,
  type SiteBannerLayoutItem,
  type SiteBannerLayoutKey,
} from '@/features/banners/types'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { uploadSiteAsset } from '@/features/site-editor/api'
import { cn } from '@/lib/utils'

type BannerDragState = {
  key: SiteBannerLayoutKey
  pointerId: number
  mode: 'move' | 'resize'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
}

function cloneBanner(banner: SiteBanner): SiteBanner {
  return {
    ...banner,
    layoutDesktop: cloneBannerLayout(banner.layoutDesktop),
    elementStyles: cloneBannerElementStyles(banner.elementStyles),
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

function applyWidthWithinCanvas(item: SiteBannerLayoutItem, nextWidth: number) {
  const normalizedWidth = normalizePercent(clamp(nextWidth, 18, 100))
  const normalizedX = normalizePercent(clamp(item.x, 0, 100 - normalizedWidth))

  return {
    ...item,
    width: normalizedWidth,
    x: normalizedX,
  }
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
    elementStyles: banner.elementStyles,
    primaryCta: banner.primaryCta,
    secondaryCta: banner.secondaryCta,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder,
  })
}

function normalizeColorValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized ?? '') ? normalized! : fallback
}

function getThemeTextColor(themePreset: SiteBanner['themePreset'], key: 'title' | 'subtitle' | 'body') {
  const theme = bannerThemeStyles[themePreset]
  if (key === 'title') return theme.titleColor
  if (key === 'subtitle') return theme.textColor
  return theme.bodyColor
}

function getToneColorDefaults(tone: SiteBannerCta['tonePreset']) {
  if (tone === 'warm') {
    return { backgroundColor: '#176E52', textColor: '#F6F6F6' }
  }
  if (tone === 'surface') {
    return { backgroundColor: '#FFFFFF', textColor: '#183139' }
  }
  return { backgroundColor: '#0A3640', textColor: '#F6F6F6' }
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value?: string
  fallback: string
  onChange: (value: string) => void
}) {
  const displayValue = normalizeColorValue(value, fallback)

  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{label}</span>
      <div className="flex items-center gap-2 rounded-[16px] border border-[#D8E6EB] bg-white px-3 py-2">
        <input
          type="color"
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-[#D8E6EB] bg-transparent p-0"
        />
        <input
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 flex-1 bg-transparent text-sm font-semibold text-[#15323b] outline-none"
        />
      </div>
    </label>
  )
}

function CollapsibleCard({
  title,
  summary,
  open,
  onToggle,
  children,
  className,
  bodyClassName,
}: {
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4', className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <h3 className="font-readex text-lg font-semibold text-[#15323b]">{title}</h3>
          {summary ? <p className="mt-1 text-xs font-semibold leading-5 text-[#5F7077]">{summary}</p> : null}
        </div>
        <span className={cn('mt-1 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white text-[#5F7077] transition-transform', open ? 'rotate-180' : '')}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      {open ? <div className={cn('mt-4', bodyClassName)}>{children}</div> : null}
    </section>
  )
}

function PreviewCta({
  cta,
  colors,
  className,
}: {
  cta: SiteBannerCta
  colors?: SiteBannerElementStyle
  className?: string
}) {
  return (
    <GenflixCtaButton
      type="button"
      tone={cta.tonePreset}
      customColors={{
        buttonBackgroundColor: colors?.backgroundColor,
        buttonTextColor: colors?.textColor,
      }}
      className={cn('h-12 w-full justify-between px-5', className)}
    >
      {cta.label || 'CTA'}
    </GenflixCtaButton>
  )
}

function getPreviewLayoutItem(
  item: SiteBannerLayoutItem,
  elementKey: SiteBannerLayoutKey,
  isMobilePreview: boolean,
): SiteBannerLayoutItem {
  if (!isMobilePreview) {
    return item
  }

  const mobileFallbacks: Record<SiteBannerLayoutKey, Pick<SiteBannerLayoutItem, 'x' | 'y' | 'width'>> = {
    title: { x: 8, y: 12, width: 84 },
    subtitle: { x: 8, y: 54, width: 84 },
    body: { x: 8, y: 68, width: 82 },
    primaryCta: { x: 8, y: 80, width: 78 },
    secondaryCta: { x: 8, y: 90, width: 78 },
  }

  const fallback = mobileFallbacks[elementKey]

  return {
    ...item,
    x: normalizePercent(clamp(item.x * 0.38 + fallback.x * 0.62, 4, 100 - fallback.width)),
    y: normalizePercent(clamp(item.y * 0.45 + fallback.y * 0.55, 8, 92)),
    width: normalizePercent(clamp(Math.min(Math.max(item.width, fallback.width - 10), fallback.width), 42, fallback.width)),
  }
}

function BannerCanvasElement({
  elementKey,
  item,
  children,
  onPointerDown,
  onResizePointerDown,
  draggable = true,
}: {
  elementKey: SiteBannerLayoutKey
  item: SiteBannerLayoutItem
  children: React.ReactNode
  onPointerDown: (key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLDivElement>) => void
  onResizePointerDown: (key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLButtonElement>) => void
  draggable?: boolean
}) {
  if (!item.visible) {
    return null
  }

  return (
    <div
      className={cn(
        'group absolute',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      )}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        zIndex: item.zIndex,
      }}
      onPointerDown={draggable ? (event) => onPointerDown(elementKey, event) : undefined}
    >
      <div className={cn(
        'pointer-events-none absolute -left-2 -top-2 inline-flex items-center gap-1 rounded-full border border-[#D8E6EB] bg-white/95 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#15323b] shadow-sm transition-opacity',
        draggable ? 'opacity-0 group-hover:opacity-100' : 'opacity-100',
      )}>
        <Grip className="h-3 w-3" />
        {bannerElementLabels[elementKey]}
      </div>
      {children}
      {draggable ? (
        <button
          type="button"
          aria-label={`Redimensionar ${bannerElementLabels[elementKey]}`}
          className="absolute -right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#15323b] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          onPointerDown={(event) => onResizePointerDown(elementKey, event)}
        >
          <span className="h-2.5 w-2.5 rounded-[2px] border border-current" />
        </button>
      ) : null}
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
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    content: true,
    composition: true,
    'layout-title': true,
    'layout-subtitle': false,
    'layout-body': false,
    'layout-primaryCta': false,
    'layout-secondaryCta': false,
    'cta-primaryCta': true,
    'cta-secondaryCta': false,
  })

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
        if (dragState.mode === 'resize') {
          const nextWidth = normalizePercent(clamp(dragState.startWidth + deltaX, 18, 100 - dragState.startX))

          return {
            ...current,
            layoutDesktop: {
              ...current.layoutDesktop,
              [dragState.key]: {
                ...current.layoutDesktop[dragState.key],
                width: nextWidth,
              },
            },
          }
        }

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

  function toggleCard(key: string) {
    setExpandedCards((current) => ({ ...current, [key]: !current[key] }))
  }

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

  function setElementStyle(key: SiteBannerColorKey, updater: (style: SiteBannerElementStyle) => SiteBannerElementStyle) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        elementStyles: {
          ...current.elementStyles,
          [key]: updater(current.elementStyles[key]),
        },
      }
    })
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
        elementStyles: draft.elementStyles,
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
      mode: 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentItem.x,
      startY: currentItem.y,
      startWidth: currentItem.width,
    }
  }

  function handleCanvasResizePointerDown(key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (!draft) {
      return
    }

    const currentItem = draft.layoutDesktop[key]
    dragStateRef.current = {
      key,
      pointerId: event.pointerId,
      mode: 'resize',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentItem.x,
      startY: currentItem.y,
      startWidth: currentItem.width,
    }
  }

  const theme = draft ? bannerThemeStyles[draft.themePreset] : null
  const canvasTitle = draft?.title.trim() || 'Titulo do banner'
  const canvasSubtitle = draft?.subtitle.trim() || 'Subtitulo opcional'
  const canvasBody = draft?.body.trim() || 'Texto complementar opcional'
  const isMobilePreview = previewMode === 'mobile'
  const titleColor = draft ? draft.elementStyles.title.textColor || getThemeTextColor(draft.themePreset, 'title') : '#FFFFFF'
  const subtitleColor = draft ? draft.elementStyles.subtitle.textColor || getThemeTextColor(draft.themePreset, 'subtitle') : '#FFFFFF'
  const bodyColor = draft ? draft.elementStyles.body.textColor || getThemeTextColor(draft.themePreset, 'body') : '#FFFFFF'
  const titleLayout = draft ? getPreviewLayoutItem(draft.layoutDesktop.title, 'title', isMobilePreview) : null
  const subtitleLayout = draft ? getPreviewLayoutItem(draft.layoutDesktop.subtitle, 'subtitle', isMobilePreview) : null
  const bodyLayout = draft ? getPreviewLayoutItem(draft.layoutDesktop.body, 'body', isMobilePreview) : null
  const primaryCtaLayout = draft ? getPreviewLayoutItem(draft.layoutDesktop.primaryCta, 'primaryCta', isMobilePreview) : null
  const secondaryCtaLayout = draft ? getPreviewLayoutItem(draft.layoutDesktop.secondaryCta, 'secondaryCta', isMobilePreview) : null

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

      <section className="space-y-6">
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

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                <p className="text-sm font-semibold text-[#5F7077]">Carregando banners...</p>
              ) : banners.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-4 py-6 text-center md:col-span-2 xl:col-span-4">
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
                      'h-full rounded-[24px] border p-4 transition-all',
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
            <article className="min-w-0 rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Editor do banner</p>
                  <h2 className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{draft.name || 'Banner sem nome'}</h2>
                  <p className="mt-2 text-sm font-semibold text-[#5F7077]">
                    O preview fica estavel ao lado dos cards de ajuste para facilitar a composicao do slide em tempo real.
                  </p>
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

              <div className="mt-6 grid gap-6 xl:grid-cols-12 xl:items-start">
                <div className="xl:col-span-7 2xl:col-span-8">
                  <div className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] p-4 xl:sticky xl:top-24">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Preview do banner</p>
                        <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                          Arraste os blocos diretamente sobre a arte para reposicionar os elementos.
                        </p>
                      </div>
                      <div className="inline-flex items-center rounded-2xl border border-[#D8E6EB] bg-white p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setPreviewMode('desktop')}
                          className={cn(
                            'inline-flex h-10 items-center gap-2 rounded-[14px] px-3 text-xs font-black uppercase tracking-[0.14em] transition-colors',
                            previewMode === 'desktop' ? 'bg-[#1398B7] text-white' : 'text-[#5F7077] hover:text-[#15323b]',
                          )}
                        >
                          <Monitor className="h-4 w-4" />
                          Desktop
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('mobile')}
                          className={cn(
                            'inline-flex h-10 items-center gap-2 rounded-[14px] px-3 text-xs font-black uppercase tracking-[0.14em] transition-colors',
                            previewMode === 'mobile' ? 'bg-[#1398B7] text-white' : 'text-[#5F7077] hover:text-[#15323b]',
                          )}
                        >
                          <Smartphone className="h-4 w-4" />
                          Mobile
                        </button>
                      </div>
                    </div>

                    <div
                      ref={stageRef}
                      className={cn(
                        'relative min-w-0 overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-[#0A3640] shadow-[0_24px_60px_rgba(10,54,64,0.16)] transition-all duration-300',
                        isMobilePreview
                          ? 'mx-auto w-full max-w-[420px] min-h-[620px]'
                          : 'w-full max-w-full min-h-[340px] lg:min-h-[430px] 2xl:min-h-[520px]',
                      )}
                      style={{ aspectRatio: isMobilePreview ? '390 / 760' : '1600 / 760' }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `${theme?.overlay ?? ''}, url(${draft.backgroundUrl})`,
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                        }}
                      />

                      <BannerCanvasElement elementKey="title" item={titleLayout ?? draft.layoutDesktop.title} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable={!isMobilePreview}>
                        <div className={cn('rounded-[18px] border border-dashed border-white/18 bg-black/6 px-3 py-2', theme?.previewSurfaceClass)}>
                          <p className={cn('font-extrabold leading-[0.92] tracking-[-0.05em]', isMobilePreview ? 'text-[1.9rem]' : 'text-[2.2rem] xl:text-[2.9rem]', theme?.titleClass)} style={{ color: titleColor }}>
                            {canvasTitle}
                          </p>
                        </div>
                      </BannerCanvasElement>

                      <BannerCanvasElement elementKey="subtitle" item={subtitleLayout ?? draft.layoutDesktop.subtitle} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable={!isMobilePreview}>
                        <div className={cn('rounded-[18px] border border-dashed border-white/18 bg-black/6 px-3 py-2', theme?.previewSurfaceClass)}>
                          <p className={cn(isMobilePreview ? 'text-sm leading-6' : 'text-sm leading-7 sm:text-base xl:text-lg', theme?.textClass)} style={{ color: subtitleColor }}>
                            {canvasSubtitle}
                          </p>
                        </div>
                      </BannerCanvasElement>

                      <BannerCanvasElement elementKey="body" item={bodyLayout ?? draft.layoutDesktop.body} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable={!isMobilePreview}>
                        <div className={cn('rounded-[18px] border border-dashed border-white/18 bg-black/6 px-3 py-2', theme?.previewSurfaceClass)}>
                          <p className={cn(isMobilePreview ? 'text-sm leading-6' : 'text-[15px] leading-7 xl:text-[17px]', theme?.bodyClass)} style={{ color: bodyColor }}>
                            {canvasBody}
                          </p>
                        </div>
                      </BannerCanvasElement>

                      {draft.primaryCta?.visible ? (
                        <BannerCanvasElement elementKey="primaryCta" item={primaryCtaLayout ?? draft.layoutDesktop.primaryCta} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable={!isMobilePreview}>
                          <PreviewCta cta={{ ...draft.primaryCta, label: draft.primaryCta.label || 'CTA principal' }} colors={draft.elementStyles.primaryCta} className={cn(isMobilePreview ? 'h-12 px-4 text-sm' : 'h-14 px-6')} />
                        </BannerCanvasElement>
                      ) : null}

                      {draft.secondaryCta?.visible ? (
                        <BannerCanvasElement elementKey="secondaryCta" item={secondaryCtaLayout ?? draft.layoutDesktop.secondaryCta} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable={!isMobilePreview}>
                          <PreviewCta cta={{ ...draft.secondaryCta, label: draft.secondaryCta.label || 'CTA secundario' }} colors={draft.elementStyles.secondaryCta} className={cn(isMobilePreview ? 'h-12 px-4 text-sm' : 'h-14 px-6')} />
                        </BannerCanvasElement>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-5 2xl:col-span-4">
                  <div className="grid gap-6 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:pr-2">
                    <CollapsibleCard
                      title="Conteudo e imagem"
                      summary="Troque a imagem, ajuste os textos-base e mantenha o preview visivel ao lado."
                      open={expandedCards.content}
                      onToggle={() => toggleCard('content')}
                    >
                    <div className="grid gap-4">
                      <div className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Imagem de fundo</p>
                        <p className="mt-2 truncate text-sm font-semibold text-[#15323b]">{draft.backgroundUrl || 'Nenhuma imagem definida'}</p>
                        <label className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#1398B7] px-4 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-[#1089A5]">
                          <ImagePlus className="mr-2 h-4 w-4" />
                          {uploadingImage ? 'Enviando...' : 'Trocar imagem'}
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
                          rows={4}
                          className="rounded-[16px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Texto complementar</span>
                        <textarea
                          value={draft.body}
                          onChange={(event) => setDraftField('body', event.target.value)}
                          rows={4}
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
                    </div>
                    </CollapsibleCard>

                    <CollapsibleCard
                      title="Composicao desktop"
                      summary="Ajuste visibilidade, largura, camada e cor sem perder o preview estavel ao lado."
                      open={expandedCards.composition}
                      onToggle={() => toggleCard('composition')}
                    >
                    <div className="grid gap-3">
                      {(Object.keys(bannerElementLabels) as SiteBannerLayoutKey[]).map((layoutKey) => {
                        const item = draft.layoutDesktop[layoutKey]
                        const layoutCardKey = `layout-${layoutKey}`
                        const isTextElement = layoutKey === 'title' || layoutKey === 'subtitle' || layoutKey === 'body'
                        const defaultTextColor = getThemeTextColor(draft.themePreset, isTextElement ? layoutKey : 'body')
                        const ctaDefaults = layoutKey === 'primaryCta' && draft.primaryCta
                          ? getToneColorDefaults(draft.primaryCta.tonePreset)
                          : layoutKey === 'secondaryCta' && draft.secondaryCta
                            ? getToneColorDefaults(draft.secondaryCta.tonePreset)
                            : null

                        return (
                          <CollapsibleCard
                            key={layoutKey}
                            title={bannerElementLabels[layoutKey]}
                            summary={`${item.width}% de largura • camada ${item.zIndex} • ${item.visible ? 'visivel' : 'oculto'}`}
                            open={expandedCards[layoutCardKey]}
                            onToggle={() => toggleCard(layoutCardKey)}
                            className="min-w-0 overflow-hidden rounded-[18px] bg-white p-3"
                            bodyClassName="grid min-w-0 gap-2.5"
                          >
                            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">
                              <input
                                type="checkbox"
                                checked={item.visible}
                                onChange={(event) => setLayoutItem(layoutKey, (current) => ({ ...current, visible: event.target.checked }))}
                              />
                              Visivel
                            </label>

                            <div className="grid min-w-0 gap-2.5">
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Largura</span>
                                <input
                                  type="range"
                                  min={18}
                                  max={100}
                                  step={0.5}
                                  value={item.width}
                                  onChange={(event) => setLayoutItem(
                                    layoutKey,
                                    (current) => applyWidthWithinCanvas(current, Number(event.target.value)),
                                  )}
                                />
                                <span className="text-xs font-semibold text-[#5F7077]">{item.width}%</span>
                              </label>

                              <div className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Camada</span>
                                <div className="flex min-w-0 items-center gap-2">
                                  <button type="button" onClick={() => setLayoutItem(layoutKey, (current) => ({ ...current, zIndex: Math.max(1, current.zIndex - 1) }))} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">-</button>
                                  <div className="min-w-0 flex-1 rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1.5 text-center text-sm font-black text-[#15323b]">{item.zIndex}</div>
                                  <button type="button" onClick={() => setLayoutItem(layoutKey, (current) => ({ ...current, zIndex: current.zIndex + 1 }))} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">+</button>
                                </div>
                              </div>

                              {isTextElement ? (
                                <>
                                  <ColorField
                                    label="Cor do texto"
                                    value={draft.elementStyles[layoutKey].textColor}
                                    fallback={defaultTextColor}
                                    onChange={(value) => setElementStyle(layoutKey, (current) => ({ ...current, textColor: value }))}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setElementStyle(layoutKey, (current) => ({ ...current, textColor: undefined }))}
                                    className="inline-flex h-9 w-full min-w-0 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white px-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#5F7077] hover:bg-[#F2F7F9]"
                                  >
                                    Usar cor do preset
                                  </button>
                                </>
                              ) : ctaDefaults ? (
                                <>
                                  <ColorField
                                    label="Cor do botao"
                                    value={draft.elementStyles[layoutKey].backgroundColor}
                                    fallback={ctaDefaults.backgroundColor}
                                    onChange={(value) => setElementStyle(layoutKey, (current) => ({ ...current, backgroundColor: value }))}
                                  />
                                  <ColorField
                                    label="Cor do texto"
                                    value={draft.elementStyles[layoutKey].textColor}
                                    fallback={ctaDefaults.textColor}
                                    onChange={(value) => setElementStyle(layoutKey, (current) => ({ ...current, textColor: value }))}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setElementStyle(layoutKey, () => ({}))}
                                    className="inline-flex h-9 w-full min-w-0 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white px-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#5F7077] hover:bg-[#F2F7F9]"
                                  >
                                    Usar cores do preset
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </CollapsibleCard>
                        )
                      })}
                    </div>
                    </CollapsibleCard>

                    <div className="space-y-6">
                    {([
                      { key: 'primaryCta', title: 'CTA principal' },
                      { key: 'secondaryCta', title: 'CTA secundario' },
                    ] as const).map(({ key, title }) => {
                      const cta = draft[key]
                      const ctaCardKey = `cta-${key}`
                      const toneDefaults = getToneColorDefaults(cta?.tonePreset ?? (key === 'primaryCta' ? 'solid' : 'surface'))

                      return (
                        <CollapsibleCard
                          key={key}
                          title={title}
                          summary="Defina texto, destino, preset e cores deste botao do banner."
                          open={expandedCards[ctaCardKey]}
                          onToggle={() => toggleCard(ctaCardKey)}
                        >
                          <div className="flex flex-col items-start gap-3">
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

                            <ColorField
                              label="Cor do botao"
                              value={draft.elementStyles[key].backgroundColor}
                              fallback={toneDefaults.backgroundColor}
                              onChange={(value) => setElementStyle(key, (current) => ({ ...current, backgroundColor: value }))}
                            />

                            <ColorField
                              label="Cor do texto"
                              value={draft.elementStyles[key].textColor}
                              fallback={toneDefaults.textColor}
                              onChange={(value) => setElementStyle(key, (current) => ({ ...current, textColor: value }))}
                            />

                            <button
                              type="button"
                              onClick={() => setElementStyle(key, () => ({}))}
                              className="inline-flex h-9 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white px-3 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077] hover:bg-[#F2F7F9]"
                            >
                              Usar cores do preset
                            </button>
                          </div>
                        </CollapsibleCard>
                      )
                    })}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )}
        </section>
      </section>
    </div>
  )
}
