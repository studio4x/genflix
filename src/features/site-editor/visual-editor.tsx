import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Copy, Edit3, Image as ImageIcon, Keyboard, RotateCcw, Save, Settings, Sparkles, Wand2, X } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { cn } from '@/lib/utils'
import {
  fetchSiteContent,
  fetchSiteEditorSettings,
  saveSiteContentEntry,
  shouldIgnoreSiteEditor,
  uploadSiteAsset,
} from '@/features/site-editor/api'
import {
  defaultSiteEditorSettings,
  type EditableListItem,
  type SiteContentEntry,
  type SiteContentEntryType,
  type SiteEditorSettings,
  type SitePageKey,
} from '@/features/site-editor/types'

type EditableValue = string | EditableListItem[] | Record<string, unknown> | null
type TextStyleValue = {
  color?: string
  fontFamily?: string
  fontSize?: string
  fontWeight?: string
  letterSpacing?: string
  lineHeight?: string
  textTransform?: string
  fontStyle?: string
}

type SiteContentContextValue = {
  pageKey: SitePageKey
  entries: Map<string, SiteContentEntry>
  reload: () => Promise<void>
}

type VisualEditorContextValue = {
  isAdmin: boolean
  isEditing: boolean
  settings: SiteEditorSettings
  startEditing: () => void
  stopEditing: () => void
  openEditor: (input: EditorInput) => void
  resolveValue: <TValue,>(entryKey: string, fallback: TValue) => TValue
}

type EditorInput = {
  pageKey: SitePageKey
  entryKey: string
  entryType: SiteContentEntryType
  label: string
  fallback: EditableValue
  styleEntryKey?: string
  styleFallback?: TextStyleValue
  schema?: Record<string, unknown>
  reload: () => Promise<void>
}

const SiteContentContext = createContext<SiteContentContextValue | null>(null)
const VisualEditorContext = createContext<VisualEditorContextValue | null>(null)

const publicEditorExcludedPrefixes = ['/admin', '/aluno', '/criador']

