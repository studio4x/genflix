import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { fetchActiveSiteBanners } from '@/features/banners/api'
import { bannerThemeStyles } from '@/features/banners/presets'
import {
  DESKTOP_BANNER_DESIGN_WIDTH,
  MOBILE_BANNER_DESIGN_WIDTH,
  type SiteBanner,
  type SiteBannerCta,
  type SiteBannerLayoutItem,
  type SiteBannerLayoutKey,
  type SiteBannerLocationKey,
} from '@/features/banners/types'
import { cn } from '@/lib/utils'

function getElementColors(banner: SiteBanner, key: SiteBannerLayoutKey) {
  const theme = bannerThemeStyles[banner.themePreset]
  const custom = banner.elementStyles[key]

  if (key === 'title') {
    return { color: custom.textColor || theme.titleColor }
  }

  if (key === 'subtitle') {
    return { color: custom.textColor || theme.textColor }
  }

  if (key === 'body') {
    return { color: custom.textColor || theme.bodyColor }
  }

  return {
    color: custom.textColor || undefined,
    backgroundColor: custom.backgroundColor || undefined,
  }
}

function getTextTypographyStyle(banner: SiteBanner, key: 'title' | 'subtitle' | 'body') {
  const style = banner.elementStyles[key]
  return {
    fontFamily: style.fontFamily || undefined,
    fontSize: typeof style.fontSize === 'number' ? `${style.fontSize}px` : undefined,
    fontWeight: typeof style.fontWeight === 'number' ? style.fontWeight : undefined,
    letterSpacing: typeof style.letterSpacing === 'number' ? `${style.letterSpacing}px` : undefined,
    textAlign: style.textAlign || undefined,
  } as const
}

function getVerticalAnchorTransform(verticalAlign: SiteBanner['elementStyles']['title']['verticalAlign']) {
  if (verticalAlign === 'middle') {
    return 'translateY(-50%)'
  }

  if (verticalAlign === 'bottom') {
    return 'translateY(-100%)'
  }

  return 'translateY(0)'
}

function toDesktopStyle(item: SiteBannerLayoutItem, scaleFactor: number) {
  return {
    left: `${item.x * scaleFactor}px`,
    top: `${item.y}px`,
    width: `${item.width}%`,
    zIndex: item.zIndex,
  }
}

function isRenderableText(value: string, item: SiteBannerLayoutItem) {
  return item.visible && value.trim().length > 0
}

function isRenderableCta(value: SiteBannerCta | null, item: SiteBannerLayoutItem) {
  return item.visible && value?.visible === true && value.label.trim().length > 0 && value.href.trim().length > 0
}

function BannerLink({
  cta,
  className,
  customColors,
}: {
  cta: SiteBannerCta
  className?: string
  customColors?: {
    buttonBackgroundColor?: string
    buttonTextColor?: string
  }
}) {
  if (cta.isInternal) {
    return (
      <GenflixCtaButton asChild tone={cta.tonePreset} className={className} customColors={customColors}>
        <Link to={cta.href}>{cta.label}</Link>
      </GenflixCtaButton>
    )
  }

  return (
    <GenflixCtaButton asChild tone={cta.tonePreset} className={className} customColors={customColors}>
      <a href={cta.href} target={cta.openInNewTab ? '_blank' : undefined} rel={cta.openInNewTab ? 'noreferrer' : undefined}>
        {cta.label}
      </a>
    </GenflixCtaButton>
  )
}

function DesktopBannerContent({ banner, scaleFactor }: { banner: SiteBanner; scaleFactor: number }) {
  const theme = bannerThemeStyles[banner.themePreset]
  const titleStyle = getElementColors(banner, 'title')
  const subtitleStyle = getElementColors(banner, 'subtitle')
  const bodyStyle = getElementColors(banner, 'body')
  const titleTypography = getTextTypographyStyle(banner, 'title')
  const subtitleTypography = getTextTypographyStyle(banner, 'subtitle')
  const bodyTypography = getTextTypographyStyle(banner, 'body')
  const primaryCtaStyle = getElementColors(banner, 'primaryCta')
  const secondaryCtaStyle = getElementColors(banner, 'secondaryCta')
  const desktopElements: Array<{
    key: SiteBannerLayoutKey
    item: SiteBannerLayoutItem
    content: ReactNode
    shouldRender: boolean
  }> = [
    {
      key: 'title',
      item: banner.layoutDesktop.title,
      content: <h2 className={cn('text-[2.5rem] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-[3rem] md:text-[3.25rem]', theme.titleClass)} style={{ color: titleStyle.color, ...titleTypography }}>{banner.title}</h2>,
      shouldRender: isRenderableText(banner.title, banner.layoutDesktop.title),
    },
    {
      key: 'subtitle',
      item: banner.layoutDesktop.subtitle,
      content: <p className={cn('text-sm leading-7 sm:text-base', theme.textClass)} style={{ color: subtitleStyle.color, ...subtitleTypography }}>{banner.subtitle}</p>,
      shouldRender: isRenderableText(banner.subtitle, banner.layoutDesktop.subtitle),
    },
    {
      key: 'body',
      item: banner.layoutDesktop.body,
      content: <p className={cn('text-[15px] leading-7', theme.bodyClass)} style={{ color: bodyStyle.color, ...bodyTypography }}>{banner.body}</p>,
      shouldRender: isRenderableText(banner.body, banner.layoutDesktop.body),
    },
    {
      key: 'primaryCta',
      item: banner.layoutDesktop.primaryCta,
      content: banner.primaryCta ? <BannerLink cta={banner.primaryCta} className="h-12 w-full justify-between px-5" customColors={{ buttonBackgroundColor: primaryCtaStyle.backgroundColor, buttonTextColor: primaryCtaStyle.color }} /> : null,
      shouldRender: isRenderableCta(banner.primaryCta, banner.layoutDesktop.primaryCta),
    },
    {
      key: 'secondaryCta',
      item: banner.layoutDesktop.secondaryCta,
      content: banner.secondaryCta ? <BannerLink cta={banner.secondaryCta} className="h-12 w-full justify-between px-5" customColors={{ buttonBackgroundColor: secondaryCtaStyle.backgroundColor, buttonTextColor: secondaryCtaStyle.color }} /> : null,
      shouldRender: isRenderableCta(banner.secondaryCta, banner.layoutDesktop.secondaryCta),
    },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      {desktopElements.map((element) => element.shouldRender ? (
        <div
          key={element.key}
          className="pointer-events-auto absolute"
          style={{
            ...toDesktopStyle(element.item, scaleFactor),
            transform: getVerticalAnchorTransform(banner.elementStyles[element.key].verticalAlign),
          }}
        >
          {element.content}
        </div>
      ) : null)}
    </div>
  )
}

