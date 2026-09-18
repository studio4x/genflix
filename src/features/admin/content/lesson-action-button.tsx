import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    getLessonFooterButtonClassName,
    renderButtonTemplateIcon,
    getLessonFooterActionIconName,
} from '@/features/admin/content/button-template-icons';
import { getSignedLessonFooterActionUrl, toErrorMessage } from '@/features/admin/content/api';
import { cn } from '@/lib/utils';
import type {
    ButtonActionType,
    ButtonOpenTarget,
    ButtonTemplate,
    GlobalButtonDefinition,
    LessonButtonBlockAlignment,
    LessonButtonBlockContent,
    LessonButtonBlockWidth,
    LessonFooterAction,
} from '@/types/content';

export interface LessonActionButtonProps {
    // Modo 1: Configuração direta ou Bloco
    label?: string;
    template?: ButtonTemplate | null;
    action_type?: ButtonActionType;
    url?: string | null;
    open_target?: ButtonOpenTarget;
    storage_path?: string | null;
    file_name?: string | null;
    modal_title?: string | null;
    modal_blocks?: unknown[] | null;

    // Modo 2: Passar objeto LessonFooterAction completo
    footerAction?: LessonFooterAction | null;

    // Modo 3: Passar bloco LessonButtonBlockContent com resolução global opcional
    blockContent?: LessonButtonBlockContent | null;
    resolvedGlobalButton?: GlobalButtonDefinition | null;

    // Layout
    alignment?: LessonButtonBlockAlignment;
    width?: LessonButtonBlockWidth;

    // Estados e Modos
    disabled?: boolean;
    previewMode?: boolean;
    className?: string;

    // Callback para renderizar blocos internos do modal
    renderModalBlocks?: (blocks: unknown[]) => ReactNode;
}

