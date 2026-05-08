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

function buildColumnsHtml(columns: number) {
  const safeColumns = Math.max(1, Math.min(4, columns))
  const items = Array.from({ length: safeColumns }, (_, index) => `
    <div class="genflix-column">
      <p><strong>Coluna ${index + 1}</strong></p>
      <p>Escreva o conteúdo desta coluna aqui.</p>
    </div>
  `.trim()).join('')

  return `
    <div class="genflix-columns genflix-columns-${safeColumns}">
      ${items}
    </div>
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

function findClosestColumnsContainer(root: HTMLElement | null) {
  if (!root || typeof window === 'undefined') {
    return null
  }

  const selection = window.getSelection()
  const anchorNode = selection?.anchorNode

  if (!anchorNode) {
    return null
  }

  let current: Node | null = anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentNode

  while (current && current !== root) {
    if (current instanceof HTMLElement && current.classList.contains('genflix-columns')) {
      return current
    }
    current = current.parentNode
  }

  return null
}

function updateExistingColumnsLayout(container: HTMLElement, nextCount: number) {
  const safeColumns = Math.max(1, Math.min(4, nextCount))
  const columns = Array.from(container.children).filter((child): child is HTMLElement => (
    child instanceof HTMLElement && child.classList.contains('genflix-column')
  ))

  if (safeColumns <= 1) {
    const mergedHtml = columns.map((column) => column.innerHTML.trim()).filter(Boolean).join('')
    container.outerHTML = `${mergedHtml}<p></p>`
    return
  }

  if (columns.length === 0) {
    container.outerHTML = buildColumnsHtml(safeColumns)
    return
  }

  if (columns.length < safeColumns) {
    for (let index = columns.length; index < safeColumns; index += 1) {
      const column = document.createElement('div')
      column.className = 'genflix-column'
      column.innerHTML = `<p><strong>Coluna ${index + 1}</strong></p><p>Escreva o conteúdo desta coluna aqui.</p>`
      container.appendChild(column)
      columns.push(column)
    }
  }

  if (columns.length > safeColumns) {
    const targetColumn = columns[safeColumns - 1]
    const overflowColumns = columns.slice(safeColumns)
    overflowColumns.forEach((column) => {
      const trimmedHtml = column.innerHTML.trim()
      if (trimmedHtml !== '') {
        targetColumn.insertAdjacentHTML('beforeend', trimmedHtml)
      }
      column.remove()
    })
  }

  container.className = `genflix-columns genflix-columns-${safeColumns}`
}

const defaultToolbar = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  [{ columns: [1, 2, 3, 4] }],
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
    columns: toolbarHasObjectKey(toolbarItems, 'columns'),
    horizontalRule: toolbarHasString(toolbarItems, 'hr'),
    undo: toolbarHasString(toolbarItems, 'undo'),
    redo: toolbarHasString(toolbarItems, 'redo'),
  }), [toolbarItems])

  function syncEditorValue() {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    queueMicrotask(() => onChange(editor.innerHTML))
  }

  function runEditorCommand(command: string, nextValue?: string) {
    execEditorCommand(editorRef.current, command, nextValue)
    syncEditorValue()
  }

  function insertEditorHtml(html: string) {
    insertHtml(editorRef.current, html)
    syncEditorValue()
  }

  function applyColumnsLayout(columnCount: number) {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const existingContainer = findClosestColumnsContainer(editor)
    if (existingContainer) {
      updateExistingColumnsLayout(existingContainer, columnCount)
      syncEditorValue()
      return
    }

    insertEditorHtml(buildColumnsHtml(columnCount))
  }

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
              <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('undo')}>
                Desfazer
              </button>
            ) : null}
            {toolbarButtons.redo ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('redo')}>
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
                  runEditorCommand('formatBlock', level === 'false' ? 'p' : `h${level}`)
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
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-black hover:bg-slate-100" onClick={() => runEditorCommand('bold')}>
                B
              </button>
            ) : null}
            {toolbarButtons.italic ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 italic hover:bg-slate-100" onClick={() => runEditorCommand('italic')}>
                I
              </button>
            ) : null}
            {toolbarButtons.underline ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 underline hover:bg-slate-100" onClick={() => runEditorCommand('underline')}>
                U
              </button>
            ) : null}
            {toolbarButtons.strike ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 line-through hover:bg-slate-100" onClick={() => runEditorCommand('strikeThrough')}>
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

                  if (alignment === 'left') runEditorCommand('justifyLeft')
                  if (alignment === 'center') runEditorCommand('justifyCenter')
                  if (alignment === 'right') runEditorCommand('justifyRight')
                  if (alignment === 'justify') runEditorCommand('justifyFull')
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
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('insertOrderedList')}>
                Lista 1.
              </button>
            ) : null}
            {toolbarButtons.bullet ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('insertUnorderedList')}>
                Lista
              </button>
            ) : null}
            {toolbarButtons.columns ? (
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                onChange={(event) => {
                  const nextValue = Number.parseInt(event.target.value, 10)
                  if (!Number.isFinite(nextValue)) {
                    return
                  }

                  applyColumnsLayout(nextValue)
                  event.currentTarget.value = ''
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Colunas
                </option>
                <option value="1">1 coluna</option>
                <option value="2">2 colunas</option>
                <option value="3">3 colunas</option>
                <option value="4">4 colunas</option>
              </select>
            ) : null}
            {toolbarButtons.blockquote ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('formatBlock', 'blockquote')}>
                Citação
              </button>
            ) : null}
            {toolbarButtons.codeBlock ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('formatBlock', 'pre')}>
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
                    runEditorCommand('createLink', url)
                  }
                }}
              >
                Link
              </button>
            ) : null}
            {toolbarButtons.link ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('unlink')}>
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
                    runEditorCommand('insertImage', imageUrl)
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
                  insertEditorHtml(html)
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

                  insertEditorHtml(buildTableHtml(rows, columns))
                }}
              >
                Tabela
              </button>
            ) : null}
            {toolbarButtons.horizontalRule ? (
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100" onClick={() => runEditorCommand('insertHorizontalRule')}>
                Linha
              </button>
            ) : null}
            {toolbarButtons.textColor ? (
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                <span>Texto</span>
                <input type="color" className="h-5 w-5 rounded border-0 bg-transparent p-0" onChange={(event) => runEditorCommand('foreColor', event.target.value)} />
              </label>
            ) : null}
            {toolbarButtons.backgroundColor ? (
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                <span>Fundo</span>
                <input type="color" className="h-5 w-5 rounded border-0 bg-transparent p-0" onChange={(event) => runEditorCommand('hiliteColor', event.target.value)} />
              </label>
            ) : null}
            {toolbarButtons.clean ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  runEditorCommand('removeFormat')
                  runEditorCommand('unlink')
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

        .react-quill-local .genflix-columns {
          display: grid;
          gap: 1rem;
          margin: 1.5rem 0;
        }

        .react-quill-local .genflix-column {
          min-height: 110px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 1rem;
          background: #f8fafc;
        }

        @media (min-width: 768px) {
          .react-quill-local .genflix-columns-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .react-quill-local .genflix-columns-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .react-quill-local .genflix-columns-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}
