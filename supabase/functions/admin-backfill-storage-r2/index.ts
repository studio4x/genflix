import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts'
import { buildR2ObjectUrl, createSignedPutUrl } from '../_shared/storage-provider.ts'

const MATERIALS_BUCKET = 'materials'
const MODULE_PDFS_BUCKET = 'module-pdfs'
const SITE_ASSETS_BUCKET = 'site-assets'
const ASSESSMENT_ASSETS_BUCKET = 'assessment-assets'
const LESSON_CONTENT_ASSETS_BUCKET = 'lesson-content-assets'
const LESSON_FOOTER_ASSETS_BUCKET = 'lesson-footer-assets'

type SectionName =
  | 'lesson_materials'
  | 'module_pdfs'
  | 'site_assets'
  | 'assessment_assets'
  | 'lesson_content_assets'
  | 'lesson_footer_assets'
  | 'profiles_avatar_url'
  | 'courses_media_urls'
  | 'support_ticket_attachments'
  | 'support_message_attachments'

type SectionStats = {
  migrated: number
  updated: number
  skipped: number
  failed: number
}

const allowedSections = new Set<SectionName>([
  'lesson_materials',
  'module_pdfs',
  'site_assets',
  'assessment_assets',
  'lesson_content_assets',
  'lesson_footer_assets',
  'profiles_avatar_url',
  'courses_media_urls',
  'support_ticket_attachments',
  'support_message_attachments',
])

const objectCache = new Map<string, { publicUrl: string; copied: boolean }>()

