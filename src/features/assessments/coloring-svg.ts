import type { ColoringSvgRegion } from '@/types/content'

const SVG_REGION_ATTR = 'data-hcm-region-id'
const SVG_REGION_LABEL_ATTR = 'data-hcm-region-label'
const SVG_FILLABLE_ATTR = 'data-hcm-fillable'
const SVG_ORIGINAL_FILL_ATTR = 'data-hcm-original-fill'
const SVG_ORIGINAL_STROKE_ATTR = 'data-hcm-original-stroke'
const SVG_ORIGINAL_STROKE_WIDTH_ATTR = 'data-hcm-original-stroke-width'
const SVG_PAINT_LAYER_ATTR = 'data-hcm-paint-layer'
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
const runtimePaintLayerByNode = new WeakMap<Element, Element>()

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
      <rect x="170" y="118" width="860" height="564" rx="42" fill="#FFFFFF" stroke="#D9E6F2" stroke-width="8"/>
      <rect x="224" y="172" width="752" height="456" rx="32" fill="#F8FBFF" stroke="#BFE7F7" stroke-width="6" stroke-dasharray="18 16"/>

      <circle cx="600" cy="244" r="34" fill="#ECFEFF" stroke="#67E8F9" stroke-width="6"/>
      <path d="M583 244h34M600 227v34" stroke="#0891B2" stroke-width="8" stroke-linecap="round"/>

      <text x="600" y="320" text-anchor="middle" fill="#0F172A" font-size="38" font-family="Arial, sans-serif" font-weight="700">
        Envie um SVG preparado
      </text>
      <text x="600" y="360" text-anchor="middle" fill="#334155" font-size="24" font-family="Arial, sans-serif" font-weight="600">
        com id ou data-region-id nas pecas pintaveis
      </text>

      <rect x="372" y="420" width="456" height="118" rx="28" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="4"/>
      <rect id="${regionId}" x="404" y="446" width="166" height="66" rx="22" fill="#DBEAFE" stroke="#2563EB" stroke-width="6"/>
      <path d="M618 462H772" stroke="#94A3B8" stroke-width="10" stroke-linecap="round"/>
      <path d="M618 494H736" stroke="#CBD5E1" stroke-width="10" stroke-linecap="round"/>
      <text x="487" y="487" text-anchor="middle" fill="#1D4ED8" font-size="22" font-family="Arial, sans-serif" font-weight="700">
        Regiao Exemplo
      </text>

      <rect x="336" y="576" width="154" height="40" rx="20" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="3"/>
      <text x="413" y="602" text-anchor="middle" fill="#1D4ED8" font-size="18" font-family="Arial, sans-serif" font-weight="700">id="teto"</text>
      <rect x="522" y="576" width="192" height="40" rx="20" fill="#F0FDFA" stroke="#99F6E4" stroke-width="3"/>
      <text x="618" y="602" text-anchor="middle" fill="#0F766E" font-size="18" font-family="Arial, sans-serif" font-weight="700">data-region-id="porta"</text>
      <rect x="746" y="576" width="118" height="40" rx="20" fill="#FEF3C7" stroke="#FCD34D" stroke-width="3"/>
      <text x="805" y="602" text-anchor="middle" fill="#B45309" font-size="18" font-family="Arial, sans-serif" font-weight="700">fechado</text>
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
    throw new Error('Nao encontramos regioes utilizaveis no SVG. Use ids ou data-region-id nas pecas pintaveis, mesmo quando elas estiverem com fill:none. Se precisar, abra o guia "Como preparar SVG" no editor.')
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

function shouldUseDedicatedPaintLayer(node: Element) {
  const tagName = node.tagName.toLowerCase()
  if (tagName === 'polyline') {
    return false
  }

  const originalFill = (node.getAttribute(SVG_ORIGINAL_FILL_ATTR) ?? getPresentationValue(node, 'fill') ?? '')
    .trim()
    .toLowerCase()

  return !originalFill || originalFill === 'none' || originalFill === 'currentcolor'
}

