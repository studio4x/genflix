import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type DragEvent, type IframeHTMLAttributes } from 'react';
import { ChevronDown, ChevronUp, Library, Upload } from 'lucide-react';
import ReactQuill from '@/components/forms/react-quill';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deleteLessonContentAsset, getSignedLessonContentAssetUrl, uploadLessonContentAsset, fetchGlobalButtonsBatchAdmin } from '@/features/admin/content/api';
import { LessonImageHotspotsBlockEditor, LessonImageHotspotsBlockRenderer } from '@/features/admin/content/lesson-image-hotspots-block';
import { LessonFlashcardsBlockEditor, LessonFlashcardsBlockRenderer } from '@/features/admin/content/lesson-flashcards-block';
import { MediaLibraryModal } from '@/features/site-assets/media-library-modal';
import type { SiteAsset } from '@/features/site-editor/types';
import { resolveSiteAssetPublicUrl } from '@/features/site-assets/public-url';
import {
    createEmptyColumnsBlockContent,
    createEmptyLessonButtonBlockContent,
    createEmptyLessonFlashcardsBlockContent,
    createEmptyLessonHtmlBlockContent,
    createEmptyLessonImageBlockContent,
    createEmptyLessonImageHotspotsBlockContent,
    createEmptyLessonVideoBlockContent,
    getColumnsTemplateValue,
    getColumnsWidthsAttributeValue,
    sanitizeRichTextHtml,
    sanitizeTableHtml,
    type LessonImageBlockCaptionAlignment,
    type LessonHtmlBlockContent,
    type LessonContentBlock,
    type LessonColumnsBlockContent,
    type LessonImageBlockContent,
    type LessonImageBlockSize,
    type LessonVideoBlockContent,
    type LessonVideoBlockCaptionAlignment,
    type LessonVideoBlockSize,
} from '@/features/admin/content/content-blocks';
import { LessonActionButton } from '@/features/admin/content/lesson-action-button';
import { LessonButtonBlockModal } from '@/features/admin/content/lesson-button-block-modal';
import type { GlobalButtonDefinition, LessonButtonBlockLocalConfig } from '@/types/content';

const FULL_QUILL_MODULES = {
    toolbar: [
        [{ header: [1, 2, 3, 4, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        [{ color: [] }, { background: [] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video', 'table', 'hr'],
        ['undo', 'redo', 'clean'],
    ],
};

const FULL_QUILL_FORMATS = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'align',
    'color',
    'background',
    'link',
    'blockquote',
    'code-block',
];

const IMAGE_SIZE_CLASSES: Record<LessonImageBlockSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-none',
};

const IMAGE_CAPTION_ALIGNMENT_CLASSES: Record<LessonImageBlockCaptionAlignment, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

const VIDEO_SIZE_CLASSES: Record<LessonVideoBlockSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-none',
};

const VIDEO_CAPTION_ALIGNMENT_CLASSES: Record<LessonVideoBlockCaptionAlignment, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

const COLUMN_WIDTH_STEP = 5;

function buildColumnWidthOptions(columnCount: number): number[] {
    if (columnCount <= 1) {
        return [100];
    }
    const safeCount = Math.min(4, Math.max(2, columnCount));
    const maxWidth = 100 - ((safeCount - 1) * COLUMN_WIDTH_STEP);
    const options: number[] = [];
    for (let width = COLUMN_WIDTH_STEP; width <= maxWidth; width += COLUMN_WIDTH_STEP) {
        options.push(width);
    }
    return options;
}

function distributeColumnWidths(columnCount: number, selectedIndex: number, selectedWidth: number): number[] {
    const safeCount = Math.min(4, Math.max(1, columnCount));
    if (safeCount === 1) {
        return [100];
    }
    const maxSelectedWidth = 100 - ((safeCount - 1) * COLUMN_WIDTH_STEP);
    const safeSelectedWidth = Math.min(maxSelectedWidth, Math.max(COLUMN_WIDTH_STEP, Math.round(selectedWidth / COLUMN_WIDTH_STEP) * COLUMN_WIDTH_STEP));
    const remainingWidth = 100 - safeSelectedWidth;
    const otherCount = safeCount - 1;
    const baseWidth = Math.floor((remainingWidth / otherCount) / COLUMN_WIDTH_STEP) * COLUMN_WIDTH_STEP;
    const widths = Array.from({ length: safeCount }, () => baseWidth);
    widths[selectedIndex] = safeSelectedWidth;
    let leftoverWidth = remainingWidth - (baseWidth * otherCount);
    let cursor = 0;
    while (leftoverWidth > 0) {
        if (cursor !== selectedIndex) {
            widths[cursor] += COLUMN_WIDTH_STEP;
            leftoverWidth -= COLUMN_WIDTH_STEP;
        }
        cursor = (cursor + 1) % safeCount;
    }
    return widths;
}

function isDirectVideoUrl(url: string): boolean {
    return /^https?:\/\/[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?$/i.test(url);
}

function getVideoEmbedUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('youtu.be')) {
            const videoId = parsed.pathname.replace('/', '').trim();
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }
        if (host.includes('youtube.com') || host.includes('m.youtube.com')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }
            const parts = parsed.pathname.split('/').filter(Boolean);
            const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts');
            if (embedIndex >= 0 && parts[embedIndex + 1]) {
                return `https://www.youtube.com/embed/${parts[embedIndex + 1]}`;
            }
        }
        if (host.includes('vimeo.com')) {
            const parts = parsed.pathname.split('/').filter(Boolean);
            const videoId = parts[parts.length - 1];
            return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
        }
    }
    catch {
        return null;
    }
    return null;
}

interface StandaloneIframeEmbed {
    src: string;
    title: string;
    allow: string | null;
    loading: 'eager' | 'lazy' | null;
    referrerPolicy: IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy'];
    allowFullScreen: boolean;
}

function isSafeIframeSrc(src: string) {
    return /^(https?:)?\/\//i.test(src) || /^https?:\/\//i.test(src);
}

function parseStandaloneIframeEmbed(html: string): StandaloneIframeEmbed | null {
    const trimmed = html.trim();
    if (!trimmed || typeof DOMParser === 'undefined') {
        return null;
    }

    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    const iframe = doc.body.querySelector('iframe');
    if (!iframe || doc.body.querySelectorAll('iframe').length !== 1) {
        return null;
    }

    const hasOtherElements = Array.from(doc.body.children).some((child) => child !== iframe);
    if (hasOtherElements) {
        return null;
    }

    const hasMeaningfulText = Array.from(doc.body.childNodes).some((node) => (
        node.nodeType === Node.TEXT_NODE
        && (node.textContent ?? '').trim() !== ''
    ));
    if (hasMeaningfulText) {
        return null;
    }

    const src = iframe.getAttribute('src')?.trim() ?? '';
    if (!src || !isSafeIframeSrc(src)) {
        return null;
    }

    const allow = iframe.getAttribute('allow')?.trim() || null;
    const loadingAttr = iframe.getAttribute('loading')?.trim().toLowerCase();
    const loading = loadingAttr === 'lazy' || loadingAttr === 'eager' ? loadingAttr : null;

    return {
        src,
        title: iframe.getAttribute('title')?.trim() || 'Conteúdo incorporado',
        allow,
        loading,
        referrerPolicy: iframe.getAttribute('referrerpolicy')?.trim() as StandaloneIframeEmbed['referrerPolicy'],
        allowFullScreen: iframe.hasAttribute('allowfullscreen'),
    };
}

function useResolvedLessonAssetUrl(storagePath: string, storageProvider?: 'supabase' | 'r2', signedUrl?: string | null) {
    const trimmedStoragePath = storagePath.trim();
    const fallbackUrl = signedUrl?.trim() || null;
    const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

    useEffect(() => {
        const nextStoragePath = storagePath.trim();
        if (!nextStoragePath) {
            return;
        }
        let isMounted = true;
        void getSignedLessonContentAssetUrl(nextStoragePath, storageProvider)
            .then((url) => {
                if (isMounted) {
                    setRemoteUrl(url);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setRemoteUrl(null);
                }
            });
        return () => {
            isMounted = false;
        };
    }, [storagePath, storageProvider]);

    if (!trimmedStoragePath) {
        return fallbackUrl;
    }
    return remoteUrl ?? fallbackUrl;
}

