import type { GenflixPageKey } from '@/features/public/genflix-site-content'

export type SiteAppearanceScopeKey = GenflixPageKey | 'global'

export type SiteAppearanceValue = {
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

export type SiteAppearanceTheme = 'home' | 'light'

export const defaultSiteAppearance: SiteAppearanceValue = {
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

export function normalizeSiteAppearance(value: unknown, fallback: SiteAppearanceValue = defaultSiteAppearance): SiteAppearanceValue {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const readString = (field: keyof SiteAppearanceValue) => {
    const current = source[field]
    const fallbackValue = fallback[field]
    if (typeof current === 'string' && current.trim() !== '') {
      return current
    }

    return typeof fallbackValue === 'string' ? fallbackValue : undefined
  }

  const readNumber = (field: keyof SiteAppearanceValue) => {
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
    headerHeight: readString('headerHeight'),
    menuColor: readString('menuColor'),
    menuActiveColor: readString('menuActiveColor'),
    menuHoverColor: readString('menuHoverColor'),
    menuFontFamily: readString('menuFontFamily'),
    menuFontSize: readString('menuFontSize'),
    menuFontWeight: readString('menuFontWeight'),
    menuLetterSpacing: readString('menuLetterSpacing'),
    pageBackgroundColor: readString('pageBackgroundColor'),
  }
}

export function resolveSiteAppearancePageKey(currentPageKey?: GenflixPageKey): SiteAppearanceScopeKey {
  return currentPageKey ?? 'global'
}
