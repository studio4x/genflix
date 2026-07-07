const SITE_ASSET_BUCKET = 'site-assets';
const SITE_ASSET_PROXY_PATH = '/functions/v1/public-site-asset';
const R2_HOST_PATTERNS = [/\.r2\.cloudflarestorage\.com$/i, /\.r2\.dev$/i];

type SiteAssetLike = {
    storage_path: string;
    public_url: string | null;
};

function trimToNull(value: string | null | undefined) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
}

function getDefaultSupabaseUrl() {
    return trimToNull(import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
}

function normalizeSupabaseUrl(value?: string | null) {
    return (trimToNull(value) ?? '').replace(/\/+$/, '');
}

function normalizeSiteAssetStoragePath(value: string | null | undefined) {
    const normalized = trimToNull(value)?.replace(/^\/+/, '') ?? '';
    if (!normalized) {
        return '';
    }
    if (/^[a-z]+:\/\//i.test(normalized)) {
        return '';
    }
    if (normalized.startsWith(`${SITE_ASSET_BUCKET}/http://`) || normalized.startsWith(`${SITE_ASSET_BUCKET}/https://`)) {
        return '';
    }
    if (normalized.startsWith(`${SITE_ASSET_BUCKET}/`)) {
        return normalized;
    }
    if (!normalized.includes('/')) {
        return '';
    }
    return `${SITE_ASSET_BUCKET}/${normalized}`;
}

function extractSiteAssetStoragePathFromSupabaseUrl(parsedUrl: URL, supabaseUrl: string) {
    if (!supabaseUrl) {
        return null;
    }
    let supabaseOrigin = '';
    try {
        supabaseOrigin = new URL(supabaseUrl).origin;
    }
    catch {
        return null;
    }
    if (parsedUrl.origin !== supabaseOrigin) {
        return null;
    }
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/site-assets\/(.+)$/i);
    if (!match) {
        return null;
    }
    return normalizeSiteAssetStoragePath(decodeURIComponent(match[1]));
}

function extractSiteAssetStoragePathFromR2Url(parsedUrl: URL) {
    if (!R2_HOST_PATTERNS.some((pattern) => pattern.test(parsedUrl.hostname))) {
        return null;
    }
    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    const match = decodedPath.match(/\/(?:[^/]+\/)?(site-assets\/.+)$/i);
    if (!match) {
        return null;
    }
    return normalizeSiteAssetStoragePath(match[1]);
}

function extractSiteAssetStoragePathFromProxyUrl(parsedUrl: URL, supabaseUrl: string): string | null {
    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, '');
    if (!normalizedPathname.endsWith(SITE_ASSET_PROXY_PATH)) {
        return null;
    }
    const rawStoragePath = trimToNull(parsedUrl.searchParams.get('storage_path'));
    const normalizedStoragePath = normalizeSiteAssetStoragePath(rawStoragePath);
    if (normalizedStoragePath) {
        return normalizedStoragePath;
    }
    if (!rawStoragePath) {
        return null;
    }
    if (rawStoragePath.startsWith(`${SITE_ASSET_BUCKET}/http://`) || rawStoragePath.startsWith(`${SITE_ASSET_BUCKET}/https://`)) {
        return extractSiteAssetStoragePathFromUrl(rawStoragePath.slice(SITE_ASSET_BUCKET.length + 1), supabaseUrl);
    }
    return null;
}

export function buildSiteAssetPublicUrl(storagePath: string, supabaseUrl = getDefaultSupabaseUrl()) {
    const normalizedStoragePath = normalizeSiteAssetStoragePath(storagePath);
    const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseUrl);
    if (!normalizedStoragePath || !normalizedSupabaseUrl) {
        return '';
    }
    return `${normalizedSupabaseUrl}${SITE_ASSET_PROXY_PATH}?storage_path=${encodeURIComponent(normalizedStoragePath)}`;
}

export function extractSiteAssetStoragePathFromUrl(rawUrl: string, supabaseUrl = getDefaultSupabaseUrl()): string | null {
    const normalizedUrl = trimToNull(rawUrl);
    if (!normalizedUrl) {
        return null;
    }
    if (/^https?:\/\//i.test(normalizedUrl)) {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(normalizedUrl);
        }
        catch {
            return null;
        }
        return extractSiteAssetStoragePathFromProxyUrl(parsedUrl, supabaseUrl)
            ?? extractSiteAssetStoragePathFromSupabaseUrl(parsedUrl, supabaseUrl)
            ?? extractSiteAssetStoragePathFromR2Url(parsedUrl);
    }
    return normalizeSiteAssetStoragePath(normalizedUrl) || null;
}

export function normalizeSiteAssetPublicUrl(rawUrl: string | null | undefined, supabaseUrl = getDefaultSupabaseUrl()) {
    const normalizedUrl = trimToNull(rawUrl);
    if (!normalizedUrl) {
        return null;
    }
    const storagePath = extractSiteAssetStoragePathFromUrl(normalizedUrl, supabaseUrl);
    if (!storagePath) {
        return normalizedUrl;
    }
    return buildSiteAssetPublicUrl(storagePath, supabaseUrl) || normalizedUrl;
}

export function resolveSiteAssetPublicUrl(asset: SiteAssetLike, supabaseUrl = getDefaultSupabaseUrl()) {
    const proxiedUrl = buildSiteAssetPublicUrl(asset.storage_path, supabaseUrl);
    if (proxiedUrl) {
        return proxiedUrl;
    }
    return normalizeSiteAssetPublicUrl(asset.public_url, supabaseUrl);
}

export function normalizeSiteAssetRecord<TAsset extends SiteAssetLike>(asset: TAsset, supabaseUrl = getDefaultSupabaseUrl()) {
    return {
        ...asset,
        public_url: resolveSiteAssetPublicUrl(asset, supabaseUrl),
    };
}
