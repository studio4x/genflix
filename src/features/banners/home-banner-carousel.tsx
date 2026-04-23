import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { fetchActiveSiteBanners } from '@/features/banners/api'
import { bannerThemeStyles } from '@/features/banners/presets'
import type { SiteBanner, SiteBannerCta, SiteBannerLayoutItem, SiteBannerLayoutKey } from '@/features/banners/types'
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

function toDesktopStyle(item: SiteBannerLayoutItem) {
  return {
    left: `${item.x}%`,
    top: `${item.y}%`,
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

function DesktopBannerContent({ banner }: { banner: SiteBanner }) {
  const theme = bannerThemeStyles[banner.themePreset]
  const titleStyle = getElementColors(banner, 'title')
  const subtitleStyle = getElementColors(banner, 'subtitle')
  const bodyStyle = getElementColors(banner, 'body')
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
      content: <h2 className={cn('text-[2.5rem] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-[3rem] md:text-[3.25rem]', theme.titleClass)} style={{ color: titleStyle.color }}>{banner.title}</h2>,
      shouldRender: isRenderableText(banner.title, banner.layoutDesktop.title),
    },
    {
      key: 'subtitle',
      item: banner.layoutDesktop.subtitle,
      content: <p className={cn('text-sm leading-7 sm:text-base', theme.textClass)} style={{ color: subtitleStyle.color }}>{banner.subtitle}</p>,
      shouldRender: isRenderableText(banner.subtitle, banner.layoutDesktop.subtitle),
    },
    {
      key: 'body',
      item: banner.layoutDesktop.body,
      content: <p className={cn('text-[15px] leading-7', theme.bodyClass)} style={{ color: bodyStyle.color }}>{banner.body}</p>,
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
          style={toDesktopStyle(element.item)}
        >
          {element.content}
        </div>
      ) : null)}
    </div>
  )
}

function MobileBannerContent({ banner }: { banner: SiteBanner }) {
  const theme = bannerThemeStyles[banner.themePreset]
  const titleStyle = getElementColors(banner, 'title')
  const subtitleStyle = getElementColors(banner, 'subtitle')
  const bodyStyle = getElementColors(banner, 'body')
  const primaryCtaStyle = getElementColors(banner, 'primaryCta')
  const secondaryCtaStyle = getElementColors(banner, 'secondaryCta')

  return (
    <div className="flex min-h-[480px] items-end px-4 py-10 sm:px-6 lg:hidden">
      <div className="max-w-[520px]">
        {isRenderableText(banner.title, banner.layoutDesktop.title) ? (
          <h2 className={cn('text-[2.2rem] font-extrabold leading-[0.94] tracking-[-0.05em] sm:text-[2.6rem]', theme.titleClass)} style={{ color: titleStyle.color }}>
            {banner.title}
          </h2>
        ) : null}
        {isRenderableText(banner.subtitle, banner.layoutDesktop.subtitle) ? (
          <p className={cn('mt-4 text-sm leading-7 sm:text-base', theme.textClass)} style={{ color: subtitleStyle.color }}>
            {banner.subtitle}
          </p>
        ) : null}
        {isRenderableText(banner.body, banner.layoutDesktop.body) ? (
          <p className={cn('mt-4 text-[15px] leading-7', theme.bodyClass)} style={{ color: bodyStyle.color }}>
            {banner.body}
          </p>
        ) : null}
        {(isRenderableCta(banner.primaryCta, banner.layoutDesktop.primaryCta) || isRenderableCta(banner.secondaryCta, banner.layoutDesktop.secondaryCta)) ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isRenderableCta(banner.primaryCta, banner.layoutDesktop.primaryCta) && banner.primaryCta ? <BannerLink cta={banner.primaryCta} className="h-12 px-5" customColors={{ buttonBackgroundColor: primaryCtaStyle.backgroundColor, buttonTextColor: primaryCtaStyle.color }} /> : null}
            {isRenderableCta(banner.secondaryCta, banner.layoutDesktop.secondaryCta) && banner.secondaryCta ? <BannerLink cta={banner.secondaryCta} className="h-12 px-5" customColors={{ buttonBackgroundColor: secondaryCtaStyle.backgroundColor, buttonTextColor: secondaryCtaStyle.color }} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function HomeBannerCarousel({
  fallback,
  autoplayIntervalMs = 6000,
}: {
  fallback: ReactNode
  autoplayIntervalMs?: number
}) {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    let isMounted = true

    void fetchActiveSiteBanners()
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
  }, [])

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

  const slides = useMemo(() => banners.filter((banner) => banner.isActive), [banners])

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
      <div className="relative min-h-[480px] sm:min-h-[520px]">
        {slides.map((banner, index) => {
          const theme = bannerThemeStyles[banner.themePreset]
          const isVisible = index === activeIndex

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
                className="absolute inset-0"
                style={{
                  backgroundImage: `${theme.overlay}, url(${banner.backgroundUrl})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }}
              />
              <div className="public-site-container relative h-full">
                <DesktopBannerContent banner={banner} />
                <MobileBannerContent banner={banner} />
              </div>
            </article>
          )
        })}
      </div>

      {slides.length > 1 ? (
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
      ) : null}
    </section>
  )
}
