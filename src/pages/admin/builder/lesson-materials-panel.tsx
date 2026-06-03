import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { getLessonFooterActionIconName, getLessonFooterButtonClassName, renderButtonTemplateIcon, } from '@/features/admin/content/button-template-icons';
import { createLessonFooterAction, deleteLessonFooterAction, fetchButtonTemplates, fetchLessonFooterActions, getSignedLessonFooterActionUrl, toErrorMessage, } from '@/features/admin/content/api';
import { publishBuilderNotice } from '@/lib/builder-notice';
import { lessonFooterActionFormSchema } from '@/features/admin/content/schemas';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import type { ButtonTemplate, Lesson, LessonFooterAction } from '@/types/content';
function formatBytes(value: number): string {
    if (value === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const normalized = value / 1024 ** unitIndex;
    return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
export function LessonMaterialsPanel() {
    const { courseId, moduleId, lessonId } = useParams<{
        courseId: string;
        moduleId: string;
        lessonId: string;
    }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { courseTree } = useCourseBuilder();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [templates, setTemplates] = useState<ButtonTemplate[]>([]);
    const [actions, setActions] = useState<LessonFooterAction[]>([]);
    const [urlLabel, setUrlLabel] = useState('');
    const [urlValue, setUrlValue] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (courseTree && lessonId) {
            for (const module of courseTree.modules) {
                const found = module.lessons.find((item) => item.id === lessonId);
                if (found) {
                    setLesson(found);
                    break;
                }
            }
        }
    }, [courseTree, lessonId]);
    const nextPosition = useMemo(() => (actions.length ? Math.max(...actions.map((action) => action.position)) + 1 : 1), [actions]);
    const activeTemplates = useMemo(() => templates.filter((template) => template.is_active), [templates]);
    const loadData = useCallback(async () => {
        if (!lessonId)
            return;
        setIsLoading(true);
        try {
            const [loadedTemplates, loadedActions] = await Promise.all([
                fetchButtonTemplates(),
                fetchLessonFooterActions(lessonId),
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
    }, [lessonId]);
    useEffect(() => {
        void loadData();
    }, [loadData]);
    async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file || !lessonId || !user)
            return;
        setIsUploading(true);
        setError(null);
        try {
            const templateId = selectedTemplateId || activeTemplates[0]?.id || null;
            const parsed = lessonFooterActionFormSchema.safeParse({
                template_id: templateId,
                action_type: 'file',
                label: '',
                position: nextPosition,
                open_in_new_tab: true,
                is_active: true,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
            }
            await createLessonFooterAction(lessonId, parsed.data, user.id, file);
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botação da aula salvo',
                message: `O arquivo "${file.name}" foi adicionado ação rodape da aula com sucesso.`,
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
        if (!lessonId || !user)
            return;
        setError(null);
        try {
            const parsed = lessonFooterActionFormSchema.safeParse({
                template_id: selectedTemplateId || null,
                action_type: 'url',
                label: urlLabel,
                url: urlValue,
                position: nextPosition,
                open_in_new_tab: true,
                is_active: true,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
            }
            await createLessonFooterAction(lessonId, parsed.data, user.id);
            setUrlLabel('');
            setUrlValue('');
            await loadData();
            publishBuilderNotice({
                type: 'success',
                title: 'Botação da aula salvo',
                message: `O link "${parsed.data.label}" foi adicionado ação rodape da aula com sucesso.`,
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }
    async function handleDelete(action: LessonFooterAction) {
        if (!window.confirm(`Excluir a ação "${action.label ?? action.file_name ?? "Sem título"}"`))
            return;
        try {
            await deleteLessonFooterAction(action);
            await loadData();
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }
    async function handleOpen(action: LessonFooterAction) {
        try {
            if (action.action_type === 'url' && action.url) {
                window.open(action.url, '_blank', 'noopener,noreferrer');
                return;
            }
            if (action.storage_path) {
                const signedUrl = await getSignedLessonFooterActionUrl(action.storage_path);
                window.open(signedUrl, '_blank', 'noopener,noreferrer');
            }
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }
    return (<div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${lessonId}`)} className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Voltar para Aula
            </button>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Botoes do Rodape da Aula</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure arquivos e links que apareceração como botoes no rodape da aula:
            {' '}
            <span className="font-bold text-slate-700">{lesson?.title}</span>
          </p>
        </div>

        <Link to="/admin/botoes-aula" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Gerenciar Padroes Globais
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Novo botão</p>
            <p className="mt-2 text-sm text-slate-500">Escolha o padração visual e adicione um arquivo ou link.</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-800">Padração visual</span>
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              <option value="">Sem padração especifico</option>
              {activeTemplates.map((template) => (<option key={template.id} value={template.id}>
                  {template.name} • {template.default_label}
                </option>))}
            </select>
          </label>

          {selectedTemplateId ? (<div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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

          <label className={`block rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center ${isUploading ? 'opacity-70' : 'cursor-pointer'}`}>
            <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading}/>
            <p className="text-sm font-black text-slate-900">Enviar arquivo para virar botão</p>
            <p className="mt-1 text-xs text-slate-500">PDF, ZIP, imagem, planilha e outros materiais de apoio.</p>
            <span className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white">
              {isUploading ? 'Enviando...' : 'Selecionar Arquivo'}
            </span>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <p className="text-sm font-black text-slate-900">Criar botão de URL</p>
            <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Rotulo personalizado opcional" value={urlLabel} onChange={(event) => setUrlLabel(event.target.value)}/>
            <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="https://..." value={urlValue} onChange={(event) => setUrlValue(event.target.value)}/>
            <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800" onClick={() => void handleCreateUrlAction()}>
              Adicionar Link
            </Button>
          </div>

          {error ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>) : null}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Acoes configuradas</p>

          {isLoading ? (<p className="mt-4 text-sm text-slate-500">Carregando botoes...</p>) : actions.length === 0 ? (<div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">Nenhum botão configurado para est? aula.
            </div>) : (<div className="mt-4 grid gap-4">
              {actions.map((action) => (<article key={action.id} className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                          #{action.position}
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                          {action.action_type === 'file' ? 'Arquivo' : 'URL'}
                        </span>
                        {action.template?.name ? (<span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                            {action.template.name}
                          </span>) : null}
                      </div>
                      <div className="mt-3">
                        <Button type="button" variant="outline" className={getLessonFooterButtonClassName(action.template)}>
                          {renderButtonTemplateIcon(getLessonFooterActionIconName(action))}
                          {action.label ?? action.file_name ?? action.template?.default_label ?? "Botação sem título"}
                        </Button>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 break-all">
                        {action.action_type === 'url'
                    ? action.url
                    : `${action.file_name ?? 'Arquivo'} • ${formatBytes(action.file_size_bytes)}`}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => void handleOpen(action)}>
                        Visualizar
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
    </div>);
}
