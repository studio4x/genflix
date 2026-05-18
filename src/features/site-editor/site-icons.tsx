import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  BrainCircuit,
  BriefcaseBusiness,
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  HeartPulse,
  Landmark,
  Link as LinkIcon,
  MonitorPlay,
  Scale,
  Sigma,
  Sparkles,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SiteIconOption {
  value: string
  label: string
  icon: LucideIcon
}

export const SITE_ICON_OPTIONS: SiteIconOption[] = [
  { value: 'heart-pulse', label: 'Saude', icon: HeartPulse },
  { value: 'scale', label: 'Juridicos', icon: Scale },
  { value: 'sigma', label: 'Exatas', icon: Sigma },
  { value: 'briefcase-business', label: 'Gestao', icon: BriefcaseBusiness },
  { value: 'landmark', label: 'Humanas', icon: Landmark },
  { value: 'brain-circuit', label: 'Psicanalise / Psicologia', icon: BrainCircuit },
  { value: 'sparkles', label: 'Interesse geral', icon: Sparkles },
  { value: 'download', label: 'Download', icon: Download },
  { value: 'external-link', label: 'Link externo', icon: ExternalLink },
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'file-text', label: 'Documento', icon: FileText },
  { value: 'file-image', label: 'Imagem', icon: FileImage },
  { value: 'file-archive', label: 'Arquivo compactado', icon: FileArchive },
  { value: 'folder-open', label: 'Pasta', icon: FolderOpen },
  { value: 'graduation-cap', label: 'Estudo', icon: GraduationCap },
  { value: 'headphones', label: 'Audio', icon: Headphones },
  { value: 'monitor-play', label: 'Video', icon: MonitorPlay },
]

const SITE_ICON_MAP = new Map(SITE_ICON_OPTIONS.map((item) => [item.value, item.icon]))
const SVG_INLINE_CACHE = new Map<string, string>()

function normalizeIconColor(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function normalizeIconSize(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return undefined
  }

  const numericValue = Number(value)
  return Math.min(36, Math.max(12, numericValue))
}

function isSvgIconUrl(value: string) {
  if (value.trim() === '') {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.pathname.toLowerCase().endsWith('.svg')
  } catch {
    return value.split('?')[0]?.toLowerCase().endsWith('.svg') ?? false
  }
}

function canUseCssMaskForIcon(url: string) {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return true
  }

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined)
    if (typeof window === 'undefined') {
      return false
    }
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

function normalizeSvgForCurrentColor(svgText: string) {
  return svgText
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<svg\b([^>]*)>/i, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet">')
    .replace(/\b(fill|stroke)=["'](#000000|#000|black|rgb\(0[\s,]+0[\s,]+0\)|rgba\(0[\s,]+0[\s,]+0[\s,]+1\))["']/gi, '$1="currentColor"')
    .replace(/\b(fill|stroke)\s*:\s*(#000000|#000|black|rgb\(0[\s,]+0[\s,]+0\)|rgba\(0[\s,]+0[\s,]+0[\s,]+1\))/gi, '$1:currentColor')
}

function ColorizedRemoteSvgIcon({
  iconImageUrl,
  iconAlt,
  iconColor,
  className,
  sizeStyle,
}: {
  iconImageUrl: string
  iconAlt: string
  iconColor: string
  className?: string
  sizeStyle?: { width: string; height: string }
}) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(() => SVG_INLINE_CACHE.get(iconImageUrl) ?? null)

  useEffect(() => {
    let isMounted = true

    const cached = SVG_INLINE_CACHE.get(iconImageUrl)
    if (cached) {
      setSvgMarkup(cached)
      return () => {
        isMounted = false
      }
    }

    setSvgMarkup(null)

    void fetch(iconImageUrl)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`SVG fetch failed: ${response.status}`))))
      .then((svgText) => {
        if (!isMounted) return
        const normalized = normalizeSvgForCurrentColor(svgText)
        SVG_INLINE_CACHE.set(iconImageUrl, normalized)
        setSvgMarkup(normalized)
      })
      .catch(() => {
        if (!isMounted) return
        setSvgMarkup(null)
      })

    return () => {
      isMounted = false
    }
  }, [iconImageUrl])

  const inlineMarkup = useMemo(() => {
    if (svgMarkup) return svgMarkup
    if (canUseCssMaskForIcon(iconImageUrl)) return null
    return null
  }, [iconImageUrl, svgMarkup])

  if (!inlineMarkup) {
    return (
      <img
        src={iconImageUrl}
        alt={iconAlt}
        className={cn('block h-4 w-4 object-contain', className)}
        style={sizeStyle}
      />
    )
  }

  return (
    <span
      aria-label={iconAlt}
      role="img"
      className={cn('block h-4 w-4 overflow-hidden', className)}
      style={{
        color: iconColor,
        ...sizeStyle,
      }}
      dangerouslySetInnerHTML={{ __html: inlineMarkup }}
    />
  )
}

export function renderSiteIcon(iconKey: string | null | undefined, className?: string, iconColor?: string | null) {
  const Icon = SITE_ICON_MAP.get(iconKey ?? '') ?? LinkIcon
  const resolvedColor = normalizeIconColor(iconColor)
  return <Icon className={cn('h-4 w-4', className)} style={resolvedColor ? { color: resolvedColor } : undefined} />
}

export function renderSiteIconVisual(input: {
  iconKey?: string | null
  iconImageUrl?: string | null
  iconAlt?: string | null
  iconColor?: string | null
  iconImageMimeType?: string | null
  iconSize?: number | null
  className?: string
}) {
  const iconColor = normalizeIconColor(input.iconColor)
  const iconImageUrl = typeof input.iconImageUrl === 'string' ? input.iconImageUrl.trim() : ''
  const iconKey = typeof input.iconKey === 'string' ? input.iconKey.trim() : ''
  const iconImageMimeType = typeof input.iconImageMimeType === 'string' ? input.iconImageMimeType.trim().toLowerCase() : ''
  const isSvgIcon = iconImageMimeType === 'image/svg+xml' || isSvgIconUrl(iconImageUrl)
  const iconSize = normalizeIconSize(input.iconSize)
  const sizeStyle = iconSize ? { width: `${iconSize}px`, height: `${iconSize}px` } : undefined

  if (iconImageUrl !== '') {
    if (isSvgIcon && iconColor) {
      return (
        <ColorizedRemoteSvgIcon
          iconImageUrl={iconImageUrl}
          iconAlt={input.iconAlt ?? ''}
          iconColor={iconColor}
          className={input.className}
          sizeStyle={sizeStyle}
        />
      )
    }

    return (
      <img
        src={iconImageUrl}
        alt={input.iconAlt ?? ''}
        className={cn('block h-4 w-4 object-contain', input.className)}
        style={sizeStyle}
      />
    )
  }

  if (iconKey !== '') {
    const Icon = SITE_ICON_MAP.get(iconKey) ?? LinkIcon
    return (
      <Icon
        className={cn('h-4 w-4', input.className)}
        style={{
          ...(iconColor ? { color: iconColor } : {}),
          ...(sizeStyle ?? {}),
        }}
      />
    )
  }

  const FallbackIcon = SITE_ICON_MAP.get(input.iconKey ?? '') ?? LinkIcon
  return (
    <FallbackIcon
      className={cn('h-4 w-4', input.className)}
      style={{
        ...(iconColor ? { color: iconColor } : {}),
        ...(sizeStyle ?? {}),
      }}
    />
  )
}

export function getSiteIconOption(iconKey: string | null | undefined) {
  return SITE_ICON_OPTIONS.find((item) => item.value === iconKey) ?? null
}
