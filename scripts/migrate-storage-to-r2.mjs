import { createHash, createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const raw = readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1))
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function parseEnvValue(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

loadEnvFile(join(process.cwd(), '.env'))
loadEnvFile(join(process.cwd(), '.env.local'))

const REQUIRED_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

for (const key of REQUIRED_ENV_KEYS) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Variável obrigatória ausente: ${key}`)
  }
}

const supabaseUrl = process.env.SUPABASE_URL.trim()
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
const appPublicUrl = (process.env.APP_PUBLIC_URL?.trim() || 'https://genflix-omega.vercel.app').replace(/\/+$/, '')
const hasLocalR2Credentials = Boolean(
  process.env.R2_S3_ENDPOINT?.trim()
  && process.env.R2_ACCESS_KEY_ID?.trim()
  && process.env.R2_SECRET_ACCESS_KEY?.trim(),
)
const r2Endpoint = process.env.R2_S3_ENDPOINT?.trim().replace(/\/+$/, '') ?? ''
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? ''
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? ''
const r2Region = (process.env.R2_REGION ?? 'auto').trim() || 'auto'
const dryRun = process.argv.includes('--dry-run')
const selectedSections = new Set(
  process.argv.flatMap((argument, index, allArgs) => {
    if (argument === '--section') {
      return [allArgs[index + 1] ?? '']
    }
    if (argument.startsWith('--section=')) {
      return [argument.slice('--section='.length)]
    }
    return []
  }).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean),
)
const remoteSections = [
  { name: 'lesson_materials' },
  { name: 'module_pdfs' },
  { name: 'site_assets', batchSize: 40 },
  { name: 'assessment_assets' },
  { name: 'lesson_content_assets' },
  { name: 'lesson_footer_assets' },
  { name: 'profiles_avatar_url' },
  { name: 'courses_media_urls' },
  { name: 'support_ticket_attachments' },
  { name: 'support_message_attachments' },
]

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const MATERIALS_BUCKET = 'materials'
const MODULE_PDFS_BUCKET = 'module-pdfs'
const SITE_ASSETS_BUCKET = 'site-assets'
const ASSESSMENT_ASSETS_BUCKET = 'assessment-assets'
const LESSON_CONTENT_ASSETS_BUCKET = 'lesson-content-assets'
const LESSON_FOOTER_ASSETS_BUCKET = 'lesson-footer-assets'
const COURSE_MEDIA_BUCKET = 'thumbnails'
const COURSE_MEDIA_PROXY_PATH = '/api/public/course-media'
const R2_HOST_PATTERNS = [/\.r2\.cloudflarestorage\.com$/i, /\.r2\.dev$/i]

const migrationCache = new Map()
const report = {
  objectsCopied: 0,
  objectsAlreadyInR2: 0,
  skipped: 0,
  updatedRows: 0,
  failed: 0,
  sections: {},
  failures: [],
}

function incrementSection(section, key, delta = 1) {
  if (!report.sections[section]) {
    report.sections[section] = {
      migrated: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    }
  }
  report.sections[section][key] += delta
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key, value, encoding = undefined) {
  return createHmac('sha256', key).update(value).digest(encoding)
}

function encodeR2ObjectPath(objectPath) {
  return objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function buildR2ObjectUrl(bucket, objectPath) {
  const encodedPath = encodeR2ObjectPath(objectPath.replace(/^\/+/, ''))
  return `${r2Endpoint}/${bucket}/${encodedPath}`
}

function buildCanonicalUri(bucket, objectPath) {
  return `/${bucket}/${encodeR2ObjectPath(objectPath.replace(/^\/+/, ''))}`
}

function shouldRunSection(section) {
  return selectedSections.size === 0 || selectedSections.has(section)
}

function trimToNull(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function buildAwsDates(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  }
}

function getSigningKey(dateStamp) {
  const kDate = hmac(`AWS4${r2SecretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, r2Region)
  const kService = hmac(kRegion, 's3')
  return hmac(kService, 'aws4_request')
}

