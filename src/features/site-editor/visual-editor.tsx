import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Edit3, Image as ImageIcon, RotateCcw, Save, Settings, X } from 'lucide-react'

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
      className="group/site-editor relative cursor-pointer outline outline-2 outline-offset-2 outline-[#1398B7]/55 transition hover:outline-[#1398B7]"
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
      <span className="pointer-events-none absolute -top-7 left-0 z-[80] hidden whitespace-nowrap bg-[#0A3640] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg group-hover/site-editor:block">
        {label}
      </span>
      {children}
    </span>
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
  const [rawValue, setRawValue] = useState(() => valueToString(editor.fallback))
  const [uploadAlt, setUploadAlt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSaving(true)

    try {
      const value = parseEditorValue(editor.entryType, rawValue)
      await saveSiteContentEntry({
        pageKey: editor.pageKey,
        entryKey: editor.entryKey,
        entryType: editor.entryType,
        value,
        schema: editor.schema,
      })
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
      setMessage('Imagem enviada. Clique em salvar para publicar.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setIsSaving(false)
    }
  }

  const usesJsonEditor = ['list', 'json', 'link', 'button', 'image'].includes(editor.entryType)

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#061b21]/62 px-4 py-6 backdrop-blur-sm">
      <form onSubmit={(event) => void handleSubmit(event)} className="w-full max-w-2xl border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
        <div className="flex items-start justify-between border-b border-[#D8E6EB] p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Editor visual</p>
            <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">{editor.label}</h2>
            <p className="mt-1 text-xs font-semibold text-[#5F7077]">{editor.pageKey}/{editor.entryKey}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center border border-[#D8E6EB] text-[#5F7077] hover:bg-[#F2F7F9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          {editor.entryType === 'image' ? (
            <div className="grid gap-3 border border-[#D8E6EB] bg-[#F2F7F9] p-4">
              <label className="grid gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Texto alternativo</span>
                <input
                  value={uploadAlt}
                  onChange={(event) => setUploadAlt(event.target.value)}
                  className="h-11 border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                  placeholder="Descrição da imagem"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 border border-[#1398B7] bg-white px-4 py-3 text-sm font-black text-[#0A3640] hover:bg-[#E8F6FA]">
                <ImageIcon className="h-4 w-4" />
                Enviar imagem
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
              {usesJsonEditor ? 'Conteúdo estruturado JSON' : 'Conteúdo'}
            </span>
            <textarea
              value={rawValue}
              onChange={(event) => setRawValue(event.target.value)}
              rows={usesJsonEditor ? 14 : 7}
              className="w-full resize-y border border-[#D8E6EB] bg-white px-4 py-3 font-mono text-sm leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
            />
          </label>

          {message ? (
            <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-3 text-sm font-bold text-[#15323b]">
              {message}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[#D8E6EB] p-5">
          <button type="button" onClick={onClose} className="border border-[#D8E6EB] bg-white px-5 py-3 text-sm font-black text-[#5F7077] hover:bg-[#F2F7F9]">
            Fechar
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 py-3 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar e publicar'}
          </button>
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
        <div className="fixed bottom-5 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 border border-[#D8E6EB] bg-white/95 px-3 py-2 shadow-[0_18px_50px_rgba(6,27,33,0.2)] backdrop-blur">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-[0.16em]',
              isEditing ? 'bg-[#0A3640] text-white' : 'bg-[#1398B7] text-white',
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {isEditing ? 'Sair da edição' : 'Ativar edição'}
          </button>
          <Link to="/admin/site-editor" className="inline-flex items-center gap-2 border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#0A3640] hover:bg-[#F2F7F9]">
            <Settings className="h-3.5 w-3.5" />
            Gestão
          </Link>
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

  if (!editor?.isEditing || !scope) {
    return <>{value}</>
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
        reload: scope.reload,
      })}
    >
      {value}
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
    <div className="fixed right-5 top-5 z-[110] max-w-xs border border-[#D8E6EB] bg-white p-4 text-xs font-bold leading-5 text-[#15323b] shadow-[0_18px_50px_rgba(6,27,33,0.12)]">
      <div className="flex items-start gap-2">
        <RotateCcw className="mt-0.5 h-4 w-4 text-[#1398B7]" />
        <p>Clique nos itens destacados para editar. O site público continua intacto fora do modo edição.</p>
      </div>
    </div>
  )
}
