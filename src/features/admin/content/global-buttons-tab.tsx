import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
    countGlobalButtonUsages,
    createGlobalButton,
    deleteGlobalButton,
    fetchButtonTemplates,
    fetchGlobalButtons,
    toErrorMessage,
    updateGlobalButton,
    uploadLessonContentAsset,
} from '@/features/admin/content/api';
import {
    BUTTON_ICON_OPTIONS,
    BUTTON_THEME_OPTIONS,
    BUTTON_VARIANT_OPTIONS,
    getButtonThemeLabel,
    getButtonVariantLabel,
} from '@/features/admin/content/button-template-icons';
import { LessonActionButton } from '@/features/admin/content/lesson-action-button';
import { LessonContentBlocksEditor, LessonContentBlocksRenderer } from '@/features/admin/content/lesson-content-blocks';
import { DEFAULT_MODAL_TITLE, DEFAULT_MODAL_SUBTITLE, type LessonContentBlock } from '@/features/admin/content/content-blocks';
import { ModalButtonConfigDialog } from '@/features/admin/content/modal-button-config-dialog';
import { globalButtonDefinitionFormSchema } from '@/features/admin/content/schemas';
import type {
    ButtonActionType,
    ButtonOpenTarget,
    ButtonTemplate,
    GlobalButtonDefinition,
} from '@/types/content';

const OPEN_TARGET_OPTIONS: Array<{
    label: string;
    value: ButtonOpenTarget;
}> = [
    { label: 'Nova Aba (_blank)', value: 'new-tab' },
    { label: 'Mesma Aba (_self)', value: 'same-tab' },
    { label: 'Nova Janela Pop-up', value: 'new-window' },
];

const VARIANTS = BUTTON_VARIANT_OPTIONS;
const THEMES = BUTTON_THEME_OPTIONS;

interface FormState {
    name: string;
    label: string;
    template_id: string;
    variant: ButtonTemplate['variant'];
    theme: ButtonTemplate['theme'];
    icon: string;
    action_type: ButtonActionType;
    url: string;
    open_target: ButtonOpenTarget;
    file_path: string | null;
    file_name: string | null;
    file_size_bytes: number;
    modal_title: string;
    modal_subtitle: string;
    modal_blocks: LessonContentBlock[];
    is_active: boolean;
}

const DEFAULT_FORM: FormState = {
    name: '',
    label: '',
    template_id: '',
    variant: 'outline',
    theme: 'blue',
    icon: 'link',
    action_type: 'url',
    url: '',
    open_target: 'new-tab',
    file_path: null,
    file_name: null,
    file_size_bytes: 0,
    modal_title: DEFAULT_MODAL_TITLE,
    modal_subtitle: DEFAULT_MODAL_SUBTITLE,
    modal_blocks: [{ type: 'rich-text', content: '<p>Conteúdo da janela modal...</p>' }],
    is_active: true,
};