async function signR2Request({ method, bucket, objectPath, body, headers = {}, query = '' }) {
  const url = new URL(buildR2ObjectUrl(bucket, objectPath))
  if (query) {
    url.search = query
  }

  const { amzDate, dateStamp } = buildAwsDates()
  const host = url.host
  const payloadBytes = body ? await toUint8Array(body) : new Uint8Array()
  const payloadHash = sha256Hex(payloadBytes)
  const normalizedHeaders = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(
      Object.entries(headers)
        .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim() !== '')
        .map(([key, value]) => [key.toLowerCase(), `${value}`.trim()]),
    ),
  }
  const signedHeaderNames = Object.keys(normalizedHeaders).sort()
  const canonicalHeaders = signedHeaderNames
    .map((key) => `${key}:${normalizedHeaders[key]}\n`)
    .join('')
  const canonicalRequest = [
    method,
    buildCanonicalUri(bucket, objectPath),
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaderNames.join(';'),
    payloadHash,
  ].join('\n')
  const credentialScope = `${dateStamp}/${r2Region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const signature = hmac(getSigningKey(dateStamp), stringToSign, 'hex')
  const authorization = [
    'AWS4-HMAC-SHA256 Credential=',
    `${r2AccessKeyId}/${credentialScope}`,
    ', SignedHeaders=',
    signedHeaderNames.join(';'),
    ', Signature=',
    signature,
  ].join('')

  return {
    url,
    headers: {
      ...normalizedHeaders,
      authorization,
    },
    body: payloadBytes,
  }
}

async function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer())
  }
  return new TextEncoder().encode(String(value ?? ''))
}

async function r2ObjectExists(bucket, objectPath) {
  const signed = await signR2Request({
    method: 'HEAD',
    bucket,
    objectPath,
  })
  const response = await fetch(signed.url, {
    method: 'HEAD',
    headers: signed.headers,
  })
  if (response.status === 404) {
    return false
  }
  if (!response.ok) {
    throw new Error(`Falha ao verificar objeto no R2 (${response.status}) ${bucket}/${objectPath}`)
  }
  return true
}

async function uploadObjectToR2(bucket, objectPath, bytes, mimeType) {
  if (dryRun) {
    return
  }
  const payloadBytes = await toUint8Array(bytes)
  const signed = await signR2Request({
    method: 'PUT',
    bucket,
    objectPath,
    body: payloadBytes,
    headers: {
      'content-type': mimeType || 'application/octet-stream',
    },
  })
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: signed.body,
  })
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Falha ao enviar para R2 (${response.status}) ${bucket}/${objectPath}: ${errorBody}`)
  }
}

async function downloadSupabaseObject(bucket, objectPath) {
  const result = await supabaseAdmin.storage.from(bucket).download(objectPath)
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? `Falha ao baixar ${bucket}/${objectPath} do Supabase Storage.`)
  }
  const arrayBuffer = typeof result.data.arrayBuffer === 'function'
    ? await result.data.arrayBuffer()
    : result.data instanceof ArrayBuffer
      ? result.data
      : ArrayBuffer.isView(result.data)
        ? result.data.buffer.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength)
        : await new Blob([result.data]).arrayBuffer()
  return {
    bytes: new Uint8Array(arrayBuffer),
    mimeType: result.data.type || 'application/octet-stream',
  }
}

async function migrateObject(bucket, objectPath, sourceProvider = 'supabase') {
  const cacheKey = `${bucket}:${objectPath}`
  const cached = migrationCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const publicUrl = buildR2ObjectUrl(bucket, objectPath)
  if (sourceProvider === 'r2') {
    const result = { publicUrl, copied: false }
    migrationCache.set(cacheKey, result)
    return result
  }

  if (await r2ObjectExists(bucket, objectPath).catch(() => false)) {
    report.objectsAlreadyInR2 += 1
    const result = { publicUrl, copied: false }
    migrationCache.set(cacheKey, result)
    return result
  }

  const file = await downloadSupabaseObject(bucket, objectPath)
  await uploadObjectToR2(bucket, objectPath, file.bytes, file.mimeType)
  report.objectsCopied += 1
  const result = { publicUrl, copied: true }
  migrationCache.set(cacheKey, result)
  return result
}

