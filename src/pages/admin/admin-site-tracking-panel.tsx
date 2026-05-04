import { useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { saveSiteContentEntry } from '@/features/site-editor/api'
import {
  defaultSiteTrackingSettings,
  fetchSiteTrackingSettings,
  normalizeSiteTracking,
  SITE_TRACKING_ENTRY_KEY,
  type SiteTrackingSettings,
} from '@/features/site-editor/site-tracking'

export function AdminSiteTrackingPanel() {
  const [tracking, setTracking] = useState<SiteTrackingSettings>(defaultSiteTrackingSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadTracking() {
      setIsLoading(true)

      try {
        if (isMounted) {
          setTracking(await fetchSiteTrackingSettings())
        }
      } catch {
        if (isMounted) {
          setTracking(defaultSiteTrackingSettings)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTracking()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const nextTracking = normalizeSiteTracking(tracking)
      await saveSiteContentEntry({
        pageKey: 'global',
        entryKey: SITE_TRACKING_ENTRY_KEY,
        entryType: 'json',
        value: nextTracking,
        schema: { kind: 'site-tracking' },
      })
      setTracking(nextTracking)
      setMessage('Configuracoes de rastreamento salvas com sucesso.')
    } catch (trackingError) {
      setError(trackingError instanceof Error ? trackingError.message : 'Nao foi possivel salvar as configuracoes de rastreamento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
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

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">GTM</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {tracking.gtmId || 'Nao configurado'}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">ID do container Google Tag Manager.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Meta Pixel</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {tracking.metaPixelId || 'Nao configurado'}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">ID do pixel para eventos de marketing.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Codigos livres</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {[tracking.customHeaderCode, tracking.customBodyCode, tracking.customFooterCode].filter((item) => item.trim() !== '').length}/3
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Header, body e footer personalizados.</p>
        </article>
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Google Tag Manager</span>
            <input
              value={tracking.gtmId}
              onChange={(event) => setTracking((current) => ({ ...current, gtmId: event.target.value }))}
              placeholder="GTM-XXXXXXX"
              className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Meta Pixel</span>
            <input
              value={tracking.metaPixelId}
              onChange={(event) => setTracking((current) => ({ ...current, metaPixelId: event.target.value }))}
              placeholder="123456789012345"
              className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Codigo customizado no header</span>
          <textarea
            value={tracking.customHeaderCode}
            onChange={(event) => setTracking((current) => ({ ...current, customHeaderCode: event.target.value }))}
            rows={6}
            placeholder="<script>...</script>"
            className="rounded-[18px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Codigo customizado no body</span>
          <textarea
            value={tracking.customBodyCode}
            onChange={(event) => setTracking((current) => ({ ...current, customBodyCode: event.target.value }))}
            rows={6}
            placeholder="HTML ou script a ser inserido no inicio do body"
            className="rounded-[18px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Codigo customizado no footer</span>
          <textarea
            value={tracking.customFooterCode}
            onChange={(event) => setTracking((current) => ({ ...current, customFooterCode: event.target.value }))}
            rows={6}
            placeholder="HTML ou script a ser inserido no final do body"
            className="rounded-[18px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || isSaving}
            onClick={() => setTracking(defaultSiteTrackingSettings)}
            className="rounded-none border-[#D8E6EB]"
          >
            Limpar campos
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isSaving}
            className="rounded-none bg-[#1398B7] font-black text-white hover:bg-[#0F7E99]"
          >
            {isSaving ? 'Salvando...' : 'Salvar configuracoes de rastreamento'}
          </Button>
        </div>
      </form>
    </div>
  )
}
