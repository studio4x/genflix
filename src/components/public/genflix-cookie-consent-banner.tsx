import { Link } from 'react-router-dom';
import { GenflixCtaButton } from '@/components/public/genflix-cta-button';
import { COOKIE_CONSENT_STORAGE_KEY, createCookieConsentState, normalizeCookieConsentState, } from '@/features/cookies/cookie-consent';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
export function GenflixCookieConsentBanner() {
    const { state, setState } = useLocalStorageState<unknown>(COOKIE_CONSENT_STORAGE_KEY, null);
    const consentState = normalizeCookieConsentState(state);
    if (consentState !== null) {
        return null;
    }
    return (<div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-[1100px] rounded-[28px] border border-[#D8E6EB] bg-white p-4 shadow-[0_24px_60px_rgba(21,50,59,0.14)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[760px] space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
              Cookies e privacidade
            </p>
            <p className="text-sm leading-7 text-[#183139] sm:text-[15px]">Usamos cookies essenciais para autenticao, segurana, manutencao de sessao e funcionamento da plataforma.
              Ao continuar navegando, voc concorda com o uso descrito na nossa politica de cookies.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <GenflixCtaButton asChild tone="warm" className="pointer-events-auto h-11 px-5 text-[13px] font-bold uppercase tracking-[0.12em]">
              <Link to="/cookies">Ver politica</Link>
            </GenflixCtaButton>

            <GenflixCtaButton asChild tone="surface" className="pointer-events-auto h-11 px-5 text-[13px] font-bold uppercase tracking-[0.12em]">
              <Link to="/cookiespreferences=1">Preferencias</Link>
            </GenflixCtaButton>

            <button type="button" onClick={() => setState(createCookieConsentState({
            analytics: true,
            personalization: true,
            marketing: true,
        }))} className="pointer-events-auto inline-flex h-11 items-center justify-center rounded-[32px] border border-[#1398B7] bg-[#1398B7] px-5 text-[13px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#0F7E99]">
              Aceitar cookies
            </button>
          </div>
        </div>
      </div>
    </div>);
}