function parseLegacySupabaseStorageUrl(url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  let parsed
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }

  const supabaseOrigin = new URL(supabaseUrl).origin
  if (parsed.origin !== supabaseOrigin) {
    return null
  }

  const publicMatch = parsed.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (publicMatch) {
    return {
      bucket: decodeURIComponent(publicMatch[1]),
      objectPath: decodeURIComponent(publicMatch[2]),
    }
  }

  const signedMatch = parsed.pathname.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
  if (signedMatch) {
    return {
      bucket: decodeURIComponent(signedMatch[1]),
      objectPath: decodeURIComponent(signedMatch[2]),
    }
  }

  const authenticatedMatch = parsed.pathname.match(/^\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/)
  if (authenticatedMatch) {
    return {
      bucket: decodeURIComponent(authenticatedMatch[1]),
      objectPath: decodeURIComponent(authenticatedMatch[2]),
    }
  }

  return null
}

function normalizeCourseMediaStoragePath(value) {
  const normalized = trimToNull(value)?.replace(/^\/+/, '') ?? ''
  if (!normalized) {
    return ''
  }
  if (/^[a-z]+:\/\//i.test(normalized)) {
    return ''
  }
  if (normalized.startsWith(`${COURSE_MEDIA_BUCKET}/http://`) || normalized.startsWith(`${COURSE_MEDIA_BUCKET}/https://`)) {
    return ''
  }
  return normalized
}

function buildCourseMediaPublicUrl(storagePath) {
  const normalizedStoragePath = normalizeCourseMediaStoragePath(storagePath)
  if (!normalizedStoragePath) {
    return ''
  }
  return `${appPublicUrl}${COURSE_MEDIA_PROXY_PATH}?storage_path=${encodeURIComponent(normalizedStoragePath)}`
}

function parseCourseMediaUrl(url) {
  const normalizedUrl = trimToNull(url)
  if (!normalizedUrl) {
    return null
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    const normalizedStoragePath = normalizeCourseMediaStoragePath(normalizedUrl)
    return normalizedStoragePath
      ? { objectPath: normalizedStoragePath, sourceProvider: 'r2' }
      : null
  }

  let parsed
  try {
    parsed = new URL(normalizedUrl)
  }
  catch {
    return null
  }

  const normalizedPathname = parsed.pathname.replace(/\/+$/, '')
  if (normalizedPathname.endsWith(COURSE_MEDIA_PROXY_PATH)) {
    const objectPath = normalizeCourseMediaStoragePath(parsed.searchParams.get('storage_path'))
    return objectPath ? { objectPath, sourceProvider: 'r2' } : null
  }

  const supabaseOrigin = new URL(supabaseUrl).origin
  if (parsed.origin === supabaseOrigin) {
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/thumbnails\/(.+)$/i)
    if (match) {
      const objectPath = normalizeCourseMediaStoragePath(decodeURIComponent(match[1]))
      return objectPath ? { objectPath, sourceProvider: 'supabase' } : null
    }
  }

  if (R2_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    const segments = decodeURIComponent(parsed.pathname).replace(/^\/+/, '').split('/').filter(Boolean)
    if (segments.length >= 2) {
      const objectPath = normalizeCourseMediaStoragePath(segments.slice(1).join('/'))
      return objectPath ? { objectPath, sourceProvider: 'r2' } : null
    }
  }

  return null
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

async function updateRow(table, match, payload) {
  if (dryRun) {
    return
  }

  let query = supabaseAdmin.from(table).update(payload)
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value)
  }
  const result = await query
  if (result.error) {
    throw result.error
  }
}

