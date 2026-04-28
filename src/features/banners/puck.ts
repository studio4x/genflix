import {
  defaultBannerEditorStateDesktop,
  defaultBannerEditorStateMobile,
  defaultBannerElementStyles,
  defaultBannerHeightDesktop,
  defaultBannerHeightMobile,
  defaultBannerLayoutDesktop,
  defaultBannerLayoutMobile,
  defaultPrimaryBannerCta,
  defaultSecondaryBannerCta,
  type BannerEditorState,
  type SiteBanner,
  type SiteBannerCta,
  type SiteBannerElementStyles,
  type SiteBannerLayoutDesktop,
  type SiteBannerLayoutMobile,
} from '@/features/banners/types'

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function findBlock(state: BannerEditorState, type: string) {
  return state.content.find((item) => item.type === type)?.props ?? {}
}

export function buildEditorStateFromBanner(banner: SiteBanner): { desktop: BannerEditorState; mobile: BannerEditorState } {
  if (banner.editorStateDesktop?.content?.length && banner.editorStateMobile?.content?.length) {
    return {
      desktop: structuredClone(banner.editorStateDesktop),
      mobile: structuredClone(banner.editorStateMobile),
    }
  }

  return {
    desktop: structuredClone(defaultBannerEditorStateDesktop),
    mobile: structuredClone(defaultBannerEditorStateMobile),
  }
}

