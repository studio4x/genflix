import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers/auth-provider';
import { publishBuilderNotice } from '@/lib/builder-notice';
import { lessonFooterActionFormSchema } from '@/features/admin/content/schemas';
import {
    createCourseFooterAction,
    createLessonFooterAction,
    createModuleFooterAction,
    deleteLessonFooterAction,
    fetchCourseFooterActions,
    fetchGlobalButtons,
    fetchLessonFooterActions,
    fetchModuleFooterActions,
    fetchButtonTemplates,
    toErrorMessage,
    updateLessonFooterAction,
} from '@/features/admin/content/api';
import {
    getLessonFooterActionScopeLabel,
    getLessonFooterButtonClassName,
    getLessonFooterButtonStyle,
    renderButtonTemplateIcon,
} from '@/features/admin/content/button-template-icons';
import { LessonActionButton } from '@/features/admin/content/lesson-action-button';
import { LessonContentBlocksEditor, LessonContentBlocksRenderer } from '@/features/admin/content/lesson-content-blocks';
import { DEFAULT_MODAL_TITLE, DEFAULT_MODAL_SUBTITLE, type LessonContentBlock } from '@/features/admin/content/content-blocks';
import { ModalButtonConfigDialog } from '@/features/admin/content/modal-button-config-dialog';
import type { ButtonTemplate, FooterActionScope, GlobalButtonDefinition, LessonFooterAction } from '@/types/content';

type LessonFooterActionOpenTarget = 'same-tab' | 'new-tab' | 'new-window';

const LESSON_FOOTER_OPEN_TARGET_OPTIONS: Array<{
    label: string;
    value: LessonFooterActionOpenTarget;
    description: string;
}> = [
    { label: 'Mesma página', value: 'same-tab', description: 'Abre substituindo a página atual.' },
    { label: 'Nova aba', value: 'new-tab', description: 'Abre em uma aba nova do navegador.' },
    { label: 'Nova janela', value: 'new-window', description: 'Abre em uma janela separada.' },
];

function getLessonFooterOpenTargetLabel(target: LessonFooterActionOpenTarget) {
    return LESSON_FOOTER_OPEN_TARGET_OPTIONS.find((option) => option.value === target)?.label ?? 'Nova aba';
}

