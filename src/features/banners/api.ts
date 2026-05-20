import { supabase } from '@/services/supabase/client'

import {
  cloneBannerLayout,
  createDefaultSiteBanner,
  defaultBannerLayoutDesktop,
  defaultBannerLayoutMobile,
  defaultBannerBackgroundConfig,
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
  type SiteBannerBackgroundConfig,
  type SiteBannerVersion,
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
  background_asset_id_mobile: string | null
  background_url_mobile: string | null
  background_position_desktop: string | null
  background_size_desktop: string | null
  background_repeat_desktop: string | null
  background_position_mobile: string | null
  background_size_mobile: string | null
  background_repeat_mobile: string | null
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

type SiteBannerVersionRow = {
  id: string
  banner_id: string
  snapshot: Record<string, unknown> | null
  changed_by: string | null
  change_reason: string | null
  created_at: string
}

type UpdateSiteBannerInput = {
  id: string
  name?: string
  title?: string
  subtitle?: string
  body?: string
  backgroundAssetId?: string | null
  backgroundUrl?: string
  backgroundAssetIdMobile?: string | null
  backgroundUrlMobile?: string
  backgroundDesktop?: SiteBannerBackgroundConfig
  backgroundMobile?: SiteBannerBackgroundConfig
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
  changeReason?: string
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
    backgroundAssetIdMobile: row.background_asset_id_mobile,
    backgroundUrlMobile: row.background_url_mobile ?? row.background_url ?? '/images/genflix/home/hero.jpg',
    backgroundDesktop: normalizeBackgroundConfig({
      position: row.background_position_desktop,
      size: row.background_size_desktop,
      repeat: row.background_repeat_desktop,
    }),
    backgroundMobile: normalizeBackgroundConfig({
      position: row.background_position_mobile,
      size: row.background_size_mobile,
      repeat: row.background_repeat_mobile,
    }),
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

function normalizeBackgroundConfig(input: {
  position: unknown
  size: unknown
  repeat: unknown
}): SiteBannerBackgroundConfig {
  return {
    position: input.position === 'center center'
      || input.position === 'left center'
      || input.position === 'right center'
      || input.position === 'center top'
      || input.position === 'center bottom'
      || input.position === 'left top'
      || input.position === 'right top'
      || input.position === 'left bottom'
      || input.position === 'right bottom'
      ? input.position
      : defaultBannerBackgroundConfig.position,
    size: input.size === 'cover' || input.size === 'contain' || input.size === 'auto' || input.size === '100% 100%'
      ? input.size
      : defaultBannerBackgroundConfig.size,
    repeat: input.repeat === 'no-repeat' || input.repeat === 'repeat' || input.repeat === 'repeat-x' || input.repeat === 'repeat-y'
      ? input.repeat
      : defaultBannerBackgroundConfig.repeat,
  }
}

function buildBannerSnapshot(banner: SiteBanner) {
  return {
    id: banner.id,
    locationKey: banner.locationKey,
    name: banner.name,
    title: banner.title,
    subtitle: banner.subtitle,
    body: banner.body,
    backgroundAssetId: banner.backgroundAssetId,
    backgroundUrl: banner.backgroundUrl,
    backgroundAssetIdMobile: banner.backgroundAssetIdMobile,
    backgroundUrlMobile: banner.backgroundUrlMobile,
    backgroundDesktop: { ...banner.backgroundDesktop },
    backgroundMobile: { ...banner.backgroundMobile },
    themePreset: banner.themePreset,
    layoutDesktop: cloneBannerLayout(banner.layoutDesktop),
    layoutMobile: cloneBannerLayout(banner.layoutMobile),
    heightDesktop: banner.heightDesktop,
    heightMobile: banner.heightMobile,
    elementStyles: cloneBannerElementStyles(banner.elementStyles),
    primaryCta: banner.primaryCta ? { ...banner.primaryCta } : null,
    secondaryCta: banner.secondaryCta ? { ...banner.secondaryCta } : null,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder,
    createdBy: banner.createdBy,
    updatedBy: banner.updatedBy,
    createdAt: banner.createdAt,
    updatedAt: banner.updatedAt,
  } satisfies SiteBanner
}

function normalizeBannerVersion(row: SiteBannerVersionRow): SiteBannerVersion | null {
  if (!row.snapshot) {
    return null
  }

  const snapshotRecord = row.snapshot
  const snapshot = normalizeBanner({
    id: typeof snapshotRecord.id === 'string' ? snapshotRecord.id : row.banner_id,
    location_key: typeof snapshotRecord.locationKey === 'string' ? snapshotRecord.locationKey : HOME_HERO_BANNER_LOCATION,
    name: typeof snapshotRecord.name === 'string' ? snapshotRecord.name : 'Banner',
    title: typeof snapshotRecord.title === 'string' ? snapshotRecord.title : '',
    subtitle: typeof snapshotRecord.subtitle === 'string' ? snapshotRecord.subtitle : '',
    body: typeof snapshotRecord.body === 'string' ? snapshotRecord.body : '',
    background_asset_id: typeof snapshotRecord.backgroundAssetId === 'string' ? snapshotRecord.backgroundAssetId : null,
    background_url: typeof snapshotRecord.backgroundUrl === 'string' ? snapshotRecord.backgroundUrl : null,
    background_asset_id_mobile: typeof snapshotRecord.backgroundAssetIdMobile === 'string' ? snapshotRecord.backgroundAssetIdMobile : null,
    background_url_mobile: typeof snapshotRecord.backgroundUrlMobile === 'string' ? snapshotRecord.backgroundUrlMobile : null,
    background_position_desktop: isRecord(snapshotRecord.backgroundDesktop) && typeof snapshotRecord.backgroundDesktop.position === 'string' ? snapshotRecord.backgroundDesktop.position : null,
    background_size_desktop: isRecord(snapshotRecord.backgroundDesktop) && typeof snapshotRecord.backgroundDesktop.size === 'string' ? snapshotRecord.backgroundDesktop.size : null,
    background_repeat_desktop: isRecord(snapshotRecord.backgroundDesktop) && typeof snapshotRecord.backgroundDesktop.repeat === 'string' ? snapshotRecord.backgroundDesktop.repeat : null,
    background_position_mobile: isRecord(snapshotRecord.backgroundMobile) && typeof snapshotRecord.backgroundMobile.position === 'string' ? snapshotRecord.backgroundMobile.position : null,
    background_size_mobile: isRecord(snapshotRecord.backgroundMobile) && typeof snapshotRecord.backgroundMobile.size === 'string' ? snapshotRecord.backgroundMobile.size : null,
    background_repeat_mobile: isRecord(snapshotRecord.backgroundMobile) && typeof snapshotRecord.backgroundMobile.repeat === 'string' ? snapshotRecord.backgroundMobile.repeat : null,
    theme_preset: typeof snapshotRecord.themePreset === 'string' ? snapshotRecord.themePreset : 'light-strong',
    layout_desktop: isRecord(snapshotRecord.layoutDesktop) ? snapshotRecord.layoutDesktop : null,
    layout_mobile: isRecord(snapshotRecord.layoutMobile) ? snapshotRecord.layoutMobile : null,
    height_desktop: typeof snapshotRecord.heightDesktop === 'number' ? snapshotRecord.heightDesktop : null,
    height_mobile: typeof snapshotRecord.heightMobile === 'number' ? snapshotRecord.heightMobile : null,
    element_styles: isRecord(snapshotRecord.elementStyles) ? snapshotRecord.elementStyles : null,
    primary_cta: snapshotRecord.primaryCta ?? null,
    secondary_cta: snapshotRecord.secondaryCta ?? null,
    is_active: typeof snapshotRecord.isActive === 'boolean' ? snapshotRecord.isActive : false,
    sort_order: typeof snapshotRecord.sortOrder === 'number' ? snapshotRecord.sortOrder : 0,
    created_by: typeof snapshotRecord.createdBy === 'string' ? snapshotRecord.createdBy : null,
    updated_by: typeof snapshotRecord.updatedBy === 'string' ? snapshotRecord.updatedBy : null,
    created_at: typeof snapshotRecord.createdAt === 'string' ? snapshotRecord.createdAt : row.created_at,
    updated_at: typeof snapshotRecord.updatedAt === 'string' ? snapshotRecord.updatedAt : row.created_at,
  })

  return {
    id: row.id,
    bannerId: row.banner_id,
    snapshot,
    changedBy: row.changed_by,
    changeReason: row.change_reason ?? 'update',
    createdAt: row.created_at,
  }
}

async function insertBannerVersion(banner: SiteBanner, changeReason: string, changedBy: string | null) {
  const { error } = await supabase
    .from('site_banner_versions')
    .insert({
      banner_id: banner.id,
      snapshot: buildBannerSnapshot(banner),
      changed_by: changedBy,
      change_reason: changeReason,
    })

  if (error) {
    throw error
  }
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function fetchSiteBanners(locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION) {
  const { data, error } = await supabase
    .from('site_banners')
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, background_asset_id_mobile, background_url_mobile, background_position_desktop, background_size_desktop, background_repeat_desktop, background_position_mobile, background_size_mobile, background_repeat_mobile, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
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

  // Legacy guard: the initial hardcoded home hero location should not render
  // in the dynamic home hero slot anymore.
  if (input.pageKey === 'home' && input.placementKey === 'hero') {
    keys.delete(HOME_HERO_BANNER_LOCATION)
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
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, background_asset_id_mobile, background_url_mobile, background_position_desktop, background_size_desktop, background_repeat_desktop, background_position_mobile, background_size_mobile, background_repeat_mobile, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
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
      background_asset_id_mobile: draft.backgroundAssetIdMobile,
      background_url_mobile: draft.backgroundUrlMobile,
      background_position_desktop: draft.backgroundDesktop.position,
      background_size_desktop: draft.backgroundDesktop.size,
      background_repeat_desktop: draft.backgroundDesktop.repeat,
      background_position_mobile: draft.backgroundMobile.position,
      background_size_mobile: draft.backgroundMobile.size,
      background_repeat_mobile: draft.backgroundMobile.repeat,
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
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, background_asset_id_mobile, background_url_mobile, background_position_desktop, background_size_desktop, background_repeat_desktop, background_position_mobile, background_size_mobile, background_repeat_mobile, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const banner = normalizeBanner(data as SiteBannerRow)
  await insertBannerVersion(banner, 'create', userId)
  return banner
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
  if (input.backgroundAssetIdMobile !== undefined) payload.background_asset_id_mobile = input.backgroundAssetIdMobile
  if (input.backgroundUrlMobile !== undefined) payload.background_url_mobile = input.backgroundUrlMobile
  if (input.backgroundDesktop !== undefined) {
    payload.background_position_desktop = input.backgroundDesktop.position
    payload.background_size_desktop = input.backgroundDesktop.size
    payload.background_repeat_desktop = input.backgroundDesktop.repeat
  }
  if (input.backgroundMobile !== undefined) {
    payload.background_position_mobile = input.backgroundMobile.position
    payload.background_size_mobile = input.backgroundMobile.size
    payload.background_repeat_mobile = input.backgroundMobile.repeat
  }
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
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, background_asset_id_mobile, background_url_mobile, background_position_desktop, background_size_desktop, background_repeat_desktop, background_position_mobile, background_size_mobile, background_repeat_mobile, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const banner = normalizeBanner(data as SiteBannerRow)
  await insertBannerVersion(banner, input.changeReason ?? 'update', userId)
  return banner
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

export async function reorderSiteBanners(idsInOrder: string[], locationKey: SiteBannerLocationKey = HOME_HERO_BANNER_LOCATION) {
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

  const reordered = await fetchSiteBanners(locationKey)
  await Promise.all(reordered
    .filter((banner) => idsInOrder.includes(banner.id))
    .map((banner) => insertBannerVersion(banner, 'reorder', userId)))
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
      background_asset_id_mobile: banner.backgroundAssetIdMobile,
      background_url_mobile: banner.backgroundUrlMobile,
      background_position_desktop: banner.backgroundDesktop.position,
      background_size_desktop: banner.backgroundDesktop.size,
      background_repeat_desktop: banner.backgroundDesktop.repeat,
      background_position_mobile: banner.backgroundMobile.position,
      background_size_mobile: banner.backgroundMobile.size,
      background_repeat_mobile: banner.backgroundMobile.repeat,
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
    .select('id, location_key, name, title, subtitle, body, background_asset_id, background_url, background_asset_id_mobile, background_url_mobile, background_position_desktop, background_size_desktop, background_repeat_desktop, background_position_mobile, background_size_mobile, background_repeat_mobile, theme_preset, layout_desktop, layout_mobile, height_desktop, height_mobile, element_styles, primary_cta, secondary_cta, is_active, sort_order, created_by, updated_by, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const duplicated = normalizeBanner(data as SiteBannerRow)
  await insertBannerVersion(duplicated, 'duplicate', userId)
  return duplicated
}

export async function fetchSiteBannerVersions(bannerId: string) {
  const { data, error } = await supabase
    .from('site_banner_versions')
    .select('id, banner_id, snapshot, changed_by, change_reason, created_at')
    .eq('banner_id', bannerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as SiteBannerVersionRow[])
    .map(normalizeBannerVersion)
    .filter((item): item is SiteBannerVersion => item !== null)
}

export async function restoreSiteBannerVersion(version: SiteBannerVersion) {
  return updateSiteBanner({
    id: version.bannerId,
    name: version.snapshot.name,
    title: version.snapshot.title,
    subtitle: version.snapshot.subtitle,
    body: version.snapshot.body,
    backgroundAssetId: version.snapshot.backgroundAssetId,
    backgroundUrl: version.snapshot.backgroundUrl,
    backgroundAssetIdMobile: version.snapshot.backgroundAssetIdMobile,
    backgroundUrlMobile: version.snapshot.backgroundUrlMobile,
    backgroundDesktop: { ...version.snapshot.backgroundDesktop },
    backgroundMobile: { ...version.snapshot.backgroundMobile },
    themePreset: version.snapshot.themePreset,
    layoutDesktop: cloneBannerLayout(version.snapshot.layoutDesktop),
    layoutMobile: cloneBannerLayout(version.snapshot.layoutMobile),
    heightDesktop: version.snapshot.heightDesktop,
    heightMobile: version.snapshot.heightMobile,
    elementStyles: cloneBannerElementStyles(version.snapshot.elementStyles),
    primaryCta: version.snapshot.primaryCta ? { ...version.snapshot.primaryCta } : null,
    secondaryCta: version.snapshot.secondaryCta ? { ...version.snapshot.secondaryCta } : null,
    isActive: version.snapshot.isActive,
    sortOrder: version.snapshot.sortOrder,
    changeReason: 'restore',
  })
}