export function mapEditorStateToBannerPayload(
  desktop: BannerEditorState,
  mobile: BannerEditorState,
  fallback: SiteBanner,
): Pick<SiteBanner, 'title' | 'subtitle' | 'body' | 'backgroundUrl' | 'themePreset' | 'layoutDesktop' | 'layoutMobile' | 'heightDesktop' | 'heightMobile' | 'elementStyles' | 'primaryCta' | 'secondaryCta'> {
  const titleDesktop = findBlock(desktop, 'title')
  const subtitleDesktop = findBlock(desktop, 'subtitle')
  const bodyDesktop = findBlock(desktop, 'body')
  const primaryDesktop = findBlock(desktop, 'primaryCta')
  const secondaryDesktop = findBlock(desktop, 'secondaryCta')

  const titleMobile = findBlock(mobile, 'title')
  const subtitleMobile = findBlock(mobile, 'subtitle')
  const bodyMobile = findBlock(mobile, 'body')
  const primaryMobile = findBlock(mobile, 'primaryCta')
  const secondaryMobile = findBlock(mobile, 'secondaryCta')

  const rootDesktop = desktop.root?.props ?? {}
  const rootMobile = mobile.root?.props ?? {}

  const layoutDesktop: SiteBannerLayoutDesktop = {
    title: {
      x: asNumber(titleDesktop.x, fallback.layoutDesktop.title.x),
      y: asNumber(titleDesktop.y, fallback.layoutDesktop.title.y),
      width: asNumber(titleDesktop.width, fallback.layoutDesktop.title.width),
      visible: asBoolean(titleDesktop.visible, fallback.layoutDesktop.title.visible),
      zIndex: fallback.layoutDesktop.title.zIndex,
    },
    subtitle: {
      x: asNumber(subtitleDesktop.x, fallback.layoutDesktop.subtitle.x),
      y: asNumber(subtitleDesktop.y, fallback.layoutDesktop.subtitle.y),
      width: asNumber(subtitleDesktop.width, fallback.layoutDesktop.subtitle.width),
      visible: asBoolean(subtitleDesktop.visible, fallback.layoutDesktop.subtitle.visible),
      zIndex: fallback.layoutDesktop.subtitle.zIndex,
    },
    body: {
      x: asNumber(bodyDesktop.x, fallback.layoutDesktop.body.x),
      y: asNumber(bodyDesktop.y, fallback.layoutDesktop.body.y),
      width: asNumber(bodyDesktop.width, fallback.layoutDesktop.body.width),
      visible: asBoolean(bodyDesktop.visible, fallback.layoutDesktop.body.visible),
      zIndex: fallback.layoutDesktop.body.zIndex,
    },
    primaryCta: {
      x: asNumber(primaryDesktop.x, fallback.layoutDesktop.primaryCta.x),
      y: asNumber(primaryDesktop.y, fallback.layoutDesktop.primaryCta.y),
      width: asNumber(primaryDesktop.width, fallback.layoutDesktop.primaryCta.width),
      visible: asBoolean(primaryDesktop.visible, fallback.layoutDesktop.primaryCta.visible),
      zIndex: fallback.layoutDesktop.primaryCta.zIndex,
    },
    secondaryCta: {
      x: asNumber(secondaryDesktop.x, fallback.layoutDesktop.secondaryCta.x),
      y: asNumber(secondaryDesktop.y, fallback.layoutDesktop.secondaryCta.y),
      width: asNumber(secondaryDesktop.width, fallback.layoutDesktop.secondaryCta.width),
      visible: asBoolean(secondaryDesktop.visible, fallback.layoutDesktop.secondaryCta.visible),
      zIndex: fallback.layoutDesktop.secondaryCta.zIndex,
    },
  }

  const layoutMobile: SiteBannerLayoutMobile = {
    title: {
      x: asNumber(titleMobile.x, fallback.layoutMobile.title.x),
      y: asNumber(titleMobile.y, fallback.layoutMobile.title.y),
      width: asNumber(titleMobile.width, fallback.layoutMobile.title.width),
      visible: asBoolean(titleMobile.visible, fallback.layoutMobile.title.visible),
      zIndex: fallback.layoutMobile.title.zIndex,
    },
    subtitle: {
      x: asNumber(subtitleMobile.x, fallback.layoutMobile.subtitle.x),
      y: asNumber(subtitleMobile.y, fallback.layoutMobile.subtitle.y),
      width: asNumber(subtitleMobile.width, fallback.layoutMobile.subtitle.width),
      visible: asBoolean(subtitleMobile.visible, fallback.layoutMobile.subtitle.visible),
      zIndex: fallback.layoutMobile.subtitle.zIndex,
    },
    body: {
      x: asNumber(bodyMobile.x, fallback.layoutMobile.body.x),
      y: asNumber(bodyMobile.y, fallback.layoutMobile.body.y),
      width: asNumber(bodyMobile.width, fallback.layoutMobile.body.width),
      visible: asBoolean(bodyMobile.visible, fallback.layoutMobile.body.visible),
      zIndex: fallback.layoutMobile.body.zIndex,
    },
    primaryCta: {
      x: asNumber(primaryMobile.x, fallback.layoutMobile.primaryCta.x),
      y: asNumber(primaryMobile.y, fallback.layoutMobile.primaryCta.y),
      width: asNumber(primaryMobile.width, fallback.layoutMobile.primaryCta.width),
      visible: asBoolean(primaryMobile.visible, fallback.layoutMobile.primaryCta.visible),
      zIndex: fallback.layoutMobile.primaryCta.zIndex,
    },
    secondaryCta: {
      x: asNumber(secondaryMobile.x, fallback.layoutMobile.secondaryCta.x),
      y: asNumber(secondaryMobile.y, fallback.layoutMobile.secondaryCta.y),
      width: asNumber(secondaryMobile.width, fallback.layoutMobile.secondaryCta.width),
      visible: asBoolean(secondaryMobile.visible, fallback.layoutMobile.secondaryCta.visible),
      zIndex: fallback.layoutMobile.secondaryCta.zIndex,
    },
  }

  const primaryCta: SiteBannerCta = {
    ...(fallback.primaryCta ?? defaultPrimaryBannerCta),
    label: asString(primaryDesktop.label, fallback.primaryCta?.label ?? defaultPrimaryBannerCta.label),
    href: asString(primaryDesktop.href, fallback.primaryCta?.href ?? defaultPrimaryBannerCta.href),
    isInternal: asBoolean(primaryDesktop.isInternal, fallback.primaryCta?.isInternal ?? defaultPrimaryBannerCta.isInternal),
    openInNewTab: asBoolean(primaryDesktop.openInNewTab, fallback.primaryCta?.openInNewTab ?? defaultPrimaryBannerCta.openInNewTab),
    tonePreset: (asString(primaryDesktop.tonePreset, fallback.primaryCta?.tonePreset ?? defaultPrimaryBannerCta.tonePreset) as SiteBannerCta['tonePreset']),
    visible: asBoolean(primaryDesktop.visible, fallback.primaryCta?.visible ?? defaultPrimaryBannerCta.visible),
  }

  const secondaryCta: SiteBannerCta = {
    ...(fallback.secondaryCta ?? defaultSecondaryBannerCta),
    label: asString(secondaryDesktop.label, fallback.secondaryCta?.label ?? defaultSecondaryBannerCta.label),
    href: asString(secondaryDesktop.href, fallback.secondaryCta?.href ?? defaultSecondaryBannerCta.href),
    isInternal: asBoolean(secondaryDesktop.isInternal, fallback.secondaryCta?.isInternal ?? defaultSecondaryBannerCta.isInternal),
    openInNewTab: asBoolean(secondaryDesktop.openInNewTab, fallback.secondaryCta?.openInNewTab ?? defaultSecondaryBannerCta.openInNewTab),
    tonePreset: (asString(secondaryDesktop.tonePreset, fallback.secondaryCta?.tonePreset ?? defaultSecondaryBannerCta.tonePreset) as SiteBannerCta['tonePreset']),
    visible: asBoolean(secondaryDesktop.visible, fallback.secondaryCta?.visible ?? defaultSecondaryBannerCta.visible),
  }

  const elementStyles: SiteBannerElementStyles = {
    ...defaultBannerElementStyles,
    ...fallback.elementStyles,
    title: {
      ...fallback.elementStyles.title,
      textColor: asString(titleDesktop.textColor, fallback.elementStyles.title.textColor ?? ''),
    },
    subtitle: {
      ...fallback.elementStyles.subtitle,
      textColor: asString(subtitleDesktop.textColor, fallback.elementStyles.subtitle.textColor ?? ''),
    },
    body: {
      ...fallback.elementStyles.body,
      textColor: asString(bodyDesktop.textColor, fallback.elementStyles.body.textColor ?? ''),
    },
    primaryCta: {
      ...fallback.elementStyles.primaryCta,
      textColor: asString(primaryDesktop.textColor, fallback.elementStyles.primaryCta.textColor ?? ''),
      backgroundColor: asString(primaryDesktop.backgroundColor, fallback.elementStyles.primaryCta.backgroundColor ?? ''),
    },
    secondaryCta: {
      ...fallback.elementStyles.secondaryCta,
      textColor: asString(secondaryDesktop.textColor, fallback.elementStyles.secondaryCta.textColor ?? ''),
      backgroundColor: asString(secondaryDesktop.backgroundColor, fallback.elementStyles.secondaryCta.backgroundColor ?? ''),
    },
  }

  return {
    title: asString(titleDesktop.text, fallback.title),
    subtitle: asString(subtitleDesktop.text, fallback.subtitle),
    body: asString(bodyDesktop.text, fallback.body),
    backgroundUrl: asString(rootDesktop.backgroundUrl, fallback.backgroundUrl),
    themePreset: (asString(rootDesktop.themePreset, fallback.themePreset) as SiteBanner['themePreset']),
    layoutDesktop,
    layoutMobile,
    heightDesktop: asNumber(rootDesktop.height, fallback.heightDesktop || defaultBannerHeightDesktop),
    heightMobile: asNumber(rootMobile.height, fallback.heightMobile || defaultBannerHeightMobile),
    elementStyles,
    primaryCta,
    secondaryCta,
  }
}

export function createEmptyEditorState(kind: 'desktop' | 'mobile') {
  return structuredClone(kind === 'desktop' ? defaultBannerEditorStateDesktop : defaultBannerEditorStateMobile)
}

export const bannerEditorFallbackLayout = {
  desktop: defaultBannerLayoutDesktop,
  mobile: defaultBannerLayoutMobile,
}
