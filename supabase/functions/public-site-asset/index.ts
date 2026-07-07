import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSignedGetUrl, getSignedGetTtlSeconds, resolveStorageProvider, type StorageProvider } from '../_shared/storage-provider.ts';

const SITE_ASSETS_BUCKET = 'site-assets';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

type SiteAssetRow = {
    id: string;
    storage_path: string;
    public_url: string | null;
};

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return jsonResponse({ error: 'Metodo nao permitido.' }, 405);
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500);
        }

        const url = new URL(request.url);
        const storagePath = url.searchParams.get('storage_path')?.trim() ?? '';
        const assetId = url.searchParams.get('asset_id')?.trim() ?? '';

        if (!storagePath && !assetId) {
            return jsonResponse({ error: 'storage_path ou asset_id obrigatorio.' }, 400);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
        const asset = await findSiteAsset(supabaseAdmin, { storagePath, assetId });
        const resolvedStoragePath = asset?.storage_path ?? resolveFallbackStoragePath(storagePath);

        if (!resolvedStoragePath) {
            return jsonResponse({ error: 'Asset nao encontrado.' }, 404);
        }

        const provider = asset
            ? inferSiteAssetProvider(asset.public_url)
            : resolveStorageProvider('r2');
        const signedUrl = await createSignedGetUrl({
            provider,
            bucket: SITE_ASSETS_BUCKET,
            objectPath: resolvedStoragePath,
            expiresInSeconds: getSignedGetTtlSeconds(300),
            supabaseAdmin,
        });

        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                'Cache-Control': 'public, max-age=300, s-maxage=300',
                Location: signedUrl,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado ao resolver asset publico.';
        return jsonResponse({ error: message }, 500);
    }
});

async function findSiteAsset(supabaseAdmin: ReturnType<typeof createClient>, input: {
    storagePath: string;
    assetId: string;
}) {
    if (input.assetId) {
        const result = await supabaseAdmin
            .from('site_assets')
            .select('id, storage_path, public_url')
            .eq('id', input.assetId)
            .limit(1)
            .maybeSingle();
        if (result.error) {
            throw new Error(result.error.message);
        }
        return (result.data as SiteAssetRow | null) ?? null;
    }

    const candidates = buildStoragePathCandidates(input.storagePath);
    if (candidates.length === 0) {
        return null;
    }

    const result = await supabaseAdmin
        .from('site_assets')
        .select('id, storage_path, public_url')
        .in('storage_path', candidates)
        .limit(candidates.length);

    if (result.error) {
        throw new Error(result.error.message);
    }

    const rows = (result.data as SiteAssetRow[] | null) ?? [];
    if (rows.length === 0) {
        return null;
    }

    for (const candidate of candidates) {
        const match = rows.find((row) => row.storage_path === candidate);
        if (match) {
            return match;
        }
    }

    return rows[0] ?? null;
}

function buildStoragePathCandidates(storagePath: string) {
    const normalized = storagePath.trim().replace(/^\/+/, '');
    if (!normalized) {
        return [];
    }
    const candidates = new Set<string>([normalized]);
    if (normalized.startsWith(`${SITE_ASSETS_BUCKET}/`)) {
        candidates.add(normalized.slice(SITE_ASSETS_BUCKET.length + 1));
    } else {
        candidates.add(`${SITE_ASSETS_BUCKET}/${normalized}`);
    }
    return Array.from(candidates).filter(Boolean);
}

function resolveFallbackStoragePath(storagePath: string) {
    const candidates = buildStoragePathCandidates(storagePath);
    return candidates[0] ?? '';
}

function inferSiteAssetProvider(publicUrl: string | null): StorageProvider {
    const normalizedUrl = publicUrl?.trim().toLowerCase() ?? '';

    if (normalizedUrl.includes('/storage/v1/object/public/')
        || normalizedUrl.includes('/storage/v1/object/sign/')
        || normalizedUrl.includes('.supabase.co/')) {
        return 'supabase';
    }

    return resolveStorageProvider('r2');
}

function jsonResponse(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    });
}
