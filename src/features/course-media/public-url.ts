const COURSE_MEDIA_PROXY_PATH = '/api/public/course-media';
const COURSE_MEDIA_BUCKET = 'thumbnails';
const R2_HOST_PATTERNS = [/\.r2\.cloudflarestorage\.com$/i, /\.r2\.dev$/i];

const DEFAULT_COURSE_MEDIA_FIELDS = ['thumbnail_url', 'cover_image_url', 'logo_url', 'student_hero_image_url'] as const;

function trimToNull(value: string | null | undefined) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
}

function getDefaultSupabaseUrl() {
    return trimToNull(import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
}

function getDefaultPublicAppUrl() {
    if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
        return trimToNull(window.location.origin) ?? '';
    }
    return '';
}

function normalizeBaseUrl(value?: string | null) {
    return (trimToNull(value) ?? '').replace(/\/+$/, '');
}

function normalizeCourseMediaStoragePath(value: string | null | undefined) {
    const normalized = trimToNull(value)?.replace(/^\/+/, '') ?? '';
    if (!normalized) {
        return '';
    }
    if (/^[a-z]+:\/\//i.test(normalized)) {
        return '';
    }
    if (normalized.startsWith(`${COURSE_MEDIA_BUCKET}/http://`) || normalized.startsWith(`${COURSE_MEDIA_BUCKET}/https://`)) {
        return '';
    }
    return normalized;
}

function extractCourseMediaStoragePathFromSupabaseUrl(parsedUrl: URL, supabaseUrl: string) {
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
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/thumbnails\/(.+)$/i);
    if (!match) {
        return null;
    }
    return normalizeCourseMediaStoragePath(decodeURIComponent(match[1]));
}

function extractCourseMediaStoragePathFromR2Url(parsedUrl: URL) {
    if (!R2_HOST_PATTERNS.some((pattern) => pattern.test(parsedUrl.hostname))) {
        return null;
    }
    const normalizedPathname = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '');
    const segments = normalizedPathname.split('/').filter(Boolean);
    if (segments.length < 2) {
        return null;
    }
    return normalizeCourseMediaStoragePath(segments.slice(1).join('/'));
}

function extractCourseMediaStoragePathFromProxyUrl(parsedUrl: URL) {
    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, '');
    if (!normalizedPathname.endsWith(COURSE_MEDIA_PROXY_PATH)) {
        return null;
    }
    return normalizeCourseMediaStoragePath(parsedUrl.searchParams.get('storage_path'));
}

export function extractCourseMediaStoragePathFromUrl(rawUrl: string, supabaseUrl = getDefaultSupabaseUrl()): string | null {
    const normalizedUrl = trimToNull(rawUrl);
    if (!normalizedUrl) {
        return null;
    }
    if (normalizedUrl.startsWith('/')) {
        try {
            const baseUrl = getDefaultPublicAppUrl() || 'https://genflix-omega.vercel.app';
            const parsedUrl = new URL(normalizedUrl, baseUrl);
            return extractCourseMediaStoragePathFromProxyUrl(parsedUrl);
        }
        catch {
            return null;
        }
    }
    if (/^https?:\/\//i.test(normalizedUrl)) {
        try {
            const parsedUrl = new URL(normalizedUrl);
            return extractCourseMediaStoragePathFromProxyUrl(parsedUrl)
                ?? extractCourseMediaStoragePathFromSupabaseUrl(parsedUrl, supabaseUrl)
                ?? extractCourseMediaStoragePathFromR2Url(parsedUrl);
        }
        catch {
            return null;
        }
    }
    return normalizeCourseMediaStoragePath(normalizedUrl) || null;
}

export function buildCourseMediaPublicUrl(storagePath: string, publicAppUrl = getDefaultPublicAppUrl()) {
    const normalizedStoragePath = normalizeCourseMediaStoragePath(storagePath);
    if (!normalizedStoragePath) {
        return '';
    }
    const relativeUrl = `${COURSE_MEDIA_PROXY_PATH}?storage_path=${encodeURIComponent(normalizedStoragePath)}`;
    const normalizedPublicAppUrl = normalizeBaseUrl(publicAppUrl);
    if (!normalizedPublicAppUrl) {
        return relativeUrl;
    }
    return `${normalizedPublicAppUrl}${relativeUrl}`;
}

export function normalizeCourseMediaPublicUrl(rawUrl: string | null | undefined, publicAppUrl = getDefaultPublicAppUrl(), supabaseUrl = getDefaultSupabaseUrl()) {
    const normalizedUrl = trimToNull(rawUrl);
    if (!normalizedUrl) {
        return null;
    }
    const storagePath = extractCourseMediaStoragePathFromUrl(normalizedUrl, supabaseUrl);
    if (!storagePath) {
        return normalizedUrl;
    }
    return buildCourseMediaPublicUrl(storagePath, publicAppUrl) || normalizedUrl;
}

export function normalizeCourseMediaFields<TRecord extends object>(
    record: TRecord,
    fields: readonly string[] = DEFAULT_COURSE_MEDIA_FIELDS,
    publicAppUrl = getDefaultPublicAppUrl(),
    supabaseUrl = getDefaultSupabaseUrl(),
) {
    const nextRecord: Record<string, unknown> = { ...(record as Record<string, unknown>) };
    for (const field of fields) {
        const currentValue = nextRecord[field];
        if (typeof currentValue !== 'string') {
            continue;
        }
        nextRecord[field] = normalizeCourseMediaPublicUrl(currentValue, publicAppUrl, supabaseUrl);
    }
    return nextRecord as TRecord;
}
