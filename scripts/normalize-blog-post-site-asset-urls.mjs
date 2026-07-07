import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SITE_ASSET_BUCKET = 'site-assets'
const SITE_ASSET_PROXY_PATH = '/api/public/site-asset'
const LEGACY_SUPABASE_SITE_ASSET_PROXY_PATH = '/functions/v1/public-site-asset'
const R2_HOST_PATTERNS = [/\.r2\.cloudflarestorage\.com$/i, /\.r2\.dev$/i]
const PAGE_SIZE = 200

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

function trimToNull(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function normalizeSupabaseUrl(value) {
  return (trimToNull(value) ?? '').replace(/\/+$/, '')
}

function normalizeSiteAssetStoragePath(value) {
  const normalized = (trimToNull(value) ?? '').replace(/^\/+/, '')
  if (!normalized) {
    return ''
  }
  if (/^[a-z]+:\/\//i.test(normalized)) {
    return ''
  }
  if (normalized.startsWith(`${SITE_ASSET_BUCKET}/http://`) || normalized.startsWith(`${SITE_ASSET_BUCKET}/https://`)) {
    return ''
  }
  if (normalized.startsWith(`${SITE_ASSET_BUCKET}/`)) {
    return normalized
  }
  if (!normalized.includes('/')) {
    return ''
  }
  return normalized
}

function extractSiteAssetStoragePathFromProxyUrl(parsedUrl, supabaseUrl) {
  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, '')
  const isCurrentAppProxy = normalizedPathname.endsWith(SITE_ASSET_PROXY_PATH)
  const isLegacySupabaseProxy = normalizedPathname.endsWith(LEGACY_SUPABASE_SITE_ASSET_PROXY_PATH)
  if (!isCurrentAppProxy && !isLegacySupabaseProxy) {
    return null
  }
  const rawStoragePath = trimToNull(parsedUrl.searchParams.get('storage_path'))
  const normalizedStoragePath = normalizeSiteAssetStoragePath(rawStoragePath)
  if (normalizedStoragePath) {
    return normalizedStoragePath
  }
  if (!rawStoragePath) {
    return null
  }
  if (rawStoragePath.startsWith(`${SITE_ASSET_BUCKET}/http://`) || rawStoragePath.startsWith(`${SITE_ASSET_BUCKET}/https://`)) {
    return extractSiteAssetStoragePathFromUrl(rawStoragePath.slice(SITE_ASSET_BUCKET.length + 1), supabaseUrl)
  }
  return null
}

function extractSiteAssetStoragePathFromSupabaseUrl(parsedUrl, supabaseUrl) {
  if (!supabaseUrl) {
    return null
  }

  let supabaseOrigin = ''
  try {
    supabaseOrigin = new URL(supabaseUrl).origin
  }
  catch {
    return null
  }

  if (parsedUrl.origin !== supabaseOrigin) {
    return null
  }

  const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/site-assets\/(.+)$/i)
  if (!match) {
    return null
  }

  return normalizeSiteAssetStoragePath(decodeURIComponent(match[1]))
}

function extractSiteAssetStoragePathFromR2Url(parsedUrl) {
  if (!R2_HOST_PATTERNS.some((pattern) => pattern.test(parsedUrl.hostname))) {
    return null
  }

  const decodedPath = decodeURIComponent(parsedUrl.pathname)
  const match = decodedPath.match(/\/(?:[^/]+\/)?(site-assets\/.+)$/i)
  if (!match) {
    return null
  }

  return normalizeSiteAssetStoragePath(match[1])
}

function buildSiteAssetPublicUrl(storagePath, supabaseUrl) {
  const normalizedStoragePath = normalizeSiteAssetStoragePath(storagePath)
  const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseUrl)
  if (!normalizedStoragePath || !normalizedSupabaseUrl) {
    return ''
  }
  return `${normalizedSupabaseUrl}${SITE_ASSET_PROXY_PATH}?storage_path=${encodeURIComponent(normalizedStoragePath)}`
}

function extractSiteAssetStoragePathFromUrl(rawUrl, supabaseUrl) {
  const normalizedUrl = trimToNull(rawUrl)
  if (!normalizedUrl) {
    return null
  }
  if (/^https?:\/\//i.test(normalizedUrl)) {
    let parsedUrl
    try {
      parsedUrl = new URL(normalizedUrl)
    }
    catch {
      return null
    }

    return extractSiteAssetStoragePathFromProxyUrl(parsedUrl, supabaseUrl)
      ?? extractSiteAssetStoragePathFromSupabaseUrl(parsedUrl, supabaseUrl)
      ?? extractSiteAssetStoragePathFromR2Url(parsedUrl)
  }

  return normalizeSiteAssetStoragePath(normalizedUrl) || null
}

function normalizeSiteAssetPublicUrl(rawUrl, supabaseUrl) {
  const normalizedUrl = trimToNull(rawUrl)
  if (!normalizedUrl) {
    return null
  }

  const storagePath = extractSiteAssetStoragePathFromUrl(normalizedUrl, supabaseUrl)
  if (!storagePath) {
    return normalizedUrl
  }

  return buildSiteAssetPublicUrl(storagePath, supabaseUrl) || normalizedUrl
}

loadEnvFile(join(process.cwd(), '.env'))
loadEnvFile(join(process.cwd(), '.env.local'))

