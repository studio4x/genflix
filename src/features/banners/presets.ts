import type { SiteBannerThemePreset } from '@/features/banners/types'

export const bannerThemeStyles: Record<SiteBannerThemePreset, {
  overlay: string
  titleClass: string
  textClass: string
  bodyClass: string
  previewSurfaceClass: string
}> = {
  'light-strong': {
    overlay: 'linear-gradient(90deg, rgba(11,38,46,0.84) 0%, rgba(11,38,46,0.74) 28%, rgba(11,38,46,0.36) 54%, rgba(11,38,46,0.08) 100%)',
    titleClass: 'text-white',
    textClass: 'text-white/84',
    bodyClass: 'text-white/74',
    previewSurfaceClass: 'text-white',
  },
  'light-soft': {
    overlay: 'linear-gradient(90deg, rgba(12,44,53,0.72) 0%, rgba(12,44,53,0.58) 24%, rgba(12,44,53,0.22) 50%, rgba(12,44,53,0.04) 100%)',
    titleClass: 'text-white',
    textClass: 'text-white/82',
    bodyClass: 'text-white/72',
    previewSurfaceClass: 'text-white',
  },
  'dark-soft': {
    overlay: 'linear-gradient(90deg, rgba(242,248,250,0.92) 0%, rgba(242,248,250,0.78) 28%, rgba(242,248,250,0.3) 56%, rgba(242,248,250,0.08) 100%)',
    titleClass: 'text-[#15323B]',
    textClass: 'text-[#183139]/88',
    bodyClass: 'text-[#183139]/74',
    previewSurfaceClass: 'text-[#15323B]',
  },
}
