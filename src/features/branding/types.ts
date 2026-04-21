export interface BrandingAssetValue {
  src: string
  alt?: string | null
  asset_id?: string | null
  mime_type?: string | null
}

export interface SiteBranding {
  logoLight: BrandingAssetValue | null
  logoDark: BrandingAssetValue | null
  favicon: BrandingAssetValue | null
}

export type BrandingSlotKey = keyof SiteBranding

export const brandingEntryKeys: Record<BrandingSlotKey, string> = {
  logoLight: 'global.branding.logoLight',
  logoDark: 'global.branding.logoDark',
  favicon: 'global.branding.favicon',
}

export const defaultSiteBranding: SiteBranding = {
  logoLight: null,
  logoDark: null,
  favicon: null,
}

export function isBrandingAssetValue(value: unknown): value is BrandingAssetValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return typeof (value as BrandingAssetValue).src === 'string'
}
