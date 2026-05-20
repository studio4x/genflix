import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, Grip, History, ImagePlus, Layers, Maximize2, Monitor, Plus, Save, Smartphone, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  createSiteBanner,
  deleteSiteBannerCarouselTarget,
  deleteSiteBanner,
  duplicateSiteBanner,
  fetchSiteBannerLocations,
  fetchSiteBannerCarouselTargets,
  fetchSiteBanners,
  fetchSiteBannerVersions,
  reorderSiteBanners,
  restoreSiteBannerVersion,
  toggleSiteBannerActive,
  upsertSiteBannerCarouselTarget,
  updateSiteBanner,
} from '@/features/banners/api'
import { bannerThemeStyles } from '@/features/banners/presets'
import {
  DESKTOP_BANNER_DESIGN_WIDTH,
  bannerElementLabels,
  bannerThemePresetOptions,
  bannerTonePresetOptions,
  cloneBannerElementStyles,
  cloneBannerLayout,
  type SiteBanner,
  type SiteBannerCarouselTarget,
  type SiteBannerPlacementKey,
  type SiteBannerCta,
  type SiteBannerColorKey,
  type SiteBannerElementStyle,
  type SiteBannerLayoutItem,
  type SiteBannerLayoutKey,
  type SiteBannerBackgroundPosition,
  type SiteBannerBackgroundRepeat,
  type SiteBannerBackgroundSize,
  type SiteBannerVersion,
} from '@/features/banners/types'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { fetchSiteAssets, uploadSiteAsset } from '@/features/site-editor/api'
import type { SiteAsset, SitePageKey } from '@/features/site-editor/types'
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

type BannerBackgroundVariant = 'desktop' | 'mobile'

const DESKTOP_CANVAS_WIDTH = DESKTOP_BANNER_DESIGN_WIDTH
const MOBILE_CANVAS_WIDTH = 420
const LAYOUT_KEYS: SiteBannerLayoutKey[] = ['title', 'subtitle', 'body', 'primaryCta', 'secondaryCta']
const BACKGROUND_POSITION_OPTIONS: Array<{ value: SiteBannerBackgroundPosition; label: string }> = [
  { value: 'center center', label: 'Centro' },
  { value: 'left center', label: 'Esquerda' },
  { value: 'right center', label: 'Direita' },
  { value: 'center top', label: 'Topo' },
  { value: 'center bottom', label: 'Base' },
  { value: 'left top', label: 'Esquerda + topo' },
  { value: 'right top', label: 'Direita + topo' },
  { value: 'left bottom', label: 'Esquerda + base' },
  { value: 'right bottom', label: 'Direita + base' },
]
const BACKGROUND_SIZE_OPTIONS: Array<{ value: SiteBannerBackgroundSize; label: string }> = [
  { value: 'cover', label: 'Cover (preencher)' },
  { value: 'contain', label: 'Estendida (contain)' },
  { value: 'auto', label: 'Automatica (auto)' },
  { value: '100% 100%', label: 'Alongada (100% x 100%)' },
]
const BACKGROUND_REPEAT_OPTIONS: Array<{ value: SiteBannerBackgroundRepeat; label: string }> = [
  { value: 'no-repeat', label: 'Sem repeticao' },
  { value: 'repeat', label: 'Repetir' },
  { value: 'repeat-x', label: 'Repetir horizontal' },
  { value: 'repeat-y', label: 'Repetir vertical' },
]

function cloneBanner(banner: SiteBanner): SiteBanner {
  return {
    ...banner,
    layoutDesktop: cloneBannerLayout(banner.layoutDesktop),
    layoutMobile: cloneBannerLayout(banner.layoutMobile),
    backgroundDesktop: { ...banner.backgroundDesktop },
    backgroundMobile: { ...banner.backgroundMobile },
    elementStyles: cloneBannerElementStyles(banner.elementStyles),
    primaryCta: banner.primaryCta ? { ...banner.primaryCta } : null,
    secondaryCta: banner.secondaryCta ? { ...banner.secondaryCta } : null,
  }
}

function getBannerBackgroundUrl(banner: SiteBanner, variant: BannerBackgroundVariant) {
  if (variant === 'mobile') {
    return banner.backgroundUrlMobile || banner.backgroundUrl
  }

  return banner.backgroundUrl
}

