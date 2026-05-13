import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Copy, Eye, EyeOff, ExternalLink, Filter, History, Loader2, MessageSquare, RotateCcw, Save, Search, ShieldCheck, Trash2, Type, Upload } from 'lucide-react'
import JSZip from 'jszip'

import { Button } from '@/components/ui/button'
import {
  clearPageOverrides,
  clearSiteContentEntryOverride,
  deleteSiteAsset,
  disableSiteEditorOverrides,
  fetchSiteEditorWorkspace,
  fetchSiteContentVersions,
  fetchSiteEditorSettings,
  restoreSiteContentVersion,
  saveSiteContentEntry,
  uploadSiteAsset,
  updateSiteEditorSettings,
} from '@/features/site-editor/api'
import type { SiteAsset, SiteContentEntry, SiteContentVersion, SiteEditorSettings, SitePageKey } from '@/features/site-editor/types'
import { defaultSiteEditorSettings } from '@/features/site-editor/types'
import {
  createSiteEditorWorkspaceKey,
  formatWorkflowStatus,
  type SiteEditorWorkspaceMap,
} from '@/features/site-editor/collaboration'
import { SITE_TEXT_FONT_PRESETS } from '@/features/site-editor/font-presets'
import { renderSiteIcon, SITE_ICON_OPTIONS } from '@/features/site-editor/site-icons'
import { createDefaultSiteTypography, normalizeSiteTypography, type SiteTypographyConfig, type SiteTypographyGroup, type SiteTypographyGroupKey } from '@/features/site-editor/site-typography'
import { supabase } from '@/services/supabase/client'

type SitePageRow = {
  id: string
  page_key: SitePageKey
  path: string
  title: string
  status: string
}

type SiteEditorMode = 'basic' | 'advanced'
type AdminSiteEditorTab = 'overrides' | 'icon-library' | 'typography'

function resolveIconNameFromFileName(fileName: string) {
  const normalizedName = fileName.trim()
  if (!normalizedName) return 'icone-sem-nome'
  const nameWithoutExtension = normalizedName.replace(/\.[^/.]+$/, '')
  return nameWithoutExtension.trim() || normalizedName
}

function normalizeIconNameForComparison(iconName: string) {
  return iconName.trim().toLowerCase()
}

function isSvgUploadFile(file: File) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

function isZipUploadFile(file: File) {
  const normalizedType = file.type.toLowerCase()
  const normalizedName = file.name.toLowerCase()
  return (
    normalizedType === 'application/zip'
    || normalizedType === 'application/x-zip-compressed'
    || normalizedType === 'multipart/x-zip'
    || normalizedType === 'application/x-compressed'
    || normalizedName.endsWith('.zip')
  )
}

function resolveFileNameFromZipEntry(entryName: string) {
  const parts = entryName.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? entryName
}

function isZipMetadataEntry(entryName: string) {
  const normalizedEntryName = entryName.toLowerCase()
  const fileName = resolveFileNameFromZipEntry(normalizedEntryName)
  return normalizedEntryName.includes('__macosx/') || fileName.startsWith('._')
}

function isValidSvgContent(input: string) {
  return /<svg[\s>]/i.test(input)
}

async function extractSvgFilesFromZip(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const files: File[] = []
  let ignoredMetadataCount = 0
  let ignoredInvalidSvgCount = 0

  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.toLowerCase().endsWith('.svg')) {
      continue
    }

    if (isZipMetadataEntry(entry.name)) {
      ignoredMetadataCount += 1
      continue
    }

    const svgContent = await entry.async('string')
    if (!isValidSvgContent(svgContent)) {
      ignoredInvalidSvgCount += 1
      continue
    }

    const fileName = resolveFileNameFromZipEntry(entry.name)
    files.push(new File([svgContent], fileName, { type: 'image/svg+xml', lastModified: file.lastModified }))
  }

  return {
    files,
    ignoredMetadataCount,
    ignoredInvalidSvgCount,
  }
}

function summarizeDuplicateNames(iconNames: string[]) {
  const uniqueNames = Array.from(new Set(iconNames))
  const preview = uniqueNames.slice(0, 6).join(', ')
  if (uniqueNames.length <= 6) {
    return preview
  }

  return `${preview} e mais ${uniqueNames.length - 6}`
}

function formatEntryTypeLabel(entryType: SiteContentEntry['entry_type']) {
  switch (entryType) {
    case 'text':
      return 'Texto'
    case 'rich_text':
      return 'Texto rico'
    case 'image':
      return 'Imagem'
    case 'link':
      return 'Link'
    case 'button':
      return 'Botao'
    case 'list':
      return 'Listagem'
    case 'json':
      return 'Estruturado'
    default:
      return entryType
  }
}

function summarizeEntryValue(value: unknown) {
  if (typeof value === 'string') {
    return value.length > 88 ? `${value.slice(0, 88)}...` : value
  }

  if (Array.isArray(value)) {
    return `${value.length} item(ns)`
  }

  if (value && typeof value === 'object') {
    return `${Object.keys(value as Record<string, unknown>).length} campo(s)`
  }

  if (value === null || value === undefined) {
    return 'Sem valor'
  }

  return String(value)
}

