import { genflixStudyFeatures } from '@/features/public/genflix-site-content'
import type { EditableListItem } from '@/features/site-editor/types'

const STUDY_FEATURE_ICON_KEYS: Record<string, string> = {
  'Videoaulas HD': 'monitor-play',
  'Flashcards': 'book-open-text',
  'Podcasts': 'headphones',
  'Resumos PDF': 'file-text',
  'Simulados': 'clipboard-check',
  'Certificado': 'badge-check',
}

function createStudyFeatureCard(feature: (typeof genflixStudyFeatures)[number], index: number): EditableListItem {
  return {
    id: `study-feature-${index + 1}`,
    label: feature.title,
    title: feature.title,
    description: feature.description,
    metadata: {
      iconKey: STUDY_FEATURE_ICON_KEYS[feature.title] ?? 'sparkles',
    },
  }
}

export const genflixStudyFeatureCardsFallback = genflixStudyFeatures.map((feature, index) => createStudyFeatureCard(feature, index))

export const genflixStudyFeatureCardsSchema = {
  kind: 'default',
  itemName: 'card',
  addLabel: 'Adicionar card',
  templates: genflixStudyFeatureCardsFallback.map((item, index) => ({
    id: item.id,
    label: item.label ?? `Card ${index + 1}`,
    description: item.description,
    item,
  })),
}

export function resolveStudyFeatureIconKey(item: EditableListItem) {
  const metadata = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
    ? item.metadata as Record<string, unknown>
    : {}

  const iconKey = typeof metadata.iconKey === 'string' && metadata.iconKey.trim() !== ''
    ? metadata.iconKey
    : ''

  if (iconKey) {
    return iconKey
  }

  const label = item.label ?? item.title ?? ''
  return STUDY_FEATURE_ICON_KEYS[label] ?? 'sparkles'
}
