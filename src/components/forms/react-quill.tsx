import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

type ToolbarItem = string | Record<string, unknown> | Array<string | Record<string, unknown>>

type ReactQuillProps = {
  value: string
  onChange: (value: string) => void
  onRequestImage?: () => Promise<{ src: string; alt?: string } | null> | { src: string; alt?: string } | null
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

type SelectedImageBounds = {
  left: number
  top: number
  width: number
  height: number
}

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

function getMovableElement(node: EventTarget | null) {
  if (!(node instanceof HTMLElement)) {
    return null
  }

  return node.closest('[data-hcm-movable="true"]') as HTMLElement | null
}

function normalizeMovableImagesHtml(html: string) {
  if (typeof document === 'undefined') {
    return html
  }

  const container = document.createElement('div')
  container.innerHTML = html

  // Keep editor markup predictable for plain rich text content.
  container.querySelectorAll('div').forEach((div) => {
    const hasSpecialClass = div.classList.contains('genflix-columns')
      || div.classList.contains('genflix-column')
      || div.classList.contains('embedded-video')
    const hasSpecialAttr = div.hasAttribute('data-hcm-movable')
      || div.hasAttribute('data-hcm-column-widths')
      || div.style.getPropertyValue('--hcm-columns-template') !== ''

    if (hasSpecialClass || hasSpecialAttr) {
      return
    }

    const paragraph = document.createElement('p')
    paragraph.innerHTML = div.innerHTML
    div.replaceWith(paragraph)
  })

  // Some browser commands (like italic) may inject inline font-size.
  container.querySelectorAll('i, em, b, strong, u, s, span').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return
    }

    element.style.removeProperty('font-size')
    if (element.getAttribute('style')?.trim() === '') {
      element.removeAttribute('style')
    }
  })

  container.querySelectorAll('img').forEach((img) => {
    img.setAttribute('data-hcm-movable', 'true')
    img.setAttribute('draggable', 'true')
    img.setAttribute('contenteditable', 'false')
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
  })

  return container.innerHTML
}

function getAlignmentTarget(element: HTMLElement) {
  if (element.tagName === 'IMG') {
    return element
  }

  return element
}

function getSelectedImageElement(element: HTMLElement | null) {
  if (!element) {
    return null
  }

  if (element.tagName === 'IMG') {
    return element as HTMLImageElement
  }

  const image = element.querySelector('img[data-hcm-movable="true"]')
  return image instanceof HTMLImageElement ? image : null
}

function createSelectionSnapshot(selection: Selection | null) {
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  return selection.getRangeAt(0).cloneRange()
}

