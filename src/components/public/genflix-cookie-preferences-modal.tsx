import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import {
  COOKIE_CONSENT_STORAGE_KEY,
  createCookieConsentState,
  createDefaultCookieConsentPreferences,
  normalizeCookieConsentState,
  type CookieConsentPreferences,
} from '@/features/cookies/cookie-consent'

function PreferenceToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (nextValue: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-4 rounded-[24px] border px-4 py-4 text-left transition ${
        checked
          ? 'border-[#1398B7] bg-[#E8F6FA]'
          : 'border-[#D8E6EB] bg-white hover:border-[#1398B7]/40'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#15323b]">{title}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#5F7077]">{description}</span>
      </span>

      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? 'border-[#1398B7] bg-[#1398B7]' : 'border-[#D8E6EB] bg-[#EDF4F6]'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  )
}

export function GenflixCookiePreferencesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { state, setState } = useLocalStorageState<unknown>(COOKIE_CONSENT_STORAGE_KEY, null)
  const normalizedState = useMemo(() => normalizeCookieConsentState(state), [state])
  const [draft, setDraft] = useState<CookieConsentPreferences>(createDefaultCookieConsentPreferences())

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDraft(normalizedState?.preferences ?? createDefaultCookieConsentPreferences())
  }, [isOpen, normalizedState])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  function persist(preferences: CookieConsentPreferences) {
    setState(createCookieConsentState(preferences))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#061b21]/58 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[#F2F8FA] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
              Cookies e privacidade
            </p>
            <h2 className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
              Preferencias de cookies
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F7077]">
              Escolha quais cookies nao essenciais a GenFlix pode usar para analise, personalizacao e marketing.
              Os cookies essenciais continuam ativos para autenticar e manter a plataforma funcionando.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] text-[#5F7077] transition-colors hover:bg-white"
            aria-label="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="space-y-4">
            <PreferenceToggle
              title="Essenciais"
              description="Necessarios para login, seguranca, sess?o e operacao basica do site."
              checked
              disabled
              onChange={() => {}}
            />
            <PreferenceToggle
              title="Analiticos"
              description="Ajudam a entender uso da plataforma e identificar pontos de melhoria."
              checked={draft.analytics}
              onChange={(checked) => setDraft((current) => ({ ...current, analytics: checked }))}
            />
            <PreferenceToggle
              title="Personalizacao"
              description="Permitem adaptar partes da experi?ncia conforme seu comportamento."
              checked={draft.personalization}
              onChange={(checked) => setDraft((current) => ({ ...current, personalization: checked }))}
            />
            <PreferenceToggle
              title="Marketing"
              description="Usados para campanhas, mensuracao de anuncios e remarketing."
              checked={draft.marketing}
              onChange={(checked) => setDraft((current) => ({ ...current, marketing: checked }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#D8E6EB] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs font-semibold leading-5 text-[#5F7077]">
            Voce pode alterar estas escolhas depois, voltando para a pagina de cookies.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => persist(createDefaultCookieConsentPreferences())}
              className="h-11 rounded-[28px] border-[#D8E6EB] px-5 font-black text-[#15323b]"
            >
              Somente essenciais
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => persist({
                analytics: true,
                personalization: true,
                marketing: true,
              })}
              className="h-11 rounded-[28px] border-[#1398B7] bg-[#E8F6FA] px-5 font-black text-[#0A3640] hover:bg-[#D8EEF4]"
            >
              Aceitar todos
            </Button>

            <Button
              type="button"
              onClick={() => persist(draft)}
              className="h-11 rounded-[28px] bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 font-black text-white hover:opacity-95"
            >
              Salvar preferências
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
