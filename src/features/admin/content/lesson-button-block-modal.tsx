import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    BUTTON_ICON_OPTIONS,
    getLessonFooterButtonClassName,
    getLessonFooterButtonStyle,
    BUTTON_THEME_OPTIONS,
    BUTTON_VARIANT_OPTIONS,
    getButtonThemeLabel,
    getButtonVariantLabel,
    renderButtonTemplateIcon,
} from '@/features/admin/content/button-template-icons';
import {
    fetchButtonTemplates,
    fetchGlobalButtons,
    toErrorMessage,
} from '@/features/admin/content/api';
import { LessonActionButton } from '@/features/admin/content/lesson-action-button';
import { DEFAULT_MODAL_TITLE, DEFAULT_MODAL_SUBTITLE, type LessonContentBlock } from '@/features/admin/content/content-blocks';
import { cn } from '@/lib/utils';
import type {
    ButtonActionType,
    ButtonOpenTarget,
    ButtonTemplate,
    GlobalButtonDefinition,
    LessonButtonBlockAlignment,
    LessonButtonBlockContent,
    LessonButtonBlockLocalConfig,
    LessonButtonBlockWidth,
} from '@/types/content';

const VARIANTS = BUTTON_VARIANT_OPTIONS;
const THEMES = BUTTON_THEME_OPTIONS;

const OPEN_TARGET_OPTIONS: Array<{ label: string; value: ButtonOpenTarget }> = [
    { label: 'Nova aba', value: 'new-tab' },
    { label: 'Mesma página', value: 'same-tab' },
    { label: 'Nova janela', value: 'new-window' },
];

export interface LessonButtonBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialContent?: LessonButtonBlockContent | null;
    onSave: (content: LessonButtonBlockContent) => void;
    renderBlockEditor?: (props: {
        blocks: LessonContentBlock[];
        onChange: (blocks: LessonContentBlock[]) => void;
    }) => ReactNode;
}

