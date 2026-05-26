import { useMemo, useState } from 'react'

import { useBranding } from '@/app/providers/branding-provider'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { createBrandingAssetValue } from '@/features/branding/api'
import { brandingEntryKeys, type BrandingSlotKey } from '@/features/branding/types'
import { saveSiteContentEntry, uploadSiteAsset } from '@/features/site-editor/api'
import { AdminNarrationCredentialsPanel } from '@/pages/admin/admin-narration-credentials-panel'
import { AdminSiteTrackingPanel } from '@/pages/admin/admin-site-tracking-panel'

const brandingCards: Array<{
  slot: BrandingSlotKey
  badge: string
  title: string
  description: string
  accept: string
  previewTone: 'light' | 'dark' | 'favicon'
}> = [
  {
    slot: 'logoLight',
    badge: 'Uso em fundo escuro',
    title: 'Logotipo light',
    description: 'Aplicado automaticamente em headers, rodapes e seções com fundo escuro.',
    accept: '.svg,.png,.webp,.jpg,.jpeg,image/*',
    previewTone: 'light',
  },
  {
    slot: 'logoDark',
    badge: 'Uso em fundo claro',
    title: 'Logotipo dark',
    description: 'Aplicado automaticamente em headers claros, admin e superfícies claras do site.',
    accept: '.svg,.png,.webp,.jpg,.jpeg,image/*',
    previewTone: 'dark',
  },
  {
    slot: 'favicon',
    badge: 'Navegador',
    title: 'Favicon',
    description: 'Usado na aba do navegador e em atalhos quando a aplicação é aberta.',
    accept: '.svg,.png,.ico,image/*',
    previewTone: 'favicon',
  },
]

export function AdminBrandingSettingsPage() {
  const { branding, setBrandingAsset } = useBranding()
  const [activeTab, setActiveTab] = useState<'branding' | 'tracking' | 'narration'>('branding')
  const [uploadingSlot, setUploadingSlot] = useState<BrandingSlotKey | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => ({
    logoLight: Boolean(branding.logoLight?.src),
    logoDark: Boolean(branding.logoDark?.src),
    favicon: Boolean(branding.favicon?.src),
  }), [branding])

  async function handleUpload(slot: BrandingSlotKey, file: File | null) {
    if (!file) {
      return
    }

    setUploadingSlot(slot)
    setMessage(null)
    setError(null)

    try {
      const asset = await uploadSiteAsset(file, {
        alt: file.name,
        pageKey: 'global',
        entryKey: brandingEntryKeys[slot],
      })

      const value = createBrandingAssetValue({
        src: asset.public_url ?? '',
        alt: asset.alt ?? file.name,
        assetId: asset.id,
        mimeType: asset.mime_type,
      })

      await saveSiteContentEntry({
        pageKey: 'global',
        entryKey: brandingEntryKeys[slot],
        entryType: 'image',
        value,
        schema: {
          kind: 'branding-asset',
          slot,
        },
      })

      setBrandingAsset(slot, value)
      setMessage(`Arquivo publicado em ${slot}.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nao foi possivel salvar o arquivo de branding.')
    } finally {
      setUploadingSlot(null)
    }
  }

  return (
    <div className="animate-in space-y-7 fade-in duration-500">
      <header className="space-y-3 border-b border-[#D8E6EB] pb-6">
        <div className="inline-flex border border-[#D8E6EB] bg-[#E8F6FA] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
          Configuracoes do site
        </div>
        <h2 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Branding e logotipos</h2>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
          Envie aqui os arquivos oficiais da marca. O sistema escolhe automaticamente o logotipo light ou dark de
          acordo com o fundo em cada area da plataforma.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`inline-flex h-11 items-center justify-center rounded-full border px-5 text-xs font-black uppercase tracking-[0.16em] ${
              activeTab === 'branding'
                ? 'border-[#1398B7] bg-[#1398B7] text-white'
                : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:bg-[#F2F7F9]'
            }`}
          >
            Branding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`inline-flex h-11 items-center justify-center rounded-full border px-5 text-xs font-black uppercase tracking-[0.16em] ${
              activeTab === 'tracking'
                ? 'border-[#1398B7] bg-[#1398B7] text-white'
                : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:bg-[#F2F7F9]'
            }`}
          >
            Rastreamento e scripts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('narration')}
            className={`inline-flex h-11 items-center justify-center rounded-full border px-5 text-xs font-black uppercase tracking-[0.16em] ${
              activeTab === 'narration'
                ? 'border-[#1398B7] bg-[#1398B7] text-white'
                : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:bg-[#F2F7F9]'
            }`}
          >
            IA de narracao
          </button>
        </div>
      </header>

      {error ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      {activeTab === 'branding' ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Status</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {Object.values(summary).filter(Boolean).length}/3
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Assets de branding publicados</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Selecao dinamica</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">Automatica</p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Light em fundo escuro, dark em fundo claro.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Favicon</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {summary.favicon ? 'Ativo' : 'Padrao'}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Atualizado em runtime no navegador.</p>
        </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
        {brandingCards.map((card) => {
          const currentAsset = branding[card.slot]
          const isUploading = uploadingSlot === card.slot

          return (
            <article key={card.slot} className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{card.badge}</p>
              <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">{card.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#5F7077]">{card.description}</p>

              <div
                className={[
                  'mt-5 flex min-h-[132px] items-center justify-center overflow-hidden rounded-[28px] border px-6 py-6',
                  card.previewTone === 'light'
                    ? 'border-[#11434D] bg-[linear-gradient(180deg,#1C7082_0%,#0F5562_100%)]'
                    : card.previewTone === 'dark'
                      ? 'border-[#D8E6EB] bg-[#F2F8FA]'
                      : 'border-[#D8E6EB] bg-[#F7FBFC]',
                ].join(' ')}
              >
                {card.previewTone === 'favicon' ? (
                  currentAsset?.src ? (
                    <img src={currentAsset.src} alt={currentAsset.alt || 'Favicon'} className="h-16 w-16 rounded-[18px] object-contain shadow-sm" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-dashed border-[#B8CDD4] text-[11px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                      Padrao
                    </div>
                  )
                ) : (
                  <GenflixLogo theme={card.previewTone} className="origin-center scale-110" />
                )}
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-[22px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Arquivo atual</p>
                  <p className="mt-2 truncate text-sm font-semibold text-[#15323b]">
                    {currentAsset?.src ? currentAsset.alt || currentAsset.src : 'Nenhum arquivo publicado ainda.'}
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">
                    Enviar novo arquivo
                  </span>
                  <input
                    type="file"
                    accept={card.accept}
                    disabled={isUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      void handleUpload(card.slot, file)
                      event.currentTarget.value = ''
                    }}
                    className="block w-full cursor-pointer border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] file:mr-4 file:border-0 file:bg-[#E8F6FA] file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[0.18em] file:text-[#1398B7]"
                  />
                </label>

                <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-xs font-semibold text-[#5F7077]">
                  {isUploading ? 'Enviando e publicando arquivo...' : 'Ao escolher um arquivo, o upload e a publicacao acontecem automaticamente.'}
                </div>
              </div>
            </article>
          )
        })}
          </section>
        </>
      ) : null}

      {activeTab === 'tracking' ? (
        <AdminSiteTrackingPanel />
      ) : null}

      {activeTab === 'narration' ? (
        <AdminNarrationCredentialsPanel />
      ) : null}
    </div>
  )
}