for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Variável obrigatória ausente: ${key}`)
  }
}

if (!process.env.APP_PUBLIC_URL?.trim()) {
  throw new Error('Variável obrigatória ausente: APP_PUBLIC_URL')
}

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL)
const publicAppUrl = normalizeSupabaseUrl(process.env.APP_PUBLIC_URL)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
const dryRun = process.argv.includes('--dry-run')

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const report = {
  dryRun,
  blogPostsScanned: 0,
  blogPostsUpdated: 0,
  revisionSnapshotsScanned: 0,
  revisionSnapshotsUpdated: 0,
  changedBlogSlugs: [],
  failures: [],
}

const siteAssetPathCache = new Map()

function toComparableValue(value) {
  return trimToNull(value)
}

async function resolveCanonicalSiteAssetPath(rawValue) {
  const currentValue = toComparableValue(rawValue)
  if (!currentValue) {
    return null
  }
  const extractedPath = extractSiteAssetStoragePathFromUrl(currentValue, supabaseUrl)
  if (!extractedPath) {
    return null
  }
  const cacheKey = extractedPath
  if (siteAssetPathCache.has(cacheKey)) {
    return siteAssetPathCache.get(cacheKey)
  }

  const candidates = Array.from(new Set([
    extractedPath,
    extractedPath.startsWith(`${SITE_ASSET_BUCKET}/`) ? extractedPath.slice(SITE_ASSET_BUCKET.length + 1) : `${SITE_ASSET_BUCKET}/${extractedPath}`,
  ].filter(Boolean)))

  const result = await supabaseAdmin
    .from('site_assets')
    .select('storage_path')
    .in('storage_path', candidates)
    .limit(candidates.length)

  if (result.error) {
    throw result.error
  }

  const rows = result.data ?? []
  let canonicalPath = extractedPath
  for (const candidate of candidates) {
    const match = rows.find((row) => row.storage_path === candidate)
    if (match?.storage_path) {
      canonicalPath = match.storage_path
      break
    }
  }

  siteAssetPathCache.set(cacheKey, canonicalPath)
  return canonicalPath
}

async function maybeAssignNormalizedUrl(target, field, rawValue) {
  const currentValue = toComparableValue(rawValue)
  const canonicalPath = await resolveCanonicalSiteAssetPath(currentValue)
  const normalizedValue = canonicalPath
    ? buildSiteAssetPublicUrl(canonicalPath, publicAppUrl)
    : normalizeSiteAssetPublicUrl(currentValue, publicAppUrl)
  if (normalizedValue !== currentValue) {
    target[field] = normalizedValue
    return true
  }
  return false
}

async function updateBlogPostsPage(from, to) {
  const result = await supabaseAdmin
    .from('blog_posts')
    .select('id, slug, image_url, card_image_url, seo_og_image_url')
    .order('id', { ascending: true })
    .range(from, to)

  if (result.error) {
    throw result.error
  }

  const rows = result.data ?? []
  for (const row of rows) {
    report.blogPostsScanned += 1
    const updates = {}
    const changed = [
      await maybeAssignNormalizedUrl(updates, 'image_url', row.image_url),
      await maybeAssignNormalizedUrl(updates, 'card_image_url', row.card_image_url),
      await maybeAssignNormalizedUrl(updates, 'seo_og_image_url', row.seo_og_image_url),
    ].some(Boolean)

    if (!changed) {
      continue
    }

    if (!dryRun) {
      const updateResult = await supabaseAdmin
        .from('blog_posts')
        .update(updates)
        .eq('id', row.id)
      if (updateResult.error) {
        throw updateResult.error
      }
    }

    report.blogPostsUpdated += 1
    report.changedBlogSlugs.push(row.slug)
    process.stdout.write(`[blog_posts] ${row.slug} atualizado.\n`)
  }

  return rows.length
}

function cloneSnapshot(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value))
}

async function updateRevisionSnapshotsPage(from, to) {
  const result = await supabaseAdmin
    .from('blog_post_revisions')
    .select('id, article_id, revision_number, snapshot')
    .order('id', { ascending: true })
    .range(from, to)

  if (result.error) {
    throw result.error
  }

  const rows = result.data ?? []
  for (const row of rows) {
    report.revisionSnapshotsScanned += 1
    const snapshot = cloneSnapshot(row.snapshot)
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      continue
    }

    let changed = false
    changed = await maybeAssignNormalizedUrl(snapshot, 'cover_image_url', snapshot.cover_image_url) || changed
    changed = await maybeAssignNormalizedUrl(snapshot, 'card_image_url', snapshot.card_image_url) || changed
    changed = await maybeAssignNormalizedUrl(snapshot, 'seo_og_image_url', snapshot.seo_og_image_url) || changed

    if (!changed) {
      continue
    }

    if (!dryRun) {
      const updateResult = await supabaseAdmin
        .from('blog_post_revisions')
        .update({ snapshot })
        .eq('id', row.id)
      if (updateResult.error) {
        throw updateResult.error
      }
    }

    report.revisionSnapshotsUpdated += 1
    process.stdout.write(`[blog_post_revisions] artigo ${row.article_id} revisão ${row.revision_number} atualizada.\n`)
  }

  return rows.length
}

async function paginate(label, runner) {
  let offset = 0
  while (true) {
    const rowCount = await runner(offset, offset + PAGE_SIZE - 1)
    if (rowCount < PAGE_SIZE) {
      break
    }
    offset += PAGE_SIZE
    process.stdout.write(`[${label}] processados ${offset} registros...\n`)
  }
}

async function main() {
  process.stdout.write(`Modo: ${dryRun ? 'dry-run' : 'real'}\n`)

  await paginate('blog_posts', updateBlogPostsPage)
  await paginate('blog_post_revisions', updateRevisionSnapshotsPage)

  process.stdout.write('\nResumo:\n')
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  report.failures.push(message)
  process.stderr.write(`${message}\n`)
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exit(1)
})
