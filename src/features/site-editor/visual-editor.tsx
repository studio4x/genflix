import {
  createContext,
  cloneElement,
  isValidElement,
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
import { CheckCircle2, Copy, Edit3, Image as ImageIcon, LayoutTemplate, MessageSquare, PanelBottomOpen, Plus, Redo2, RotateCcw, Save, Send, Settings, Sparkles, Undo2, Wand2, X } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton, normalizeGenflixCtaTone } from '@/components/public/genflix-cta-button'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { supabase } from '@/services/supabase/client'
import { cn } from '@/lib/utils'
import {
  createSiteEditorWorkspaceComment,
  fetchSiteAssets,
  fetchSiteContent,
  fetchSiteEditorWorkspace,
  fetchSiteEditorSettings,
  saveSiteContentEntry,
  shouldIgnoreSiteEditor,
  upsertSiteEditorWorkspaceRecord,
  uploadSiteAsset,
} from '@/features/site-editor/api'
import {
  defaultSiteEditorSettings,
  type EditableListItem,
  type SiteAsset,
  type SiteContentEntry,
  type SiteContentEntryType,
  type SiteEditorSettings,
  type SitePageKey,
} from '@/features/site-editor/types'
import { renderSiteIcon, renderSiteIconVisual, SITE_ICON_OPTIONS } from '@/features/site-editor/site-icons'
import { defaultSiteAppearance, normalizeSiteAppearance } from '@/features/site-editor/site-appearance'
import {
  createSiteEditorWorkspaceKey,
  formatWorkflowStatus,
  getDefaultWorkspaceRecord,
  getSiteEditorPermissions,
  type SiteEditorWorkflowStatus,
  type SiteEditorWorkspaceMap,
  type SiteEditorWorkspaceRecord,
} from '@/features/site-editor/collaboration'

type EditableValue = string | EditableListItem[] | Record<string, unknown> | null
type TextStyleValue = {
  color?: string
  backgroundColor?: string
  width?: string
  height?: string
  minWidth?: string
  minHeight?: string
  maxWidth?: string
  maxHeight?: string
  paddingInline?: string
  paddingBlock?: string
  borderRadius?: string
  fontFamily?: string
  fontSize?: string
  fontWeight?: string
  letterSpacing?: string
  lineHeight?: string
  textTransform?: string
  fontStyle?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  headingTag?: string
}

type PreviewViewport = 'desktop' | 'tablet' | 'mobile'

type NormalizedListEditorTemplate = {
  id: string
  label: string
  description?: string
  item: EditableListItem
}

