import type {
  LessonImageHotspotsAsset,
  LessonImageHotspotsBlockContent,
  LessonImageHotspotItem,
} from '@/types/content'

export type LessonContentBlock =
  | {
      type: 'rich-text'
      content: string
    }
  | {
      type: 'table'
      content: string
    }
  | {
      type: 'image-hotspots'
      content: LessonImageHotspotsBlockContent
    }

const TABLE_PLACEHOLDER_PREFIX = '__TABLE_BLOCK__'
const HOTSPOTS_PLACEHOLDER_PREFIX = '__HOTSPOTS_BLOCK__'
const LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR = 'data-hcm-block'
const LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR = 'data-hcm-payload'
const LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE = 'image-hotspots'

const ALLOWED_TABLE_TAGS = new Set([
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
])

const ALLOWED_TABLE_ATTRS = new Set([
  'colspan',
  'rowspan',
  'scope',
  'span',
])

const ALLOWED_HOTSPOT_BODY_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'u',
  'ul',
])

const ALLOWED_HOTSPOT_BODY_ATTRS = new Set(['href', 'target', 'rel'])

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof DOMParser !== 'undefined'
}

function hasTableLikeMarkup(html: string): boolean {
  return /<table[\s>]/i.test(html)
}

function containsForbiddenTableFragments(html: string): boolean {
  return /<(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)\b/i.test(html)
}

function normalizeHtml(html: string): string {
  return html.replace(/\uFEFF/g, '').trim()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function createFallbackBlock(html: string): LessonContentBlock[] {
  return [{ type: 'rich-text', content: html }]
}

function isSafeAnchorHref(value: string) {
  return /^(https?:|mailto:|tel:|#|\/)/i.test(value)
}

/**
 * Remove comentários, scripts e estilos.
 */
function removeDangerousNodes(root: ParentNode): void {
  root.querySelectorAll('script, style, iframe, object, embed').forEach((node) => {
    node.remove()
  })
}

function sanitizeHotspotBodyNode(element: Element): void {
  const tag = element.tagName.toLowerCase()

  if (!ALLOWED_HOTSPOT_BODY_TAGS.has(tag)) {
    const parent = element.parentNode
    if (!parent) {
      element.remove()
      return
    }

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element)
    }
    element.remove()
    return
  }

  ;[...element.attributes].forEach((attribute) => {
    const name = attribute.name.toLowerCase()
    if (
      name === 'style'
      || name.startsWith('on')
      || !ALLOWED_HOTSPOT_BODY_ATTRS.has(name)
    ) {
      element.removeAttribute(attribute.name)
      return
    }

    if (name === 'href' && !isSafeAnchorHref(attribute.value)) {
      element.removeAttribute(attribute.name)
      return
    }

    if (name === 'target' && attribute.value !== '_blank') {
      element.setAttribute('target', '_blank')
    }
  })

  if (tag === 'a') {
    const href = element.getAttribute('href')
    if (href) {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noreferrer noopener')
    }
  }

  ;[...element.children].forEach((child) => sanitizeHotspotBodyNode(child))
}

export function sanitizeHotspotBodyHtml(bodyHtml: string): string {
  const source = normalizeHtml(bodyHtml)
  if (!source || !isBrowser()) {
    return source
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, 'text/html')
  removeDangerousNodes(doc)

  ;[...doc.body.children].forEach((child) => sanitizeHotspotBodyNode(child))
  return normalizeHtml(doc.body.innerHTML)
}

function normalizeHotspotItem(
  item: LessonImageHotspotItem,
  index: number,
): LessonImageHotspotItem {
  return {
    id: item.id.trim() || crypto.randomUUID(),
    x: roundPercent(clamp(Number(item.x) || 0, 0, 100)),
    y: roundPercent(clamp(Number(item.y) || 0, 0, 100)),
    title: item.title?.trim() || `Hotspot ${index + 1}`,
    body_html: sanitizeHotspotBodyHtml(item.body_html || '<p></p>'),
  }
}

function normalizeHotspotsAsset(asset: LessonImageHotspotsAsset): LessonImageHotspotsAsset {
  return {
    storage_path: asset.storage_path?.trim() || '',
    signed_url: asset.signed_url?.trim() || null,
    alt: asset.alt?.trim() || 'Imagem interativa da aula',
    width: Math.max(1, Number(asset.width) || 1600),
    height: Math.max(1, Number(asset.height) || 900),
  }
}

export function normalizeLessonImageHotspotsBlockContent(
  content: LessonImageHotspotsBlockContent,
): LessonImageHotspotsBlockContent {
  return {
    asset: normalizeHotspotsAsset(content.asset),
    hotspots: (content.hotspots ?? []).map(normalizeHotspotItem),
  }
}

