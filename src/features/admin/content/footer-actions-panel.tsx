import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
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
    fetchLessonFooterActions,
    fetchModuleFooterActions,
    fetchButtonTemplates,
    getSignedLessonFooterActionUrl,
    toErrorMessage,
    updateLessonFooterAction,
} from '@/features/admin/content/api';
import {
    getLessonFooterActionIconName,
    getLessonFooterActionScopeLabel,
    getLessonFooterButtonClassName,
    renderButtonTemplateIcon,
} from '@/features/admin/content/button-template-icons';
import type { ButtonTemplate, FooterActionScope, LessonFooterAction } from '@/types/content';

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

function getLessonFooterOpenTargetFeatures(target: LessonFooterActionOpenTarget) {
    if (target === 'new-window') {
        return 'noopener,noreferrer,width=1280,height=800';
    }
    if (target === 'new-tab') {
        return 'noopener,noreferrer';
    }
    return '';
}

function openLessonFooterActionUrl(url: string, target: LessonFooterActionOpenTarget) {
    if (target === 'same-tab') {
        window.location.assign(url);
        return;
    }
    window.open(url, '_blank', getLessonFooterOpenTargetFeatures(target));
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

function getScopeButtonLabel(scope: FooterActionScope) {
    switch (scope) {
        case 'course':
            return 'Botões globais do curso';
        case 'module':
            return 'Botões globais do módulo';
        case 'lesson':
        default:
            return 'Botões da aula';
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
    title,
    description,
}: {
    scope: FooterActionScope;
    courseId: string;
    moduleId?: string;
    lessonId?: string;
    title?: string;
    description?: string;
}) {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<ButtonTemplate[]>([]);
    const [actions, setActions] = useState<LessonFooterAction[]>([]);
    const [urlLabel, setUrlLabel] = useState('');
    const [urlValue, setUrlValue] = useState('');
    const [urlOpenTarget, setUrlOpenTarget] = useState<LessonFooterActionOpenTarget>('new-tab');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [editingAction, setEditingAction] = useState<LessonFooterAction | null>(null);
    const [editingTemplateId, setEditingTemplateId] = useState<string>('');
    const [editingLabel, setEditingLabel] = useState('');
    const [editingUrl, setEditingUrl] = useState('');
    const [editingOpenTarget, setEditingOpenTarget] = useState<LessonFooterActionOpenTarget>('new-tab');
    const [editingFile, setEditingFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scopeTitle = title ?? getScopeButtonLabel(scope);
    const scopeDescription = description ?? getScopeDescription(scope);

    const nextPosition = useMemo(() => (actions.length ? Math.max(...actions.map((action) => action.position)) + 1 : 1), [actions]);
    const activeTemplates = useMemo(() => templates.filter((template) => template.is_active), [templates]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [loadedTemplates, loadedActions] = await Promise.all([
                fetchButtonTemplates(),
                scope === 'course'
                    ? fetchCourseFooterActions(courseId)
                    : scope === 'module'
                        ? fetchModuleFooterActions(moduleId ?? '')
                        : fetchLessonFooterActions(lessonId ?? ''),
            ]);
            setTemplates(loadedTemplates);
            setActions(loadedActions);
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
    }

    function cancelEditingAction() {
        setEditingAction(null);
        setEditingTemplateId('');
        setEditingLabel('');
        setEditingUrl('');
        setEditingOpenTarget('new-tab');
        setEditingFile(null);
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
                template_id: editingTemplateId || null,
                action_type: editingAction.action_type,
                label: editingLabel,
                url: editingAction.action_type === 'url' ? editingUrl : '',
                position: editingAction.position,
                open_target: editingOpenTarget,
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

    async function handleOpen(action: LessonFooterAction) {
        try {
            const openTarget = action.open_target ?? (action.open_in_new_tab ? 'new-tab' : 'same-tab');
            if (action.action_type === 'url' && action.url) {
                openLessonFooterActionUrl(action.url, openTarget);
                return;
            }
            if (action.storage_path) {
                const signedUrl = await getSignedLessonFooterActionUrl(action.storage_path);
                openLessonFooterActionUrl(signedUrl, openTarget);
            }
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }

    return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{scopeTitle}</p>
              <p className="mt-2 text-sm text-slate-500">{scopeDescription}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="space-y-6 rounded-[28px] border border-slate-200 bg-slate-50/40 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Novo botão</p>
                <p className="mt-2 text-sm text-slate-500">{'Escolha o padrão visual e adicione um arquivo ou link.'}</p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-800">Padrão visual</span>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                  <option value="">{'Sem padrão específico'}</option>
                  {activeTemplates.map((template) => (<option key={template.id} value={template.id}>
                      {template.name} • {template.default_label}
                    </option>))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-800">Abrir link em</span>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={urlOpenTarget} onChange={(event) => setUrlOpenTarget(event.target.value as LessonFooterActionOpenTarget)}>
                  {LESSON_FOOTER_OPEN_TARGET_OPTIONS.map((option) => (<option key={option.value} value={option.value}>
                      {option.label}
                    </option>))}
                </select>
                <p className="text-xs text-slate-500">
                  {LESSON_FOOTER_OPEN_TARGET_OPTIONS.find((option) => option.value === urlOpenTarget)?.description}
                </p>
              </label>

              {selectedTemplateId ? (<div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview do botão</p>
                  <div className="mt-3">
                    {(() => {
                    const selectedTemplate = activeTemplates.find((template) => template.id === selectedTemplateId) ?? null;
                    if (!selectedTemplate)
                        return null;
                    return (<Button type="button" variant="outline" className={getLessonFooterButtonClassName(selectedTemplate)}>
                          {renderButtonTemplateIcon(selectedTemplate.icon)}
                          {selectedTemplate.default_label}
                        </Button>);
                })()}
                  </div>
                </div>) : null}

              <label className={`block rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center ${isUploading ? 'opacity-70' : 'cursor-pointer'}`}>
                <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading}/>
                <p className="text-sm font-black text-slate-900">Enviar arquivo para virar botão</p>
                <p className="mt-1 text-xs text-slate-500">PDF, ZIP, imagem, planilha e outros materiais de apoio.</p>
                <span className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white">
                  {isUploading ? 'Enviando...' : 'Selecionar Arquivo'}
                </span>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-sm font-black text-slate-900">Criar botão de URL</p>
                <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Rótulo personalizado opcional" value={urlLabel} onChange={(event) => setUrlLabel(event.target.value)}/>
                <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="https://..." value={urlValue} onChange={(event) => setUrlValue(event.target.value)}/>
                <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800" onClick={() => void handleCreateUrlAction()}>
                  Adicionar Link
                </Button>
              </div>

              {error ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>) : null}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-slate-50/40 p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{getScopeButtonLabel(scope)}</p>

              {isLoading ? (<p className="mt-4 text-sm text-slate-500">{'Carregando botões...'}</p>) : actions.length === 0 ? (<div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">{'Nenhum botão configurado ainda.'}
                </div>) : (<div className="mt-4 grid gap-4">
                  {actions.map((action) => (<article key={action.id} className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                              #{action.position}
                            </span>
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                              {action.action_type === 'file' ? 'Arquivo' : 'URL'}
                            </span>
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                              {getLessonFooterActionScopeLabel(action.scope)}
                            </span>
                            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                              {getLessonFooterOpenTargetLabel(action.open_target ?? (action.open_in_new_tab ? 'new-tab' : 'same-tab'))}
                            </span>
                            {action.template?.name ? (<span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                {action.template.name}
                              </span>) : null}
                          </div>
                          <div className="mt-3">
                            <Button type="button" variant="outline" className={getLessonFooterButtonClassName(action.template)}>
                              {renderButtonTemplateIcon(getLessonFooterActionIconName(action))}
                              {action.label ?? action.file_name ?? action.template?.default_label ?? 'Botão sem título'}
                            </Button>
                          </div>
                          <p className="mt-2 text-sm text-slate-500 break-all">
                            {action.action_type === 'url'
                        ? action.url
                        : `${action.file_name ?? 'Arquivo'} • ${formatBytes(action.file_size_bytes)}`}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => void handleOpen(action)}>
                            Visualizar
                          </Button>
                          <Button variant="outline" className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => startEditingAction(action)}>
                            Editar
                          </Button>
                          <Button variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void handleDelete(action)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </article>))}
                </div>)}
            </section>
          </div>

          {editingAction ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
              onClick={cancelEditingAction}
            >
              <div
                className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-sm font-black text-slate-900">Editar botão</p>
                    <p className="text-xs text-slate-500">
                      {editingAction.action_type === 'file'
                        ? 'Você pode trocar o arquivo e atualizar o rótulo.'
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
                    <span className="text-sm font-bold text-slate-800">Rótulo</span>
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
                  ) : (
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
                  )}

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
        </section>
    );
}
