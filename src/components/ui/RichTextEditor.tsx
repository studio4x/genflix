import { useMemo, useState } from 'react'

import ReactQuill from '@/components/forms/react-quill'
import { cn } from '@/lib/utils'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  showRawHtmlToggle?: boolean
  showHeadingHints?: boolean
  minHeightClassName?: string
}

const defaultModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link', 'image', 'video'],
    ['clean'],
  ],
}

const defaultFormats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'align',
  'link',
  'image',
  'video',
]

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite o conteúdo do artigo...',
  className,
  showRawHtmlToggle = true,
  showHeadingHints = false,
  minHeightClassName = 'min-h-[300px]',
}: RichTextEditorProps) {
  const [isRawHtmlMode, setIsRawHtmlMode] = useState(false)

  const headingHint = useMemo(() => {
    if (!showHeadingHints) {
      return null
    }

    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
        Evite usar H1 no corpo do artigo. Use H2 a H6 para organizar a hierarquia de leitura.
      </p>
    )
  }, [showHeadingHints])

  return (
    <div className={cn('space-y-2', className)}>
      {showRawHtmlToggle ? (
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isRawHtmlMode}
            onChange={(event) => setIsRawHtmlMode(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Editar HTML bruto
        </label>
      ) : null}

      {headingHint}

      {isRawHtmlMode ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={14}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-800 outline-none focus:border-blue-400"
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={defaultModules}
          formats={defaultFormats}
          minHeightClassName={minHeightClassName}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        />
      )}
    </div>
  )
}