function parseHotspotsAsset(value: unknown): LessonImageHotspotsAsset | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<LessonImageHotspotsAsset>
  if (typeof candidate.storage_path !== 'string') {
    return null
  }

  return normalizeHotspotsAsset({
    storage_path: candidate.storage_path,
    signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
    alt: typeof candidate.alt === 'string' ? candidate.alt : 'Imagem interativa da aula',
    width: Number(candidate.width) || 1600,
    height: Number(candidate.height) || 900,
  })
}

function parseHotspotItem(value: unknown, index: number): LessonImageHotspotItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<LessonImageHotspotItem>
  if (typeof candidate.id !== 'string') {
    return null
  }

  return normalizeHotspotItem({
    id: candidate.id,
    x: Number(candidate.x) || 0,
    y: Number(candidate.y) || 0,
    title: typeof candidate.title === 'string' ? candidate.title : `Hotspot ${index + 1}`,
    body_html: typeof candidate.body_html === 'string' ? candidate.body_html : '<p></p>',
  }, index)
}

export function parseLessonImageHotspotsBlockContent(
  payload: unknown,
): LessonImageHotspotsBlockContent | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    asset?: unknown
    hotspots?: unknown
  }

  const asset = parseHotspotsAsset(candidate.asset)
  if (!asset) {
    return null
  }

  const hotspots = Array.isArray(candidate.hotspots)
    ? candidate.hotspots
        .map((item, index) => parseHotspotItem(item, index))
        .filter((item): item is LessonImageHotspotItem => item !== null)
    : []

  return {
    asset,
    hotspots,
  }
}

export function createEmptyLessonImageHotspotsBlockContent(): LessonImageHotspotsBlockContent {
  return {
    asset: {
      storage_path: '',
      signed_url: null,
      alt: 'Imagem interativa da aula',
      width: 1600,
      height: 900,
    },
    hotspots: [],
  }
}

function encodeHotspotsPayload(content: LessonImageHotspotsBlockContent): string {
  return encodeURIComponent(JSON.stringify({
    asset: {
      storage_path: content.asset.storage_path,
      alt: content.asset.alt,
      width: content.asset.width,
      height: content.asset.height,
    },
    hotspots: content.hotspots.map((hotspot) => ({
      id: hotspot.id,
      x: hotspot.x,
      y: hotspot.y,
      title: hotspot.title,
      body_html: sanitizeHotspotBodyHtml(hotspot.body_html),
    })),
  }))
}

function decodeHotspotsPayload(encodedPayload: string): LessonImageHotspotsBlockContent | null {
  try {
    const decoded = decodeURIComponent(encodedPayload)
    return parseLessonImageHotspotsBlockContent(JSON.parse(decoded))
  } catch {
    return null
  }
}

function buildHotspotsFallbackHtml(content: LessonImageHotspotsBlockContent): string {
  const titles = content.hotspots
    .map((hotspot) => `<li>${escapeHtml(hotspot.title)}</li>`)
    .join('')

  return `
    <div class="hcm-image-hotspots-fallback">
      <p><strong>Bloco interativo de imagem.</strong></p>
      ${titles ? `<ul>${titles}</ul>` : '<p>Nenhum hotspot configurado.</p>'}
    </div>
  `
}

