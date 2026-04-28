import type { GenflixPageKey } from '@/features/public/genflix-public-types'
import type { SitePageKey } from '@/features/site-editor/types'

export const HOME_HERO_BANNER_LOCATION = 'home-hero' as const

export type SiteBannerLocationKey = string

export type SiteBannerThemePreset = 'light-strong' | 'light-soft' | 'dark-soft'
export type SiteBannerTonePreset = 'solid' | 'warm' | 'surface'
export type SiteBannerLayoutKey = 'title' | 'subtitle' | 'body' | 'primaryCta' | 'secondaryCta'
export type SiteBannerColorKey = SiteBannerLayoutKey

export type SiteBannerPlacementKey = 'hero' | 'mid' | 'footer'

export interface SiteBannerCarouselTarget {
  id: string
  locationKey: SiteBannerLocationKey
  pageKey: SitePageKey
  placementKey: SiteBannerPlacementKey
}

export interface SiteBannerLayoutItem {
  x: number
  y: number
  width: number
  visible: boolean
  zIndex: number
}

export interface SiteBannerCta {
  label: string
  href: string
  isInternal: boolean
  openInNewTab: boolean
  tonePreset: SiteBannerTonePreset
  visible: boolean
  pageKey?: GenflixPageKey
}

export interface SiteBannerLayoutDesktop {
  title: SiteBannerLayoutItem
  subtitle: SiteBannerLayoutItem
  body: SiteBannerLayoutItem
  primaryCta: SiteBannerLayoutItem
  secondaryCta: SiteBannerLayoutItem
}

export type SiteBannerLayoutMobile = SiteBannerLayoutDesktop

export interface SiteBannerElementStyle {
  textColor?: string
  backgroundColor?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

export interface SiteBannerElementStyles {
  title: SiteBannerElementStyle
  subtitle: SiteBannerElementStyle
  body: SiteBannerElementStyle
  primaryCta: SiteBannerElementStyle
  secondaryCta: SiteBannerElementStyle
}

export interface SiteBanner {
  id: string
  locationKey: SiteBannerLocationKey
  name: string
  title: string
  subtitle: string
  body: string
  backgroundAssetId: string | null
  backgroundUrl: string
  themePreset: SiteBannerThemePreset
  layoutDesktop: SiteBannerLayoutDesktop
  layoutMobile: SiteBannerLayoutMobile
  heightDesktop: number
  heightMobile: number
  elementStyles: SiteBannerElementStyles
  primaryCta: SiteBannerCta | null
  secondaryCta: SiteBannerCta | null
  isActive: boolean
  sortOrder: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export const defaultBannerLayoutDesktop: SiteBannerLayoutDesktop = {
  title: { x: 0, y: 122, width: 40, visible: true, zIndex: 3 },
  subtitle: { x: 0, y: 410, width: 38, visible: true, zIndex: 3 },
  body: { x: 0, y: 532, width: 34, visible: false, zIndex: 3 },
  primaryCta: { x: 0, y: 638, width: 24, visible: true, zIndex: 4 },
  secondaryCta: { x: 210, y: 638, width: 24, visible: true, zIndex: 4 },
}

export const defaultBannerLayoutMobile: SiteBannerLayoutMobile = {
  title: { x: 0, y: 67, width: 84, visible: true, zIndex: 3 },
  subtitle: { x: 0, y: 291, width: 84, visible: true, zIndex: 3 },
  body: { x: 0, y: 381, width: 82, visible: false, zIndex: 3 },
  primaryCta: { x: 0, y: 459, width: 78, visible: true, zIndex: 4 },
  secondaryCta: { x: 0, y: 504, width: 78, visible: true, zIndex: 4 },
}

export const defaultBannerHeightDesktop = 760
export const defaultBannerHeightMobile = 560

export const defaultBannerElementStyles: SiteBannerElementStyles = {
  title: {},
  subtitle: {},
  body: {},
  primaryCta: {},
  secondaryCta: {},
}

export const defaultPrimaryBannerCta: SiteBannerCta = {
  label: 'Ja sou inscrito',
  href: '/login',
  isInternal: true,
  openInNewTab: false,
  tonePreset: 'solid',
  visible: true,
}

export const defaultSecondaryBannerCta: SiteBannerCta = {
  label: 'Quero me inscrever',
  href: '/criar-conta',
  isInternal: true,
  openInNewTab: false,
  tonePreset: 'surface',
  visible: true,
}

export const bannerThemePresetOptions: Array<{
  value: SiteBannerThemePreset
  label: string
  description: string
}> = [
  {
    value: 'light-strong',
    label: 'Claro sobre imagem escura',
    description: 'Heading branco com overlay mais fechado para leitura forte.',
  },
  {
    value: 'light-soft',
    label: 'Claro com overlay medio',
    description: 'Heading branco com imagem mais aparente e contraste equilibrado.',
  },
  {
    value: 'dark-soft',
    label: 'Escuro sobre imagem clara',
    description: 'Heading escuro com overlay claro para fotos mais luminosas.',
  },
]

export const bannerTonePresetOptions: Array<{
  value: SiteBannerTonePreset
  label: string
}> = [
  { value: 'solid', label: 'Primario azul' },
  { value: 'warm', label: 'Primario verde' },
  { value: 'surface', label: 'Superficie clara' },
]

export const bannerElementLabels: Record<SiteBannerLayoutKey, string> = {
  title: 'Titulo',
  subtitle: 'Subtitulo',
  body: 'Texto complementar',
  primaryCta: 'CTA principal',
  secondaryCta: 'CTA secundario',
}

export function createDefaultSiteBanner(
  sortOrder: number,
  locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION,
): Omit<SiteBanner, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'> {
  return {
    locationKey,
    name: `Banner ${sortOrder + 1}`,
    title: 'O conhecimento que a sua carreira estava esperando.',
    subtitle: 'As ferramentas de estudo para quem leva o aprendizado a serio.',
    body: '',
    backgroundAssetId: null,
    backgroundUrl: '/images/genflix/home/hero.jpg',
    themePreset: 'light-strong',
    layoutDesktop: structuredClone(defaultBannerLayoutDesktop),
    layoutMobile: structuredClone(defaultBannerLayoutMobile),
    heightDesktop: defaultBannerHeightDesktop,
    heightMobile: defaultBannerHeightMobile,
    elementStyles: structuredClone(defaultBannerElementStyles),
    primaryCta: { ...defaultPrimaryBannerCta },
    secondaryCta: { ...defaultSecondaryBannerCta },
    isActive: false,
    sortOrder,
  }
}

export function cloneBannerLayout(layout: SiteBannerLayoutDesktop): SiteBannerLayoutDesktop {
  return {
    title: { ...layout.title },
    subtitle: { ...layout.subtitle },
    body: { ...layout.body },
    primaryCta: { ...layout.primaryCta },
    secondaryCta: { ...layout.secondaryCta },
  }
}

export function cloneBannerElementStyles(styles: SiteBannerElementStyles): SiteBannerElementStyles {
  return {
    title: { ...styles.title },
    subtitle: { ...styles.subtitle },
    body: { ...styles.body },
    primaryCta: { ...styles.primaryCta },
    secondaryCta: { ...styles.secondaryCta },
  }
}

export function isBannerCta(value: unknown): value is SiteBannerCta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as SiteBannerCta
  return typeof candidate.label === 'string'
    && typeof candidate.href === 'string'
    && typeof candidate.isInternal === 'boolean'
    && typeof candidate.openInNewTab === 'boolean'
    && typeof candidate.tonePreset === 'string'
    && typeof candidate.visible === 'boolean'
}