async function migrateLessonContentPayloads(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string' || !rawHtml.includes('data-hcm-payload=')) {
    return { nextHtml: rawHtml, changed: false, migratedObjects: 0 }
  }

  const regex = /data-hcm-block="([^"]+)"[\s\S]*?data-hcm-payload="([^"]+)"/g
  const matches = Array.from(rawHtml.matchAll(regex))
  if (matches.length === 0) {
    return { nextHtml: rawHtml, changed: false, migratedObjects: 0 }
  }

  let changed = false
  let migratedObjects = 0
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
      let nextPayload = null

      if (
        (blockType === 'image' || blockType === 'video' || blockType === 'html')
        && payload?.source_type === 'upload'
        && typeof payload.storage_path === 'string'
        && payload.storage_path.trim()
      ) {
        await migrateObject(LESSON_CONTENT_ASSETS_BUCKET, payload.storage_path.trim(), payload.storage_provider ?? 'supabase')
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
        await migrateObject(LESSON_CONTENT_ASSETS_BUCKET, payload.asset.storage_path.trim(), payload.asset.storage_provider ?? 'supabase')
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
        migratedObjects += 1
        changed = true
        replacement = fullMatch.replace(
          `data-hcm-payload="${encodedPayload}"`,
          `data-hcm-payload="${encodeURIComponent(JSON.stringify(nextPayload))}"`,
        )
      }
    }
    catch {
      // Mantém o payload original se não for possível decodificar.
    }

    result += replacement
  }

  result += rawHtml.slice(cursor)
  return {
    nextHtml: result,
    changed,
    migratedObjects,
  }
}

function getInteractionAsset(content) {
  if (!content || typeof content !== 'object') {
    return null
  }
  if (!['drag_drop_labeling', 'image_hotspot', 'coloring'].includes(content.kind)) {
    return null
  }
  const asset = content.asset
  if (!asset || typeof asset !== 'object' || typeof asset.storage_path !== 'string' || !asset.storage_path.trim()) {
    return null
  }
  return asset
}

async function runSection(section, runner) {
  process.stdout.write(`\n[${section}] iniciando...\n`)
  try {
    await runner()
  }
  catch (error) {
    report.failed += 1
    incrementSection(section, 'failed')
    const message = error instanceof Error ? error.message : String(error)
    report.failures.push({ section, message })
    process.stderr.write(`[${section}] falhou: ${message}\n`)
  }
}

async function migrateLessonMaterials() {
  const result = await supabaseAdmin
    .from('lesson_materials')
    .select('id, storage_path, storage_provider')
    .not('storage_path', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const storagePath = row.storage_path?.trim()
    if (!storagePath) {
      incrementSection('lesson_materials', 'skipped')
      continue
    }
    await migrateObject(MATERIALS_BUCKET, storagePath, row.storage_provider ?? 'supabase')
    if (row.storage_provider !== 'r2') {
      await updateRow('lesson_materials', { id: row.id }, { storage_provider: 'r2' })
      report.updatedRows += 1
      incrementSection('lesson_materials', 'updated')
    }
    incrementSection('lesson_materials', 'migrated')
  }
}

async function migrateModulePdfs() {
  const result = await supabaseAdmin
    .from('course_modules')
    .select('id, module_pdf_storage_path, module_pdf_storage_provider')
    .not('module_pdf_storage_path', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const storagePath = row.module_pdf_storage_path?.trim()
    if (!storagePath) {
      incrementSection('module_pdfs', 'skipped')
      continue
    }
    await migrateObject(MODULE_PDFS_BUCKET, storagePath, row.module_pdf_storage_provider ?? 'supabase')
    if (row.module_pdf_storage_provider !== 'r2') {
      await updateRow('course_modules', { id: row.id }, { module_pdf_storage_provider: 'r2' })
      report.updatedRows += 1
      incrementSection('module_pdfs', 'updated')
    }
    incrementSection('module_pdfs', 'migrated')
  }
}

async function migrateSiteAssets() {
  const result = await supabaseAdmin
    .from('site_assets')
    .select('id, storage_path, public_url')
    .not('storage_path', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const storagePath = row.storage_path?.trim()
    if (!storagePath) {
      incrementSection('site_assets', 'skipped')
      continue
    }
    const migrated = await migrateObject(SITE_ASSETS_BUCKET, storagePath)
    if (row.public_url !== migrated.publicUrl) {
      await updateRow('site_assets', { id: row.id }, { public_url: migrated.publicUrl })
      report.updatedRows += 1
      incrementSection('site_assets', 'updated')
    }
    incrementSection('site_assets', 'migrated')
  }
}