function openTargetUrl(url: string, target: ButtonOpenTarget = 'new-tab') {
    if (target === 'same-tab') {
        window.location.assign(url);
        return;
    }
    if (target === 'new-window') {
        window.open(url, '_blank', 'noopener,noreferrer,width=1280,height=800');
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

export function LessonActionButton({
    label: propLabel,
    template: propTemplate,
    action_type: propActionType,
    url: propUrl,
    open_target: propOpenTarget,
    storage_path: propStoragePath,
    file_name: propFileName,
    modal_title: propModalTitle,
    modal_blocks: propModalBlocks,
    footerAction,
    blockContent,
    resolvedGlobalButton,
    alignment: propAlignment,
    width: propWidth,
    disabled = false,
    previewMode = false,
    className,
    renderModalBlocks,
}: LessonActionButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // 1. Resolver dados a partir do footerAction, blockContent ou props diretas
    let effectiveLabel = propLabel ?? '';
    let effectiveTemplate: ButtonTemplate | null = propTemplate ?? null;
    let effectiveActionType: ButtonActionType = propActionType ?? 'url';
    let effectiveUrl = propUrl ?? '';
    let effectiveOpenTarget: ButtonOpenTarget = propOpenTarget ?? 'new-tab';
    let effectiveStoragePath = propStoragePath ?? null;
    let effectiveFileName = propFileName ?? null;
    let effectiveModalTitle = propModalTitle ?? '';
    let effectiveModalBlocks: unknown[] = (propModalBlocks as unknown[]) ?? [];
    let effectiveAlignment: LessonButtonBlockAlignment = propAlignment ?? 'left';
    let effectiveWidth: LessonButtonBlockWidth = propWidth ?? 'auto';
    let effectiveIcon: string | null = null;
    let isGlobalInactive = false;
    let isGlobalUnavailable = false;

    if (footerAction) {
        if (footerAction.global_button_id) {
            const globalRef = footerAction.global_button;
            if (globalRef) {
                if (globalRef.is_active) {
                    effectiveLabel = footerAction.label || globalRef.label;
                    effectiveTemplate = footerAction.template || globalRef.template || null;
                    effectiveActionType = globalRef.action_type;
                    effectiveUrl = globalRef.url || '';
                    effectiveOpenTarget = globalRef.open_target || 'new-tab';
                    effectiveStoragePath = globalRef.storage_path;
                    effectiveFileName = globalRef.file_name;
                    effectiveModalTitle = globalRef.modal_title || '';
                    effectiveModalBlocks = (globalRef.modal_blocks as unknown[]) || [];
                } else {
                    isGlobalInactive = true;
                    effectiveLabel = 'Botão indisponível';
                    effectiveTemplate = footerAction.template || globalRef.template || null;
                }
            } else {
                isGlobalUnavailable = true;
                effectiveLabel = 'Botão indisponível';
                effectiveTemplate = footerAction.template || null;
            }
        } else {
            effectiveLabel = footerAction.label ?? footerAction.file_name ?? footerAction.template?.default_label ?? 'Recurso';
            effectiveTemplate = footerAction.template ?? null;
            effectiveActionType = footerAction.action_type;
            effectiveUrl = footerAction.url ?? '';
            effectiveOpenTarget = footerAction.open_target ?? (footerAction.open_in_new_tab ? 'new-tab' : 'same-tab');
            effectiveStoragePath = footerAction.storage_path ?? null;
            effectiveFileName = footerAction.file_name ?? null;
            effectiveModalTitle = footerAction.modal_title ?? '';
            effectiveModalBlocks = (footerAction.modal_blocks as unknown[]) || [];
        }
        effectiveIcon = getLessonFooterActionIconName(footerAction);
    } else if (blockContent) {
        effectiveAlignment = blockContent.alignment ?? 'left';
        effectiveWidth = blockContent.width ?? 'auto';

        if (blockContent.source_type === 'global') {
            if (resolvedGlobalButton) {
                if (resolvedGlobalButton.is_active) {
                    effectiveLabel = resolvedGlobalButton.label;
                    effectiveTemplate = resolvedGlobalButton.template || null;
                    effectiveActionType = resolvedGlobalButton.action_type;
                    effectiveUrl = resolvedGlobalButton.url || '';
                    effectiveOpenTarget = resolvedGlobalButton.open_target || 'new-tab';
                    effectiveStoragePath = resolvedGlobalButton.storage_path;
                    effectiveFileName = resolvedGlobalButton.file_name;
                    effectiveModalTitle = resolvedGlobalButton.modal_title || '';
                    effectiveModalBlocks = (resolvedGlobalButton.modal_blocks as unknown[]) || [];
                    effectiveIcon = resolvedGlobalButton.template?.icon || null;
                } else {
                    isGlobalInactive = true;
                    effectiveLabel = 'Botão indisponível';
                    effectiveTemplate = resolvedGlobalButton.template || blockContent.cached_action?.template || null;
                    effectiveIcon = resolvedGlobalButton.template?.icon || blockContent.cached_action?.icon || 'link';
                }
            } else {
                // Global button not resolved in database (orphaned, deleted or inactive for student)
                isGlobalUnavailable = true;
                effectiveLabel = 'Botão indisponível';
                effectiveTemplate = blockContent.cached_action?.template || null;
                effectiveIcon = blockContent.cached_action?.icon || 'link';
            }
        } else if (blockContent.local_config) {
            const local = blockContent.local_config;
            effectiveLabel = local.label;
            effectiveTemplate = local.template || null;
            effectiveActionType = local.action_type;
            effectiveUrl = local.url || '';
            effectiveOpenTarget = local.open_target || 'new-tab';
            effectiveStoragePath = local.storage_path || null;
            effectiveFileName = local.file_name || null;
            effectiveModalTitle = local.modal?.title || '';
            effectiveModalBlocks = (local.modal?.blocks as unknown[]) || [];
            effectiveIcon = local.icon || null;
        }
    }

    if (!effectiveLabel && effectiveFileName) {
        effectiveLabel = effectiveFileName;
    }

    if (!effectiveIcon) {
        effectiveIcon = effectiveTemplate?.icon ?? (effectiveActionType === 'file' ? 'download' : effectiveActionType === 'modal' ? 'book-open' : 'link');
    }

    const isEffectivelyDisabled = disabled || isGlobalInactive || isGlobalUnavailable || isLoadingFile || (effectiveActionType === 'url' && !effectiveUrl) || (effectiveActionType === 'file' && !effectiveStoragePath) || (effectiveActionType === 'modal' && !effectiveModalTitle);

    async function handleExecuteAction() {
        if (isGlobalInactive || isGlobalUnavailable || isEffectivelyDisabled) {
            return;
        }

        if (previewMode) {
            if (effectiveActionType === 'modal') {
                setIsModalOpen(true);
            }
            return;
        }

        setErrorMessage(null);

        if (effectiveActionType === 'url') {
            if (!effectiveUrl) {
                return;
            }
            openTargetUrl(effectiveUrl, effectiveOpenTarget);
            return;
        }

        if (effectiveActionType === 'file') {
            if (!effectiveStoragePath) {
                return;
            }
            setIsLoadingFile(true);
            try {
                const signedUrl = await getSignedLessonFooterActionUrl(effectiveStoragePath);
                openTargetUrl(signedUrl, effectiveOpenTarget);
            } catch (err) {
                setErrorMessage(toErrorMessage(err));
            } finally {
                setIsLoadingFile(false);
            }
            return;
        }

        if (effectiveActionType === 'modal') {
            setIsModalOpen(true);
        }
    }

    const alignmentClasses: Record<LessonButtonBlockAlignment, string> = {
        left: 'text-left justify-start',
        center: 'text-center justify-center',
        right: 'text-right justify-end',
    };

    return (
        <div className={cn('my-3 flex w-full', alignmentClasses[effectiveAlignment])}>
            <Button
                type="button"
                variant="outline"
                disabled={isEffectivelyDisabled}
                onClick={() => void handleExecuteAction()}
                className={cn(
                    getLessonFooterButtonClassName(effectiveTemplate),
                    (isGlobalInactive || isGlobalUnavailable) && 'opacity-60 cursor-not-allowed filter grayscale hover:opacity-60',
                    effectiveWidth === 'full' && 'w-full justify-center',
                    'inline-flex items-center gap-2',
                    (isGlobalInactive || isGlobalUnavailable) ? 'cursor-not-allowed' : 'cursor-pointer',
                    className
                )}
            >
                {isLoadingFile ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                ) : (
                    renderButtonTemplateIcon(effectiveIcon)
                )}
                <span>{effectiveLabel || 'Botão'}</span>
            </Button>

            {errorMessage ? (
                <div className="mt-1 text-xs text-rose-600">{errorMessage}</div>
            ) : null}

            {/* Modal Dialog Acessível */}
            {effectiveActionType === 'modal' && (
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col p-0 rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
                            <DialogTitle className="text-xl font-black text-slate-900">
                                {effectiveModalTitle || 'Material Complementar'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Conteúdo complementar da aula.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                            {effectiveModalBlocks && effectiveModalBlocks.length > 0 ? (
                                renderModalBlocks ? (
                                    renderModalBlocks(effectiveModalBlocks)
                                ) : (
                                    <div className="space-y-4">
                                        {effectiveModalBlocks.map((rawBlock, idx) => {
                                            const block = rawBlock as {
                                                type?: string;
                                                content?: string | { image_url?: string; signed_url?: string; alt?: string };
                                            };
                                            return (
                                                <div key={idx} className="prose max-w-none text-slate-800">
                                                    {block.type === 'rich-text' && typeof block.content === 'string' ? (
                                                        <div dangerouslySetInnerHTML={{ __html: block.content }} />
                                                    ) : block.type === 'image' && typeof block.content === 'object' ? (
                                                        <img src={block.content?.image_url || block.content?.signed_url} alt={block.content?.alt || ''} className="rounded-xl max-h-96 mx-auto" />
                                                    ) : (
                                                        <div className="text-sm text-slate-600">{JSON.stringify(block)}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                                    Nenhum conteúdo configurado para este modal.
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
