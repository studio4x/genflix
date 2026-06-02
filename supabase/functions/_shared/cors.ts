const DEFAULT_DEV_ORIGINS = new Set([
    'http://localhost:3000',
    'http://localhost:4173',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:5173',
]);
const CORS_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-requested-with';
function parseOriginsFromEnv(value: string | undefined) {
    return (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function stripTrailingSlash(value: string) {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}
function buildAllowedOrigins() {
    const allowed = new Set<string>(DEFAULT_DEV_ORIGINS);
    const appPublicUrl = stripTrailingSlash((Deno.env.get('APP_PUBLIC_URL') ?? '').trim());
    if (appPublicUrl) {
        allowed.add(appPublicUrl);
    }
    for (const origin of parseOriginsFromEnv(Deno.env.get('CORS_ALLOWED_ORIGINS'))) {
        allowed.add(stripTrailingSlash(origin));
    }
    return allowed;
}
const ALLOWED_ORIGINS = buildAllowedOrigins();
export function isAllowedOrigin(origin: string | null) {
    if (!origin) {
        return false;
    }
    return ALLOWED_ORIGINS.has(stripTrailingSlash(origin));
}
export function buildCorsHeaders(request: Request) {
    const requestOrigin = request.headers.get('origin');
    const allowedOrigin = isAllowedOrigin(requestOrigin)
        ? stripTrailingSlash(requestOrigin ?? '')
        : stripTrailingSlash((Deno.env.get('APP_PUBLIC_URL') ?? '').trim());
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
    };
}
