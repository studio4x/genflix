import type { ReactNode } from 'react'

import { useSiteContentScope, useVisualEditorState } from '@/features/site-editor/visual-editor'
import type { EditableListItem, SitePageKey } from '@/features/site-editor/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export type SectionRegistryTemplate = {
  id: string
  label: string
  description: string
  pageKey?: SitePageKey
}

export function createSectionRegistryFallback(templates: SectionRegistryTemplate[]) {
  return templates.map((template) => ({
    id: template.id,
    label: template.label,
    description: template.description,
    metadata: {
      templateKey: template.id,
      ...(template.pageKey ? { pageKey: template.pageKey } : {}),
    },
  })) satisfies EditableListItem[]
}

export function createSectionRegistrySchema(input: {
  addLabel?: string
  itemName?: string
  instancePrefix?: string
  instancePageKey?: SitePageKey
  templates: SectionRegistryTemplate[]
}) {
  return {
    kind: 'section-registry',
    itemName: input.itemName ?? 'bloco',
    addLabel: input.addLabel ?? 'Adicionar bloco',
    ...(input.instancePrefix ? { instancePrefix: input.instancePrefix } : {}),
    ...(input.instancePageKey ? { instancePageKey: input.instancePageKey } : {}),
    templates: input.templates.map((template) => ({
      id: template.id,
      label: template.label,
      description: template.description,
      item: {
        id: template.id,
        label: template.label,
        description: template.description,
        metadata: {
          templateKey: template.id,
          ...(template.pageKey ? { pageKey: template.pageKey } : {}),
        },
      },
    })),
  }
}

export function getSectionRegistryMetadata(item: EditableListItem) {
  return isRecord(item.metadata) ? item.metadata : {}
}

export function resolveSectionRegistryTemplateKey(item: EditableListItem) {
  const metadata = getSectionRegistryMetadata(item)
  return typeof metadata.templateKey === 'string' && metadata.templateKey.trim() !== ''
    ? metadata.templateKey
    : item.id
}

export function resolveSectionRegistryPageKey(item: EditableListItem, fallbackPageKey: SitePageKey) {
  const metadata = getSectionRegistryMetadata(item)
  const configuredPageKey = metadata.pageKey
  return typeof configuredPageKey === 'string' && configuredPageKey.trim() !== ''
    ? configuredPageKey as SitePageKey
    : fallbackPageKey
}

export function resolveSectionRegistryEntryPrefix(item: EditableListItem, fallbackPrefix: string) {
  const metadata = getSectionRegistryMetadata(item)
  return typeof metadata.entryPrefix === 'string' && metadata.entryPrefix.trim() !== ''
    ? metadata.entryPrefix
    : fallbackPrefix
}

export function SectionStructureControl({
  buttonLabel,
  pageKey,
  entryKey,
  label,
  sections,
  schema,
  className,
}: {
  buttonLabel: string
  pageKey: SitePageKey
  entryKey: string
  label: string
  sections: EditableListItem[]
  schema: Record<string, unknown>
  className?: string
}) {
  const editor = useVisualEditorState()
  const scope = useSiteContentScope()

  if (!editor?.isEditing || !scope) {
    return null
  }

  return (
    <div className={className ?? 'public-site-container py-4'}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => editor.openEditor({
            pageKey,
            entryKey,
            entryType: 'list',
            label,
            fallback: sections,
            schema,
            reload: scope.reload,
          })}
          className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] shadow-[0_18px_40px_rgba(6,27,33,0.08)] hover:bg-[#F2F7F9]"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

export function renderVisibleSectionList(
  sections: EditableListItem[],
  renderSection: (item: EditableListItem) => ReactNode | null,
) {
  return sections.map((item) => (
    <div key={item.id}>
      {renderSection(item)}
    </div>
  ))
}
