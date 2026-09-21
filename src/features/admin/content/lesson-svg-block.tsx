import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Fullscreen, Maximize2, Move, RotateCcw, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deleteLessonContentAsset, getSignedLessonContentAssetUrl, uploadLessonContentAsset } from '@/features/admin/content/api';
import type { LessonSvgBlockContent, LessonImageBlockCaptionAlignment, LessonImageBlockSize } from '@/features/admin/content/content-blocks';

const SVG_SIZE_CLASSES: Record<LessonImageBlockSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-none',
};

const SVG_CAPTION_ALIGNMENT_CLASSES: Record<LessonImageBlockCaptionAlignment, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const PAN_STEP = 56;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function useResolvedSvgUrl(content: LessonSvgBlockContent) {
    const [resolvedAsset, setResolvedAsset] = useState<{ storagePath: string; url: string } | null>(null);
    const storagePath = content.source_type === 'upload' ? content.storage_path.trim() : '';
    const storageProvider = content.storage_provider ?? 'r2';
    const signedUrl = content.source_type === 'upload' ? content.signed_url?.trim() || null : null;

    useEffect(() => {
        let isMounted = true;
        if (!storagePath) {
            return () => {
                isMounted = false;
            };
        }
        void getSignedLessonContentAssetUrl(storagePath, storageProvider)
            .then((url) => {
                if (isMounted) {
                    setResolvedAsset({ storagePath, url });
                }
            })
            .catch(() => {
                if (isMounted) {
                    setResolvedAsset({ storagePath, url: '' });
                }
            });
        return () => {
            isMounted = false;
        };
    }, [signedUrl, storagePath, storageProvider]);

    return content.source_type === 'upload'
        ? (resolvedAsset?.storagePath === storagePath ? resolvedAsset.url : signedUrl) || ''
        : content.url.trim();
}

interface LessonSvgViewerProps {
    content: LessonSvgBlockContent;
    emptyMessage?: string;
}

