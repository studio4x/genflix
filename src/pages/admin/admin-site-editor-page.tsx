import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, History, RotateCcw, Save, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  clearPageOverrides,
  clearSiteContentEntryOverride,
  disableSiteEditorOverrides,
  fetchSiteContentVersions,
  fetchSiteEditorSettings,
  restoreSiteContentVersion,
  updateSiteEditorSettings,
} from '@/features/site-editor/api'
import type { SiteContentEntry, SiteContentVersion, SiteEditorSettings, SitePageKey } from '@/features/site-editor/types'
import { defaultSiteEditorSettings } from '@/features/site-editor/types'
import { supabase } from '@/services/supabase/client'

type SitePageRow = {
  id: string
  page_key: SitePageKey
  path: string
  title: string
  status: string
}

export function AdminSiteEditorPage() {
  const [settings, setSettings] = useState<SiteEditorSettings>(defaultSiteEditorSettings)
  const [pages, setPages] = useState<SitePageRow[]>([])
  const [entries, setEntries] = useState<SiteContentEntry[]>([])
  const [selectedPageKey, setSelectedPageKey] = useState<SitePageKey>('home')
  const [versions, setVersions] = useState<SiteContentVersion[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const pageEntries = useMemo(
    () => entries.filter((entry) => entry.page_key === selectedPageKey || entry.page_key === 'global'),
    [entries, selectedPageKey],
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const [nextSettings, pagesResult, entriesResult] = await Promise.all([
        fetchSiteEditorSettings(),
        supabase
          .from('site_pages')
          .select('id, page_key, path, title, status')
          .order('page_key', { ascending: true }),
        supabase
          .from('site_content_entries')
          .select('id, page_key, entry_key, entry_type, value, schema, is_enabled, updated_by, created_at, updated_at')
          .order('updated_at', { ascending: false }),
      ])

      if (pagesResult.error) throw pagesResult.error
      if (entriesResult.error) throw entriesResult.error

      setSettings(nextSettings)
      setPages((pagesResult.data ?? []) as SitePageRow[])
      setEntries((entriesResult.data ?? []) as SiteContentEntry[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o editor visual.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSettingsUpdate(input: Partial<Pick<SiteEditorSettings, 'is_enabled' | 'read_overrides_enabled' | 'editing_enabled' | 'fallback_mode'>>) {
    setIsSaving(true)
    setMessage(null)

    try {
      const nextSettings = await updateSiteEditorSettings(input)
      setSettings(nextSettings)
      setMessage('Configurações do editor visual atualizadas.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar as configurações.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDisableFallback() {
    setIsSaving(true)
    setMessage(null)

    try {
      const nextSettings = await disableSiteEditorOverrides()
      setSettings(nextSettings)
      setMessage('Editor desativado para leitura pública. O site voltou ao conteúdo original hardcoded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ativar o fallback original.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearEntry(entryId: string) {
    setIsSaving(true)
    setMessage(null)

    try {
      await clearSiteContentEntryOverride(entryId)
      await loadData()
      setMessage('Override do campo desativado. O fallback original voltou a valer para este campo.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível limpar o override.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearPage() {
    setIsSaving(true)
    setMessage(null)

    try {
      await clearPageOverrides(selectedPageKey)
      await loadData()
      setMessage('Overrides da página desativados. A página voltou ao conteúdo original.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a página.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLoadVersions(entryId: string) {
    setSelectedEntryId(entryId)
    setVersions([])

    try {
      setVersions(await fetchSiteContentVersions(entryId))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.')
    }
  }

  async function handleRestoreVersion(version: SiteContentVersion) {
    setIsSaving(true)
    setMessage(null)

    try {
      await restoreSiteContentVersion(version)
      await loadData()
      if (selectedEntryId) {
        setVersions(await fetchSiteContentVersions(selectedEntryId))
      }
      setMessage('Versão anterior restaurada e publicada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a versão.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Site</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Editor Visual</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
            Edite conteúdo do site público pelo frontend sem alterar a estrutura visual. O fallback hardcoded permanece preservado.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 text-sm font-black text-white"
        >
          Abrir site
        </Link>
      </header>

      {message ? (
        <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4 text-sm font-bold text-[#15323b]">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Editor</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{settings.is_enabled ? 'Ativo' : 'Desativado'}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Controla a camada CMS inteira.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Overrides públicos</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{settings.read_overrides_enabled ? 'Lendo' : 'Fallback'}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Se desligado, o site usa o conteúdo original.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Modo edição</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{settings.editing_enabled ? 'Liberado' : 'Bloqueado'}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Afeta apenas administradores.</p>
        </article>
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Campos salvos</p>
          <p className="mt-3 font-readex text-2xl font-semibold text-[#15323b]">{entries.length}</p>
          <p className="mt-2 text-sm font-semibold text-[#5F7077]">Overrides preservados para rollback.</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <article className="border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-rose-700" />
              <div>
                <h2 className="font-readex text-xl font-semibold text-rose-800">Fallback imediato</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-rose-700">
                  Esta ação não apaga dados. Ela apenas faz o site ignorar overrides e voltar ao conteúdo original do código.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void handleDisableFallback()}
              disabled={isSaving}
              className="mt-5 h-12 w-full rounded-none bg-rose-700 font-black text-white hover:bg-rose-800"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Desativar editor visual e voltar ao conteúdo original
            </Button>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Configurações</h2>
            <div className="mt-5 grid gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSettingsUpdate({ is_enabled: !settings.is_enabled })}
                className="h-11 rounded-none justify-start border-[#D8E6EB]"
              >
                {settings.is_enabled ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {settings.is_enabled ? 'Desativar camada CMS' : 'Ativar camada CMS'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSettingsUpdate({ read_overrides_enabled: !settings.read_overrides_enabled, fallback_mode: settings.read_overrides_enabled })}
                className="h-11 rounded-none justify-start border-[#D8E6EB]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {settings.read_overrides_enabled ? 'Usar fallback original' : 'Ler overrides salvos'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSettingsUpdate({ editing_enabled: !settings.editing_enabled })}
                className="h-11 rounded-none justify-start border-[#D8E6EB]"
              >
                <Save className="mr-2 h-4 w-4" />
                {settings.editing_enabled ? 'Bloquear edição inline' : 'Liberar edição inline'}
              </Button>
            </div>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Páginas</h2>
            <div className="mt-4 grid gap-2">
              {pages.map((page) => (
                <button
                  type="button"
                  key={page.page_key}
                  onClick={() => setSelectedPageKey(page.page_key)}
                  className={`border px-4 py-3 text-left text-sm font-black ${
                    selectedPageKey === page.page_key
                      ? 'border-[#1398B7] bg-[#E8F6FA] text-[#0A3640]'
                      : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:bg-[#F2F7F9]'
                  }`}
                >
                  {page.title}
                  <span className="ml-2 text-xs font-semibold opacity-70">{page.path}</span>
                </button>
              ))}
            </div>
          </article>
        </div>

        <section className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Overrides</p>
              <h2 className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{selectedPageKey}</h2>
            </div>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => void handleClearPage()} className="rounded-none border-[#D8E6EB]">
              Restaurar conteúdo original desta página
            </Button>
          </div>

          {isLoading ? (
            <p className="p-5 text-sm font-semibold text-[#5F7077]">Carregando...</p>
          ) : pageEntries.length === 0 ? (
            <p className="p-5 text-sm font-semibold text-[#5F7077]">
              Nenhum override salvo para esta página. O site está usando exatamente o conteúdo original do código.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                  <tr>
                    <th className="px-4 py-3">Campo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Atualizado</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E6EB]">
                  {pageEntries.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-4 py-3 font-black text-[#15323b]">{entry.entry_key}</td>
                      <td className="px-4 py-3 text-xs font-black uppercase text-[#5F7077]">{entry.entry_type}</td>
                      <td className="px-4 py-3 text-xs font-black uppercase text-[#0A3640]">{entry.is_enabled ? 'Ativo' : 'Inativo'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#5F7077]">{new Date(entry.updated_at).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void handleLoadVersions(entry.id)} className="inline-flex items-center gap-1 border border-[#D8E6EB] px-3 py-2 text-xs font-black text-[#0A3640] hover:bg-[#F2F7F9]">
                            <History className="h-3.5 w-3.5" />
                            Histórico
                          </button>
                          <button type="button" onClick={() => void handleClearEntry(entry.id)} className="border border-[#D8E6EB] px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50">
                            Limpar override
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedEntryId ? (
            <div className="mt-6 border border-[#D8E6EB] bg-[#F2F7F9] p-4">
              <h3 className="font-readex text-lg font-semibold text-[#15323b]">Histórico do campo</h3>
              <div className="mt-3 grid gap-2">
                {versions.length === 0 ? (
                  <p className="text-sm font-semibold text-[#5F7077]">Nenhuma versão registrada.</p>
                ) : versions.map((version) => (
                  <div key={version.id} className="border border-[#D8E6EB] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">
                        {new Date(version.created_at).toLocaleString('pt-BR')} - {version.change_reason ?? 'alteração'}
                      </p>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleRestoreVersion(version)}
                        className="border border-[#D8E6EB] px-3 py-1.5 text-xs font-black text-[#0A3640] hover:bg-[#F2F7F9]"
                      >
                        Restaurar versão anterior
                      </button>
                    </div>
                    <pre className="mt-2 max-h-36 overflow-auto bg-[#F2F7F9] p-3 text-xs text-[#15323b]">
                      {JSON.stringify(version.next_value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  )
}
