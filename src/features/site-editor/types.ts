export type SitePageKey =
  | 'global'
  | 'home'
  | 'courses'
  | 'course-detail'
  | 'about'
  | 'blog'
  | 'blog-post'
  | 'contact'
  | 'community'
  | 'resources'
  | 'privacy'
  | 'cookies'
  | 'terms'

export type SiteContentEntryType = 'text' | 'rich_text' | 'image' | 'link' | 'button' | 'list' | 'json'

export interface EditableListItem {
  id: string
  label?: string
  title?: string
  description?: string
  href?: string
  image?: string
  metadata?: Record<string, unknown>
}

export interface SiteContentEntry<TValue = unknown> {
  id: string
  page_key: SitePageKey
  entry_key: string
  entry_type: SiteContentEntryType
  value: TValue
  schema: Record<string, unknown>
  is_enabled: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface SiteContentVersion {
  id: string
  entry_id: string
  page_key: SitePageKey
  entry_key: string
  entry_type: SiteContentEntryType
  previous_value: unknown
  next_value: unknown
  changed_by: string | null
  change_reason: string | null
  created_at: string
}

export interface SiteEditorSettings {
  id: number
  is_enabled: boolean
  read_overrides_enabled: boolean
  editing_enabled: boolean
  fallback_mode: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface SiteAsset {
  id: string
  storage_path: string
  public_url: string | null
  alt: string | null
  width: number | null
  height: number | null
  mime_type: string | null
  file_size: number | null
  metadata: Record<string, unknown>
  uploaded_by: string | null
  created_at: string
}

export const defaultSiteEditorSettings: SiteEditorSettings = {
  id: 1,
  is_enabled: true,
  read_overrides_enabled: true,
  editing_enabled: true,
  fallback_mode: false,
  updated_by: null,
  created_at: '',
  updated_at: '',
}