export function GlobalButtonsTab() {
    const { user } = useAuth();
    const [globalButtons, setGlobalButtons] = useState<GlobalButtonDefinition[]>([]);
    const [templates, setTemplates] = useState<ButtonTemplate[]>([]);
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalConfigOpen, setIsModalConfigOpen] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [buttonsList, templatesList] = await Promise.all([
                fetchGlobalButtons(),
                fetchButtonTemplates(),
            ]);
            setGlobalButtons(buttonsList);
            setTemplates(templatesList);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const selectedTemplate = useMemo(() => {
        if (!form.template_id) {
            return null;
        }
        return templates.find((t) => t.id === form.template_id) ?? null;
    }, [form.template_id, templates]);

    const handleSelectTemplate = (templateId: string) => {
        const found = templates.find((t) => t.id === templateId);
        if (found) {
            setForm((prev) => ({
                ...prev,
                template_id: found.id,
                variant: found.variant,
                theme: found.theme,
                icon: found.icon || 'link',
                label: prev.label || found.default_label,
            }));
        }
        else {
            setForm((prev) => ({
                ...prev,
                template_id: '',
            }));
        }
    };

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setIsUploadingFile(true);
        setError(null);
        try {
            const result = await uploadLessonContentAsset(file);
            setForm((prev) => ({
                ...prev,
                file_path: result.storage_path,
                file_name: file.name,
                file_size_bytes: file.size,
                label: prev.label || file.name,
            }));
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsUploadingFile(false);
            event.target.value = '';
        }
    };

    const startEdit = (button: GlobalButtonDefinition) => {
        setEditingId(button.id);
        setForm({
            name: button.name,
            label: button.label,
            template_id: button.template_id || '',
            variant: button.template?.variant || 'outline',
            theme: button.template?.theme || 'blue',
            icon: button.template?.icon || 'link',
            action_type: button.action_type,
            url: button.url || '',
            open_target: button.open_target || 'new-tab',
            file_path: button.storage_path,
            file_name: button.file_name,
            file_size_bytes: button.file_size_bytes,
            modal_title: button.modal_title ?? DEFAULT_MODAL_TITLE,
            modal_subtitle: button.modal_subtitle ?? DEFAULT_MODAL_SUBTITLE,
            modal_blocks: button.modal_blocks && button.modal_blocks.length > 0
                ? (button.modal_blocks as LessonContentBlock[])
                : [{ type: 'rich-text', content: '<p>Conteúdo da janela modal...</p>' }],
            is_active: button.is_active,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingId(null);
        setForm(DEFAULT_FORM);
        setError(null);
    };

    const handleSubmit = async () => {
        setError(null);
        const parsed = globalButtonDefinitionFormSchema.safeParse({
            name: form.name,
            label: form.label,
            template_id: form.template_id || null,
            action_type: form.action_type,
            url: form.action_type === 'url' ? form.url : '',
            open_target: form.open_target,
            modal_title: form.action_type === 'modal' ? form.modal_title : '',
            modal_subtitle: form.action_type === 'modal' ? form.modal_subtitle : '',
            modal_blocks: form.action_type === 'modal' ? form.modal_blocks : [],
            is_active: form.is_active,
        });

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                await updateGlobalButton(editingId, parsed.data);
            }
            else {
                await createGlobalButton(parsed.data, user?.id || '');
            }
            resetForm();
            await loadData();
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (button: GlobalButtonDefinition) => {
        try {
            const usage = await countGlobalButtonUsages(button.id);
            if (usage.total > 0) {
                alert(
                    `Este botão não pode ser excluído diretamente porque está em uso em ${usage.total} local(is) ` +
                    `(${usage.lessons} aula(s) e ${usage.footers} rodapé(s)).\n\nPara desativá-lo com segurança, edite o botão e desmarque a opção "Ativo".`
                );
                return;
            }

            if (!window.confirm(`Tem certeza que deseja excluir o botão global "${button.name}"?`)) {
                return;
            }

            await deleteGlobalButton(button.id);
            if (editingId === button.id) {
                resetForm();
            }
            await loadData();
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    };

    const filteredButtons = useMemo(() => {
        if (!searchQuery.trim()) {
            return globalButtons;
        }
        const q = searchQuery.toLowerCase();
        return globalButtons.filter((b) =>
            b.name.toLowerCase().includes(q) ||
            b.label.toLowerCase().includes(q)
        );
    }, [globalButtons, searchQuery]);

    const activeTemplateForForm = useMemo(() => {
        return templates.find((t) => t.id === form.template_id) || null;
    }, [templates, form.template_id]);

    return (
        <div className="space-y-8">
            <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
                {/* Form */}
                <section className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">
                            {editingId ? 'Editar Botão Global' : 'Novo Botão Global'}
                        </h3>
                        {editingId ? (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-xs font-bold text-slate-500 hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                        ) : null}
                    </div>

                    <label className="block space-y-2">
                        <span className="text-sm font-bold text-slate-700">Nome identificador interno</span>
                        <input
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100"
                            placeholder="Ex: Suporte Oficial WhatsApp"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <p className="text-[11px] text-slate-400">Nome que você verá na biblioteca de seleção.</p>
                    </label>

                    {/* Visual Template selection */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Padrão Visual
                        </span>
                        <select
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium"
                            value={form.template_id}
                            onChange={(e) => handleSelectTemplate(e.target.value)}
                        >
                            <option value="">Personalizado (Sem padrão específico)</option>
                            {templates.filter((t) => t.is_active).map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} • {t.default_label} ({getButtonVariantLabel(t.variant)}/{getButtonThemeLabel(t.theme)})
                                </option>
                            ))}
                        </select>

                        <label className="block space-y-1 pt-1">
                            <span className="text-xs font-bold text-slate-700">Texto / Rótulo do botão</span>
                            <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
                                placeholder="Texto exibido no botão"
                                value={form.label}
                                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                            />
                        </label>

                        {!selectedTemplate ? (
                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block space-y-1">
                                        <span className="text-xs font-bold text-slate-700">Variante</span>
                                        <select
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                            value={form.variant}
                                            onChange={(e) => setForm((prev) => ({ ...prev, variant: e.target.value as FormState['variant'] }))}
                                        >
                                            {VARIANTS.map((v) => (
                                                <option key={v.value} value={v.value}>{v.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-bold text-slate-700">Tema de cor</span>
                                        <select
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                            value={form.theme}
                                            onChange={(e) => setForm((prev) => ({ ...prev, theme: e.target.value as FormState['theme'] }))}
                                        >
                                            {THEMES.map((t) => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Ícone</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                        value={form.icon}
                                        onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                                    >
                                        {BUTTON_ICON_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        ) : null}
                    </div>

                    {/* Action configuration */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Tipo de Ação
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                            {(['url', 'file', 'modal'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setForm((prev) => ({ ...prev, action_type: type }))}
                                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                                        form.action_type === type
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {type === 'url' ? '🔗 Link (URL)' : type === 'file' ? '📁 Arquivo' : '🪟 Modal'}
                                </button>
                            ))}
                        </div>

                        {form.action_type === 'url' ? (
                            <div className="space-y-3 pt-2">
                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">URL de destino</span>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
                                        placeholder="https://..."
                                        value={form.url}
                                        onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                                    />
                                </label>
                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Abrir em</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                        value={form.open_target}
                                        onChange={(e) => setForm((prev) => ({ ...prev, open_target: e.target.value as ButtonOpenTarget }))}
                                    >
                                        {OPEN_TARGET_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        ) : form.action_type === 'file' ? (
                            <div className="space-y-3 pt-2">
                                <label className={`block rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center ${isUploadingFile ? 'opacity-70' : 'cursor-pointer hover:bg-blue-50/40'}`}>
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploadingFile} />
                                    <p className="text-xs font-bold text-slate-800">
                                        {form.file_name ? `Arquivo atual: ${form.file_name}` : 'Selecionar arquivo para upload'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-500">PDF, ZIP, Imagens ou materiais de apoio.</p>
                                    <span className="mt-2 inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
                                        {isUploadingFile ? 'Enviando...' : form.file_name ? 'Trocar Arquivo' : 'Escolher Arquivo'}
                                    </span>
                                </label>
                                <label className="block space-y-1">
                                    <span className="text-xs font-bold text-slate-700">Abrir em</span>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                        value={form.open_target}
                                        onChange={(e) => setForm((prev) => ({ ...prev, open_target: e.target.value as ButtonOpenTarget }))}
                                    >
                                        {OPEN_TARGET_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black text-slate-800">Configuração do modal</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {form.modal_title || DEFAULT_MODAL_TITLE} · {form.modal_blocks.length} bloco{form.modal_blocks.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setIsModalConfigOpen(true)}>
                                        Personalizar modal
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-bold text-slate-700">Botão ativo na biblioteca</span>
                    </label>

                    {error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    {/* Preview box */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Prévia interativa do botão</p>
                        <div className="mt-3 flex items-center">
                            <LessonActionButton
                                label={form.label || 'Prévia do Botão'}
                                template={activeTemplateForForm}
                                action_type={form.action_type}
                                url={form.url}
                                open_target={form.open_target}
                                storage_path={form.file_path}
                                file_name={form.file_name}
                                modal_title={form.modal_title}
                                modal_blocks={form.modal_blocks}
                                previewMode
                                renderModalBlocks={(modalBlocks) => (
                                    <LessonContentBlocksRenderer blocks={modalBlocks as LessonContentBlock[]} />
                                )}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold"
                            disabled={isSaving || isUploadingFile}
                            onClick={() => void handleSubmit()}
                        >
                            {isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Botão Global'}
                        </Button>
                        {editingId ? (
                            <Button type="button" variant="outline" className="rounded-2xl" onClick={resetForm}>
                                Cancelar
                            </Button>
                        ) : null}
                    </div>
                </section>

                {/* Catalog / List */}
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">
                                Biblioteca de Botões Globais
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Botões reutilizáveis em múltiplos blocos de aula ou rodapés.
                            </p>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar botão..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium w-full sm:w-56"
                        />
                    </div>

                    {isLoading ? (
                        <p className="text-sm text-slate-500 py-8 text-center">Carregando botões globais...</p>
                    ) : filteredButtons.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                            Nenhum botão global encontrado na biblioteca.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredButtons.map((btn) => (
                                <article
                                    key={btn.id}
                                    className={`rounded-[24px] border p-5 transition-all ${
                                        editingId === btn.id
                                            ? 'border-blue-400 bg-blue-50/30 shadow-sm'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-2 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-base font-black text-slate-900">{btn.name}</h4>
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                                                        btn.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                                    }`}
                                                >
                                                    {btn.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                    {btn.action_type === 'modal' ? 'Modal' : btn.action_type === 'file' ? 'Arquivo' : 'URL'}
                                                </span>
                                                {btn.template_id ? (
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                                        Template Vinculado
                                                    </span>
                                                ) : null}
                                            </div>

                                            {btn.label !== btn.name ? (
                                                <p className="text-xs text-slate-500">Rótulo: {btn.label}</p>
                                            ) : null}

                                            <div className="pt-1">
                                                <LessonActionButton
                                                    label={btn.label}
                                                    template={btn.template}
                                                    action_type={btn.action_type}
                                                    url={btn.url}
                                                    open_target={btn.open_target}
                                                    storage_path={btn.storage_path}
                                                    file_name={btn.file_name}
                                                    modal_title={btn.modal_title}
                                                    modal_blocks={btn.modal_blocks}
                                                    previewMode
                                                    renderModalBlocks={(modalBlocks) => (
                                                        <LessonContentBlocksRenderer blocks={modalBlocks as LessonContentBlock[]} />
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                                                onClick={() => startEdit(btn)}
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                                                onClick={() => void handleDelete(btn)}
                                            >
                                                Excluir
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <ModalButtonConfigDialog
                open={isModalConfigOpen}
                onOpenChange={setIsModalConfigOpen}
                value={{ title: form.modal_title, subtitle: form.modal_subtitle, blocks: form.modal_blocks }}
                onChange={(nextValue) => setForm((prev) => ({
                    ...prev,
                    modal_title: nextValue.title,
                    modal_subtitle: nextValue.subtitle,
                    modal_blocks: nextValue.blocks,
                }))}
                renderBlockEditor={({ blocks, onChange }) => (
                    <LessonContentBlocksEditor
                        blocks={blocks}
                        onChange={onChange}
                        level={1}
                        allowEmptyState={false}
                        excludedBlockTypes={['button', 'image-hotspots', 'flashcards', 'svg']}
                        assetContext="global"
                    />
                )}
            />
        </div>
    );
}
