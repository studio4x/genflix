import { EditableList, isEditableItemVisible, useEditableValue, useSiteContentScope, useVisualEditorState } from '@/features/site-editor/visual-editor'
import type { EditableListItem, SitePageKey } from '@/features/site-editor/types'

type PublicTextBlocksSectionProps = {
  entryKey: string
  label: string
  title: string
  description: string
  fallback?: EditableListItem[]
  pageKey?: SitePageKey
}

export function PublicTextBlocksSection({
  entryKey,
  label,
  title,
  description,
  fallback = [],
  pageKey,
}: PublicTextBlocksSectionProps) {
  const scope = useSiteContentScope()
  const editor = useVisualEditorState()
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const blocks = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })
  const visibleBlocks = blocks.filter(isEditableItemVisible)

  if (!editor?.isEditing && visibleBlocks.length === 0) {
    return null
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[760px]">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">{label}</p>
          <h2 className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-[#5F7077]">{description}</p>
        </div>
      </div>

      <EditableList
        entryKey={entryKey}
        fallback={fallback}
        label={label}
        pageKey={resolvedPageKey}
        schema={{
          itemName: 'bloco de texto',
          addLabel: 'Adicionar bloco de texto',
        }}
      >
        {(items) => {
          const renderedBlocks = items.filter(isEditableItemVisible)

          return renderedBlocks.length > 0 ? (
            <div className="grid gap-4">
              {renderedBlocks.map((item) => (
                <article key={item.id} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-5 shadow-[0_10px_24px_rgba(21,50,59,0.04)]">
                  {item.label || item.title ? (
                    <h3 className="text-base font-black text-[#15323b]">
                      {item.title || item.label}
                    </h3>
                  ) : null}
                  {item.description ? (
                    <p className={`${item.label || item.title ? 'mt-3' : ''} text-sm leading-7 text-[#5F7077]`}>
                      {item.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null
        }}
      </EditableList>
    </section>
  )
}
