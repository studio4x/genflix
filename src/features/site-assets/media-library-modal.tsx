import { useState, useEffect, useMemo } from 'react';
import { X, Search, Upload, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchSiteAssets, uploadSiteAsset, resolveSiteAssetPublicUrl } from '@/features/site-editor/api';
import type { SiteAsset } from '@/features/site-editor/types';
import {
    filterSiteAssetLibrary,
    resolveSiteAssetLibraryLabel,
    type SiteAssetLibraryFilter,
} from './library-utils';

export type MediaLibraryAssetCategory = 'image' | 'video' | 'audio' | 'document' | 'all';

export interface MediaLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: SiteAsset) => void;
    selectedAssetId?: string | null;
    title?: string;
    acceptedAssetTypes?: MediaLibraryAssetCategory[];
}

const IMAGE_FILTER_OPTIONS: { value: SiteAssetLibraryFilter; label: string }[] = [
    { value: 'all', label: 'Todas as imagens' },
    { value: 'raster', label: 'Imagens (PNG, JPG, WEBP)' },
    { value: 'svg', label: 'Vetores SVG' },
    { value: 'gif', label: 'Animações GIF' },
    { value: 'avif', label: 'Formato AVIF' },
];

const ALL_FILTER_OPTIONS: { value: SiteAssetLibraryFilter; label: string }[] = [
    { value: 'all', label: 'Todas as mídias' },
    { value: 'raster', label: 'Imagens (PNG, JPG, WEBP)' },
    { value: 'svg', label: 'Vetores SVG' },
    { value: 'gif', label: 'Animações GIF' },
    { value: 'avif', label: 'Formato AVIF' },
    { value: 'other', label: 'Outros arquivos' },
];

function isImageAsset(asset: SiteAsset): boolean {
    const mime = (asset.mime_type ?? '').toLowerCase();
    const path = (asset.storage_path ?? '').toLowerCase();
    return mime.startsWith('image/') || mime.includes('svg') || /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(path);
}

