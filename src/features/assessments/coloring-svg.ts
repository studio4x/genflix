import type { ColoringSvgRegion } from '@/types/content'

const SVG_REGION_ATTR = 'data-hcm-region-id'
const SVG_REGION_LABEL_ATTR = 'data-hcm-region-label'
const SVG_FILLABLE_ATTR = 'data-hcm-fillable'
const SVG_ORIGINAL_FILL_ATTR = 'data-hcm-original-fill'
const SVG_ORIGINAL_STROKE_ATTR = 'data-hcm-original-stroke'
const SVG_ORIGINAL_STROKE_WIDTH_ATTR = 'data-hcm-original-stroke-width'
const SVG_PAINTABLE_TAGS = ['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse']
const SVG_CANDIDATE_TAGS = [...SVG_PAINTABLE_TAGS, 'g']
const SVG_FORBIDDEN_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'audio',
  'video',
  'canvas',
  'object',
  'embed',
  'link',
])
const DEFAULT_EMPTY_FILL = '#ffffff'

export interface ParsedColoringSvgAsset {
  width: number
  height: number
  svgMarkup: string
  regions: ColoringSvgRegion[]
}

export interface ColoringSvgRuntimeOptions {
  regionAssignments?: Record<string, string | null>
  colorHexByTokenId?: Map<string, string>
  selectedRegionId?: string | null
  interactive?: boolean
}

function getCandidateRegionId(element: Element) {
  return (
    element.getAttribute('data-region-id')
    ?? element.getAttribute('data-region')
    ?? element.getAttribute('id')
    ?? ''
  ).trim()
}

function normalizeRegionLabel(regionId: string) {
  const normalized = regionId
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return 'Regiao'
  }

  return normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isSvgElementTag(element: Element, tagNames: string[]) {
  return tagNames.includes(element.tagName.toLowerCase())
}

function getInlineStyleValue(element: Element, propertyName: string) {
  const styleValue = element.getAttribute('style') ?? ''
  if (!styleValue.trim()) {
    return ''
  }

  for (const declaration of styleValue.split(';')) {
    const [rawProperty, rawValue] = declaration.split(':')
    if (!rawProperty || !rawValue) {
      continue
    }

    if (rawProperty.trim().toLowerCase() === propertyName.toLowerCase()) {
      return rawValue.trim()
    }
  }

  return ''
}

function getPresentationValue(element: Element, attributeName: string) {
  const directValue = element.getAttribute(attributeName)?.trim() ?? ''
  if (directValue) {
    return directValue
  }

  return getInlineStyleValue(element, attributeName)
}

function isForbiddenSvgElement(element: Element) {
  return SVG_FORBIDDEN_TAGS.has(element.tagName.toLowerCase())
}

function removeUnsafeAttributes(element: Element) {
  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    if (attributeName.startsWith('on')) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (attributeName === 'href' || attributeName === 'xlink:href') {
      element.removeAttribute(attribute.name)
      continue
    }
  }
}

function sanitizeSvgTree(root: Element) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  const nodesToRemove: Element[] = []

  while (walker.nextNode()) {
    const current = walker.currentNode as Element
    if (isForbiddenSvgElement(current)) {
      nodesToRemove.push(current)
      continue
    }

    removeUnsafeAttributes(current)
  }

  for (const element of nodesToRemove) {
    element.remove()
  }
}

function getColorableNodesForRegion(element: Element) {
  if (isSvgElementTag(element, SVG_PAINTABLE_TAGS)) {
    return isPaintableShape(element) ? [element] : []
  }

  if (!isSvgElementTag(element, ['g'])) {
    return []
  }

  return [...element.querySelectorAll(SVG_PAINTABLE_TAGS.join(','))].filter((node) => {
    const closestRegionElement = node.closest(`[${SVG_REGION_ATTR}]`)
    return closestRegionElement === element && isPaintableShape(node)
  })
}

function isPaintableShape(element: Element) {
  const explicitFill = getPresentationValue(element, 'fill').toLowerCase()
  const stroke = getPresentationValue(element, 'stroke').toLowerCase()
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'polyline') {
    return explicitFill !== 'none'
  }

  if (tagName === 'path') {
    const pathData = (element.getAttribute('d') ?? '').trim()
    return pathData.length > 0
  }

  if (['rect', 'circle', 'ellipse', 'polygon'].includes(tagName)) {
    return true
  }

  if (explicitFill === 'none' && stroke && stroke !== 'none') {
    return true
  }

  return Boolean(explicitFill || stroke || isSvgElementTag(element, SVG_PAINTABLE_TAGS))
}

