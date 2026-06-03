import { useState, useEffect } from 'react';
import ReactQuill from '@/components/forms/react-quill';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import { fetchCourseAiReviewStandards, upsertCourseAiReviewStandards, } from '@/features/admin/ai-review/api';
import { resetCourseProgress, updateCourse, uploadCourseThumbnail, toErrorMessage, type ResetCourseProgressResult, } from '@/features/admin/content/api';
import { courseFormSchema } from '@/features/admin/content/schemas';
import { formatCurrencyInputFromCents, parseCurrencyInputToCents } from '@/lib/currency';
import { publishBuilderNotice } from '@/lib/builder-notice';
import { canCourseUseCaseStudies, COURSE_QUIZ_TYPE_OPTIONS, DEFAULT_COURSE_QUIZ_TYPE_SETTINGS, getVisibleCourseQuizTypeOptions, normalizeCourseQuizTypeSettings, } from '@/features/assessments/course-quiz-type-settings';
import { fetchGlobalQuizTypeSettings } from '@/features/admin/quiz-types/api';
import { fetchAdminUsers, type AdminUserListItem } from '@/features/admin/users/api';
import type { Course, CourseQuizTypeSettings } from '@/types/content';
type CourseSettingsFormState = {
    title: string;
    description: string;
    status: Course['status'];
    thumbnail_url: string;
    slug: string;
    launch_date: string;
    price_cents: number;
    currency: Course['currency'];
    is_public: boolean;
    creator_id: string;
    creator_commission_percent: number;
    has_linear_progression: boolean;
    quiz_type_settings: CourseQuizTypeSettings;
};
export function CourseSettingsPanel() {
    const { courseTree, refreshTree } = useCourseBuilder();
    const { user, session } = useAuth();
    const [form, setForm] = useState<CourseSettingsFormState>({
        title: '',
        description: '',
        status: 'draft',
        thumbnail_url: '',
        slug: '',
        launch_date: '',
        price_cents: 0,
        currency: 'BRL',
        is_public: true,
        creator_id: '',
        creator_commission_percent: 0,
        has_linear_progression: true,
        quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
    });
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingAiStandards, setIsSavingAiStandards] = useState(false);
    const [isResettingProgress, setIsResettingProgress] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [aiStandardsSuccess, setAiStandardsSuccess] = useState(false);
    const [resetProgressSuccess, setResetProgressSuccess] = useState<ResetCourseProgressResult | null>(null);
    const [globalQuizTypeSettings, setGlobalQuizTypeSettings] = useState({ ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS });
    const [creatorUsers, setCreatorUsers] = useState<AdminUserListItem[]>([]);
    const [aiStandards, setAiStandards] = useState({
        ideal_course_structure: '',
        required_elements: '',
        bibliography_rules: '',
        table_formatting_rules: '',
        additional_review_rules: '',
    });
    useEffect(() => {
        if (courseTree) {
            setForm({
                title: courseTree.course.title || '',
                description: courseTree.course.description ?? '',
                status: courseTree.course.status || 'draft',
                thumbnail_url: courseTree.course.thumbnail_url ?? '',
                slug: courseTree.course.slug ?? '',
                launch_date: courseTree.course.launch_date ?? '',
                price_cents: courseTree.course.price_cents ?? 0,
                currency: (courseTree.course.currency as CourseSettingsFormState['currency']) ?? 'BRL',
                is_public: courseTree.course.is_public ?? true,
                creator_id: courseTree.course.creator_id ?? '',
                creator_commission_percent: courseTree.course.creator_commission_percent ?? 0,
                has_linear_progression: courseTree.course.has_linear_progression ?? true,
                quiz_type_settings: normalizeCourseQuizTypeSettings(courseTree.course.quiz_type_settings),
            });
            setResetProgressSuccess(null);
        }
    }, [courseTree]);
    useEffect(() => {
        async function loadAiStandards() {
            if (!courseTree)
                return;
            try {
                const standards = await fetchCourseAiReviewStandards(courseTree.course.id);
                setAiStandards({
                    ideal_course_structure: standards?.ideal_course_structure ?? '',
                    required_elements: standards?.required_elements ?? '',
                    bibliography_rules: standards?.bibliography_rules ?? '',
                    table_formatting_rules: standards?.table_formatting_rules ?? '',
                    additional_review_rules: standards?.additional_review_rules ?? '',
                });
            }
            catch (err) {
                setError(toErrorMessage(err));
            }
        }
        void loadAiStandards();
    }, [courseTree]);
    useEffect(() => {
        let isMounted = true;
        async function loadSettings() {
            try {
                const [loadedSettings, users] = await Promise.all([
                    fetchGlobalQuizTypeSettings(),
                    session ? fetchAdminUsers(session) : Promise.resolve([]),
                ]);
                if (isMounted) {
                    setGlobalQuizTypeSettings(loadedSettings);
                    setCreatorUsers(users.filter((candidate) => candidate.roles.some((role) => role.code === 'criador' || role.code === 'professor')));
                }
            }
            catch {
                if (isMounted) {
                    setGlobalQuizTypeSettings({ ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS });
                }
            }
        }
        void loadSettings();
        return () => {
            isMounted = false;
        };
    }, [session]);
    async function handleThumbnailUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setError(null);
        setIsUploadingThumbnail(true);
        try {
            const url = await uploadCourseThumbnail(file);
            setForm(f => ({ ...f, thumbnail_url: url }));
        }
        catch {
            setError('Falha ação subir imagem. Tente novamente.');
        }
        finally {
            setIsUploadingThumbnail(false);
        }
    }
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!courseTree)
            return;
        setError(null);
        setSuccess(false);
        setIsSubmitting(true);
        try {
            const parsed = courseFormSchema.safeParse(form);
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            }
            await updateCourse(courseTree.course.id, parsed.data);
            await refreshTree();
            setSuccess(true);
            publishBuilderNotice({
                type: 'success',
                title: "Configura??es salvas",
                message: `As configurações do curso "${parsed.data.title}" foram salvas com sucesso.`,
            });
            setTimeout(() => setSuccess(false), 3000);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsSubmitting(false);
        }
    }
    async function handleSaveAiStandards(e: React.FormEvent) {
        e.preventDefault();
        if (!courseTree || !user)
            return;
        setError(null);
        setAiStandardsSuccess(false);
        setIsSavingAiStandards(true);
        try {
            await upsertCourseAiReviewStandards(courseTree.course.id, aiStandards, user.id);
            setAiStandardsSuccess(true);
            publishBuilderNotice({
                type: 'success',
                title: 'Padroes da IA salvos',
                message: "Os padroes de revisão com IA foram atualizados com sucesso.",
            });
            setTimeout(() => setAiStandardsSuccess(false), 3000);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsSavingAiStandards(false);
        }
    }
    async function handleResetCourseProgress() {
        if (!courseTree || !session) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }
        const shouldContinue = window.confirm(`Tem certeza que deseja renovar o progresso de todos os alunos no curso "${courseTree.course.title}" Esta a\u00E7\u00E3o apaga progresso das aulas, tentativas de avalia\u00E7\u00E3o, pedidos de nova tentativa e o progresso geral do curso para todos os alunos.`);
        if (!shouldContinue) {
            return;
        }
        setError(null);
        setResetProgressSuccess(null);
        setIsResettingProgress(true);
        try {
            const result = await resetCourseProgress(courseTree.course.id, session);
            setResetProgressSuccess(result);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsResettingProgress(false);
        }
    }
    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'clean'],
        ],
    };
    const visibleQuizTypeOptions = getVisibleCourseQuizTypeOptions(globalQuizTypeSettings);
    const enabledQuizTypeCount = visibleQuizTypeOptions.filter((option) => form.quiz_type_settings[option.key]).length;
    const hiddenQuizTypeCount = COURSE_QUIZ_TYPE_OPTIONS.length - visibleQuizTypeOptions.length;
    const canUseCaseStudies = canCourseUseCaseStudies(form.quiz_type_settings, globalQuizTypeSettings);
    return (<div className="w-full space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Detalhes Principais</h2>
        <p className="text-sm text-slate-500 mt-1">Essas informações definem como os alunos verão seu curso no catálogo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
         {error && (<div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-sm tracking-tight animate-in slide-in-from-top-2 duration-300">
               {error}
            </div>)}
         
         {success && (<div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold text-sm tracking-tight animate-in slide-in-from-top-2 duration-300">
               Configurações salvas com sucesso!
            </div>)}

         <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 md:p-10 space-y-10">
            {/* THUMBNAIL UPLOAD AREA */}
            <section className="rounded-[32px] border border-slate-200 bg-slate-50/40 p-5 md:p-6">
               <div className="max-w-3xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#0F5AA3]">Capa do Curso</p>
                  <h3 className="text-[2rem] font-black tracking-tight text-slate-900">Upload de imagem</h3>
                  <p className="max-w-[860px] text-base leading-8 text-slate-600">A capa alimenta cards e páginas publicas. O upload gera um asset pblico apenas para a imagem comercial do curso.
                  </p>
               </div>

               <div className="mt-6 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                  <div className={`relative overflow-hidden rounded-[28px] border border-[#0B5D8D]/20 bg-[radial-gradient(circle_at_top,_rgba(36,188,224,0.24),_transparent_55%),linear-gradient(145deg,#1AA0C7_0%,#104E6B_100%)] shadow-[0_24px_44px_rgba(16,78,107,0.18)] ${form.thumbnail_url ? 'min-h-[194px]' : 'min-h-[194px]'}`}>
                     {form.thumbnail_url ? (<>
                           <img src={form.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover"/>
                           <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,29,36,0.14)_0%,rgba(7,29,36,0.58)_100%)]"/>
                        </>) : null}

                     <div className="relative flex h-full min-h-[194px] items-center justify-center p-6">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/50 bg-white/92 text-[#0F5AA3] shadow-lg shadow-black/10 transition-all ${isUploadingThumbnail ? 'animate-pulse' : ''}`}>
                           {isUploadingThumbnail ? (<svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8h4m-2-2v4"/>
                              </svg>)}
                        </div>
                     </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 md:px-6 md:py-6">
                     <div className="space-y-2">
                        <p className="text-xl font-black tracking-tight text-slate-900">Enviar nova imagem</p>
                        <p className="text-base leading-7 text-slate-600">Formatos recomendados: JPG, PNG ou WEBP. Depois do upload, confirme em guardar configurações.
                        </p>
                     </div>

                     <div className="mt-5 flex flex-wrap items-center gap-4">
                        <label className="inline-flex cursor-pointer items-center gap-3">
                           <span className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition-colors hover:border-[#1398B7]/40 hover:bg-white">
                              Escolher arquivo
                           </span>
                           <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="sr-only" title="Selecionar imagem da capa"/>
                        </label>
                        <span className="text-sm font-medium text-slate-500">
                           {isUploadingThumbnail
            ? 'Enviando imagem...'
            : form.thumbnail_url
                ? 'Imagem atual carregada. Escolha outro arquivo para substituir.'
                : 'Nenhum arquivo escolhido'}
                        </span>
                     </div>

                     {form.thumbnail_url ? (<div className="mt-5 flex flex-wrap items-center gap-3">
                           <a href={form.thumbnail_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#1398B7] transition-colors hover:text-[#0F5AA3]">
                              Abrir imagem atual
                           </a>
                           <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, thumbnail_url: '' }))} className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900">
                              Remover imagem
                           </Button>
                        </div>) : null}
                  </div>
               </div>
            </section>

            <div className="grid gap-8">
               <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nãome do Curso</span>
                  <input className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all" placeholder="Ex: Primeiros Socorros Avançado" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required/>
               </label>

               <section className="rounded-[28px] border border-cyan-100 bg-cyan-50/60 p-6 space-y-5">
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Vendas e acesso</p>
                     <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Configure o checkout do curso</h3>
                     <p className="mt-2 text-sm font-medium text-slate-600">
                        Os dados abaixo alimentam o checkout do Asaas e a liberação automática do acesso após a compra.
                     </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                     <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Slug público</span>
                        <input className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:ring-4 focus:ring-cyan-100" placeholder="ex: curso-residencia-medica" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}/>
                     </label>

                     <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Data de lançamento</span>
                        <input type="date" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:ring-4 focus:ring-cyan-100" value={form.launch_date} onChange={(event) => setForm((current) => ({ ...current, launch_date: event.target.value }))}/>
                     </label>

                     <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Valor de venda</span>
                        <input className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:ring-4 focus:ring-cyan-100" value={formatCurrencyInputFromCents(form.price_cents)} onChange={(event) => setForm((current) => ({ ...current, price_cents: parseCurrencyInputToCents(event.target.value) }))}/>
                     </label>

                     <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Moeda</span>
                        <select className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:ring-4 focus:ring-cyan-100" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as 'BRL' }))}>
                           <option value="BRL">BRL - Real</option>
                        </select>
                     </label>

                     <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Criador vinculado</span>
                        <select className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:ring-4 focus:ring-cyan-100" value={form.creator_id} onChange={(event) => setForm((current) => ({ ...current, creator_id: event.target.value }))}>
                           <option value="">Sem criador vinculado</option>
                           {creatorUsers.map((creator) => (<option key={creator.id} value={creator.id}>
                               {creator.full_name || creator.email}
                             </option>))}
                        </select>
                        <p className="text-xs font-medium text-slate-500">
                           O criador verá relatórios e comissões deste curso quando a venda for confirmada.
                        </p>
                     </label>

                     <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Comissão do criador (%)</span>
                        <input type="number" min={0} max={100} step={0.01} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:ring-4 focus:ring-cyan-100" value={form.creator_commission_percent} onChange={(event) => setForm((current) => ({
            ...current,
            creator_commission_percent: Number(event.target.value || 0),
        }))}/>
                        <p className="text-xs font-medium text-slate-500">
                           A comissão fica pendente e se torna elegível para repasse em até 30 dias após a venda.
                        </p>
                     </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
                     <input type="checkbox" checked={form.is_public} onChange={(event) => setForm((current) => ({ ...current, is_public: event.target.checked }))}/>
                     <div>
                        <p className="text-sm font-black text-slate-800">Exibir curso no catálogo público</p>
                        <p className="text-xs font-medium text-slate-500">Se desativado, o curso continua no admin mas não aparece para o público.</p>
                     </div>
                  </label>
               </section>

               <div className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Detalhada</span>
                  <div className="rich-editor-container">
                     <ReactQuill theme="snow" value={form.description} onChange={(val: string) => setForm(f => ({ ...f, description: val }))} modules={quillModules} placeholder="Fale sobre os objetivos e o público-alvo do curso..." className="bg-slate-100/50 rounded-[24px] overflow-hidden border border-slate-200 focus-within:ring-4 focus-within:ring-blue-100 focus-within:bg-white transition-all"/>
                  </div>
               </div>

                  <label className="block space-y-2">
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Status de Publicação</span>
                     <select className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'draft' | 'published' | 'archived' }))}>
                        <option value="draft">Rascunho (Privado)</option>
                        <option value="published">Publicado (Visível para Alunos)</option>
                        <option value="archived">Arquivado (Desativado)</option>
                     </select>
                  </label>
               </div>

               <div className="pt-6 border-t border-slate-100">
                  <label className="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/20 cursor-pointer hover:bg-blue-50/40 transition-colors shadow-sm">
                     <div className="flex items-center h-6">
                        <input type="checkbox" checked={form.has_linear_progression} onChange={e => setForm(f => ({ ...f, has_linear_progression: e.target.checked }))} className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-600 shadow-sm transition-all"/>
                     </div>
                     <div className="space-y-1">
                        <span className="text-sm font-bold text-slate-900 block">Ativar Progressão Linear Obrigatória</span>
                        <span className="text-[11px] text-slate-500 block leading-relaxed max-w-lg">Se ativado, o aluno deve concluir obrigatoriamente a aula atual para liberar a próxima. Módulos bloqueados só serão liberados ação concluir o módulo anterior (incluindo provas).
                        </span>
                     </div>
                  </label>
               </div>

               <div className="pt-6 border-t border-slate-100 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                     <div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Tipos de Quiz Disponíveis</span>
                        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">Ative ou desative quais formatos de pergunta podem ser usados neste curso. O builder de avaliações passa a respeitar essa configuração.
                        </p>
                        {hiddenQuizTypeCount > 0 ? (<p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-amber-700">
                            {hiddenQuizTypeCount}tipo(s) de quiz estão desativados globalmente e não aparecem nesta tela.
                          </p>) : null}
                     </div>
                     <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ativos agora</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{enabledQuizTypeCount}</p>
                     </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5">
                     {visibleQuizTypeOptions.length === 0 ? (<div className="rounded-[24px] border border-dashed border-amber-200 bg-amber-50/70 px-5 py-6 text-sm font-semibold text-amber-800">Nenhum tipo de quiz est? habilitado globalmente no momento. Ative um tipo na configuração global para liberá-lo neste curso.
                       </div>) : (<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleQuizTypeOptions.map((option) => {
                const isEnabled = form.quiz_type_settings[option.key];
                return (<label key={option.key} className={`block rounded-[24px] border p-5 shadow-sm transition-all ${isEnabled ? option.accentClassName : 'border-slate-200 bg-white text-slate-500'}`}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${isEnabled ? option.badgeClassName : 'bg-slate-200 text-slate-600'}`}>
                                    {isEnabled ? 'Ativo' : 'Desativado'}
                                  </span>
                                  <div>
                                    <p className="text-base font-black tracking-tight text-slate-900">{option.title}</p>
                                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{option.description}</p>
                                  </div>
                                </div>
                                <input type="checkbox" checked={isEnabled} onChange={(event) => setForm((current) => ({
                        ...current,
                        quiz_type_settings: {
                            ...current.quiz_type_settings,
                            [option.key]: event.target.checked,
                        },
                    }))} className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                              </div>
                              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
                                {option.helper}
                              </p>
                            </label>);
            })}
                       </div>)}
                  </div>

                  <div className={`rounded-[24px] border px-5 py-4 text-sm font-semibold ${canUseCaseStudies ? 'border-violet-100 bg-violet-50/70 text-violet-800' : 'border-amber-100 bg-amber-50/80 text-amber-800'}`}>
                     {canUseCaseStudies
            ? "Estudo de caso est? pronto para uso no builder, porque pelo menos um tipo de pergunta interna est? ativo." : 'Estudo de caso exige Multipla Escolha ou Discursiva com IA ativos para aparecer como opção no builder.'}
                  </div>
               </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex justify-end">
               <Button type="submit" disabled={isSubmitting || isUploadingThumbnail} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 h-16 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50">
                  {isSubmitting ? (<>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Salvando...
                    </>) : 'Salvar Alterações'}
               </Button>
            </div>
      </form>

      <form onSubmit={handleSaveAiStandards} className="space-y-8">
        {aiStandardsSuccess && (<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold tracking-tight text-emerald-600 animate-in slide-in-from-top-2 duration-300">
            Padrões da revisão com IA salvos com sucesso!
          </div>)}

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10 space-y-8">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Padrões do Curso Perfeito</h3>
            <p className="mt-1 text-sm text-slate-500">
              Defina aqui os critérios que a IA deve usar ação revisar cada módulo individualmente.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Estrutura ideal do curso</span>
            <textarea className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Descreva como deve ser a sequência ideal de aulas, profundidade, carga, ritmo e coerência pedagógica." value={aiStandards.ideal_course_structure} onChange={(e) => setAiStandards((prev) => ({ ...prev, ideal_course_structure: e.target.value }))}/>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Elementos obrigatórios por módulo</span>
            <textarea className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Ex: objetivo claro, exemplos práticos, quiz coerente, conclusão, linguagem profissional." value={aiStandards.required_elements} onChange={(e) => setAiStandards((prev) => ({ ...prev, required_elements: e.target.value }))}/>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Regras de bibliografia e referências</span>
            <textarea className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Defina quando a aula deve conter referências, como citar e que tipo de fonte é aceitável." value={aiStandards.bibliography_rules} onChange={(e) => setAiStandards((prev) => ({ ...prev, bibliography_rules: e.target.value }))}/>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Regras de tabelas e formatação</span>
            <textarea className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Ex: não deixar colunas vazias, cabeçalhos claros, consistência entre linhas, HTML válido." value={aiStandards.table_formatting_rules} onChange={(e) => setAiStandards((prev) => ({ ...prev, table_formatting_rules: e.target.value }))}/>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Regras adicionais de revisão</span>
            <textarea className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Inclua qualquer outra orientação para a IA validar e corrigir o módulo." value={aiStandards.additional_review_rules} onChange={(e) => setAiStandards((prev) => ({ ...prev, additional_review_rules: e.target.value }))}/>
          </label>

          <div className="flex justify-end border-t border-slate-100 pt-8">
            <Button type="submit" disabled={isSavingAiStandards} className="h-14 rounded-2xl bg-slate-900 px-10 font-black shadow-xl shadow-slate-100 hover:bg-slate-800">
              {isSavingAiStandards ? 'Salvando Padrões...' : 'Salvar Padrões da IA'}
            </Button>
          </div>
        </div>
      </form>

      <section className="space-y-6 rounded-[32px] border border-rose-200 bg-white p-6 shadow-sm md:p-10">
        <div className="border-b border-rose-100 pb-5">
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Renovar Progresso do Curso</h3>
          <p className="mt-1 text-sm text-slate-500">Use est? ação quando precisar reiniciar o curso para todos os alunos e liberar um novo ciclo completo de aulas e avaliações.
          </p>
        </div>

        <div className="rounded-[28px] border border-rose-100 bg-rose-50/60 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">O que sera apagado</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-sm font-semibold text-slate-700">Progresso das aulas do curso</div>
            <div className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-sm font-semibold text-slate-700">Tentativas e resultados das avaliações</div>
            <div className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-sm font-semibold text-slate-700">Pedidos e liberações extras de nova tentativa</div>
            <div className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-sm font-semibold text-slate-700">Progresso geral de conclusão do curso</div>
          </div>
        </div>

        {resetProgressSuccess ? (<div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Progresso renovado</p>
            <p className="mt-3 text-sm font-semibold text-emerald-800">
              {resetProgressSuccess.impacted_students} aluno(s) impactado(s) no curso {resetProgressSuccess.course_title}.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Curso</p>
                <p className="mt-2 text-xl font-black text-slate-900">{resetProgressSuccess.deleted_counts.course_progress}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aulas</p>
                <p className="mt-2 text-xl font-black text-slate-900">{resetProgressSuccess.deleted_counts.lesson_progress}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tentativas</p>
                <p className="mt-2 text-xl font-black text-slate-900">{resetProgressSuccess.deleted_counts.assessment_attempts}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedidos</p>
                <p className="mt-2 text-xl font-black text-slate-900">{resetProgressSuccess.deleted_counts.assessment_attempt_requests}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Liberacoes</p>
                <p className="mt-2 text-xl font-black text-slate-900">{resetProgressSuccess.deleted_counts.assessment_attempt_grants}</p>
              </div>
            </div>
          </div>) : null}

        <div className="flex justify-end border-t border-slate-100 pt-8">
          <Button type="button" disabled={isResettingProgress} onClick={() => void handleResetCourseProgress()} className="h-14 rounded-2xl bg-rose-600 px-10 font-black shadow-xl shadow-rose-100 hover:bg-rose-700">
            {isResettingProgress ? 'Renovando progresso...' : 'Renovar progresso de todos os alunos'}
          </Button>
        </div>
      </section>
    </div>);
}
