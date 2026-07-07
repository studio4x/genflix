type ApiRequest = {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
    status: (statusCode: number) => ApiResponse;
    send: (body?: string) => void;
    json: (payload: unknown) => void;
    setHeader: (name: string, value: string) => void;
};

function getHeaderValue(value: string | string[] | undefined) {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }
    return null;
}

function getQueryValue(value: string | string[] | undefined) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (Array.isArray(value) && value.length > 0) {
        return String(value[0] ?? '').trim();
    }
    return '';
}

function getSupabaseFunctionUrl() {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
    if (!supabaseUrl) {
        throw new Error('Configuração ausente: SUPABASE_URL ou VITE_SUPABASE_URL.');
    }
    return `${supabaseUrl}/functions/v1/public-site-asset`;
}

function setSharedHeaders(res: ApiResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-requested-with');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
    res.status(statusCode);
    setSharedHeaders(res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const method = (req.method ?? 'GET').toUpperCase();

    if (method === 'OPTIONS') {
        res.status(204);
        setSharedHeaders(res);
        res.send('');
        return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
        jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        return;
    }

    const storagePath = getQueryValue(req.query?.storage_path);
    const assetId = getQueryValue(req.query?.asset_id);

    if (!storagePath && !assetId) {
        jsonResponse(res, 400, { error: 'storage_path ou asset_id obrigatorio.' });
        return;
    }

    try {
        const upstreamUrl = new URL(getSupabaseFunctionUrl());
        if (storagePath) {
            upstreamUrl.searchParams.set('storage_path', storagePath);
        }
        if (assetId) {
            upstreamUrl.searchParams.set('asset_id', assetId);
        }

        const apikey = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
        const response = await fetch(upstreamUrl, {
            method,
            redirect: 'manual',
            headers: {
                ...(apikey ? { apikey } : {}),
                ...(getHeaderValue(req.headers['user-agent']) ? { 'user-agent': getHeaderValue(req.headers['user-agent']) as string } : {}),
            },
        });

        setSharedHeaders(res);
        const cacheControl = response.headers.get('cache-control')?.trim() || 'public, max-age=300, s-maxage=300';
        res.setHeader('Cache-Control', cacheControl);

        const location = response.headers.get('location')?.trim() ?? '';
        if (response.status >= 300 && response.status < 400 && location) {
            res.setHeader('Location', location);
            res.status(response.status);
            res.send('');
            return;
        }

        const contentType = response.headers.get('content-type')?.trim() || 'application/json; charset=utf-8';
        res.setHeader('Content-Type', contentType);
        res.status(response.status);

        if (method === 'HEAD') {
            res.send('');
            return;
        }

        res.send(await response.text());
    }
    catch (error) {
        jsonResponse(res, 500, {
            error: error instanceof Error ? error.message : 'Erro inesperado ao resolver asset publico.',
        });
    }
}
