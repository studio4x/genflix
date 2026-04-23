import { supabase } from '@/services/supabase/client'

import {
  cloneBannerLayout,
  createDefaultSiteBanner,
  defaultBannerLayoutDesktop,
  defaultBannerElementStyles,
  defaultPrimaryBannerCta,
  defaultSecondaryBannerCta,
  HOME_HERO_BANNER_LOCATION,
  isBannerCta,
  type SiteBanner,
  type SiteBannerCta,
  type SiteBannerElementStyle,
  type SiteBannerElementStyles,
  type SiteBannerLayoutDesktop,
  type SiteBannerLocationKey,
  type SiteBannerThemePreset,
  cloneBannerElementStyles,
} from '@/features/banners/types'

type SiteBannerRow = {
  id: string
  location_key: string
  name: string
  title: string
  subtitle: string | null
  body: string | null
  background_asset_id: string | null
  background_url: string | null
  theme_preset: string
  layout_desktop: Record<string, unknown> | null
  element_styles: Record<string, unknown> | null
  primary_cta: unknown
  secondary_cta: unknown
  is_active: boolean
  sort_order: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

type UpdateSiteBannerInput = {
  id: string
  name?: string
  title?: string
  subtitle?: string
  body?: string
  backgroundAssetId?: string | null
  backgroundUrl?: string
  themePreset?: SiteBannerThemePreset
  layoutDesktop?: SiteBannerLayoutDesktop
  elementStyles?: SiteBannerElementStyles
  primaryCta?: SiteBannerCta | null
  secondaryCta?: SiteBannerCta | null
  isActive?: boolean
  sortOrder?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLayoutItem(value: unknown, fallback: SiteBannerLayoutDesktop[keyof SiteBannerLayoutDesktop]) {
  if (!isRecord(value)) {
    return { ...fallback }
  }

  return {
    x: typeof value.x === 'number' ? value.x : fallback.x,
    y: typeof value.y === 'number' ? value.y : fallback.y,
    width: typeof value.width === 'number' ? value.width : fallback.width,
    visible: typeof value.visible === 'boolean' ? value.visible : fallback.visible,
    zIndex: typeof value.zIndex === 'number' ? value.zIndex : fallback.zIndex,
  }
}

function normalizeLayoutDesktop(value: unknown): SiteBannerLayoutDesktop {
  const record = isRecord(value) ? value : {}
  return {
    title: normalizeLayoutItem(record.title, defaultBannerLayoutDesktop.title),
    subtitle: normalizeLayoutItem(record.subtitle, defaultBannerLayoutDesktop.subtitle),
    body: normalizeLayoutItem(record.body, defaultBannerLayoutDesktop.body),
    primaryCta: normalizeLayoutItem(record.primaryCta, defaultBannerLayoutDesktop.primaryCta),
    secondaryCta: normalizeLayoutItem(record.secondaryCta, defaultBannerLayoutDesktop.secondaryCta),
  }
}

function normalizeElementStyle(value: unknown, fallback: SiteBannerElementStyle) {
  if (!isRecord(value)) {
    return { ...fallback }
  }

  return {
    textColor: typeof value.textColor === 'string' ? value.textColor : fallback.textColor,
    backgroundColor: typeof value.backgroundColor === 'string' ? value.backgroundColor : fallback.backgroundColor,
  }
}

function normalizeElementStyles(value: unknown): SiteBannerElementStyles {
  const record = isRecord(value) ? value : {}
  return {
    title: normalizeElementStyle(record.title, defaultBannerElementStyles.title),
    subtitle: normalizeElementStyle(record.subtitle, defaultBannerElementStyles.subtitle),
    body: normalizeElementStyle(record.body, defaultBannerElementStyles.body),
    primaryCta: normalizeElementStyle(record.primaryCta, defaultBannerElementStyles.primaryCta),
    secondaryCta: normalizeElementStyle(record.secondaryCta, defaultBannerElementStyles.secondaryCta),
  }
}

function normalizeCta(value: unknown, fallback: SiteBannerCta | null) {
  if (value === null || value === undefined) {
    return null
  }

  if (!isBannerCta(value)) {
    return fallback ? { ...fallback } : null
  }

  return {
    label: value.label,
    href: value.href,
    isInternal: value.isInternal,
    openInNewTab: value.openInNewTab,
    tonePreset: value.tonePreset,
    visible: value.visible,
    pageKey: value.pageKey,
  } satisfies SiteBannerCta
}

function normalizeBanner(row: SiteBannerRow): SiteBanner {
  return {
    id: row.id,
    locationKey: HOME_HERO_BANNER_LOCATION,
    name: row.name,
    title: row.title,
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    backgroundAssetId: row.background_asset_id,
    backgroundUrl: row.background_url ?? '/images/genflix/home/hero.jpg',
    themePreset: row.theme_preset as SiteBannerThemePreset,
    layoutDesktop: normalizeLayoutDesktop(row.layout_desktop),
    elementStyles: normalizeElementStyles(row.element_styles),
    primaryCta: normalizeCta(row.primary_cta, defaultPrimaryBannerCta),
    secondaryCta: normalizeCta(row.secondary_cta, defaultSecondaryBannerCta),
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function fetchSiteBanners(locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION) {
  const { data, error } = await supabase
    .from('site_banners')
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .eq('location_key', locationKey)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SiteBannerRow[]).map(normalizeBanner)
}

export async function fetchActiveSiteBanners(locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION) {
  const { data, error } = await supabase
    .from('site_banners')
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .eq('location_key', locationKey)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SiteBannerRow[]).map(normalizeBanner)
}

export async function createSiteBanner(locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION) {
  const existing = await fetchSiteBanners(locationKey)
  const nextSortOrder = existing.length
  const userId = await currentUserId()
  const draft = createDefaultSiteBanner(nextSortOrder)

  const { data, error } = await supabase
    .from('site_banners')
    .insert({
      location_key: draft.locationKey,
      name: draft.name,
      title: draft.title,
      subtitle: draft.subtitle,
      body: draft.body,
      background_asset_id: draft.backgroundAssetId,
      background_url: draft.backgroundUrl,
      theme_preset: draft.themePreset,
      layout_desktop: draft.layoutDesktop,
      element_styles: draft.elementStyles,
      primary_cta: draft.primaryCta,
      secondary_cta: draft.secondaryCta,
      is_active: draft.isActive,
      sort_order: draft.sortOrder,
      created_by: userId,
      updated_by: userId,
    })
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return normalizeBanner(data as SiteBannerRow)
}

export async function updateSiteBanner(input: UpdateSiteBannerInput) {
  const userId = await currentUserId()
  const payload: Record<string, unknown> = {
    updated_by: userId,
  }

  if (input.name !== undefined) payload.name = input.name
  if (input.title !== undefined) payload.title = input.title
  if (input.subtitle !== undefined) payload.subtitle = input.subtitle
  if (input.body !== undefined) payload.body = input.body
  if (input.backgroundAssetId !== undefined) payload.background_asset_id = input.backgroundAssetId
  if (input.backgroundUrl !== undefined) payload.background_url = input.backgroundUrl
  if (input.themePreset !== undefined) payload.theme_preset = input.themePreset
  if (input.layoutDesktop !== undefined) payload.layout_desktop = input.layoutDesktop
  if (input.elementStyles !== undefined) payload.element_styles = input.elementStyles
  if (input.primaryCta !== undefined) payload.primary_cta = input.primaryCta
  if (input.secondaryCta !== undefined) payload.secondary_cta = input.secondaryCta
  if (input.isActive !== undefined) payload.is_active = input.isActive
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder

  const { data, error } = await supabase
    .from('site_banners')
    .update(payload)
    .eq('id', input.id)
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return normalizeBanner(data as SiteBannerRow)
}

export async function deleteSiteBanner(id: string) {
  const { error } = await supabase.from('site_banners').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function toggleSiteBannerActive(id: string, isActive: boolean) {
  return updateSiteBanner({ id, isActive })
}

export async function reorderSiteBanners(idsInOrder: string[]) {
  const userId = await currentUserId()
  const updates = idsInOrder.map((id, index) => ({
    id,
    sort_order: index,
    updated_by: userId,
  }))

  const { error } = await supabase.from('site_banners').upsert(updates)

  if (error) {
    throw error
  }
}

export async function duplicateSiteBanner(banner: SiteBanner) {
  const banners = await fetchSiteBanners(banner.locationKey)
  const nextSortOrder = banners.length
  const userId = await currentUserId()

  const { data, error } = await supabase
    .from('site_banners')
    .insert({
      location_key: banner.locationKey,
      name: `${banner.name} copia`,
      title: banner.title,
      subtitle: banner.subtitle,
      body: banner.body,
      background_asset_id: banner.backgroundAssetId,
      background_url: banner.backgroundUrl,
      theme_preset: banner.themePreset,
      layout_desktop: cloneBannerLayout(banner.layoutDesktop),
      element_styles: cloneBannerElementStyles(banner.elementStyles),
      primary_cta: banner.primaryCta ? { ...banner.primaryCta } : null,
      secondary_cta: banner.secondaryCta ? { ...banner.secondaryCta } : null,
      is_active: false,
      sort_order: nextSortOrder,
      created_by: userId,
      updated_by: userId,
    })
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return normalizeBanner(data as SiteBannerRow)
}