function restoreSelectionSnapshot(range: Range | null) {
  if (!range || typeof window === 'undefined') {
    return
  }

  const selection = window.getSelection()
  if (!selection) {
    return
  }

  selection.removeAllRanges()
  selection.addRange(range)
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
    <div data-hcm-movable="true" draggable="true">
      <table border="1" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
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

function buildEqualColumnWidths(columns: number) {
  const safeColumns = Math.max(1, Math.min(4, columns))
  const base = Math.floor(100 / safeColumns)
  const widths = Array.from({ length: safeColumns }, () => base)
  widths[safeColumns - 1] += 100 - (base * safeColumns)
  return widths
}

function normalizeColumnWidths(input: string, columns: number) {
  const safeColumns = Math.max(1, Math.min(4, columns))
  const parts = input
    .split(',')
    .map((part) => Number.parseFloat(part.trim().replace('%', '').replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (parts.length !== safeColumns) {
    return null
  }

  const total = parts.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return null
  }

  const normalized = parts.map((value) => (value / total) * 100)
  const rounded = normalized.map((value) => Number.parseFloat(value.toFixed(2)))
  const roundedTotal = rounded.reduce((sum, value) => sum + value, 0)
  rounded[rounded.length - 1] = Number.parseFloat((rounded[rounded.length - 1] + (100 - roundedTotal)).toFixed(2))
  return rounded
}

function applyColumnWidths(container: HTMLElement, widths: number[]) {
  const serialized = widths.map((value) => value.toFixed(2).replace(/\.00$/, '')).join(',')
  const template = widths.map((value) => `${value.toFixed(2).replace(/\.00$/, '')}%`).join(' ')

  container.setAttribute('data-hcm-column-widths', serialized)
  container.style.setProperty('--hcm-columns-template', template)
}

function clearColumnWidths(container: HTMLElement) {
  container.removeAttribute('data-hcm-column-widths')
  container.style.removeProperty('--hcm-columns-template')
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildImageHtml(input: { src: string; alt?: string }) {
  const safeSrc = input.src.trim()
  const safeAlt = typeof input.alt === 'string' ? input.alt.trim() : ''
  if (!safeSrc) {
    return ''
  }

  return `
    <p><img src="${escapeHtmlAttribute(safeSrc)}" alt="${escapeHtmlAttribute(safeAlt)}" data-hcm-movable="true" draggable="true" contenteditable="false" /></p>
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

  const currentWidths = container.getAttribute('data-hcm-column-widths')
  if (!currentWidths) {
    return
  }

  const nextWidths = normalizeColumnWidths(currentWidths, safeColumns)
  if (!nextWidths) {
    clearColumnWidths(container)
    return
  }

  applyColumnWidths(container, nextWidths)
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
  onRequestImage,
  placeholder,
  className = '',
  minHeightClassName = 'min-h-[180px]',
  modules,
  enableHtmlMode = false,
  visualTabLabel = 'Visual',
  htmlTabLabel = 'HTML',
}: ReactQuillProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const editorShellRef = useRef<HTMLDivElement | null>(null)
  const savedSelectionRef = useRef<Range | null>(null)
  const draggedElementRef = useRef<HTMLElement | null>(null)
  const selectedMovableElementRef = useRef<HTMLElement | null>(null)
  const resizeSessionRef = useRef<{ image: HTMLImageElement; startX: number; startWidth: number } | null>(null)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const [selectedImageBounds, setSelectedImageBounds] = useState<SelectedImageBounds | null>(null)
  const [isResizingImage, setIsResizingImage] = useState(false)
  const [movableContextMenu, setMovableContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [activeMode, setActiveMode] = useState<'visual' | 'html'>('visual')
  const toolbarItems = useMemo(() => flattenToolbarItems(modules?.toolbar ?? defaultToolbar), [modules])

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const normalizedValue = normalizeMovableImagesHtml(value)
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue
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

    queueMicrotask(() => {
      const normalized = normalizeMovableImagesHtml(editor.innerHTML)
      if (editor.innerHTML !== normalized) {
        editor.innerHTML = normalized
      }
      onChange(normalized)
    })
  }

  function rememberSelection() {
    if (typeof window === 'undefined') {
      return
    }

    savedSelectionRef.current = createSelectionSnapshot(window.getSelection())
  }

  function restoreSavedSelection() {
    restoreSelectionSnapshot(savedSelectionRef.current)
  }

  function clearSelectedMovableElement() {
    selectedMovableElementRef.current?.removeAttribute('data-hcm-selected')
    selectedMovableElementRef.current = null
    setSelectionVersion((value) => value + 1)
  }

  function selectMovableElement(element: HTMLElement | null) {
    if (selectedMovableElementRef.current === element) {
      return
    }

    clearSelectedMovableElement()
    if (!element) {
      return
    }

    element.setAttribute('data-hcm-selected', 'true')
    selectedMovableElementRef.current = element
    setSelectionVersion((value) => value + 1)
  }

  function closeMovableContextMenu() {
    setMovableContextMenu(null)
  }

  function openMovableContextMenu(event: MouseEvent<HTMLElement>) {
    const movableElement = getMovableElement(event.target)
    if (!movableElement) {
      return
    }

    event.preventDefault()
    selectMovableElement(movableElement)
    setMovableContextMenu({ x: event.clientX, y: event.clientY })
  }

  function updateSelectedMovableImage(mutator: (image: HTMLImageElement) => void) {
    const image = getSelectedImageElement(selectedMovableElementRef.current)
    if (!image) {
      return
    }

    mutator(image)
    syncEditorValue()
  }

  function updateSelectedImageBounds() {
    const selectedImage = getSelectedImageElement(selectedMovableElementRef.current)
    const editorShell = editorShellRef.current

    if (!selectedImage || !editorShell) {
      setSelectedImageBounds(null)
      return
    }

    const imageRect = selectedImage.getBoundingClientRect()
    const shellRect = editorShell.getBoundingClientRect()
    setSelectedImageBounds({
      left: imageRect.left - shellRect.left,
      top: imageRect.top - shellRect.top,
      width: imageRect.width,
      height: imageRect.height,
    })
  }

  function stopImageResize(commit: boolean) {
    if (commit) {
      syncEditorValue()
    }

    resizeSessionRef.current = null
    setIsResizingImage(false)
    updateSelectedImageBounds()
  }

  function startImageResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const image = getSelectedImageElement(selectedMovableElementRef.current)
    if (!image) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    closeMovableContextMenu()
    selectMovableElement(image)
    resizeSessionRef.current = {
      image,
      startX: event.clientX,
      startWidth: Math.max(80, image.getBoundingClientRect().width),
    }
    setIsResizingImage(true)
  }

  async function replaceSelectedImage() {
    const image = getSelectedImageElement(selectedMovableElementRef.current)
    if (!image) {
      return
    }

    closeMovableContextMenu()

    if (onRequestImage) {
      const selectedImage = await onRequestImage()
      if (!selectedImage) {
        return
      }

      updateSelectedMovableImage((nextImage) => {
        nextImage.src = selectedImage.src
        nextImage.alt = selectedImage.alt ?? nextImage.alt
      })
      return
    }

    const nextUrl = window.prompt('Digite a nova URL da imagem', image.src)
    if (!nextUrl) {
      return
    }

    updateSelectedMovableImage((nextImage) => {
      nextImage.src = nextUrl
    })
  }

  function editSelectedImageAlt() {
    const image = getSelectedImageElement(selectedMovableElementRef.current)
    if (!image) {
      return
    }

    closeMovableContextMenu()

    const nextAlt = window.prompt('Texto alternativo da imagem', image.alt ?? '')
    if (nextAlt === null) {
      return
    }

    updateSelectedMovableImage((nextImage) => {
      nextImage.alt = nextAlt
    })
  }

  function removeSelectedMovableElement() {
    const selectedElement = selectedMovableElementRef.current
    if (!selectedElement) {
      return
    }

    closeMovableContextMenu()
    const parentParagraph = selectedElement.parentElement
    if (
      parentParagraph instanceof HTMLParagraphElement
      && parentParagraph.childElementCount === 1
      && parentParagraph.textContent?.trim() === ''
    ) {
      parentParagraph.remove()
    } else if (selectedElement.isConnected) {
      selectedElement.remove()
    }
    clearSelectedMovableElement()
    syncEditorValue()
  }

  function runEditorCommand(command: string, nextValue?: string) {
    restoreSavedSelection()
    execEditorCommand(editorRef.current, command, nextValue)
    rememberSelection()
    syncEditorValue()
  }

  function insertEditorHtml(html: string) {
    restoreSavedSelection()
    insertHtml(editorRef.current, html)
    rememberSelection()
    syncEditorValue()
  }

  async function handleInsertImage() {
    rememberSelection()
    if (onRequestImage) {
      const selectedImage = await onRequestImage()
      const imageHtml = selectedImage ? buildImageHtml(selectedImage) : ''
      if (imageHtml) {
        insertEditorHtml(imageHtml)
      }
      return
    }

    const imageUrl = window.prompt('Digite a URL da imagem')
    if (imageUrl) {
      insertEditorHtml(buildImageHtml({ src: imageUrl }))
    }
  }

  function applyAlignment(alignment: string) {
    const selectedElement = selectedMovableElementRef.current
    if (!selectedElement) {
      if (alignment === 'left') runEditorCommand('justifyLeft')
      if (alignment === 'center') runEditorCommand('justifyCenter')
      if (alignment === 'right') runEditorCommand('justifyRight')
      if (alignment === 'justify') runEditorCommand('justifyFull')
      return
    }

    const alignmentTarget = getAlignmentTarget(selectedElement)

    if (selectedElement.tagName === 'IMG') {
      selectedElement.style.display = 'block'
      selectedElement.style.float = 'none'
      selectedElement.style.maxWidth = '100%'
      selectedElement.style.height = 'auto'
      selectedElement.style.marginLeft = alignment === 'center' || alignment === 'right' ? 'auto' : '0'
      selectedElement.style.marginRight = alignment === 'center' || alignment === 'left' ? 'auto' : '0'
      if (alignment === 'justify') {
        selectedElement.style.width = '100%'
      } else if (selectedElement.style.width === '100%') {
        selectedElement.style.removeProperty('width')
      }
    } else {
      alignmentTarget.style.display = 'block'
      alignmentTarget.style.marginLeft = alignment === 'center' || alignment === 'right' ? 'auto' : '0'
      alignmentTarget.style.marginRight = alignment === 'center' || alignment === 'left' ? 'auto' : '0'
      alignmentTarget.style.textAlign = alignment
      if (alignment === 'justify') {
        alignmentTarget.style.width = '100%'
      } else if (alignmentTarget.style.width === '100%') {
        alignmentTarget.style.removeProperty('width')
      }
    }

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

  function applyColumnsWidthsFromPrompt() {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const existingContainer = findClosestColumnsContainer(editor)
    if (!existingContainer) {
      window.alert('Posicione o cursor dentro de um bloco de colunas para ajustar as larguras.')
      return
    }

    const columns = Array.from(existingContainer.children).filter((child): child is HTMLElement => (
      child instanceof HTMLElement && child.classList.contains('genflix-column')
    ))

    const count = Math.max(1, Math.min(4, columns.length))
    const currentWidths = existingContainer.getAttribute('data-hcm-column-widths')
    const fallbackSuggestion = currentWidths ?? buildEqualColumnWidths(count).join(', ')
    const input = window.prompt(`Informe ${count} larguras em % separadas por vírgula (ex.: ${buildEqualColumnWidths(count).join(', ')}).`, fallbackSuggestion)

    if (!input) {
      return
    }

    const widths = normalizeColumnWidths(input, count)
    if (!widths) {
      window.alert('Valor inválido. Informe exatamente uma largura positiva para cada coluna.')
      return
    }

    applyColumnWidths(existingContainer, widths)
    syncEditorValue()
  }

  const stats = useMemo(() => {
    const plainText = extractPlainText(value)
    const words = plainText === '' ? 0 : plainText.split(/\s+/).length
    return {
      words,
      characters: plainText.length,
    }
  }, [value])

  useEffect(() => {
    if (activeMode !== 'visual' || typeof document === 'undefined') {
      return
    }

    function handleSelectionChange() {
      const editor = editorRef.current
      const selection = window.getSelection()
      const anchorNode = selection?.anchorNode
      if (!editor || !anchorNode) {
        return
      }

      if (editor.contains(anchorNode)) {
        rememberSelection()
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [activeMode])

  useLayoutEffect(() => {
    if (activeMode !== 'visual') {
      setSelectedImageBounds(null)
      return
    }

    updateSelectedImageBounds()
  }, [activeMode, selectionVersion, movableContextMenu, value, isResizingImage])

  useEffect(() => {
    if (activeMode !== 'visual' || typeof window === 'undefined') {
      return
    }

    function handleRefresh() {
      updateSelectedImageBounds()
    }

    window.addEventListener('resize', handleRefresh)
    window.addEventListener('scroll', handleRefresh, true)

    const editor = editorRef.current
    const selectedImage = getSelectedImageElement(selectedMovableElementRef.current)
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(handleRefresh)
      : null

    if (editor && resizeObserver) {
      resizeObserver.observe(editor)
    }

    if (selectedImage && resizeObserver) {
      resizeObserver.observe(selectedImage)
    }

    return () => {
      window.removeEventListener('resize', handleRefresh)
      window.removeEventListener('scroll', handleRefresh, true)
      resizeObserver?.disconnect()
    }
  }, [activeMode, selectionVersion, isResizingImage, value])

  useEffect(() => {
    if (!isResizingImage || typeof window === 'undefined') {
      return
    }

    function handlePointerMove(event: PointerEvent) {
      const session = resizeSessionRef.current
      if (!session) {
        return
      }

      const editor = editorRef.current
      const editorWidth = editor?.getBoundingClientRect().width ?? session.startWidth
      const nextWidth = Math.max(80, Math.min(editorWidth, Math.round(session.startWidth + (event.clientX - session.startX))))

      session.image.style.display = 'block'
      session.image.style.float = 'none'
      session.image.style.width = `${nextWidth}px`
      session.image.style.maxWidth = 'none'
      session.image.style.height = 'auto'
      updateSelectedImageBounds()
    }

    function handlePointerUp() {
      stopImageResize(true)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isResizingImage])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      const root = editorRef.current
      if (movableContextMenu && root && !root.contains(target)) {
        closeMovableContextMenu()
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [movableContextMenu])

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

                  applyAlignment(alignment)
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
            {toolbarButtons.columns ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
                onClick={applyColumnsWidthsFromPrompt}
              >
                Larguras
              </button>
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
                onClick={() => void handleInsertImage()}
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
                    ? `<div class="embedded-video" data-hcm-movable="true" draggable="true">${videoValue}</div><p></p>`
                    : `<div class="embedded-video" data-hcm-movable="true" draggable="true"><iframe src="${videoValue}" frameborder="0" allowfullscreen></iframe></div><p></p>`
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

          <div ref={editorShellRef} className="relative">
            <div
              ref={editorRef}
              className={`${minHeightClassName} w-full bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none [&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:my-4 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:leading-tight [&_h2]:my-4 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:leading-tight [&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:leading-tight [&_h4]:my-3 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:leading-tight [&_h5]:my-2 [&_h5]:text-base [&_h5]:font-bold [&_h6]:my-2 [&_h6]:text-sm [&_h6]:font-bold [&_img]:h-auto [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-slate-100 [&_strong]:font-bold [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_iframe]:min-h-[320px] [&_iframe]:w-full`}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onMouseUp={rememberSelection}
              onKeyUp={rememberSelection}
              onMouseDown={(event) => {
                const movableElement = getMovableElement(event.target)
                if (!movableElement) {
                  return
                }

                event.preventDefault()
                selectMovableElement(movableElement)
              }}
              onClick={(event) => {
                selectMovableElement(getMovableElement(event.target))
                rememberSelection()
              }}
              onContextMenu={openMovableContextMenu}
              onKeyDown={(event) => {
                if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMovableElementRef.current) {
                  event.preventDefault()
                  removeSelectedMovableElement()
                }
                if (event.key === 'Escape') {
                  closeMovableContextMenu()
                }
              }}
              onDragStart={(event) => {
                const movableElement = getMovableElement(event.target)
                if (!movableElement) {
                  return
                }

                draggedElementRef.current = movableElement
                selectMovableElement(movableElement)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/html', movableElement.outerHTML)
              }}
              onDragOver={(event) => {
                if (!draggedElementRef.current) {
                  return
                }

                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                const draggedElement = draggedElementRef.current
                if (!draggedElement) {
                  return
                }

                event.preventDefault()

                const dropRange = document.caretRangeFromPoint
                  ? document.caretRangeFromPoint(event.clientX, event.clientY)
                  : (() => {
                    const position = document.caretPositionFromPoint?.(event.clientX, event.clientY)
                    if (!position) {
                      return null
                    }
                    const range = document.createRange()
                    range.setStart(position.offsetNode, position.offset)
                    range.collapse(true)
                    return range
                  })()

                if (!dropRange) {
                  draggedElementRef.current = null
                  return
                }

                const selection = window.getSelection()
                selection?.removeAllRanges()
                selection?.addRange(dropRange)
                savedSelectionRef.current = dropRange.cloneRange()

                const html = draggedElement.outerHTML
                draggedElement.remove()
                insertEditorHtml(html)
                draggedElementRef.current = null
              }}
              onDragEnd={() => {
                draggedElementRef.current = null
              }}
              onInput={(event) => {
                const normalized = normalizeMovableImagesHtml(event.currentTarget.innerHTML)
                if (event.currentTarget.innerHTML !== normalized) {
                  event.currentTarget.innerHTML = normalized
                }
                onChange(normalized)
              }}
              onBlur={(event) => {
                const normalized = normalizeMovableImagesHtml(event.currentTarget.innerHTML)
                if (event.currentTarget.innerHTML !== normalized) {
                  event.currentTarget.innerHTML = normalized
                }
                onChange(normalized)
              }}
            />

            {selectedImageBounds ? (
              <div
                className="pointer-events-none absolute z-20 rounded-xl border-2 border-sky-400/70"
                style={{
                  left: selectedImageBounds.left - 2,
                  top: selectedImageBounds.top - 2,
                  width: selectedImageBounds.width + 4,
                  height: selectedImageBounds.height + 4,
                }}
              >
                <div className="absolute -right-1 -top-7 rounded-full bg-sky-500 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg">
                  Imagem
                </div>
                <button
                  type="button"
                  aria-label="Redimensionar imagem"
                  className={`pointer-events-auto absolute -bottom-2 -right-2 h-5 w-5 rounded-full border-2 border-white bg-sky-500 shadow-lg ${isResizingImage ? 'cursor-se-resize' : 'cursor-se-resize'}`}
                  onPointerDown={startImageResize}
                >
                  <span className="sr-only">Redimensionar imagem</span>
                </button>
              </div>
            ) : null}
          </div>
          {movableContextMenu ? (
            <div
              className="fixed z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
              style={{ left: movableContextMenu.x, top: movableContextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseLeave={closeMovableContextMenu}
            >
              <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Imagem
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { applyAlignment('left'); closeMovableContextMenu() }}>
                  Esquerda
                </button>
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { applyAlignment('center'); closeMovableContextMenu() }}>
                  Centro
                </button>
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { applyAlignment('right'); closeMovableContextMenu() }}>
                  Direita
                </button>
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { applyAlignment('justify'); closeMovableContextMenu() }}>
                  Justificar
                </button>
              </div>
              <div className="mt-2 grid gap-1">
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void replaceSelectedImage()}>
                  Trocar imagem
                </button>
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={editSelectedImageAlt}>
                  Propriedades
                </button>
                <button type="button" className="rounded-lg border border-rose-200 px-2 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={removeSelectedMovableElement}>
                  Remover
                </button>
              </div>
            </div>
          ) : null}
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

        .react-quill-local [data-hcm-movable='true'] {
          cursor: grab;
        }

        .react-quill-local [data-hcm-movable='true'][data-hcm-selected='true'] {
          outline: 3px solid rgba(14, 165, 233, 0.45);
          outline-offset: 4px;
        }

        .react-quill-local img[data-hcm-movable='true'] {
          display: inline-block;
          vertical-align: middle;
        }

        .react-quill-local [contenteditable='true'] {
          position: relative;
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
          .react-quill-local .genflix-columns[data-hcm-column-widths] {
            grid-template-columns: var(--hcm-columns-template);
          }

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
