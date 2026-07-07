import type { SiteAsset } from '@/features/site-editor/types';

export type SiteAssetLibraryFilter = 'all' | 'raster' | 'svg' | 'gif' | 'avif' | 'other';

function getSiteAssetOriginalName(asset: SiteAsset) {
    const metadata = asset.metadata;
    if (metadata && typeof metadata === 'object' && typeof metadata.original_name === 'string') {
        return metadata.original_name.trim();
    }
    return '';
}

export function resolveSiteAssetLibraryLabel(asset: SiteAsset) {
    if (typeof asset.alt === 'string' && asset.alt.trim() !== '') {
        return asset.alt.trim();
    }
    const originalName = getSiteAssetOriginalName(asset);
    if (originalName) {
        return originalName.replace(/\.[a-z0-9]+$/i, '');
    }
    const segments = asset.storage_path.split('/');
    const fileName = segments[segments.length - 1] ?? 'asset';
    return fileName.replace(/\.[a-z0-9]+$/i, '');
}

export function resolveSiteAssetLibraryFilter(asset: SiteAsset): Exclude<SiteAssetLibraryFilter, 'all'> {
    const mimeType = (asset.mime_type ?? '').toLowerCase();
    const storagePath = asset.storage_path.toLowerCase();
    if (mimeType === 'image/svg+xml' || storagePath.endsWith('.svg')) {
        return 'svg';
    }
    if (mimeType === 'image/gif' || storagePath.endsWith('.gif')) {
        return 'gif';
    }
    if (mimeType === 'image/avif' || storagePath.endsWith('.avif')) {
        return 'avif';
    }
    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(storagePath)) {
        return 'raster';
    }
    return 'other';
}

export function matchesSiteAssetLibraryFilter(asset: SiteAsset, filter: SiteAssetLibraryFilter) {
    if (filter === 'all') {
        return true;
    }
    return resolveSiteAssetLibraryFilter(asset) === filter;
}

export function matchesSiteAssetLibrarySearch(asset: SiteAsset, search: string) {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
        return true;
    }
    const originalName = getSiteAssetOriginalName(asset);
    const haystack = [
        resolveSiteAssetLibraryLabel(asset),
        originalName,
        asset.storage_path,
        asset.mime_type ?? '',
    ]
        .join(' ')
        .toLowerCase();
    return haystack.includes(normalizedSearch);
}

export function filterSiteAssetLibrary(assets: SiteAsset[], search: string, filter: SiteAssetLibraryFilter) {
    return assets.filter((asset) => matchesSiteAssetLibraryFilter(asset, filter) && matchesSiteAssetLibrarySearch(asset, search));
}
