import { supabase } from '@/services/supabase/client'

import {
  cloneBannerLayout,
  createDefaultSiteBanner,
  defaultBannerLayoutDesktop,
  defaultBannerLayoutMobile,
  defaultBannerElementStyles,
  defaultBannerHeightDesktop,
  defaultBannerHeightMobile,
  defaultPrimaryBannerCta,
  defaultSecondaryBannerCta,
  HOME_HERO_BANNER_LOCATION,
  isBannerCta,
  type SiteBanner,
  type SiteBannerCta,
  type SiteBannerElementStyle,
  type SiteBannerElementStyles,
  type SiteBannerLayoutDesktop,
  type SiteBannerLayoutMobile,
  type SiteBannerCarouselTarget,
  type SiteBannerPlacementKey,
  type SiteBannerLocationKey,
  type SiteBannerThemePreset,
  cloneBannerElementStyles,
} from '@/features/banners/types'
import type { SitePageKey } from '@/features/site-editor/types'

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
  layout_mobile: Record<string, unknown> | null
  height_desktop: number | null
  height_mobile: number | null
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
  layoutMobile?: SiteBannerLayoutMobile
  heightDesktop?: number
  heightMobile?: number
  elementStyles?: SiteBannerElementStyles
  primaryCta?: SiteBannerCta | null
  secondaryCta?: SiteBannerCta | null
  isActive?: boolean
  sortOrder?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLayoutItem(
  value: unknown,
  fallback: SiteBannerLayoutDesktop[keyof SiteBannerLayoutDesktop],
) {
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

type SiteBannerCarouselTargetRow = {
  id: string
  location_key: string
  page_key: SitePageKey
  placement_key: SiteBannerPlacementKey
}

function normalizeLayoutMobile(value: unknown): SiteBannerLayoutMobile {
  const record = isRecord(value) ? value : {}
  return {
    title: normalizeLayoutItem(record.title, defaultBannerLayoutMobile.title),
    subtitle: normalizeLayoutItem(record.subtitle, defaultBannerLayoutMobile.subtitle),
    body: normalizeLayoutItem(record.body, defaultBannerLayoutMobile.body),
    primaryCta: normalizeLayoutItem(record.primaryCta, defaultBannerLayoutMobile.primaryCta),
    secondaryCta: normalizeLayoutItem(record.secondaryCta, defaultBannerLayoutMobile.secondaryCta),
  }
}

function normalizeElementStyle(value: unknown, fallback: SiteBannerElementStyle) {
  if (!isRecord(value)) {
    return { ...fallback }
  }

  return {
    textColor: typeof value.textColor === 'string' ? value.textColor : fallback.textColor,
    backgroundColor: typeof value.backgroundColor === 'string' ? value.backgroundColor : fallback.backgroundColor,
    fontFamily: typeof value.fontFamily === 'string' ? value.fontFamily : fallback.fontFamily,
    fontSize: typeof value.fontSize === 'number' ? value.fontSize : fallback.fontSize,
    fontWeight: typeof value.fontWeight === 'number' ? value.fontWeight : fallback.fontWeight,
    letterSpacing: typeof value.letterSpacing === 'number' ? value.letterSpacing : fallback.letterSpacing,
    textAlign: value.textAlign === 'left' || value.textAlign === 'center' || value.textAlign === 'right'
      ? value.textAlign
      : fallback.textAlign,
    verticalAlign: value.verticalAlign === 'top' || value.verticalAlign === 'middle' || value.verticalAlign === 'bottom'
      ? value.verticalAlign
      : fallback.verticalAlign,
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
  const heightDesktop = Number.isFinite(row.height_desktop) ? Math.round(Number(row.height_desktop)) : defaultBannerHeightDesktop
  const heightMobile = Number.isFinite(row.height_mobile) ? Math.round(Number(row.height_mobile)) : defaultBannerHeightMobile
  return {
    id: row.id,
    locationKey: row.location_key || HOME_HERO_BANNER_LOCATION,
    name: row.name,
    title: row.title,
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    backgroundAssetId: row.background_asset_id,
    backgroundUrl: row.background_url ?? '/images/genflix/home/hero.jpg',
    themePreset: row.theme_preset as SiteBannerThemePreset,
    layoutDesktop: normalizeLayoutDesktop(row.layout_desktop),
    layoutMobile: normalizeLayoutMobile(row.layout_mobile),
    heightDesktop: Math.min(Math.max(heightDesktop, 320), 1200),
    heightMobile: Math.min(Math.max(heightMobile, 320), 1200),
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
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .eq('location_key', locationKey)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SiteBannerRow[]).map(normalizeBanner)
}

export async function fetchSiteBannerLocations() {
  const { data, error } = await supabase
    .from('site_banners')
    .select('location_key')
    .order('location_key', { ascending: true })

  if (error) {
    throw error
  }

  const keys = new Set<string>()
  for (const row of (data ?? []) as Array<{ location_key: string | null }>) {
    const key = row.location_key?.trim()
    if (key) {
      keys.add(key)
    }
  }

  if (!keys.has(HOME_HERO_BANNER_LOCATION)) {
    keys.add(HOME_HERO_BANNER_LOCATION)
  }

  return Array.from(keys)
}

export async function fetchSiteBannerCarouselTargets(locationKey: SiteBannerLocationKey) {
  const { data, error } = await supabase
    .from('site_banner_carousel_targets')
    .select('id, location_key, page_key, placement_key')
    .eq('location_key', locationKey)
    .order('page_key', { ascending: true })
    .order('placement_key', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SiteBannerCarouselTargetRow[]).map((row) => ({
    id: row.id,
    locationKey: row.location_key,
    pageKey: row.page_key,
    placementKey: row.placement_key,
  } satisfies SiteBannerCarouselTarget))
}

export async function fetchSiteBannerCarouselTargetLocationKeys(input: {
  pageKey: SitePageKey
  placementKey: SiteBannerPlacementKey
}) {
  const { data, error } = await supabase
    .from('site_banner_carousel_targets')
    .select('location_key')
    .eq('page_key', input.pageKey)
    .eq('placement_key', input.placementKey)
    .order('location_key', { ascending: true })

  if (error) {
    throw error
  }

  const keys = new Set<string>()
  for (const row of (data ?? []) as Array<{ location_key: string | null }>) {
    const key = row.location_key?.trim()
    if (key) {
      keys.add(key)
    }
  }

  return Array.from(keys)
}

export async function upsertSiteBannerCarouselTarget(input: {
  locationKey: SiteBannerLocationKey
  pageKey: SitePageKey
  placementKey: SiteBannerPlacementKey
}) {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('site_banner_carousel_targets')
    .upsert({
      location_key: input.locationKey,
      page_key: input.pageKey,
      placement_key: input.placementKey,
      created_by: userId,
      updated_by: userId,
    }, { onConflict: 'location_key,page_key,placement_key' })
    .select('id, location_key, page_key, placement_key')
    .single()

  if (error) {
    throw error
  }

  const row = data as SiteBannerCarouselTargetRow
  return {
    id: row.id,
    locationKey: row.location_key,
    pageKey: row.page_key,
    placementKey: row.placement_key,
  } satisfies SiteBannerCarouselTarget
}

export async function deleteSiteBannerCarouselTarget(targetId: string) {
  const { error } = await supabase
    .from('site_banner_carousel_targets')
    .delete()
    .eq('id', targetId)

  if (error) {
    throw error
  }
}

export async function fetchActiveSiteBanners(locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION) {
  const { data, error } = await supabase
    .from('site_banners')
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
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
  const draft = createDefaultSiteBanner(nextSortOrder, locationKey)

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
      layout_mobile: draft.layoutMobile,
      height_desktop: draft.heightDesktop,
      height_mobile: draft.heightMobile,
      element_styles: draft.elementStyles,
      primary_cta: draft.primaryCta,
      secondary_cta: draft.secondaryCta,
      is_active: draft.isActive,
      sort_order: draft.sortOrder,
      created_by: userId,
      updated_by: userId,
    })
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
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
  if (input.layoutMobile !== undefined) payload.layout_mobile = input.layoutMobile
  if (input.heightDesktop !== undefined) payload.height_desktop = input.heightDesktop
  if (input.heightMobile !== undefined) payload.height_mobile = input.heightMobile
  if (input.elementStyles !== undefined) payload.element_styles = input.elementStyles
  if (input.primaryCta !== undefined) payload.primary_cta = input.primaryCta
  if (input.secondaryCta !== undefined) payload.secondary_cta = input.secondaryCta
  if (input.isActive !== undefined) payload.is_active = input.isActive
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder

  const { data, error } = await supabase
    .from('site_banners')
    .update(payload)
    .eq('id', input.id)
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
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
      layout_mobile: cloneBannerLayout(banner.layoutMobile),
      height_desktop: banner.heightDesktop,
      height_mobile: banner.heightMobile,
      element_styles: cloneBannerElementStyles(banner.elementStyles),
      primary_cta: banner.primaryCta ? { ...banner.primaryCta } : null,
      secondary_cta: banner.secondaryCta ? { ...banner.secondaryCta } : null,
      is_active: false,
      sort_order: nextSortOrder,
      created_by: userId,
      updated_by: userId,
    })
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  return normalizeBanner(data as SiteBannerRow)
}
