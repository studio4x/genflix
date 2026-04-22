import { supabase } from '@/services/supabase/client'

import {
  defaultSiteEditorSettings,
  type SiteAsset,
  type SiteContentEntry,
  type SiteContentEntryType,
  type SiteContentVersion,
  type SiteEditorSettings,
  type SitePageKey,
} from '@/features/site-editor/types'
import {
  createSiteEditorWorkspaceKey,
  getDefaultWorkspaceRecord,
  sortWorkspaceComments,
  type SiteEditorWorkflowStatus,
  type SiteEditorWorkspaceComment,
  type SiteEditorWorkspaceMap,
  type SiteEditorWorkspaceRecord,
} from '@/features/site-editor/collaboration'

const SITE_ASSETS_BUCKET = 'site-assets'

type WorkspaceRecordRow = {
  id: string
  page_key: SitePageKey
  entry_key: string
  status: SiteEditorWorkflowStatus
  draft_raw_value: string | null
  draft_text_style: Record<string, string> | null
  updated_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  site_editor_workspace_comments?: WorkspaceCommentRow[] | null
}

type WorkspaceCommentRow = {
  id: string
  body: string
  author_role: string | null
  created_by: string | null
  created_at: string
}

export type SiteEditorAssistAction = 'rewrite' | 'summarize' | 'cta' | 'audit'

export type SiteEditorAssistResponse = {
  content: string
  notes: string[]
  warnings: string[]
  provider: 'openai' | 'heuristic'
}

function isEditorForcedOff() {
  return import.meta.env.VITE_SITE_EDITOR_ENABLED === 'false'
}

function valuePayload(value: unknown) {
  return value === undefined ? null : value
}

export function shouldIgnoreSiteEditor() {
  return isEditorForcedOff()
}