function MobileBannerContent({ banner, scaleFactor }: { banner: SiteBanner; scaleFactor: number }) {
  const theme = bannerThemeStyles[banner.themePreset]
  const titleStyle = getElementColors(banner, 'title')
  const subtitleStyle = getElementColors(banner, 'subtitle')
  const bodyStyle = getElementColors(banner, 'body')
  const titleTypography = getTextTypographyStyle(banner, 'title')
  const subtitleTypography = getTextTypographyStyle(banner, 'subtitle')
  const bodyTypography = getTextTypographyStyle(banner, 'body')
  const primaryCtaStyle = getElementColors(banner, 'primaryCta')
  const secondaryCtaStyle = getElementColors(banner, 'secondaryCta')
  const mobileElements: Array<{
    key: SiteBannerLayoutKey
    item: SiteBannerLayoutItem
    content: ReactNode
    shouldRender: boolean
  }> = [
    {
      key: 'title',
      item: banner.layoutMobile.title,
      content: <h2 className={cn('text-[2.2rem] font-extrabold leading-[0.94] tracking-[-0.05em] sm:text-[2.6rem]', theme.titleClass)} style={{ color: titleStyle.color, ...titleTypography }}>{banner.title}</h2>,
      shouldRender: isRenderableText(banner.title, banner.layoutMobile.title),
    },
    {
      key: 'subtitle',
      item: banner.layoutMobile.subtitle,
      content: <p className={cn('text-sm leading-7 sm:text-base', theme.textClass)} style={{ color: subtitleStyle.color, ...subtitleTypography }}>{banner.subtitle}</p>,
      shouldRender: isRenderableText(banner.subtitle, banner.layoutMobile.subtitle),
    },
    {
      key: 'body',
      item: banner.layoutMobile.body,
      content: <p className={cn('text-[15px] leading-7', theme.bodyClass)} style={{ color: bodyStyle.color, ...bodyTypography }}>{banner.body}</p>,
      shouldRender: isRenderableText(banner.body, banner.layoutMobile.body),
    },
    {
      key: 'primaryCta',
      item: banner.layoutMobile.primaryCta,
      content: banner.primaryCta ? <BannerLink cta={banner.primaryCta} className="h-12 w-full justify-between px-5" customColors={{ buttonBackgroundColor: primaryCtaStyle.backgroundColor, buttonTextColor: primaryCtaStyle.color }} /> : null,
      shouldRender: isRenderableCta(banner.primaryCta, banner.layoutMobile.primaryCta),
    },
    {
      key: 'secondaryCta',
      item: banner.layoutMobile.secondaryCta,
      content: banner.secondaryCta ? <BannerLink cta={banner.secondaryCta} className="h-12 w-full justify-between px-5" customColors={{ buttonBackgroundColor: secondaryCtaStyle.backgroundColor, buttonTextColor: secondaryCtaStyle.color }} /> : null,
      shouldRender: isRenderableCta(banner.secondaryCta, banner.layoutMobile.secondaryCta),
    },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 lg:hidden">
      {mobileElements.map((element) => element.shouldRender ? (
        <div
          key={element.key}
          className="pointer-events-auto absolute"
          style={{
            ...toDesktopStyle(element.item, scaleFactor),
            transform: getVerticalAnchorTransform(banner.elementStyles[element.key].verticalAlign),
          }}
        >
          {element.content}
        </div>
      ) : null)}
    </div>
  )
}