type NormalizedListEditorSchema = {
  kind: 'default' | 'section-registry'
  itemName: string
  addLabel: string
  templates: NormalizedListEditorTemplate[]
  hiddenFields: Set<string>
  instancePrefix?: string
  instancePageKey?: SitePageKey
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

function getStringField(value: Record<string, unknown>, field: string) {
  return typeof value[field] === 'string' ? value[field] as string : ''
}

function getNumberField(value: Record<string, unknown>, field: string, fallback: number) {
  const rawValue = value[field]
  const numericValue = typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' ? Number(rawValue) : NaN
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.min(100, Math.max(0, numericValue))
}

export function getEditableImagePresentation(value: unknown) {
  const record = isStringRecord(value) ? value : {}
  const fit = getStringField(record, 'fit') === 'contain' ? 'contain' : 'cover'
  const focusX = getNumberField(record, 'focusX', 50)
  const focusY = getNumberField(record, 'focusY', 50)
  const position = `${focusX}% ${focusY}%`

  return {
    fit,
    focusX,
    focusY,
    objectFit: fit as CSSProperties['objectFit'],
    objectPosition: position,
    backgroundPosition: position,
    imageAlt: getStringField(record, 'alt'),
    imageSrc: getStringField(record, 'src'),
  }
}

function slugifyEditableId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'
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
  const fields: Array<Exclude<keyof TextStyleValue, 'headingTag' | 'textAlign'>> = [
    'color',
    'backgroundColor',
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'paddingInline',
    'paddingBlock',
    'borderRadius',
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

  if (typeof value.headingTag === 'string') {
    const normalizedHeadingTag = value.headingTag.trim().toLowerCase()
    if (/^h[1-6]$/.test(normalizedHeadingTag)) {
      nextStyle.headingTag = normalizedHeadingTag
    }
  }

  if (typeof value.textAlign === 'string') {
    const normalizedTextAlign = value.textAlign.trim().toLowerCase()
    if (['left', 'center', 'right', 'justify'].includes(normalizedTextAlign)) {
      nextStyle.textAlign = normalizedTextAlign as TextStyleValue['textAlign']
    }
  }

  return nextStyle
}

function hasTextStyle(style: TextStyleValue) {
  return Object.entries(style).some(([key, value]) => key !== 'headingTag' && typeof value === 'string' && value.trim() !== '')
}

function hasBoxStyle(style: TextStyleValue) {
  return Boolean(
    style.backgroundColor
    || style.width
    || style.height
    || style.minWidth
    || style.minHeight
    || style.maxWidth
    || style.maxHeight
    || style.paddingInline
    || style.paddingBlock
    || style.borderRadius
    || style.textAlign
  )
}

function textStyleToCss(style: TextStyleValue): CSSProperties | undefined {
  const normalized = normalizeTextStyle(style)
  const { headingTag: _headingTag, ...cssStyle } = normalized

  if (!hasTextStyle(cssStyle)) {
    return undefined
  }

  return cssStyle
}

function cloneNodeWithStyle(node: ReactNode, style?: CSSProperties) {
  if (!style || !isValidElement<{ style?: CSSProperties }>(node)) {
    return node
  }

  return cloneElement(node, {
    style: {
      ...(node.props.style ?? {}),
      ...style,
    },
  })
}

const BUTTON_STYLE_PRESETS = [
  {
    tone: 'solid' as const,
    label: 'Principal',
    description: 'Botão forte, para chamada primária.',
  },
  {
    tone: 'warm' as const,
    label: 'Aquecido',
    description: 'Botão com destaque verde para ações positivas.',
  },
  {
    tone: 'surface' as const,
    label: 'Superfície',
    description: 'Botão claro, ideal para ações secundárias.',
  },
  {
    tone: 'ghost' as const,
    label: 'Discreto',
    description: 'Botão translúcido para fundos escuros.',
  },
] as const

function isTitleEditorEntry(label: string, entryKey: string) {
  const normalizedLabel = label.toLowerCase()
  const normalizedEntryKey = entryKey.toLowerCase()
  return (
    normalizedLabel.includes('título')
    || normalizedLabel.includes('titulo')
    || normalizedEntryKey.endsWith('.title')
    || normalizedEntryKey.includes('.title.')
    || normalizedEntryKey.includes('.heading')
    || normalizedEntryKey.includes('.headline')
  )
}

function getHeadingTagLabel(tag?: string) {
  return (typeof tag === 'string' && /^h[1-6]$/.test(tag) ? tag.toUpperCase() : 'H2')
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

function normalizeListEditorSchema(schema: Record<string, unknown> | undefined): NormalizedListEditorSchema {
  const defaultConfig: NormalizedListEditorSchema = {
    kind: 'default',
    itemName: 'item',
    addLabel: 'Adicionar item',
    templates: [],
    hiddenFields: new Set<string>(),
  }

  if (!isStringRecord(schema)) {
    return defaultConfig
  }

  const kind = schema.kind === 'section-registry' ? 'section-registry' : 'default'
  const rawTemplates = Array.isArray(schema.templates) ? schema.templates : []
  const templates = rawTemplates.flatMap((template, index) => {
    if (!isStringRecord(template)) {
      return []
    }

    const id = typeof template.id === 'string' && template.id.trim() !== ''
      ? template.id
      : `template-${index + 1}`
    const label = typeof template.label === 'string' && template.label.trim() !== ''
      ? template.label
      : id
    const description = typeof template.description === 'string' ? template.description : undefined
    const templateItemSource = isStringRecord(template.item)
      ? template.item
      : {
        id,
        label,
        description,
        metadata: {
          templateKey: id,
        },
      }
    const normalizedItem = normalizeEditableListItems([templateItemSource])[0] ?? { id, label }
    const nextMetadata = isStringRecord(normalizedItem.metadata) ? { ...normalizedItem.metadata } : {}
    if (typeof nextMetadata.templateKey !== 'string') {
      nextMetadata.templateKey = id
    }

    return [{
      id,
      label,
      description,
      item: {
        ...normalizedItem,
        label: normalizedItem.label ?? label,
        metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined,
      },
    }]
  })

  return {
    kind,
    itemName: typeof schema.itemName === 'string' && schema.itemName.trim() !== '' ? schema.itemName : defaultConfig.itemName,
    addLabel: typeof schema.addLabel === 'string' && schema.addLabel.trim() !== '' ? schema.addLabel : defaultConfig.addLabel,
    templates,
    hiddenFields: new Set(
      Array.isArray(schema.hiddenFields)
        ? schema.hiddenFields.filter((field): field is string => typeof field === 'string' && field.trim() !== '')
        : [],
    ),
    instancePrefix: typeof schema.instancePrefix === 'string' && schema.instancePrefix.trim() !== '' ? schema.instancePrefix : undefined,
    instancePageKey: typeof schema.instancePageKey === 'string' && schema.instancePageKey.trim() !== '' ? schema.instancePageKey as SitePageKey : undefined,
  }
}

function cloneEditableListItem(item: EditableListItem, config: NormalizedListEditorSchema) {
  const normalizedItem = normalizeEditableListItems([item])[0] ?? item
  const nextId = `${slugifyEditableId(normalizedItem.id || normalizedItem.label || config.itemName)}-${Date.now()}`
  const nextMetadata = isStringRecord(normalizedItem.metadata) ? { ...normalizedItem.metadata } : {}

  if (config.kind === 'section-registry' && config.instancePrefix) {
    nextMetadata.entryPrefix = `${config.instancePrefix}.${nextId}`
    if (config.instancePageKey) {
      nextMetadata.pageKey = config.instancePageKey
    }
  }

  return {
    ...normalizedItem,
    id: nextId,
    metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined,
  }
}

function createListItemFromTemplate(template: NormalizedListEditorTemplate, config: NormalizedListEditorSchema) {
  const nextId = `${slugifyEditableId(template.id)}-${Date.now()}`
  const nextMetadata = isStringRecord(template.item.metadata) ? { ...template.item.metadata } : {}

  if (config.kind === 'section-registry' && config.instancePrefix) {
    nextMetadata.entryPrefix = `${config.instancePrefix}.${nextId}`
    if (config.instancePageKey) {
      nextMetadata.pageKey = config.instancePageKey
    }
  }

  return {
    ...template.item,
    id: nextId,
    label: template.item.label ?? template.label,
    metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined,
  }
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

function workflowStatusClasses(status: SiteEditorWorkflowStatus) {
  switch (status) {
    case 'draft':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'review':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'published':
      return 'border-[#D8E6EB] bg-[#E8F6FA] text-[#0A3640]'
    default:
      return 'border-[#D8E6EB] bg-white text-[#15323b]'
  }
}

function EditableMarker({
  children,
  onClick,
  label,
  display = 'inline',
}: {
  children: ReactNode
  onClick: () => void
  label: string
  display?: 'inline' | 'block' | 'contents'
}) {
  if (display === 'contents') {
    return (
      <div
        className="contents"
        onClickCapture={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onClick()
        }}
      >
        {children}
      </div>
    )
  }

  const Wrapper = display === 'block' ? 'div' : 'span'

  return (
    <Wrapper
      className={cn(
        'group/site-editor relative cursor-pointer rounded-[10px] bg-[#1398B7]/6 outline outline-2 outline-offset-2 outline-[#1398B7]/50 transition hover:bg-[#1398B7]/10 hover:outline-[#1398B7] focus-visible:bg-[#1398B7]/10',
        display === 'block' && 'block',
      )}
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
    </Wrapper>
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
  onUploadIcon,
  editorConfig,
}: {
  item: EditableListItem
  index: number
  total: number
  depth?: number
  onChange: (nextItem: EditableListItem) => void
  onMove: (fromIndex: number, delta: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onUploadIcon?: (index: number, file: File) => void
  editorConfig: NormalizedListEditorSchema
}) {
  const metadata: Record<string, unknown> = isStringRecord(item.metadata) ? { ...item.metadata } : {}
  const nestedItems = normalizeEditableListItems(metadata.items)
  const metadataWithoutItems: Record<string, unknown> = { ...metadata }
  delete metadataWithoutItems.items
  const buttonLabel = typeof metadataWithoutItems.buttonLabel === 'string' ? metadataWithoutItems.buttonLabel : ''
  const isInternal = metadataWithoutItems.isInternal === true
  const openInNewTab = metadataWithoutItems.openInNewTab === true
  const isHidden = metadataWithoutItems.isHidden === true
  const templateKey = typeof metadataWithoutItems.templateKey === 'string' ? metadataWithoutItems.templateKey : ''
  const entryPrefix = typeof metadataWithoutItems.entryPrefix === 'string' ? metadataWithoutItems.entryPrefix : ''
  const pageKeyOverride = typeof metadataWithoutItems.pageKey === 'string' ? metadataWithoutItems.pageKey : ''
  const iconKey = typeof metadataWithoutItems.iconKey === 'string' ? metadataWithoutItems.iconKey : ''
  const colorValue = typeof metadataWithoutItems.color === 'string' ? metadataWithoutItems.color : ''
  const iconImageUrl = typeof metadataWithoutItems.iconImageUrl === 'string' ? metadataWithoutItems.iconImageUrl : ''
  const iconImageAlt = typeof metadataWithoutItems.iconImageAlt === 'string' ? metadataWithoutItems.iconImageAlt : ''
  const templateDefinition = editorConfig.templates.find((template) => template.id === templateKey)
  const shouldShowIconField = editorConfig.kind === 'section-registry' || iconKey !== '' || templateKey === 'categories' || templateKey === 'resources'
  delete metadataWithoutItems.buttonLabel
  delete metadataWithoutItems.isInternal
  delete metadataWithoutItems.openInNewTab
  delete metadataWithoutItems.isHidden
  delete metadataWithoutItems.templateKey
  delete metadataWithoutItems.entryPrefix
  delete metadataWithoutItems.pageKey
  delete metadataWithoutItems.iconKey

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

  function handleIconUpload(file: File | null) {
    if (!file || !onUploadIcon) {
      return
    }

    onUploadIcon(index, file)
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

  if (editorConfig.kind === 'section-registry') {
    return (
      <div className={cn('rounded-[20px] border border-[#D8E6EB] bg-white p-4', depth > 0 && 'bg-[#FCFEFF]')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-[#F8FCFD]"
              style={{ borderColor: colorValue || '#D8E6EB', color: colorValue || '#0A3640' }}
            >
              {renderSiteIconVisual({
                iconKey,
                iconImageUrl,
                iconAlt: iconImageAlt || item.label || item.title || item.id,
                className: 'h-4 w-4',
              })}
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
              {depth > 0 ? `Bloco interno ${index + 1}` : `Bloco ${index + 1}`}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#15323b]">
              {item.label || templateDefinition?.label || item.id}
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
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Nome do bloco</span>
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
              placeholder="Título exibido para a equipe"
            />
          </label>
          <div className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Template</p>
            <p className="mt-1 text-sm font-semibold text-[#15323b]">{templateDefinition?.label ?? (templateKey || 'Sem template')}</p>
            {templateDefinition?.description ? (
              <p className="mt-1 text-xs leading-5 text-[#5F7077]">{templateDefinition.description}</p>
            ) : null}
          </div>
          {shouldShowIconField ? (
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Ícone</span>
              <select
                value={iconKey}
                onChange={(event) => updateMetadataField('iconKey', event.target.value)}
                className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
              >
                <option value="">Sem ícone</option>
                {SITE_ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="grid gap-2 rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#0A3640]">
                    {iconImageUrl ? (
                      <img src={iconImageUrl} alt={iconImageAlt || item.label || item.title || item.id} className="h-4 w-4 object-contain" />
                    ) : (
                      renderSiteIcon(iconKey, 'h-4 w-4')
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#15323b]">
                      {iconImageUrl ? 'Ícone enviado' : 'Ícone da biblioteca'}
                    </p>
                    <p className="text-[11px] leading-5 text-[#5F7077]">
                      {iconImageUrl
                        ? (iconImageAlt || 'Imagem carregada para este card.')
                        : 'Use um arquivo de imagem para substituir o ícone atual.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#1398B7] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#E8F6FA]">
                    Upload de ícone
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => handleIconUpload(event.target.files?.[0] ?? null)} />
                  </label>
                  {iconImageUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        const nextMetadata = { ...metadata }
                        delete nextMetadata.iconImageUrl
                        delete nextMetadata.iconImageAlt
                        delete nextMetadata.iconImageAssetId

                        onChange({
                          ...item,
                          metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined,
                        })
                      }}
                      className="rounded-full border border-[#D8E6EB] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077] hover:bg-white"
                    >
                      Remover imagem
                    </button>
                  ) : null}
                </div>
              </div>
            </label>
          ) : null}
          <div className="grid gap-1.5 md:col-span-2 md:grid-cols-[auto_minmax(0,1fr)] md:items-end">
            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Cor</span>
              <input
                type="color"
                value={colorValue || '#1398B7'}
                onChange={(event) => updateMetadataField('color', event.target.value)}
                className="h-11 w-20 rounded-[14px] border border-[#D8E6EB] bg-white p-1 outline-none"
              />
            </label>
            <div className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-3 py-3 text-sm font-semibold text-[#15323b]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Preview da cor</p>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="h-8 w-8 rounded-full border border-[#D8E6EB]"
                  style={{ backgroundColor: colorValue || '#E8F6FA' }}
                />
                <span>{colorValue || 'Sem cor configurada'}</span>
              </div>
            </div>
          </div>
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Resumo operacional</span>
            <textarea
              value={item.description ?? ''}
              onChange={(event) => updateField('description', event.target.value)}
              rows={3}
              className="rounded-[14px] border border-[#D8E6EB] px-3 py-2 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
              placeholder="Descreva a função deste bloco para a equipe."
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Prefixo de conteúdo</p>
            <p className="mt-1 text-sm font-semibold text-[#15323b]">{entryPrefix || 'Usando o conteúdo padrão da seção original.'}</p>
          </div>
          <div className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Escopo da página</p>
            <p className="mt-1 text-sm font-semibold text-[#15323b]">{pageKeyOverride || 'Mantém o escopo original do bloco.'}</p>
          </div>
          <label className="flex items-center justify-between rounded-[14px] border border-[#D8E6EB] px-3 py-3 text-sm font-semibold text-[#15323b] md:col-span-2">
            <span>Ocultar este bloco sem apagar o conteúdo</span>
            <input
              type="checkbox"
              checked={isHidden}
              onChange={(event) => updateMetadataField('isHidden', event.target.checked)}
            />
          </label>
        </div>
      </div>
    )
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
        {shouldShowIconField ? (
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Ícone</span>
            <select
              value={iconKey}
              onChange={(event) => updateMetadataField('iconKey', event.target.value)}
              className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
            >
              <option value="">Sem ícone</option>
              {SITE_ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
                  nextNestedItems.splice(duplicateIndex + 1, 0, cloneEditableListItem(currentItem, editorConfig))
                  updateNestedItems(nextNestedItems)
                }}
                onRemove={(removeIndex) => updateNestedItems(nestedItems.filter((_, currentIndex) => currentIndex !== removeIndex))}
                onUploadIcon={onUploadIcon}
                editorConfig={editorConfig}
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
  const { roles } = useAuth()
  const permissions = useMemo(() => getSiteEditorPermissions(roles), [roles])
  const initialRawValue = useMemo(() => valueToString(editor.fallback), [editor.fallback])
  const initialTextStyle = useMemo(() => normalizeTextStyle(editor.styleFallback), [editor.styleFallback])
  const isTitleEditor = isTitleEditorEntry(editor.label, editor.entryKey)
  const defaultColor = '#183139'
  const formRef = useRef<HTMLFormElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [rawValue, setRawValue] = useState(() => initialRawValue)
  const [uploadAlt, setUploadAlt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [textStyle, setTextStyle] = useState<TextStyleValue>(() => initialTextStyle)
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop')
  const [assetLibrary, setAssetLibrary] = useState<SiteAsset[]>([])
  const [isLoadingAssetLibrary, setIsLoadingAssetLibrary] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [workspaceState, setWorkspaceState] = useState<SiteEditorWorkspaceMap>({})
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false)
  const [areAllListItemsCollapsed, setAreAllListItemsCollapsed] = useState(false)
  const usesJsonEditor = ['list', 'json', 'link', 'button', 'image'].includes(editor.entryType)
  const usesRichTextToolbar = editor.entryType === 'rich_text'
  const isDirty = rawValue !== initialRawValue || JSON.stringify(initialTextStyle) !== JSON.stringify(textStyle)
  const workspaceKey = useMemo(() => createSiteEditorWorkspaceKey(editor.pageKey, editor.entryKey), [editor.entryKey, editor.pageKey])
  const workspaceRecord = workspaceState[workspaceKey] ?? getDefaultWorkspaceRecord(editor.pageKey, editor.entryKey)
  const [history, setHistory] = useState<Array<{ rawValue: string; textStyle: TextStyleValue }>>([])
  const [future, setFuture] = useState<Array<{ rawValue: string; textStyle: TextStyleValue }>>([])
  const skipHistoryRef = useRef(true)
  const previousSnapshotRef = useRef<{ rawValue: string; textStyle: TextStyleValue }>({ rawValue: initialRawValue, textStyle: initialTextStyle })
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
  const appearancePreview = useMemo(() => normalizeSiteAppearance(previewRecord, defaultSiteAppearance), [previewRecord])
  const previewTextStyle = useMemo(() => textStyleToCss(textStyle), [textStyle])
  const previewHeadingTag = getHeadingTagLabel(textStyle.headingTag)
  const isSeoEditor = editor.entryType === 'json' && editor.schema?.kind === 'seo'
  const isSiteAppearanceEditor = editor.entryType === 'json' && editor.schema?.kind === 'site-appearance'
  const listEditorConfig = useMemo(() => normalizeListEditorSchema(editor.schema), [editor.schema])
  const previewImagePresentation = useMemo(() => getEditableImagePresentation(previewImage), [previewImage])
  const showTypographyControls = editor.entryType === 'text' || editor.entryType === 'rich_text' || editor.entryType === 'button' || editor.entryType === 'link'
  const workflowStatus = workspaceRecord.status
  const comments = workspaceRecord.comments
  const draftAvailable = typeof workspaceRecord.draftRawValue === 'string' && workspaceRecord.draftRawValue.trim() !== ''

  function replaceWorkspaceRecord(nextRecord: SiteEditorWorkspaceRecord) {
    setWorkspaceState((current) => ({
      ...current,
      [workspaceKey]: nextRecord,
    }))
  }

  function updateListEditor(nextItems: EditableListItem[]) {
    setRawValue(JSON.stringify(nextItems, null, 2))
  }

  async function handleListIconUpload(itemIndex: number, file: File | null) {
    if (!file || !previewList || itemIndex < 0 || itemIndex >= previewList.length) {
      return
    }

    setMessage(null)
    setIsSaving(true)

    try {
      const currentItem = normalizeEditableListItems(previewList)[itemIndex]
      const asset = await uploadSiteAsset(file, {
        alt: currentItem?.label || currentItem?.title || file.name,
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
      })
      const nextItems = normalizeEditableListItems(previewList)
      const nextMetadata = isStringRecord(nextItems[itemIndex]?.metadata) ? { ...nextItems[itemIndex]!.metadata } : {}
      nextMetadata.iconImageUrl = asset.public_url
      nextMetadata.iconImageAlt = asset.alt ?? currentItem?.label ?? currentItem?.title ?? file.name
      nextMetadata.iconImageAssetId = asset.id
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        metadata: nextMetadata,
      }
      updateListEditor(nextItems)
      setMessage('Ícone enviado. Clique em salvar para publicar.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o ícone.')
    } finally {
      setIsSaving(false)
    }
  }

  function updateRecordEditor(nextValue: Record<string, unknown>) {
    setRawValue(JSON.stringify(nextValue, null, 2))
  }

  function applySnapshot(snapshot: { rawValue: string; textStyle: TextStyleValue }) {
    skipHistoryRef.current = true
    setRawValue(snapshot.rawValue)
    setTextStyle(snapshot.textStyle)
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
    let isMounted = true
    setIsLoadingWorkspace(true)

    void fetchSiteEditorWorkspace([editor.pageKey])
      .then((records) => {
        if (!isMounted) return
        setWorkspaceState(records)
      })
      .catch(() => {
        if (!isMounted) return
        setWorkspaceState({})
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoadingWorkspace(false)
      })

    const channel = supabase
      .channel(`site-editor-modal-${workspaceKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_editor_workspace_records' }, () => {
        void fetchSiteEditorWorkspace([editor.pageKey]).then((records) => {
          if (!isMounted) return
          setWorkspaceState(records)
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_editor_workspace_comments' }, () => {
        void fetchSiteEditorWorkspace([editor.pageKey]).then((records) => {
          if (!isMounted) return
          setWorkspaceState(records)
        })
      })
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [editor.pageKey, workspaceKey])

  useEffect(() => {
    const currentSnapshot = {
      rawValue,
      textStyle,
    }
    const previousSnapshot = previousSnapshotRef.current

    if (
      currentSnapshot.rawValue === previousSnapshot.rawValue
      && JSON.stringify(currentSnapshot.textStyle) === JSON.stringify(previousSnapshot.textStyle)
    ) {
      return
    }

    if (skipHistoryRef.current) {
      previousSnapshotRef.current = currentSnapshot
      skipHistoryRef.current = false
      return
    }

    setHistory((current) => [...current.slice(-39), previousSnapshot])
    setFuture([])
    previousSnapshotRef.current = currentSnapshot
  }, [rawValue, textStyle])

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

  useEffect(() => {
    if (editor.entryType !== 'image') {
      return
    }

    let isMounted = true
    setIsLoadingAssetLibrary(true)
    void fetchSiteAssets(18)
      .then((assets) => {
        if (!isMounted) return
        setAssetLibrary(assets)
      })
      .catch(() => {
        if (!isMounted) return
        setAssetLibrary([])
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoadingAssetLibrary(false)
      })

    return () => {
      isMounted = false
    }
  }, [editor.entryType])

  async function handleSaveDraft() {
    try {
      const nextRecord = await upsertSiteEditorWorkspaceRecord({
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
        status: 'draft',
        draftRawValue: rawValue,
        draftTextStyle: Object.fromEntries(
          Object.entries(textStyle).filter(([, value]) => typeof value === 'string' && value.trim() !== ''),
        ) as Record<string, string>,
        publishedAt: workspaceRecord.publishedAt,
      })
      replaceWorkspaceRecord(nextRecord)
      setMessage('Rascunho sincronizado no workspace compartilhado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o rascunho.')
    }
  }

  function handleLoadDraft() {
    if (!draftAvailable || !workspaceRecord.draftRawValue) {
      return
    }

    applySnapshot({
      rawValue: workspaceRecord.draftRawValue,
      textStyle: normalizeTextStyle(workspaceRecord.draftTextStyle),
    })
    setMessage('Rascunho sincronizado carregado.')
  }

  async function handleWorkflowStatus(nextStatus: SiteEditorWorkflowStatus) {
    try {
      const nextRecord = await upsertSiteEditorWorkspaceRecord({
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
        status: nextStatus,
        draftRawValue: workspaceRecord.draftRawValue,
        draftTextStyle: workspaceRecord.draftTextStyle,
        publishedAt: nextStatus === 'published' ? new Date().toISOString() : workspaceRecord.publishedAt,
      })
      replaceWorkspaceRecord(nextRecord)
      setMessage(`Status atualizado para ${formatWorkflowStatus(nextStatus)}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar o status.')
    }
  }

  async function handleAddComment() {
    const normalizedComment = draftComment.trim()
    if (!normalizedComment) {
      return
    }

    try {
      const nextRecord = await createSiteEditorWorkspaceComment({
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
        body: normalizedComment,
        authorRole: roles[0] ?? 'unknown',
      })
      replaceWorkspaceRecord(nextRecord)
      setDraftComment('')
      setMessage('Comentario compartilhado registrado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel registrar o comentario.')
    }
  }

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
      const nextRecord = await upsertSiteEditorWorkspaceRecord({
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
        status: 'published',
        draftRawValue: null,
        draftTextStyle: {},
        publishedAt: new Date().toISOString(),
      })
      replaceWorkspaceRecord(nextRecord)
      await editor.reload()
      onSaved()
      setMessage('Conteúdo publicado com sucesso.')
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
        fit: 'cover',
        focusX: 50,
        focusY: 50,
      }, null, 2))
      setUploadAlt(asset.alt ?? '')
      setAssetLibrary((current) => [asset, ...current.filter((currentAsset) => currentAsset.id !== asset.id)].slice(0, 18))
      setMessage('Imagem enviada. Clique em salvar para publicar.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setIsSaving(false)
    }
  }

  function selectAssetFromLibrary(asset: SiteAsset) {
    setUploadAlt(asset.alt ?? '')
    setRawValue(JSON.stringify({
      src: asset.public_url,
      alt: asset.alt,
      asset_id: asset.id,
      fit: previewImagePresentation.fit,
      focusX: previewImagePresentation.focusX,
      focusY: previewImagePresentation.focusY,
    }, null, 2))
    setMessage('Imagem da biblioteca selecionada. Clique em salvar para publicar.')
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#061b21]/62 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
      <form
        ref={formRef}
        onSubmit={(event) => void handleSubmit(event)}
        className="mx-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-[min(1180px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)] sm:max-h-[calc(100vh-3rem)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[linear-gradient(180deg,#F8FCFD_0%,#FFFFFF_100%)] p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Editor visual</p>
            <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">{editor.label}</h2>
            <p className="mt-1 text-xs font-semibold text-[#5F7077]">{editor.pageKey}/{editor.entryKey}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-[#0A3640] bg-[#0A3640] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                Tipo: {editor.entryType}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#0A3640] bg-[#0A3640] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                Estrutura: {describeValueShape(parsedPreview.value)}
              </span>
              {isTitleEditor ? (
                <span className="inline-flex items-center rounded-full border border-[#0A3640] bg-[#0A3640] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  Tag: {previewHeadingTag}
                </span>
              ) : null}
              <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]', workflowStatusClasses(workflowStatus))}>
                {formatWorkflowStatus(workflowStatus)}
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

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className={cn(
            'grid gap-6 p-4 sm:p-6',
            isSeoEditor ? 'xl:grid-cols-1' : 'xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]',
          )}>
            <div className="min-w-0 grid gap-4">
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
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Ajuste horizontal</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={previewImagePresentation.focusX}
                      onChange={(event) => updateRecordEditor({
                        ...(previewImage ?? {}),
                        focusX: Number(event.target.value),
                        focusY: previewImagePresentation.focusY,
                        fit: previewImagePresentation.fit,
                      })}
                    />
                    <span className="text-xs font-semibold text-[#5F7077]">{previewImagePresentation.focusX}%</span>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Ajuste vertical</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={previewImagePresentation.focusY}
                      onChange={(event) => updateRecordEditor({
                        ...(previewImage ?? {}),
                        focusX: previewImagePresentation.focusX,
                        focusY: Number(event.target.value),
                        fit: previewImagePresentation.fit,
                      })}
                    />
                    <span className="text-xs font-semibold text-[#5F7077]">{previewImagePresentation.focusY}%</span>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Modo de corte</span>
                    <select
                      value={previewImagePresentation.fit}
                      onChange={(event) => updateRecordEditor({
                        ...(previewImage ?? {}),
                        fit: event.target.value,
                        focusX: previewImagePresentation.focusX,
                        focusY: previewImagePresentation.focusY,
                      })}
                      className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                    </select>
                  </label>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-[#1398B7] bg-white px-4 py-3 text-sm font-black text-[#0A3640] hover:bg-[#E8F6FA]">
                  <ImageIcon className="h-4 w-4" />
                  Enviar imagem
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)} />
                </label>
                <div className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Biblioteca de mídia</p>
                      <p className="mt-1 text-sm font-semibold text-[#15323b]">Reutilize ativos já enviados sem subir a mesma imagem novamente.</p>
                    </div>
                    {isLoadingAssetLibrary ? <p className="text-xs font-semibold text-[#5F7077]">Carregando...</p> : null}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {assetLibrary.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => selectAssetFromLibrary(asset)}
                        className="overflow-hidden rounded-[18px] border border-[#D8E6EB] bg-[#F8FCFD] text-left transition hover:border-[#1398B7] hover:bg-[#EAF8FB]"
                      >
                        {asset.public_url ? (
                          <img
                            src={asset.public_url}
                            alt={asset.alt ?? ''}
                            className="h-28 w-full border-b border-[#D8E6EB] object-cover"
                          />
                        ) : (
                          <div className="flex h-28 items-center justify-center border-b border-[#D8E6EB] bg-white text-xs font-semibold text-[#5F7077]">
                            Sem preview
                          </div>
                        )}
                        <div className="px-3 py-3">
                          <p className="line-clamp-2 text-sm font-semibold text-[#15323b]">{asset.alt || 'Sem texto alternativo'}</p>
                          <p className="mt-1 text-xs font-semibold text-[#5F7077]">{asset.width && asset.height ? `${asset.width}x${asset.height}px` : 'Dimensões não disponíveis'}</p>
                        </div>
                      </button>
                    ))}
                    {!isLoadingAssetLibrary && assetLibrary.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-4 py-8 text-center text-sm font-semibold text-[#5F7077]">
                        Nenhum ativo anterior encontrado.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {previewList ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Editor de listagem</p>
                    <p className="mt-1 text-sm font-semibold text-[#15323b]">Edite itens, mova ordem e reorganize elementos sem alterar a estrutura visual da página.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAreAllListItemsCollapsed(true)}
                      className="rounded-full border border-[#D8E6EB] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-white"
                    >
                      Recolher todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setAreAllListItemsCollapsed(false)}
                      className="rounded-full border border-[#D8E6EB] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-white"
                    >
                      Expandir todos
                    </button>
                    {listEditorConfig.templates.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateListEditor([
                          ...normalizeEditableListItems(parsedPreview.value),
                          { id: `item-${previewList.length + 1}`, label: 'Novo item' },
                        ])}
                        className="rounded-full border border-[#D8E6EB] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-white"
                      >
                        {listEditorConfig.addLabel}
                      </button>
                    ) : null}
                  </div>
                </div>

                {listEditorConfig.templates.length > 0 ? (
                  <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 text-[#1398B7]" />
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">Biblioteca de blocos</p>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {listEditorConfig.templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => updateListEditor([
                            ...normalizeEditableListItems(parsedPreview.value),
                            createListItemFromTemplate(template, listEditorConfig),
                          ])}
                          className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-4 text-left transition hover:border-[#1398B7] hover:bg-[#EAF8FB]"
                        >
                          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
                            <Plus className="h-3.5 w-3.5" />
                            {listEditorConfig.addLabel}
                          </span>
                          <p className="mt-2 text-sm font-semibold text-[#15323b]">{template.label}</p>
                          {template.description ? (
                            <p className="mt-1 text-xs leading-5 text-[#5F7077]">{template.description}</p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {areAllListItemsCollapsed ? (
                  <div className="mt-4 rounded-[18px] border border-dashed border-[#D8E6EB] bg-white px-4 py-6 text-sm font-semibold text-[#5F7077]">
                    Todos os elementos da listagem estão recolhidos. Use Expandir todos para voltar a ver os cartões.
                  </div>
                ) : (
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
                          nextItems.splice(duplicateIndex + 1, 0, cloneEditableListItem(currentItem, listEditorConfig))
                          updateListEditor(nextItems)
                        }}
                        onRemove={(removeIndex) => updateListEditor(normalizeEditableListItems(parsedPreview.value).filter((_, currentIndex) => currentIndex !== removeIndex))}
                        onUploadIcon={(uploadIndex, file) => void handleListIconUpload(uploadIndex, file)}
                        editorConfig={listEditorConfig}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {previewRecord && !previewList ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1398B7]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Editor guiado</p>
                </div>
                {editor.entryType === 'json' && editor.schema?.kind === 'seo' ? (
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Título SEO</span>
                      <input
                        value={typeof previewRecord.title === 'string' ? previewRecord.title : ''}
                        onChange={(event) => updateRecordEditor({ ...previewRecord, title: event.target.value })}
                        className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Descrição SEO</span>
                      <textarea
                        value={typeof previewRecord.description === 'string' ? previewRecord.description : ''}
                        onChange={(event) => updateRecordEditor({ ...previewRecord, description: event.target.value })}
                        rows={4}
                        className="rounded-[14px] border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Slug canônico</span>
                        <input
                          value={typeof previewRecord.slug === 'string' ? previewRecord.slug : ''}
                          onChange={(event) => updateRecordEditor({ ...previewRecord, slug: event.target.value })}
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                          placeholder="/recursos"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Imagem social</span>
                        <input
                          value={typeof previewRecord.image === 'string' ? previewRecord.image : ''}
                          onChange={(event) => updateRecordEditor({ ...previewRecord, image: event.target.value })}
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                          placeholder="https://..."
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
                {isSiteAppearanceEditor ? (
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tamanho da logo</span>
                        <input
                          type="number"
                          min="0.6"
                          max="2"
                          step="0.05"
                          value={appearancePreview.logoScale ?? defaultSiteAppearance.logoScale}
                          onChange={(event) => updateRecordEditor({ ...appearancePreview, logoScale: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : defaultSiteAppearance.logoScale })}
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Altura do header</span>
                        <input
                          value={appearancePreview.headerHeight ?? defaultSiteAppearance.headerHeight}
                          onChange={(event) => updateRecordEditor({ ...appearancePreview, headerHeight: event.target.value })}
                          placeholder="72px"
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {([
                        ['menuColor', 'Cor do menu'],
                        ['menuActiveColor', 'Cor ativa do menu'],
                        ['menuHoverColor', 'Cor de hover do menu'],
                        ['pageBackgroundColor', 'Cor de fundo da pagina'],
                      ] as const).map(([field, label]) => (
                        <label key={field} className="grid gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{label}</span>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={typeof appearancePreview[field] === 'string' ? appearancePreview[field] as string : '#ffffff'}
                              onChange={(event) => updateRecordEditor({ ...appearancePreview, [field]: event.target.value })}
                              className="h-11 w-14 rounded-[14px] border border-[#D8E6EB] bg-white p-1 outline-none focus:border-[#1398B7]"
                            />
                            <input
                              value={typeof appearancePreview[field] === 'string' ? appearancePreview[field] as string : ''}
                              onChange={(event) => updateRecordEditor({ ...appearancePreview, [field]: event.target.value })}
                              placeholder="#ffffff"
                              className="h-11 flex-1 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold uppercase tracking-[0.06em] text-[#15323b] outline-none focus:border-[#1398B7]"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Fonte do menu</span>
                        <input
                          value={appearancePreview.menuFontFamily ?? defaultSiteAppearance.menuFontFamily}
                          onChange={(event) => updateRecordEditor({ ...appearancePreview, menuFontFamily: event.target.value })}
                          placeholder="inherit"
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tamanho da fonte do menu</span>
                        <input
                          value={appearancePreview.menuFontSize ?? defaultSiteAppearance.menuFontSize}
                          onChange={(event) => updateRecordEditor({ ...appearancePreview, menuFontSize: event.target.value })}
                          placeholder="15px"
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Peso da fonte do menu</span>
                        <input
                          value={appearancePreview.menuFontWeight ?? defaultSiteAppearance.menuFontWeight}
                          onChange={(event) => updateRecordEditor({ ...appearancePreview, menuFontWeight: event.target.value })}
                          placeholder="600"
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Espacamento do menu</span>
                        <input
                          value={appearancePreview.menuLetterSpacing ?? defaultSiteAppearance.menuLetterSpacing}
                          onChange={(event) => updateRecordEditor({ ...appearancePreview, menuLetterSpacing: event.target.value })}
                          placeholder="-0.02em"
                          className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                    </div>
                    <div className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Preview rapido</p>
                      <div
                        className="mt-3 overflow-hidden rounded-[18px] border border-[#D8E6EB]"
                        style={{ backgroundColor: appearancePreview.pageBackgroundColor ?? defaultSiteAppearance.pageBackgroundColor }}
                      >
                        <div
                          className="flex items-center justify-between gap-3 px-4"
                          style={{ height: appearancePreview.headerHeight ?? defaultSiteAppearance.headerHeight }}
                        >
                          <div
                            className="origin-left"
                            style={{ transform: `scale(${appearancePreview.logoScale ?? defaultSiteAppearance.logoScale})` }}
                          >
                            <GenflixLogo theme="dark" />
                          </div>
                          <div className="hidden gap-4 md:flex">
                            <span
                              className="text-[14px] font-semibold"
                              style={{
                                color: appearancePreview.menuColor ?? defaultSiteAppearance.menuColor,
                                fontFamily: appearancePreview.menuFontFamily ?? defaultSiteAppearance.menuFontFamily,
                                fontSize: appearancePreview.menuFontSize ?? defaultSiteAppearance.menuFontSize,
                                fontWeight: appearancePreview.menuFontWeight ?? defaultSiteAppearance.menuFontWeight,
                                letterSpacing: appearancePreview.menuLetterSpacing ?? defaultSiteAppearance.menuLetterSpacing,
                              }}
                            >
                              Menu
                            </span>
                            <span
                              className="text-[14px] font-semibold"
                              style={{
                                color: appearancePreview.menuActiveColor ?? defaultSiteAppearance.menuActiveColor,
                                fontFamily: appearancePreview.menuFontFamily ?? defaultSiteAppearance.menuFontFamily,
                                fontSize: appearancePreview.menuFontSize ?? defaultSiteAppearance.menuFontSize,
                                fontWeight: appearancePreview.menuFontWeight ?? defaultSiteAppearance.menuFontWeight,
                                letterSpacing: appearancePreview.menuLetterSpacing ?? defaultSiteAppearance.menuLetterSpacing,
                              }}
                            >
                              Ativo
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-[#D8E6EB] px-4 py-4 text-sm font-semibold text-[#15323b]">
                          O fundo da pagina e o estilo do menu seguem os valores salvos nesta entrada.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
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
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Padrao de botoes</span>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8BA0A7]">Clique para trocar o estilo</span>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {BUTTON_STYLE_PRESETS.map((preset) => {
                            const isSelected = normalizeGenflixCtaTone(previewRecord.tone) === preset.tone

                            return (
                              <button
                                key={preset.tone}
                                type="button"
                                onClick={() => updateRecordEditor({ ...previewRecord, tone: preset.tone })}
                                className={cn(
                                  'rounded-[18px] border p-4 text-left transition',
                                  isSelected
                                    ? 'border-[#1398B7] bg-[#EAF8FB] shadow-[0_12px_24px_rgba(19,152,183,0.10)]'
                                    : 'border-[#D8E6EB] bg-white hover:border-[#BEE3EA] hover:bg-[#F8FCFD]',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-black text-[#15323b]">{preset.label}</p>
                                    <p className="mt-1 text-xs leading-5 text-[#5F7077]">{preset.description}</p>
                                  </div>
                                  <span className="rounded-full border border-[#D8E6EB] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                                    {preset.tone}
                                  </span>
                                </div>
                                <div className="mt-4">
                                  <GenflixCtaButton asChild tone={preset.tone}>
                                    <div className="h-11 w-full justify-between px-4 text-[13px]">
                                      {typeof previewRecord.label === 'string' && previewRecord.label.trim() !== ''
                                        ? previewRecord.label
                                        : 'Botao de exemplo'}
                                    </div>
                                  </GenflixCtaButton>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
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
                {!isSiteAppearanceEditor ? (
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
                ) : null}
              </div>
            ) : null}

            {editor.styleEntryKey ? (
              <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1398B7]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Estilo do elemento</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Cor de fundo</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={textStyle.backgroundColor ?? '#ffffff'}
                        onChange={(event) => setTextStyle((current) => ({ ...current, backgroundColor: event.target.value }))}
                        className="h-11 w-14 rounded-[14px] border border-[#D8E6EB] bg-white p-1 outline-none focus:border-[#1398B7]"
                        aria-label="Selecionar cor de fundo"
                      />
                      <input
                        value={textStyle.backgroundColor ?? ''}
                        onChange={(event) => setTextStyle((current) => ({ ...current, backgroundColor: event.target.value }))}
                        placeholder="#ffffff"
                        className="h-11 flex-1 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold uppercase tracking-[0.06em] text-[#15323b] outline-none focus:border-[#1398B7]"
                      />
                    </div>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Largura</span>
                    <input
                      value={textStyle.width ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, width: event.target.value }))}
                      placeholder="100%"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Altura</span>
                    <input
                      value={textStyle.height ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, height: event.target.value }))}
                      placeholder="auto"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Largura mínima</span>
                    <input
                      value={textStyle.minWidth ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, minWidth: event.target.value }))}
                      placeholder="240px"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Altura mínima</span>
                    <input
                      value={textStyle.minHeight ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, minHeight: event.target.value }))}
                      placeholder="48px"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Arredondamento</span>
                    <input
                      value={textStyle.borderRadius ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, borderRadius: event.target.value }))}
                      placeholder="24px"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Padding horizontal</span>
                    <input
                      value={textStyle.paddingInline ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, paddingInline: event.target.value }))}
                      placeholder="1.5rem"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Padding vertical</span>
                    <input
                      value={textStyle.paddingBlock ?? ''}
                      onChange={(event) => setTextStyle((current) => ({ ...current, paddingBlock: event.target.value }))}
                      placeholder="0.75rem"
                      className="h-11 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                    />
                  </label>
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Alinhamento</span>
                    <select
                      value={textStyle.textAlign ?? ''}
                      onChange={(event) => setTextStyle((current) => ({
                        ...current,
                        textAlign: (event.target.value || undefined) as TextStyleValue['textAlign'] | undefined,
                      }))}
                      className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                    >
                      <option value="">Padrão</option>
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                      <option value="justify">Justificado</option>
                    </select>
                  </label>
                  {showTypographyControls ? (
                    <>
                  {isTitleEditor ? (
                    <label className="grid gap-1.5 md:col-span-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tag do título</span>
                      <select
                        value={getHeadingTagLabel(textStyle.headingTag).toLowerCase()}
                        onChange={(event) => setTextStyle((current) => ({
                          ...current,
                          headingTag: event.target.value,
                        }))}
                        className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                      >
                        <option value="h1">H1</option>
                        <option value="h2">H2</option>
                        <option value="h3">H3</option>
                        <option value="h4">H4</option>
                        <option value="h5">H5</option>
                        <option value="h6">H6</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Cor do texto</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={textStyle.color ?? defaultColor}
                        onChange={(event) => setTextStyle((current) => ({ ...current, color: event.target.value }))}
                        className="h-11 w-14 rounded-[14px] border border-[#D8E6EB] bg-white p-1 outline-none focus:border-[#1398B7]"
                        aria-label="Selecionar cor"
                      />
                      <input
                        value={textStyle.color ?? defaultColor}
                        onChange={(event) => setTextStyle((current) => ({ ...current, color: event.target.value }))}
                        placeholder={defaultColor}
                        className="h-11 flex-1 rounded-[14px] border border-[#D8E6EB] px-3 text-sm font-semibold uppercase tracking-[0.06em] text-[#15323b] outline-none focus:border-[#1398B7]"
                      />
                    </div>
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
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="rounded-[22px] border border-[#D8E6EB] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E6EB] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                    {usesRichTextToolbar ? 'Editor rico' : 'Conteúdo'}
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
                  <button
                    type="button"
                    onClick={() => {
                      const lastSnapshot = history[history.length - 1]
                      if (!lastSnapshot) return
                      setHistory((current) => current.slice(0, -1))
                      setFuture((current) => [...current, { rawValue, textStyle }])
                      applySnapshot(lastSnapshot)
                    }}
                    disabled={history.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Desfazer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSnapshot = future[future.length - 1]
                      if (!nextSnapshot) return
                      setFuture((current) => current.slice(0, -1))
                      setHistory((current) => [...current, { rawValue, textStyle }].slice(-40))
                      applySnapshot(nextSnapshot)
                    }}
                    disabled={future.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                    Refazer
                  </button>
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

          <aside className="min-w-0 grid gap-4">
            <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1398B7]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Preview rápido</p>
                </div>
                <div className="flex rounded-full border border-[#D8E6EB] bg-white p-1">
                  {([
                    ['desktop', 'Desktop'],
                    ['tablet', 'Tablet'],
                    ['mobile', 'Mobile'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewViewport(mode)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition',
                        previewViewport === mode ? 'bg-[#0A3640] text-white' : 'text-[#5F7077] hover:bg-[#F2F7F9]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  'mx-auto mt-4 min-w-0 max-w-full overflow-x-hidden transition-all',
                  previewViewport === 'desktop' && 'max-w-none',
                  previewViewport === 'tablet' && 'max-w-[720px]',
                  previewViewport === 'mobile' && 'max-w-[375px]',
                )}
              >
                {editor.entryType === 'image' && previewImage ? (
                  <div className="grid gap-3">
                    {typeof previewImage.src === 'string' && previewImage.src ? (
                      <div className="h-48 overflow-hidden rounded-[18px] border border-[#D8E6EB] bg-white" style={previewTextStyle}>
                        <img
                          src={previewImage.src}
                          alt={typeof previewImage.alt === 'string' ? previewImage.alt : ''}
                          className="block h-full w-full"
                          style={{
                            objectFit: previewImagePresentation.objectFit,
                            objectPosition: previewImagePresentation.objectPosition,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-[18px] border border-dashed border-[#D8E6EB] bg-white text-sm font-semibold text-[#5F7077]">
                        Sem imagem definida
                      </div>
                    )}
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5F7077]">Alt</p>
                      <p className="mt-2 break-words text-sm font-semibold text-[#15323b]">{typeof previewImage.alt === 'string' && previewImage.alt ? previewImage.alt : 'Sem texto alternativo.'}</p>
                    </div>
                  </div>
                ) : previewList ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {previewList.slice(0, 6).map((item, index) => {
                      const itemMetadata = isStringRecord(item) && isStringRecord(item.metadata) ? item.metadata : {}
                      const itemIconKey = typeof itemMetadata.iconKey === 'string' ? itemMetadata.iconKey : null
                      const itemIconImageUrl = typeof itemMetadata.iconImageUrl === 'string' ? itemMetadata.iconImageUrl : null
                      const itemIconImageAlt = typeof itemMetadata.iconImageAlt === 'string' ? itemMetadata.iconImageAlt : null

                      return (
                        <article key={`${item.id ?? index}`} className="overflow-hidden rounded-[18px] border border-[#D8E6EB] bg-white shadow-[0_12px_24px_rgba(21,50,59,0.04)]">
                          <div className="bg-[linear-gradient(135deg,#1398B7_0%,#0A3640_100%)] px-4 py-4 text-white">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/12">
                                {renderSiteIconVisual({
                                  iconKey: itemIconKey,
                                  iconImageUrl: itemIconImageUrl,
                                  iconAlt: itemIconImageAlt || (typeof item.label === 'string' ? item.label : undefined),
                                  className: 'h-4 w-4',
                                })}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/75">Item {index + 1}</p>
                                <p className="mt-1 text-sm font-semibold leading-5 text-white">
                                  {typeof item.label === 'string' && item.label.trim() !== ''
                                    ? item.label
                                    : typeof item.title === 'string' && item.title.trim() !== ''
                                      ? item.title
                                      : 'Item sem título'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 px-4 py-4">
                            {typeof item.description === 'string' && item.description.trim() !== '' ? (
                              <p className="text-sm leading-6 text-[#5F7077]">{item.description}</p>
                            ) : null}
                            {typeof item.href === 'string' && item.href.trim() !== '' ? (
                              <p className="truncate text-xs font-semibold text-[#1398B7]">{item.href}</p>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                    {previewList.length > 6 ? (
                      <p className="sm:col-span-2 xl:col-span-3 text-xs font-semibold text-[#5F7077]">
                        Mostrando 6 de {previewList.length} item(ns).
                      </p>
                    ) : null}
                  </div>
                ) : isSeoEditor && previewRecord ? (
                  <div className="grid gap-4 rounded-[18px] border border-[#D8E6EB] bg-white p-5 shadow-[0_12px_24px_rgba(21,50,59,0.04)]">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">
                      <Sparkles className="h-4 w-4" />
                      Preview SEO
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-[#5F7077]">genflix.com{typeof previewRecord.slug === 'string' && previewRecord.slug ? previewRecord.slug : '/pagina'}</p>
                      <h3 className="text-[1.1rem] font-bold leading-tight text-[#1398B7]">
                        {typeof previewRecord.title === 'string' && previewRecord.title ? previewRecord.title : 'Título SEO'}
                      </h3>
                      <p className="text-sm leading-6 text-[#5F7077]">
                        {typeof previewRecord.description === 'string' && previewRecord.description ? previewRecord.description : 'Descrição SEO'}
                      </p>
                    </div>
                    {typeof previewRecord.image === 'string' && previewRecord.image ? (
                      <div className="overflow-hidden rounded-[16px] border border-[#D8E6EB] bg-[#F8FCFD]">
                        <img src={previewRecord.image} alt="" className="h-40 w-full object-cover" />
                      </div>
                    ) : null}
                  </div>
                ) : previewRecord ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {editor.entryType === 'button' || editor.entryType === 'link' ? (
                      <div className="sm:col-span-2 rounded-[18px] border border-[#D8E6EB] bg-white p-5 shadow-[0_12px_24px_rgba(21,50,59,0.04)]">
                        {editor.entryType === 'button' ? (
                          <GenflixCtaButton
                            type="button"
                            tone={normalizeGenflixCtaTone(previewRecord.tone)}
                            className="h-12 w-full justify-between px-5 text-[14px]"
                          >
                            {typeof previewRecord.label === 'string' && previewRecord.label ? previewRecord.label : 'Botão'}
                          </GenflixCtaButton>
                        ) : (
                          <div
                            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black uppercase tracking-[0.14em] border-[#D8E6EB] bg-[#F8FCFD] text-[#0A3640]"
                            style={previewTextStyle}
                          >
                            {typeof previewRecord.label === 'string' && previewRecord.label ? previewRecord.label : 'Link'}
                          </div>
                        )}
                        <p className="mt-4 text-sm leading-7 text-[#5F7077]">
                          {typeof previewRecord.href === 'string' && previewRecord.href ? previewRecord.href : 'Sem link definido'}
                        </p>
                      </div>
                    ) : (
                      <div className="sm:col-span-2 rounded-[18px] border border-[#D8E6EB] bg-white p-5 shadow-[0_12px_24px_rgba(21,50,59,0.04)]">
                        <div className="space-y-3">
                          {Object.entries(previewRecord).map(([key, currentValue]) => (
                            <div key={key} className="rounded-[14px] border border-[#D8E6EB] bg-[#F8FCFD] px-3 py-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{key}</p>
                              <p className="mt-1 break-words text-sm font-semibold text-[#15323b]">
                                {typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-[#D8E6EB] bg-white p-4">
                    <p className="break-words text-sm leading-7 text-[#15323b]" style={previewTextStyle}>{String(parsedPreview.value ?? '') || 'Sem conteúdo.'}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#1398B7]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Fluxo de publicação</p>
              </div>
              <div className="mt-4 grid gap-3">
                <div className={cn('inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]', workflowStatusClasses(workflowStatus))}>
                  {formatWorkflowStatus(workflowStatus)}
                </div>
                <div className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FCFD] p-3 text-xs font-semibold leading-5 text-[#5F7077]">
                  {isLoadingWorkspace
                    ? 'Sincronizando workspace compartilhado...'
                    : workspaceRecord.updatedAt
                      ? `Ultima sincronizacao em ${new Date(workspaceRecord.updatedAt).toLocaleString('pt-BR')}.`
                      : 'Nenhum rascunho compartilhado salvo para este campo ainda.'}
                </div>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDraft()}
                    disabled={!permissions.canSaveDraft}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8E6EB] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Salvar rascunho compartilhado
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadDraft}
                    disabled={!draftAvailable}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8E6EB] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Carregar rascunho
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWorkflowStatus('review')}
                    disabled={!permissions.canRequestReview}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8E6EB] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar para revisão
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWorkflowStatus('approved')}
                    disabled={!permissions.canApprove}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8E6EB] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar conteúdo
                  </button>
                </div>
                <div className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FCFD] p-3 text-xs font-semibold leading-5 text-[#5F7077]">
                  {workflowStatus === 'published'
                    ? 'Conteúdo já publicado neste navegador.'
                    : workflowStatus === 'approved'
                      ? 'O conteúdo está aprovado e pronto para publicação.'
                      : 'Use rascunho e revisão antes de publicar para reduzir risco operacional.'}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#D8E6EB] bg-white p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#1398B7]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">Comentários internos</p>
              </div>
              <div className="mt-4 grid gap-3">
                <textarea
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  rows={3}
                  placeholder="Registre observações internas para esta entrada."
                  className="rounded-[14px] border border-[#D8E6EB] px-3 py-2 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                />
                <button
                  type="button"
                  onClick={() => void handleAddComment()}
                  disabled={!permissions.canComment || draftComment.trim().length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8E6EB] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9] disabled:opacity-60"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Adicionar comentário
                </button>
                <div className="grid gap-2">
                  {comments.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[#D8E6EB] bg-[#F8FCFD] px-4 py-4 text-sm font-semibold text-[#5F7077]">
                      Nenhum comentário interno registrado.
                    </div>
                  ) : comments.map((comment) => (
                    <div key={comment.id} className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
                        {comment.authorRole} · {new Date(comment.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#15323b]">{comment.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </aside>
        </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D8E6EB] bg-[#FCFEFF] p-5">
          <p className="text-xs font-semibold text-[#5F7077]">
            O fluxo agora separa rascunho local, revisão e publicação final.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={handleCloseRequest} className="rounded-full border border-[#D8E6EB] bg-white px-5 py-3 text-sm font-black text-[#5F7077] hover:bg-[#F2F7F9]">
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSaving || !!parsedPreview.error || !permissions.canPublish || (workflowStatus !== 'approved' && workflowStatus !== 'published')}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 py-3 text-sm font-black text-white hover:opacity-95 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Publicando...' : 'Publicar'}
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
  const [isTrayExpanded, setIsTrayExpanded] = useState(false)
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

  useEffect(() => {
    setIsTrayExpanded(false)
  }, [location.pathname])

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
        <div className="fixed bottom-5 right-5 z-[110] flex max-w-[calc(100%-24px)] items-end gap-3">
          {isTrayExpanded ? (
            <div className="w-[min(calc(100vw-96px),720px)] rounded-[24px] border border-[#D8E6EB] bg-white px-4 py-3 shadow-[0_18px_50px_rgba(6,27,33,0.16)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                      isEditing ? 'bg-[#0A3640] text-white' : 'bg-[#E8F6FA] text-[#0A3640]',
                    )}>
                      {isEditing ? 'Modo edição ativo' : 'Modo navegação'}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-[#BEE3EA] bg-[#F8FCFD] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A3640]">
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
                  <Link to="/admin/site-editor" className="inline-flex items-center gap-2 rounded-full border border-[#BEE3EA] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#15323b] hover:bg-[#F2F7F9]">
                    <Settings className="h-3.5 w-3.5" />
                    Gestão
                  </Link>
              </div>
            </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setIsTrayExpanded((current) => !current)}
            aria-label={isTrayExpanded ? 'Recolher controles do editor visual' : 'Expandir controles do editor visual'}
            className={cn(
              'inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#D8E6EB] shadow-[0_18px_50px_rgba(6,27,33,0.16)] backdrop-blur transition hover:scale-[1.02]',
              isTrayExpanded ? 'bg-[#0A3640] text-white' : 'bg-white text-[#0A3640]',
            )}
          >
            {isTrayExpanded ? <X className="h-5 w-5" /> : <PanelBottomOpen className="h-5 w-5" />}
          </button>
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
  const shouldRenderAsBlock = hasBoxStyle(styleValue) || styleValue.textAlign !== undefined
  const renderedStyle = inlineStyle && shouldRenderAsBlock && !inlineStyle.display
    ? { ...inlineStyle, display: 'inline-block' }
    : inlineStyle
  const content = renderedStyle ? <span style={renderedStyle}>{value}</span> : <>{value}</>

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
  const styleEntryKey = `${entryKey}.__style`
  const styleValue = normalizeTextStyle(useEditableValue(styleEntryKey, {}, { pageKey: resolvedPageKey }))
  const content = cloneNodeWithStyle(children(value), textStyleToCss(styleValue))

  if (!editor?.isEditing || !scope) {
    return <>{content}</>
  }

  return (
    <EditableMarker
      label={label}
      display="block"
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'image',
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
  const styleEntryKey = `${entryKey}.__style`
  const styleValue = normalizeTextStyle(useEditableValue(styleEntryKey, {}, { pageKey: resolvedPageKey }))
  const content = cloneNodeWithStyle(children(value), textStyleToCss(styleValue))

  if (!editor?.isEditing || !scope) {
    return <>{content}</>
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
        styleEntryKey,
        styleFallback: styleValue,
        reload: scope.reload,
      })}
    >
      {content}
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
  const styleEntryKey = `${entryKey}.__style`
  const styleValue = normalizeTextStyle(useEditableValue(styleEntryKey, {}, { pageKey: resolvedPageKey }))
  const content = cloneNodeWithStyle(children(value), textStyleToCss(styleValue))

  if (!editor?.isEditing || !scope) {
    return <>{content}</>
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
        styleEntryKey,
        styleFallback: styleValue,
        reload: scope.reload,
      })}
    >
      {content}
    </EditableMarker>
  )
}

export function EditableList({
  entryKey,
  fallback,
  label,
  children,
  pageKey,
  schema,
}: {
  entryKey: string
  fallback: EditableListItem[]
  label: string
  children: (items: EditableListItem[]) => ReactNode
  pageKey?: SitePageKey
  schema?: Record<string, unknown>
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
      display="contents"
      onClick={() => editor.openEditor({
        pageKey: resolvedPageKey,
        entryKey,
        entryType: 'list',
        label,
        fallback: value,
        schema,
        reload: scope.reload,
      })}
    >
      {children(value)}
    </EditableMarker>
  )
}

export function useVisualEditorState() {
  return useContext(VisualEditorContext)
}

export function useSiteContentScope() {
  return useContext(SiteContentContext)
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