Deno.serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request)
  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request.headers.get('origin'))) {
      return new Response('origin no permitida', { status: 403, headers: corsHeaders })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo nao permitido.' }, 405)
  }

  try {
    const requestBody = await request.json().catch(() => ({}))
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
    const accessToken = getAccessToken(request, requestBody)
    if (!serviceRoleKey || accessToken !== serviceRoleKey) {
      return jsonResponse(request, { error: 'Nao autorizado.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
    if (!supabaseUrl) {
      return jsonResponse(request, { error: 'SUPABASE_URL ausente.' }, 500)
    }

    const section = typeof requestBody?.section === 'string' ? requestBody.section.trim() as SectionName : null
    if (!section || !allowedSections.has(section)) {
      return jsonResponse(request, { error: 'section invalida.' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const stats: SectionStats = { migrated: 0, updated: 0, skipped: 0, failed: 0 }
    const failures: string[] = []

    await runSection(section, supabaseAdmin, stats, failures)

    return jsonResponse(request, {
      ok: true,
      section,
      stats,
      failures,
      checked_at: new Date().toISOString(),
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no backfill.'
    return jsonResponse(request, { error: message }, 500)
  }
})

async function runSection(
  section: SectionName,
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  switch (section) {
    case 'lesson_materials':
      await migrateLessonMaterials(supabaseAdmin, stats, failures)
      return
    case 'module_pdfs':
      await migrateModulePdfs(supabaseAdmin, stats, failures)
      return
    case 'site_assets':
      await migrateSiteAssets(supabaseAdmin, stats, failures)
      return
    case 'assessment_assets':
      await migrateAssessmentAssets(supabaseAdmin, stats, failures)
      return
    case 'lesson_content_assets':
      await migrateLessonContentAssets(supabaseAdmin, stats, failures)
      return
    case 'lesson_footer_assets':
      await migrateFooterActionAssets(supabaseAdmin, stats, failures)
      return
    case 'profiles_avatar_url':
      await migrateUrlFieldRows(supabaseAdmin, stats, failures, {
        table: 'profiles',
        select: 'id, avatar_url',
        fields: ['avatar_url'],
      })
      return
    case 'courses_media_urls':
      await migrateUrlFieldRows(supabaseAdmin, stats, failures, {
        table: 'courses',
        select: 'id, thumbnail_url, cover_image_url, logo_url, student_hero_image_url',
        fields: ['thumbnail_url', 'cover_image_url', 'logo_url', 'student_hero_image_url'],
      })
      return
    case 'support_ticket_attachments':
      await migrateUrlFieldRows(supabaseAdmin, stats, failures, {
        table: 'support_tickets',
        select: 'id, attachment_url',
        fields: ['attachment_url'],
      })
      return
    case 'support_message_attachments':
      await migrateUrlFieldRows(supabaseAdmin, stats, failures, {
        table: 'support_messages',
        select: 'id, attachment_url',
        fields: ['attachment_url'],
      })
      return
  }
}

async function migrateLessonMaterials(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  const result = await supabaseAdmin
    .from('lesson_materials')
    .select('id, storage_path, storage_provider')
    .not('storage_path', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    await handleRow(stats, failures, `lesson_materials:${row.id}`, async () => {
      const storagePath = row.storage_path?.trim()
      if (!storagePath) {
        stats.skipped += 1
        return
      }
      await migrateObject(supabaseAdmin, MATERIALS_BUCKET, storagePath, row.storage_provider ?? 'supabase')
      if (row.storage_provider !== 'r2') {
        const updateResult = await supabaseAdmin
          .from('lesson_materials')
          .update({ storage_provider: 'r2' })
          .eq('id', row.id)
        if (updateResult.error) {
          throw updateResult.error
        }
        stats.updated += 1
      }
      stats.migrated += 1
    })
  }
}

async function migrateModulePdfs(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  const result = await supabaseAdmin
    .from('course_modules')
    .select('id, module_pdf_storage_path, module_pdf_storage_provider')
    .not('module_pdf_storage_path', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    await handleRow(stats, failures, `module_pdfs:${row.id}`, async () => {
      const storagePath = row.module_pdf_storage_path?.trim()
      if (!storagePath) {
        stats.skipped += 1
        return
      }
      await migrateObject(supabaseAdmin, MODULE_PDFS_BUCKET, storagePath, row.module_pdf_storage_provider ?? 'supabase')
      if (row.module_pdf_storage_provider !== 'r2') {
        const updateResult = await supabaseAdmin
          .from('course_modules')
          .update({ module_pdf_storage_provider: 'r2' })
          .eq('id', row.id)
        if (updateResult.error) {
          throw updateResult.error
        }
        stats.updated += 1
      }
      stats.migrated += 1
    })
  }
}

async function migrateSiteAssets(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  const result = await supabaseAdmin
    .from('site_assets')
    .select('id, storage_path, public_url')
    .not('storage_path', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    await handleRow(stats, failures, `site_assets:${row.id}`, async () => {
      const storagePath = row.storage_path?.trim()
      if (!storagePath) {
        stats.skipped += 1
        return
      }
      const migrated = await migrateObject(supabaseAdmin, SITE_ASSETS_BUCKET, storagePath, 'supabase')
      if (row.public_url !== migrated.publicUrl) {
        const updateResult = await supabaseAdmin
          .from('site_assets')
          .update({ public_url: migrated.publicUrl })
          .eq('id', row.id)
        if (updateResult.error) {
          throw updateResult.error
        }
        stats.updated += 1
      }
      stats.migrated += 1
    })
  }
}

async function migrateAssessmentAssets(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  const result = await supabaseAdmin
    .from('assessment_question_interactions')
    .select('question_id, content')
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    await handleRow(stats, failures, `assessment_assets:${row.question_id}`, async () => {
      const content = structuredClone(row.content)
      const asset = getInteractionAsset(content)
      if (!asset) {
        stats.skipped += 1
        return
      }
      await migrateObject(supabaseAdmin, ASSESSMENT_ASSETS_BUCKET, asset.storage_path.trim(), asset.storage_provider ?? 'supabase')
      if (asset.storage_provider !== 'r2') {
        asset.storage_provider = 'r2'
        asset.signed_url = null
        const updateResult = await supabaseAdmin
          .from('assessment_question_interactions')
          .update({ content })
          .eq('question_id', row.question_id)
        if (updateResult.error) {
          throw updateResult.error
        }
        stats.updated += 1
      }
      stats.migrated += 1
    })
  }
}

async function migrateLessonContentAssets(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  const result = await supabaseAdmin
    .from('lessons')
    .select('id, text_content')
    .not('text_content', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    await handleRow(stats, failures, `lesson_content_assets:${row.id}`, async () => {
      const migrated = await migrateLessonContentPayloads(supabaseAdmin, row.text_content)
      if (!migrated.changed) {
        stats.skipped += 1
        return
      }
      const updateResult = await supabaseAdmin
        .from('lessons')
        .update({ text_content: migrated.nextHtml })
        .eq('id', row.id)
      if (updateResult.error) {
        throw updateResult.error
      }
      stats.updated += 1
      stats.migrated += 1
    })
  }
}

async function migrateFooterActionAssets(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
) {
  const [actionsResult, materialsResult] = await Promise.all([
    supabaseAdmin
      .from('lesson_footer_actions')
      .select('id, storage_path')
      .not('storage_path', 'is', null),
    supabaseAdmin
      .from('lesson_materials')
      .select('storage_path')
      .not('storage_path', 'is', null),
  ])
  if (actionsResult.error) {
    throw actionsResult.error
  }
  if (materialsResult.error) {
    throw materialsResult.error
  }

  const materialPaths = new Set((materialsResult.data ?? []).map((row) => row.storage_path))
  for (const row of actionsResult.data ?? []) {
    await handleRow(stats, failures, `lesson_footer_assets:${row.id}`, async () => {
      const storagePath = row.storage_path?.trim()
      if (!storagePath || materialPaths.has(storagePath)) {
        stats.skipped += 1
        return
      }
      await migrateObject(supabaseAdmin, LESSON_FOOTER_ASSETS_BUCKET, storagePath, 'supabase')
      stats.migrated += 1
    })
  }
}

async function migrateUrlFieldRows(
  supabaseAdmin: ReturnType<typeof createClient>,
  stats: SectionStats,
  failures: string[],
  input: {
    table: 'profiles' | 'courses' | 'support_tickets' | 'support_messages'
    select: string
    fields: string[]
  },
) {
  const result = await supabaseAdmin.from(input.table).select(input.select)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    await handleRow(stats, failures, `${input.table}:${row.id}`, async () => {
      const updates: Record<string, string> = {}
      let hasUpdate = false
      for (const field of input.fields) {
        const currentUrl = row[field]
        const parsed = parseLegacySupabaseStorageUrl(currentUrl, Deno.env.get('SUPABASE_URL')?.trim() ?? '')
        if (!parsed) {
          continue
        }
        const migrated = await migrateObject(supabaseAdmin, parsed.bucket, parsed.objectPath, 'supabase')
        if (currentUrl !== migrated.publicUrl) {
          updates[field] = migrated.publicUrl
          hasUpdate = true
        }
        stats.migrated += 1
      }
      if (!hasUpdate) {
        stats.skipped += 1
        return
      }
      const updateResult = await supabaseAdmin.from(input.table).update(updates).eq('id', row.id)
      if (updateResult.error) {
        throw updateResult.error
      }
      stats.updated += 1
    })
  }
}

async function migrateObject(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  objectPath: string,
  sourceProvider: 'supabase' | 'r2',
) {
  const cacheKey = `${bucket}:${objectPath}`
  const cached = objectCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const publicUrl = buildR2ObjectUrl(bucket, objectPath)
  if (sourceProvider === 'r2') {
    const result = { publicUrl, copied: false }
    objectCache.set(cacheKey, result)
    return result
  }

  const file = await downloadSupabaseObject(supabaseAdmin, bucket, objectPath)
  await uploadObjectToR2(supabaseAdmin, bucket, objectPath, file.bytes, file.mimeType)
  const result = { publicUrl, copied: true }
  objectCache.set(cacheKey, result)
  return result
}

async function downloadSupabaseObject(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  objectPath: string,
) {
  const result = await supabaseAdmin.storage.from(bucket).download(objectPath)
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? `Falha ao baixar ${bucket}/${objectPath} do Supabase Storage.`)
  }
  const bytes = new Uint8Array(await result.data.arrayBuffer())
  return {
    bytes,
    mimeType: result.data.type || 'application/octet-stream',
  }
}

async function uploadObjectToR2(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  objectPath: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  const ticket = await createSignedPutUrl({
    provider: 'r2',
    bucket,
    objectPath,
    mimeType: mimeType || 'application/octet-stream',
    supabaseAdmin,
  })
  if (!ticket.upload_url) {
    throw new Error(`URL assinada ausente para ${bucket}/${objectPath}.`)
  }
  const headers: Record<string, string> = {
    'Content-Type': mimeType || 'application/octet-stream',
  }
  for (const [key, value] of Object.entries(ticket.upload_headers ?? {})) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'host' || lowerKey === 'content-length' || lowerKey === 'content-type') {
      continue
    }
    headers[key] = value
  }
  const response = await fetch(ticket.upload_url, {
    method: 'PUT',
    headers,
    body: bytes,
  })
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Falha ao enviar ${bucket}/${objectPath} para R2 (${response.status}): ${errorBody}`)
  }
}

async function migrateLessonContentPayloads(
  supabaseAdmin: ReturnType<typeof createClient>,
  rawHtml: string | null,
) {
  if (!rawHtml || !rawHtml.includes('data-hcm-payload=')) {
    return { nextHtml: rawHtml, changed: false }
  }

  const regex = /data-hcm-block="([^"]+)"[\s\S]*?data-hcm-payload="([^"]+)"/g
  const matches = Array.from(rawHtml.matchAll(regex))
  if (matches.length === 0) {
    return { nextHtml: rawHtml, changed: false }
  }

  let changed = false
  let result = ''
  let cursor = 0

  for (const match of matches) {
    const [fullMatch, blockType, encodedPayload] = match
    const startIndex = match.index ?? 0
    const endIndex = startIndex + fullMatch.length
    result += rawHtml.slice(cursor, startIndex)
    cursor = endIndex

    let replacement = fullMatch
    try {
      const payload = JSON.parse(decodeURIComponent(encodedPayload))
      let nextPayload: Record<string, unknown> | null = null

      if (
        (blockType === 'image' || blockType === 'video' || blockType === 'html')
        && payload?.source_type === 'upload'
        && typeof payload.storage_path === 'string'
        && payload.storage_path.trim()
      ) {
        await migrateObject(supabaseAdmin, LESSON_CONTENT_ASSETS_BUCKET, payload.storage_path.trim(), payload.storage_provider === 'r2' ? 'r2' : 'supabase')
        nextPayload = {
          ...payload,
          storage_provider: 'r2',
          signed_url: null,
        }
      }

      if (
        blockType === 'image-hotspots'
        && payload?.asset
        && typeof payload.asset.storage_path === 'string'
        && payload.asset.storage_path.trim()
      ) {
        await migrateObject(supabaseAdmin, LESSON_CONTENT_ASSETS_BUCKET, payload.asset.storage_path.trim(), payload.asset.storage_provider === 'r2' ? 'r2' : 'supabase')
        nextPayload = {
          ...payload,
          asset: {
            ...payload.asset,
            storage_provider: 'r2',
            signed_url: null,
          },
        }
      }

      if (nextPayload) {
        changed = true
        replacement = fullMatch.replace(
          `data-hcm-payload="${encodedPayload}"`,
          `data-hcm-payload="${encodeURIComponent(JSON.stringify(nextPayload))}"`,
        )
      }
    }
    catch {
      // Mantem o payload original.
    }

    result += replacement
  }

  result += rawHtml.slice(cursor)
  return { nextHtml: result, changed }
}

function getInteractionAsset(content: unknown) {
  if (!content || typeof content !== 'object') {
    return null
  }
  const candidate = content as Record<string, unknown>
  if (candidate.kind !== 'drag_drop_labeling' && candidate.kind !== 'image_hotspot' && candidate.kind !== 'coloring') {
    return null
  }
  const asset = candidate.asset
  if (!asset || typeof asset !== 'object') {
    return null
  }
  const assetCandidate = asset as Record<string, unknown>
  if (typeof assetCandidate.storage_path !== 'string' || !assetCandidate.storage_path.trim()) {
    return null
  }
  return assetCandidate
}

function parseLegacySupabaseStorageUrl(url: unknown, supabaseUrl: string) {
  if (!url || typeof url !== 'string') {
    return null
  }
  try {
    const parsed = new URL(url)
    if (parsed.origin !== new URL(supabaseUrl).origin) {
      return null
    }
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/)
    if (!match) {
      return null
    }
    return {
      bucket: decodeURIComponent(match[1]),
      objectPath: decodeURIComponent(match[2]),
    }
  }
  catch {
    return null
  }
}

async function handleRow(
  stats: SectionStats,
  failures: string[],
  label: string,
  runner: () => Promise<void>,
) {
  try {
    await runner()
  }
  catch (error) {
    stats.failed += 1
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function getAccessToken(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get('Authorization')
  const fromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const fromBody = typeof body?.service_role_key === 'string' ? body.service_role_key.trim() : ''
  return fromBody || fromHeader
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
