import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildObjectPath,
  createSignedPutUrl,
  deleteObject,
  getMaxUploadSizeBytes,
  resolveStorageProvider,
  type StorageProvider,
} from '../_shared/storage-provider.ts'
import { buildCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts'

const MATERIALS_BUCKET = 'materials'

type UploadKind = 'lesson_material'
type Operation = 'prepare_upload' | 'delete_object'

Deno.serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request)

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request.headers.get('origin'))) {
      return new Response('origin nao permitida', { status: 403, headers: corsHeaders })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await request.json().catch(() => ({}))
    const accessToken = getAccessToken(request, requestBody)
    if (!accessToken) {
      return jsonResponse(request, { error: 'Token ausente.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(request, { error: 'Variaveis do Supabase ausentes na edge function.' }, 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !user) {
      return jsonResponse(request, { error: 'Token invalido ou usuario nao autenticado.' }, 401)
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
      return jsonResponse(request, { error: 'Falha ao validar perfil do usuario.' }, 500)
    }
    if (!hasAdminRoleResult.data && !hasCreatorRoleResult.data) {
      return jsonResponse(request, { error: 'Usuario sem permissao para upload protegido.' }, 403)
    }

    const operation = normalizeOperation(requestBody?.operation)
    if (operation === 'delete_object') {
      return await handleDeleteObject(request, requestBody, supabaseAdmin)
    }
    return await handlePrepareUpload(request, requestBody, supabaseAdmin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no upload protegido.'
    return jsonResponse(request, { error: message }, 500)
  }
})

async function handlePrepareUpload(
  request: Request,
  requestBody: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const uploadKind = normalizeUploadKind(requestBody?.upload_kind)
  if (!uploadKind) {
    return jsonResponse(request, { error: 'upload_kind invalido.' }, 400)
  }

  const entityId = typeof requestBody?.entity_id === 'string' ? requestBody.entity_id.trim() : ''
  const fileName = typeof requestBody?.file_name === 'string' ? requestBody.file_name.trim() : ''
  const mimeType = typeof requestBody?.mime_type === 'string' ? requestBody.mime_type.trim() : ''
  const fileSizeBytes = Number(requestBody?.file_size_bytes ?? 0)

  if (!entityId || !fileName) {
    return jsonResponse(request, { error: 'entity_id e file_name sao obrigatorios.' }, 400)
  }

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return jsonResponse(request, { error: 'file_size_bytes invalido.' }, 400)
  }

  // Default mais alto para suportar materiais em video; ainda pode ser sobrescrito por R2_MAX_FILE_SIZE_BYTES.
  const maxUploadSize = getMaxUploadSizeBytes(1024 * 1024 * 1024)
  if (fileSizeBytes > maxUploadSize) {
    return jsonResponse(request, { error: `Arquivo excede o limite permitido (${maxUploadSize} bytes).` }, 413)
  }

  const provider = resolveUploadProvider(uploadKind, requestBody?.provider)
  const bucket = resolveBucket(uploadKind)
  const objectPath = buildObjectPath(entityId, fileName)

  const ticket = await createSignedPutUrl({
    provider,
    bucket: provider === 'r2' ? resolveR2Bucket() : bucket,
    objectPath,
    mimeType: mimeType || 'application/octet-stream',
    supabaseAdmin,
  })

  return jsonResponse(request, {
    provider: ticket.provider,
    upload_method: ticket.upload_method,
    upload_path: ticket.upload_path,
    upload_token: ticket.upload_token,
    upload_url: ticket.upload_url,
    upload_headers: ticket.upload_headers,
    storage_bucket: bucket,
    storage_provider: provider,
  })
}

async function handleDeleteObject(
  request: Request,
  requestBody: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const storagePath = typeof requestBody?.storage_path === 'string' ? requestBody.storage_path.trim() : ''
  const storageBucket = typeof requestBody?.storage_bucket === 'string' ? requestBody.storage_bucket.trim() : MATERIALS_BUCKET
  const provider = resolveStorageProvider(requestBody?.provider)

  if (!storagePath) {
    return jsonResponse(request, { error: 'storage_path obrigatorio para deletar objeto.' }, 400)
  }

  await deleteObject({
    provider,
    bucket: provider === 'r2' ? resolveR2Bucket() : storageBucket,
    objectPath: storagePath,
    supabaseAdmin,
  })

  return jsonResponse(request, { ok: true })
}

function resolveBucket(uploadKind: UploadKind) {
  if (uploadKind === 'lesson_material') {
    return MATERIALS_BUCKET
  }
  return MATERIALS_BUCKET
}

function resolveUploadProvider(uploadKind: UploadKind, value: unknown): StorageProvider {
  if (value === 'r2' || value === 'supabase') {
    return value
  }

  // Materiais protegidos podem incluir vídeos grandes; quando o bucket privado do R2
  // já está configurado, preferimos esse provedor mesmo que o default global não tenha
  // sido alinhado ainda.
  if (uploadKind === 'lesson_material') {
    const bucket = Deno.env.get('R2_PRIVATE_BUCKET')?.trim() ?? ''
    if (bucket) {
      return 'r2'
    }
  }

  return resolveStorageProvider(value)
}

function resolveR2Bucket() {
  const bucket = Deno.env.get('R2_PRIVATE_BUCKET')?.trim() ?? ''
  if (!bucket) {
    throw new Error('R2_PRIVATE_BUCKET nao configurado.')
  }
  return bucket
}

function normalizeUploadKind(value: unknown): UploadKind | null {
  if (value === 'lesson_material') {
    return value
  }
  return null
}

function normalizeOperation(value: unknown): Operation {
  if (value === 'delete_object') {
    return value
  }
  return 'prepare_upload'
}

function getAccessToken(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get('Authorization')
  const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const accessTokenFromBody = typeof body?.access_token === 'string' ? body.access_token.trim() : ''
  return accessTokenFromBody || accessTokenFromHeader
}

function jsonResponse(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(request),
      'Content-Type': 'application/json',
    },
  })
}