function ensureRuntimePaintLayer(node: Element) {
  if (!shouldUseDedicatedPaintLayer(node)) {
    return null
  }

  const existingLayer = runtimePaintLayerByNode.get(node)
  if (existingLayer?.isConnected) {
    return existingLayer
  }

  const paintLayer = node.cloneNode(true) as Element
  paintLayer.removeAttribute('id')
  paintLayer.removeAttribute(SVG_FILLABLE_ATTR)
  paintLayer.removeAttribute(SVG_REGION_ATTR)
  paintLayer.removeAttribute(SVG_REGION_LABEL_ATTR)
  paintLayer.removeAttribute(SVG_ORIGINAL_FILL_ATTR)
  paintLayer.removeAttribute(SVG_ORIGINAL_STROKE_ATTR)
  paintLayer.removeAttribute(SVG_ORIGINAL_STROKE_WIDTH_ATTR)
  paintLayer.setAttribute(SVG_PAINT_LAYER_ATTR, 'true')
  paintLayer.setAttribute('pointer-events', 'none')
  setRuntimePresentationValue(paintLayer, 'fill', DEFAULT_EMPTY_FILL)
  setRuntimePresentationValue(paintLayer, 'stroke', 'none')
  setRuntimePresentationValue(paintLayer, 'stroke-width', null)

  if (paintLayer instanceof SVGElement) {
    paintLayer.style.setProperty('fill-opacity', '1')
    paintLayer.style.setProperty('opacity', '1')
  }

  node.parentNode?.insertBefore(paintLayer, node)
  runtimePaintLayerByNode.set(node, paintLayer)
  return paintLayer
}

function setRuntimePresentationValue(
  node: Element,
  propertyName: 'fill' | 'stroke' | 'stroke-width',
  value: string | null,
) {
  const normalizedValue = value?.trim() ?? ''

  if (normalizedValue) {
    node.setAttribute(propertyName, normalizedValue)
  } else {
    node.removeAttribute(propertyName)
  }

  if (node instanceof SVGElement) {
    if (normalizedValue) {
      node.style.setProperty(propertyName, normalizedValue)
    } else {
      node.style.removeProperty(propertyName)
    }
  }
}

function restorePaintNode(node: Element) {
  if (node.getAttribute(SVG_PAINT_LAYER_ATTR) === 'true') {
    setRuntimePresentationValue(node, 'fill', DEFAULT_EMPTY_FILL)
    setRuntimePresentationValue(node, 'stroke', 'none')
    setRuntimePresentationValue(node, 'stroke-width', null)

    if (node instanceof SVGElement) {
      node.style.setProperty('fill-opacity', '1')
      node.style.setProperty('opacity', '1')
    }
    return
  }

  const originalFill = node.getAttribute(SVG_ORIGINAL_FILL_ATTR) ?? ''
  const originalStroke = node.getAttribute(SVG_ORIGINAL_STROKE_ATTR) ?? ''
  const originalStrokeWidth = node.getAttribute(SVG_ORIGINAL_STROKE_WIDTH_ATTR) ?? ''

  setRuntimePresentationValue(
    node,
    'fill',
    originalFill && originalFill.trim().toLowerCase() !== 'none' ? originalFill : DEFAULT_EMPTY_FILL,
  )
  setRuntimePresentationValue(node, 'stroke', originalStroke || null)
  setRuntimePresentationValue(node, 'stroke-width', originalStrokeWidth || null)
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
      const paintNode = ensureRuntimePaintLayer(node) ?? node

      restorePaintNode(node)
      if (paintNode !== node) {
        restorePaintNode(paintNode)
      }

      if (hex) {
        setRuntimePresentationValue(paintNode, 'fill', hex)
      }

      if (isSelected) {
        setRuntimePresentationValue(node, 'stroke', '#0ea5e9')
        setRuntimePresentationValue(node, 'stroke-width', '4')
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
