import { supabase } from '@/services/supabase/client';
import { brandingEntryKeys, defaultSiteBranding, isBrandingAssetValue, type BrandingAssetValue, type BrandingSlotKey, type SiteBranding, } from '@/features/branding/types';
const brandingKeyByEntry = Object.entries(brandingEntryKeys).reduce<Record<string, BrandingSlotKey>>((accumulator, [slotKey, entryKey]) => {
    accumulator[entryKey] = slotKey as BrandingSlotKey;
    return accumulator;
}, {});
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
