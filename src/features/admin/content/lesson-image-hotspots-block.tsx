import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import ReactQuill from '@/components/forms/react-quill';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteLessonContentAsset, getSignedLessonContentAssetUrl, uploadLessonContentAsset, } from '@/features/admin/content/api';
import { cn } from '@/lib/utils';
import type { LessonImageHotspotsBlockContent, LessonImageHotspotItem, } from '@/types/content';
import { normalizeLessonImageHotspotsBlockContent } from './content-blocks';
const HOTSPOT_BODY_QUILL_MODULES = {
    toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'blockquote'],
        ['clean'],
    ],
};
const HOTSPOT_BODY_QUILL_FORMATS = [
    'bold',
    'italic',
    'underline',
    'list',
    'bullet',
    'link',
    'blockquote',
];
function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
function roundPercent(value: number) {
    return Math.round(value * 100) / 100;
}
function readImageDimensions(file: File) {
    return new Promise<{
        width: number;
        height: number;
    }>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            resolve({
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height,
            });
            URL.revokeObjectURL(objectUrl);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Não foi possível ler a imagem selecionada.'));
        };
        image.src = objectUrl;
    });
}
interface LessonImageHotspotsBlockEditorProps {
    content: LessonImageHotspotsBlockContent;
    onChange: (content: LessonImageHotspotsBlockContent) => void;
    onError?: (message: string | null) => void;
}
export function LessonImageHotspotsBlockEditor({ content, onChange, onError, }: LessonImageHotspotsBlockEditorProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{
        pointerId: number;
        hotspotId: string;
        startClientX: number;
        startClientY: number;
        startX: number;
        startY: number;
    } | null>(null);
    const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(content.hotspots[0]?.id ?? null);
    const [zoomPercent, setZoomPercent] = useState(100);
    const [resolvedAssetUrl, setResolvedAssetUrl] = useState<string | null>(() => {
        if (content.asset.storage_path?.trim()) {
            return null;
        }
        return content.asset.signed_url?.trim() || null;
    });
    const [isUploadingAsset, setIsUploadingAsset] = useState(false);
    const [assetError, setAssetError] = useState<string | null>(null);
    const selectedHotspot = useMemo(() => content.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null, [content.hotspots, selectedHotspotId]);
    useEffect(() => {
        if (selectedHotspotId && content.hotspots.some((hotspot) => hotspot.id === selectedHotspotId)) {
            return;
        }
        setSelectedHotspotId(content.hotspots[0]?.id ?? null);
    }, [content.hotspots, selectedHotspotId]);
    useEffect(() => {
        const storagePath = content.asset.storage_path?.trim();
        if (!storagePath) {
            setResolvedAssetUrl(content.asset.signed_url?.trim() || null);
            return;
        }
        let isMounted = true;
        setResolvedAssetUrl(null);
        void getSignedLessonContentAssetUrl(storagePath, content.asset.storage_provider)
            .then((url) => {
            if (isMounted) {
                setResolvedAssetUrl(url);
            }
        })
            .catch(() => {
            if (isMounted) {
                setResolvedAssetUrl(null);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [content.asset.signed_url, content.asset.storage_path, content.asset.storage_provider]);
    const assetUrl = resolvedAssetUrl;
    useEffect(() => {
        function handlePointerMove(event: PointerEvent) {
            const dragState = dragStateRef.current;
            const stage = stageRef.current;
            if (!dragState || !stage) {
                return;
            }
            const rect = stage.getBoundingClientRect();
            const deltaX = ((event.clientX - dragState.startClientX) / rect.width) * 100;
            const deltaY = ((event.clientY - dragState.startClientY) / rect.height) * 100;
            emit({
                ...content,
                hotspots: content.hotspots.map((hotspot) => (hotspot.id !== dragState.hotspotId
                    ? hotspot
                    : {
                        ...hotspot,
                        x: roundPercent(clamp(dragState.startX + deltaX, 0, 100)),
                        y: roundPercent(clamp(dragState.startY + deltaY, 0, 100)),
                    })),
            });
        }
        function handlePointerUp(event: PointerEvent) {
            const dragState = dragStateRef.current;
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }
            dragStateRef.current = null;
        }
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [content]);
    function emit(nextContent: LessonImageHotspotsBlockContent) {
        onChange(normalizeLessonImageHotspotsBlockContent(nextContent));
    }
    function updateHotspot(hotspotId: string, updates: Partial<LessonImageHotspotItem>) {
        emit({
            ...content,
            hotspots: content.hotspots.map((hotspot) => (hotspot.id === hotspotId
                ? { ...hotspot, ...updates }
                : hotspot)),
        });
    }
    function handleStageClick(event: ReactPointerEvent<HTMLDivElement>) {
        if (!content.asset.storage_path || !stageRef.current) {
            const message = 'Envie a imagem base antes de criar hotspots.';
            setAssetError(message);
            onError?.(message);
            return;
        }
        const rect = stageRef.current.getBoundingClientRect();
        const nextHotspot: LessonImageHotspotItem = {
            id: crypto.randomUUID(),
            x: roundPercent(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)),
            y: roundPercent(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)),
            title: `Hotspot ${content.hotspots.length + 1}`,
            body_html: '<p>Descreva aqui o conteúdo deste hotspot.</p>',
        };
        setSelectedHotspotId(nextHotspot.id);
        emit({
            ...content,
            hotspots: [...content.hotspots, nextHotspot],
        });
    }
    function handleHotspotPointerDown(hotspot: LessonImageHotspotItem, event: ReactPointerEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedHotspotId(hotspot.id);
        dragStateRef.current = {
            pointerId: event.pointerId,
            hotspotId: hotspot.id,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: hotspot.x,
            startY: hotspot.y,
        };
    }
    async function handleAssetSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setIsUploadingAsset(true);
        setAssetError(null);
        onError?.(null);
        try {
            const previousStoragePath = content.asset.storage_path;
            const previousStorageProvider = content.asset.storage_provider ?? 'supabase';
            const [uploadResult, dimensions] = await Promise.all([
                uploadLessonContentAsset(file),
                readImageDimensions(file),
            ]);
            setResolvedAssetUrl(uploadResult.signed_url);
            emit({
                ...content,
                asset: {
                    storage_path: uploadResult.storage_path,
                    storage_provider: uploadResult.storage_provider,
                    signed_url: uploadResult.signed_url,
                    alt: content.asset.alt || file.name,
                    width: dimensions.width,
                    height: dimensions.height,
                },
            });
            if (previousStoragePath && previousStoragePath !== uploadResult.storage_path) {
                void deleteLessonContentAsset(previousStoragePath, previousStorageProvider).catch(() => null);
            }
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Falha ao enviar a imagem do bloco interativo.';
            setAssetError(message);
            onError?.(message);
        }
        finally {
            setIsUploadingAsset(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    }
    function removeSelectedHotspot() {
        if (!selectedHotspot) {
            return;
        }
        const nextHotspots = content.hotspots.filter((hotspot) => hotspot.id !== selectedHotspot.id);
        setSelectedHotspotId(nextHotspots[0]?.id ?? null);
        emit({
            ...content,
            hotspots: nextHotspots,
        });
    }
    const stageUrl = assetUrl;
    return (<div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
      <div className="space-y-4 xl:sticky xl:top-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-700">Imagem Base</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Envie uma imagem e clique nela para posicionar os hotspots interativos.
              </p>
            </div>

            <Button type="button" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAsset}>
              {content.asset.storage_path ? 'Trocar imagem' : 'Enviar imagem'}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
            <div className="min-w-[240px] flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Área interativa</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Os hotspots deste bloco são pontos com ícone. Clique para criar e arraste para reposicionar.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Zoom</span>
              <div className="flex items-center gap-1">
                {[75, 100, 150].map((preset) => (<button key={preset} type="button" onClick={() => setZoomPercent(preset)} className={cn('rounded-full px-3 py-1 text-xs font-black transition-colors', zoomPercent === preset
                ? 'bg-sky-600 text-white'
                : 'text-slate-500 hover:bg-slate-50')}>
                    {preset}%
                  </button>))}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleAssetSelected(event)}/>

            <div className="overflow-auto rounded-[28px] border border-slate-200 bg-slate-50/60 p-4">
              <div ref={stageRef} className="relative mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-inner" style={{
            width: '100%',
            aspectRatio: `${content.asset.width} / ${content.asset.height}`,
            transform: `scale(${zoomPercent / 100})`,
            transformOrigin: 'top center',
        }} onClick={handleStageClick}>
                {stageUrl ? (<img src={stageUrl} alt={content.asset.alt} className="h-full w-full object-contain" draggable={false}/>) : (<div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_55%),linear-gradient(180deg,_#f8fbff,_#ffffff)] px-8 text-center">
                    <div className="max-w-md rounded-[24px] border border-dashed border-sky-200 bg-white/80 px-8 py-10 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-700">Bloco interativo</p>
                      <p className="mt-4 text-lg font-black text-slate-900">Envie uma imagem para posicionar os hotspots</p>
                      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
                        Cada hotspot abrirá um modal simples sobre a imagem, complementando o conteúdo da aula.
                      </p>
                    </div>
                  </div>)}

                {content.hotspots.map((hotspot, index) => {
            const isSelected = hotspot.id === selectedHotspotId;
            return (<button key={hotspot.id} type="button" onClick={(event) => {
                    event.stopPropagation();
                    setSelectedHotspotId(hotspot.id);
                }} onPointerDown={(event) => handleHotspotPointerDown(hotspot, event)} className={cn('absolute inline-flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-900/88 text-white shadow-xl transition-all', isSelected ? 'scale-105 ring-4 ring-sky-300/70' : 'hover:scale-[1.03]')} style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                }} aria-label={hotspot.title}>
                      <Plus className="h-5 w-5"/>
                      <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-black text-white">
                        {index + 1}
                      </span>
                    </button>);
        })}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Texto alternativo da imagem</span>
              <input type="text" value={content.asset.alt} onChange={(event) => emit({
            ...content,
            asset: {
                ...content.asset,
                alt: event.target.value,
            },
        })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Descreva brevemente a imagem para acessibilidade."/>
            </label>

            {assetError ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {assetError}
              </div>) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Hotspots</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {content.hotspots.length}ponto(s) configurado(s) nest? imagem.
              </p>
            </div>
            <Button type="button" variant="outline" className="rounded-full" onClick={removeSelectedHotspot} disabled={!selectedHotspot}>
              Remover selecionado
            </Button>
          </div>

          <div className="mt-5 grid max-h-[320px] gap-3 overflow-auto pr-1">
            {content.hotspots.length === 0 ? (<div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-500">
                Nenhum hotspot criado ainda. Clique na imagem para adicionar o primeiro ponto.
              </div>) : content.hotspots.map((hotspot, index) => {
            const isSelected = hotspot.id === selectedHotspotId;
            return (<button key={hotspot.id} type="button" onClick={() => setSelectedHotspotId(hotspot.id)} className={cn('flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all', isSelected
                    ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-sky-200')}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Hotspot {index + 1}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {hotspot.title?.trim() || `Hotspot ${index + 1}`}
                    </p>
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
                    <Plus className="h-4 w-4"/>
                  </span>
                </button>);
        })}
          </div>
        </div>

        {selectedHotspot ? (<div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Ajuste do hotspot</p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {selectedHotspot.title?.trim() || 'Hotspot selecionado'}
                </p>
              </div>
              <button type="button" onClick={removeSelectedHotspot} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-rose-600" aria-label="Remover hotspot">
                <X className="h-5 w-5"/>
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Título do hotspot</span>
                <input type="text" value={selectedHotspot.title} onChange={(event) => updateHotspot(selectedHotspot.id, { title: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Ex.: Mirtilos, Frontal, Área 1..."/>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">X (%)</span>
                  <input type="number" min={0} max={100} step={0.1} value={selectedHotspot.x} onChange={(event) => updateHotspot(selectedHotspot.id, {
                x: roundPercent(clamp(Number(event.target.value || 0), 0, 100)),
            })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"/>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Y (%)</span>
                  <input type="number" min={0} max={100} step={0.1} value={selectedHotspot.y} onChange={(event) => updateHotspot(selectedHotspot.id, {
                y: roundPercent(clamp(Number(event.target.value || 0), 0, 100)),
            })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"/>
                </label>
              </div>

              <div>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Conteúdo do modal</span>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <ReactQuill theme="snow" value={selectedHotspot.body_html} onChange={(value: string) => updateHotspot(selectedHotspot.id, { body_html: value })} modules={HOTSPOT_BODY_QUILL_MODULES} formats={HOTSPOT_BODY_QUILL_FORMATS} placeholder="Escreva o conteúdo que será exibido ao clicar neste hotspot..."/>
                </div>
              </div>
            </div>
          </div>) : null}
      </div>
    </div>);
}
interface LessonImageHotspotsBlockRendererProps {
    content: LessonImageHotspotsBlockContent;
}
export function LessonImageHotspotsBlockRenderer({ content, }: LessonImageHotspotsBlockRendererProps) {
    const [resolvedAssetUrl, setResolvedAssetUrl] = useState<string | null>(() => {
        if (content.asset.storage_path?.trim()) {
            return null;
        }
        return content.asset.signed_url?.trim() || null;
    });
    const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
    const activeHotspot = useMemo(() => content.hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null, [activeHotspotId, content.hotspots]);
    useEffect(() => {
        const storagePath = content.asset.storage_path?.trim();
        if (!storagePath) {
            setResolvedAssetUrl(content.asset.signed_url?.trim() || null);
            return;
        }
        let isMounted = true;
        setResolvedAssetUrl(null);
        void getSignedLessonContentAssetUrl(storagePath, content.asset.storage_provider)
            .then((url) => {
            if (isMounted) {
                setResolvedAssetUrl(url);
            }
        })
            .catch(() => {
            if (isMounted) {
                setResolvedAssetUrl(null);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [content.asset.signed_url, content.asset.storage_path, content.asset.storage_provider]);
    const assetUrl = resolvedAssetUrl;
    const desktopPopupPlacement = activeHotspot
        ? activeHotspot.x > 50
            ? {
                side: 'left' as const,
                style: {
                    right: `calc(${clamp(100 - activeHotspot.x, 10, 60)}% + 44px)`,
                    top: `${clamp(activeHotspot.y, 18, 82)}%`,
                    transform: 'translateY(-50%)',
                },
            }
            : {
                side: 'right' as const,
                style: {
                    left: `calc(${clamp(activeHotspot.x, 10, 60)}% + 44px)`,
                    top: `${clamp(activeHotspot.y, 18, 82)}%`,
                    transform: 'translateY(-50%)',
                },
            }
        : null;
    return (<div className="my-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-700">Imagem Interativa</p>
        <p className="mt-2 text-sm font-medium text-slate-500">Clique nos hotspots para explorar os dest?ques dest? imagem.
        </p>
      </div>

      <div className="p-4 sm:p-6">
        <div className="relative mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-inner" style={{ aspectRatio: `${content.asset.width} / ${content.asset.height}` }}>
          {assetUrl ? (<img src={assetUrl} alt={content.asset.alt} className="h-full w-full object-contain" draggable={false}/>) : (<div className="flex h-full w-full items-center justify-center px-6 text-center text-sm font-medium text-slate-500">A imagem interativa desta aula ainda não foi carregada.
            </div>)}

          {activeHotspot ? (<button type="button" className="absolute inset-0 z-10 bg-slate-950/32 transition-opacity" onClick={() => setActiveHotspotId(null)} aria-label="Fechar hotspot"/>) : null}

          {content.hotspots.map((hotspot) => {
            const isActive = hotspot.id === activeHotspotId;
            return (<button key={hotspot.id} type="button" className={cn('absolute z-20 inline-flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-white shadow-xl transition-all', isActive
                    ? 'bg-blue-600 ring-4 ring-blue-200 scale-105'
                    : 'bg-slate-900/88 hover:scale-[1.04] hover:bg-slate-900')} style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                }} onClick={() => setActiveHotspotId(hotspot.id)} aria-label={hotspot.title}>
                <Plus className="h-5 w-5"/>
              </button>);
        })}

          {activeHotspot ? (<>
              <div className="absolute inset-x-3 bottom-3 z-30 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.26)] lg:hidden" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xl font-black text-slate-900">{activeHotspot.title}</h4>
                  </div>
                  <button type="button" onClick={() => setActiveHotspotId(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700" aria-label="Fechar conteúdo do hotspot">
                    <X className="h-5 w-5"/>
                  </button>
                </div>
                <div className="lesson-hotspots-body mt-4 text-left" dangerouslySetInnerHTML={{ __html: activeHotspot.body_html }}/>
              </div>

              <div className="absolute z-30 hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_28px_70px_rgba(15,23,42,0.28)] lg:block" style={{
                ...(desktopPopupPlacement?.style ?? {}),
                width: 'min(24rem, calc(100% - 4rem))',
            }} onClick={(event) => event.stopPropagation()}>
                <div className={cn('absolute top-1/2 h-[3px] w-7 -translate-y-1/2 rounded-full bg-white/95 shadow-[0_0_0_1px_rgba(226,232,240,0.92)]', desktopPopupPlacement?.side === 'left' ? '-right-7' : '-left-7')}/>
                <div className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border border-slate-200 bg-white', desktopPopupPlacement?.side === 'left' ? '-right-2' : '-left-2')}/>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="text-2xl font-black text-slate-900">{activeHotspot.title}</h4>
                  </div>
                  <button type="button" onClick={() => setActiveHotspotId(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700" aria-label="Fechar conteúdo do hotspot">
                    <X className="h-5 w-5"/>
                  </button>
                </div>
                <div className="lesson-hotspots-body mt-5 text-left" dangerouslySetInnerHTML={{ __html: activeHotspot.body_html }}/>
              </div>
            </>) : null}
        </div>
      </div>
    </div>);
}
