import { supabase } from '@/services/supabase/client';
import { brandingEntryKeys, defaultSiteBranding, isBrandingAssetValue, pdfWatermarkSettingsDefaults, type BrandingAssetValue, type BrandingSlotKey, type PdfWatermarkSettings, type PdfWatermarkSettingsView, type SiteBranding, } from '@/features/branding/types';
const brandingKeyByEntry = Object.entries(brandingEntryKeys).reduce<Record<string, BrandingSlotKey>>((accumulator, [slotKey, entryKey]) => {
    accumulator[entryKey] = slotKey as BrandingSlotKey;
    return accumulator;
}, {});
const PDF_WATERMARK_SETTINGS_TABLE = 'pdf_watermark_settings';
const PDF_WATERMARK_DEFAULT_MAX_OPACITY = 100;
const PDF_WATERMARK_DEFAULT_MIN_SIZE = 25;
const PDF_WATERMARK_DEFAULT_MAX_SIZE = 300;
export function createBrandingAssetValue(input: {
    src: string;
    alt?: string | null;
    assetId?: string | null;
    mimeType?: string | null;
}): BrandingAssetValue {
    return {
        src: input.src,
        alt: input.alt ?? null,
        asset_id: input.assetId ?? null,
        mime_type: input.mimeType ?? null,
    };
}
export async function fetchSiteBranding() {
    const entryKeys = Object.values(brandingEntryKeys);
    const { data, error } = await supabase
        .from('site_content_entries')
        .select('entry_key, value, is_enabled')
        .eq('page_key', 'global')
        .in('entry_key', entryKeys)
        .eq('is_enabled', true);
    if (error) {
        throw error;
    }
    return (data ?? []).reduce<SiteBranding>((branding, row) => {
        const slotKey = brandingKeyByEntry[row.entry_key];
        if (!slotKey || !isBrandingAssetValue(row.value)) {
            return branding;
        }
        branding[slotKey] = row.value;
        return branding;
    }, { ...defaultSiteBranding });
}
function normalizePdfWatermarkSettingsRow(value: Partial<PdfWatermarkSettings> | null | undefined): PdfWatermarkSettings {
    return {
        ...pdfWatermarkSettingsDefaults,
        ...value,
        opacity_percent: Math.max(0, Math.min(PDF_WATERMARK_DEFAULT_MAX_OPACITY, Number(value?.opacity_percent ?? pdfWatermarkSettingsDefaults.opacity_percent))),
        size_percent: Math.max(PDF_WATERMARK_DEFAULT_MIN_SIZE, Math.min(PDF_WATERMARK_DEFAULT_MAX_SIZE, Number(value?.size_percent ?? pdfWatermarkSettingsDefaults.size_percent))),
        logo_asset_id: value?.logo_asset_id ?? null,
        updated_by: value?.updated_by ?? null,
        created_at: value?.created_at ?? '',
        updated_at: value?.updated_at ?? '',
    };
}
async function resolvePdfWatermarkLogo(logoAssetId: string | null): Promise<BrandingAssetValue | null> {
    if (!logoAssetId) {
        return null;
    }
    const { data, error } = await supabase
        .from('site_assets')
        .select('id, public_url, alt, mime_type')
        .eq('id', logoAssetId)
        .maybeSingle();
    if (error || !data) {
        return null;
    }
    if (!data.public_url) {
        return null;
    }
    return createBrandingAssetValue({
        src: data.public_url,
        alt: data.alt ?? null,
        assetId: data.id,
        mimeType: data.mime_type,
    });
}
export async function fetchPdfWatermarkSettings(): Promise<PdfWatermarkSettingsView> {
    const { data, error } = await supabase
        .from(PDF_WATERMARK_SETTINGS_TABLE)
        .select('id, logo_asset_id, opacity_percent, size_percent, updated_by, created_at, updated_at')
        .eq('id', 1)
        .maybeSingle();
    if (error) {
        throw error;
    }
    const settings = normalizePdfWatermarkSettingsRow(data as Partial<PdfWatermarkSettings> | null | undefined);
    return {
        ...settings,
        logo: await resolvePdfWatermarkLogo(settings.logo_asset_id),
    };
}
export async function updatePdfWatermarkSettings(input: {
    logoAssetId?: string | null;
    opacityPercent: number;
    sizePercent: number;
}) {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase
        .from(PDF_WATERMARK_SETTINGS_TABLE)
        .upsert({
        id: 1,
        logo_asset_id: input.logoAssetId ?? null,
        opacity_percent: Math.max(0, Math.min(PDF_WATERMARK_DEFAULT_MAX_OPACITY, Math.round(input.opacityPercent))),
        size_percent: Math.max(PDF_WATERMARK_DEFAULT_MIN_SIZE, Math.min(PDF_WATERMARK_DEFAULT_MAX_SIZE, Math.round(input.sizePercent))),
        updated_by: sessionData.session?.user.id ?? null,
    }, { onConflict: 'id' })
        .select('id, logo_asset_id, opacity_percent, size_percent, updated_by, created_at, updated_at')
        .single();
    if (error) {
        throw error;
    }
    const settings = normalizePdfWatermarkSettingsRow(data as Partial<PdfWatermarkSettings> | null | undefined);
    return {
        ...settings,
        logo: await resolvePdfWatermarkLogo(settings.logo_asset_id),
    } satisfies PdfWatermarkSettingsView;
}