export function MediaLibraryModal({
    isOpen,
    onClose,
    onSelect,
    selectedAssetId,
    title = 'Escolher imagem da Biblioteca de Mídia',
    acceptedAssetTypes = ['image'],
}: MediaLibraryModalProps) {
    const [assets, setAssets] = useState<SiteAsset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<SiteAssetLibraryFilter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(selectedAssetId ?? null);
    const [error, setError] = useState<string | null>(null);

    const isImageOnly = acceptedAssetTypes.length === 1 && acceptedAssetTypes[0] === 'image';
    const filterOptions = isImageOnly ? IMAGE_FILTER_OPTIONS : ALL_FILTER_OPTIONS;

    useEffect(() => {
        if (!isOpen) return;

        setSelectedId(selectedAssetId ?? null);
        setError(null);
        let isMounted = true;
        setIsLoading(true);

        void fetchSiteAssets(240)
            .then((loadedAssets) => {
                if (isMounted) {
                    if (isImageOnly) {
                        setAssets(loadedAssets.filter(isImageAsset));
                    } else {
                        setAssets(loadedAssets);
                    }
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Não foi possível carregar a Biblioteca de Mídia.');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, selectedAssetId, isImageOnly]);

    const filteredAssets = useMemo(() => {
        return filterSiteAssetLibrary(assets, search, filter);
    }, [assets, search, filter]);

    const activeSelectedAsset = useMemo(() => {
        return assets.find((a) => a.id === selectedId) || null;
    }, [assets, selectedId]);

    async function handleFileUpload(file: File) {
        setIsUploading(true);
        setError(null);
        try {
            const uploadedAsset = await uploadSiteAsset(file, { alt: file.name.replace(/\.[^/.]+$/, '') });
            setAssets((prev) => [uploadedAsset, ...prev]);
            setSelectedId(uploadedAsset.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao enviar a imagem para a Biblioteca de Mídia.');
        } finally {
            setIsUploading(false);
        }
    }

    function handleApply() {
        if (activeSelectedAsset) {
            onSelect(activeSelectedAsset);
            onClose();
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0A3640]/60 p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[#D8E6EB] bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#D8E6EB] px-5 py-4 bg-[#F8FBFC]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">
                            Biblioteca de Mídia Genflix
                        </p>
                        <h3 className="mt-0.5 font-readex text-lg font-semibold text-[#15323b]">
                            {title}
                        </h3>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-9 w-9 rounded-xl text-[#5F7077] hover:bg-slate-100 hover:text-[#15323b]"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Barra de Filtros e Upload */}
                    <div className="grid gap-3 rounded-[20px] border border-[#D8E6EB] bg-[#F8FBFC] p-4 md:grid-cols-[minmax(0,1fr),200px,auto]">
                        <label className="grid gap-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                                Buscar na biblioteca
                            </span>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-[#5F7077]" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por nome, alt ou extensão..."
                                    className="h-10 w-full rounded-xl border border-[#D8E6EB] bg-white pl-9 pr-3 text-xs font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                                />
                            </div>
                        </label>

                        <label className="grid gap-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                                Tipo de mídia
                            </span>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as SiteAssetLibraryFilter)}
                                className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-xs font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                            >
                                {filterOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="flex items-end">
                            <label className={cn(
                                'cursor-pointer inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1398B7] px-4 text-xs font-bold text-white hover:bg-[#1089A5] transition w-full md:w-auto',
                                isUploading && 'opacity-60 cursor-not-allowed'
                            )}>
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        Nova Mídia
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isUploading}
                                    className="sr-only"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleFileUpload(file);
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    {/* Grid de Imagens */}
                    {isLoading ? (
                        <div className="py-16 text-center text-sm font-semibold text-[#5F7077]">
                            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[#1398B7]" />
                            Carregando Biblioteca de Mídia...
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] p-8 text-center text-sm font-semibold text-[#5F7077]">
                            <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                            Nenhuma imagem encontrada na Biblioteca de Mídia.
                            <p className="mt-1 text-xs text-[#5F7077]">Clique em "Nova Mídia" para enviar a primeira imagem.</p>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] p-8 text-center text-sm font-semibold text-[#5F7077]">
                            Nenhuma mídia corresponde aos filtros digitados.
                        </div>
                    ) : (
                        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredAssets.map((asset) => {
                                const isSelected = selectedId === asset.id;
                                const publicUrl = resolveSiteAssetPublicUrl(asset);

                                return (
                                    <button
                                        key={asset.id}
                                        type="button"
                                        onClick={() => setSelectedId(asset.id)}
                                        className={cn(
                                            'group relative overflow-hidden rounded-[16px] border text-left transition-all bg-white',
                                            isSelected
                                                ? 'border-[#1398B7] ring-2 ring-[#1398B7]/30 shadow-md'
                                                : 'border-[#D8E6EB] hover:border-[#B8D8E1]'
                                        )}
                                    >
                                        <div className="relative aspect-[16/10] w-full bg-[#EAF2F5] flex items-center justify-center overflow-hidden p-2">
                                            {publicUrl ? (
                                                <img
                                                    src={publicUrl}
                                                    alt={asset.alt ?? 'Imagem da biblioteca'}
                                                    className="h-full w-full object-contain transition group-hover:scale-105"
                                                />
                                            ) : (
                                                <ImageIcon className="h-8 w-8 text-[#5F7077]/40" />
                                            )}

                                            {isSelected && (
                                                <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1398B7] text-white shadow-sm">
                                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-0.5 p-3">
                                            <p className="truncate text-xs font-black text-[#15323b]">
                                                {resolveSiteAssetLibraryLabel(asset)}
                                            </p>
                                            <p className="text-[10px] font-semibold text-[#5F7077]">
                                                {new Date(asset.created_at).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-2 border-t border-[#D8E6EB] bg-[#F8FBFC] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="h-11 w-full rounded-xl border-[#D8E6EB] bg-white text-[#15323b] hover:bg-[#F2F7F9] sm:w-auto font-bold text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleApply}
                        disabled={!activeSelectedAsset}
                        className="h-11 w-full rounded-xl bg-[#1398B7] px-6 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-[#1089A5] sm:w-auto disabled:opacity-40"
                    >
                        Usar imagem selecionada
                    </Button>
                </div>
            </div>
        </div>
    );
}
