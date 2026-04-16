import { useEffect, useMemo, useRef } from 'react'

type ToolbarItem = string | Record<string, unknown> | Array<string | Record<string, unknown>>

type ReactQuillProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  theme?: string
  modules?: {
    toolbar?: ToolbarItem[]
  }
  formats?: string[]
}

function execFormat(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export default function ReactQuill({
  value,
  onChange,
  placeholder,
  className = '',
  modules,
}: ReactQuillProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const toolbar = modules?.toolbar ?? []

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    if (editor.innerHTML !== value) {
      editor.innerHTML = value
    }
  }, [value])

  const toolbarButtons = useMemo(() => {
    const flattened = toolbar.flatMap((item) => (Array.isArray(item) ? item : [item]))
    const labels = new Set(flattened.map((item) => {
      if (typeof item === 'string') {
        return item
      }

      return Object.keys(item)[0] ?? ''
    }))

    return {
      bold: labels.has('bold'),
      italic: labels.has('italic'),
      underline: labels.has('underline'),
      strike: labels.has('strike'),
      ordered: labels.has('list'),
      bullet: labels.has('list'),
      link: labels.has('link'),
      clean: labels.has('clean'),
      header: labels.has('header'),
    }
  }, [toolbar])

  return (
    <div className={`react-quill-local ${className}`}>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
        {toolbarButtons.bold ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('bold')}>
            B
          </button>
        ) : null}
        {toolbarButtons.italic ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('italic')}>
            I
          </button>
        ) : null}
        {toolbarButtons.underline ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('underline')}>
            U
          </button>
        ) : null}
        {toolbarButtons.strike ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('strikeThrough')}>
            S
          </button>
        ) : null}
        {toolbarButtons.ordered ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('insertOrderedList')}>
            1.
          </button>
        ) : null}
        {toolbarButtons.bullet ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('insertUnorderedList')}>
            •
          </button>
        ) : null}
        {toolbarButtons.link ? (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            onClick={() => {
              const url = window.prompt('Digite a URL')
              if (url) {
                execFormat('createLink', url)
              }
            }}
          >
            Link
          </button>
        ) : null}
        {toolbarButtons.clean ? (
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5" onClick={() => execFormat('removeFormat')}>
            Limpar
          </button>
        ) : null}
        {toolbarButtons.header ? (
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            onChange={(event) => {
              const level = event.target.value
              if (!level) {
                return
              }
              execFormat('formatBlock', level === 'false' ? 'p' : `h${level}`)
              event.currentTarget.value = ''
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Título
            </option>
            <option value="1">H1</option>
            <option value="2">H2</option>
            <option value="3">H3</option>
            <option value="false">Parágrafo</option>
          </select>
        ) : null}
      </div>
      <div
        ref={editorRef}
        className="min-h-[180px] w-full px-4 py-4 text-sm leading-7 outline-none"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onBlur={(event) => onChange(event.currentTarget.innerHTML)}
      />
      <style>{`
        .react-quill-local [contenteditable='true']:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
