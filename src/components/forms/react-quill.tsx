import { useEffect, useMemo, useRef, useState } from 'react'

type ToolbarItem = string | Record<string, unknown> | Array<string | Record<string, unknown>>

type ReactQuillProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeightClassName?: string
  theme?: string
  modules?: {
    toolbar?: ToolbarItem[]
  }
  formats?: string[]
  enableHtmlMode?: boolean
  visualTabLabel?: string
  htmlTabLabel?: string
}

type FlattenedToolbarItem = string | Record<string, unknown>

function flattenToolbarItems(toolbar: ToolbarItem[] | undefined) {
  return (toolbar ?? []).flatMap((item) => (Array.isArray(item) ? item : [item])) as FlattenedToolbarItem[]
}

function toolbarHasString(items: FlattenedToolbarItem[], expected: string) {
  return items.some((item) => item === expected)
}

function toolbarHasObjectKey(items: FlattenedToolbarItem[], expected: string) {
  return items.some((item) => typeof item === 'object' && item !== null && expected in item)
}

function toolbarHasObjectValue(items: FlattenedToolbarItem[], expectedKey: string, expectedValue: unknown) {
  return items.some((item) => (
    typeof item === 'object'
    && item !== null
    && expectedKey in item
    && (item as Record<string, unknown>)[expectedKey] === expectedValue
  ))
}

function execEditorCommand(editor: HTMLDivElement | null, command: string, value?: string) {
  if (!editor) {
    return
  }

  editor.focus()
  if (command === 'foreColor' || command === 'hiliteColor') {
    document.execCommand('styleWithCSS', false, 'true')
  }
  document.execCommand(command, false, value)
}

function insertHtml(editor: HTMLDivElement | null, html: string) {
  if (!editor) {
    return
  }

  editor.focus()
  document.execCommand('insertHTML', false, html)
}

