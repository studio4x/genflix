import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSignedGetUrl, getSignedGetTtlSeconds } from '../_shared/storage-provider.ts';

const PROFILE_AVATAR_BUCKET = 'profile-avatars';
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
        const storagePath = getStoragePath(request.url);
        if (!storagePath) {
            return jsonResponse({ error: 'storage_path de avatar inválido.' }, 400);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return jsonResponse({ error: 'Variáveis do Supabase ausentes na Edge Function.' }, 500);
        }
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const signedUrl = await createSignedGetUrl({
            provider: 'r2',
            bucket: PROFILE_AVATAR_BUCKET,
            objectPath: storagePath,
            expiresInSeconds: getSignedGetTtlSeconds(3600),
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
        const message = error instanceof Error ? error.message : 'Não foi possível carregar o avatar.';
        return jsonResponse({ error: message }, 500);
    }
});

function getStoragePath(rawUrl: string) {
    try {
        const parsedUrl = new URL(rawUrl);
        const storagePath = parsedUrl.searchParams.get('storage_path')?.trim().replace(/^\/+/, '') ?? '';
        if (!storagePath.startsWith(`${PROFILE_AVATAR_BUCKET}/`) || storagePath.includes('..')) {
            return '';
        }
        return storagePath;
    }
    catch {
        return '';
    }
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
