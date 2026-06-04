export interface BrandingAssetValue {
    src: string;
    alt?: string | null;
    asset_id?: string | null;
    mime_type?: string | null;
}
export interface SiteBranding {
    logoLight: BrandingAssetValue | null;
    logoDark: BrandingAssetValue | null;
    favicon: BrandingAssetValue | null;
}
export interface PdfWatermarkSettings {
    id: number;
    logo_asset_id: string | null;
    opacity_percent: number;
    size_percent: number;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}
export interface PdfWatermarkSettingsView extends PdfWatermarkSettings {
    logo: BrandingAssetValue | null;
}
export type BrandingSlotKey = keyof SiteBranding;
export const brandingEntryKeys: Record<BrandingSlotKey, string> = {
    logoLight: 'global.branding.logoLight',
    logoDark: 'global.branding.logoDark',
    favicon: 'global.branding.favicon',
};
export const pdfWatermarkSettingsDefaults: PdfWatermarkSettings = {
    id: 1,
    logo_asset_id: null,
    opacity_percent: 8,
    size_percent: 100,
    updated_by: null,
    created_at: '',
    updated_at: '',
};
export const defaultSiteBranding: SiteBranding = {
    logoLight: null,
    logoDark: null,
    favicon: null,
};
export function isBrandingAssetValue(value: unknown): value is BrandingAssetValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return typeof (value as BrandingAssetValue).src === 'string';
}
