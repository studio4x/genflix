import { EditableRichText, useEditableValue, useSiteContentScope, useVisualEditorState } from '@/features/site-editor/visual-editor'
import type { EditableListItem, SitePageKey } from '@/features/site-editor/types'

type PublicTextBlocksSectionProps = {
  entryKey: string
  label: string
  title: string
  description: string
  fallback?: EditableListItem[] | string
  pageKey?: SitePageKey
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeLegacyBlocksToRichText(blocks: EditableListItem[]) {
  return blocks
    .map((item) => {
      const titleHtml = typeof item.title === 'string' && item.title.trim() !== ''
        ? `<h3>${escapeHtml(item.title)}</h3>`
        : typeof item.label === 'string' && item.label.trim() !== ''
          ? `<h3>${escapeHtml(item.label)}</h3>`
          : ''
      const descriptionHtml = typeof item.description === 'string' ? item.description.trim() : ''
      return `${titleHtml}${descriptionHtml}`
    })
    .filter((chunk) => chunk.trim() !== '')
    .join('')
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
  const richTextFallback = typeof fallback === 'string' ? fallback : normalizeLegacyBlocksToRichText(fallback)
  const content = useEditableValue(entryKey, richTextFallback, { pageKey: resolvedPageKey })

  if (!editor?.isEditing && content.trim() === '') {
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

      <EditableRichText
        entryKey={entryKey}
        fallback={richTextFallback}
        label={label}
        pageKey={resolvedPageKey}
        className="rich-text-content rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-5 text-sm leading-7 text-[#5F7077] shadow-[0_10px_24px_rgba(21,50,59,0.04)] [&_h3]:mt-0 [&_h3]:text-base [&_h3]:font-black [&_h3]:text-[#15323b]"
      />
    </section>
  )
}