function createDefaultBlock(type: Exclude<LessonContentBlock['type'], 'columns'> | 'columns', columnsCount = 2): LessonContentBlock {
    if (type === 'table') {
        return {
            type,
            content: '<table border="1"><thead><tr><th>Cabeçalho</th></tr></thead><tbody><tr><td>Dado</td></tr></tbody></table>',
        };
    }
    if (type === 'image-hotspots') {
        return {
            type,
            content: createEmptyLessonImageHotspotsBlockContent(),
        };
    }
    if (type === 'flashcards') {
        return {
            type,
            content: createEmptyLessonFlashcardsBlockContent(),
        };
    }
    if (type === 'image') {
        return {
            type,
            content: createEmptyLessonImageBlockContent(),
        };
    }
    if (type === 'video') {
        return {
            type,
            content: createEmptyLessonVideoBlockContent(),
        };
    }
    if (type === 'html') {
        return {
            type,
            content: createEmptyLessonHtmlBlockContent(),
        };
    }
    if (type === 'button') {
        return {
            type,
            content: createEmptyLessonButtonBlockContent(),
        };
    }
    if (type === 'columns') {
        return {
            type,
            content: createEmptyColumnsBlockContent(columnsCount),
        };
    }
    return {
        type: 'rich-text',
        content: '<p></p>',
    };
}

type DeletableLessonAsset = {
    storagePath: string;
    storageProvider?: 'supabase' | 'r2';
};

function collectDeletableAssets(block: LessonContentBlock): DeletableLessonAsset[] {
    if (block.type === 'button') {
        if (block.content.source_type === 'local' && block.content.local_config) {
            const assets: DeletableLessonAsset[] = [];
            if (block.content.local_config.action_type === 'file' && block.content.local_config.storage_path) {
                assets.push({
                    storagePath: block.content.local_config.storage_path,
                    storageProvider: 'supabase',
                });
            }
            if (block.content.local_config.action_type === 'modal' && block.content.local_config.modal?.blocks) {
                for (const subBlock of block.content.local_config.modal.blocks) {
                    assets.push(...collectDeletableAssets(subBlock as LessonContentBlock));
                }
            }
            return assets;
        }
        return [];
    }
    if (block.type === 'image-hotspots' && block.content.asset.storage_path) {
        return [{
            storagePath: block.content.asset.storage_path,
            storageProvider: block.content.asset.storage_provider,
        }];
    }
    if (block.type === 'image' && block.content.source_type === 'upload' && block.content.storage_path && !block.content.media_asset_id) {
        return [{
            storagePath: block.content.storage_path,
            storageProvider: block.content.storage_provider,
        }];
    }
    if (block.type === 'video' && block.content.source_type === 'upload' && block.content.storage_path) {
        return [{
            storagePath: block.content.storage_path,
            storageProvider: block.content.storage_provider,
        }];
    }
    if (block.type === 'html' && block.content.source_type === 'upload' && block.content.storage_path) {
        return [{
            storagePath: block.content.storage_path,
            storageProvider: block.content.storage_provider,
        }];
    }
    if (block.type === 'columns') {
        return block.content.flatMap((column) => column.blocks.flatMap((columnBlock) => collectDeletableAssets(columnBlock)));
    }
    return [];
}

function getBlockLabel(block: LessonContentBlock) {
    if (block.type === 'columns') {
        return 'Bloco em Colunas';
    }
    if (block.type === 'table') {
        return 'Bloco de Tabela';
    }
    if (block.type === 'image-hotspots') {
        return 'Bloco de Hotspots';
    }
    if (block.type === 'flashcards') {
        return 'Bloco de Flashcards';
    }
    if (block.type === 'image') {
        return 'Bloco de Imagem';
    }
    if (block.type === 'video') {
        return 'Bloco de Vídeo';
    }
    if (block.type === 'html') {
        return 'Bloco HTML';
    }
    if (block.type === 'button') {
        return 'Bloco de Botão';
    }
    return 'Bloco de Texto Rico';
}

interface LessonImageBlockEditorProps {
    content: LessonImageBlockContent;
    onChange: (content: LessonImageBlockContent) => void;
    onError?: (message: string | null) => void;
    assetContext?: 'lesson' | 'global';
}