function ensureDefaultPaintState(element: Element) {
  const fill = getPresentationValue(element, 'fill')
  const stroke = getPresentationValue(element, 'stroke')
  const strokeWidth = getPresentationValue(element, 'stroke-width')

  element.setAttribute(SVG_FILLABLE_ATTR, 'true')
  element.setAttribute(SVG_ORIGINAL_FILL_ATTR, fill ?? '')
  element.setAttribute(SVG_ORIGINAL_STROKE_ATTR, stroke ?? '')
  element.setAttribute(SVG_ORIGINAL_STROKE_WIDTH_ATTR, strokeWidth ?? '')

  if (!fill || fill.trim().toLowerCase() === 'currentcolor' || fill.trim().toLowerCase() === 'none') {
    element.setAttribute('fill', DEFAULT_EMPTY_FILL)
  }

  element.setAttribute('pointer-events', 'all')
}

function parseSvgDimensions(svg: Element) {
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const [, , widthRaw, heightRaw] = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number(value))

    if (Number.isFinite(widthRaw) && widthRaw > 0 && Number.isFinite(heightRaw) && heightRaw > 0) {
      return {
        width: widthRaw,
        height: heightRaw,
      }
    }
  }

  const width = Number.parseFloat(svg.getAttribute('width') ?? '')
  const height = Number.parseFloat(svg.getAttribute('height') ?? '')

  return {
    width: Number.isFinite(width) && width > 0 ? width : 1200,
    height: Number.isFinite(height) && height > 0 ? height : 800,
  }
}