function normalizePercent(value: number) {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampBannerHeight(value: number) {
  return Math.round(clamp(value, 320, 1200))
}

function formatBannerHeightInput(value: number) {
  return Number.isFinite(value) ? String(Math.round(value)) : ''
}

function parseBannerHeightInput(value: string, fallback: number) {
  const trimmed = value.trim()
  if (trimmed === '') {
    return fallback
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return clampBannerHeight(parsed)
}

function applyWidthWithinCanvas(item: SiteBannerLayoutItem, nextWidth: number) {
  const normalizedWidth = normalizePercent(clamp(nextWidth, 18, 100))
  const normalizedX = Math.round(Math.max(0, item.x))

  return {
    ...item,
    width: normalizedWidth,
    x: normalizedX,
  }
}

function scaleLayoutForHeight<T extends Record<SiteBannerLayoutKey, SiteBannerLayoutItem>>(layout: T, previousHeight: number, nextHeight: number) {
  if (!Number.isFinite(previousHeight) || previousHeight <= 0 || previousHeight === nextHeight) {
    return layout
  }

  const ratio = nextHeight / previousHeight
  const nextLayout = { ...layout } as T

  for (const key of LAYOUT_KEYS) {
    nextLayout[key] = {
      ...layout[key],
      y: Math.round(layout[key].y * ratio),
    }
  }

  return nextLayout
}

function keepLayoutInsideCanvas<T extends Record<SiteBannerLayoutKey, SiteBannerLayoutItem>>(
  layout: T,
  canvasWidth: number,
  canvasHeight: number,
) {
  const nextLayout = { ...layout } as T
  let movedCount = 0

  for (const key of LAYOUT_KEYS) {
    const item = layout[key]
    const elementWidthPx = (item.width / 100) * canvasWidth
    const maxX = Math.max(0, canvasWidth - elementWidthPx)
    const maxY = Math.max(0, canvasHeight - 20)
    const nextX = Math.round(clamp(item.x, 0, maxX))
    const nextY = Math.round(clamp(item.y, 0, maxY))
    const nextWidth = normalizePercent(clamp(item.width, 18, 100))

    if (nextX !== item.x || nextY !== item.y || nextWidth !== item.width) {
      movedCount += 1
    }

    nextLayout[key] = {
      ...item,
      x: nextX,
      y: nextY,
      width: nextWidth,
    }
  }

  return { layout: nextLayout, movedCount }
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
    backgroundAssetIdMobile: banner.backgroundAssetIdMobile,
    backgroundUrlMobile: banner.backgroundUrlMobile,
    backgroundDesktop: banner.backgroundDesktop,
    backgroundMobile: banner.backgroundMobile,
    themePreset: banner.themePreset,
    layoutDesktop: banner.layoutDesktop,
    layoutMobile: banner.layoutMobile,
    heightDesktop: banner.heightDesktop,
    heightMobile: banner.heightMobile,
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

function getBannerTextTypographyStyle(style: SiteBannerElementStyle) {
  return {
    fontFamily: style.fontFamily || undefined,
    fontSize: typeof style.fontSize === 'number' ? `${style.fontSize}px` : undefined,
    fontWeight: typeof style.fontWeight === 'number' ? style.fontWeight : undefined,
    letterSpacing: typeof style.letterSpacing === 'number' ? `${style.letterSpacing}px` : undefined,
    textAlign: style.textAlign || undefined,
  } as const
}

function getVerticalAnchorTransform(verticalAlign?: SiteBannerElementStyle['verticalAlign']) {
  if (verticalAlign === 'middle') {
    return 'translateY(-50%)'
  }

  if (verticalAlign === 'bottom') {
    return 'translateY(-100%)'
  }

  return 'translateY(0)'
}

function toPreviewStyle(item: SiteBannerLayoutItem, scaleFactor: number) {
  return {
    left: `${item.x * scaleFactor}px`,
    top: `${item.y}px`,
    width: `${item.width}%`,
    zIndex: item.zIndex,
  }
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

function LayoutControls({
  item,
  labelPrefix,
  onVisibleChange,
  onWidthChange,
  onZIndexChange,
}: {
  item: SiteBannerLayoutItem
  labelPrefix: string
  onVisibleChange: (visible: boolean) => void
  onWidthChange: (width: number) => void
  onZIndexChange: (nextValue: number) => void
}) {
  return (
    <div className="grid min-w-0 gap-2.5">
      <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">
        <input
          type="checkbox"
          checked={item.visible}
          onChange={(event) => onVisibleChange(event.target.checked)}
        />
        Visivel
      </label>

      <label className="grid gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{labelPrefix} largura</span>
        <input
          type="range"
          min={18}
          max={100}
          step={0.5}
          value={item.width}
          onChange={(event) => onWidthChange(Number(event.target.value))}
        />
        <span className="text-xs font-semibold text-[#5F7077]">{item.width}%</span>
      </label>

      <div className="grid gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{labelPrefix} camada</span>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => onZIndexChange(Math.max(1, item.zIndex - 1))} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">-</button>
          <div className="min-w-0 flex-1 rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1.5 text-center text-sm font-black text-[#15323b]">{item.zIndex}</div>
          <button type="button" onClick={() => onZIndexChange(item.zIndex + 1)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">+</button>
        </div>
      </div>
    </div>
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

function BannerCanvasElement({
  elementKey,
  item,
  children,
  verticalAlign,
  onPointerDown,
  onResizePointerDown,
  draggable = true,
  style,
}: {
  elementKey: SiteBannerLayoutKey
  item: SiteBannerLayoutItem
  children: React.ReactNode
  verticalAlign?: SiteBannerElementStyle['verticalAlign']
  onPointerDown: (key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLDivElement>) => void
  onResizePointerDown: (key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLButtonElement>) => void
  draggable?: boolean
  style?: React.CSSProperties
}) {
  if (!item.visible) {
    return null
  }

  return (
    <div
      className={cn(
        'group absolute',
        draggable ? 'cursor-grab touch-none select-none active:cursor-grabbing' : 'cursor-default',
      )}
      style={style ?? {
        left: `${item.x}px`,
        top: `${item.y}px`,
        width: `${item.width}%`,
        zIndex: item.zIndex,
        transform: getVerticalAnchorTransform(verticalAlign),
      }}
      onPointerDown={draggable ? (event) => onPointerDown(elementKey, event) : undefined}
    >
      <div className={cn(
        'pointer-events-none absolute -left-2 -top-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0A3640]/92 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-sm transition-opacity backdrop-blur-sm',
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
  const [uploadingBackground, setUploadingBackground] = useState<BannerBackgroundVariant | null>(null)
  const [libraryAssets, setLibraryAssets] = useState<SiteAsset[]>([])
  const [loadingLibraryAssets, setLoadingLibraryAssets] = useState(false)
  const [backgroundLibrarySelection, setBackgroundLibrarySelection] = useState<Record<BannerBackgroundVariant, string>>({
    desktop: '',
    mobile: '',
  })
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false)
  const [libraryModalVariant, setLibraryModalVariant] = useState<BannerBackgroundVariant>('desktop')
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false)
  const [isImmersiveMode, setIsImmersiveMode] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const previewModalStageRef = useRef<HTMLDivElement | null>(null)
  const stageContentRef = useRef<HTMLDivElement | null>(null)
  const previewModalContentRef = useRef<HTMLDivElement | null>(null)
  const pageRootRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<BannerDragState | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [stageContentWidth, setStageContentWidth] = useState(0)
  const [previewModalContentWidth, setPreviewModalContentWidth] = useState(0)
  const [heightDesktopInput, setHeightDesktopInput] = useState('760')
  const [heightMobileInput, setHeightMobileInput] = useState('560')
  const [locationKeys, setLocationKeys] = useState<string[]>([])
  const [selectedLocationKey, setSelectedLocationKey] = useState<string>('home-hero')
  const [carouselTargets, setCarouselTargets] = useState<SiteBannerCarouselTarget[]>([])
  const [targetPageKey, setTargetPageKey] = useState<SitePageKey>('home')
  const [targetPlacementKey, setTargetPlacementKey] = useState<SiteBannerPlacementKey>('hero')
  const [bannerVersions, setBannerVersions] = useState<SiteBannerVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)

  const pageOptions: Array<{ value: SitePageKey; label: string }> = [
    { value: 'home', label: 'Home' },
    { value: 'courses', label: 'Cursos' },
    { value: 'course-detail', label: 'Detalhe de curso' },
    { value: 'about', label: 'Sobre' },
    { value: 'blog', label: 'Blog' },
    { value: 'blog-post', label: 'Post do blog' },
    { value: 'contact', label: 'Contato' },
    { value: 'community', label: 'Comunidade' },
    { value: 'resources', label: 'Recursos' },
    { value: 'support', label: 'Suporte' },
    { value: 'privacy', label: 'Privacidade' },
    { value: 'cookies', label: 'Cookies' },
    { value: 'terms', label: 'Termos' },
  ]
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    content: true,
    composition: true,
    'layout-title': true,
    'layout-subtitle': false,
    'layout-body': false,
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

  async function loadBanners(preferredBannerId?: string | null, locationKey = selectedLocationKey) {
    setLoading(true)
    setError(null)

    try {
      const [rows, locations, targets] = await Promise.all([
        fetchSiteBanners(locationKey),
        fetchSiteBannerLocations(),
        fetchSiteBannerCarouselTargets(locationKey),
      ])
      setLocationKeys(locations)
      setCarouselTargets(targets)
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
    void loadBanners(undefined, selectedLocationKey)
  }, [selectedLocationKey])

  useEffect(() => {
    let isMounted = true
    setLoadingLibraryAssets(true)

    void fetchSiteAssets(120)
      .then((assets) => {
        if (!isMounted) {
          return
        }

        setLibraryAssets(assets.filter((asset) => (asset.mime_type ?? '').startsWith('image/')))
      })
      .catch((loadError) => {
        if (!isMounted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar a biblioteca de midia.')
      })
      .finally(() => {
        if (!isMounted) {
          return
        }

        setLoadingLibraryAssets(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!draft) {
      setHeightDesktopInput('760')
      setHeightMobileInput('560')
      return
    }

    setHeightDesktopInput(formatBannerHeightInput(draft.heightDesktop))
    setHeightMobileInput(formatBannerHeightInput(draft.heightMobile))
  }, [draft?.id, draft?.heightDesktop, draft?.heightMobile])

  useEffect(() => {
    if (!selectedBannerId) {
      setBannerVersions([])
      setLoadingVersions(false)
      return
    }

    let isMounted = true
    setLoadingVersions(true)

    void fetchSiteBannerVersions(selectedBannerId)
      .then((versions) => {
        if (!isMounted) {
          return
        }

        setBannerVersions(versions)
      })
      .catch((loadError) => {
        if (!isMounted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o historico do banner.')
        setBannerVersions([])
      })
      .finally(() => {
        if (!isMounted) {
          return
        }

        setLoadingVersions(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedBannerId])

  useEffect(() => {
    const root = pageRootRef.current
    if (!root || typeof root.requestFullscreen !== 'function' || document.fullscreenElement) {
      return
    }

    void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
      // Some browsers block fullscreen entry without a user gesture.
    })
  }, [])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current
      const stage = isPreviewModalOpen ? (previewModalStageRef.current ?? stageRef.current) : stageRef.current
      const contentNode = isPreviewModalOpen ? (previewModalContentRef.current ?? stageContentRef.current) : stageContentRef.current

      if (!dragState || !stage || !contentNode || dragState.pointerId !== event.pointerId) {
        return
      }

      const rect = stage.getBoundingClientRect()
      const contentRect = contentNode.getBoundingClientRect()
      const deltaXPx = event.clientX - dragState.startClientX
      const deltaYPx = event.clientY - dragState.startClientY
      const designWidth = previewMode === 'mobile' ? MOBILE_CANVAS_WIDTH : DESKTOP_CANVAS_WIDTH
      const scaleFactor = contentRect.width > 0 ? contentRect.width / designWidth : 1
      const normalizedScale = scaleFactor > 0 ? scaleFactor : 1

      setDraft((current) => {
        if (!current) {
          return current
        }

        const layoutKey = previewMode === 'mobile' ? 'layoutMobile' : 'layoutDesktop'
        const currentItem = current[layoutKey][dragState.key]
        if (dragState.mode === 'resize') {
          return {
            ...current,
            [layoutKey]: {
              ...current[layoutKey],
              [dragState.key]: applyWidthWithinCanvas(currentItem, dragState.startWidth + ((deltaXPx / contentRect.width) * 100)),
            },
          }
        }

        const elementWidthPx = (currentItem.width / 100) * contentRect.width
        const maxX = Math.max(0, (contentRect.width - elementWidthPx) / normalizedScale)
        const maxY = Math.max(0, rect.height - 16)
        const nextX = Math.round(clamp(dragState.startX + (deltaXPx / normalizedScale), 0, maxX))
        const nextY = Math.round(clamp(dragState.startY + deltaYPx, 0, maxY))

        return {
          ...current,
          [layoutKey]: {
            ...current[layoutKey],
            [dragState.key]: {
              ...current[layoutKey][dragState.key],
              x: nextX,
              y: nextY,
            },
          },
        }
      })
    }

    function finishDrag(event: PointerEvent) {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      dragStateRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [isPreviewModalOpen, previewMode])

  useEffect(() => {
    const cleanups: Array<() => void> = []
    const observers: ResizeObserver[] = []
    const bindings = [
      { node: stageContentRef.current, setWidth: setStageContentWidth },
      { node: previewModalContentRef.current, setWidth: setPreviewModalContentWidth },
    ]

    for (const binding of bindings) {
      const node = binding.node
      if (!node) {
        continue
      }

      const updateWidth = () => binding.setWidth(node.getBoundingClientRect().width)
      updateWidth()

      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', updateWidth)
        cleanups.push(() => window.removeEventListener('resize', updateWidth))
        continue
      }

      const observer = new ResizeObserver(() => updateWidth())
      observer.observe(node)
      observers.push(observer)
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      observers.forEach((observer) => observer.disconnect())
    }
  }, [draft?.id, isPreviewModalOpen, previewMode])

  function toggleCard(key: string) {
    setExpandedCards((current) => ({ ...current, [key]: !current[key] }))
  }

  async function handleExitImmersiveMode() {
    setIsImmersiveMode(false)

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
    }
  }

  function setDraftField<K extends keyof SiteBanner>(field: K, value: SiteBanner[K]) {
    setDraft((current) => current ? { ...current, [field]: value } : current)
  }

  function commitBannerHeight(which: 'heightDesktop' | 'heightMobile', value: string) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      const fallback = which === 'heightDesktop' ? current.heightDesktop : current.heightMobile
      const nextValue = parseBannerHeightInput(value, fallback)
      if (which === 'heightDesktop') {
        setHeightDesktopInput(formatBannerHeightInput(nextValue))
      } else {
        setHeightMobileInput(formatBannerHeightInput(nextValue))
      }

      if (which === 'heightDesktop') {
        const scaledDesktop = scaleLayoutForHeight(current.layoutDesktop, current.heightDesktop, nextValue)
        const normalizedDesktop = keepLayoutInsideCanvas(scaledDesktop, DESKTOP_CANVAS_WIDTH, nextValue)
        return {
          ...current,
          heightDesktop: nextValue,
          layoutDesktop: normalizedDesktop.layout,
        }
      }

      const scaledMobile = scaleLayoutForHeight(current.layoutMobile, current.heightMobile, nextValue)
      const normalizedMobile = keepLayoutInsideCanvas(scaledMobile, MOBILE_CANVAS_WIDTH, nextValue)
      return {
        ...current,
        heightMobile: nextValue,
        layoutMobile: normalizedMobile.layout,
      }
    })
  }

  function handleAlignAllInsideCanvas() {
    let desktopMovedCount = 0
    let mobileMovedCount = 0

    setDraft((current) => {
      if (!current) {
        return current
      }

      const desktop = keepLayoutInsideCanvas(current.layoutDesktop, DESKTOP_CANVAS_WIDTH, current.heightDesktop)
      const mobile = keepLayoutInsideCanvas(current.layoutMobile, MOBILE_CANVAS_WIDTH, current.heightMobile)
      desktopMovedCount = desktop.movedCount
      mobileMovedCount = mobile.movedCount

      return {
        ...current,
        layoutDesktop: desktop.layout,
        layoutMobile: mobile.layout,
      }
    })
    const totalMoved = desktopMovedCount + mobileMovedCount
    setMessage(
      totalMoved > 0
        ? `Alinhamento aplicado. ${desktopMovedCount} ajuste(s) no desktop e ${mobileMovedCount} no mobile.`
        : 'Todos os elementos ja estavam dentro do canvas.',
    )
    setError(null)
  }

  function setLayoutItem(key: SiteBannerLayoutKey, updater: (item: SiteBannerLayoutItem) => SiteBannerLayoutItem) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      const layoutKey = previewMode === 'mobile' ? 'layoutMobile' : 'layoutDesktop'

      return {
        ...current,
        [layoutKey]: {
          ...current[layoutKey],
          [key]: updater(current[layoutKey][key]),
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
      const created = await createSiteBanner(selectedLocationKey)
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

  async function handleDeleteBanner(targetBanner?: SiteBanner) {
    const bannerToDelete = targetBanner ?? selectedBanner

    if (!bannerToDelete) {
      return
    }

    if (!window.confirm(`Deseja realmente excluir o banner "${bannerToDelete.name}"?`)) {
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      await deleteSiteBanner(bannerToDelete.id)
      const fallbackBannerId = banners.find((banner) => banner.id !== bannerToDelete.id)?.id ?? null
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

    const nextHeightDesktop = parseBannerHeightInput(heightDesktopInput, draft.heightDesktop)
    const nextHeightMobile = parseBannerHeightInput(heightMobileInput, draft.heightMobile)

    if (!draft.title.trim()) {
      setError('O titulo do banner e obrigatorio.')
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const normalizedDesktop = keepLayoutInsideCanvas(draft.layoutDesktop, DESKTOP_CANVAS_WIDTH, nextHeightDesktop).layout
      const normalizedMobile = keepLayoutInsideCanvas(draft.layoutMobile, MOBILE_CANVAS_WIDTH, nextHeightMobile).layout
      const updated = await updateSiteBanner({
        id: draft.id,
        name: draft.name.trim() || 'Banner sem nome',
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        body: draft.body.trim(),
        backgroundAssetId: draft.backgroundAssetId,
        backgroundUrl: draft.backgroundUrl,
        backgroundAssetIdMobile: draft.backgroundAssetIdMobile,
        backgroundUrlMobile: draft.backgroundUrlMobile,
        backgroundDesktop: draft.backgroundDesktop,
        backgroundMobile: draft.backgroundMobile,
        themePreset: draft.themePreset,
        layoutDesktop: normalizedDesktop,
        layoutMobile: normalizedMobile,
        heightDesktop: nextHeightDesktop,
        heightMobile: nextHeightMobile,
        elementStyles: draft.elementStyles,
        primaryCta: draft.primaryCta,
        secondaryCta: draft.secondaryCta,
        isActive: draft.isActive,
        sortOrder: draft.sortOrder,
      })

      setBanners((current) => current.map((banner) => banner.id === updated.id ? updated : banner))
      setDraft(cloneBanner(updated))
      setHeightDesktopInput(formatBannerHeightInput(updated.heightDesktop))
      setHeightMobileInput(formatBannerHeightInput(updated.heightMobile))
      setMessage('Banner salvo com sucesso.')
      setSaveConfirmationOpen(true)
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
      await reorderSiteBanners(reordered.map((banner) => banner.id), selectedLocationKey)
      setMessage('Ordem dos banners atualizada.')
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'Nao foi possivel atualizar a ordem.')
      await loadBanners(selectedBannerId)
    }
  }

  async function handleRestoreVersion(version: SiteBannerVersion) {
    const label = version.snapshot.name || version.snapshot.title || 'banner'
    if (!window.confirm(`Deseja reverter o banner para a revisão de ${new Date(version.createdAt).toLocaleString('pt-BR')} (${label})? Essa ação cria uma nova revisão.`)) {
      return
    }

    setRestoringVersionId(version.id)
    setMessage(null)
    setError(null)

    try {
      const restored = await restoreSiteBannerVersion(version)
      setBanners((current) => current.map((banner) => banner.id === restored.id ? restored : banner))
      setDraft(cloneBanner(restored))
      setHeightDesktopInput(formatBannerHeightInput(restored.heightDesktop))
      setHeightMobileInput(formatBannerHeightInput(restored.heightMobile))
      const versions = await fetchSiteBannerVersions(restored.id)
      setBannerVersions(versions)
      setMessage('Banner revertido para a revisão selecionada.')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Nao foi possivel restaurar esta revisao.')
    } finally {
      setRestoringVersionId(null)
    }
  }

  async function handleBackgroundUpload(variant: BannerBackgroundVariant, file: File | null) {
    if (!file || !draft) {
      return
    }

    setUploadingBackground(variant)
    setMessage(null)
    setError(null)

    try {
      const asset = await uploadSiteAsset(file, {
        alt: draft.name || file.name,
        pageKey: 'home',
        entryKey: `banner:${draft.id}:background:${variant}`,
      })

      setDraft((current) => current ? {
        ...current,
        backgroundAssetId: variant === 'desktop' ? asset.id : current.backgroundAssetId,
        backgroundUrl: variant === 'desktop' ? (asset.public_url ?? current.backgroundUrl) : current.backgroundUrl,
        backgroundAssetIdMobile: variant === 'mobile' ? asset.id : current.backgroundAssetIdMobile,
        backgroundUrlMobile: variant === 'mobile' ? (asset.public_url ?? current.backgroundUrlMobile) : current.backgroundUrlMobile,
      } : current)
      setLibraryAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)])
      setMessage('Imagem do banner enviada. Salve para publicar a troca.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nao foi possivel enviar a imagem.')
    } finally {
      setUploadingBackground(null)
    }
  }

  function handleBackgroundLibraryApply(variant: BannerBackgroundVariant) {
    if (!draft) {
      return
    }

    const selectedAssetId = backgroundLibrarySelection[variant]
    if (!selectedAssetId) {
      setError('Selecione uma imagem da biblioteca antes de aplicar.')
      return
    }

    const selectedAsset = libraryAssets.find((asset) => asset.id === selectedAssetId)
    if (!selectedAsset || !selectedAsset.public_url) {
      setError('Nao foi possivel usar o item selecionado da biblioteca.')
      return
    }
    const selectedAssetUrl = selectedAsset.public_url

    setDraft((current) => current ? {
      ...current,
      backgroundAssetId: variant === 'desktop' ? selectedAsset.id : current.backgroundAssetId,
      backgroundUrl: variant === 'desktop' ? selectedAssetUrl : current.backgroundUrl,
      backgroundAssetIdMobile: variant === 'mobile' ? selectedAsset.id : current.backgroundAssetIdMobile,
      backgroundUrlMobile: variant === 'mobile' ? selectedAssetUrl : current.backgroundUrlMobile,
    } : current)
    setMessage(`Imagem da biblioteca aplicada em ${variant === 'desktop' ? 'desktop' : 'mobile'}. Salve para publicar.`)
  }

  function handleRemoveBackgroundImage(variant: BannerBackgroundVariant) {
    if (!draft) {
      return
    }

    setError(null)
    setMessage(null)

    setDraft((current) => current ? {
      ...current,
      backgroundAssetId: variant === 'desktop' ? null : current.backgroundAssetId,
      backgroundUrl: variant === 'desktop' ? '' : current.backgroundUrl,
      backgroundAssetIdMobile: variant === 'mobile' ? null : current.backgroundAssetIdMobile,
      backgroundUrlMobile: variant === 'mobile' ? '' : current.backgroundUrlMobile,
    } : current)
    setMessage(`Imagem de ${variant === 'desktop' ? 'desktop' : 'mobile'} removida. Salve para publicar.`)
  }

  function handleOpenLibraryModal(variant: BannerBackgroundVariant) {
    setLibraryModalVariant(variant)
    setIsLibraryModalOpen(true)
  }

  function handleCanvasPointerDown(key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()

    if (!draft) {
      return
    }

    const currentLayout = previewMode === 'mobile' ? draft.layoutMobile : draft.layoutDesktop
    const currentItem = currentLayout[key]
    event.currentTarget.setPointerCapture?.(event.pointerId)
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

  async function handleCreateCarousel() {
    const input = window.prompt('Informe uma chave para o novo carrossel (ex.: home-secundario, cursos-hero):')
    const key = (input ?? '').trim().toLowerCase().replace(/\s+/g, '-')
    if (!key) return

    if (locationKeys.includes(key)) {
      setSelectedLocationKey(key)
      setMessage(`Carrossel "${key}" já existe e foi selecionado.`)
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const created = await createSiteBanner(key)
      const nextLocations = Array.from(new Set([...locationKeys, key])).sort()
      setLocationKeys(nextLocations)
      setSelectedLocationKey(key)
      await loadBanners(created.id, key)
      setMessage(`Carrossel "${key}" criado.`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Nao foi possivel criar o carrossel.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCarouselTarget() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await upsertSiteBannerCarouselTarget({
        locationKey: selectedLocationKey,
        pageKey: targetPageKey,
        placementKey: targetPlacementKey,
      })
      const targets = await fetchSiteBannerCarouselTargets(selectedLocationKey)
      setCarouselTargets(targets)
      setMessage('Destino de exibicao adicionado ao carrossel.')
    } catch (targetError) {
      setError(targetError instanceof Error ? targetError.message : 'Nao foi possivel adicionar destino ao carrossel.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveCarouselTarget(targetId: string) {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await deleteSiteBannerCarouselTarget(targetId)
      const targets = await fetchSiteBannerCarouselTargets(selectedLocationKey)
      setCarouselTargets(targets)
      setMessage('Destino removido do carrossel.')
    } catch (targetError) {
      setError(targetError instanceof Error ? targetError.message : 'Nao foi possivel remover destino do carrossel.')
    } finally {
      setSaving(false)
    }
  }

  function handleCanvasResizePointerDown(key: SiteBannerLayoutKey, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (!draft) {
      return
    }

    const currentLayout = previewMode === 'mobile' ? draft.layoutMobile : draft.layoutDesktop
    const currentItem = currentLayout[key]
    event.currentTarget.setPointerCapture?.(event.pointerId)
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
  const getBackgroundImage = (overlay: string | undefined, backgroundUrl: string) => {
    const normalizedBackgroundUrl = backgroundUrl.trim()
    if (!normalizedBackgroundUrl) {
      return overlay || 'none'
    }

    return overlay ? `${overlay}, url(${normalizedBackgroundUrl})` : `url(${normalizedBackgroundUrl})`
  }
  const canvasTitle = draft?.title.trim() || 'Titulo do banner'
  const canvasSubtitle = draft?.subtitle.trim() || 'Subtitulo opcional'
  const canvasBody = draft?.body.trim() || 'Texto complementar opcional'
  const isMobilePreview = previewMode === 'mobile'
  const previewHeight = draft ? (isMobilePreview ? draft.heightMobile : draft.heightDesktop) : 560
  const activeLayoutLabel = isMobilePreview ? 'mobile' : 'desktop'
  const activeLayout = draft ? (isMobilePreview ? draft.layoutMobile : draft.layoutDesktop) : null
  const titleColor = draft ? draft.elementStyles.title.textColor || getThemeTextColor(draft.themePreset, 'title') : '#FFFFFF'
  const subtitleColor = draft ? draft.elementStyles.subtitle.textColor || getThemeTextColor(draft.themePreset, 'subtitle') : '#FFFFFF'
  const bodyColor = draft ? draft.elementStyles.body.textColor || getThemeTextColor(draft.themePreset, 'body') : '#FFFFFF'
  const titleLayout = activeLayout?.title ?? null
  const subtitleLayout = activeLayout?.subtitle ?? null
  const bodyLayout = activeLayout?.body ?? null
  const titleTypographyStyle = draft ? getBannerTextTypographyStyle(draft.elementStyles.title) : {}
  const subtitleTypographyStyle = draft ? getBannerTextTypographyStyle(draft.elementStyles.subtitle) : {}
  const bodyTypographyStyle = draft ? getBannerTextTypographyStyle(draft.elementStyles.body) : {}
  const primaryCtaLayout = activeLayout?.primaryCta ?? null
  const secondaryCtaLayout = activeLayout?.secondaryCta ?? null
  const activeBackgroundConfig = draft
    ? (isMobilePreview ? draft.backgroundMobile : draft.backgroundDesktop)
    : null
  const activeDesignWidth = isMobilePreview ? MOBILE_CANVAS_WIDTH : DESKTOP_CANVAS_WIDTH
  const activePreviewContentWidth = isPreviewModalOpen ? previewModalContentWidth : stageContentWidth
  const previewScaleFactor = activePreviewContentWidth > 0 ? activePreviewContentWidth / activeDesignWidth : 1

  const getPreviewElementStyle = (item: SiteBannerLayoutItem, verticalAlign?: SiteBannerElementStyle['verticalAlign']) => ({
    ...toPreviewStyle(item, previewScaleFactor),
    transform: getVerticalAnchorTransform(verticalAlign),
  })

  const renderVersionsList = () => (
    <div className="mt-4 grid gap-3">
      {loadingVersions ? (
        <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-white px-4 py-4 text-sm font-semibold text-[#5F7077]">
          Carregando historico...
        </div>
      ) : bannerVersions.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-white px-4 py-4 text-sm font-semibold text-[#5F7077]">
          Nenhuma revisao registrada para este banner.
        </div>
      ) : bannerVersions.slice(0, 12).map((version, index) => (
        <div key={version.id} className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1398B7]">
                Revisao {bannerVersions.length - index} · {new Date(version.createdAt).toLocaleString('pt-BR')}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                {version.changeReason} · {version.snapshot.name || 'Banner sem nome'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={restoringVersionId === version.id || saving}
              onClick={() => void handleRestoreVersion(version)}
              className="rounded-xl border-[#D8E6EB] px-3 text-[10px] font-black uppercase tracking-[0.12em]"
            >
              {restoringVersionId === version.id ? 'Revertendo...' : 'Reverter'}
            </Button>
          </div>
          <div className="mt-3 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-3">
            <p className="text-sm font-black text-[#15323b]">{version.snapshot.title || 'Sem titulo'}</p>
            {version.snapshot.subtitle ? (
              <p className="mt-1 text-xs font-semibold leading-5 text-[#5F7077]">{version.snapshot.subtitle}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )

  const renderPreviewCanvas = (
    canvasRef: React.RefObject<HTMLDivElement | null>,
    contentRef: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div className="w-full">
      <div
        ref={canvasRef}
        className={cn(
          'relative overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-[#0A3640] shadow-[0_24px_60px_rgba(10,54,64,0.16)] transition-all duration-300',
        )}
        style={{
          height: `${previewHeight}px`,
          width: '100%',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: getBackgroundImage(theme?.overlay, getBannerBackgroundUrl(draft!, isMobilePreview ? 'mobile' : 'desktop')),
            backgroundPosition: activeBackgroundConfig?.position ?? 'center center',
            backgroundSize: activeBackgroundConfig?.size ?? 'cover',
            backgroundRepeat: activeBackgroundConfig?.repeat ?? 'no-repeat',
          }}
        />

        <div ref={contentRef} className="public-site-container relative h-full">
          <BannerCanvasElement elementKey="title" item={titleLayout ?? draft!.layoutDesktop.title} verticalAlign={draft!.elementStyles.title.verticalAlign} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable style={getPreviewElementStyle(titleLayout ?? draft!.layoutDesktop.title, draft!.elementStyles.title.verticalAlign)}>
            <p className={cn(isMobilePreview ? 'text-[2.2rem] font-extrabold leading-[0.94] tracking-[-0.05em] sm:text-[2.6rem]' : 'text-[2.5rem] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-[3rem] md:text-[3.25rem]', theme?.titleClass)} style={{ color: titleColor, ...titleTypographyStyle }}>
              {canvasTitle}
            </p>
          </BannerCanvasElement>

          <BannerCanvasElement elementKey="subtitle" item={subtitleLayout ?? draft!.layoutDesktop.subtitle} verticalAlign={draft!.elementStyles.subtitle.verticalAlign} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable style={getPreviewElementStyle(subtitleLayout ?? draft!.layoutDesktop.subtitle, draft!.elementStyles.subtitle.verticalAlign)}>
            <p className={cn('text-sm leading-7 sm:text-base', theme?.textClass)} style={{ color: subtitleColor, ...subtitleTypographyStyle }}>
              {canvasSubtitle}
            </p>
          </BannerCanvasElement>

          <BannerCanvasElement elementKey="body" item={bodyLayout ?? draft!.layoutDesktop.body} verticalAlign={draft!.elementStyles.body.verticalAlign} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable style={getPreviewElementStyle(bodyLayout ?? draft!.layoutDesktop.body, draft!.elementStyles.body.verticalAlign)}>
            <p className={cn('text-[15px] leading-7', theme?.bodyClass)} style={{ color: bodyColor, ...bodyTypographyStyle }}>
              {canvasBody}
            </p>
          </BannerCanvasElement>

          {draft!.primaryCta?.visible ? (
            <BannerCanvasElement elementKey="primaryCta" item={primaryCtaLayout ?? draft!.layoutDesktop.primaryCta} verticalAlign={draft!.elementStyles.primaryCta.verticalAlign} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable style={getPreviewElementStyle(primaryCtaLayout ?? draft!.layoutDesktop.primaryCta, draft!.elementStyles.primaryCta.verticalAlign)}>
              <PreviewCta cta={{ ...draft!.primaryCta, label: draft!.primaryCta.label || 'CTA principal' }} colors={draft!.elementStyles.primaryCta} className="h-12 w-full justify-between px-5" />
            </BannerCanvasElement>
          ) : null}

          {draft!.secondaryCta?.visible ? (
            <BannerCanvasElement elementKey="secondaryCta" item={secondaryCtaLayout ?? draft!.layoutDesktop.secondaryCta} verticalAlign={draft!.elementStyles.secondaryCta.verticalAlign} onPointerDown={handleCanvasPointerDown} onResizePointerDown={handleCanvasResizePointerDown} draggable style={getPreviewElementStyle(secondaryCtaLayout ?? draft!.layoutDesktop.secondaryCta, draft!.elementStyles.secondaryCta.verticalAlign)}>
              <PreviewCta cta={{ ...draft!.secondaryCta, label: draft!.secondaryCta.label || 'CTA secundario' }} colors={draft!.elementStyles.secondaryCta} className="h-12 w-full justify-between px-5" />
            </BannerCanvasElement>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <div
      ref={pageRootRef}
      className={cn(
        'space-y-7',
        isImmersiveMode ? 'fixed inset-0 z-[70] overflow-y-auto bg-[#F2F7F9] p-5 sm:p-6 lg:p-8' : '',
      )}
    >
      {saveConfirmationOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0A3640]/45 px-4">
          <div className="w-full max-w-md rounded-[24px] border border-[#D8E6EB] bg-white p-6 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Confirmação</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Banner salvo com sucesso</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5F7077]">
              As alterações do banner foram registradas. Você pode continuar editando ou fechar esta confirmação.
            </p>
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={() => setSaveConfirmationOpen(false)}
                className="rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {isPreviewModalOpen && draft ? (
        <div className="fixed inset-0 z-[85] bg-[#0A3640]/80">
          <div className="flex h-full w-full flex-col p-4">
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1398B7]">Previa ampliada</p>
                <p className="text-xs font-semibold text-[#5F7077]">Arraste e reposicione os elementos direto no modal.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsPreviewModalOpen(false)} className="rounded-xl border-[#D8E6EB]">
                <X className="mr-1 h-4 w-4" />
                Fechar
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              {renderPreviewCanvas(previewModalStageRef, previewModalContentRef)}
            </div>
          </div>
        </div>
      ) : null}
      {isVersionsModalOpen && draft ? (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-[#0A3640]/60 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-[#D8E6EB] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D8E6EB] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Historico de revisoes</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">{draft.name || 'Banner sem nome'}</h2>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsVersionsModalOpen(false)} className="rounded-xl border-[#D8E6EB]">
                <X className="mr-1 h-4 w-4" />
                Fechar
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FBFC] p-5">
              <p className="text-xs font-semibold leading-5 text-[#5F7077]">
                Cada salvamento relevante do banner gera uma revisao. Clique na desejada para reverter e criar uma nova entrada no historico.
              </p>
              {renderVersionsList()}
            </div>
          </div>
        </div>
      ) : null}
      {isLibraryModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0A3640]/50 px-4 py-6">
          <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[#D8E6EB] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D8E6EB] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Biblioteca de mídia</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">
                  Escolher imagem para {libraryModalVariant === 'desktop' ? 'desktop' : 'mobile'}
                </h2>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsLibraryModalOpen(false)} className="rounded-xl border-[#D8E6EB]">
                Fechar
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {loadingLibraryAssets ? (
                <p className="text-sm font-semibold text-[#5F7077]">Carregando biblioteca...</p>
              ) : libraryAssets.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-4 py-6 text-sm font-semibold text-[#5F7077]">
                  Nenhuma imagem encontrada na biblioteca de mídia.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {libraryAssets.map((asset) => {
                    const isSelected = backgroundLibrarySelection[libraryModalVariant] === asset.id
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setBackgroundLibrarySelection((current) => ({ ...current, [libraryModalVariant]: asset.id }))}
                        className={cn(
                          'overflow-hidden rounded-[16px] border bg-white text-left transition-all',
                          isSelected ? 'border-[#1398B7] ring-2 ring-[#1398B7]/20' : 'border-[#D8E6EB] hover:border-[#B8D8E1]',
                        )}
                      >
                        <div className="aspect-[16/9] w-full bg-[#EAF2F5]">
                          {asset.public_url ? <img src={asset.public_url} alt={asset.alt ?? 'Imagem'} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="space-y-1 px-3 py-2">
                          <p className="truncate text-xs font-black text-[#15323b]">{asset.alt ?? 'Imagem sem nome'}</p>
                          <p className="text-[11px] font-semibold text-[#5F7077]">{new Date(asset.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#D8E6EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsLibraryModalOpen(false)} className="h-11 w-full rounded-xl border-[#D8E6EB] sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  handleBackgroundLibraryApply(libraryModalVariant)
                  setIsLibraryModalOpen(false)
                }}
                disabled={!backgroundLibrarySelection[libraryModalVariant]}
                className="h-11 w-full rounded-xl bg-[#1398B7] px-4 text-center text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-[#1089A5] sm:w-auto"
              >
                Usar imagem selecionada
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Home</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Banners</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
            Cadastre o carrossel principal da home, organize a ordem dos slides e defina manualmente quais banners ficam ativos no site.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isImmersiveMode ? (
            <Button type="button" variant="outline" onClick={() => void handleExitImmersiveMode()} className="rounded-2xl border-[#D8E6EB]">
              <X className="mr-2 h-4 w-4" />
              Fechar tela cheia
            </Button>
          ) : null}
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
              <div className="flex items-center gap-2">
                <select
                  value={selectedLocationKey}
                  onChange={(event) => setSelectedLocationKey(event.target.value)}
                  className="h-9 rounded-xl border border-[#D8E6EB] bg-white px-3 text-xs font-black uppercase tracking-[0.12em] text-[#15323b]"
                >
                  {locationKeys.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={() => void handleCreateCarousel()} className="h-9 rounded-xl border-[#D8E6EB] px-3 text-[10px] font-black uppercase tracking-[0.12em]">
                  Novo carrossel
                </Button>
              </div>
              <div className="rounded-full bg-[#E8F6FA] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#1398B7]">
                {selectedLocationKey}
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
                      'relative h-full rounded-[24px] border p-4 transition-all',
                      isSelected ? 'border-[#1398B7] bg-[#E8F6FA]' : 'border-[#D8E6EB] bg-[#F8FBFC] hover:border-[#B8D8E1]',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Excluir ${banner.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDeleteBanner(banner)
                      }}
                      disabled={saving}
                      className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => maybeChangeSelection(banner.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3 pr-10">
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

            <div className="mt-6 rounded-[20px] border border-[#D8E6EB] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Exibicao do carrossel</p>
              <p className="mt-1 text-xs font-semibold text-[#5F7077]">Defina em quais paginas e locais este carrossel deve aparecer.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={targetPageKey}
                  onChange={(event) => setTargetPageKey(event.target.value as SitePageKey)}
                  className="h-9 rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-xs font-semibold text-[#15323b]"
                >
                  {pageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select
                  value={targetPlacementKey}
                  onChange={(event) => setTargetPlacementKey(event.target.value as SiteBannerPlacementKey)}
                  className="h-9 rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] px-3 text-xs font-semibold text-[#15323b]"
                >
                  <option value="hero">Hero</option>
                  <option value="mid">Meio da pagina</option>
                  <option value="footer">Rodape da pagina</option>
                </select>
                <Button type="button" variant="outline" onClick={() => void handleAddCarouselTarget()} disabled={saving} className="h-9 rounded-xl border-[#D8E6EB] px-3 text-[10px] font-black uppercase tracking-[0.12em]">
                  Adicionar destino
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {carouselTargets.length === 0 ? (
                  <span className="text-xs font-semibold text-[#5F7077]">Nenhum destino configurado para este carrossel.</span>
                ) : carouselTargets.map((target) => (
                  <span key={target.id} className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#15323b]">
                    {target.pageKey} / {target.placementKey}
                    <button type="button" onClick={() => void handleRemoveCarouselTarget(target.id)} className="text-rose-600">x</button>
                  </span>
                ))}
              </div>
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
                    Base de desktop: 1920px de largura.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => setDraft(selectedBanner ? cloneBanner(selectedBanner) : null)} disabled={!isDirty || saving} className="rounded-2xl border-[#D8E6EB]">
                    Reverter alteracoes
                  </Button>
                  <Button type="button" variant="outline" onClick={handleAlignAllInsideCanvas} disabled={saving} className="rounded-2xl border-[#D8E6EB]">
                    Alinhar no canvas
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsVersionsModalOpen(true)} disabled={saving} className="rounded-2xl border-[#D8E6EB]">
                    <History className="mr-2 h-4 w-4" />
                    Revisoes
                  </Button>
                  <Button type="button" onClick={() => void handleSaveBanner()} disabled={saving || uploadingBackground !== null} className="rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]">
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
                          Arraste os blocos diretamente sobre a arte para reposicionar os elementos no layout {activeLayoutLabel}.
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
                    <div className="mb-3 flex justify-end">
                      <Button type="button" variant="outline" onClick={() => setIsPreviewModalOpen(true)} className="rounded-2xl border-[#D8E6EB]">
                        <Maximize2 className="mr-2 h-4 w-4" />
                        Ampliar previa
                      </Button>
                    </div>
                    {renderPreviewCanvas(stageRef, stageContentRef)}
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
                        <p className="mt-2 text-xs font-semibold text-[#7C8E94]">Use uma arte para desktop e outra para mobile. Se o mobile nao tiver imagem propria, ele herda a do desktop.</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {([
                            {
                              variant: 'desktop' as const,
                              label: 'Desktop',
                              value: draft.backgroundUrl,
                            },
                            {
                              variant: 'mobile' as const,
                              label: 'Mobile',
                              value: draft.backgroundUrlMobile || draft.backgroundUrl,
                            },
                          ]).map((field) => (
                            <div key={field.variant} className="min-w-0 rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">{field.label}</p>
                              <p className="mt-2 truncate text-sm font-semibold text-[#15323b]">{field.value || 'Nenhuma imagem definida'}</p>
                              <label className="mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#1398B7] px-3 text-center text-[11px] font-black uppercase tracking-[0.08em] text-white hover:bg-[#1089A5]">
                                <ImagePlus className="mr-2 h-4 w-4" />
                                {uploadingBackground === field.variant ? 'Enviando...' : `Trocar ${field.label.toLowerCase()}`}
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,image/*"
                                  disabled={uploadingBackground !== null}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null
                                    void handleBackgroundUpload(field.variant, file)
                                    event.currentTarget.value = ''
                                  }}
                                  className="sr-only"
                                />
                              </label>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenLibraryModal(field.variant)}
                                disabled={loadingLibraryAssets || uploadingBackground !== null}
                                className="mt-2 h-10 w-full rounded-2xl border-[#D8E6EB] px-3 text-[11px] font-black uppercase tracking-[0.08em] whitespace-normal leading-tight"
                              >
                                Abrir biblioteca de midia
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleRemoveBackgroundImage(field.variant)}
                                disabled={uploadingBackground !== null || !field.value}
                                className="mt-2 h-10 w-full rounded-2xl border-[#F0C8CE] bg-white px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#A63A4B] hover:bg-[#FFF4F6] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Remover imagem
                              </Button>
                              <div className="mt-3 grid min-w-0 gap-2">
                                <label className="grid min-w-0 gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5F7077]">Posicao</span>
                                  <select
                                    value={field.variant === 'desktop' ? draft.backgroundDesktop.position : draft.backgroundMobile.position}
                                    onChange={(event) => setDraft((current) => current ? ({
                                      ...current,
                                      backgroundDesktop: field.variant === 'desktop'
                                        ? { ...current.backgroundDesktop, position: event.target.value as SiteBannerBackgroundPosition }
                                        : current.backgroundDesktop,
                                      backgroundMobile: field.variant === 'mobile'
                                        ? { ...current.backgroundMobile, position: event.target.value as SiteBannerBackgroundPosition }
                                        : current.backgroundMobile,
                                    }) : current)}
                                    className="h-10 w-full min-w-0 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-xs font-semibold text-[#15323b] outline-none"
                                  >
                                    {BACKGROUND_POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                </label>
                                <label className="grid min-w-0 gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5F7077]">Ajuste (size)</span>
                                  <select
                                    value={field.variant === 'desktop' ? draft.backgroundDesktop.size : draft.backgroundMobile.size}
                                    onChange={(event) => setDraft((current) => current ? ({
                                      ...current,
                                      backgroundDesktop: field.variant === 'desktop'
                                        ? { ...current.backgroundDesktop, size: event.target.value as SiteBannerBackgroundSize }
                                        : current.backgroundDesktop,
                                      backgroundMobile: field.variant === 'mobile'
                                        ? { ...current.backgroundMobile, size: event.target.value as SiteBannerBackgroundSize }
                                        : current.backgroundMobile,
                                    }) : current)}
                                    className="h-10 w-full min-w-0 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-xs font-semibold text-[#15323b] outline-none"
                                  >
                                    {BACKGROUND_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                </label>
                                <label className="grid min-w-0 gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5F7077]">Repeticao</span>
                                  <select
                                    value={field.variant === 'desktop' ? draft.backgroundDesktop.repeat : draft.backgroundMobile.repeat}
                                    onChange={(event) => setDraft((current) => current ? ({
                                      ...current,
                                      backgroundDesktop: field.variant === 'desktop'
                                        ? { ...current.backgroundDesktop, repeat: event.target.value as SiteBannerBackgroundRepeat }
                                        : current.backgroundDesktop,
                                      backgroundMobile: field.variant === 'mobile'
                                        ? { ...current.backgroundMobile, repeat: event.target.value as SiteBannerBackgroundRepeat }
                                        : current.backgroundMobile,
                                    }) : current)}
                                    className="h-10 w-full min-w-0 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-xs font-semibold text-[#15323b] outline-none"
                                  >
                                    {BACKGROUND_REPEAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
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
                      title={`Composicao ${activeLayoutLabel}`}
                      summary={`Ajuste titulos e textos no layout ${activeLayoutLabel}, mantendo o preview ao lado.`}
                      open={expandedCards.composition}
                      onToggle={() => toggleCard('composition')}
                    >
                    <div className="grid gap-3">
                      <div className="rounded-[18px] border border-[#D8E6EB] bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Altura do banner</p>
                        <p className="mt-1 text-[10px] font-semibold text-[#7C8E94]">A largura de referencia do desktop e 1920px. No mobile, use 420px como base recomendada.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Desktop (px)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              min={320}
                              max={1200}
                              step={1}
                              value={heightDesktopInput}
                              onChange={(event) => setHeightDesktopInput(event.target.value)}
                              onBlur={() => commitBannerHeight('heightDesktop', heightDesktopInput)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur()
                                }
                              }}
                              className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                            />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Mobile (px)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              min={320}
                              max={1200}
                              step={1}
                              value={heightMobileInput}
                              onChange={(event) => setHeightMobileInput(event.target.value)}
                              onBlur={() => commitBannerHeight('heightMobile', heightMobileInput)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur()
                                }
                              }}
                              className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                            />
                          </label>
                        </div>
                      </div>
                      {(['title', 'subtitle', 'body'] as const).map((layoutKey) => {
                        const item = activeLayout?.[layoutKey] ?? draft.layoutDesktop[layoutKey]
                        const layoutCardKey = `layout-${layoutKey}`
                        const defaultTextColor = getThemeTextColor(draft.themePreset, layoutKey)

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
                            <LayoutControls
                              item={item}
                              labelPrefix={activeLayoutLabel}
                              onVisibleChange={(visible) => setLayoutItem(layoutKey, (current) => ({ ...current, visible }))}
                              onWidthChange={(width) => setLayoutItem(layoutKey, (current) => applyWidthWithinCanvas(current, width))}
                              onZIndexChange={(nextValue) => setLayoutItem(layoutKey, (current) => ({ ...current, zIndex: nextValue }))}
                            />

                            <ColorField
                              label="Cor do texto"
                              value={draft.elementStyles[layoutKey].textColor}
                              fallback={defaultTextColor}
                              onChange={(value) => setElementStyle(layoutKey, (current) => ({ ...current, textColor: value }))}
                            />
                            <label className="grid gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Fonte (font-family)</span>
                              <input
                                value={draft.elementStyles[layoutKey].fontFamily ?? ''}
                                onChange={(event) => setElementStyle(layoutKey, (current) => ({ ...current, fontFamily: event.target.value.trim() || undefined }))}
                                placeholder="Ex.: var(--font-readex), Readex Pro"
                                className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                              />
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tamanho (px)</span>
                                <input
                                  type="number"
                                  min={10}
                                  max={120}
                                  step={1}
                                  value={draft.elementStyles[layoutKey].fontSize ?? ''}
                                  onChange={(event) => {
                                    const raw = Number(event.target.value)
                                    setElementStyle(layoutKey, (current) => ({ ...current, fontSize: Number.isFinite(raw) && raw > 0 ? raw : undefined }))
                                  }}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Peso (100-900)</span>
                                <input
                                  type="number"
                                  min={100}
                                  max={900}
                                  step={100}
                                  value={draft.elementStyles[layoutKey].fontWeight ?? ''}
                                  onChange={(event) => {
                                    const raw = Number(event.target.value)
                                    setElementStyle(layoutKey, (current) => ({ ...current, fontWeight: Number.isFinite(raw) && raw >= 100 ? raw : undefined }))
                                  }}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                />
                              </label>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Espaçamento (px)</span>
                                <input
                                  type="number"
                                  min={-10}
                                  max={30}
                                  step={0.1}
                                  value={draft.elementStyles[layoutKey].letterSpacing ?? ''}
                                  onChange={(event) => {
                                    const raw = Number(event.target.value)
                                    setElementStyle(layoutKey, (current) => ({ ...current, letterSpacing: Number.isFinite(raw) ? raw : undefined }))
                                  }}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Alinhamento horizontal</span>
                                <select
                                  value={draft.elementStyles[layoutKey].textAlign ?? ''}
                                  onChange={(event) => {
                                    const value = event.target.value as 'left' | 'center' | 'right' | ''
                                    setElementStyle(layoutKey, (current) => ({ ...current, textAlign: value || undefined }))
                                  }}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                >
                                  <option value="">Padrao</option>
                                  <option value="left">Esquerda</option>
                                  <option value="center">Centro</option>
                                  <option value="right">Direita</option>
                                </select>
                              </label>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Alinhamento vertical</span>
                                <select
                                  value={draft.elementStyles[layoutKey].verticalAlign ?? ''}
                                  onChange={(event) => {
                                    const value = event.target.value as 'top' | 'middle' | 'bottom' | ''
                                    setElementStyle(layoutKey, (current) => ({ ...current, verticalAlign: value || undefined }))
                                  }}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                >
                                  <option value="">Topo</option>
                                  <option value="top">Topo</option>
                                  <option value="middle">Centro</option>
                                  <option value="bottom">Base</option>
                                </select>
                              </label>
                              <label className="grid gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">EspaÃ§amento (px)</span>
                                <input
                                  type="number"
                                  min={-10}
                                  max={30}
                                  step={0.1}
                                  value={draft.elementStyles[layoutKey].letterSpacing ?? ''}
                                  onChange={(event) => {
                                    const raw = Number(event.target.value)
                                    setElementStyle(layoutKey, (current) => ({ ...current, letterSpacing: Number.isFinite(raw) ? raw : undefined }))
                                  }}
                                  className="h-11 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                                />
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() => setElementStyle(layoutKey, (current) => ({ ...current, textColor: undefined }))}
                              className="inline-flex h-9 w-full min-w-0 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white px-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#5F7077] hover:bg-[#F2F7F9]"
                            >
                              Usar cor do preset
                            </button>
                            <button
                              type="button"
                              onClick={() => setElementStyle(layoutKey, (current) => ({
                                ...current,
                                fontFamily: undefined,
                                fontSize: undefined,
                                fontWeight: undefined,
                                letterSpacing: undefined,
                                textAlign: undefined,
                                verticalAlign: undefined,
                              }))}
                              className="inline-flex h-9 w-full min-w-0 items-center justify-center rounded-xl border border-[#D8E6EB] bg-white px-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#5F7077] hover:bg-[#F2F7F9]"
                            >
                              Limpar tipografia customizada
                            </button>
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
                      const layoutItem = activeLayout?.[key] ?? draft.layoutDesktop[key]

                      return (
                        <CollapsibleCard
                          key={key}
                          title={title}
                          summary={`Defina texto, destino, cores e posicao no layout ${activeLayoutLabel}.`}
                          open={expandedCards[ctaCardKey]}
                          onToggle={() => toggleCard(ctaCardKey)}
                        >
                          <div className="flex flex-col items-start gap-3">
                            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">
                              <input
                                type="checkbox"
                                checked={cta?.visible ?? false}
                                onChange={(event) => {
                                  const checked = event.target.checked
                                  setCta(key, (current) => {
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
                                      visible: checked,
                                    }
                                  })
                                  setLayoutItem(key, (current) => ({ ...current, visible: checked }))
                                }}
                              />
                              Usar no banner
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <LayoutControls
                              item={layoutItem}
                              labelPrefix={activeLayoutLabel}
                              onVisibleChange={(visible) => {
                                setLayoutItem(key, (current) => ({ ...current, visible }))
                                setCta(key, (current) => current ? { ...current, visible } : current)
                              }}
                              onWidthChange={(width) => setLayoutItem(key, (current) => applyWidthWithinCanvas(current, width))}
                              onZIndexChange={(nextValue) => setLayoutItem(key, (current) => ({ ...current, zIndex: nextValue }))}
                            />

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