export function LessonImageBlockEditor({
    content,
    onChange,
    onError,
    assetContext = 'lesson',
}: LessonImageBlockEditorProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [inputMode, setInputMode] = useState<'url' | 'upload'>(assetContext === 'global' ? 'url' : content.source_type);
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const resolvedUploadUrl = useResolvedLessonAssetUrl(content.storage_path, content.storage_provider, content.signed_url);

    useEffect(() => {
        if (assetContext === 'global') {
            setInputMode('url');
        } else {
            setInputMode(content.source_type);
        }
    }, [content.source_type, assetContext]);

    const previewUrl = content.source_type === 'upload'
        ? (resolvedUploadUrl || content.signed_url?.trim() || content.image_url.trim())
        : content.image_url.trim();

    const sizeClasses = IMAGE_SIZE_CLASSES[content.size];
    const captionAlignmentClass = IMAGE_CAPTION_ALIGNMENT_CLASSES[content.caption_alignment];

    function handleMediaAssetSelected(asset: SiteAsset) {
        const canonicalUrl = resolveSiteAssetPublicUrl(asset);
        setPreviewError(null);
        onError?.(null);
        onChange({
            ...content,
            source_type: assetContext === 'global' ? 'url' : 'upload',
            image_url: canonicalUrl || '',
            storage_path: asset.storage_path || '',
            storage_provider: 'supabase',
            signed_url: canonicalUrl || null,
            file_name: asset.storage_path.split('/').pop() || asset.alt || 'imagem-biblioteca',
            mime_type: asset.mime_type || null,
            alt: content.alt || asset.alt || '',
            media_asset_id: asset.id,
        });
        setIsMediaLibraryOpen(false);
    }

    async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setIsUploading(true);
        setPreviewError(null);
        onError?.(null);
        try {
            const previousStoragePath = (content.source_type === 'upload' && !content.media_asset_id) ? content.storage_path.trim() : '';
            const previousStorageProvider = content.source_type === 'upload' ? content.storage_provider ?? 'supabase' : 'supabase';
            const uploadResult = await uploadLessonContentAsset(file);
            onChange({
                ...content,
                source_type: 'upload',
                image_url: content.image_url,
                storage_path: uploadResult.storage_path,
                storage_provider: uploadResult.storage_provider,
                signed_url: uploadResult.signed_url,
                file_name: file.name,
                mime_type: file.type || null,
                media_asset_id: undefined,
            });
            if (previousStoragePath && previousStoragePath !== uploadResult.storage_path) {
                void deleteLessonContentAsset(previousStoragePath, previousStorageProvider).catch(() => null);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao enviar a imagem.';
            setPreviewError(message);
            onError?.(message);
        }
        finally {
            setIsUploading(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    }

    async function switchToUrlMode() {
        const previousStoragePath = (content.source_type === 'upload' && !content.media_asset_id) ? content.storage_path.trim() : '';
        const previousStorageProvider = content.source_type === 'upload' ? content.storage_provider ?? 'supabase' : 'supabase';
        if (previousStoragePath) {
            try {
                await deleteLessonContentAsset(previousStoragePath, previousStorageProvider);
            }
            catch {
                // Mantém a troca mesmo se a remoção falhar.
            }
        }
        setInputMode('url');
        setPreviewError(null);
        onError?.(null);
        onChange({
            ...content,
            source_type: 'url',
            storage_path: '',
            storage_provider: undefined,
            signed_url: null,
            file_name: '',
            mime_type: null,
            media_asset_id: undefined,
        });
    }

    function switchToUploadMode() {
        setInputMode('upload');
        setPreviewError(null);
        onError?.(null);
        onChange({
            ...content,
            source_type: 'upload',
        });
        setIsMediaLibraryOpen(true);
    }

    function handlePreviewError() {
        if (previewError) {
            return;
        }
        const message = 'Não foi possível carregar a prévia da imagem.';
        setPreviewError(message);
        onError?.(message);
    }

    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-700">Imagem Simples</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">Adicione uma imagem com URL ou upload, legenda e ajuste de tamanho.</p>
                </div>
            </div>
            {assetContext === 'global' ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-sky-900">Biblioteca de Mídia Genflix</p>
                        <p className="text-xs text-sky-700">
                            Em modais globais, selecione a imagem da Biblioteca de Mídia (site_assets) ou use uma URL pública.
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() => setIsMediaLibraryOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 text-xs shadow-sm"
                    >
                        <Library className="h-4 w-4" />
                        {content.image_url ? 'Trocar da Biblioteca' : 'Escolher da Biblioteca'}
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    <button type="button" onClick={() => void switchToUrlMode()} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'url'
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                        <p className="text-xs font-black uppercase tracking-[0.18em]">Imagem via URL</p>
                        <p className={cn('mt-1 text-sm', inputMode === 'url' ? 'text-slate-200' : 'text-slate-500')}>Cole um link de imagem pública.</p>
                    </button>
                    <button type="button" onClick={() => void switchToUploadMode()} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'upload'
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                        <p className="text-xs font-black uppercase tracking-[0.18em]">Imagem por upload</p>
                        <p className={cn('mt-1 text-sm', inputMode === 'upload' ? 'text-slate-200' : 'text-slate-500')}>Envie um arquivo ou selecione da Biblioteca de Mídia.</p>
                    </button>
                </div>
            )}
            <div className={cn('mx-auto overflow-hidden rounded-[24px] border border-dashed border-slate-200 bg-slate-50', sizeClasses)}>
                {previewUrl ? (
                    <img src={previewUrl} alt={content.alt} onError={handlePreviewError} className="h-auto w-full rounded-[18px] object-contain" />
                ) : (
                    <div className="flex min-h-[220px] items-center justify-center rounded-[18px] bg-white text-sm text-slate-500">
                        Prévia da imagem
                    </div>
                )}
                {content.caption ? (
                    <figcaption className={cn('border-t border-slate-100 bg-white px-5 py-3 text-sm text-slate-600', captionAlignmentClass)}>
                        {content.caption}
                    </figcaption>
                ) : null}
            </div>
            {assetContext === 'global' ? (
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ou informe uma URL pública da imagem</span>
                    <input
                        type="url"
                        value={content.image_url}
                        onChange={(event) => {
                            setPreviewError(null);
                            onError?.(null);
                            onChange({
                                ...content,
                                source_type: 'url',
                                image_url: event.target.value,
                                media_asset_id: undefined,
                            });
                        }}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                        placeholder="https://..."
                    />
                </label>
            ) : inputMode === 'url' ? (
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">URL da imagem</span>
                    <input type="url" value={content.image_url} onChange={(event) => {
                        setPreviewError(null);
                        onError?.(null);
                        onChange({ ...content, source_type: 'url', image_url: event.target.value });
                    }} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="https://..." />
                </label>
            ) : (
                <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileSelected(event)} />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            onClick={() => setIsMediaLibraryOpen(true)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2.5 text-xs shadow-sm"
                        >
                            <Library className="h-4 w-4" />
                            {content.media_asset_id ? 'Trocar da Biblioteca' : 'Escolher da Biblioteca'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="inline-flex items-center gap-2 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2.5 text-xs"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <Upload className="h-4 w-4" />
                            {isUploading ? 'Enviando arquivo...' : (content.storage_path && !content.media_asset_id ? 'Trocar arquivo local' : 'Enviar do dispositivo')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="px-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                            onClick={() => void switchToUrlMode()}
                        >
                            Voltar para URL
                        </Button>
                    </div>
                    {content.file_name ? (
                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <div className="flex items-center gap-2 truncate">
                                <span className={cn(
                                    "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                                    content.media_asset_id ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-700"
                                )}>
                                    {content.media_asset_id ? 'Biblioteca de Mídia' : 'Upload Local'}
                                </span>
                                <span className="truncate font-medium">{content.file_name}</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
            <MediaLibraryModal
                isOpen={isMediaLibraryOpen}
                onClose={() => setIsMediaLibraryOpen(false)}
                selectedAssetId={content.media_asset_id}
                title={assetContext === 'global' ? "Escolher imagem para o Modal Global" : "Escolher imagem da Biblioteca de Mídia"}
                onSelect={handleMediaAssetSelected}
            />
            <div className="grid gap-4 md:grid-cols-3">
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ajuste de tamanho</span>
                    <select value={content.size} onChange={(event) => onChange({ ...content, size: event.target.value as LessonImageBlockSize })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                        <option value="sm">Pequeno</option>
                        <option value="md">Médio</option>
                        <option value="lg">Grande</option>
                        <option value="full">Largura total</option>
                    </select>
                </label>
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Texto alternativo</span>
                    <input type="text" value={content.alt} onChange={(event) => onChange({ ...content, alt: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Descrição da imagem para acessibilidade" />
                </label>
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Alinhamento da legenda</span>
                    <select value={content.caption_alignment} onChange={(event) => onChange({ ...content, caption_alignment: event.target.value as LessonImageBlockCaptionAlignment })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                    </select>
                </label>
            </div>
            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Legenda</span>
                <textarea value={content.caption} onChange={(event) => onChange({ ...content, caption: event.target.value })} className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Legenda opcional da imagem" />
            </label>
            {previewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {previewError}
                </div>
            ) : null}
        </div>
    );
}
interface LessonVideoBlockEditorProps {
    content: LessonVideoBlockContent;
    onChange: (content: LessonVideoBlockContent) => void;
    onError?: (message: string | null) => void;
    assetContext?: 'lesson' | 'global';
}

export function LessonVideoBlockEditor({
    content,
    onChange,
    onError,
    assetContext = 'lesson',
}: LessonVideoBlockEditorProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const lastUrlRef = useRef(content.url);
    const [inputMode, setInputMode] = useState<'url' | 'upload'>(assetContext === 'global' ? 'url' : content.source_type);
    const [isUploading, setIsUploading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const resolvedUploadUrl = useResolvedLessonAssetUrl(content.storage_path, content.storage_provider, content.signed_url);

    useEffect(() => {
        if (assetContext === 'global') {
            setInputMode('url');
        } else {
            setInputMode(content.source_type);
        }
    }, [content.source_type, assetContext]);

    useEffect(() => {
        if (content.source_type === 'url' && content.url.trim()) {
            lastUrlRef.current = content.url;
        }
    }, [content.source_type, content.url]);

    const previewUrl = content.source_type === 'upload'
        ? resolvedUploadUrl
        : content.url.trim();
    const embedUrl = previewUrl ? getVideoEmbedUrl(previewUrl) : null;
    const isDirectVideo = previewUrl ? isDirectVideoUrl(previewUrl) : false;

    async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setIsUploading(true);
        setPreviewError(null);
        onError?.(null);
        try {
            const previousStoragePath = content.storage_path.trim();
            const previousStorageProvider = content.storage_provider ?? 'supabase';
            if (content.url.trim()) {
                lastUrlRef.current = content.url;
            }
            const uploadResult = await uploadLessonContentAsset(file);
            onChange({
                source_type: 'upload',
                url: '',
                storage_path: uploadResult.storage_path,
                storage_provider: uploadResult.storage_provider,
                signed_url: uploadResult.signed_url,
                file_name: file.name,
                mime_type: file.type || null,
                caption: content.caption,
                size: content.size,
                caption_alignment: content.caption_alignment,
            });
            if (previousStoragePath && previousStoragePath !== uploadResult.storage_path) {
                void deleteLessonContentAsset(previousStoragePath, previousStorageProvider).catch(() => null);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao enviar o vídeo.';
            setPreviewError(message);
            onError?.(message);
        }
        finally {
            setIsUploading(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    }

    async function switchToUrlMode() {
        const previousStoragePath = content.storage_path.trim();
        const previousStorageProvider = content.storage_provider ?? 'supabase';
        if (previousStoragePath) {
            try {
                await deleteLessonContentAsset(previousStoragePath, previousStorageProvider);
            }
            catch {
                // Mantém a troca mesmo se a remoção falhar.
            }
        }
        setInputMode('url');
        onChange({
            ...content,
            source_type: 'url',
            url: lastUrlRef.current || content.url,
            storage_path: '',
            storage_provider: undefined,
            signed_url: null,
            file_name: '',
            mime_type: null,
        });
    }

    function activateUrlMode() {
        setInputMode('url');
        void switchToUrlMode();
    }

    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-700">Vídeo</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">Use uma URL externa ou envie um arquivo de vídeo protegido.</p>
                </div>
            </div>

            {assetContext === 'global' ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                    <p className="text-xs font-bold text-sky-900">Vídeo Externo para Modal Global</p>
                    <p className="mt-0.5 text-xs text-sky-700">
                        Como este modal é reutilizável globalmente, utilize um link público (YouTube, Vimeo ou arquivo direto MP4). Uploads locais de aula estão desabilitados neste contexto.
                    </p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    <button type="button" onClick={() => void activateUrlMode()} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'url'
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                        <p className="text-xs font-black uppercase tracking-[0.18em]">Vídeo via URL</p>
                        <p className={cn('mt-1 text-sm', inputMode === 'url' ? 'text-slate-200' : 'text-slate-500')}>Cole um link do YouTube, Vimeo ou um arquivo direto.</p>
                    </button>
                    <button type="button" onClick={() => {
                        setInputMode('upload');
                        onChange({
                            ...content,
                            source_type: 'upload',
                        });
                    }} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'upload'
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                        <p className="text-xs font-black uppercase tracking-[0.18em]">Vídeo por upload</p>
                        <p className={cn('mt-1 text-sm', inputMode === 'upload' ? 'text-slate-200' : 'text-slate-500')}>Envie um arquivo e o bloco guarda o asset protegido.</p>
                    </button>
                </div>
            )}

            {assetContext === 'global' || inputMode === 'url' ? (
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">URL do vídeo</span>
                    <input type="url" value={content.url} onChange={(event) => {
                        lastUrlRef.current = event.target.value;
                        onChange({ ...content, source_type: 'url', url: event.target.value });
                    }} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="https://..." />
                </label>
            ) : (
                <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => void handleFileSelected(event)} />
                    <Button type="button" variant="outline" className="rounded-2xl border-slate-200 bg-white" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        {content.storage_path ? 'Trocar vídeo' : 'Enviar vídeo'}
                    </Button>
                    {content.storage_path ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            {content.file_name || 'Vídeo enviado'}
                        </div>
                    ) : null}
                    <Button type="button" variant="ghost" className="px-0 text-xs font-bold text-slate-500 hover:text-slate-800" onClick={() => void switchToUrlMode()}>
                        Voltar para URL
                    </Button>
                </div>
            )}

            <div className={cn('mx-auto overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50', VIDEO_SIZE_CLASSES[content.size])}>
                {previewUrl ? (
                    embedUrl ? (
                        <iframe title="Prévia do vídeo" src={embedUrl} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full border-0 bg-black" />
                    ) : isDirectVideo ? (
                        <video className="aspect-video w-full bg-black" controls preload="metadata" src={previewUrl}>
                            O navegador não suporta reprodução de vídeo.
                        </video>
                    ) : (
                        <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-slate-500">
                            A URL será usada como referência do vídeo.
                        </div>
                    )
                ) : (
                    <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-slate-500">
                        Prévia do vídeo
                    </div>
                )}
            </div>

            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tamanho do vídeo</span>
                <select value={content.size} onChange={(event) => onChange({ ...content, size: event.target.value as LessonVideoBlockSize })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                    <option value="sm">Pequeno</option>
                    <option value="md">Médio</option>
                    <option value="lg">Grande</option>
                    <option value="full">Largura total</option>
                </select>
            </label>

            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Alinhamento da legenda</span>
                <select value={content.caption_alignment} onChange={(event) => onChange({ ...content, caption_alignment: event.target.value as LessonVideoBlockCaptionAlignment })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                </select>
            </label>

            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Legenda</span>
                <textarea value={content.caption} onChange={(event) => onChange({ ...content, caption: event.target.value })} className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Legenda opcional do vídeo" />
            </label>

            {previewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {previewError}
                </div>
            ) : null}
        </div>
    );
}

function isHtmlFile(file: File) {
    const lowerName = file.name.toLowerCase();
    return lowerName.endsWith('.html')
        || lowerName.endsWith('.htm')
        || file.type === 'text/html'
        || file.type === 'application/xhtml+xml';
}

function getHtmlUploadContentType(file: File) {
    if (file.type === 'text/html' || file.type === 'application/xhtml+xml') {
        return file.type;
    }
    return file.type || 'text/html';
}

const HTML_PREVIEW_STYLES = `<style>
  html, body {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }

  *, *::before, *::after {
    box-sizing: inherit;
  }

  img, video, canvas, svg, iframe {
    display: block;
    max-width: 100%;
  }

  img, video, canvas, svg {
    height: auto;
  }

  table {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    word-break: break-word;
  }

  pre, code, blockquote {
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  body > * {
    max-width: 100%;
  }
</style>`;

function stripPreviewBlockingMetaTags(html: string) {
    return html
        .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
        .replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, '');
}

function injectResponsivePreviewStyles(html: string) {
    if (/<head[\s>]/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, `<head$1>${HTML_PREVIEW_STYLES}`);
    }

    if (/<html[\s>]/i.test(html)) {
        return html.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8" />${HTML_PREVIEW_STYLES}</head>`);
    }

    return html;
}

function buildHtmlPreviewSrcDoc(html: string) {
    const trimmed = html.trim();
    const sanitized = injectResponsivePreviewStyles(stripPreviewBlockingMetaTags(trimmed));

    if (!trimmed) {
        return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><div style="font-family:sans-serif;padding:24px;color:#64748b;">Nenhum HTML foi informado.</div></body></html>';
    }
    if (/^<!doctype\s+html|^<html[\s>]/i.test(trimmed)) {
        return sanitized;
    }
    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${HTML_PREVIEW_STYLES}
    <style>
      html, body { margin: 0; padding: 0; background: #fff; }
      body { min-height: 100vh; }
    </style>
  </head>
  <body>
    ${sanitized}
  </body>
</html>`;
}

interface LessonHtmlBlockEditorProps {
    content: LessonHtmlBlockContent;
    onChange: (content: LessonHtmlBlockContent) => void;
    onError?: (message: string | null) => void;
}

export function LessonHtmlBlockEditor({ content, onChange, onError }: LessonHtmlBlockEditorProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const dragDepthRef = useRef(0);
    const [inputMode, setInputMode] = useState<'paste' | 'upload'>(content.source_type);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    useEffect(() => {
        setInputMode(content.source_type);
    }, [content.source_type]);

    async function ingestHtmlFile(file: File) {
        setIsUploading(true);
        setPreviewError(null);
        onError?.(null);
        try {
            const html = await file.text();
            const previousStoragePath = content.source_type === 'upload' ? content.storage_path.trim() : '';
            const previousStorageProvider = content.source_type === 'upload' ? content.storage_provider ?? 'supabase' : 'supabase';
            const uploadResult = await uploadLessonContentAsset(file, {
                contentType: getHtmlUploadContentType(file),
            });
            onChange({
                ...content,
                source_type: 'upload',
                html,
                storage_path: uploadResult.storage_path,
                storage_provider: uploadResult.storage_provider,
                signed_url: uploadResult.signed_url,
                file_name: file.name,
                mime_type: file.type || 'text/html',
            });
            if (previousStoragePath && previousStoragePath !== uploadResult.storage_path) {
                void deleteLessonContentAsset(previousStoragePath, previousStorageProvider).catch(() => null);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao enviar o arquivo HTML.';
            setPreviewError(message);
            onError?.(message);
        }
        finally {
            setIsUploading(false);
        }
    }

    async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!isHtmlFile(file)) {
            const message = 'Selecione um arquivo .html ou .htm.';
            setPreviewError(message);
            onError?.(message);
            event.target.value = '';
            return;
        }
        await ingestHtmlFile(file);
        event.target.value = '';
    }

    function resetDragState() {
        dragDepthRef.current = 0;
        setIsDragActive(false);
    }

    function handleUploadDragEnter(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current += 1;
        setIsDragActive(true);
    }

    function handleUploadDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragActive(true);
    }

    function handleUploadDragLeave(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
        if (dragDepthRef.current === 0) {
            setIsDragActive(false);
        }
    }

    async function handleUploadDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        resetDragState();
        const file = Array.from(event.dataTransfer.files).find(isHtmlFile);
        if (!file) {
            const message = 'Solte um arquivo .html ou .htm.';
            setPreviewError(message);
            onError?.(message);
            return;
        }
        await ingestHtmlFile(file);
    }

    async function switchToPasteMode() {
        const previousStoragePath = content.source_type === 'upload' ? content.storage_path.trim() : '';
        const previousStorageProvider = content.source_type === 'upload' ? content.storage_provider ?? 'supabase' : 'supabase';
        if (previousStoragePath) {
            try {
                await deleteLessonContentAsset(previousStoragePath, previousStorageProvider);
            }
            catch {
                // Mantém a troca mesmo se a remoção falhar.
            }
        }
        setInputMode('paste');
        setPreviewError(null);
        onError?.(null);
        onChange({
            ...content,
            source_type: 'paste',
            storage_path: '',
            storage_provider: undefined,
            signed_url: null,
            file_name: '',
            mime_type: null,
        });
    }

    function switchToUploadMode() {
        setInputMode('upload');
        setPreviewError(null);
        onError?.(null);
        onChange({
            ...content,
            source_type: 'upload',
        });
    }

    const standaloneIframe = parseStandaloneIframeEmbed(content.html);

    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-700">HTML Complexo</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">Cole o HTML ou envie um arquivo .html para renderização isolada na aula.</p>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <button type="button" onClick={() => void switchToPasteMode()} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'paste'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                    <p className="text-xs font-black uppercase tracking-[0.18em]">Colar HTML</p>
                    <p className={cn('mt-1 text-sm', inputMode === 'paste' ? 'text-slate-200' : 'text-slate-500')}>Edite ou cole o documento HTML completo diretamente no bloco.</p>
                </button>
                <button type="button" onClick={() => void switchToUploadMode()} className={cn('rounded-2xl border px-4 py-4 text-left transition', inputMode === 'upload'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                    <p className="text-xs font-black uppercase tracking-[0.18em]">Subir arquivo</p>
                    <p className={cn('mt-1 text-sm', inputMode === 'upload' ? 'text-slate-200' : 'text-slate-500')}>Envie um arquivo .html com apresentação, animações ou interações.</p>
                </button>
            </div>

            {inputMode === 'paste' ? (
                <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Código HTML</span>
                    <textarea value={content.html} onChange={(event) => {
                        setPreviewError(null);
                        onError?.(null);
                        onChange({
                            ...content,
                            source_type: 'paste',
                            html: event.target.value,
                        });
                    }} className="min-h-[280px] w-full rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-[13px] leading-6 text-emerald-300 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="<!doctype html>..." />
                </label>
    ) : (
                <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept=".html,.htm,text/html,application/xhtml+xml" className="hidden" onChange={(event) => void handleFileSelected(event)} />
                    <div
                        className={cn(
                            'rounded-[24px] border-2 border-dashed px-4 py-5 transition-all duration-200',
                            isDragActive
                                ? 'border-sky-500 bg-sky-50 shadow-[0_0_0_6px_rgba(14,165,233,0.12)]'
                                : 'border-slate-200 bg-white',
                        )}
                        onDragEnter={handleUploadDragEnter}
                        onDragOver={handleUploadDragOver}
                        onDragLeave={handleUploadDragLeave}
                        onDrop={(event) => void handleUploadDrop(event)}
                    >
                        <div className="space-y-3">
                            <div>
                                <p className={cn('text-sm font-semibold transition-colors', isDragActive ? 'text-sky-700' : 'text-slate-700')}>
                                    {isDragActive ? 'Solte o arquivo HTML para enviar' : 'Arraste e solte o arquivo HTML aqui'}
                                </p>
                                <p className={cn('mt-1 text-sm transition-colors', isDragActive ? 'text-sky-600' : 'text-slate-500')}>
                                    Também é possível clicar no botão abaixo para selecionar um arquivo.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button type="button" variant="outline" className="rounded-2xl border-slate-200 bg-white" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                    {content.storage_path ? 'Trocar arquivo' : 'Enviar arquivo HTML'}
                                </Button>
                                <Button type="button" variant="ghost" className="px-0 text-xs font-bold text-slate-500 hover:text-slate-800" onClick={() => void switchToPasteMode()}>
                                    Voltar para colagem
                                </Button>
                            </div>
                            {content.file_name ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    {content.file_name}
                                </div>
                            ) : (
                                <p className={cn('text-sm transition-colors', isDragActive ? 'text-sky-600' : 'text-slate-500')}>
                                    {isDragActive ? 'Pronto para receber o arquivo.' : 'Arquivo HTML ainda não enviado.'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                {standaloneIframe ? (
                    <iframe
                        title={standaloneIframe.title || 'Prévia do HTML'}
                        src={standaloneIframe.src}
                        allow={standaloneIframe.allow ?? undefined}
                        allowFullScreen={standaloneIframe.allowFullScreen}
                        loading={standaloneIframe.loading ?? undefined}
                        referrerPolicy={standaloneIframe.referrerPolicy ?? 'no-referrer'}
                        className="h-[72vh] min-h-[560px] w-full border-0 bg-white"
                    />
                ) : (
                    <iframe title="Prévia do HTML" srcDoc={buildHtmlPreviewSrcDoc(content.html)} sandbox="allow-scripts allow-forms allow-popups allow-modals" referrerPolicy="no-referrer" className="h-[72vh] min-h-[560px] w-full border-0 bg-white" />
                )}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Arquivos HTML com scripts funcionam melhor quando são autossuficientes. Recursos relativos precisam estar embutidos ou apontar para URLs públicas.
            </div>

            {previewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {previewError}
                </div>
            ) : null}
        </div>
    );
}

interface LessonImageBlockRendererProps {
    content: LessonImageBlockContent;
}

export function LessonImageBlockRenderer({ content }: LessonImageBlockRendererProps) {
    const sizeClasses = IMAGE_SIZE_CLASSES[content.size];
    const captionAlignmentClass = IMAGE_CAPTION_ALIGNMENT_CLASSES[content.caption_alignment];
    const resolvedUploadUrl = useResolvedLessonAssetUrl(content.storage_path, content.storage_provider, content.signed_url);
    const previewUrl = content.source_type === 'upload'
        ? (resolvedUploadUrl || content.signed_url?.trim() || content.image_url.trim())
        : content.image_url.trim();

    return (
        <figure className={cn('my-8 mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm', sizeClasses)}>
            {previewUrl ? (
                <img src={previewUrl} alt={content.alt} className="h-auto w-full object-contain" />
            ) : (
                <div className="flex min-h-[220px] items-center justify-center bg-slate-50 px-6 text-sm text-slate-500">
                    Imagem não configurada.
                </div>
            )}
            {content.caption ? (
                <figcaption className={cn('border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600', captionAlignmentClass)}>
                    {content.caption}
                </figcaption>
            ) : null}
        </figure>
    );
}

interface LessonHtmlBlockRendererProps {
    content: LessonHtmlBlockContent;
}

export function LessonHtmlBlockRenderer({ content }: LessonHtmlBlockRendererProps) {
    const standaloneIframe = parseStandaloneIframeEmbed(content.html);

    return (
        <figure className="my-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            {standaloneIframe ? (
                <iframe
                    title={standaloneIframe.title || content.file_name || 'HTML da aula'}
                    src={standaloneIframe.src}
                    allow={standaloneIframe.allow ?? undefined}
                    allowFullScreen={standaloneIframe.allowFullScreen}
                    loading={standaloneIframe.loading ?? undefined}
                    referrerPolicy={standaloneIframe.referrerPolicy ?? 'no-referrer'}
                    className="h-[80vh] min-h-[640px] w-full border-0 bg-white"
                />
            ) : (
                <iframe title={content.file_name || 'HTML da aula'} srcDoc={buildHtmlPreviewSrcDoc(content.html)} sandbox="allow-scripts allow-forms allow-popups allow-modals" referrerPolicy="no-referrer" className="h-[80vh] min-h-[640px] w-full border-0 bg-white" />
            )}
        </figure>
    );
}
interface LessonVideoBlockRendererProps {
    content: LessonVideoBlockContent;
}

export function LessonVideoBlockRenderer({ content }: LessonVideoBlockRendererProps) {
    const resolvedUploadUrl = useResolvedLessonAssetUrl(content.storage_path, content.storage_provider, content.signed_url);
    const previewUrl = content.source_type === 'upload'
        ? resolvedUploadUrl
        : content.url.trim();
    const sizeClasses = VIDEO_SIZE_CLASSES[content.size];
    const captionAlignmentClass = VIDEO_CAPTION_ALIGNMENT_CLASSES[content.caption_alignment];
    const embedUrl = previewUrl ? getVideoEmbedUrl(previewUrl) : null;
    const isDirectVideo = previewUrl ? isDirectVideoUrl(previewUrl) : false;

    return (
        <figure className={cn('my-8 mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm', sizeClasses)}>
            <div className="bg-slate-50">
                {previewUrl ? (
                    embedUrl ? (
                        <iframe title="Vídeo da aula" src={embedUrl} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full border-0 bg-black" />
                    ) : isDirectVideo ? (
                        <video className="aspect-video w-full bg-black" controls preload="metadata" src={previewUrl}>
                            O navegador não suporta reprodução de vídeo.
                        </video>
                    ) : (
                        <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-slate-500">
                            O vídeo será carregado a partir da URL informada.
                        </div>
                    )
                ) : (
                    <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-slate-500">
                        Vídeo não configurado.
                    </div>
                )}
            </div>
            {content.caption ? (
                <figcaption className={cn('border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600', captionAlignmentClass)}>
                    {content.caption}
                </figcaption>
            ) : null}
        </figure>
    );
}

export interface LessonContentBlocksEditorProps {
    blocks: LessonContentBlock[];
    onChange: (blocks: LessonContentBlock[]) => void;
    onError?: (message: string | null) => void;
    level?: number;
    allowEmptyState?: boolean;
    excludedBlockTypes?: Array<LessonContentBlock['type']>;
    assetContext?: 'lesson' | 'global';
}

export function LessonContentBlocksEditor({
    blocks,
    onChange,
    onError,
    level = 0,
    allowEmptyState = false,
    excludedBlockTypes,
    assetContext = 'lesson',
}: LessonContentBlocksEditorProps) {
    const [editingButtonBlockIndex, setEditingButtonBlockIndex] = useState<number | null>(null);
    const [globalButtonsMap, setGlobalButtonsMap] = useState<Record<string, GlobalButtonDefinition | null>>({});

    const referencedGlobalIds = useMemo(() => {
        const ids: string[] = [];
        const scan = (items: LessonContentBlock[]) => {
            for (const item of items) {
                if (item.type === 'button' && item.content.source_type === 'global' && item.content.global_button_id) {
                    ids.push(item.content.global_button_id);
                } else if (item.type === 'columns') {
                    for (const col of item.content) {
                        scan(col.blocks);
                    }
                }
            }
        };
        scan(blocks);
        return Array.from(new Set(ids));
    }, [blocks]);

    useEffect(() => {
        if (referencedGlobalIds.length === 0) return;
        let isMounted = true;
        void fetchGlobalButtonsBatchAdmin(referencedGlobalIds).then((items) => {
            if (!isMounted) return;
            const map: Record<string, GlobalButtonDefinition> = {};
            for (const item of items) {
                map[item.id] = item;
            }
            setGlobalButtonsMap(map);
        }).catch((err) => {
            console.error('Erro ao verificar botões globais no editor:', err);
        });
        return () => {
            isMounted = false;
        };
    }, [referencedGlobalIds]);

    const updateBlock = (index: number, nextBlock: LessonContentBlock) => {
        onChange(blocks.map((block, blockIndex) => (blockIndex === index ? nextBlock : block)));
    };

    const removeBlock = async (index: number) => {
        if (blocks.length <= 1 && !allowEmptyState) {
            return;
        }
        const blockToRemove = blocks[index];
        if (!window.confirm('Excluir este bloco de conteúdo?')) {
            return;
        }
        const assetEntries = blockToRemove
            ? collectDeletableAssets(blockToRemove).filter((entry, index, entries) => entries.findIndex((candidate) => candidate.storagePath === entry.storagePath) === index)
            : [];
        for (const assetEntry of assetEntries) {
            try {
                await deleteLessonContentAsset(assetEntry.storagePath, assetEntry.storageProvider ?? 'supabase');
            }
            catch (error) {
                console.error('Erro ao remover asset do bloco:', error);
            }
        }
        const nextBlocks = blocks.filter((_, blockIndex) => blockIndex !== index);
        onChange(nextBlocks);
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= blocks.length) {
            return;
        }
        const next = [...blocks];
        const temp = next[index];
        next[index] = next[targetIndex];
        next[targetIndex] = temp;
        onChange(next);
    };

    const addBlock = (type: LessonContentBlock['type'], columnsCount = 2) => {
        const newBlock = createDefaultBlock(type, columnsCount);
        const nextBlocks = [...blocks, newBlock];
        onChange(nextBlocks);
        if (type === 'button') {
            setEditingButtonBlockIndex(nextBlocks.length - 1);
        }
    };

    const addBarClassName = level === 0
        ? 'border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50'
        : 'rounded-2xl border border-slate-200 bg-slate-50/40';

    return (
        <div className={level === 0 ? 'space-y-8' : 'space-y-4'}>
            {blocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Sem blocos inseridos
                </div>
            ) : null}
            {blocks.map((block, index) => (
                <div key={`${block.type}-${index}`} className={cn('group relative rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-md', level > 0 && 'bg-white')}>
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-[10px] font-black text-blue-700">
                                {index + 1}
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                {getBlockLabel(block)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600" onClick={() => void removeBlock(index)}>
                                ×
                            </Button>
                        </div>
                    </div>

                    {block.type === 'table' ? (
                        <div className="space-y-4">
                            <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-inner overflow-x-auto">
                                <div className="mb-2 text-[10px] font-black uppercase text-blue-500">Prévia da Tabela</div>
                                <div className="table-content min-w-full" dangerouslySetInnerHTML={{ __html: sanitizeTableHtml(block.content) }} />
                            </div>
                            <div className="space-y-2">
                                <div className="text-[10px] font-black uppercase text-slate-400">Editor de HTML</div>
                                <textarea className="min-h-[150px] w-full rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-[13px] leading-relaxed text-emerald-400 shadow-inner transition-all focus:ring-4 focus:ring-blue-100" value={block.content} onChange={(event) => updateBlock(index, { ...block, content: event.target.value })} placeholder="<table>...</table>" />
                            </div>
                        </div>
                    ) : block.type === 'image-hotspots' ? (
                        <LessonImageHotspotsBlockEditor content={block.content} onChange={(nextContent) => updateBlock(index, { ...block, content: nextContent })} onError={onError} />
                    ) : block.type === 'flashcards' ? (
                        <LessonFlashcardsBlockEditor content={block.content} onChange={(nextContent) => updateBlock(index, { ...block, content: nextContent })} onError={onError} />
                    ) : block.type === 'image' ? (
                        <LessonImageBlockEditor content={block.content} onChange={(nextContent) => updateBlock(index, { ...block, content: nextContent })} onError={onError} assetContext={assetContext} />
                    ) : block.type === 'html' ? (
                        <LessonHtmlBlockEditor content={block.content} onChange={(nextContent) => updateBlock(index, { ...block, content: nextContent })} onError={onError} />
                    ) : block.type === 'video' ? (
                        <LessonVideoBlockEditor content={block.content} onChange={(nextContent) => updateBlock(index, { ...block, content: nextContent })} onError={onError} assetContext={assetContext} />
                    ) : block.type === 'button' ? (() => {
                        const isGlobal = block.content.source_type === 'global';
                        const globalId = block.content.global_button_id;
                        const hasGlobalResolved = globalId ? globalButtonsMap[globalId] : undefined;
                        const isGlobalNotFound = isGlobal && globalId && Object.keys(globalButtonsMap).length > 0 && !hasGlobalResolved;
                        const isGlobalInactive = isGlobal && hasGlobalResolved && !hasGlobalResolved.is_active;

                        const handleConvertToLocal = () => {
                            const cached = block.content.cached_action;
                            const convertedLocalConfig: LessonButtonBlockLocalConfig = cached ? {
                                label: cached.label,
                                template_id: cached.template_id,
                                template: cached.template,
                                variant: cached.variant,
                                theme: cached.theme,
                                icon: cached.icon,
                                action_type: cached.action_type,
                                url: cached.url,
                                open_target: cached.open_target,
                                storage_path: cached.storage_path,
                                file_name: cached.file_name,
                                file_size_bytes: cached.file_size_bytes,
                                modal: cached.modal,
                            } : {
                                label: 'Botão Local',
                                template_id: null,
                                action_type: 'url',
                                url: 'https://',
                                open_target: 'new-tab',
                                variant: 'outline',
                                theme: 'blue',
                                icon: 'link',
                            };

                            updateBlock(index, {
                                ...block,
                                content: {
                                    source_type: 'local',
                                    alignment: block.content.alignment ?? 'left',
                                    width: block.content.width ?? 'auto',
                                    local_config: convertedLocalConfig,
                                    cached_action: null,
                                    global_button_id: null,
                                },
                            });
                        };

                        return (
                            <div className={cn(
                                'flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all',
                                isGlobalNotFound
                                    ? 'border-rose-300 bg-rose-50/60 shadow-xs'
                                    : isGlobalInactive
                                    ? 'border-amber-300 bg-amber-50/60 shadow-xs'
                                    : 'border-amber-200 bg-amber-50/40'
                            )}>
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={cn(
                                            'text-xs font-bold uppercase tracking-wider',
                                            isGlobalNotFound ? 'text-rose-800' : isGlobalInactive ? 'text-amber-900' : 'text-amber-800'
                                        )}>
                                            {isGlobal ? 'Botão da Biblioteca Global' : 'Botão Customizado'}
                                        </span>
                                        {isGlobalNotFound ? (
                                            <span className="text-[11px] rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-700 border border-rose-300">
                                                Não encontrado / Removido
                                            </span>
                                        ) : isGlobalInactive ? (
                                            <span className="text-[11px] rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800 border border-amber-300">
                                                Global Desativado
                                            </span>
                                        ) : (
                                            <span className="text-[11px] rounded bg-white px-2 py-0.5 font-semibold text-slate-600 border border-slate-200">
                                                {isGlobal
                                                    ? 'Referência Dinâmica'
                                                    : block.content.local_config?.action_type === 'modal'
                                                    ? 'Ação: Modal'
                                                    : block.content.local_config?.action_type === 'file'
                                                    ? 'Ação: Arquivo'
                                                    : 'Ação: Link'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {isGlobal
                                            ? (hasGlobalResolved?.label || block.content.cached_action?.label || 'Botão Global')
                                            : (block.content.local_config?.label || 'Sem rótulo')}
                                    </p>
                                    {isGlobalNotFound && (
                                        <p className="text-xs text-rose-600 font-medium">
                                            O botão global referenciado não existe nesta base. O aluno não poderá executá-lo.
                                        </p>
                                    )}
                                    {isGlobalInactive && (
                                        <p className="text-xs text-amber-700 font-medium">
                                            Este botão está desativado na biblioteca global e aparecerá desabilitado para os alunos.
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {isGlobalNotFound && block.content.cached_action && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleConvertToLocal}
                                            className="bg-white hover:bg-rose-100 hover:text-rose-900 border-rose-300 font-semibold text-xs"
                                        >
                                            Converter em Botão Local
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingButtonBlockIndex(index)}
                                        className="bg-white hover:bg-amber-100 hover:text-amber-900 border-amber-300 font-semibold text-xs"
                                    >
                                        Configurar Botão
                                    </Button>
                                </div>
                            </div>
                        );
                    })() : block.type === 'columns' ? (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Layout em colunas</p>
                                    <p className="text-xs text-slate-500">Cada coluna pode receber qualquer tipo de bloco disponível.</p>
                                </div>
                                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    Quantidade:
                                    <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold" value={block.content.length} onChange={(event) => {
                                        const nextCount = Number.parseInt(event.target.value, 10);
                                        if (!Number.isFinite(nextCount)) {
                                            return;
                                        }
                                        const safeCount = Math.min(4, Math.max(1, nextCount));
                                        const removedColumns = block.content.slice(safeCount);
                                        const removedAssets = removedColumns
                                            .flatMap((column) => column.blocks.flatMap((columnBlock) => collectDeletableAssets(columnBlock)))
                                            .filter((entry, entryIndex, entries) => entries.findIndex((candidate) => candidate.storagePath === entry.storagePath) === entryIndex);
                                        void Promise.all(removedAssets.map(async (assetEntry) => {
                                            try {
                                                await deleteLessonContentAsset(assetEntry.storagePath, assetEntry.storageProvider ?? 'supabase');
                                            }
                                            catch (error) {
                                                console.error('Erro ao remover asset da coluna:', error);
                                            }
                                        }));
                                        const preservedColumns = block.content.slice(0, safeCount);
                                        const nextColumns = createEmptyColumnsBlockContent(safeCount);
                                        preservedColumns.forEach((column, columnIndex) => {
                                            if (nextColumns[columnIndex]) {
                                                nextColumns[columnIndex].blocks = column.blocks;
                                            }
                                        });
                                        updateBlock(index, {
                                            ...block,
                                            content: nextColumns,
                                        });
                                    }}>
                                        <option value="1">1 coluna</option>
                                        <option value="2">2 colunas</option>
                                        <option value="3">3 colunas</option>
                                        <option value="4">4 colunas</option>
                                    </select>
                                </label>
                            </div>

                            <div className={`grid grid-cols-1 gap-4 ${block.content.length === 1 ? 'md:grid-cols-1' : block.content.length === 2 ? 'md:grid-cols-2' : block.content.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
                                {block.content.map((column, columnIndex) => (
                                    <div key={`column-editor-${index}-${columnIndex}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                Coluna {columnIndex + 1}
                                            </p>
                                            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                                Largura
                                                <select
                                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
                                                    value={column.width}
                                                    onChange={(event) => {
                                                        const nextWidth = Number.parseInt(event.target.value, 10);
                                                        if (!Number.isFinite(nextWidth)) {
                                                            return;
                                                        }
                                                        const nextWidths = distributeColumnWidths(block.content.length, columnIndex, nextWidth);
                                                        const nextColumns = block.content.map((item, itemIndex) => ({
                                                            ...item,
                                                            width: nextWidths[itemIndex] ?? item.width,
                                                        }));
                                                        updateBlock(index, {
                                                            ...block,
                                                            content: nextColumns,
                                                        });
                                                    }}
                                                >
                                                    {buildColumnWidthOptions(block.content.length).map((option) => (
                                                        <option key={`column-width-${index}-${columnIndex}-${option}`} value={option}>
                                                            {option}%
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                        <LessonContentBlocksEditor
                                            blocks={column.blocks}
                                            level={level + 1}
                                            allowEmptyState
                                            onError={onError}
                                            excludedBlockTypes={excludedBlockTypes}
                                            assetContext={assetContext}
                                            onChange={(nextBlocks) => {
                                                const nextColumns: LessonColumnsBlockContent = [...block.content];
                                                nextColumns[columnIndex] = {
                                                    ...nextColumns[columnIndex],
                                                    blocks: nextBlocks,
                                                };
                                                updateBlock(index, { ...block, content: nextColumns });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <ReactQuill theme="snow" value={block.content} onChange={(value: string) => updateBlock(index, { ...block, content: value })} modules={FULL_QUILL_MODULES} formats={FULL_QUILL_FORMATS} enableHtmlMode placeholder="Escreva aqui o texto da aula..." />
                    )}
                </div>
            ))}

            <div className={cn('flex flex-wrap items-center gap-3 p-4', addBarClassName)}>
                <span className="mr-2 text-xs font-bold text-slate-500">Adicionar bloco:</span>
                {!excludedBlockTypes?.includes('rich-text') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('rich-text')} className="border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600">
                        + Texto
                    </Button>
                )}
                {!excludedBlockTypes?.includes('image') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('image')} className="border-slate-200 bg-white hover:bg-sky-50 hover:text-sky-700">
                        + Imagem
                    </Button>
                )}
                {!excludedBlockTypes?.includes('html') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('html')} className="border-slate-200 bg-white hover:bg-slate-900 hover:text-white">
                        + HTML
                    </Button>
                )}
                {!excludedBlockTypes?.includes('video') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('video')} className="border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700">
                        + Vídeo
                    </Button>
                )}
                {!excludedBlockTypes?.includes('table') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('table')} className="border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-600">
                        + Tabela
                    </Button>
                )}
                {!excludedBlockTypes?.includes('image-hotspots') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('image-hotspots')} className="border-slate-200 bg-white hover:bg-violet-50 hover:text-violet-600">
                        + Hotspots
                    </Button>
                )}
                {!excludedBlockTypes?.includes('flashcards') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('flashcards')} className="border-slate-200 bg-white hover:bg-teal-50 hover:text-teal-700">
                        + Flashcards
                    </Button>
                )}
                {!excludedBlockTypes?.includes('button') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBlock('button')} className="border-slate-200 bg-white hover:bg-amber-50 hover:text-amber-700">
                        + Botão
                    </Button>
                )}
                {!excludedBlockTypes?.includes('columns') && (
                    <>
                        <div className="mx-1 h-6 w-px bg-slate-200" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Colunas:</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('columns', 1)} className="border-slate-200 bg-white hover:bg-cyan-50 hover:text-cyan-700">
                            1
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('columns', 2)} className="border-slate-200 bg-white hover:bg-cyan-50 hover:text-cyan-700">
                            2
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('columns', 3)} className="border-slate-200 bg-white hover:bg-cyan-50 hover:text-cyan-700">
                            3
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('columns', 4)} className="border-slate-200 bg-white hover:bg-cyan-50 hover:text-cyan-700">
                            4
                        </Button>
                    </>
                )}
            </div>

            {editingButtonBlockIndex !== null && blocks[editingButtonBlockIndex]?.type === 'button' ? (
                <LessonButtonBlockModal
                    isOpen={true}
                    onClose={() => setEditingButtonBlockIndex(null)}
                    initialContent={(blocks[editingButtonBlockIndex] as LessonContentBlock & { type: 'button' }).content}
                    onSave={(updatedContent) => {
                        updateBlock(editingButtonBlockIndex, {
                            type: 'button',
                            content: updatedContent,
                        });
                        setEditingButtonBlockIndex(null);
                    }}
                    renderBlockEditor={({ blocks, onChange }) => (
                        <LessonContentBlocksEditor
                            blocks={blocks}
                            onChange={onChange}
                            level={1}
                            allowEmptyState={false}
                            excludedBlockTypes={['button', 'image-hotspots', 'flashcards']}
                            assetContext={assetContext}
                        />
                    )}
                />
            ) : null}
        </div>
    );
}

interface LessonContentBlockRendererProps {
    blocks: LessonContentBlock[];
    className?: string;
    resolvedGlobalButtons?: Record<string, GlobalButtonDefinition>;
}

export function LessonContentBlocksRenderer({ blocks, className, resolvedGlobalButtons }: LessonContentBlockRendererProps) {
    return (
        <div className={className}>
            {blocks.map((block, index) => {
                if (block.type === 'columns') {
                    const columnsCount = Math.min(4, Math.max(1, block.content.length));
                    const columnsTemplate = getColumnsTemplateValue(block.content);
                    const columnsWidths = getColumnsWidthsAttributeValue(block.content);
                    return (
                        <div
                            key={`columns-${index}`}
                            className={`genflix-columns genflix-columns-${columnsCount}`}
                            data-hcm-column-widths={columnsWidths}
                            style={{
                                '--hcm-columns-template': columnsTemplate,
                            } as CSSProperties}
                        >
                            {block.content.map((column, columnIndex) => (
                                <div key={`columns-${index}-${columnIndex}`} className="genflix-column">
                                    <LessonContentBlocksRenderer blocks={column.blocks} resolvedGlobalButtons={resolvedGlobalButtons} />
                                </div>
                            ))}
                        </div>
                    );
                }
                if (block.type === 'table') {
                    return (
                        <div key={`table-${index}`} className="my-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="table-content min-w-full" dangerouslySetInnerHTML={{ __html: sanitizeTableHtml(block.content) }} />
                        </div>
                    );
                }
                if (block.type === 'image-hotspots') {
                    return <LessonImageHotspotsBlockRenderer key={`image-hotspots-${index}`} content={block.content} />;
                }
                if (block.type === 'flashcards') {
                    return <LessonFlashcardsBlockRenderer key={`flashcards-${index}`} content={block.content} />;
                }
                if (block.type === 'image') {
                    return <LessonImageBlockRenderer key={`image-${index}`} content={block.content} />;
                }
                if (block.type === 'html') {
                    return <LessonHtmlBlockRenderer key={`html-${index}`} content={block.content} />;
                }
                if (block.type === 'video') {
                    return <LessonVideoBlockRenderer key={`video-${index}`} content={block.content} />;
                }
                if (block.type === 'button') {
                    const resolvedGlobal = block.content.source_type === 'global' && block.content.global_button_id
                        ? resolvedGlobalButtons?.[block.content.global_button_id]
                        : undefined;
                    return (
                        <div key={`button-${index}`} className="my-6 flex flex-wrap items-center">
                            <LessonActionButton
                                blockContent={block.content}
                                resolvedGlobalButton={resolvedGlobal}
                                renderModalBlocks={(modalBlocks) => (
                                    <LessonContentBlocksRenderer
                                        blocks={modalBlocks as LessonContentBlock[]}
                                        resolvedGlobalButtons={resolvedGlobalButtons}
                                    />
                                )}
                            />
                        </div>
                    );
                }
                return <div key={`rich-${index}`} className="lesson-rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(block.content) }} />;
            })}
        </div>
    );
}
