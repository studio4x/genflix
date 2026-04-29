import type { GenflixPageKey } from '@/features/public/genflix-site-content'

export type SiteAppearanceScopeKey = GenflixPageKey | 'global'

export type SiteAppearanceViewport = 'desktop' | 'tablet' | 'mobile'

export type SiteAppearanceScopeMode = 'page' | 'global'

export type SiteAppearanceResponsiveMode = 'linked' | 'split'

export type SiteAppearanceFields = {
  logoScale?: number
  headerHeight?: string
  menuColor?: string
  menuActiveColor?: string
  menuHoverColor?: string
  menuFontFamily?: string
  menuFontSize?: string
  menuFontWeight?: string
  menuLetterSpacing?: string
  pageBackgroundColor?: string
}

export type SiteAppearanceValue = SiteAppearanceFields & {
  scope?: SiteAppearanceScopeMode
  responsiveMode?: SiteAppearanceResponsiveMode
  variants?: Partial<Record<SiteAppearanceViewport, SiteAppearanceFields>>
}

export type NormalizedSiteAppearance = SiteAppearanceFields & {
  scope: SiteAppearanceScopeMode
  responsiveMode: SiteAppearanceResponsiveMode
  variants: Record<SiteAppearanceViewport, SiteAppearanceFields>
}

export type SiteAppearanceTheme = 'home' | 'light'

export const defaultSiteAppearance: SiteAppearanceFields = {
  logoScale: 1,
  headerHeight: '72px',
  menuColor: '#15323B',
  menuActiveColor: '#0A3640',
  menuHoverColor: '#0A3640',
  menuFontFamily: 'inherit',
  menuFontSize: '15px',
  menuFontWeight: '600',
  menuLetterSpacing: '-0.02em',
  pageBackgroundColor: '#F2F7F9',
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeCssLengthValue(value: unknown, fallback?: string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return fallback
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return `${trimmed}px`
    }

    return trimmed
  }

  return fallback
}

function normalizeSiteAppearanceFields(value: unknown, fallback: SiteAppearanceFields = defaultSiteAppearance): SiteAppearanceFields {
  const source = isStringRecord(value) ? value : {}

  const readString = (field: keyof SiteAppearanceFields) => {
    const current = source[field]
    const fallbackValue = fallback[field]
    if (typeof current === 'string' && current.trim() !== '') {
      return current
    }

    return typeof fallbackValue === 'string' ? fallbackValue : undefined
  }

  const readNumber = (field: keyof SiteAppearanceFields) => {
    const current = source[field]
    const fallbackValue = fallback[field]
    const numericValue = typeof current === 'number'
      ? current
      : typeof current === 'string' && current.trim() !== ''
        ? Number(current)
        : NaN

    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue
    }

    return typeof fallbackValue === 'number' ? fallbackValue : undefined
  }

  return {
    logoScale: readNumber('logoScale'),
    headerHeight: normalizeCssLengthValue(source.headerHeight, normalizeCssLengthValue(fallback.headerHeight, defaultSiteAppearance.headerHeight)),
    menuColor: readString('menuColor'),
    menuActiveColor: readString('menuActiveColor'),
    menuHoverColor: readString('menuHoverColor'),
    menuFontFamily: readString('menuFontFamily'),
    menuFontSize: normalizeCssLengthValue(source.menuFontSize, normalizeCssLengthValue(fallback.menuFontSize, defaultSiteAppearance.menuFontSize)),
    menuFontWeight: readString('menuFontWeight'),
    menuLetterSpacing: readString('menuLetterSpacing'),
    pageBackgroundColor: readString('pageBackgroundColor'),
  }
}

export function createDefaultSiteAppearance(theme: SiteAppearanceTheme): SiteAppearanceValue {
  if (theme === 'home') {
    return {
      ...defaultSiteAppearance,
      menuColor: '#FFFFFF',
      menuActiveColor: '#FFFFFF',
      menuHoverColor: '#FFFFFF',
    }
  }

  return defaultSiteAppearance
}

export function normalizeSiteAppearance(
  value: unknown,
  fallback: SiteAppearanceFields = defaultSiteAppearance,
  defaultScope: SiteAppearanceScopeMode = 'page',
): NormalizedSiteAppearance {
  const source = isStringRecord(value) ? value : {}
  const normalizedFallback = normalizeSiteAppearanceFields(fallback, defaultSiteAppearance)
  const base = normalizeSiteAppearanceFields(source, normalizedFallback)
  const scope = source.scope === 'global' || source.scope === 'page'
    ? source.scope
    : defaultScope
  const responsiveMode = source.responsiveMode === 'split' ? 'split' : 'linked'
  const variantsSource = isStringRecord(source.variants) ? source.variants : {}
  const desktop = normalizeSiteAppearanceFields(variantsSource.desktop, base)
  const tablet = normalizeSiteAppearanceFields(variantsSource.tablet, desktop)
  const mobile = normalizeSiteAppearanceFields(variantsSource.mobile, desktop)

  return {
    ...base,
    scope,
    responsiveMode,
    variants: {
      desktop,
      tablet,
      mobile,
    },
  }
}

export function resolveSiteAppearanceVariant(
  value: NormalizedSiteAppearance,
  viewport: SiteAppearanceViewport,
): SiteAppearanceFields {
  if (value.responsiveMode === 'split') {
    return value.variants[viewport]
  }

  return value.variants.desktop
}

export function buildSiteAppearanceValue(value: NormalizedSiteAppearance): SiteAppearanceValue {
  const desktop = value.variants.desktop
  const tablet = value.responsiveMode === 'split' ? value.variants.tablet : desktop
  const mobile = value.responsiveMode === 'split' ? value.variants.mobile : desktop

  return {
    scope: value.scope,
    responsiveMode: value.responsiveMode,
    ...desktop,
    variants: {
      desktop,
      tablet,
      mobile,
    },
  }
}

export function resolveSiteAppearancePageKey(currentPageKey?: GenflixPageKey): SiteAppearanceScopeKey {
  return currentPageKey ?? 'global'
}
