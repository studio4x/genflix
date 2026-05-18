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
const SVG_DATA_URL_CACHE = new Map<string, string>()

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

function svgToDataUrl(svg: string) {
  const encoded = encodeURIComponent(svg)
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
  return `data:image/svg+xml;utf8,${encoded}`
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
  const [resolvedMaskUrl, setResolvedMaskUrl] = useState<string | null>(() => SVG_DATA_URL_CACHE.get(iconImageUrl) ?? null)

  useEffect(() => {
    let isMounted = true

    const cached = SVG_DATA_URL_CACHE.get(iconImageUrl)
    if (cached) {
      setResolvedMaskUrl(cached)
      return () => {
        isMounted = false
      }
    }

    setResolvedMaskUrl(null)

    void fetch(iconImageUrl)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`SVG fetch failed: ${response.status}`))))
      .then((svgText) => {
        if (!isMounted) return
        const dataUrl = svgToDataUrl(svgText)
        SVG_DATA_URL_CACHE.set(iconImageUrl, dataUrl)
        setResolvedMaskUrl(dataUrl)
      })
      .catch(() => {
        if (!isMounted) return
        setResolvedMaskUrl(null)
      })

    return () => {
      isMounted = false
    }
  }, [iconImageUrl])

  const maskUrl = useMemo(() => {
    if (resolvedMaskUrl) return resolvedMaskUrl
    if (canUseCssMaskForIcon(iconImageUrl)) return iconImageUrl
    return null
  }, [iconImageUrl, resolvedMaskUrl])

  if (!maskUrl) {
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
      className={cn('block h-4 w-4', className)}
      style={{
        backgroundColor: iconColor,
        ...sizeStyle,
        maskImage: `url("${maskUrl}")`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url("${maskUrl}")`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
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