async function migrateAssessmentAssets() {
  const result = await supabaseAdmin
    .from('assessment_question_interactions')
    .select('question_id, content')
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const content = cloneJson(row.content)
    const asset = getInteractionAsset(content)
    if (!asset) {
      incrementSection('assessment_assets', 'skipped')
      continue
    }
    await migrateObject(ASSESSMENT_ASSETS_BUCKET, asset.storage_path.trim(), asset.storage_provider ?? 'supabase')
    if (asset.storage_provider !== 'r2') {
      asset.storage_provider = 'r2'
      asset.signed_url = null
      await updateRow('assessment_question_interactions', { question_id: row.question_id }, { content })
      report.updatedRows += 1
      incrementSection('assessment_assets', 'updated')
    }
    incrementSection('assessment_assets', 'migrated')
  }
}

async function migrateLessonContentAssets() {
  const result = await supabaseAdmin
    .from('lessons')
    .select('id, text_content')
    .not('text_content', 'is', null)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const { nextHtml, changed } = await migrateLessonContentPayloads(row.text_content)
    if (!changed) {
      incrementSection('lesson_content_assets', 'skipped')
      continue
    }
    await updateRow('lessons', { id: row.id }, { text_content: nextHtml })
    report.updatedRows += 1
    incrementSection('lesson_content_assets', 'updated')
    incrementSection('lesson_content_assets', 'migrated')
  }
}

async function migrateFooterActionAssets() {
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
    const storagePath = row.storage_path?.trim()
    if (!storagePath) {
      incrementSection('lesson_footer_assets', 'skipped')
      continue
    }
    if (materialPaths.has(storagePath)) {
      incrementSection('lesson_footer_assets', 'skipped')
      continue
    }
    await migrateObject(LESSON_FOOTER_ASSETS_BUCKET, storagePath)
    incrementSection('lesson_footer_assets', 'migrated')
  }
}

async function migrateUrlFieldRows({ section, table, select, fields }) {
  const result = await supabaseAdmin.from(table).select(select)
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const updates = {}
    let hasUpdate = false
    for (const field of fields) {
      const currentUrl = row[field]
      const parsed = parseLegacySupabaseStorageUrl(currentUrl)
      if (!parsed) {
        continue
      }
      const migrated = await migrateObject(parsed.bucket, parsed.objectPath)
      if (currentUrl !== migrated.publicUrl) {
        updates[field] = migrated.publicUrl
        hasUpdate = true
      }
      incrementSection(section, 'migrated')
    }
    if (!hasUpdate) {
      incrementSection(section, 'skipped')
      continue
    }
    await updateRow(table, { id: row.id }, updates)
    report.updatedRows += 1
    incrementSection(section, 'updated')
  }
}

async function migrateCourseMediaUrls() {
  const result = await supabaseAdmin
    .from('courses')
    .select('id, thumbnail_url, cover_image_url, logo_url, student_hero_image_url')
  if (result.error) {
    throw result.error
  }

  for (const row of result.data ?? []) {
    const updates = {}
    let hasUpdate = false

    for (const field of ['thumbnail_url', 'cover_image_url', 'logo_url', 'student_hero_image_url']) {
      const currentUrl = row[field]
      const parsed = parseCourseMediaUrl(currentUrl)
      if (!parsed) {
        continue
      }
      if (parsed.sourceProvider === 'supabase') {
        await migrateObject(COURSE_MEDIA_BUCKET, parsed.objectPath)
      }
      const canonicalUrl = buildCourseMediaPublicUrl(parsed.objectPath)
      if (canonicalUrl && currentUrl !== canonicalUrl) {
        updates[field] = canonicalUrl
        hasUpdate = true
      }
      incrementSection('courses_media_urls', 'migrated')
    }

    if (!hasUpdate) {
      incrementSection('courses_media_urls', 'skipped')
      continue
    }

    await updateRow('courses', { id: row.id }, updates)
    report.updatedRows += 1
    incrementSection('courses_media_urls', 'updated')
  }
}