export async function fetchSiteEditorSettings() {
  if (isEditorForcedOff()) {
    return {
      ...defaultSiteEditorSettings,
      is_enabled: false,
      read_overrides_enabled: false,
      editing_enabled: false,
      fallback_mode: true,
    } satisfies SiteEditorSettings
  }

  const { data, error } = await supabase
    .from('site_editor_settings')
    .select('id, is_enabled, read_overrides_enabled, editing_enabled, fallback_mode, updated_by, created_at, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as SiteEditorSettings | null) ?? defaultSiteEditorSettings
}

export async function updateSiteEditorSettings(input: Partial<Pick<SiteEditorSettings, 'is_enabled' | 'read_overrides_enabled' | 'editing_enabled' | 'fallback_mode'>>) {
  const { data: sessionData } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('site_editor_settings')
    .upsert(
      {
        id: 1,
        ...input,
        updated_by: sessionData.session?.user.id ?? null,
      },
      { onConflict: 'id' },
    )
    .select('id, is_enabled, read_overrides_enabled, editing_enabled, fallback_mode, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return data as SiteEditorSettings
}

export async function disableSiteEditorOverrides() {
  return updateSiteEditorSettings({
    read_overrides_enabled: false,
    editing_enabled: false,
    fallback_mode: true,
  })
}

export async function fetchSiteContent(pageKey: SitePageKey) {
  if (isEditorForcedOff()) {
    return []
  }

  const { data, error } = await supabase
    .from('site_content_entries')
    .select('id, page_key, entry_key, entry_type, value, schema, is_enabled, updated_by, created_at, updated_at')
    .in('page_key', ['global', pageKey])
    .eq('is_enabled', true)

  if (error) {
    throw error
  }

  return (data ?? []) as SiteContentEntry[]
}

export async function saveSiteContentEntry(input: {
  pageKey: SitePageKey
  entryKey: string
  entryType: SiteContentEntryType
  value: unknown
  schema?: Record<string, unknown>
}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id ?? null
  const { data: existing, error: existingError } = await supabase
    .from('site_content_entries')
    .select('id, value, entry_type')
    .eq('page_key', input.pageKey)
    .eq('entry_key', input.entryKey)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  const { data, error } = await supabase
    .from('site_content_entries')
    .upsert(
      {
        page_key: input.pageKey,
        entry_key: input.entryKey,
        entry_type: input.entryType,
        value: valuePayload(input.value),
        schema: input.schema ?? {},
        is_enabled: true,
        updated_by: userId,
      },
      { onConflict: 'page_key,entry_key' },
    )
    .select('id, page_key, entry_key, entry_type, value, schema, is_enabled, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const nextEntry = data as SiteContentEntry
  const { error: versionError } = await supabase.from('site_content_versions').insert({
    entry_id: nextEntry.id,
    page_key: input.pageKey,
    entry_key: input.entryKey,
    entry_type: input.entryType,
    previous_value: existing?.value ?? null,
    next_value: valuePayload(input.value),
    changed_by: userId,
    change_reason: existing ? 'update' : 'create',
  })

  if (versionError) {
    throw versionError
  }

  return nextEntry
}

export async function clearSiteContentEntryOverride(entryId: string) {
  const { error } = await supabase
    .from('site_content_entries')
    .update({ is_enabled: false })
    .eq('id', entryId)

  if (error) {
    throw error
  }
}

export async function clearPageOverrides(pageKey: SitePageKey) {
  const { error } = await supabase
    .from('site_content_entries')
    .update({ is_enabled: false })
    .eq('page_key', pageKey)

  if (error) {
    throw error
  }
}

export async function fetchSiteContentVersions(entryId: string) {
  const { data, error } = await supabase
    .from('site_content_versions')
    .select('id, entry_id, page_key, entry_key, entry_type, previous_value, next_value, changed_by, change_reason, created_at')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as SiteContentVersion[]
}

export async function restoreSiteContentVersion(version: SiteContentVersion) {
  return saveSiteContentEntry({
    pageKey: version.page_key,
    entryKey: version.entry_key,
    entryType: version.entry_type,
    value: version.previous_value ?? version.next_value,
    schema: {},
  })
}

export async function uploadSiteAsset(file: File, metadata: { alt?: string; pageKey?: SitePageKey; entryKey?: string } = {}) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const storagePath = `${metadata.pageKey ?? 'global'}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (upload.error) {
    throw upload.error
  }

  const publicUrl = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(storagePath).data.publicUrl
  const { data: sessionData } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('site_assets')
    .insert({
      storage_path: storagePath,
      public_url: publicUrl,
      alt: metadata.alt ?? file.name,
      mime_type: file.type || null,
      file_size: file.size,
      metadata: {
        page_key: metadata.pageKey ?? null,
        entry_key: metadata.entryKey ?? null,
        original_name: file.name,
      },
      uploaded_by: sessionData.session?.user.id ?? null,
    })
    .select('id, storage_path, public_url, alt, width, height, mime_type, file_size, metadata, uploaded_by, created_at')
    .single()

  if (error) {
    throw error
  }

  return data as SiteAsset
}

export async function fetchSiteAssets(limit = 24) {
  const { data, error } = await supabase
    .from('site_assets')
    .select('id, storage_path, public_url, alt, width, height, mime_type, file_size, metadata, uploaded_by, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as SiteAsset[]
}

function normalizeWorkspaceComment(row: WorkspaceCommentRow): SiteEditorWorkspaceComment {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorRole: (row.author_role as SiteEditorWorkspaceComment['authorRole'] | null) ?? 'unknown',
    createdBy: row.created_by,
  }
}

function normalizeWorkspaceRecord(row: WorkspaceRecordRow): SiteEditorWorkspaceRecord {
  const defaultRecord = getDefaultWorkspaceRecord(row.page_key, row.entry_key)

  return {
    ...defaultRecord,
    id: row.id,
    status: row.status,
    draftRawValue: row.draft_raw_value,
    draftTextStyle: row.draft_text_style ?? {},
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    comments: sortWorkspaceComments((row.site_editor_workspace_comments ?? []).map(normalizeWorkspaceComment)),
  }
}

export async function fetchSiteEditorWorkspace(pageKeys?: SitePageKey[]) {
  const query = supabase
    .from('site_editor_workspace_records')
    .select(`
      id,
      page_key,
      entry_key,
      status,
      draft_raw_value,
      draft_text_style,
      updated_by,
      published_at,
      created_at,
      updated_at,
      site_editor_workspace_comments (
        id,
        body,
        author_role,
        created_by,
        created_at
      )
    `)
    .order('updated_at', { ascending: false })

  const filteredQuery = pageKeys && pageKeys.length > 0
    ? query.in('page_key', pageKeys)
    : query

  const { data, error } = await filteredQuery

  if (error) {
    throw error
  }

  return ((data ?? []) as WorkspaceRecordRow[]).reduce<SiteEditorWorkspaceMap>((accumulator, row) => {
    const normalizedRecord = normalizeWorkspaceRecord(row)
    accumulator[createSiteEditorWorkspaceKey(normalizedRecord.pageKey, normalizedRecord.entryKey)] = normalizedRecord
    return accumulator
  }, {})
}

export async function upsertSiteEditorWorkspaceRecord(input: {
  pageKey: SitePageKey
  entryKey: string
  status?: SiteEditorWorkflowStatus
  draftRawValue?: string | null
  draftTextStyle?: Record<string, string>
  publishedAt?: string | null
}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const payload = {
    page_key: input.pageKey,
    entry_key: input.entryKey,
    status: input.status ?? 'draft',
    draft_raw_value: input.draftRawValue ?? null,
    draft_text_style: input.draftTextStyle ?? {},
    published_at: input.publishedAt ?? null,
    updated_by: sessionData.session?.user.id ?? null,
  }

  const { data, error } = await supabase
    .from('site_editor_workspace_records')
    .upsert(payload, { onConflict: 'page_key,entry_key' })
    .select(`
      id,
      page_key,
      entry_key,
      status,
      draft_raw_value,
      draft_text_style,
      updated_by,
      published_at,
      created_at,
      updated_at,
      site_editor_workspace_comments (
        id,
        body,
        author_role,
        created_by,
        created_at
      )
    `)
    .single()

  if (error) {
    throw error
  }

  return normalizeWorkspaceRecord(data as WorkspaceRecordRow)
}

export async function createSiteEditorWorkspaceComment(input: {
  pageKey: SitePageKey
  entryKey: string
  body: string
  authorRole: string
}) {
  const normalizedBody = input.body.trim()
  if (!normalizedBody) {
    throw new Error('Comentario vazio.')
  }

  const workspace = await upsertSiteEditorWorkspaceRecord({
    pageKey: input.pageKey,
    entryKey: input.entryKey,
  })

  const { data: sessionData } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('site_editor_workspace_comments')
    .insert({
      workspace_id: workspace.id,
      body: normalizedBody,
      author_role: input.authorRole || 'unknown',
      created_by: sessionData.session?.user.id ?? null,
    })

  if (error) {
    throw error
  }

  const refreshed = await fetchSiteEditorWorkspace([input.pageKey])
  return refreshed[createSiteEditorWorkspaceKey(input.pageKey, input.entryKey)] ?? workspace
}

export async function requestSiteEditorAssist(input: {
  pageKey: SitePageKey
  entryKey: string
  entryType: SiteContentEntryType
  action: SiteEditorAssistAction
  content: string
}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const response = await fetch('/api/admin/site-editor/assist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(input),
  })

  const payload = (await response.json().catch(() => null)) as
    | ({ error?: string } & Partial<SiteEditorAssistResponse>)
    | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Nao foi possivel gerar uma sugestao editorial.')
  }

  return {
    content: payload?.content ?? '',
    notes: payload?.notes ?? [],
    warnings: payload?.warnings ?? [],
    provider: payload?.provider ?? 'heuristic',
  } satisfies SiteEditorAssistResponse
}