export function HomeBannerCarousel({
  fallback,
  autoplayIntervalMs = 6000,
  locationKey = 'home-hero',
}: {
  fallback: ReactNode
  autoplayIntervalMs?: number
  locationKey?: SiteBannerLocationKey
}) {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [contentWidth, setContentWidth] = useState(0)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    let isMounted = true

    void fetchActiveSiteBanners(locationKey)
      .then((rows) => {
        if (isMounted) {
          setBanners(rows)
        }
      })
      .catch(() => {
        if (isMounted) {
          setBanners([])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [locationKey])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyPreference = () => setPrefersReducedMotion(mediaQuery.matches)

    applyPreference()
    mediaQuery.addEventListener('change', applyPreference)
    return () => mediaQuery.removeEventListener('change', applyPreference)
  }, [])

  useEffect(() => {
    if (activeIndex > banners.length - 1) {
      setActiveIndex(0)
    }
  }, [activeIndex, banners.length])

  useEffect(() => {
    if (banners.length <= 1 || prefersReducedMotion || isPaused) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length)
    }, autoplayIntervalMs)

    return () => window.clearInterval(interval)
  }, [activeIndex, autoplayIntervalMs, banners.length, isPaused, prefersReducedMotion])

  useLayoutEffect(() => {
    const node = contentRef.current
    if (!node) {
      return
    }

    const updateWidth = () => {
      setContentWidth(node.getBoundingClientRect().width)
    }

    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(() => {
      updateWidth()
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  const slides = useMemo(() => banners.filter((banner) => banner.isActive), [banners])
  const activeSlide = slides[activeIndex] ?? slides[0] ?? null
  const desktopScaleFactor = contentWidth > 0 ? contentWidth / DESKTOP_BANNER_DESIGN_WIDTH : 1
  const mobileScaleFactor = contentWidth > 0 ? contentWidth / MOBILE_BANNER_DESIGN_WIDTH : 1
  const getBackgroundImage = (overlay: string, backgroundUrl: string) => (
    overlay ? `${overlay}, url(${backgroundUrl})` : `url(${backgroundUrl})`
  )

  function goToSlide(index: number) {
    setActiveIndex(index)
  }

  function goToNext(delta: 1 | -1) {
    setActiveIndex((current) => {
      const nextIndex = current + delta
      if (nextIndex < 0) {
        return slides.length - 1
      }
      if (nextIndex >= slides.length) {
        return 0
      }
      return nextIndex
    })
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const startX = touchStartXRef.current
    const endX = event.changedTouches[0]?.clientX ?? null
    touchStartXRef.current = null

    if (startX === null || endX === null) {
      return
    }

    const delta = endX - startX
    if (Math.abs(delta) < 48) {
      return
    }

    goToNext(delta > 0 ? -1 : 1)
  }

  if (isLoading || slides.length === 0) {
    return <>{fallback}</>
  }

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Banner principal da home"
    >
      <div
        className="home-banner-carousel-track relative"
        style={{
          ['--banner-mobile-height' as string]: `${activeSlide?.heightMobile ?? 560}px`,
          ['--banner-desktop-height' as string]: `${activeSlide?.heightDesktop ?? 760}px`,
        }}
      >
        {slides.map((banner, index) => {
          const theme = bannerThemeStyles[banner.themePreset]
          const isVisible = index === activeIndex
          const desktopBackgroundUrl = banner.backgroundUrl
          const mobileBackgroundUrl = banner.backgroundUrlMobile || banner.backgroundUrl

          return (
            <article
              key={banner.id}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 ease-out',
                isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              aria-hidden={!isVisible}
              >
              <div
                className="absolute inset-0 hidden lg:block"
                style={{
                  backgroundImage: getBackgroundImage(theme.overlay, desktopBackgroundUrl),
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }}
              />
              <div
                className="absolute inset-0 lg:hidden"
                style={{
                  backgroundImage: getBackgroundImage(theme.overlay, mobileBackgroundUrl),
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }}
              />
              <div ref={contentRef} className="public-site-container relative h-full">
                <DesktopBannerContent banner={banner} scaleFactor={desktopScaleFactor} />
                <MobileBannerContent banner={banner} scaleFactor={mobileScaleFactor} />
              </div>
            </article>
          )
        })}
      </div>

      {slides.length > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-3 sm:pl-4">
            <button
              type="button"
              onClick={() => goToNext(-1)}
              aria-label="Banner anterior"
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-[#0B2630]/45 text-white backdrop-blur-sm transition-colors hover:bg-[#0B2630]/65"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-3 sm:pr-4">
            <button
              type="button"
              onClick={() => goToNext(1)}
              aria-label="Próximo banner"
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-[#0B2630]/45 text-white backdrop-blur-sm transition-colors hover:bg-[#0B2630]/65"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/18 bg-[#0B2630]/32 px-3 py-2 backdrop-blur-sm">
              {slides.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => goToSlide(index)}
                  aria-label={`Ir para o banner ${index + 1}`}
                  aria-current={index === activeIndex}
                  className={cn(
                    'h-2.5 rounded-full transition-all',
                    index === activeIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/42 hover:bg-white/68',
                  )}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