export function serializeLessonImageHotspotsBlock(
  content: LessonImageHotspotsBlockContent,
): string {
  const normalized = normalizeLessonImageHotspotsBlockContent(content)
  const payload = encodeHotspotsPayload(normalized)

  return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildHotspotsFallbackHtml(normalized)}
    </div>
  `
}

function extractLessonImageHotspotsBlock(
  element: Element,
): LessonContentBlock | null {
  const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR)
  if (!payload) {
    return null
  }

  const content = decodeHotspotsPayload(payload)
  if (!content) {
    return null
  }

  return {
    type: 'image-hotspots',
    content,
  }
}

export function parseLessonImageHotspotsBlockElement(
  element: Element,
): LessonImageHotspotsBlockContent | null {
  if (
    element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE
  ) {
    return null
  }

  const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR)
  if (!payload) {
    return null
  }

  return decodeHotspotsPayload(payload)
}

/**
 * Sanitiza uma tabela preservando apenas estrutura segura e atributos mínimos.
 * Remove qualquer tag fora da whitelist em vez de "desembrulhar" de forma agressiva.
 */
export function sanitizeTableHtml(tableHtml: string): string {
  if (!isBrowser()) {
    return tableHtml
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(tableHtml, 'text/html')
  const table = doc.querySelector('table')

  if (!table) {
    return ''
  }

  removeDangerousNodes(doc)

  const sanitizeElement = (el: Element): void => {
    const tag = el.tagName.toLowerCase()

    if (!ALLOWED_TABLE_TAGS.has(tag)) {
      el.remove()
      return
    }

    ;[...el.attributes].forEach((attr) => {
      const attrName = attr.name.toLowerCase()

      if (
        attrName === 'style'
        || attrName.startsWith('on')
        || !ALLOWED_TABLE_ATTRS.has(attrName)
      ) {
        el.removeAttribute(attr.name)
      }
    })

    ;[...el.children].forEach((child) => {
      sanitizeElement(child)
    })
  }

  sanitizeElement(table)

  table.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    if (!ALLOWED_TABLE_TAGS.has(tag)) {
      el.remove()
    }
  })

  table.querySelectorAll('th, td').forEach((cell) => {
    const hasChildElements = cell.children.length > 0
    const cellText = cell.textContent?.replace(/\u00a0/g, ' ').trim() ?? ''

    if (!hasChildElements && cellText === '') {
      cell.setAttribute('data-empty-cell', 'true')
    } else {
      cell.removeAttribute('data-empty-cell')
    }
  })

  return table.outerHTML
}

/**
 * Extrai blocos especiais do HTML preservando a ordem do conteúdo.
 */
export function splitContent(html: string): LessonContentBlock[] {
  const source = normalizeHtml(html)

  if (!source) {
    return []
  }

  if (!isBrowser()) {
    return createFallbackBlock(source)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, 'text/html')

  const originalHadTable = hasTableLikeMarkup(source)
  const parsedTables = Array.from(doc.querySelectorAll('table'))

  if (originalHadTable && parsedTables.length === 0) {
    return createFallbackBlock(source)
  }

  removeDangerousNodes(doc)

  const blockMap = new Map<string, LessonContentBlock>()

  Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE}"]`))
    .forEach((element, index) => {
      const placeholder = `${HOTSPOTS_PLACEHOLDER_PREFIX}_${index}__`
      const parsedBlock = extractLessonImageHotspotsBlock(element)

      blockMap.set(
        placeholder,
        parsedBlock ?? {
          type: 'rich-text',
          content: normalizeHtml((element as HTMLElement).innerHTML),
        },
      )

      const marker = doc.createTextNode(placeholder)
      element.replaceWith(marker)
    })

  const tableMap = new Map<string, string>()

  Array.from(doc.querySelectorAll('table')).forEach((table, index) => {
    const placeholder = `${TABLE_PLACEHOLDER_PREFIX}_${index}__`
    const sanitizedTable = sanitizeTableHtml(table.outerHTML)

    tableMap.set(placeholder, sanitizedTable || table.outerHTML)

    const marker = doc.createTextNode(placeholder)
    table.replaceWith(marker)
  })

  const rawHtml = doc.body.innerHTML
  if (!rawHtml) {
    return []
  }

  const blocks: LessonContentBlock[] = []
  const placeholderRegex = new RegExp(
    `(${TABLE_PLACEHOLDER_PREFIX}_\\d+__|${HOTSPOTS_PLACEHOLDER_PREFIX}_\\d+__)`,
    'g',
  )
  const parts = rawHtml.split(placeholderRegex)

  for (const part of parts) {
    if (!part) continue

    const mappedBlock = blockMap.get(part)
    if (mappedBlock) {
      blocks.push(mappedBlock)
      continue
    }

    if (tableMap.has(part)) {
      blocks.push({
        type: 'table',
        content: tableMap.get(part)!,
      })
      continue
    }

    const cleaned = normalizeHtml(part)

    if (!cleaned) continue

    if (containsForbiddenTableFragments(cleaned)) {
      blocks.push({
        type: 'rich-text',
        content: cleaned
          .replace(/<(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)\b[^>]*>/gi, '')
          .replace(/<\/(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)>/gi, ''),
      })
      continue
    }

    blocks.push({
      type: 'rich-text',
      content: cleaned,
    })
  }

  return blocks
}

/**
 * Recompõe o HTML final preservando a ordem original dos blocos.
 */
export function mergeContent(blocks: LessonContentBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return ''
  }

  return blocks
    .map((block) => {
      if (block.type === 'table') {
        return normalizeHtml(sanitizeTableHtml(block.content))
      }

      if (block.type === 'image-hotspots') {
        return normalizeHtml(serializeLessonImageHotspotsBlock(block.content))
      }

      return normalizeHtml(block.content)
    })
    .filter(Boolean)
    .join('')
}
