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

const SITE_ASSETS_BUCKET = 'site-assets'

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