function buildTableHtml(rows: number, columns: number) {
  const safeRows = Math.max(1, Math.min(12, rows))
  const safeColumns = Math.max(1, Math.min(8, columns))
  const headerCells = Array.from({ length: safeColumns }, (_, index) => `<th>Coluna ${index + 1}</th>`).join('')
  const bodyRows = Array.from({ length: Math.max(1, safeRows - 1) }, (_, rowIndex) => {
    const cells = Array.from({ length: safeColumns }, (_, columnIndex) => `<td>Dado ${rowIndex + 1}.${columnIndex + 1}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  return `
    <table border="1" style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
    <p></p>
  `.trim()
}

function extractPlainText(html: string) {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim()
}

const defaultToolbar = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['link', 'image', 'video'],
  ['clean'],
] satisfies ToolbarItem[]

export default function ReactQuill({
  value,
  onChange,
  placeholder,
  className = '',
  minHeightClassName = 'min-h-[180px]',
  modules,
  enableHtmlMode = false,
  visualTabLabel = 'Visual',
  htmlTabLabel = 'HTML',
}: ReactQuillProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [activeMode, setActiveMode] = useState<'visual' | 'html'>('visual')
  const toolbarItems = useMemo(() => flattenToolbarItems(modules?.toolbar ?? defaultToolbar), [modules])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    if (editor.innerHTML !== value) {
      editor.innerHTML = value
    }
  }, [value, activeMode])

  const toolbarButtons = useMemo(() => ({
    bold: toolbarHasString(toolbarItems, 'bold'),
    italic: toolbarHasString(toolbarItems, 'italic'),
    underline: toolbarHasString(toolbarItems, 'underline'),
    strike: toolbarHasString(toolbarItems, 'strike'),
    ordered: toolbarHasObjectValue(toolbarItems, 'list', 'ordered'),
    bullet: toolbarHasObjectValue(toolbarItems, 'list', 'bullet'),
    align: toolbarHasObjectKey(toolbarItems, 'align'),
    link: toolbarHasString(toolbarItems, 'link'),
    image: toolbarHasString(toolbarItems, 'image'),
    video: toolbarHasString(toolbarItems, 'video'),
    clean: toolbarHasString(toolbarItems, 'clean'),
    header: toolbarHasObjectKey(toolbarItems, 'header'),
    blockquote: toolbarHasString(toolbarItems, 'blockquote'),
    codeBlock: toolbarHasString(toolbarItems, 'code-block'),
    textColor: toolbarHasObjectKey(toolbarItems, 'color'),
    backgroundColor: toolbarHasObjectKey(toolbarItems, 'background'),
    table: toolbarHasString(toolbarItems, 'table'),
    horizontalRule: toolbarHasString(toolbarItems, 'hr'),
    undo: toolbarHasString(toolbarItems, 'undo'),
    redo: toolbarHasString(toolbarItems, 'redo'),
  }), [toolbarItems])

  const stats = useMemo(() => {
    const plainText = extractPlainText(value)
    const words = plainText === '' ? 0 : plainText.split(/\s+/).length
    return {
      words,
      characters: plainText.length,
    }
  }, [value])

  return (
    <div className={`react-quill-local overflow-hidden rounded-[18px] border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700">
            Editor enriquecido
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {activeMode === 'visual' ? 'Modo visual' : 'HTML bruto'}
          </span>
        </div>

        {enableHtmlMode ? (
          <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setActiveMode('visual')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${activeMode === 'visual' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {visualTabLabel}
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('html')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${activeMode === 'html' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {htmlTabLabel}
            </button>
          </div>
        ) : null}
      </div>

      {activeMode === 'visual' ? (
        <>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">
            {toolbarButtons.undo ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'undo')}>
                Desfazer
              </button>
            ) : null}
            {toolbarButtons.redo ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'redo')}>
                Refazer
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
                  execEditorCommand(editorRef.current, 'formatBlock', level === 'false' ? 'p' : `h${level}`)
                  event.currentTarget.value = ''
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Estrutura
                </option>
                <option value="1">H1</option>
                <option value="2">H2</option>
                <option value="3">H3</option>
                <option value="4">H4</option>
                <option value="5">H5</option>
                <option value="6">H6</option>
                <option value="false">Parágrafo</option>
              </select>
            ) : null}
            {toolbarButtons.bold ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-black hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'bold')}>
                B
              </button>
            ) : null}
            {toolbarButtons.italic ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 italic hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'italic')}>
                I
              </button>
            ) : null}
            {toolbarButtons.underline ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 underline hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'underline')}>
                U
              </button>
            ) : null}
            {toolbarButtons.strike ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 line-through hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'strikeThrough')}>
                S
              </button>
            ) : null}
            {toolbarButtons.align ? (
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                onChange={(event) => {
                  const alignment = event.target.value
                  if (!alignment) {
                    return
                  }

                  if (alignment === 'left') execEditorCommand(editorRef.current, 'justifyLeft')
                  if (alignment === 'center') execEditorCommand(editorRef.current, 'justifyCenter')
                  if (alignment === 'right') execEditorCommand(editorRef.current, 'justifyRight')
                  if (alignment === 'justify') execEditorCommand(editorRef.current, 'justifyFull')
                  event.currentTarget.value = ''
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Alinhar
                </option>
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
                <option value="justify">Justificar</option>
              </select>
            ) : null}
            {toolbarButtons.ordered ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'insertOrderedList')}>
                Lista 1.
              </button>
            ) : null}
            {toolbarButtons.bullet ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'insertUnorderedList')}>
                Lista
              </button>
            ) : null}
            {toolbarButtons.blockquote ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'formatBlock', 'blockquote')}>
                Citação
              </button>
            ) : null}
            {toolbarButtons.codeBlock ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'formatBlock', 'pre')}>
                Código
              </button>
            ) : null}
            {toolbarButtons.link ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  const url = window.prompt('Digite a URL do link')
                  if (url) {
                    execEditorCommand(editorRef.current, 'createLink', url)
                  }
                }}
              >
                Link
              </button>
            ) : null}
            {toolbarButtons.link ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'unlink')}>
                Remover link
              </button>
            ) : null}
            {toolbarButtons.image ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  const imageUrl = window.prompt('Digite a URL da imagem')
                  if (imageUrl) {
                    execEditorCommand(editorRef.current, 'insertImage', imageUrl)
                  }
                }}
              >
                Imagem
              </button>
            ) : null}
            {toolbarButtons.video ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  const videoValue = window.prompt('Cole a URL do vídeo ou um iframe completo')
                  if (!videoValue) {
                    return
                  }

                  const html = videoValue.includes('<iframe')
                    ? `${videoValue}<p></p>`
                    : `<div class="embedded-video"><iframe src="${videoValue}" frameborder="0" allowfullscreen></iframe></div><p></p>`
                  insertHtml(editorRef.current, html)
                }}
              >
                Vídeo
              </button>
            ) : null}
            {toolbarButtons.table ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  const rowsInput = window.prompt('Quantas linhas a tabela deve ter?', '3')
                  const columnsInput = window.prompt('Quantas colunas a tabela deve ter?', '3')
                  if (!rowsInput || !columnsInput) {
                    return
                  }

                  const rows = Number.parseInt(rowsInput, 10)
                  const columns = Number.parseInt(columnsInput, 10)
                  if (!Number.isFinite(rows) || !Number.isFinite(columns)) {
                    return
                  }

                  insertHtml(editorRef.current, buildTableHtml(rows, columns))
                }}
              >
                Tabela
              </button>
            ) : null}
            {toolbarButtons.horizontalRule ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => execEditorCommand(editorRef.current, 'insertHorizontalRule')}>
                Linha
              </button>
            ) : null}
            {toolbarButtons.textColor ? (
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                <span>Texto</span>
                <input type="color" className="h-5 w-5 rounded border-0 bg-transparent p-0" onChange={(event) => execEditorCommand(editorRef.current, 'foreColor', event.target.value)} />
              </label>
            ) : null}
            {toolbarButtons.backgroundColor ? (
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                <span>Fundo</span>
                <input type="color" className="h-5 w-5 rounded border-0 bg-transparent p-0" onChange={(event) => execEditorCommand(editorRef.current, 'hiliteColor', event.target.value)} />
              </label>
            ) : null}
            {toolbarButtons.clean ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  execEditorCommand(editorRef.current, 'removeFormat')
                  execEditorCommand(editorRef.current, 'unlink')
                }}
              >
                Limpar
              </button>
            ) : null}
          </div>

          <div
            ref={editorRef}
            className={`${minHeightClassName} w-full bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_img]:h-auto [&_img]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-slate-100 [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_iframe]:min-h-[320px] [&_iframe]:w-full`}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder}
            onInput={(event) => onChange(event.currentTarget.innerHTML)}
            onBlur={(event) => onChange(event.currentTarget.innerHTML)}
          />
        </>
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={16}
          className="w-full resize-y bg-[#0B1220] px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold text-slate-500">
        <span>{activeMode === 'visual' ? 'Edite visualmente e alterne para HTML quando precisar.' : 'Modo HTML liberado para colar ou ajustar marcação manualmente.'}</span>
        <span>{stats.words} palavras • {stats.characters} caracteres</span>
      </div>

      <style>{`
        .react-quill-local [contenteditable='true']:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