async function main() {
  process.stdout.write(`Modo: ${dryRun ? 'dry-run' : 'real'}\n`)
  if (selectedSections.size > 0) {
    process.stdout.write(`Seções filtradas: ${Array.from(selectedSections).join(', ')}\n`)
  }

  if (!hasLocalR2Credentials) {
    await runRemoteBackfill()
    return
  }

  if (shouldRunSection('lesson_materials')) await runSection('lesson_materials', migrateLessonMaterials)
  if (shouldRunSection('module_pdfs')) await runSection('module_pdfs', migrateModulePdfs)
  if (shouldRunSection('site_assets')) await runSection('site_assets', migrateSiteAssets)
  if (shouldRunSection('assessment_assets')) await runSection('assessment_assets', migrateAssessmentAssets)
  if (shouldRunSection('lesson_content_assets')) await runSection('lesson_content_assets', migrateLessonContentAssets)
  if (shouldRunSection('lesson_footer_assets')) await runSection('lesson_footer_assets', migrateFooterActionAssets)
  if (shouldRunSection('profiles_avatar_url')) await runSection('profiles_avatar_url', () => migrateUrlFieldRows({
    section: 'profiles_avatar_url',
    table: 'profiles',
    select: 'id, avatar_url',
    fields: ['avatar_url'],
  }))
  if (shouldRunSection('courses_media_urls')) await runSection('courses_media_urls', migrateCourseMediaUrls)
  if (shouldRunSection('support_ticket_attachments')) await runSection('support_ticket_attachments', () => migrateUrlFieldRows({
    section: 'support_ticket_attachments',
    table: 'support_tickets',
    select: 'id, attachment_url',
    fields: ['attachment_url'],
  }))
  if (shouldRunSection('support_message_attachments')) await runSection('support_message_attachments', () => migrateUrlFieldRows({
    section: 'support_message_attachments',
    table: 'support_messages',
    select: 'id, attachment_url',
    fields: ['attachment_url'],
  }))

  process.stdout.write('\nResumo de migração:\n')
  process.stdout.write(`${JSON.stringify({
    dryRun,
    objectsCopied: report.objectsCopied,
    objectsAlreadyInR2: report.objectsAlreadyInR2,
    updatedRows: report.updatedRows,
    failed: report.failed,
    sections: report.sections,
    failures: report.failures,
  }, null, 2)}\n`)

  if (report.failures.length > 0) {
    process.exitCode = 1
  }
}

await main()

async function runRemoteBackfill() {
  process.stdout.write('Credenciais locais de escrita no R2 ausentes. Usando edge function operacional com os secrets do Supabase.\n')
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || ''
  const maintenanceToken = process.env.BACKFILL_ADMIN_TOKEN?.trim() || process.env.SUPABASE_ACCESS_TOKEN?.trim() || ''
  for (const sectionConfig of remoteSections) {
    const section = sectionConfig.name
    if (!shouldRunSection(section)) {
      continue
    }
    let batchOffset = 0
    let batchNumber = 1

    do {
      const label = sectionConfig.batchSize
        ? `${section} lote ${batchNumber} (offset ${batchOffset})`
        : section
      process.stdout.write(`\n[${label}] iniciando via edge function...\n`)

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-backfill-storage-r2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { apikey: anonKey } : {}),
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          maintenance_token: maintenanceToken,
          service_role_key: supabaseServiceRoleKey,
          section,
          ...(sectionConfig.batchSize ? {
            batch_offset: batchOffset,
            batch_limit: sectionConfig.batchSize,
          } : {}),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Falha ao executar backfill remoto da seção ${section}.`)
      }
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)

      if (!sectionConfig.batchSize || !payload?.has_more) {
        break
      }

      batchOffset = Number.isInteger(payload?.next_offset) ? Number(payload.next_offset) : batchOffset + sectionConfig.batchSize
      batchNumber += 1
    } while (true)
  }
}