export function LessonSvgBlockViewer({ content, emptyMessage = 'SVG nÃ£o configurado.' }: LessonSvgViewerProps) {
    const imageUrl = useResolvedSvgUrl(content);
    const viewerRef = useRef<HTMLElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const zoomRef = useRef(MIN_ZOOM);
    const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const setZoomLevel = (nextZoom: number) => {
        const next = clamp(Number(nextZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
        zoomRef.current = next;
        setZoom(next);
        if (next === MIN_ZOOM) {
            setPan({ x: 0, y: 0 });
        }
    };

    const clampPan = (nextPan: { x: number; y: number }) => {
        const width = stageRef.current?.clientWidth ?? 0;
        const height = stageRef.current?.clientHeight ?? 0;
        const maxX = Math.max(0, width * (zoomRef.current - 1) / 2);
        const maxY = Math.max(0, height * (zoomRef.current - 1) / 2);
        return {
            x: clamp(nextPan.x, -maxX, maxX),
            y: clamp(nextPan.y, -maxY, maxY),
        };
    };

    const movePan = (deltaX: number, deltaY: number) => {
        setPan((current) => clampPan({ x: current.x + deltaX, y: current.y + deltaY }));
    };

    const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
        if (!isFullscreen) {
            return;
        }
        event.preventDefault();
        const nextZoom = zoomRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        setZoomLevel(nextZoom);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            movePan(PAN_STEP, 0);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            movePan(-PAN_STEP, 0);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            movePan(0, PAN_STEP);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            movePan(0, -PAN_STEP);
        } else if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            setZoomLevel(zoomRef.current + ZOOM_STEP);
        } else if (event.key === '-' || event.key === '_') {
            event.preventDefault();
            setZoomLevel(zoomRef.current - ZOOM_STEP);
        } else if (event.key === '0') {
            event.preventDefault();
            setZoomLevel(MIN_ZOOM);
        }
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (zoomRef.current <= MIN_ZOOM) {
            return;
        }
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        setIsDragging(true);
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        movePan(event.clientX - drag.x, event.clientY - drag.y);
        dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    };

    const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            setIsDragging(false);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const toggleFullscreen = async () => {
        const viewer = viewerRef.current;
        if (!viewer || typeof document === 'undefined') {
            return;
        }
        if (document.fullscreenElement === viewer) {
            await document.exitFullscreen().catch(() => undefined);
            return;
        }
        await viewer.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === viewerRef.current);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <section
            ref={viewerRef}
            className={cn(
                'overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm',
                isFullscreen && 'flex h-screen flex-col rounded-none border-0 bg-slate-950 p-4',
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Move className="h-4 w-4 text-sky-600" />
                    <span>Arraste ou use as setas para navegar</span>
                </div>
                <div className="flex items-center gap-1" aria-label="Controles do SVG">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(zoomRef.current - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title="Diminuir zoom" aria-label="Diminuir zoom">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="min-w-14 text-center text-xs font-black text-slate-600">{Math.round(zoom * 100)}%</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(zoomRef.current + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title="Aumentar zoom" aria-label="Aumentar zoom">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(MIN_ZOOM)} title="Redefinir zoom e posição" aria-label="Redefinir zoom e posição">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void toggleFullscreen()} title={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}>
                        {isFullscreen ? <Maximize2 className="h-4 w-4" /> : <Fullscreen className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div
                ref={stageRef}
                tabIndex={0}
                role="application"
                aria-label="Visualizador interativo de SVG"
                className={cn(
                    'relative flex min-h-[320px] h-[min(68vh,44rem)] w-full items-center justify-center overflow-hidden bg-slate-100 outline-none focus:ring-4 focus:ring-sky-200',
                    isFullscreen && 'min-h-0 h-auto flex-1 bg-slate-950',
                    zoom > MIN_ZOOM ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                )}
                onWheel={handleWheel}
                onKeyDown={handleKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={content.alt}
                        draggable={false}
                        className="h-full w-full select-none object-contain"
                        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 120ms ease-out' }}
                    />
                ) : (
                    <div className="px-6 text-center text-sm text-slate-500">{emptyMessage}</div>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
                <span>{isFullscreen ? 'Roda do mouse: zoom · Setas: navegação · 0: redefinir' : 'Roda do mouse: rolagem normal · Setas: navegação · 0: redefinir'}</span>
                <span>Limite: 100%–400%</span>
            </div>
        </section>
    );
}

interface LessonSvgBlockEditorProps {
    content: LessonSvgBlockContent;
    onChange: (content: LessonSvgBlockContent) => void;
    onError?: (message: string | null) => void;
}

function isSvgFile(file: File) {
    return file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml';
}

export function LessonSvgBlockEditor({ content, onChange, onError }: LessonSvgBlockEditorProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [inputMode, setInputMode] = useState<'url' | 'upload'>(content.source_type);
    const [isUploading, setIsUploading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    useEffect(() => setInputMode(content.source_type), [content.source_type]);

    const selectUrlMode = async () => {
        const previousStoragePath = content.source_type === 'upload' ? content.storage_path.trim() : '';
        const previousStorageProvider = content.storage_provider ?? 'r2';
        if (previousStoragePath) {
            await deleteLessonContentAsset(previousStoragePath, previousStorageProvider).catch(() => undefined);
        }
        setInputMode('url');
        onChange({ ...content, source_type: 'url', storage_path: '', storage_provider: undefined, signed_url: null, file_name: '', mime_type: null });
    };

    const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!isSvgFile(file)) {
            const message = 'Selecione um arquivo .svg válido.';
            setPreviewError(message);
            onError?.(message);
            event.target.value = '';
            return;
        }
        setIsUploading(true);
        setPreviewError(null);
        onError?.(null);
        try {
            const previousStoragePath = content.source_type === 'upload' ? content.storage_path.trim() : '';
            const previousStorageProvider = content.storage_provider ?? 'r2';
            const uploadResult = await uploadLessonContentAsset(file, { contentType: 'image/svg+xml' });
            onChange({
                ...content,
                source_type: 'upload',
                url: '',
                storage_path: uploadResult.storage_path,
                storage_provider: uploadResult.storage_provider,
                signed_url: uploadResult.signed_url,
                file_name: file.name,
                mime_type: 'image/svg+xml',
            });
            if (previousStoragePath && previousStoragePath !== uploadResult.storage_path) {
                void deleteLessonContentAsset(previousStoragePath, previousStorageProvider).catch(() => undefined);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao enviar o SVG.';
            setPreviewError(message);
            onError?.(message);
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-700">SVG interativo</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Envie o arquivo SVG ou informe uma URL. O aluno poderá ampliar, arrastar, navegar pelas setas e abrir em tela cheia.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <button type="button" onClick={() => void selectUrlMode()} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'url' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                    <p className="text-xs font-black uppercase tracking-[0.18em]">SVG via URL</p>
                    <p className={cn('mt-1 text-sm', inputMode === 'url' ? 'text-slate-200' : 'text-slate-500')}>Use um endereço público que termine em .svg.</p>
                </button>
                <button type="button" onClick={() => { setInputMode('upload'); onChange({ ...content, source_type: 'upload' }); }} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'upload' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                    <p className="text-xs font-black uppercase tracking-[0.18em]">Enviar arquivo SVG</p>
                    <p className={cn('mt-1 text-sm', inputMode === 'upload' ? 'text-slate-200' : 'text-slate-500')}>Armazene o SVG no bucket protegido da aula.</p>
                </button>
            </div>

            {inputMode === 'url' ? (
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">URL do SVG</span>
                    <input type="url" value={content.url} onChange={(event) => onChange({ ...content, source_type: 'url', url: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="https://exemplo.com/diagrama.svg" />
                </label>
            ) : (
                <div className="space-y-3 rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5">
                    <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(event) => void handleFileSelected(event)} />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" variant="outline" className="rounded-2xl border-slate-200 bg-white" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            <Upload className="mr-2 h-4 w-4" />
                            {isUploading ? 'Enviando SVG...' : content.file_name ? 'Trocar SVG' : 'Selecionar SVG'}
                        </Button>
                        {content.file_name ? <span className="truncate text-sm font-semibold text-slate-600">{content.file_name}</span> : <span className="text-sm text-slate-500">Aceita arquivos .svg.</span>}
                    </div>
                </div>
            )}

            <LessonSvgBlockViewer content={content} emptyMessage="Selecione um SVG para visualizar a prévia." />

            <div className="grid gap-4 md:grid-cols-3">
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tamanho do bloco</span>
                    <select value={content.size} onChange={(event) => onChange({ ...content, size: event.target.value as LessonImageBlockSize })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                        <option value="sm">Pequeno</option>
                        <option value="md">Médio</option>
                        <option value="lg">Grande</option>
                        <option value="full">Largura total</option>
                    </select>
                </label>
                <label className="block space-y-2 md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Texto alternativo</span>
                    <input type="text" value={content.alt} onChange={(event) => onChange({ ...content, alt: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Descrição do diagrama para acessibilidade" />
                </label>
            </div>
            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Legenda</span>
                <textarea value={content.caption} onChange={(event) => onChange({ ...content, caption: event.target.value })} className="min-h-[88px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Legenda opcional do SVG" />
            </label>
            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Alinhamento da legenda</span>
                <select value={content.caption_alignment} onChange={(event) => onChange({ ...content, caption_alignment: event.target.value as LessonImageBlockCaptionAlignment })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                </select>
            </label>
            {previewError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{previewError}</div> : null}
        </div>
    );
}

export function LessonSvgBlockRenderer({ content }: LessonSvgViewerProps) {
    return (
        <figure className={cn('my-8 mx-auto', SVG_SIZE_CLASSES[content.size])}>
            <LessonSvgBlockViewer content={content} />
            {content.caption ? <figcaption className={cn('border-x border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600', SVG_CAPTION_ALIGNMENT_CLASSES[content.caption_alignment])}>{content.caption}</figcaption> : null}
        </figure>
    );
}