function buildDefaultPlaceholderSvg(regionId: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" fill="none">
      <rect width="1200" height="800" rx="40" fill="#F8FAFC" />
      <path d="M220 210C220 176.863 246.863 150 280 150H920C953.137 150 980 176.863 980 210V590C980 623.137 953.137 650 920 650H280C246.863 650 220 623.137 220 590V210Z" fill="#ffffff" stroke="#0F172A" stroke-width="18"/>
      <path id="${regionId}" d="M330 270C330 247.909 347.909 230 370 230H830C852.091 230 870 247.909 870 270V530C870 552.091 852.091 570 830 570H370C347.909 570 330 552.091 330 530V270Z" fill="#ffffff" stroke="#0F172A" stroke-width="12"/>
      <path d="M460 338H742" stroke="#94A3B8" stroke-width="12" stroke-linecap="round"/>
      <path d="M460 402H650" stroke="#CBD5E1" stroke-width="12" stroke-linecap="round"/>
      <path d="M460 466H700" stroke="#CBD5E1" stroke-width="12" stroke-linecap="round"/>
      <text x="600" y="170" text-anchor="middle" fill="#0F172A" font-size="34" font-family="Arial, sans-serif" font-weight="700">Envie um SVG preparado para o quiz de colorir</text>
      <text x="600" y="628" text-anchor="middle" fill="#475569" font-size="26" font-family="Arial, sans-serif">Cada regiao precisa ter id ou data-region-id proprio</text>
    </svg>
  `.trim()
}

export function isSvgFile(file: File) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

export function createDefaultColoringSvgAsset() {
  const regionId = 'region-1'
  return parseColoringSvgMarkup(buildDefaultPlaceholderSvg(regionId))
}

export async function parseColoringSvgFile(file: File) {
  const svgText = await file.text()
  return parseColoringSvgMarkup(svgText)
}

export function parseColoringSvgMarkup(svgText: string): ParsedColoringSvgAsset {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(svgText, 'image/svg+xml')
  const parserError = documentNode.querySelector('parsererror')

  if (parserError) {
    throw new Error('O SVG enviado esta invalido. Corrija o arquivo e tente novamente.')
  }

  const svg = documentNode.documentElement
  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    throw new Error('Envie um arquivo SVG valido para o modo de colorir por regioes.')
  }

  sanitizeSvgTree(svg)

  const seenRegionIds = new Set<string>()
  const regions: ColoringSvgRegion[] = []

  for (const element of [...svg.querySelectorAll(SVG_CANDIDATE_TAGS.join(','))]) {
    const regionId = getCandidateRegionId(element)
    if (!regionId || seenRegionIds.has(regionId)) {
      continue
    }

    const nearestAncestorRegion = element.parentElement?.closest?.(`[${SVG_REGION_ATTR}]`)
    if (nearestAncestorRegion) {
      continue
    }

    const colorableNodes = getColorableNodesForRegion(element)
    if (colorableNodes.length === 0) {
      continue
    }

    element.setAttribute(SVG_REGION_ATTR, regionId)
    element.setAttribute(SVG_REGION_LABEL_ATTR, normalizeRegionLabel(regionId))

    for (const node of colorableNodes) {
      ensureDefaultPaintState(node)
    }

    regions.push({
      region_id: regionId,
      label: normalizeRegionLabel(regionId),
    })
    seenRegionIds.add(regionId)
  }

  if (regions.length === 0) {
    throw new Error('Nao encontramos regioes utilizaveis no SVG. Use ids ou data-region-id nas pecas pintaveis, mesmo quando elas estiverem com fill:none.')
  }

  const serializer = new XMLSerializer()
  const dimensions = parseSvgDimensions(svg)

  return {
    width: dimensions.width,
    height: dimensions.height,
    svgMarkup: serializer.serializeToString(svg),
    regions,
  }
}

function getPaintNodesForRuntime(regionElement: Element) {
  const fillableChildren = [...regionElement.querySelectorAll(`[${SVG_FILLABLE_ATTR}="true"]`)]
  if (fillableChildren.length > 0) {
    return fillableChildren
  }

  return regionElement.getAttribute(SVG_FILLABLE_ATTR) === 'true' ? [regionElement] : []
}

function restorePaintNode(node: Element) {
  const originalFill = node.getAttribute(SVG_ORIGINAL_FILL_ATTR) ?? ''
  const originalStroke = node.getAttribute(SVG_ORIGINAL_STROKE_ATTR) ?? ''
  const originalStrokeWidth = node.getAttribute(SVG_ORIGINAL_STROKE_WIDTH_ATTR) ?? ''

  if (originalFill && originalFill.trim().toLowerCase() !== 'none') {
    node.setAttribute('fill', originalFill)
  } else {
    node.setAttribute('fill', DEFAULT_EMPTY_FILL)
  }

  if (originalStroke) {
    node.setAttribute('stroke', originalStroke)
  }

  if (originalStrokeWidth) {
    node.setAttribute('stroke-width', originalStrokeWidth)
  }
}

export function applyColoringSvgRuntimeState(
  container: HTMLElement | null,
  options: ColoringSvgRuntimeOptions = {},
) {
  if (!container) {
    return
  }

  const svg = container.querySelector('svg')
  if (!svg) {
    return
  }

  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet')

  const regionElements = [...svg.querySelectorAll(`[${SVG_REGION_ATTR}]`)]

  for (const regionElement of regionElements) {
    const regionId = regionElement.getAttribute(SVG_REGION_ATTR)?.trim() ?? ''
    if (!regionId) {
      continue
    }

    const tokenId = options.regionAssignments?.[regionId] ?? null
    const hex = tokenId ? options.colorHexByTokenId?.get(tokenId) ?? null : null
    const paintNodes = getPaintNodesForRuntime(regionElement)
    const isSelected = Boolean(options.selectedRegionId && options.selectedRegionId === regionId)

    for (const node of paintNodes) {
      restorePaintNode(node)

      if (hex) {
        node.setAttribute('fill', hex)
      }

      if (isSelected) {
        node.setAttribute('stroke', '#0ea5e9')
        node.setAttribute('stroke-width', '4')
      }
    }

    ;(regionElement as HTMLElement).style.cursor = options.interactive === false ? 'default' : 'pointer'
  }
}

export function getColoringSvgRegionIdFromEventTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null
  return element?.closest(`[${SVG_REGION_ATTR}]`)?.getAttribute(SVG_REGION_ATTR)?.trim() ?? null
}

export function getColoringSvgRegionLabelFromElement(regionElement: Element | null) {
  const rawLabel = regionElement?.getAttribute(SVG_REGION_LABEL_ATTR)?.trim() ?? ''
  return rawLabel || normalizeRegionLabel(regionElement?.getAttribute(SVG_REGION_ATTR)?.trim() ?? '')
}
