import { supabase } from '@/services/supabase/client'

export const SITE_TRACKING_ENTRY_KEY = 'site.tracking'

export type SiteTrackingSettings = {
  gtmId: string
  metaPixelId: string
  customHeaderCode: string
  customBodyCode: string
  customFooterCode: string
}

export const defaultSiteTrackingSettings: SiteTrackingSettings = {
  gtmId: '',
  metaPixelId: '',
  customHeaderCode: '',
  customBodyCode: '',
  customFooterCode: '',
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeSiteTracking(value: unknown): SiteTrackingSettings {
  const source = isPlainRecord(value) ? value : {}

  return {
    gtmId: readString(source.gtmId),
    metaPixelId: readString(source.metaPixelId),
    customHeaderCode: readString(source.customHeaderCode),
    customBodyCode: readString(source.customBodyCode),
    customFooterCode: readString(source.customFooterCode),
  }
}

export async function fetchSiteTrackingSettings() {
  const { data, error } = await supabase
    .from('site_content_entries')
    .select('value')
    .eq('page_key', 'global')
    .eq('entry_key', SITE_TRACKING_ENTRY_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeSiteTracking(data?.value ?? defaultSiteTrackingSettings)
}

