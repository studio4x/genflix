import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'

type CookieConsentState = {
  acceptedAt: string
}

const COOKIE_CONSENT_STORAGE_KEY = 'genflix_cookie_consent_v1'

export function GenflixCookieConsentBanner() {
  const { state, setState } = useLocalStorageState<CookieConsentState | null>(COOKIE_CONSENT_STORAGE_KEY, null)
  const [bannerOffset, setBannerOffset] = useState('128px')
  const isVisible = state === null

  useEffect(() => {
    function updateBannerOffset() {
      setBannerOffset(window.innerWidth < 640 ? '184px' : '128px')
    }

    updateBannerOffset()
    window.addEventListener('resize', updateBannerOffset)

    return () => {
      window.removeEventListener('resize', updateBannerOffset)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (!isVisible) {
      document.body.style.paddingBottom = ''
      return
    }

    const previousPaddingBottom = document.body.style.paddingBottom
    document.body.style.paddingBottom = bannerOffset

    return () => {
      document.body.style.paddingBottom = previousPaddingBottom
    }
  }, [bannerOffset, isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-[1100px] rounded-[28px] border border-[#D8E6EB] bg-white/96 p-4 shadow-[0_24px_60px_rgba(21,50,59,0.14)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[760px] space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
              Cookies e privacidade
            </p>
            <p className="text-sm leading-7 text-[#183139] sm:text-[15px]">
              Usamos cookies essenciais para autenticação, segurança, manutenção de sessão e funcionamento da plataforma.
              Ao continuar navegando, você concorda com o uso descrito na nossa política de cookies.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <GenflixCtaButton
              asChild
              tone="surface"
              className="pointer-events-auto h-11 px-5 text-[13px] font-bold uppercase tracking-[0.12em]"
            >
              <Link to="/cookies">Ver política</Link>
            </GenflixCtaButton>

            <button
              type="button"
              onClick={() => setState({ acceptedAt: new Date().toISOString() })}
              className="pointer-events-auto inline-flex h-11 items-center justify-center rounded-[32px] border border-[#1398B7] bg-[#1398B7] px-5 text-[13px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#0F7E99]"
            >
              Aceitar cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