const siteTypographyGroupLabels: Record<SiteTypographyGroupKey, string> = {
  h1: 'Titulos H1',
  h2: 'Titulos H2',
  h3: 'Titulos H3',
  body: 'Corpo de texto',
  list: 'Topicos de lista',
  link: 'Links',
}

export function AdminSiteEditorPage() {
  const [settings, setSettings] = useState<SiteEditorSettings>(defaultSiteEditorSettings)
  const [pages, setPages] = useState<SitePageRow[]>([])
  const [entries, setEntries] = useState<SiteContentEntry[]>([])
  const [selectedPageKey, setSelectedPageKey] = useState<SitePageKey>('home')
  const [editorMode, setEditorMode] = useState<SiteEditorMode>('basic')
  const [activeTab, setActiveTab] = useState<AdminSiteEditorTab>('overrides')
  const [typographyDraft, setTypographyDraft] = useState<SiteTypographyConfig>(createDefaultSiteTypography())
  const [searchQuery, setSearchQuery] = useState('')
  const [iconSearchQuery, setIconSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | SiteContentEntry['entry_type']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [versions, setVersions] = useState<SiteContentVersion[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingIconLibrary, setIsLoadingIconLibrary] = useState(false)
  const [isUploadingIcons, setIsUploadingIcons] = useState(false)
  const [isDeletingIconId, setIsDeletingIconId] = useState<string | null>(null)
  const [isDeletingAllIcons, setIsDeletingAllIcons] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [workspaceState, setWorkspaceState] = useState<SiteEditorWorkspaceMap>({})
  const [iconLibraryAssets, setIconLibraryAssets] = useState<SiteAsset[]>([])

  const selectedPage = useMemo(
    () => pages.find((page) => page.page_key === selectedPageKey) ?? null,
    [pages, selectedPageKey],
  )
  const pageEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return entries.filter((entry) => {
      const matchesPage = entry.page_key === selectedPageKey || entry.page_key === 'global'
      const matchesType = typeFilter === 'all' || entry.entry_type === typeFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'enabled' && entry.is_enabled)
        || (statusFilter === 'disabled' && !entry.is_enabled)
      const matchesQuery = normalizedQuery.length === 0
        || entry.entry_key.toLowerCase().includes(normalizedQuery)
        || entry.page_key.toLowerCase().includes(normalizedQuery)
        || formatEntryTypeLabel(entry.entry_type).toLowerCase().includes(normalizedQuery)
        || summarizeEntryValue(entry.value).toLowerCase().includes(normalizedQuery)

      return matchesPage && matchesType && matchesStatus && matchesQuery
    })
  }, [entries, searchQuery, selectedPageKey, statusFilter, typeFilter])
  const availableEntryTypes = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.entry_type))),
    [entries],
  )
  const pageStats = useMemo(
    () => pages.map((page) => ({
      pageKey: page.page_key,
      totalEntries: entries.filter((entry) => entry.page_key === page.page_key).length,
    })),
    [entries, pages],
  )
  const selectedPageStat = pageStats.find((page) => page.pageKey === selectedPageKey)?.totalEntries ?? 0
  const filteredIconOptions = useMemo(() => {
    const normalizedQuery = iconSearchQuery.trim().toLowerCase()

    return SITE_ICON_OPTIONS.filter((option) => {
      if (normalizedQuery.length === 0) {
        return true
      }

      return (
        option.label.toLowerCase().includes(normalizedQuery)
        || option.value.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [iconSearchQuery])
  const filteredUploadedIconAssets = useMemo(() => {
    const normalizedQuery = iconSearchQuery.trim().toLowerCase()

    return iconLibraryAssets.filter((asset) => {
      const originalName = typeof asset.metadata?.original_name === 'string'
        ? asset.metadata.original_name
        : ''
      const assetName = (asset.alt ?? '').trim() || resolveIconNameFromFileName(originalName)

      if (normalizedQuery.length === 0) {
        return true
      }

      return (
        assetName.toLowerCase().includes(normalizedQuery)
        || originalName.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [iconLibraryAssets, iconSearchQuery])

  useEffect(() => {
    const typographyEntry = entries.find((entry) => entry.page_key === 'global' && entry.entry_key === 'site.typography')
    setTypographyDraft(normalizeSiteTypography(typographyEntry?.value))
  }, [entries])

  useEffect(() => {
    if (pages.length === 0) {
      return
    }

    if (!pages.some((page) => page.page_key === selectedPageKey)) {
      setSelectedPageKey(pages[0].page_key)
    }
  }, [pages, selectedPageKey])

  const collaborationSummary = useMemo(() => {
    const relevantEntries = entries.filter((entry) => entry.page_key === selectedPageKey || entry.page_key === 'global')
    return relevantEntries.reduce((accumulator, entry) => {
      const workspace = workspaceState[createSiteEditorWorkspaceKey(entry.page_key, entry.entry_key)]
      if (!workspace) {
        return accumulator
      }

      accumulator[workspace.status] += 1
      accumulator.comments += workspace.comments.length
      if (workspace.draftRawValue) {
        accumulator.draftsWithContent += 1
      }
      return accumulator
    }, {
      draft: 0,
      review: 0,
      approved: 0,
      published: 0,
      comments: 0,
      draftsWithContent: 0,
    })
  }, [entries, selectedPageKey, workspaceState])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const [nextSettings, workspaceRecords, pagesResult, entriesResult] = await Promise.all([
        fetchSiteEditorSettings(),
        fetchSiteEditorWorkspace(),
        supabase
          .from('site_pages')
          .select('id, page_key, path, title, status')
          .order('page_key', { ascending: true }),
        supabase
          .from('site_content_entries')
          .select('id, page_key, entry_key, entry_type, value, schema, is_enabled, updated_by, created_at, updated_at')
          .order('updated_at', { ascending: false }),
      ])

      if (pagesResult.error) throw pagesResult.error
      if (entriesResult.error) throw entriesResult.error

      setSettings(nextSettings)
      setWorkspaceState(workspaceRecords)
      setPages((pagesResult.data ?? []) as SitePageRow[])
      setEntries((entriesResult.data ?? []) as SiteContentEntry[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o editor visual.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadIconLibrary = useCallback(async () => {
    setIsLoadingIconLibrary(true)
    try {
      const { data, error } = await supabase
        .from('site_assets')
        .select('id, storage_path, public_url, alt, width, height, mime_type, file_size, metadata, uploaded_by, created_at')
        .contains('metadata', { entry_key: 'icon-library' })
        .order('created_at', { ascending: false })
        .limit(240)

      if (error) throw error
      setIconLibraryAssets((data ?? []) as SiteAsset[])
    } catch {
      setIconLibraryAssets([])
    } finally {
      setIsLoadingIconLibrary(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (activeTab !== 'icon-library') {
      return
    }
    void loadIconLibrary()
  }, [activeTab, loadIconLibrary])

  useEffect(() => {
    const channel = supabase
      .channel('site-editor-admin-collaboration')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_editor_workspace_records' }, () => {
        void loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_editor_workspace_comments' }, () => {
        void loadData()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadData])

  async function handleSettingsUpdate(input: Partial<Pick<SiteEditorSettings, 'is_enabled' | 'read_overrides_enabled' | 'editing_enabled' | 'fallback_mode'>>) {
    setIsSaving(true)
    setMessage(null)

    try {
      const nextSettings = await updateSiteEditorSettings(input)
      setSettings(nextSettings)
      setMessage('Configurações do editor visual atualizadas.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar as configurações.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDisableFallback() {
    setIsSaving(true)
    setMessage(null)

    try {
      const nextSettings = await disableSiteEditorOverrides()
      setSettings(nextSettings)
      setMessage('Editor desativado para leitura pública. O site voltou ao conteúdo original hardcoded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ativar o fallback original.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearEntry(entryId: string) {
    setIsSaving(true)
    setMessage(null)

    try {
      await clearSiteContentEntryOverride(entryId)
      await loadData()
      setMessage('Override do campo desativado. O fallback original voltou a valer para este campo.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível limpar o override.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearPage() {
    setIsSaving(true)
    setMessage(null)

    try {
      await clearPageOverrides(selectedPageKey)
      await loadData()
      setMessage('Overrides da página desativados. A página voltou ao conteúdo original.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a página.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLoadVersions(entryId: string) {
    setSelectedEntryId(entryId)
    setVersions([])

    try {
      setVersions(await fetchSiteContentVersions(entryId))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.')
    }
  }

  async function handleCopyIconKey(iconKey: string) {
    try {
      await navigator.clipboard.writeText(iconKey)
      setMessage(`Chave do ícone "${iconKey}" copiada para uso no editor.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível copiar a chave do ícone.')
    }
  }

  async function handleDeleteUploadedIcon(asset: SiteAsset) {
    const originalName = typeof asset.metadata?.original_name === 'string' ? asset.metadata.original_name : ''
    const iconName = (asset.alt ?? '').trim() || resolveIconNameFromFileName(originalName)

    setIsDeletingIconId(asset.id)
    setMessage(null)

    try {
      await deleteSiteAsset({ id: asset.id, storage_path: asset.storage_path })
      setIconLibraryAssets((currentAssets) => currentAssets.filter((currentAsset) => currentAsset.id !== asset.id))
      setMessage(`Icone "${iconName}" removido da biblioteca.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o icone da biblioteca.')
    } finally {
      setIsDeletingIconId(null)
    }
  }

  async function handleDeleteAllUploadedIcons() {
    if (iconLibraryAssets.length === 0) {
      setMessage('Nao ha icones enviados para excluir.')
      return
    }

    const confirmed = window.confirm(`Excluir todos os ${iconLibraryAssets.length} icones enviados?`)
    if (!confirmed) {
      return
    }

    setIsDeletingAllIcons(true)
    setMessage(null)

    try {
      let deletedCount = 0
      let failedCount = 0

      for (const asset of iconLibraryAssets) {
        try {
          await deleteSiteAsset({ id: asset.id, storage_path: asset.storage_path })
          deletedCount += 1
        } catch {
          failedCount += 1
        }
      }

      await loadIconLibrary()
      const failedSummary = failedCount > 0 ? ` ${failedCount} falharam.` : ''
      setMessage(`Exclusao massiva concluida: ${deletedCount} icone(s) removido(s).${failedSummary}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel concluir a exclusao massiva dos icones.')
    } finally {
      setIsDeletingAllIcons(false)
      setIsDeletingIconId(null)
    }
  }

  async function handleUploadIconFiles(inputFiles: FileList | null) {
    const selectedFiles = Array.from(inputFiles ?? [])
    const filesToUpload: File[] = []
    const duplicateNames: string[] = []
    let ignoredMetadataCount = 0
    let ignoredInvalidSvgCount = 0
    let zipFilesCount = 0

    for (const file of selectedFiles) {
      if (isSvgUploadFile(file)) {
        if (isZipMetadataEntry(file.name)) {
          ignoredMetadataCount += 1
          continue
        }

        const svgContent = await file.text()
        if (!isValidSvgContent(svgContent)) {
          ignoredInvalidSvgCount += 1
          continue
        }

        filesToUpload.push(file)
        continue
      }

      if (isZipUploadFile(file)) {
        const zipExtraction = await extractSvgFilesFromZip(file)
        zipFilesCount += 1
        filesToUpload.push(...zipExtraction.files)
        ignoredMetadataCount += zipExtraction.ignoredMetadataCount
        ignoredInvalidSvgCount += zipExtraction.ignoredInvalidSvgCount
      }
    }

    if (filesToUpload.length === 0) {
      const ignoredSummary = ignoredMetadataCount > 0 || ignoredInvalidSvgCount > 0
        ? ` Ignorados: ${ignoredMetadataCount} metadado(s), ${ignoredInvalidSvgCount} SVG(s) invalido(s).`
        : ''
      setMessage(`Selecione SVGs validos ou um arquivo ZIP contendo SVGs validos.${ignoredSummary}`)
      return
    }

    const reservedIconNames = new Set<string>()
    for (const nativeIcon of SITE_ICON_OPTIONS) {
      reservedIconNames.add(normalizeIconNameForComparison(nativeIcon.value))
    }
    for (const uploadedAsset of iconLibraryAssets) {
      const originalName = typeof uploadedAsset.metadata?.original_name === 'string' ? uploadedAsset.metadata.original_name : ''
      const uploadedIconName = (uploadedAsset.alt ?? '').trim() || resolveIconNameFromFileName(originalName)
      reservedIconNames.add(normalizeIconNameForComparison(uploadedIconName))
    }

    setIsUploadingIcons(true)
    setMessage(null)

    try {
      let uploadedCount = 0

      for (const file of filesToUpload) {
        const iconName = resolveIconNameFromFileName(file.name)
        const normalizedIconName = normalizeIconNameForComparison(iconName)

        if (reservedIconNames.has(normalizedIconName)) {
          duplicateNames.push(iconName)
          continue
        }
        await uploadSiteAsset(file, {
          alt: iconName,
          pageKey: 'global',
          entryKey: 'icon-library',
        })
        reservedIconNames.add(normalizedIconName)
        uploadedCount += 1
      }

      await loadIconLibrary()
      const zipSummary = zipFilesCount > 0 ? ` (${zipFilesCount} ZIP processado(s))` : ''
      const duplicateSummary = duplicateNames.length > 0
        ? ` ${duplicateNames.length} arquivo(s) ignorado(s) por nome duplicado: ${summarizeDuplicateNames(duplicateNames)}.`
        : ''
      const ignoredSummary = ignoredMetadataCount > 0 || ignoredInvalidSvgCount > 0
        ? ` ${ignoredMetadataCount} metadado(s) e ${ignoredInvalidSvgCount} SVG(s) invalido(s) ignorado(s).`
        : ''
      setMessage(`${uploadedCount} icone(s) SVG enviado(s) para a biblioteca${zipSummary}.${duplicateSummary}${ignoredSummary}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar os ícones para a biblioteca.')
    } finally {
      setIsUploadingIcons(false)
    }
  }

  function handleSingleIconUpload(event: ChangeEvent<HTMLInputElement>) {
    void handleUploadIconFiles(event.target.files)
    event.target.value = ''
  }

  function handleBulkIconUpload(event: ChangeEvent<HTMLInputElement>) {
    void handleUploadIconFiles(event.target.files)
    event.target.value = ''
  }

  function handleTypographyGroupChange(groupKey: SiteTypographyGroupKey, field: keyof SiteTypographyGroup, value: string) {
    setTypographyDraft((current) => ({
      ...current,
      [groupKey]: {
        ...current[groupKey],
        [field]: value,
      },
    }))
  }

  function handleTypographyReset() {
    setTypographyDraft(createDefaultSiteTypography())
  }

  async function handleTypographySave() {
    setIsSaving(true)
    setMessage(null)

    try {
      await saveSiteContentEntry({
        pageKey: 'global',
        entryKey: 'site.typography',
        entryType: 'json',
        value: typographyDraft,
        schema: { kind: 'site-typography' },
      })
      await loadData()
      setMessage('Padroes de tipografia global atualizados com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar os padroes de tipografia.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRestoreVersion(version: SiteContentVersion) {
    setIsSaving(true)
    setMessage(null)

    try {
      await restoreSiteContentVersion(version)
      await loadData()
      if (selectedEntryId) {
        setVersions(await fetchSiteContentVersions(selectedEntryId))
      }
      setMessage('Versão anterior restaurada e publicada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a versão.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Site</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Editor Visual</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
            Edite conteúdo do site público pelo frontend sem alterar a estrutura visual. O fallback hardcoded permanece preservado.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 text-sm font-black text-white"
        >
          Abrir site
        </Link>
      </header>
      <article className="w-full border border-[#D8E6EB] bg-white p-4 shadow-sm">
        <div className="flex h-11 w-full overflow-hidden rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC]">
          <button
            type="button"
            onClick={() => setActiveTab('overrides')}
            className={'flex-1 px-4 text-xs font-black uppercase tracking-[0.14em] ' + (activeTab === 'overrides' ? 'bg-[#0A3640] text-white' : 'text-[#5F7077]')}
          >
            Overrides
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('icon-library')}
            className={'inline-flex flex-1 items-center justify-center gap-2 px-4 text-xs font-black uppercase tracking-[0.14em] ' + (activeTab === 'icon-library' ? 'bg-[#1398B7] text-white' : 'text-[#5F7077]')}
          >
            <Upload className="h-3.5 w-3.5" />
            Biblioteca de ícones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('typography')}
            className={'inline-flex flex-1 items-center justify-center gap-2 px-4 text-xs font-black uppercase tracking-[0.14em] ' + (activeTab === 'typography' ? 'bg-[#1398B7] text-white' : 'text-[#5F7077]')}
          >
            <Type className="h-3.5 w-3.5" />
            Tipografia global
          </button>
        </div>
      </article>

      {message ? (
        <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4 text-sm font-bold text-[#15323b]">
          {message}
        </div>
      ) : null}

      {activeTab === 'overrides' ? (
      <section className="grid gap-4 xl:grid-cols-4">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Editor</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{settings.is_enabled ? 'Ativo' : 'Desativado'}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Controla a camada CMS inteira.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Overrides públicos</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{settings.read_overrides_enabled ? 'Lendo' : 'Fallback'}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Se desligado, o site usa o conteúdo original.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Modo edição</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{settings.editing_enabled ? 'Liberado' : 'Bloqueado'}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Afeta apenas administradores.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Campos salvos</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{entries.length}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Overrides preservados para rollback.</p>
        </article>
      </section>
      ) : null}

      <section className={`grid gap-6 ${activeTab === 'icon-library' || activeTab === 'typography' ? '' : 'xl:grid-cols-[0.85fr_minmax(0,1.15fr)]'}`}>
        <div className="min-w-0 space-y-6">

          {activeTab === 'overrides' ? (
          <>
          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Governança compartilhada</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5F7077]">
              Estes dados agora ficam persistidos no backend e refletem o fluxo compartilhado de rascunho, revisão, aprovação e comentários entre colaboradores do editor.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Rascunhos sincronizados</p>
                <p className="mt-2 text-2xl font-black text-[#15323b]">{collaborationSummary.draftsWithContent}</p>
              </div>
              <div className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Comentários internos</p>
                <p className="mt-2 text-2xl font-black text-[#15323b]">{collaborationSummary.comments}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(['draft', 'review', 'approved', 'published'] as const).map((status) => (
                <div key={status} className="flex items-center justify-between rounded-[16px] border border-[#D8E6EB] px-4 py-3 text-sm font-semibold text-[#15323b]">
                  <span>{formatWorkflowStatus(status)}</span>
                  <span className="font-black">{collaborationSummary[status]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Permissões por perfil</p>
              <div className="mt-3 grid gap-2 text-sm font-semibold text-[#15323b]">
                <p><span className="font-black">Admin:</span> rascunho, comentários, aprovação e publicação.</p>
                <p><span className="font-black">Criador/Professor:</span> rascunho, comentários e solicitação de revisão.</p>
                <p><span className="font-black">Demais perfis:</span> sem acesso ao fluxo de edição.</p>
              </div>
            </div>
          </article>

          <article className="border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-rose-700" />
              <div>
                <h2 className="font-readex text-xl font-semibold text-rose-800">Fallback imediato</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-rose-700">
                  Esta ação não apaga dados. Ela apenas faz o site ignorar overrides e voltar ao conteúdo original do código.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void handleDisableFallback()}
              disabled={isSaving}
              className="mt-5 h-12 w-full rounded-none bg-rose-700 font-black text-white hover:bg-rose-800"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Desativar editor visual e voltar ao conteúdo original
            </Button>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Configurações</h2>
            <div className="mt-5 grid gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSettingsUpdate({ is_enabled: !settings.is_enabled })}
                className="h-11 rounded-none justify-start border-[#D8E6EB]"
              >
                {settings.is_enabled ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {settings.is_enabled ? 'Desativar camada CMS' : 'Ativar camada CMS'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSettingsUpdate({ read_overrides_enabled: !settings.read_overrides_enabled, fallback_mode: settings.read_overrides_enabled })}
                className="h-11 rounded-none justify-start border-[#D8E6EB]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {settings.read_overrides_enabled ? 'Usar fallback original' : 'Ler overrides salvos'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSettingsUpdate({ editing_enabled: !settings.editing_enabled })}
                className="h-11 rounded-none justify-start border-[#D8E6EB]"
              >
                <Save className="mr-2 h-4 w-4" />
                {settings.editing_enabled ? 'Bloquear edição inline' : 'Liberar edição inline'}
              </Button>
            </div>
          </article>
          </>
          ) : null}

          {activeTab === 'icon-library' ? (
          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Biblioteca</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Ícones do site</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#5F7077]">
                  Use esta biblioteca para localizar e copiar as chaves de ícone usadas em cards, seções e elementos editáveis.
                </p>
              </div>
              <div className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Disponíveis</p>
                <p className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{SITE_ICON_OPTIONS.length}</p>
              </div>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Buscar ícone</span>
              <div className="flex h-11 items-center gap-2 rounded-[14px] border border-[#D8E6EB] bg-[#F8FBFC] px-3">
                <Search className="h-4 w-4 text-[#7C8B90]" />
                <input
                  value={iconSearchQuery}
                  onChange={(event) => setIconSearchQuery(event.target.value)}
                  placeholder="Ex.: saúde, vídeo, link, arquivo..."
                  className="w-full border-0 bg-transparent text-sm font-semibold text-[#15323b] outline-none"
                />
              </div>
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Subir 1 SVG</span>
                <span className="text-xs font-semibold text-[#5F7077]">Envio manual, um arquivo por vez.</span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleSingleIconUpload}
                  disabled={isUploadingIcons || isDeletingAllIcons}
                  className="text-xs font-semibold text-[#15323b] file:mr-3 file:rounded-full file:border file:border-[#D8E6EB] file:bg-white file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.12em] file:text-[#0A3640]"
                />
              </label>
              <label className="grid gap-2 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Subir vários SVGs</span>
                <span className="text-xs font-semibold text-[#5F7077]">Envio em lote por SVGs ou ZIP; o nome do ícone vira o nome do arquivo.</span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml,.zip,application/zip"
                  multiple
                  onChange={handleBulkIconUpload}
                  disabled={isUploadingIcons || isDeletingAllIcons}
                  className="text-xs font-semibold text-[#15323b] file:mr-3 file:rounded-full file:border file:border-[#D8E6EB] file:bg-white file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.12em] file:text-[#0A3640]"
                />
              </label>
            </div>

            <div className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1398B7]">SVGs enviados</p>
                  <p className="mt-1 text-sm font-semibold text-[#5F7077]">Use "copiar nome" para aplicar no editor visual.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#15323b]">
                    {iconLibraryAssets.length} cadastrado(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAllUploadedIcons()}
                    disabled={iconLibraryAssets.length === 0 || isDeletingAllIcons || isUploadingIcons}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingAllIcons ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Excluir todos
                  </button>
                </div>
              </div>
              {isUploadingIcons || isLoadingIconLibrary ? (
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#5F7077]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Atualizando biblioteca de ícones...
                </div>
              ) : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredUploadedIconAssets.map((asset) => {
                  const originalName = typeof asset.metadata?.original_name === 'string' ? asset.metadata.original_name : ''
                  const iconName = (asset.alt ?? '').trim() || resolveIconNameFromFileName(originalName)
                  return (
                    <article key={asset.id} className="rounded-[14px] border border-[#D8E6EB] bg-white p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] p-2">
                          {asset.public_url ? <img src={asset.public_url} alt={iconName} className="h-full w-full object-contain" /> : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#15323b]">{iconName}</p>
                          <p className="truncate text-xs font-semibold text-[#5F7077]">{originalName || iconName}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyIconKey(iconName)}
                          className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#0A3640] hover:bg-white"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar nome
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUploadedIcon(asset)}
                          disabled={isDeletingIconId === asset.id || isDeletingAllIcons || isUploadingIcons}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingIconId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Excluir
                        </button>
                      </div>
                    </article>
                  )
                })}
                {filteredUploadedIconAssets.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[#D8E6EB] bg-white px-4 py-6 text-xs font-semibold text-[#5F7077] sm:col-span-2">
                    Nenhum SVG enviado nesta biblioteca.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredIconOptions.map((option) => (
                <article key={option.value} className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#1398B7]">
                      {renderSiteIcon(option.value, 'h-5 w-5')}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyIconKey(option.value)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar chave
                    </button>
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#15323b]">{option.label}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5F7077]">Chave: {option.value}</p>
                </article>
              ))}

              {filteredIconOptions.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-4 py-8 text-sm font-semibold text-[#5F7077] sm:col-span-2 xl:col-span-3">
                  Nenhum ícone encontrado para esse filtro.
                </div>
              ) : null}
            </div>
          </article>
          ) : null}

          {activeTab === 'typography' ? (
          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Tipografia</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Padrao global de textos</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5F7077]">
                  Defina fonte, tamanho e peso para H1, H2, H3, corpo, topicos e links em todo o site publico.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTypographyReset}
                  disabled={isSaving}
                  className="rounded-none border-[#D8E6EB]"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleTypographySave()}
                  disabled={isSaving}
                  className="rounded-none bg-[#0A3640] text-white hover:bg-[#0A3640]/90"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar tipografia
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Aplicar fonte rapida em todos os grupos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SITE_TEXT_FONT_PRESETS.map((fontPreset) => (
                  <button
                    key={fontPreset.family}
                    type="button"
                    onClick={() => setTypographyDraft((current) => ({
                      h1: { ...current.h1, fontFamily: fontPreset.family },
                      h2: { ...current.h2, fontFamily: fontPreset.family },
                      h3: { ...current.h3, fontFamily: fontPreset.family },
                      body: { ...current.body, fontFamily: fontPreset.family },
                      list: { ...current.list, fontFamily: fontPreset.family },
                      link: { ...current.link, fontFamily: fontPreset.family },
                    }))}
                    className="rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#15323b] hover:bg-[#F2F7F9]"
                  >
                    {fontPreset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(['h1', 'h2', 'h3', 'body', 'list', 'link'] as SiteTypographyGroupKey[]).map((groupKey) => (
                <section key={groupKey} className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <h3 className="text-sm font-black text-[#15323b]">{siteTypographyGroupLabels[groupKey]}</h3>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Fonte (family)</span>
                      <select
                        value={typographyDraft[groupKey].fontFamily}
                        onChange={(event) => handleTypographyGroupChange(groupKey, 'fontFamily', event.target.value)}
                        className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      >
                        {SITE_TEXT_FONT_PRESETS.map((fontPreset) => (
                          <option key={fontPreset.family} value={fontPreset.family} style={{ fontFamily: fontPreset.family }}>
                            {fontPreset.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tamanho (px)</span>
                        <input
                          value={typographyDraft[groupKey].fontSize}
                          onChange={(event) => handleTypographyGroupChange(groupKey, 'fontSize', event.target.value)}
                          placeholder="Ex.: 16px"
                          className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Peso (100-900)</span>
                        <input
                          value={typographyDraft[groupKey].fontWeight}
                          onChange={(event) => handleTypographyGroupChange(groupKey, 'fontWeight', event.target.value)}
                          placeholder="Ex.: 700"
                          className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Entrelinha (em)</span>
                        <input
                          value={typographyDraft[groupKey].lineHeight}
                          onChange={(event) => handleTypographyGroupChange(groupKey, 'lineHeight', event.target.value)}
                          placeholder="Ex.: 1.5"
                          className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Letter spacing (em)</span>
                        <input
                          value={typographyDraft[groupKey].letterSpacing}
                          onChange={(event) => handleTypographyGroupChange(groupKey, 'letterSpacing', event.target.value)}
                          placeholder="Ex.: -0.02em"
                          className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Transformacao</span>
                      <select
                        value={typographyDraft[groupKey].textTransform || 'none'}
                        onChange={(event) => handleTypographyGroupChange(groupKey, 'textTransform', event.target.value)}
                        className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
                      >
                        <option value="none">none</option>
                        <option value="uppercase">uppercase</option>
                        <option value="lowercase">lowercase</option>
                        <option value="capitalize">capitalize</option>
                        <option value="inherit">inherit</option>
                      </select>
                    </label>
                  </div>
                </section>
              ))}
            </div>
          </article>
          ) : null}

        </div>

        {activeTab === 'overrides' ? (
        <div className="min-w-0 space-y-6">
          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Páginas</p>
                <h2 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Selecione o contexto de edição</h2>
                <p className="mt-2 text-sm font-semibold text-[#5F7077]">
                  Escolha a página no seletor e mantenha os overrides abaixo, sem ocupar largura desnecessária.
                </p>
              </div>

              <label className="grid min-w-[280px] gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Página</span>
                <select
                  value={selectedPageKey}
                  onChange={(event) => setSelectedPageKey(event.target.value as SitePageKey)}
                  className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                >
                  {pages.map((page) => (
                    <option key={page.page_key} value={page.page_key}>
                      {page.title} · {page.path}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#15323b]">
                {selectedPage?.title ?? selectedPageKey}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#5F7077]">
                {selectedPage?.path ?? selectedPageKey}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#1398B7]">
                {pageStats.find((item) => item.pageKey === selectedPageKey)?.totalEntries ?? 0} campo(s)
              </span>
            </div>
          </article>

          <section className="min-w-0 border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Overrides</p>
              <h2 className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">
                {selectedPage?.title ?? selectedPageKey}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#5F7077]">
                {selectedPage?.path ?? selectedPageKey} · {selectedPageStat} campo(s) cadastrados para esta pagina
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedPage ? (
                <Link
                  to={selectedPage.path}
                  className="inline-flex items-center gap-2 border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] hover:bg-[#F2F7F9]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir pagina
                </Link>
              ) : null}
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => void handleClearPage()} className="rounded-none border-[#D8E6EB]">
                Restaurar conteúdo original desta página
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4 xl:grid-cols-[1.3fr_0.9fr_0.9fr_auto]">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Buscar campo</span>
              <div className="flex h-11 items-center gap-2 rounded-[14px] border border-[#D8E6EB] bg-white px-3">
                <Search className="h-4 w-4 text-[#7C8B90]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Ex.: titulo, footer, newsletter, CTA..."
                  className="w-full border-0 bg-transparent text-sm font-semibold text-[#15323b] outline-none"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Tipo</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'all' | SiteContentEntry['entry_type'])}
                className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
              >
                <option value="all">Todos</option>
                {availableEntryTypes.map((entryType) => (
                  <option key={entryType} value={entryType}>{formatEntryTypeLabel(entryType)}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'enabled' | 'disabled')}
                className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
              >
                <option value="all">Todos</option>
                <option value="enabled">Ativos</option>
                <option value="disabled">Inativos</option>
              </select>
            </label>

            <div className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Modo</span>
              <div className="inline-flex h-11 overflow-hidden rounded-[14px] border border-[#D8E6EB] bg-white">
                <button
                  type="button"
                  onClick={() => setEditorMode('basic')}
                  className={`px-4 text-xs font-black uppercase tracking-[0.14em] ${editorMode === 'basic' ? 'bg-[#0A3640] text-white' : 'text-[#5F7077]'}`}
                >
                  Basico
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('advanced')}
                  className={`px-4 text-xs font-black uppercase tracking-[0.14em] ${editorMode === 'advanced' ? 'bg-[#1398B7] text-white' : 'text-[#5F7077]'}`}
                >
                  Avancado
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#D8E6EB] bg-white px-4 py-3">
            <div>
              <p className="text-sm font-black text-[#15323b]">{pageEntries.length} campo(s) encontrado(s)</p>
              <p className="text-xs font-semibold text-[#5F7077]">
                {editorMode === 'basic'
                  ? 'Modo basico: foco em nome, tipo, resumo e acoes.'
                  : 'Modo avancado: exibe pagina tecnica, preview salvo e estrutura completa.'}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#5F7077]">
              <Filter className="h-3.5 w-3.5" />
              Filtros aplicados
            </div>
          </div>

          {isLoading ? (
            <p className="p-5 text-sm font-semibold text-[#5F7077]">Carregando...</p>
          ) : pageEntries.length === 0 ? (
            <p className="p-5 text-sm font-semibold text-[#5F7077]">
              Nenhum override salvo para esta página. O site está usando exatamente o conteúdo original do código.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                  <tr>
                    <th className="px-4 py-3">Campo</th>
                    <th className="px-4 py-3">Resumo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Workflow</th>
                    <th className="px-4 py-3">Atualizado</th>
                    {editorMode === 'advanced' ? <th className="px-4 py-3">Pagina tecnica</th> : null}
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E6EB]">
                  {pageEntries.map((entry) => {
                    const workspace = workspaceState[createSiteEditorWorkspaceKey(entry.page_key, entry.entry_key)]

                    return (
                    <tr key={entry.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-black text-[#15323b]">{entry.entry_key}</div>
                        <div className="mt-1 text-xs font-semibold text-[#5F7077]">
                          {entry.page_key === 'global' ? 'Campo global' : 'Campo desta pagina'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold leading-5 text-[#5F7077]">
                        {summarizeEntryValue(entry.value)}
                        {workspace?.comments.length ? (
                          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {workspace.comments.length} comentário(s)
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs font-black uppercase text-[#5F7077]">{formatEntryTypeLabel(entry.entry_type)}</td>
                      <td className="px-4 py-3 text-xs font-black uppercase text-[#0A3640]">{entry.is_enabled ? 'Ativo' : 'Inativo'}</td>
                      <td className="px-4 py-3 text-xs font-black uppercase text-[#0A3640]">
                        {workspace ? formatWorkflowStatus(workspace.status) : 'Sem fluxo'}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#5F7077]">{new Date(entry.updated_at).toLocaleString('pt-BR')}</td>
                      {editorMode === 'advanced' ? (
                        <td className="px-4 py-3 text-xs font-semibold text-[#5F7077]">{entry.page_key}</td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void handleLoadVersions(entry.id)} className="inline-flex items-center gap-1 border border-[#D8E6EB] px-3 py-2 text-xs font-black text-[#0A3640] hover:bg-[#F2F7F9]">
                            <History className="h-3.5 w-3.5" />
                            Histórico
                          </button>
                          <button type="button" onClick={() => void handleClearEntry(entry.id)} className="border border-[#D8E6EB] px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50">
                            Limpar override
                          </button>
                        </div>
                      </td>
                    </tr>
                    )})}
                </tbody>
              </table>
            </div>
          )}

          {selectedEntryId ? (
            <div className="mt-6 border border-[#D8E6EB] bg-[#F2F7F9] p-4">
              <h3 className="font-readex text-lg font-semibold text-[#15323b]">Histórico do campo</h3>
              <div className="mt-3 grid gap-2">
                {versions.length === 0 ? (
                  <p className="text-sm font-semibold text-[#5F7077]">Nenhuma versão registrada.</p>
                ) : versions.map((version) => (
                  <div key={version.id} className="border border-[#D8E6EB] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">
                        {new Date(version.created_at).toLocaleString('pt-BR')} - {version.change_reason ?? 'alteração'}
                      </p>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleRestoreVersion(version)}
                        className="border border-[#D8E6EB] px-3 py-1.5 text-xs font-black text-[#0A3640] hover:bg-[#F2F7F9]"
                      >
                        Restaurar versão anterior
                      </button>
                    </div>
                    <pre className="mt-2 max-h-36 overflow-auto bg-[#F2F7F9] p-3 text-xs text-[#15323b]">
                      {JSON.stringify(version.next_value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        </div>
        ) : null}
      </section>
    </div>
  )
}

