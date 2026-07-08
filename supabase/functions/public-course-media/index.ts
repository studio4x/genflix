import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSignedGetUrl, getSignedGetTtlSeconds, resolveStorageProvider } from '../_shared/storage-provider.ts';

const COURSE_MEDIA_BUCKET = 'thumbnails';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return jsonResponse({ error: 'Variáveis do Supabase ausentes na edge function.' }, 500);
        }

        const storagePath = getStoragePath(request.url);
        if (!storagePath) {
            return jsonResponse({ error: 'storage_path é obrigatório.' }, 400);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
        const signedUrl = await createSignedGetUrl({
            provider: resolveStorageProvider('r2'),
            bucket: COURSE_MEDIA_BUCKET,
            objectPath: storagePath,
            expiresInSeconds: getSignedGetTtlSeconds(300),
            supabaseAdmin,
        });

        return redirectResponse(signedUrl);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado ao carregar a mídia do curso.';
        return jsonResponse({ error: message }, 500);
    }
});

function getStoragePath(rawUrl: string) {
    try {
        const parsedUrl = new URL(rawUrl);
        const normalized = parsedUrl.searchParams.get('storage_path')?.trim().replace(/^\/+/, '') ?? '';
        return normalized || '';
    }
    catch {
        return '';
    }
}

function redirectResponse(url: string) {
    return new Response(null, {
        status: 302,
        headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            Location: url,
        },
    });
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