function isPublicEditablePath(pathname: string) {
  return !publicEditorExcludedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function coerceEditableValue(value: unknown, fallback: EditableValue) {
  if (typeof fallback === 'string') {
    return typeof value === 'string' ? value : fallback
  }

  if (Array.isArray(fallback)) {
    return Array.isArray(value) ? value as EditableListItem[] : fallback
  }

  if (isStringRecord(fallback)) {
    return isStringRecord(value) ? value : fallback
  }

  return value ?? fallback
}

function valueToString(value: EditableValue) {
  if (typeof value === 'string') return value
  return JSON.stringify(value ?? null, null, 2)
}

function describeValueShape(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} item(ns)`
  }

  if (isStringRecord(value)) {
    return `${Object.keys(value).length} campo(s)`
  }

  if (typeof value === 'string') {
    return `${value.length} caractere(s)`
  }

  if (value === null) {
    return 'valor nulo'
  }

  return typeof value
}

function normalizeTextStyle(value: unknown): TextStyleValue {
  if (!isStringRecord(value)) {
    return {}
  }

  const nextStyle: TextStyleValue = {}
  const fields: Array<keyof TextStyleValue> = [
    'color',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'textTransform',
    'fontStyle',
  ]

  for (const field of fields) {
    const currentValue = value[field]
    if (typeof currentValue === 'string' && currentValue.trim() !== '') {
      nextStyle[field] = currentValue
    }
  }

  return nextStyle
}

function hasTextStyle(style: TextStyleValue) {
  return Object.values(style).some((value) => typeof value === 'string' && value.trim() !== '')
}

function textStyleToCss(style: TextStyleValue): CSSProperties | undefined {
  const normalized = normalizeTextStyle(style)

  if (!hasTextStyle(normalized)) {
    return undefined
  }

  return normalized
}

function normalizeEditableListItems(value: unknown): EditableListItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item, index) => {
    if (!isStringRecord(item)) {
      return {
        id: `item-${index + 1}`,
        label: '',
      }
    }

    const baseMetadata = isStringRecord(item.metadata) ? { ...item.metadata } : {}
    const extraMetadata = Object.fromEntries(
      Object.entries(item).filter(([key]) => !['id', 'label', 'title', 'description', 'href', 'image', 'metadata'].includes(key)),
    )
    const mergedMetadata = {
      ...baseMetadata,
      ...extraMetadata,
    }

    const nextItem: EditableListItem = {
      id: typeof item.id === 'string' && item.id.trim() !== '' ? item.id : `item-${index + 1}`,
      label: typeof item.label === 'string' ? item.label : undefined,
      title: typeof item.title === 'string' ? item.title : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      href: typeof item.href === 'string' ? item.href : undefined,
      image: typeof item.image === 'string' ? item.image : undefined,
      metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
    }

    return nextItem
  })
}

function moveArrayItem<TValue>(items: TValue[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    return items
  }

  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function sanitizeRichText(rawValue: string) {
  return rawValue
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '')
}

function parseEditorValue(entryType: SiteContentEntryType, rawValue: string) {
  if (entryType === 'list' || entryType === 'json' || entryType === 'button' || entryType === 'link' || entryType === 'image') {
    return JSON.parse(rawValue) as unknown
  }

  return rawValue
}

function EditableMarker({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <span
      className="group/site-editor relative cursor-pointer rounded-[10px] bg-[#1398B7]/6 outline outline-2 outline-offset-2 outline-[#1398B7]/50 transition hover:bg-[#1398B7]/10 hover:outline-[#1398B7] focus-visible:bg-[#1398B7]/10"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <span className="pointer-events-none absolute -top-3 left-2 z-[80] inline-flex items-center gap-1 rounded-full border border-[#0A3640]/10 bg-[#0A3640] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white opacity-0 shadow-lg transition-opacity group-hover/site-editor:opacity-100 group-focus-visible/site-editor:opacity-100">
        <Edit3 className="h-3 w-3" />
        {label}
      </span>
      {children}
    </span>
  )
}

function ListItemEditorCard({
  item,
  index,
  total,
  depth = 0,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  item: EditableListItem
  index: number
  total: number
  depth?: number
  onChange: (nextItem: EditableListItem) => void
  onMove: (fromIndex: number, delta: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
}) {
  const metadata: Record<string, unknown> = isStringRecord(item.metadata) ? { ...item.metadata } : {}
  const nestedItems = normalizeEditableListItems(metadata.items)
  const metadataWithoutItems: Record<string, unknown> = { ...metadata }
  delete metadataWithoutItems.items
  const buttonLabel = typeof metadataWithoutItems.buttonLabel === 'string' ? metadataWithoutItems.buttonLabel : ''
  const isInternal = metadataWithoutItems.isInternal === true
  const openInNewTab = metadataWithoutItems.openInNewTab === true
  const isHidden = metadataWithoutItems.isHidden === true
  delete metadataWithoutItems.buttonLabel
  delete metadataWithoutItems.isInternal
  delete metadataWithoutItems.openInNewTab
  delete metadataWithoutItems.isHidden

  function updateField(field: keyof EditableListItem, value: string) {
    onChange({
      ...item,
      [field]: value,
    })
  }

  function updateMetadataField(field: string, value: unknown) {
    const nextMetadata: Record<string, unknown> = {
      ...metadataWithoutItems,
      ...(buttonLabel ? { buttonLabel } : {}),
      ...(isInternal ? { isInternal: true } : {}),
      ...(openInNewTab ? { openInNewTab: true } : {}),
      ...(isHidden ? { isHidden: true } : {}),
      [field]: value,
      ...(nestedItems.length > 0 ? { items: nestedItems } : {}),
    }

    if (value === '' || value === false || value === undefined || value === null) {
      delete nextMetadata[field]
    }

    onChange({
      ...item,
      metadata: nextMetadata,
    })
  }

  function updateNestedItems(nextNestedItems: EditableListItem[]) {
    onChange({
      ...item,
      metadata: {
        ...metadataWithoutItems,
        ...(buttonLabel ? { buttonLabel } : {}),
        ...(isInternal ? { isInternal: true } : {}),
        ...(openInNewTab ? { openInNewTab: true } : {}),
        ...(isHidden ? { isHidden: true } : {}),
        items: nextNestedItems,
      },
    })
  }

  function updateMetadataJson(rawValue: string) {
    try {
      const parsed = JSON.parse(rawValue) as Record<string, unknown>
      onChange({
        ...item,
        metadata: {
          ...parsed,
          ...(buttonLabel ? { buttonLabel } : {}),
          ...(isInternal ? { isInternal: true } : {}),
          ...(openInNewTab ? { openInNewTab: true } : {}),
          ...(isHidden ? { isHidden: true } : {}),
          ...(nestedItems.length > 0 ? { items: nestedItems } : {}),
        },
      })
    } catch {
      // Mantem o valor atual ate o JSON ficar valido.
    }
  }

  return (
    <div className={cn('rounded-[20px] border border-[#D8E6EB] bg-white p-4', depth > 0 && 'bg-[#FCFEFF]')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
            {depth > 0 ? `Elemento interno ${index + 1}` : `Elemento ${index + 1}`}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#15323b]">
            {item.title || item.label || item.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="rounded-full border border-[#D8E6EB] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-50"
          >
            Subir
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="rounded-full border border-[#D8E6EB] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-50"
          >
            Descer
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            className="rounded-full border border-[#D8E6EB] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]"
          >
            Duplicar
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-full border border-rose-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700 hover:bg-rose-50"
          >
            Remover
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">ID</span>
          <input
            value={item.id}
            onChange={(event) => updateField('id', event.target.value)}
            className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Label</span>
          <input
            value={item.label ?? ''}
            onChange={(event) => updateField('label', event.target.value)}
            className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Título</span>
          <input
            value={item.title ?? ''}
            onChange={(event) => updateField('title', event.target.value)}
            className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Link</span>
          <input
            value={item.href ?? ''}
            onChange={(event) => updateField('href', event.target.value)}
            className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Imagem</span>
          <input
            value={item.image ?? ''}
            onChange={(event) => updateField('image', event.target.value)}
            className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Descrição</span>
          <textarea
            value={item.description ?? ''}
            onChange={(event) => updateField('description', event.target.value)}
            rows={3}
            className="rounded-[14px] border border-[#D8E6EB] px-3 py-2 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Texto do botao opcional</span>
          <input
            value={buttonLabel}
            onChange={(event) => updateMetadataField('buttonLabel', event.target.value)}
            className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
            placeholder="Ex.: Falar com a equipe"
          />
        </label>
        <div className="grid gap-2 md:grid-cols-3 md:col-span-2">
          <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] px-3 py-3 text-sm font-semibold text-[#15323b]">
            <span>Link interno</span>
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(event) => updateMetadataField('isInternal', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] px-3 py-3 text-sm font-semibold text-[#15323b]">
            <span>Nova aba</span>
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(event) => updateMetadataField('openInNewTab', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] px-3 py-3 text-sm font-semibold text-[#15323b]">
            <span>Oculto</span>
            <input
              type="checkbox"
              checked={isHidden}
              onChange={(event) => updateMetadataField('isHidden', event.target.checked)}
            />
          </label>
        </div>
      </div>

      {nestedItems.length > 0 ? (
        <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">Itens internos</p>
              <p className="mt-1 text-sm font-semibold text-[#15323b]">Use esta área para mover links ou subelementos sem alterar o layout.</p>
            </div>
            <button
              type="button"
              onClick={() => updateNestedItems([
                ...nestedItems,
                { id: `item-${nestedItems.length + 1}`, label: 'Novo item', href: '#' },
              ])}
              className="rounded-full border border-[#D8E6EB] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-white"
            >
              Adicionar item
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {nestedItems.map((nestedItem, nestedIndex) => (
              <ListItemEditorCard
                key={nestedItem.id}
                item={nestedItem}
                index={nestedIndex}
                total={nestedItems.length}
                depth={depth + 1}
                onChange={(nextNestedItem) => {
                  const nextNestedItems = [...nestedItems]
                  nextNestedItems[nestedIndex] = nextNestedItem
                  updateNestedItems(nextNestedItems)
                }}
                onMove={(fromIndex, delta) => updateNestedItems(moveArrayItem(nestedItems, fromIndex, fromIndex + delta))}
                onDuplicate={(duplicateIndex) => {
                  const currentItem = nestedItems[duplicateIndex]
                  const nextNestedItems = [...nestedItems]
                  nextNestedItems.splice(duplicateIndex + 1, 0, {
                    ...currentItem,
                    id: `${currentItem.id}-copy-${Date.now()}`,
                  })
                  updateNestedItems(nextNestedItems)
                }}
                onRemove={(removeIndex) => updateNestedItems(nestedItems.filter((_, currentIndex) => currentIndex !== removeIndex))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {Object.keys(metadataWithoutItems).length > 0 ? (
        <label className="mt-4 grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Metadata JSON</span>
          <textarea
            defaultValue={JSON.stringify(metadataWithoutItems, null, 2)}
            onChange={(event) => updateMetadataJson(event.target.value)}
            rows={4}
            className="rounded-[14px] border border-[#D8E6EB] px-3 py-2 font-mono text-xs leading-5 text-[#15323b] outline-none focus:border-[#1398B7]"
          />
        </label>
      ) : null}
    </div>
  )
}

function EditorModal({
  editor,
  onClose,
  onSaved,
}: {
  editor: EditorInput
  onClose: () => void
  onSaved: () => void
}) {
  const initialRawValue = useMemo(() => valueToString(editor.fallback), [editor.fallback])
  const formRef = useRef<HTMLFormElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [rawValue, setRawValue] = useState(() => initialRawValue)
  const [uploadAlt, setUploadAlt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [textStyle, setTextStyle] = useState<TextStyleValue>(() => normalizeTextStyle(editor.styleFallback))
  const usesJsonEditor = ['list', 'json', 'link', 'button', 'image'].includes(editor.entryType)
  const usesRichTextToolbar = editor.entryType === 'rich_text'
  const isDirty = rawValue !== initialRawValue || JSON.stringify(normalizeTextStyle(editor.styleFallback)) !== JSON.stringify(textStyle)
  const parsedPreview = useMemo(() => {
    if (!usesJsonEditor) {
      return {
        value: rawValue,
        error: null as string | null,
      }
    }

    try {
      return {
        value: JSON.parse(rawValue) as unknown,
        error: null as string | null,
      }
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'JSON inválido.',
      }
    }
  }, [rawValue, usesJsonEditor])
  const previewImage = isStringRecord(parsedPreview.value) ? parsedPreview.value : null
  const previewList = Array.isArray(parsedPreview.value) ? parsedPreview.value : null
  const previewRecord = isStringRecord(parsedPreview.value) ? parsedPreview.value : null
  const previewTextStyle = useMemo(() => textStyleToCss(textStyle), [textStyle])

  function updateListEditor(nextItems: EditableListItem[]) {
    setRawValue(JSON.stringify(nextItems, null, 2))
  }

  function updateRecordEditor(nextValue: Record<string, unknown>) {
    setRawValue(JSON.stringify(nextValue, null, 2))
  }

  function applyRichTextFormat(before: string, after = before.replace('<', '</')) {
    const textarea = textareaRef.current
    if (!textarea) return

    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    const selectedText = rawValue.slice(selectionStart, selectionEnd)
    const nextValue = `${rawValue.slice(0, selectionStart)}${before}${selectedText || 'texto'}${after}${rawValue.slice(selectionEnd)}`

    setRawValue(nextValue)
    queueMicrotask(() => {
      textarea.focus()
      const cursorStart = selectionStart + before.length
      const cursorEnd = cursorStart + (selectedText || 'texto').length
      textarea.setSelectionRange(cursorStart, cursorEnd)
    })
  }

  const handleCloseRequest = useCallback(() => {
    if (isDirty && !window.confirm('Existem alterações não salvas. Deseja fechar mesmo assim?')) {
      return
    }

    onClose()
  }, [isDirty, onClose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleCloseRequest()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        formRef.current?.requestSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCloseRequest])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSaving(true)

    try {
      if (parsedPreview.error) {
        throw new Error(`JSON inválido: ${parsedPreview.error}`)
      }

      const value = usesJsonEditor
        ? parsedPreview.value
        : parseEditorValue(editor.entryType, rawValue)
      await saveSiteContentEntry({
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
        entryType: editor.entryType,
        value,
        schema: editor.schema,
      })
      if (editor.styleEntryKey) {
        await saveSiteContentEntry({
          pageKey: editor.pageKey,
          entryKey: editor.styleEntryKey,
          entryType: 'json',
          value: normalizeTextStyle(textStyle),
          schema: { kind: 'text-style' },
        })
      }
      await editor.reload()
      onSaved()
      setMessage('Conteúdo salvo e publicado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o conteúdo.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleImageUpload(file: File | null) {
    if (!file) return
    setMessage(null)
    setIsSaving(true)

    try {
      const asset = await uploadSiteAsset(file, {
        alt: uploadAlt || file.name,
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
      })
      setRawValue(JSON.stringify({
        src: asset.public_url,
        alt: asset.alt,
        asset_id: asset.id,
      }, null, 2))
      setUploadAlt(asset.alt ?? '')
      setMessage('Imagem enviada. Clique em salvar para publicar.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#061b21]/62 px-4 py-6 backdrop-blur-sm">
      <form
        ref={formRef}
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[linear-gradient(180deg,#F8FCFD_0%,#FFFFFF_100%)] p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Editor visual</p>
            <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">{editor.label}</h2>
            <p className="mt-1 text-xs font-semibold text-[#5F7077]">{editor.pageKey}/{editor.entryKey}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#15323b]">
                Tipo: {editor.entryType}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#15323b]">
                Estrutura: {describeValueShape(parsedPreview.value)}
              </span>
              {isDirty ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                  Alterações não salvas
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={handleCloseRequest} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-4">
            {editor.entryType === 'image' ? (
              <div className="grid gap-3 rounded-[22px] border border-[#D8E6EB] bg-[#F2F7F9] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Ativo visual</p>
                    <p className="mt-1 text-sm font-semibold text-[#15323b]">Substitua a mídia e ajuste o texto alternativo sem sair da página.</p>
                  </div>
                  <ImageIcon className="h-5 w-5 text-[#1398B7]" />
                </div>
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Texto alternativo</span>
                  <input
                    value={uploadAlt}
                    onChange={(event) => setUploadAlt(event.target.value)}
                    className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    placeholder="Descrição da imagem"
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-[#1398B7] bg-white px-4 py-3 text-sm font-black text-[#0A3640] hover:bg-[#E8F6FA]">
                  <ImageIcon className="h-4 w-4" />
                  Enviar imagem
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)} />
                </label>
              </div>
            ) : null}

            {previewList ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Editor de listagem</p>
                    <p className="mt-1 text-sm font-semibold text-[#15323b]">Edite itens, mova ordem e reorganize elementos sem alterar a estrutura visual da página.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateListEditor([
                      ...normalizeEditableListItems(parsedPreview.value),
                      { id: `item-${previewList.length + 1}`, label: 'Novo item' },
                    ])}
                    className="rounded-full border border-[#D8E6EB] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-white"
                  >
                    Adicionar item
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {normalizeEditableListItems(parsedPreview.value).map((item, index) => (
                    <ListItemEditorCard
                      key={item.id}
                      item={item}
                      index={index}
                      total={previewList.length}
                      onChange={(nextItem) => {
                        const nextItems = normalizeEditableListItems(parsedPreview.value)
                        nextItems[index] = nextItem
                        updateListEditor(nextItems)
                      }}
                      onMove={(fromIndex, delta) => updateListEditor(moveArrayItem(normalizeEditableListItems(parsedPreview.value), fromIndex, fromIndex + delta))}
                      onDuplicate={(duplicateIndex) => {
                        const nextItems = normalizeEditableListItems(parsedPreview.value)
                        const currentItem = nextItems[duplicateIndex]
                        nextItems.splice(duplicateIndex + 1, 0, {
                          ...currentItem,
                          id: `${currentItem.id}-copy-${Date.now()}`,
                        })
                        updateListEditor(nextItems)
                      }}
                      onRemove={(removeIndex) => updateListEditor(normalizeEditableListItems(parsedPreview.value).filter((_, currentIndex) => currentIndex !== removeIndex))}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {previewRecord && !previewList ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1398B7]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Editor guiado</p>
                </div>
                {editor.entryType === 'button' || editor.entryType === 'link' ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Texto</span>
                      <input
                        value={typeof previewRecord.label === 'string' ? previewRecord.label : ''}
                        onChange={(event) => updateRecordEditor({ ...previewRecord, label: event.target.value })}
                        className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Link</span>
                      <input
                        value={typeof previewRecord.href === 'string' ? previewRecord.href : ''}
                        onChange={(event) => updateRecordEditor({ ...previewRecord, href: event.target.value })}
                        className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      />
                    </label>
                    {editor.entryType === 'button' ? (
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tom visual</span>
                        <select
                          value={typeof previewRecord.tone === 'string' ? previewRecord.tone : 'solid'}
                          onChange={(event) => updateRecordEditor({ ...previewRecord, tone: event.target.value })}
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                        >
                          <option value="solid">Solid</option>
                          <option value="surface">Surface</option>
                          <option value="ghost">Ghost</option>
                        </select>
                      </label>
                    ) : null}
                    <div className="grid gap-2 md:col-span-2 md:grid-cols-3">
                      <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] bg-white px-3 py-3 text-sm font-semibold text-[#15323b]">
                        <span>Link interno</span>
                        <input
                          type="checkbox"
                          checked={previewRecord.isInternal === true}
                          onChange={(event) => updateRecordEditor({ ...previewRecord, isInternal: event.target.checked })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] bg-white px-3 py-3 text-sm font-semibold text-[#15323b]">
                        <span>Nova aba</span>
                        <input
                          type="checkbox"
                          checked={previewRecord.openInNewTab === true}
                          onChange={(event) => updateRecordEditor({ ...previewRecord, openInNewTab: event.target.checked })}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] bg-white px-3 py-3 text-sm font-semibold text-[#15323b]">
                        <span>Oculto</span>
                        <input
                          type="checkbox"
                          checked={previewRecord.isHidden === true}
                          onChange={(event) => updateRecordEditor({ ...previewRecord, isHidden: event.target.checked })}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {Object.entries(previewRecord).map(([key, currentValue]) => {
                    if (typeof currentValue === 'string') {
                      return (
                        <label key={key} className="grid gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{key}</span>
                          <input
                            value={currentValue}
                            onChange={(event) => setRawValue(JSON.stringify({
                              ...previewRecord,
                              [key]: event.target.value,
                            }, null, 2))}
                            className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                          />
                        </label>
                      )
                    }

                    if (typeof currentValue === 'boolean') {
                      return (
                        <label key={key} className="flex h-11 items-center justify-between rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b]">
                          <span>{key}</span>
                          <input
                            type="checkbox"
                            checked={currentValue}
                            onChange={(event) => setRawValue(JSON.stringify({
                              ...previewRecord,
                              [key]: event.target.checked,
                            }, null, 2))}
                          />
                        </label>
                      )
                    }

                    return (
                      <div key={key} className="rounded-[14px] border border-[#D8E6EB] bg-white px-3 py-2 text-xs font-semibold text-[#5F7077]">
                        <span className="font-black uppercase tracking-[0.14em]">{key}</span>
                        <pre className="mt-2 overflow-auto leading-5 text-[#15323b]">{JSON.stringify(currentValue, null, 2)}</pre>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {editor.styleEntryKey ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1398B7]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Estilo do texto</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Cor</span>
                    <input
                      value={textStyle.color ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, color: event.target.value }))}
                      placeholder="#183139"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Fonte</span>
                    <input
                      value={textStyle.fontFamily ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, fontFamily: event.target.value }))}
                      placeholder="readex-pro, serif"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tamanho</span>
                    <input
                      value={textStyle.fontSize ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, fontSize: event.target.value }))}
                      placeholder="2.5rem"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Peso</span>
                    <input
                      value={textStyle.fontWeight ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, fontWeight: event.target.value }))}
                      placeholder="800"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Entrelinha</span>
                    <input
                      value={textStyle.lineHeight ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, lineHeight: event.target.value }))}
                      placeholder="1.1"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Letter spacing</span>
                    <input
                      value={textStyle.letterSpacing ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, letterSpacing: event.target.value }))}
                      placeholder="-0.04em"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="rounded-[22px] border border-[#D8E6EB] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E6EB] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                    {usesJsonEditor ? 'Conteúdo estruturado JSON' : usesRichTextToolbar ? 'Editor rico' : 'Conteúdo'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#15323b]">
                    {usesJsonEditor
                      ? 'Edite o valor com estrutura válida e publique em seguida.'
                      : usesRichTextToolbar
                        ? 'Use os atalhos e os botões de formatação para compor conteúdo rico sem trocar a estrutura da página.'
                        : 'Edite o texto bruto com atualização imediata no site.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {usesJsonEditor ? (
                    <button
                      type="button"
                      onClick={() => setRawValue(valueToString(parsedPreview.value as EditableValue))}
                      disabled={!!parsedPreview.error}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      Formatar JSON
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setRawValue(initialRawValue)
                      setTextStyle(normalizeTextStyle(editor.styleFallback))
                    }}
                    disabled={!isDirty}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(`${editor.pageKey}/${editor.entryKey}`)
                      setMessage('Chave copiada para a área de transferência.')
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar chave
                  </button>
                </div>
              </div>

              {usesRichTextToolbar ? (
                <div className="flex flex-wrap gap-2 border-b border-[#D8E6EB] px-4 py-3">
                  <button type="button" onClick={() => applyRichTextFormat('<strong>', '</strong>')} className="rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]">Negrito</button>
                  <button type="button" onClick={() => applyRichTextFormat('<em>', '</em>')} className="rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]">Itálico</button>
                  <button type="button" onClick={() => applyRichTextFormat('<p>', '</p>')} className="rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]">Parágrafo</button>
                  <button type="button" onClick={() => applyRichTextFormat('<h3>', '</h3>')} className="rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]">Título</button>
                  <button type="button" onClick={() => applyRichTextFormat('<ul><li>', '</li></ul>')} className="rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]">Lista</button>
                </div>
              ) : null}

              <div className="grid gap-2 p-4">
                <textarea
                  ref={textareaRef}
                  value={rawValue}
                  onChange={(event) => setRawValue(event.target.value)}
                  rows={usesJsonEditor ? 18 : usesRichTextToolbar ? 14 : 10}
                  className="w-full resize-y rounded-[18px] border border-[#D8E6EB] bg-white px-4 py-3 font-mono text-sm leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                />
                {parsedPreview.error ? (
                  <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    JSON inválido: {parsedPreview.error}
                  </div>
                ) : null}
                {message ? (
                  <div className="rounded-[16px] border border-[#D8E6EB] bg-[#F2F7F9] p-3 text-sm font-bold text-[#15323b]">
                    {message}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#1398B7]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Preview rápido</p>
              </div>

              {editor.entryType === 'image' && previewImage ? (
                <div className="mt-4 grid gap-3">
                  {typeof previewImage.src === 'string' && previewImage.src ? (
                    <img
                      src={previewImage.src}
                      alt={typeof previewImage.alt === 'string' ? previewImage.alt : ''}
                      className="h-48 w-full rounded-[18px] border border-[#D8E6EB] object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-[18px] border border-dashed border-[#D8E6EB] bg-white text-sm font-semibold text-[#5F7077]">
                      Sem imagem definida
                    </div>
                  )}
                  <div className="rounded-[18px] bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5F7077]">Alt</p>
                    <p className="mt-2 text-sm font-semibold text-[#15323b]">{typeof previewImage.alt === 'string' && previewImage.alt ? previewImage.alt : 'Sem texto alternativo.'}</p>
                  </div>
                </div>
              ) : usesRichTextToolbar ? (
                <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                  <div
                    className="max-w-none text-sm leading-7 text-[#15323b]"
                    style={previewTextStyle}
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(rawValue) }}
                  />
                </div>
              ) : previewList ? (
                <div className="mt-4 grid gap-3">
                  {previewList.slice(0, 4).map((item, index) => (
                    <div key={index} className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5F7077]">Item {index + 1}</p>
                      <pre className="mt-2 overflow-auto text-xs leading-5 text-[#15323b]">{JSON.stringify(item, null, 2)}</pre>
                    </div>
                  ))}
                  {previewList.length > 4 ? (
                    <p className="text-xs font-semibold text-[#5F7077]">Mostrando 4 de {previewList.length} item(ns).</p>
                  ) : null}
                </div>
              ) : previewRecord ? (
                <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                  <pre className="overflow-auto text-xs leading-5 text-[#15323b]">{JSON.stringify(previewRecord, null, 2)}</pre>
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                  <p className="text-sm leading-7 text-[#15323b]" style={previewTextStyle}>{String(parsedPreview.value ?? '') || 'Sem conteúdo.'}</p>
                </div>
              )}
            </div>

            <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-[#1398B7]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Atalhos</p>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-[#15323b]">
                <p><span className="font-black">Ctrl/Cmd + S</span> salva e publica.</p>
                <p><span className="font-black">Esc</span> fecha o modal.</p>
                <p><span className="font-black">Restaurar</span> volta ao valor carregado antes da edição atual.</p>
                <p><span className="font-black">Listagens</span> agora podem ser reordenadas e reorganizadas visualmente.</p>
              </div>
            </div>

            {editor.schema ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Schema salvo</p>
                <pre className="mt-3 overflow-auto rounded-[16px] bg-[#F8FCFD] p-4 text-xs leading-5 text-[#15323b]">
                  {JSON.stringify(editor.schema, null, 2)}
                </pre>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D8E6EB] bg-[#FCFEFF] p-5">
          <p className="text-xs font-semibold text-[#5F7077]">
            O conteúdo é publicado imediatamente após salvar.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={handleCloseRequest} className="rounded-full border border-[#D8E6EB] bg-white px-5 py-3 text-sm font-black text-[#5F7077] hover:bg-[#F2F7F9]">
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSaving || !!parsedPreview.error}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 py-3 text-sm font-black text-white hover:opacity-95 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar e publicar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export function VisualEditorProvider({ children }: { children: ReactNode }) {
  const { roles, isLoading } = useAuth()
  const location = useLocation()
  const [settings, setSettings] = useState<SiteEditorSettings>(defaultSiteEditorSettings)
  const [isEditing, setIsEditing] = useState(false)
  const [editor, setEditor] = useState<EditorInput | null>(null)
  const isAdmin = roles.includes('admin')
  const canShowEditor = isAdmin && isPublicEditablePath(location.pathname) && !shouldIgnoreSiteEditor()

  const loadSettings = useCallback(async () => {
    try {
      const nextSettings = await fetchSiteEditorSettings()
      setSettings(nextSettings)
      if (!nextSettings.is_enabled || !nextSettings.editing_enabled || nextSettings.fallback_mode) {
        setIsEditing(false)
      }
    } catch {
      setSettings({
        ...defaultSiteEditorSettings,
        is_enabled: false,
        read_overrides_enabled: false,
        editing_enabled: false,
        fallback_mode: true,
      })
      setIsEditing(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && isAdmin && !shouldIgnoreSiteEditor()) {
      queueMicrotask(() => {
        void loadSettings()
      })
    }
  }, [isAdmin, isLoading, loadSettings])

  const value = useMemo<VisualEditorContextValue>(() => ({
    isAdmin,
    isEditing: canShowEditor && isEditing && settings.is_enabled && settings.editing_enabled && !settings.fallback_mode,
    settings,
    startEditing: () => setIsEditing(true),
    stopEditing: () => setIsEditing(false),
    openEditor: setEditor,
    resolveValue: (_entryKey, fallback) => fallback,
  }), [canShowEditor, isAdmin, isEditing, settings])

  return (
    <VisualEditorContext.Provider value={value}>
      {children}
      {canShowEditor && settings.is_enabled && settings.editing_enabled && !settings.fallback_mode ? (
        <div className="fixed bottom-5 left-1/2 z-[110] w-[min(calc(100%-24px),760px)] -translate-x-1/2 rounded-[24px] border border-[#D8E6EB] bg-white/95 px-4 py-3 shadow-[0_18px_50px_rgba(6,27,33,0.2)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                  isEditing ? 'bg-[#0A3640] text-white' : 'bg-[#E8F6FA] text-[#0A3640]',
                )}>
                  {isEditing ? 'Modo edição ativo' : 'Modo navegação'}
                </span>
                <span className="inline-flex items-center rounded-full border border-[#D8E6EB] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                  {location.pathname}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#15323b]">
                Clique nos blocos destacados para editar. Use <span className="font-black">Ctrl/Cmd + S</span> para salvar e <span className="font-black">Esc</span> para fechar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em]',
                  isEditing ? 'bg-[#0A3640] text-white' : 'bg-[#1398B7] text-white',
                )}
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isEditing ? 'Sair da edição' : 'Ativar edição'}
              </button>
              <Link to="/admin/site-editor" className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#0A3640] hover:bg-[#F2F7F9]">
                <Settings className="h-3.5 w-3.5" />
                Gestão
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {editor ? (
        <EditorModal
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            void loadSettings()
          }}
        />
      ) : null}
    </VisualEditorContext.Provider>
  )
}

export function SiteContentScope({ pageKey, children }: { pageKey: SitePageKey; children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, SiteContentEntry>>(new Map())
  const editor = useContext(VisualEditorContext)
  const settings = editor?.settings ?? defaultSiteEditorSettings

  const reload = useCallback(async () => {
    if (shouldIgnoreSiteEditor() || !settings.is_enabled || !settings.read_overrides_enabled || settings.fallback_mode) {
      setEntries(new Map())
      return
    }

    try {
      const rows = await fetchSiteContent(pageKey)
      setEntries(new Map(rows.map((entry) => [`${entry.page_key}:${entry.entry_key}`, entry])))
    } catch {
      setEntries(new Map())
    }
  }, [pageKey, settings.fallback_mode, settings.is_enabled, settings.read_overrides_enabled])

  useEffect(() => {
    queueMicrotask(() => {
      void reload()
    })
  }, [reload])

  const value = useMemo<SiteContentContextValue>(() => ({
    pageKey,
    entries,
    reload,
  }), [entries, pageKey, reload])

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}

export function useEditableValue<TValue extends EditableValue>(
  entryKey: string,
  fallback: TValue,
  options: { pageKey?: SitePageKey } = {},
) {
  const scope = useContext(SiteContentContext)
  const pageKey = options.pageKey ?? scope?.pageKey ?? 'global'
  const ownEntry = scope?.entries.get(`${pageKey}:${entryKey}`)
  const globalEntry = scope?.entries.get(`global:${entryKey}`)
  const entry = ownEntry ?? globalEntry

  return coerceEditableValue(entry?.value, fallback) as TValue
}

export function isEditableItemVisible(item: EditableListItem) {
  return item.metadata?.isHidden !== true
}

export function EditableText({
  entryKey,
  fallback,
  label,
  pageKey,
}: {
  entryKey: string
  fallback: string
  label: string
  pageKey?: SitePageKey
}) {
  const scope = useContext(SiteContentContext)
  const editor = useContext(VisualEditorContext)
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const value = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })
  const styleEntryKey = `${entryKey}.__style`
  const styleValue = normalizeTextStyle(useEditableValue(styleEntryKey, {}, { pageKey: resolvedPageKey }))
  const inlineStyle = textStyleToCss(styleValue)
  const content = inlineStyle ? <span style={inlineStyle}>{value}</span> : <>{value}</>

  if (!editor?.isEditing || !scope) {
    return content
  }

  return (
    <EditableMarker
      label={label}
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'text',
        label,
        fallback: value,
        styleEntryKey,
        styleFallback: styleValue,
        reload: scope.reload,
      })}
    >
      {content}
    </EditableMarker>
  )
}

export function EditableRichText({
  entryKey,
  fallback,
  label,
  pageKey,
  className,
}: {
  entryKey: string
  fallback: string
  label: string
  pageKey?: SitePageKey
  className?: string
}) {
  const scope = useContext(SiteContentContext)
  const editor = useContext(VisualEditorContext)
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const value = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })
  const styleEntryKey = `${entryKey}.__style`
  const styleValue = normalizeTextStyle(useEditableValue(styleEntryKey, {}, { pageKey: resolvedPageKey }))
  const content = (
    <div
      className={className}
      style={textStyleToCss(styleValue)}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
    />
  )

  if (!editor?.isEditing || !scope) {
    return content
  }

  return (
    <EditableMarker
      label={label}
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'rich_text',
        label,
        fallback: value,
        styleEntryKey,
        styleFallback: styleValue,
        reload: scope.reload,
      })}
    >
      {content}
    </EditableMarker>
  )
}

export function EditableImage({
  entryKey,
  fallback,
  label,
  pageKey,
  children,
}: {
  entryKey: string
  fallback: Record<string, unknown>
  label: string
  pageKey?: SitePageKey
  children: (image: Record<string, unknown>) => ReactNode
}) {
  const scope = useContext(SiteContentContext)
  const editor = useContext(VisualEditorContext)
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const value = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })

  if (!editor?.isEditing || !scope) {
    return <>{children(value)}</>
  }

  return (
    <EditableMarker
      label={label}
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'image',
        label,
        fallback: value,
        reload: scope.reload,
      })}
    >
      {children(value)}
    </EditableMarker>
  )
}

export function EditableButton({
  entryKey,
  fallback,
  label,
  pageKey,
  children,
}: {
  entryKey: string
  fallback: Record<string, unknown>
  label: string
  pageKey?: SitePageKey
  children: (button: Record<string, unknown>) => ReactNode
}) {
  const scope = useContext(SiteContentContext)
  const editor = useContext(VisualEditorContext)
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const value = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })

  if (!editor?.isEditing || !scope) {
    return <>{children(value)}</>
  }

  return (
    <EditableMarker
      label={label}
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'button',
        label,
        fallback: value,
        reload: scope.reload,
      })}
    >
      {children(value)}
    </EditableMarker>
  )
}

export function EditableLink({
  entryKey,
  fallback,
  label,
  pageKey,
  children,
}: {
  entryKey: string
  fallback: Record<string, unknown>
  label: string
  pageKey?: SitePageKey
  children: (linkValue: Record<string, unknown>) => ReactNode
}) {
  const scope = useContext(SiteContentContext)
  const editor = useContext(VisualEditorContext)
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const value = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })

  if (!editor?.isEditing || !scope) {
    return <>{children(value)}</>
  }

  return (
    <EditableMarker
      label={label}
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'link',
        label,
        fallback: value,
        reload: scope.reload,
      })}
    >
      {children(value)}
    </EditableMarker>
  )
}

export function EditableList({
  entryKey,
  fallback,
  label,
  children,
  pageKey,
}: {
  entryKey: string
  fallback: EditableListItem[]
  label: string
  children: (items: EditableListItem[]) => ReactNode
  pageKey?: SitePageKey
}) {
  const scope = useContext(SiteContentContext)
  const editor = useContext(VisualEditorContext)
  const resolvedPageKey = pageKey ?? scope?.pageKey ?? 'global'
  const value = useEditableValue(entryKey, fallback, { pageKey: resolvedPageKey })

  if (!editor?.isEditing || !scope) {
    return <>{children(value)}</>
  }

  return (
    <EditableMarker
      label={label}
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'list',
        label,
        fallback: value,
        reload: scope.reload,
      })}
    >
      {children(value)}
    </EditableMarker>
  )
}

export function EditableControlsHint() {
  const editor = useContext(VisualEditorContext)
  if (!editor?.isEditing) return null

  return (
    <div className="fixed right-5 top-5 z-[110] max-w-xs rounded-[22px] border border-[#D8E6EB] bg-white p-4 text-xs font-bold leading-5 text-[#15323b] shadow-[0_18px_50px_rgba(6,27,33,0.12)]">
      <div className="flex items-start gap-2">
        <RotateCcw className="mt-0.5 h-4 w-4 text-[#1398B7]" />
        <p>Clique nos itens destacados para editar. O site público continua intacto fora do modo edição e cada salvamento publica imediatamente.</p>
      </div>
    </div>
  )
}
