import {
  genflixResourceItems,
  type GenflixResourceItem,
} from '@/features/public/genflix-site-content'
import type { EditableListItem } from '@/features/site-editor/types'

type EditableMetadata = Record<string, unknown>

function toMetadata(value: unknown): EditableMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return { ...value as EditableMetadata }
}

function toEditableItem(rawItem: unknown, index: number): EditableListItem {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return { id: `resource-${index + 1}`, label: '', description: '' }
  }

  const record = rawItem as Record<string, unknown>
  const baseMetadata = toMetadata(record.metadata)
  const extraMetadata = Object.fromEntries(
    Object.entries(record).filter(([key]) => !['id', 'label', 'title', 'description', 'href', 'image', 'metadata'].includes(key)),
  )

  return {
    id: typeof record.id === 'string' && record.id.trim() !== '' ? record.id : `resource-${index + 1}`,
    label: typeof record.label === 'string' ? record.label : '',
    title: typeof record.title === 'string' ? record.title : undefined,
    description: typeof record.description === 'string' ? record.description : '',
    href: typeof record.href === 'string' ? record.href : undefined,
    image: typeof record.image === 'string' ? record.image : undefined,
    metadata: {
      ...baseMetadata,
      ...extraMetadata,
    },
  }
}

export function createResourcesItemsFallback() {
  return genflixResourceItems.map((item, index) => ({
    id: item.label || `resource-${index + 1}`,
    label: item.label,
    description: item.description,
  }))
}

export function normalizeResourcesItems(value: unknown): EditableListItem[] {
  const fallback = createResourcesItemsFallback()
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized = value.map((item, index) => toEditableItem(item, index))
  return normalized.length > 0 ? normalized : fallback
}

export function findResourceFallbackByLabel(label: string | null | undefined): GenflixResourceItem {
  if (!label) {
    return genflixResourceItems[0]
  }
  return genflixResourceItems.find((resource) => resource.label === label) ?? genflixResourceItems[0]
}

export function resolveResourceVideoUrl(item: EditableListItem | null | undefined): string {
  if (!item) return ''
  const metadata = toMetadata(item.metadata)
  const rawVideoUrl = typeof metadata.instructionalVideoUrl === 'string'
    ? metadata.instructionalVideoUrl.trim()
    : ''

  if (!rawVideoUrl) return ''

  const normalized = /^https?:\/\//i.test(rawVideoUrl) ? rawVideoUrl : `https://${rawVideoUrl}`

  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}