function formatBytes(value: number): string {
    if (value === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const normalized = value / 1024 ** unitIndex;
    return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getScopeButtonLabel(scope: FooterActionScope, entityName?: string) {
    const suffix = entityName?.trim() ? `: ${entityName.trim()}` : '';
    switch (scope) {
        case 'course':
            return `Botões globais do curso${suffix}`;
        case 'module':
            return `Botões globais do módulo${suffix}`;
        case 'lesson':
        default:
            return `Botões no rodapé da aula${suffix}`;
    }
}

function getScopeDescription(scope: FooterActionScope) {
    switch (scope) {
        case 'course':
            return 'Configure arquivos e links disponíveis em todas as aulas do curso.';
        case 'module':
            return 'Configure arquivos e links disponíveis em todas as aulas deste módulo.';
        case 'lesson':
        default:
            return 'Configure arquivos e links visíveis apenas nesta aula.';
    }
}

export function FooterActionsPanel({
    scope,
    courseId,
    moduleId,
    lessonId,
    entityName,
    title,
    description,
}: {
    scope: FooterActionScope;
    courseId: string;
    moduleId?: string;
    lessonId?: string;
    entityName?: string;
    title?: string;
    description?: string;
}) {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<ButtonTemplate[]>([]);
    const [globalButtons, setGlobalButtons] = useState<GlobalButtonDefinition[]>([]);
    const [actions, setActions] = useState<LessonFooterAction[]>([]);
    const [activeCreationMode, setActiveCreationMode] = useState<'file' | 'url' | 'modal' | 'global'>('file');

    // URL creation
    const [urlLabel, setUrlLabel] = useState('');
    const [urlValue, setUrlValue] = useState('');
    const [urlOpenTarget, setUrlOpenTarget] = useState<LessonFooterActionOpenTarget>('new-tab');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    // Modal creation
    const [modalTitle, setModalTitle] = useState(DEFAULT_MODAL_TITLE);
    const [modalSubtitle, setModalSubtitle] = useState(DEFAULT_MODAL_SUBTITLE);
    const [modalButtonLabel, setModalButtonLabel] = useState('');
    const [modalBlocks, setModalBlocks] = useState<LessonContentBlock[]>([
        { type: 'rich-text', content: '<p>Conteúdo da janela modal...</p>' },
    ]);
    const [isModalConfigOpen, setIsModalConfigOpen] = useState(false);

    // Global linking
    const [selectedGlobalButtonId, setSelectedGlobalButtonId] = useState('');

    // Editing state
    const [editingAction, setEditingAction] = useState<LessonFooterAction | null>(null);
    const [editingTemplateId, setEditingTemplateId] = useState<string>('');
    const [editingLabel, setEditingLabel] = useState('');
    const [editingUrl, setEditingUrl] = useState('');
    const [editingOpenTarget, setEditingOpenTarget] = useState<LessonFooterActionOpenTarget>('new-tab');
    const [editingFile, setEditingFile] = useState<File | null>(null);
    const [editingModalTitle, setEditingModalTitle] = useState('');
    const [editingModalSubtitle, setEditingModalSubtitle] = useState('');
    const [editingModalBlocks, setEditingModalBlocks] = useState<LessonContentBlock[]>([]);
    const [isEditingModalConfigOpen, setIsEditingModalConfigOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scopeTitle = title ?? getScopeButtonLabel(scope, entityName);
    const scopeDescription = description ?? getScopeDescription(scope);

    const nextPosition = useMemo(() => (actions.length ? Math.max(...actions.map((action) => action.position)) + 1 : 1), [actions]);
    const activeTemplates = useMemo(() => templates.filter((template) => template.is_active), [templates]);

    const globalButtonsMap = useMemo(() => {
        const map: Record<string, GlobalButtonDefinition> = {};
        for (const gb of globalButtons) {
            map[gb.id] = gb;
        }
        return map;
    }, [globalButtons]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [loadedTemplates, loadedActions, loadedGlobals] = await Promise.all([
                fetchButtonTemplates(),
                scope === 'course'
                    ? fetchCourseFooterActions(courseId)
                    : scope === 'module'
                        ? fetchModuleFooterActions(moduleId ?? '')
                        : fetchLessonFooterActions(lessonId ?? ''),
                fetchGlobalButtons(),
            ]);
            setTemplates(loadedTemplates);
            setActions(loadedActions);
            setGlobalButtons(loadedGlobals);
            setSelectedTemplateId((current) => current || loadedTemplates.find((template) => template.is_active)?.id || '');
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsLoading(false);
        }
    }, [courseId, lessonId, moduleId, scope]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    function startEditingAction(action: LessonFooterAction) {
        setEditingAction(action);
        setEditingTemplateId(action.template_id || '');
        setEditingLabel(action.label ?? '');
        setEditingUrl(action.url ?? '');
        setEditingOpenTarget(action.open_target ?? (action.open_in_new_tab ? 'new-tab' : 'same-tab'));
        setEditingFile(null);
        setEditingModalTitle(action.modal_title || '');
        setEditingModalSubtitle(action.modal_subtitle ?? DEFAULT_MODAL_SUBTITLE);
        setEditingModalBlocks(
            action.modal_blocks && action.modal_blocks.length > 0
                ? (action.modal_blocks as LessonContentBlock[])
                : [{ type: 'rich-text', content: '<p>Conteúdo da janela modal...</p>' }]
        );
    }

    function cancelEditingAction() {
        setEditingAction(null);
        setEditingTemplateId('');
        setEditingLabel('');
        setEditingUrl('');
        setEditingOpenTarget('new-tab');
        setEditingFile(null);
        setEditingModalTitle('');
        setEditingModalSubtitle('');
        setEditingModalBlocks([]);
        setIsEditingModalConfigOpen(false);
    }

    async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file || !user) {
            return;
        }
        setIsUploading(true);
        setError(null);
        try {
            const templateId = selectedTemplateId || activeTemplates[0]?.id || null;
            const parsed = lessonFooterActionFormSchema.safeParse({
                scope,
                template_id: templateId,
                action_type: 'file',
                label: '',
                position: nextPosition,
                open_target: urlOpenTarget,
                is_active: true,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            }
            if (scope === 'course') {
                await createCourseFooterAction(courseId, parsed.data, user.id, file);
            }
            else if (scope === 'module') {
                await createModuleFooterAction(moduleId ?? '', parsed.data, user.id, file);
            }
            else {
                await createLessonFooterAction(lessonId ?? '', parsed.data, user.id, file);
            }
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botão salvo',
                message: `O arquivo "${file.name}" foi adicionado com sucesso.`,
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsUploading(false);
            event.target.value = '';
        }
    }

    async function handleCreateUrlAction() {
        if (!user) {
            return;
        }
        setError(null);
        try {
            const parsed = lessonFooterActionFormSchema.safeParse({
                scope,
                template_id: selectedTemplateId || null,
                action_type: 'url',
                label: urlLabel,
                url: urlValue,
                position: nextPosition,
                open_target: urlOpenTarget,
                is_active: true,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            }
            if (scope === 'course') {
                await createCourseFooterAction(courseId, parsed.data, user.id);
            }
            else if (scope === 'module') {
                await createModuleFooterAction(moduleId ?? '', parsed.data, user.id);
            }
            else {
                await createLessonFooterAction(lessonId ?? '', parsed.data, user.id);
            }
            setUrlLabel('');
            setUrlValue('');
            setUrlOpenTarget('new-tab');
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botão salvo',
                message: `O link "${parsed.data.label}" foi adicionado com sucesso.`,
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }

    async function handleCreateModalAction() {
        if (!user) {
            return;
        }
        setError(null);
        try {
            const parsed = lessonFooterActionFormSchema.safeParse({
                scope,
                template_id: selectedTemplateId || null,
                action_type: 'modal',
                label: modalButtonLabel || 'Ver Conteúdo',
                modal_title: modalTitle || DEFAULT_MODAL_TITLE,
                modal_subtitle: modalSubtitle,
                modal_blocks: modalBlocks,
                position: nextPosition,
                open_target: 'same-tab',
                is_active: true,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            }
            if (scope === 'course') {
                await createCourseFooterAction(courseId, parsed.data, user.id);
            }
            else if (scope === 'module') {
                await createModuleFooterAction(moduleId ?? '', parsed.data, user.id);
            }
            else {
                await createLessonFooterAction(lessonId ?? '', parsed.data, user.id);
            }
            setModalTitle('');
            setModalSubtitle(DEFAULT_MODAL_SUBTITLE);
            setModalButtonLabel('');
            setModalBlocks([{ type: 'rich-text', content: '<p>Conteúdo da janela modal...</p>' }]);
            setIsModalConfigOpen(false);
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botão de modal criado',
                message: 'O botão de modal foi adicionado com sucesso.',
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }

    async function handleLinkGlobalButton() {
        if (!user || !selectedGlobalButtonId) {
            return;
        }
        setError(null);
        try {
            const globalBtn = globalButtonsMap[selectedGlobalButtonId];
            if (!globalBtn) {
                return;
            }
            const parsed = lessonFooterActionFormSchema.safeParse({
                scope,
                global_button_id: globalBtn.id,
                template_id: globalBtn.template_id || null,
                action_type: globalBtn.action_type,
                label: globalBtn.label,
                url: globalBtn.url || '',
                storage_path: globalBtn.storage_path,
                file_name: globalBtn.file_name,
                file_size_bytes: globalBtn.file_size_bytes,
                // Botões globais de URL/arquivo não possuem título de modal no banco.
                // O formulário local trabalha com string vazia quando o campo não se aplica.
                modal_title: globalBtn.modal_title || '',
                modal_subtitle: globalBtn.modal_subtitle,
                // O conteúdo do modal continua vindo da definição global relacionada.
                // Não revalidar/copiar esses blocos evita rejeitar formatos legados válidos
                // na biblioteca global ao criar apenas o vínculo do rodapé.
                modal_blocks: [],
                position: nextPosition,
                open_target: globalBtn.open_target || 'new-tab',
                is_active: true,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            }
            if (scope === 'course') {
                await createCourseFooterAction(courseId, parsed.data, user.id);
            }
            else if (scope === 'module') {
                await createModuleFooterAction(moduleId ?? '', parsed.data, user.id);
            }
            else {
                await createLessonFooterAction(lessonId ?? '', parsed.data, user.id);
            }
            setSelectedGlobalButtonId('');
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botão global vinculado',
                message: `O botão global "${globalBtn.name}" foi vinculado ao rodapé.`,
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }

    async function handleDelete(action: LessonFooterAction) {
        if (!window.confirm(`Excluir a ação "${action.label ?? action.file_name ?? 'Sem título'}"`)) {
            return;
        }
        try {
            await deleteLessonFooterAction(action);
            await loadData();
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }

    async function handleSaveEditingAction() {
        if (!user || !editingAction) {
            return;
        }
        setIsSavingEdit(true);
        setError(null);
        try {
            const parsed = lessonFooterActionFormSchema.safeParse({
                scope: editingAction.scope,
                global_button_id: editingAction.global_button_id || null,
                template_id: editingTemplateId || null,
                action_type: editingAction.action_type,
                label: editingLabel,
                url: editingAction.action_type === 'url' ? editingUrl : '',
                position: editingAction.position,
                open_target: editingOpenTarget,
                modal_title: editingAction.action_type === 'modal' ? editingModalTitle : '',
                modal_subtitle: editingAction.action_type === 'modal' ? editingModalSubtitle : '',
                modal_blocks: editingAction.action_type === 'modal' ? editingModalBlocks : [],
                is_active: editingAction.is_active,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            }
            await updateLessonFooterAction(editingAction.id, parsed.data, editingAction.action_type === 'file' ? editingFile : null);
            cancelEditingAction();
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botão atualizado',
                message: 'As alterações foram salvas com sucesso.',
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsSavingEdit(false);
        }
    }

    return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{scopeTitle}</p>
              <p className="mt-2 text-sm text-slate-500">{scopeDescription}</p>
            </div>
            <Link to="/admin/botoes-aula" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
              Gerenciar Padrões Globais
            </Link>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
            <section className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50/40 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Novo botão</p>
                <p className="mt-1 text-sm text-slate-500">Escolha o tipo de botão para adicionar a este rodapé.</p>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-200/70 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveCreationMode('file')}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
                    activeCreationMode === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📁 Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreationMode('url')}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
                    activeCreationMode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔗 Link
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreationMode('modal')}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
                    activeCreationMode === 'modal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🪟 Modal
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreationMode('global')}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
                    activeCreationMode === 'global' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🌐 Global
                </button>
              </div>

              {/* Visual Template selection for non-global */}
              {activeCreationMode !== 'global' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-800">Padrão visual</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                    >
                      <option value="">Sem padrão específico</option>
                      {activeTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} • {template.default_label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedTemplateId ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview do botão</p>
                      <div className="mt-3">
                        {(() => {
                          const selectedTemplate = activeTemplates.find((template) => template.id === selectedTemplateId) ?? null;
                          if (!selectedTemplate) return null;
                          return (
                            <Button type="button" variant="outline" style={getLessonFooterButtonStyle(selectedTemplate)} className={getLessonFooterButtonClassName(selectedTemplate)}>
                              {renderButtonTemplateIcon(selectedTemplate.icon, undefined, selectedTemplate.theme === 'custom' ? selectedTemplate.custom_icon_color : null)}
                              {selectedTemplate.default_label}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* Mode: FILE */}
              {activeCreationMode === 'file' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-800">Abrir em</span>
                    <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={urlOpenTarget} onChange={(event) => setUrlOpenTarget(event.target.value as LessonFooterActionOpenTarget)}>
                      {LESSON_FOOTER_OPEN_TARGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className={`block rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center ${isUploading ? 'opacity-70' : 'cursor-pointer'}`}>
                    <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading}/>
                    <p className="text-sm font-black text-slate-900">Enviar arquivo para virar botão</p>
                    <p className="mt-1 text-xs text-slate-500">PDF, ZIP, imagem, planilha e outros materiais de apoio.</p>
                    <span className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white">
                      {isUploading ? 'Enviando...' : 'Selecionar Arquivo'}
                    </span>
                  </label>
                </>
              ) : null}

              {/* Mode: URL */}
              {activeCreationMode === 'url' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-800">Abrir em</span>
                    <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={urlOpenTarget} onChange={(event) => setUrlOpenTarget(event.target.value as LessonFooterActionOpenTarget)}>
                      {LESSON_FOOTER_OPEN_TARGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className="text-sm font-black text-slate-900">Criar botão de URL</p>
                    <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Rótulo personalizado opcional" value={urlLabel} onChange={(event) => setUrlLabel(event.target.value)}/>
                    <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="https://..." value={urlValue} onChange={(event) => setUrlValue(event.target.value)}/>
                    <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 font-bold" onClick={() => void handleCreateUrlAction()}>
                      Adicionar Link
                    </Button>
                  </div>
                </>
              ) : null}

              {/* Mode: MODAL */}
              {activeCreationMode === 'modal' ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-slate-900">Criar botão de Janela Modal</p>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">Rótulo do botão</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
                      placeholder="Ex: Instruções Complementares"
                      value={modalButtonLabel}
                      onChange={(e) => setModalButtonLabel(e.target.value)}
                    />
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-800">Configuração do modal</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {modalTitle || DEFAULT_MODAL_TITLE} · {modalBlocks.length} bloco{modalBlocks.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setIsModalConfigOpen(true)}>
                        Personalizar modal
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 font-bold" onClick={() => void handleCreateModalAction()}>
                    Adicionar Botão de Modal
                  </Button>
                </div>
              ) : null}

              {/* Mode: GLOBAL BUTTON */}
              {activeCreationMode === 'global' ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-slate-900">Vincular Botão da Biblioteca Global</p>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">Escolha o botão global</span>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium"
                      value={selectedGlobalButtonId}
                      onChange={(e) => setSelectedGlobalButtonId(e.target.value)}
                    >
                      <option value="">Selecione um botão global...</option>
                      {globalButtons.filter((g) => g.is_active).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} • {g.label} ({g.action_type === 'modal' ? 'Modal' : g.action_type === 'file' ? 'Arquivo' : 'Link'})
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedGlobalButtonId && globalButtonsMap[selectedGlobalButtonId] ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Prévia do botão global</p>
                      <LessonActionButton
                        label={globalButtonsMap[selectedGlobalButtonId].label}
                        template={globalButtonsMap[selectedGlobalButtonId].template}
                        action_type={globalButtonsMap[selectedGlobalButtonId].action_type}
                        url={globalButtonsMap[selectedGlobalButtonId].url}
                        open_target={globalButtonsMap[selectedGlobalButtonId].open_target}
                        storage_path={globalButtonsMap[selectedGlobalButtonId].storage_path}
                        file_name={globalButtonsMap[selectedGlobalButtonId].file_name}
                        modal_title={globalButtonsMap[selectedGlobalButtonId].modal_title}
                        modal_blocks={globalButtonsMap[selectedGlobalButtonId].modal_blocks}
                        previewMode
                        renderModalBlocks={(blocks) => (
                          <LessonContentBlocksRenderer blocks={blocks as LessonContentBlock[]} />
                        )}
                      />
                    </div>
                  ) : null}

                  <Button
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 font-bold"
                    disabled={!selectedGlobalButtonId}
                    onClick={() => void handleLinkGlobalButton()}
                  >
                    Vincular ao Rodapé
                  </Button>
                </div>
              ) : null}

              {error ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>) : null}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-slate-50/40 p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{scopeTitle}</p>

              {isLoading ? (
                <p className="mt-4 text-sm text-slate-500">{'Carregando botões...'}</p>
              ) : actions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
                  {'Nenhum botão configurado ainda.'}
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  {actions.map((action) => {
                    const resolvedGlobal = action.global_button_id ? globalButtonsMap[action.global_button_id] : undefined;
                    return (
                      <article key={action.id} className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                                #{action.position}
                              </span>
                              <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                {action.action_type === 'modal' ? 'Modal' : action.action_type === 'file' ? 'Arquivo' : 'URL'}
                              </span>
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                {getLessonFooterActionScopeLabel(action.scope)}
                              </span>
                              {action.global_button_id ? (
                                <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                  Global: {resolvedGlobal?.name || 'Vinculado'}
                                </span>
                              ) : null}
                              {action.action_type !== 'modal' ? (
                                <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                                  {getLessonFooterOpenTargetLabel(action.open_target ?? (action.open_in_new_tab ? 'new-tab' : 'same-tab'))}
                                </span>
                              ) : null}
                              {action.template?.name ? (
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                  {action.template.name}
                                </span>
                              ) : null}
                            </div>

                            <div>
                              <LessonActionButton
                                footerAction={action}
                                resolvedGlobalButton={resolvedGlobal}
                                previewMode
                                renderModalBlocks={(blocks) => (
                                  <LessonContentBlocksRenderer blocks={blocks as LessonContentBlock[]} />
                                )}
                              />
                            </div>

                            <p className="text-xs text-slate-500 break-all">
                              {action.action_type === 'url'
                                ? action.url
                                : action.action_type === 'file'
                                ? `${action.file_name ?? 'Arquivo'} • ${formatBytes(action.file_size_bytes)}`
                                : `Modal: ${action.modal_title || 'Sem título'}`}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => startEditingAction(action)}>
                              Editar
                            </Button>
                            <Button variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void handleDelete(action)}>
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {editingAction ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
              onClick={cancelEditingAction}
            >
              <div
                className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-sm font-black text-slate-900">Editar botão do rodapé</p>
                    <p className="text-xs text-slate-500">
                      {editingAction.global_button_id
                        ? 'Este botão está vinculado à biblioteca global. Você pode atualizar seu rótulo local ou padrão visual.'
                        : editingAction.action_type === 'file'
                        ? 'Você pode trocar o arquivo e atualizar o rótulo.'
                        : editingAction.action_type === 'modal'
                        ? 'Você pode atualizar o título e o conteúdo dos blocos da janela modal.'
                        : 'Você pode alterar o rótulo, a URL e o destino.'}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" className="rounded-xl" onClick={cancelEditingAction} disabled={isSavingEdit}>
                    Fechar
                  </Button>
                </div>

                <div className="mt-5 grid gap-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-800">Padrão visual</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      value={editingTemplateId}
                      onChange={(event) => setEditingTemplateId(event.target.value)}
                    >
                      <option value="">Sem padrão específico</option>
                      {activeTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} • {template.default_label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-800">Rótulo do botão</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      placeholder="Rótulo personalizado opcional"
                      value={editingLabel}
                      onChange={(event) => setEditingLabel(event.target.value)}
                    />
                  </label>

                  {editingAction.action_type === 'url' ? (
                    <label className="block space-y-2">
                      <span className="text-sm font-bold text-slate-800">URL</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        placeholder="https://..."
                        value={editingUrl}
                        onChange={(event) => setEditingUrl(event.target.value)}
                      />
                    </label>
                  ) : editingAction.action_type === 'file' ? (
                    <label className="block space-y-2">
                      <span className="text-sm font-bold text-slate-800">Arquivo atual</span>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        {editingAction.file_name || 'Arquivo enviado'}
                      </div>
                      <input
                        type="file"
                        className="block w-full cursor-pointer rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm"
                        onChange={(event) => setEditingFile(event.target.files?.[0] ?? null)}
                      />
                      <p className="text-xs text-slate-500">Se nenhum novo arquivo for escolhido, o arquivo atual será mantido.</p>
                    </label>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-800">Configuração do modal</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {editingModalTitle || DEFAULT_MODAL_TITLE} · {editingModalBlocks.length} bloco{editingModalBlocks.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setIsEditingModalConfigOpen(true)}>
                          Personalizar modal
                        </Button>
                      </div>
                    </div>
                  )}

                  {editingAction.action_type !== 'modal' ? (
                    <label className="block space-y-2">
                      <span className="text-sm font-bold text-slate-800">Abrir em</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        value={editingOpenTarget}
                        onChange={(event) => setEditingOpenTarget(event.target.value as LessonFooterActionOpenTarget)}
                      >
                        {LESSON_FOOTER_OPEN_TARGET_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button type="button" className="rounded-xl bg-slate-900 hover:bg-slate-800" onClick={() => void handleSaveEditingAction()} disabled={isSavingEdit}>
                    {isSavingEdit ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={cancelEditingAction} disabled={isSavingEdit}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <ModalButtonConfigDialog
            open={isModalConfigOpen}
            onOpenChange={setIsModalConfigOpen}
            value={{ title: modalTitle, subtitle: modalSubtitle, blocks: modalBlocks }}
            onChange={(nextValue) => {
              setModalTitle(nextValue.title);
              setModalSubtitle(nextValue.subtitle);
              setModalBlocks(nextValue.blocks);
            }}
            renderBlockEditor={({ blocks, onChange }) => (
              <LessonContentBlocksEditor
                blocks={blocks}
                onChange={onChange}
                level={1}
                allowEmptyState={false}
                excludedBlockTypes={['button', 'image-hotspots', 'flashcards', 'svg']}
              />
            )}
          />

          <ModalButtonConfigDialog
            open={isEditingModalConfigOpen}
            onOpenChange={setIsEditingModalConfigOpen}
            value={{ title: editingModalTitle, subtitle: editingModalSubtitle, blocks: editingModalBlocks }}
            onChange={(nextValue) => {
              setEditingModalTitle(nextValue.title);
              setEditingModalSubtitle(nextValue.subtitle);
              setEditingModalBlocks(nextValue.blocks);
            }}
            renderBlockEditor={({ blocks, onChange }) => (
              <LessonContentBlocksEditor
                blocks={blocks}
                onChange={onChange}
                level={1}
                allowEmptyState={false}
                excludedBlockTypes={['button', 'image-hotspots', 'flashcards', 'svg']}
              />
            )}
          />
        </section>
    );
}
