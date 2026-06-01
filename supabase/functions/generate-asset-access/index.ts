import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  createSignedGetUrl,
  getSignedGetTtlSeconds,
  resolveStorageProvider,
} from '../_shared/storage-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_PUBLIC_URL')?.trim() || 'https://genflix-omega.vercel.app',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-requested-with',
}

const MATERIALS_BUCKET = 'materials'

type LessonMaterialRow = {
  id: string
  lesson_id: string
  storage_path: string
  storage_provider: 'supabase' | 'r2' | null
  lessons: {
    module_id: string
    course_modules: {
      course_id: string
    } | null
  } | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await request.json().catch(() => ({}))
    const accessToken = getAccessToken(request, requestBody)
    if (!accessToken) {
      return jsonResponse({ error: 'Token ausente.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido ou usuario nao autenticado.' }, 401)
    }

    const material = await resolveMaterial(supabaseAdmin, requestBody)
    if (!material) {
      return jsonResponse({ error: 'Asset nao encontrado.' }, 404)
    }

    const courseId = material.lessons?.course_modules?.course_id ?? null
    const lessonId = material.lesson_id
    if (!courseId) {
      return jsonResponse({ error: 'Asset sem curso relacionado.' }, 400)
    }

    const hasAdminRoleResult = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role_code: 'admin',
    })
    const hasCreatorRoleResult = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role_code: 'criador',
    })
    if (hasAdminRoleResult.error || hasCreatorRoleResult.error) {
      return jsonResponse({ error: 'Falha ao validar perfil do usuario.' }, 500)
    }

    const isPrivileged = Boolean(hasAdminRoleResult.data || hasCreatorRoleResult.data)
    if (!isPrivileged) {
      const isReleasedResult = await supabaseAdmin.rpc('is_course_released', {
        _user_id: user.id,
        _course_id: courseId,
      })
      if (isReleasedResult.error || !isReleasedResult.data) {
        return jsonResponse({ error: 'Curso nao liberado para este usuario.' }, 403)
      }

      const unlockedLessonsResult = await supabaseAdmin.rpc('get_student_unlocked_lessons_progress', {
        _course_id: courseId,
      })
      if (unlockedLessonsResult.error) {
        return jsonResponse({ error: 'Falha ao validar desbloqueio da aula.' }, 500)
      }

      const unlockedLessons = (unlockedLessonsResult.data ?? []) as Array<{ lesson_id: string }>
      const isUnlocked = unlockedLessons.some((item) => item.lesson_id === lessonId)
      if (!isUnlocked) {
        return jsonResponse({ error: 'Aula bloqueada para este usuario.' }, 403)
      }
    }

    const provider = resolveStorageProvider(material.storage_provider)
    const expiresInSecondsRaw = Number(requestBody?.expires_in_seconds ?? 0)
    const expiresInSeconds = Number.isFinite(expiresInSecondsRaw) && expiresInSecondsRaw > 0
      ? Math.min(Math.floor(expiresInSecondsRaw), 3600)
      : getSignedGetTtlSeconds(300)
    const signedUrl = await createSignedGetUrl({
      provider,
      bucket: provider === 'r2' ? resolveR2Bucket() : MATERIALS_BUCKET,
      objectPath: material.storage_path,
      expiresInSeconds,
      supabaseAdmin,
    })

    console.log(
      JSON.stringify({
        event: 'asset_access_signed_url_created',
        user_id: user.id,
        material_id: material.id,
        storage_provider: provider,
        bucket: provider === 'r2' ? resolveR2Bucket() : MATERIALS_BUCKET,
        storage_path: material.storage_path,
      }),
    )

    return jsonResponse({
      signed_url: signedUrl,
      provider,
      expires_in_seconds: expiresInSeconds,
      mode: 'signed_url',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar acesso ao asset.'
    return jsonResponse({ error: message }, 500)
  }
})

async function resolveMaterial(
  supabaseAdmin: ReturnType<typeof createClient>,
  requestBody: Record<string, unknown>,
) {
  const materialId = typeof requestBody?.material_id === 'string' ? requestBody.material_id.trim() : ''
  const storagePath = typeof requestBody?.storage_path === 'string' ? requestBody.storage_path.trim() : ''

  if (!materialId && !storagePath) {
    throw new Error('material_id ou storage_path obrigatorio.')
  }

  let query = supabaseAdmin
    .from('lesson_materials')
    .select('id, lesson_id, storage_path, storage_provider, lessons!inner(module_id, course_modules!inner(course_id))')
    .limit(1)

  query = materialId ? query.eq('id', materialId) : query.eq('storage_path', storagePath)

  const materialResult = await query.maybeSingle()
  if (materialResult.error) {
    throw new Error(materialResult.error.message)
  }
  return (materialResult.data as LessonMaterialRow | null) ?? null
}

function getAccessToken(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get('Authorization')
  const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const accessTokenFromBody = typeof body?.access_token === 'string' ? body.access_token.trim() : ''
  return accessTokenFromBody || accessTokenFromHeader
}

function resolveR2Bucket() {
  const bucket = Deno.env.get('R2_PRIVATE_BUCKET')?.trim() ?? ''
  if (!bucket) {
    throw new Error('R2_PRIVATE_BUCKET nao configurado.')
  }
  return bucket
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