export function LessonButtonBlockModal({
    isOpen,
    onClose,
    initialContent,
    onSave,
    renderBlockEditor,
}: LessonButtonBlockModalProps) {
    const [tab, setTab] = useState<'global' | 'template' | 'local'>('global');
    const [templates, setTemplates] = useState<ButtonTemplate[]>([]);
    const [globalButtons, setGlobalButtons] = useState<GlobalButtonDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estado do bloco
    const [sourceType, setSourceType] = useState<'local' | 'global'>('global');
    const [selectedGlobalButtonId, setSelectedGlobalButtonId] = useState<string | null>(null);
    const [alignment, setAlignment] = useState<LessonButtonBlockAlignment>('left');
    const [width, setWidth] = useState<LessonButtonBlockWidth>('auto');

    // Estado local configurável
    const [label, setLabel] = useState('Clique aqui');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [variant, setVariant] = useState<ButtonTemplate['variant']>('outline');
    const [theme, setTheme] = useState<ButtonTemplate['theme']>('blue');
    const [customBackgroundColor, setCustomBackgroundColor] = useState<string | null>(null);
    const [customTextColor, setCustomTextColor] = useState<string | null>(null);
    const [icon, setIcon] = useState('link');
    const [actionType, setActionType] = useState<ButtonActionType>('url');
    const [url, setUrl] = useState('https://');
    const [openTarget, setOpenTarget] = useState<ButtonOpenTarget>('new-tab');
    const [modalTitle, setModalTitle] = useState(DEFAULT_MODAL_TITLE);
    const [modalSubtitle, setModalSubtitle] = useState<string>(DEFAULT_MODAL_SUBTITLE);
    const [modalBlocks, setModalBlocks] = useState<LessonContentBlock[]>([
        { type: 'rich-text', content: '<p>Insira aqui o texto complementar deste modal...</p>' },
    ]);
    const [isEditingModalBlocks, setIsEditingModalBlocks] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                const [temps, globals] = await Promise.all([
                    fetchButtonTemplates(),
                    fetchGlobalButtons(),
                ]);
                setTemplates(temps.filter((t) => t.is_active));
                setGlobalButtons(globals.filter((g) => g.is_active));
            } catch (err) {
                setError(toErrorMessage(err));
            } finally {
                setIsLoading(false);
            }
        }
        void load();
    }, [isOpen]);

    useEffect(() => {
        if (!initialContent) {
            setSourceType('global');
            setTab('global');
            setAlignment('left');
            setWidth('auto');
            setSelectedGlobalButtonId(null);
            setLabel('Clique aqui');
            setUrl('https://');
            setOpenTarget('new-tab');
            setActionType('url');
            setVariant('outline');
            setTheme('blue');
            setCustomBackgroundColor(null);
            setCustomTextColor(null);
            setModalTitle(DEFAULT_MODAL_TITLE);
            setModalSubtitle(DEFAULT_MODAL_SUBTITLE);
            return;
        }

        setAlignment(initialContent.alignment ?? 'left');
        setWidth(initialContent.width ?? 'auto');
        setSourceType(initialContent.source_type);

        if (initialContent.source_type === 'global' && initialContent.global_button_id) {
            setSelectedGlobalButtonId(initialContent.global_button_id);
            setTab('global');
            if (initialContent.cached_action) {
                const c = initialContent.cached_action;
                setLabel(c.label ?? 'Clique aqui');
                setSelectedTemplateId(c.template_id ?? '');
                setVariant(c.variant ?? 'outline');
                setTheme(c.theme ?? 'blue');
                setCustomBackgroundColor(c.custom_background_color ?? c.template?.custom_background_color ?? null);
                setCustomTextColor(c.custom_text_color ?? c.template?.custom_text_color ?? null);
                setIcon(c.icon ?? 'link');
                setActionType(c.action_type ?? 'url');
                setUrl(c.url ?? 'https://');
                setOpenTarget(c.open_target ?? 'new-tab');
                if (c.modal) {
                    setModalTitle(c.modal.title ?? DEFAULT_MODAL_TITLE);
                    setModalSubtitle(c.modal.subtitle ?? DEFAULT_MODAL_SUBTITLE);
                    setModalBlocks((c.modal.blocks as LessonContentBlock[]) ?? []);
                }
            }
        } else if (initialContent.local_config) {
            setTab('local');
            const loc = initialContent.local_config;
            setLabel(loc.label ?? 'Clique aqui');
            setSelectedTemplateId(loc.template_id ?? '');
            setVariant(loc.variant ?? 'outline');
            setTheme(loc.theme ?? 'blue');
            setCustomBackgroundColor(loc.custom_background_color ?? loc.template?.custom_background_color ?? null);
            setCustomTextColor(loc.custom_text_color ?? loc.template?.custom_text_color ?? null);
            setIcon(loc.icon ?? 'link');
            setActionType(loc.action_type ?? 'url');
            setUrl(loc.url ?? 'https://');
            setOpenTarget(loc.open_target ?? 'new-tab');
            if (loc.modal) {
                setModalTitle(loc.modal.title ?? DEFAULT_MODAL_TITLE);
                setModalSubtitle(loc.modal.subtitle ?? DEFAULT_MODAL_SUBTITLE);
                setModalBlocks((loc.modal.blocks as LessonContentBlock[]) ?? []);
            }
        }
    }, [initialContent, isOpen]);

    function handleSelectGlobalButton(btn: GlobalButtonDefinition) {
        setSelectedGlobalButtonId(btn.id);
        setSourceType('global');
    }

    function handleApplyTemplate(tmpl: ButtonTemplate) {
        setSelectedTemplateId(tmpl.id);
        setLabel(tmpl.default_label || label);
        setVariant(tmpl.variant);
        setTheme(tmpl.theme);
        setCustomBackgroundColor(tmpl.custom_background_color ?? null);
        setCustomTextColor(tmpl.custom_text_color ?? null);
        setIcon(tmpl.icon || 'link');
        setTab('local');
        setSourceType('local');
    }

    function handleSave() {
        if (sourceType === 'global') {
            if (!selectedGlobalButtonId) {
                setError('Selecione um botão global.');
                return;
            }
            const found = globalButtons.find((g) => g.id === selectedGlobalButtonId);
            const cached: LessonButtonBlockLocalConfig | null = found
                ? {
                      template_id: found.template_id,
                      template: found.template ?? null,
                      label: found.label,
                      variant: found.template?.variant ?? 'outline',
                      theme: found.template?.theme ?? 'blue',
                      custom_background_color: found.template?.custom_background_color ?? null,
                      custom_text_color: found.template?.custom_text_color ?? null,
                      icon: found.template?.icon ?? 'link',
                      action_type: found.action_type,
                      url: found.url,
                      open_target: found.open_target,
                      storage_path: found.storage_path,
                      file_name: found.file_name,
                      mime_type: found.mime_type,
                      file_size_bytes: found.file_size_bytes,
                      modal: found.action_type === 'modal' ? { title: found.modal_title || DEFAULT_MODAL_TITLE, subtitle: found.modal_subtitle ?? DEFAULT_MODAL_SUBTITLE, blocks: found.modal_blocks } : null,
                  }
                : null;

            onSave({
                source_type: 'global',
                alignment,
                width,
                global_button_id: selectedGlobalButtonId,
                cached_action: cached,
            });
        } else {
            if (!label.trim()) {
                setError('O rótulo do botão é obrigatório.');
                return;
            }
            if (actionType === 'url' && (!url.trim() || url === 'https://')) {
                setError('Informe uma URL válida para o botão.');
                return;
            }
            if (actionType === 'modal' && !modalTitle.trim()) {
                setError('Informe o título do modal.');
                return;
            }

            const chosenTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
            onSave({
                source_type: 'local',
                alignment,
                width,
                local_config: {
                    template_id: selectedTemplateId || null,
                    template: chosenTemplate,
                    label: label.trim(),
                    variant,
                    theme,
                    custom_background_color: customBackgroundColor,
                    custom_text_color: customTextColor,
                    icon,
                    action_type: actionType,
                    url: actionType === 'url' ? url.trim() : null,
                    open_target: openTarget,
                    modal: actionType === 'modal' ? { title: modalTitle.trim(), subtitle: modalSubtitle, blocks: modalBlocks } : null,
                },
            });
        }
        onClose();
    }

    const currentSelectedGlobal = globalButtons.find((g) => g.id === selectedGlobalButtonId) ?? null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/60">
                    <DialogTitle className="text-xl font-black text-slate-900">
                        {initialContent ? 'Editar Bloco de Botão' : 'Adicionar Bloco de Botão'}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Escolha um botão da biblioteca global ou configure um botão personalizado com link, arquivo ou modal.
                    </DialogDescription>

                    {/* Abas Superiores */}
                    <div className="mt-4 flex gap-2 rounded-2xl bg-slate-200/60 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setTab('global');
                                setSourceType('global');
                            }}
                            className={cn(
                                'flex-1 rounded-xl py-2 text-xs font-black transition-all',
                                tab === 'global' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            )}
                        >
                            Biblioteca Global ({globalButtons.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('template')}
                            className={cn(
                                'flex-1 rounded-xl py-2 text-xs font-black transition-all',
                                tab === 'template' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            )}
                        >
                            Padrões Visuais ({templates.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setTab('local');
                                setSourceType('local');
                            }}
                            className={cn(
                                'flex-1 rounded-xl py-2 text-xs font-black transition-all',
                                tab === 'local' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            )}
                        >
                            Configuração Local
                        </button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                            {error}
                        </div>
                    )}

                    {/* ABA 1: BIBLIOTECA GLOBAL */}
                    {tab === 'global' && (
                        <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                Botões Reutilizáveis Cadastrados
                            </p>
                            {isLoading ? (
                                <p className="text-sm text-slate-500">Carregando botões globais...</p>
                            ) : globalButtons.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                                    Nenhum botão global cadastrado na biblioteca.
                                    <div className="mt-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setTab('local');
                                                setSourceType('local');
                                            }}
                                        >
                                            Criar Botão Local
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {globalButtons.map((btn) => {
                                        const isSelected = selectedGlobalButtonId === btn.id;
                                        return (
                                            <div
                                                key={btn.id}
                                                onClick={() => handleSelectGlobalButton(btn)}
                                                className={cn(
                                                    'cursor-pointer rounded-2xl border p-4 transition-all',
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-200'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-800">{btn.name}</span>
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">
                                                        {btn.action_type === 'modal' ? 'Modal' : btn.action_type === 'file' ? 'Arquivo' : 'Link'}
                                                    </span>
                                                </div>
                                                <div className="mt-3">
                                                    <LessonActionButton
                                                        label={btn.label}
                                                        template={btn.template}
                                                        action_type={btn.action_type}
                                                        previewMode
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {currentSelectedGlobal && (
                                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 text-xs text-blue-900">
                                    <strong>Botão selecionado:</strong> {currentSelectedGlobal.name} ({currentSelectedGlobal.label}) • Ação: {currentSelectedGlobal.action_type.toUpperCase()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABA 2: PADRÕES VISUAIS */}
                    {tab === 'template' && (
                        <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                Escolha um Padrão Visual como Base
                            </p>
                            <p className="text-xs text-slate-500">
                                Selecionar um padrão copia o tema, ícone e variante para você configurar a ação a seguir.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {templates.map((tmpl) => (
                                    <div
                                        key={tmpl.id}
                                        className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-800">{tmpl.name}</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                                                onClick={() => handleApplyTemplate(tmpl)}
                                            >
                                                Usar Este
                                            </Button>
                                        </div>
                                        <div className="mt-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                style={getLessonFooterButtonStyle(tmpl)}
                                                className={getLessonFooterButtonClassName(tmpl)}
                                            >
                                                {renderButtonTemplateIcon(tmpl.icon)}
                                                <span>{tmpl.default_label || tmpl.name}</span>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ABA 3: CONFIGURAÇÃO LOCAL */}
                    {tab === 'local' && (
                        <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Rótulo do Botão</span>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                        placeholder="Ex: Baixar Guia Prático"
                                    />
                                </label>

                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Padrão Visual Base</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                        value={selectedTemplateId}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            setSelectedTemplateId(id);
                                            const found = templates.find((t) => t.id === id);
                                            if (found) {
                                                setVariant(found.variant);
                                                setTheme(found.theme);
                                                setIcon(found.icon);
                                            }
                                        }}
                                    >
                                        <option value="">Personalizado (Sem padrão específico)</option>
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name} ({getButtonVariantLabel(t.variant)} • {getButtonThemeLabel(t.theme)})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {/* Customização de Estilo */}
                            <div className="grid gap-4 sm:grid-cols-3">
                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Variante</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                        value={variant}
                                        onChange={(e) => setVariant(e.target.value as ButtonTemplate['variant'])}
                                    >
                                        {VARIANTS.map((v) => (
                                            <option key={v.value} value={v.value}>
                                                {v.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Tema de Cor</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value as ButtonTemplate['theme'])}
                                    >
                                        {THEMES.map((th) => (
                                            <option key={th.value} value={th.value}>
                                                {th.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Ícone</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                        value={icon}
                                        onChange={(e) => setIcon(e.target.value)}
                                    >
                                        {BUTTON_ICON_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {/* Tipo de Ação */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                    Configuração da Ação
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('url')}
                                        className={cn(
                                            'rounded-xl py-2.5 text-xs font-bold transition-all border',
                                            actionType === 'url'
                                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        )}
                                    >
                                        Abrir Link (URL)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionType('modal')}
                                        className={cn(
                                            'rounded-xl py-2.5 text-xs font-bold transition-all border',
                                            actionType === 'modal'
                                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        )}
                                    >
                                        Abrir Modal com Blocos
                                    </button>
                                </div>

                                {actionType === 'url' && (
                                    <div className="space-y-3 pt-2">
                                        <label className="block space-y-1">
                                            <span className="text-xs font-bold text-slate-700">URL de Destino</span>
                                            <input
                                                type="url"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                                placeholder="https://exemplo.com/material"
                                            />
                                        </label>

                                        <label className="block space-y-1">
                                            <span className="text-xs font-bold text-slate-700">Destino de Abertura</span>
                                            <select
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                                value={openTarget}
                                                onChange={(e) => setOpenTarget(e.target.value as ButtonOpenTarget)}
                                            >
                                                {OPEN_TARGET_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                )}

                                {actionType === 'modal' && (
                                    <div className="space-y-3 pt-2">
                                        <label className="block space-y-1">
                                            <span className="text-xs font-bold text-slate-700">Título do Modal</span>
                                            <input
                                                type="text"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                                                value={modalTitle}
                                                onChange={(e) => setModalTitle(e.target.value)}
                                                placeholder="Ex: Material Complementar"
                                            />
                                        </label>

                                        <label className="block space-y-1">
                                            <span className="text-xs font-bold text-slate-700">Subtítulo do Modal</span>
                                            <input
                                                type="text"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                                                value={modalSubtitle}
                                                onChange={(e) => setModalSubtitle(e.target.value)}
                                                placeholder="Ex: Conteúdo complementar da aula."
                                            />
                                            <p className="text-[11px] text-slate-500">
                                                Opcional. Se mantido em branco, o modal será exibido sem a linha de subtítulo.
                                            </p>
                                        </label>

                                        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-slate-800">
                                                    Conteúdo do Modal ({modalBlocks.length} bloco{modalBlocks.length !== 1 ? 's' : ''})
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Configure textos, imagens, vídeos ou tabelas internas.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="rounded-xl bg-slate-900 font-bold hover:bg-slate-800 text-white"
                                                onClick={() => setIsEditingModalBlocks(true)}
                                            >
                                                Editar Conteúdo
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONFIGURAÇÃO DE LAYOUT DO BLOCO (Comum a Global e Local) */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                            Layout do Bloco na Aula
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs font-bold text-slate-700">Alinhamento</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                        <button
                                            key={align}
                                            type="button"
                                            onClick={() => setAlignment(align)}
                                            className={cn(
                                                'rounded-xl py-2 text-xs font-bold border transition',
                                                alignment === align
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            )}
                                        >
                                            {align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}
                                        </button>
                                    ))}
                                </div>
                            </label>

                            <label className="block space-y-1">
                                <span className="text-xs font-bold text-slate-700">Largura</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['auto', 'full'] as const).map((w) => (
                                        <button
                                            key={w}
                                            type="button"
                                            onClick={() => setWidth(w)}
                                            className={cn(
                                                'rounded-xl py-2 text-xs font-bold border transition',
                                                width === w
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            )}
                                        >
                                            {w === 'auto' ? 'Automática' : '100% (Total)'}
                                        </button>
                                    ))}
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Pré-visualização ao vivo */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            Pré-visualização do Botão
                        </p>
                        <LessonActionButton
                            label={sourceType === 'global' ? currentSelectedGlobal?.label || 'Selecione um botão global' : label}
                            template={sourceType === 'global' ? currentSelectedGlobal?.template : { id: '', name: '', default_label: '', variant, theme, custom_background_color: customBackgroundColor, custom_text_color: customTextColor, icon, is_active: true, created_at: '', updated_at: '' }}
                            action_type={sourceType === 'global' ? currentSelectedGlobal?.action_type : actionType}
                            alignment={alignment}
                            width={width}
                            previewMode
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 p-4">
                    <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6" onClick={handleSave}>
                        Salvar Botão no Bloco
                    </Button>
                </div>
            </DialogContent>

            {/* SUB-MODAL: CONSTRUTOR DE CONTEÚDO DO MODAL (Sem botões para evitar recursão) */}
            {isEditingModalBlocks && (
                <Dialog open={isEditingModalBlocks} onOpenChange={setIsEditingModalBlocks}>
                    <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-[28px] border border-slate-200 bg-white shadow-2xl z-[150]">
                        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/60">
                            <DialogTitle className="text-xl font-black text-slate-900">
                                Conteúdo em Blocos do Modal
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Adicione textos, imagens, vídeos, HTML ou tabelas que aparecerão quando o aluno clicar no botão.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {renderBlockEditor ? (
                                renderBlockEditor({
                                    blocks: modalBlocks,
                                    onChange: setModalBlocks,
                                })
                            ) : (
                                <div className="space-y-4">
                                    <textarea
                                        className="w-full min-h-[200px] rounded-xl border border-slate-200 p-4 font-mono text-xs"
                                        value={JSON.stringify(modalBlocks, null, 2)}
                                        onChange={(e) => {
                                            try {
                                                setModalBlocks(JSON.parse(e.target.value));
                                            } catch {
                                                // Ignore invalid JSON while user is typing
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/60 p-4">
                            <Button
                                type="button"
                                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6"
                                onClick={() => setIsEditingModalBlocks(false)}
                            >
                                Concluir Edição do Modal
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
}
