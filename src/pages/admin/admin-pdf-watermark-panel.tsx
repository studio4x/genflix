import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { GenflixLogo } from '@/components/public/genflix-logo';
import { Button } from '@/components/ui/button';
import { fetchPdfWatermarkSettings, updatePdfWatermarkSettings } from '@/features/branding/api';
import type { PdfWatermarkSettingsView } from '@/features/branding/types';
import { uploadSiteAsset } from '@/features/site-editor/api';
function emptyWatermarkSettings(): PdfWatermarkSettingsView {
    return {
        id: 1,
        logo_asset_id: null,
        opacity_percent: 8,
        size_percent: 100,
        updated_by: null,
        created_at: '',
        updated_at: '',
        logo: null,
    };
}
export function AdminPdfWatermarkPanel() {
    const [settings, setSettings] = useState<PdfWatermarkSettingsView>(emptyWatermarkSettings);
    const [draftOpacity, setDraftOpacity] = useState(8);
    const [draftSize, setDraftSize] = useState(100);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [clearLogoRequested, setClearLogoRequested] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const currentLogo = useMemo(() => {
        if (selectedFile && previewUrl) {
            return {
                src: previewUrl,
                alt: selectedFile.name,
            };
        }
        if (clearLogoRequested) {
            return null;
        }
        return settings.logo;
    }, [clearLogoRequested, previewUrl, selectedFile, settings.logo]);
    const hasPendingChanges = Boolean(selectedFile)
        || clearLogoRequested
        || draftOpacity !== settings.opacity_percent
        || draftSize !== settings.size_percent;
    useEffect(() => {
        let active = true;
        void (async () => {
            setIsLoading(true);
            setError(null);
            try {
                const nextSettings = await fetchPdfWatermarkSettings();
                if (!active) {
                    return;
                }
                setSettings(nextSettings);
                setDraftOpacity(nextSettings.opacity_percent);
                setDraftSize(nextSettings.size_percent);
                setSelectedFile(null);
                setPreviewUrl(null);
                setClearLogoRequested(false);
            }
            catch (loadError) {
                if (!active) {
                    return;
                }
                setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar a configuracao da marca dagua.');
            }
            finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        })();
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);
    function handleFileChange(file: File | null) {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(file);
        setClearLogoRequested(false);
        setPreviewUrl(file ? URL.createObjectURL(file) : null);
    }
    async function handleSave() {
        setIsSaving(true);
        setError(null);
        setMessage(null);
        try {
            let nextLogoAssetId = settings.logo_asset_id;
            let nextLogo = settings.logo;
            if (selectedFile) {
                const asset = await uploadSiteAsset(selectedFile, {
                    alt: selectedFile.name,
                    pageKey: 'global',
                    entryKey: 'global.branding.pdfWatermark',
                });
                nextLogoAssetId = asset.id;
                nextLogo = {
                    src: asset.public_url ?? '',
                    alt: asset.alt ?? selectedFile.name,
                    asset_id: asset.id,
                    mime_type: asset.mime_type,
                };
            }
            else if (clearLogoRequested) {
                nextLogoAssetId = null;
                nextLogo = null;
            }
            const saved = await updatePdfWatermarkSettings({
                logoAssetId: nextLogoAssetId,
                opacityPercent: draftOpacity,
                sizePercent: draftSize,
            });
            setSettings({
                ...saved,
                logo: nextLogo ?? saved.logo,
            });
            setSelectedFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
            setClearLogoRequested(false);
            setMessage('Configuracao da marca dagua atualizada com sucesso.');
        }
        catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar a configuracao da marca dagua.');
        }
        finally {
            setIsSaving(false);
        }
    }
    function handleRestoreDefault() {
        handleFileChange(null);
        setClearLogoRequested(true);
        setDraftOpacity(8);
        setDraftSize(100);
    }
    if (isLoading) {
        return (<div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] text-sm font-semibold text-[#5F7077]">
            Carregando configuracao da marca dagua...
          </div>);
    }
    return (<div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Marca dagua do PDF</p>
          <h3 className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            Logo, transparência e tamanho
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5F7077]">
            Esta configuracao e aplicada quando o PDF do modulo e gerado automaticamente sem um arquivo base enviado.
            O logo escolhido abaixo vira a marca d'água padrão do documento.
          </p>

          {error ? (<div className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>) : null}
          {message ? (<div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Logo atual</p>
              <p className="mt-2 text-sm font-semibold text-[#15323b]">{currentLogo?.alt || 'Padrão GenFlix'}</p>
            </div>
            <div className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Transparencia</p>
              <p className="mt-2 text-sm font-semibold text-[#15323b]">{draftOpacity}%</p>
            </div>
            <div className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Tamanho</p>
              <p className="mt-2 text-sm font-semibold text-[#15323b]">{draftSize}%</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">
                Enviar novo logotipo
              </span>
              <input type="file" accept=".svg,.png,.webp,.jpg,.jpeg,image/*" onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    handleFileChange(file);
                    event.currentTarget.value = '';
                }} className="block w-full cursor-pointer border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] file:mr-4 file:border-0 file:bg-[#E8F6FA] file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[0.18em] file:text-[#1398B7]"/>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Transparencia</span>
                <input type="range" min={0} max={100} step={1} value={draftOpacity} onChange={(event) => setDraftOpacity(Number(event.target.value))} className="w-full accent-[#1398B7]"/>
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5F7077]">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Tamanho</span>
                <input type="range" min={25} max={300} step={1} value={draftSize} onChange={(event) => setDraftSize(Number(event.target.value))} className="w-full accent-[#1398B7]"/>
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5F7077]">
                  <span>25%</span>
                  <span>300%</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" disabled={isSaving || !hasPendingChanges} onClick={() => void handleSave()} className="rounded-xl bg-[#1398B7] font-black text-white hover:bg-[#0f7f98]">
              {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Salvando...</>) : (<><Save className="mr-2 h-4 w-4"/>Salvar configuracao</>)}
            </Button>
            <Button type="button" variant="outline" disabled={isSaving} onClick={handleRestoreDefault} className="rounded-xl border-[#D8E6EB] font-black text-[#5F7077] hover:bg-[#F2F7F9]">
              <Trash2 className="mr-2 h-4 w-4"/>
              Restaurar padrão
            </Button>
          </div>
        </article>

        <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Previsualizacao</p>
          <h3 className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">Aparencia da marca dagua</h3>
          <p className="mt-2 text-sm leading-7 text-[#5F7077]">
            O preview simula a marca aplicada sobre a pagina do PDF e ajuda a ajustar contraste e dominancia visual.
          </p>

          <div className="mt-5 overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-[linear-gradient(135deg,#f8fbfc_0%,#edf6f9_100%)] p-5">
            <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-[#B8CDD4] bg-white/70 p-6">
              <div className="flex w-full max-w-[320px] items-center justify-center">
                {currentLogo?.src ? (<img src={currentLogo.src} alt={currentLogo.alt || 'Marca dagua'} style={{
                        width: `${Math.min(100, Math.max(30, draftSize))}%`,
                        opacity: Math.max(0.05, Math.min(1, draftOpacity / 100)),
                    }} className="h-auto max-h-[180px] object-contain drop-shadow-sm"/>) : (<div className="flex h-[120px] w-[220px] items-center justify-center rounded-[24px] border border-dashed border-[#B8CDD4] bg-[#F8FBFC] px-5 text-center">
                    <div className="space-y-2">
                      <GenflixLogo className="mx-auto scale-90" theme="dark"/>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5F7077]">
                        Usando marca padrão da GenFlix
                      </p>
                    </div>
                  </div>)}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-[#D8E6EB] bg-[#F8FBFC] p-4 text-sm leading-7 text-[#5F7077]">
            Se nenhum PDF base foi enviado no modulo, o download usa esta marca dagua junto do conteudo gerado automaticamente.
          </div>

          {hasPendingChanges ? (<p className="mt-4 text-xs font-semibold text-[#1398B7]">
              Ha alteracoes pendentes para salvar.
            </p>) : (<p className="mt-4 text-xs font-semibold text-[#5F7077]">
              Nenhuma alteracao pendente.
            </p>)}
        </article>
      </div>
    </div>);
}
