import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSignedGetUrl, getSignedGetTtlSeconds, resolveStorageProvider, } from '../_shared/storage-provider.ts';
const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('APP_PUBLIC_URL')?.trim() || 'https://genflix-omega.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-requested-with',
};
const MATERIALS_BUCKET = 'materials';
type LessonMaterialRow = {
    id: string;
    lesson_id: string;
    storage_path: string;
    storage_provider: 'supabase' | 'r2' | null;
    lessons: {
        module_id: string;
        course_modules: {
            course_id: string;
        } | null;
    } | null;
};
Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const requestBody = await request.json().catch(() => ({}));
        const accessToken = getAccessToken(request, requestBody);
        if (!accessToken) {
            return jsonResponse({ error: 'Token ausente.' }, 401);
        }
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500);
        }
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
        const { data: { user }, error: authError, } = await supabaseAdmin.auth.getUser(accessToken);
        if (authError || !user) {
            return jsonResponse({ error: "Token inv?lido ou usurio no autenticado." }, 401);
        }
        const hasAdminRoleResult = await supabaseAdmin.rpc('has_role', {
            _user_id: user.id,
            _role_code: 'admin',
        });
        const hasCreatorRoleResult = await supabaseAdmin.rpc('has_role', {
            _user_id: user.id,
            _role_code: 'criador',
        });
        if (hasAdminRoleResult.error || hasCreatorRoleResult.error) {
            return jsonResponse({ error: "Falha ao validar perfil do usurio." }, 500);
        }
        const isPrivileged = Boolean(hasAdminRoleResult.data || hasCreatorRoleResult.data);
        const target = await resolveTarget(supabaseAdmin, requestBody);
        if (!target) {
            return jsonResponse({ error: 'Asset no encontrado.' }, 404);
        }
        if (target.kind === 'lesson_material') {
            const courseId = target.lesson?.course_modules?.course_id ?? null;
            const lessonId = target.lesson_id;
            if (!courseId) {
                return jsonResponse({ error: 'Asset sem curso relacionado.' }, 400);
            }
            if (!isPrivileged) {
                const isReleasedResult = await supabaseAdmin.rpc('is_course_released', {
                    _user_id: user.id,
                    _course_id: courseId,
                });
                if (isReleasedResult.error || !isReleasedResult.data) {
                    return jsonResponse({ error: "Curso no liberado para este usurio." }, 403);
                }
                const unlockedLessonsResult = await supabaseAdmin.rpc('get_student_unlocked_lessons_progress', {
                    _course_id: courseId,
                });
                if (unlockedLessonsResult.error) {
                    return jsonResponse({ error: 'Falha ao validar desbloqueio da aula.' }, 500);
                }
                const unlockedLessons = (unlockedLessonsResult.data ?? []) as Array<{
                    lesson_id: string;
                }>;
                const isUnlocked = unlockedLessons.some((item) => item.lesson_id === lessonId);
                if (!isUnlocked) {
                    return jsonResponse({ error: "Aula bloqueada para este usurio." }, 403);
                }
            }
        }
        else if (target.asset_kind === 'lesson_content_asset' || target.asset_kind === 'lesson_footer_asset' || target.asset_kind === 'assessment_asset') {
            // Assets educacionais precisam permanecer acessíveis a estudantes autenticados.
        }
        else if (target.asset_kind === 'module_pdf') {
            if (!isPrivileged) {
                return jsonResponse({ error: 'Apenas administradores podem acessar este asset.' }, 403);
            }
        }
        else if (!isPrivileged) {
            return jsonResponse({ error: 'Apenas administradores podem acessar este asset.' }, 403);
        }
        const provider = resolveStorageProvider(target.storage_provider);
        const expiresInSecondsRaw = Number(requestBody?.expires_in_seconds ?? 0);
        const expiresInSeconds = Number.isFinite(expiresInSecondsRaw) && expiresInSecondsRaw > 0
            ? Math.min(Math.floor(expiresInSecondsRaw), 3600)
            : getSignedGetTtlSeconds(300);
        const signedUrl = await createSignedGetUrl({
            provider,
            bucket: provider === 'r2' ? target.bucket : target.bucket,
            objectPath: target.storage_path,
            expiresInSeconds,
            supabaseAdmin,
        });
        console.log(JSON.stringify({
            event: 'asset_access_signed_url_created',
            user_id: user.id,
            asset_kind: target.kind,
            bucket: target.bucket,
            storage_path: target.storage_path,
        }));
        return jsonResponse({
            signed_url: signedUrl,
            provider,
            expires_in_seconds: expiresInSeconds,
            mode: 'signed_url',
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar acesso ao asset.';
        return jsonResponse({ error: message }, 500);
    }
});
type AssetAccessTarget = {
    kind: 'lesson_material' | 'generic';
    asset_kind?: 'lesson_material' | 'lesson_content_asset' | 'lesson_footer_asset' | 'assessment_asset' | 'module_pdf' | 'site_asset' | 'profile_avatar' | 'support_attachment' | 'course_media';
    storage_path: string;
    storage_provider: 'supabase' | 'r2';
    bucket: string;
    lesson_id?: string;
    lesson?: {
        course_modules?: {
            course_id?: string | null;
        } | null;
    } | null;
};
async function resolveTarget(supabaseAdmin: ReturnType<typeof createClient>, requestBody: Record<string, unknown>): Promise<AssetAccessTarget | null> {
    const storageBucket = typeof requestBody?.storage_bucket === 'string' ? requestBody.storage_bucket.trim() : '';
    const storagePath = typeof requestBody?.storage_path === 'string' ? requestBody.storage_path.trim() : '';
    if (storageBucket && storagePath) {
        return {
            kind: 'generic',
            asset_kind: normalizeAssetKind(requestBody?.asset_kind),
            storage_path: storagePath,
            storage_provider: resolveStorageProvider(requestBody?.storage_provider),
            bucket: storageBucket,
        };
    }
    const materialId = typeof requestBody?.material_id === 'string' ? requestBody.material_id.trim() : '';
    if (!materialId && !storagePath) {
        return null;
    }
    let query = supabaseAdmin
        .from('lesson_materials')
        .select('id, lesson_id, storage_path, storage_provider, lessons!inner(module_id, course_modules!inner(course_id))')
        .limit(1);
    query = materialId ? query.eq('id', materialId) : query.eq('storage_path', storagePath);
    const materialResult = await query.maybeSingle();
    if (materialResult.error) {
        throw new Error(materialResult.error.message);
    }
    const material = (materialResult.data as LessonMaterialRow | null) ?? null;
    if (!material) {
        return null;
    }
    return {
        kind: 'lesson_material',
        asset_kind: 'lesson_material',
        storage_path: material.storage_path,
        storage_provider: material.storage_provider ?? 'supabase',
        bucket: MATERIALS_BUCKET,
        lesson_id: material.lesson_id,
        lesson: material.lessons,
    };
}
function getAccessToken(request: Request, body: Record<string, unknown>) {
    const authHeader = request.headers.get('Authorization');
    const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
    const accessTokenFromBody = typeof body?.access_token === 'string' ? body.access_token.trim() : '';
    return accessTokenFromBody || accessTokenFromHeader;
}
function normalizeAssetKind(value: unknown): AssetAccessTarget['asset_kind'] {
    if (value === 'lesson_material'
        || value === 'lesson_content_asset'
        || value === 'lesson_footer_asset'
        || value === 'assessment_asset'
        || value === 'module_pdf'
        || value === 'site_asset'
        || value === 'profile_avatar'
        || value === 'support_attachment'
        || value === 'course_media') {
        return value;
    }
    return undefined;
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
