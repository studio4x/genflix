import { useEffect, useState, type ReactNode } from 'react'

import { fetchSiteBannerCarouselTargetLocationKeys } from '@/features/banners/api'
import { HomeBannerCarousel } from '@/features/banners/home-banner-carousel'
import type { SiteBannerLocationKey, SiteBannerPlacementKey } from '@/features/banners/types'
import type { SitePageKey } from '@/features/site-editor/types'

interface BannerPlacementSlotProps {
  pageKey: SitePageKey
  placementKey: SiteBannerPlacementKey
  fallback?: ReactNode
}

export function BannerPlacementSlot({
  pageKey,
  placementKey,
  fallback = null,
}: BannerPlacementSlotProps) {
  const [locationKeys, setLocationKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    void fetchSiteBannerCarouselTargetLocationKeys({ pageKey, placementKey })
      .then((keys) => {
        if (isMounted) {
          setLocationKeys(keys)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocationKeys([])
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
  }, [pageKey, placementKey])

  if (isLoading) {
    return <>{fallback}</>
  }

  if (locationKeys.length === 0) {
    return <>{fallback}</>
  }

  return (
    <>
      {locationKeys.map((locationKey) => (
        <HomeBannerCarousel
          key={locationKey}
          locationKey={locationKey as SiteBannerLocationKey}
          fallback={fallback}
        />
      ))}
    </>
  )
}
