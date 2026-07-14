import { useState, useEffect } from 'react';
import ReactQuill from '@/components/forms/react-quill';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import { fetchCourseCategories, resetCourseProgress, updateCourse, uploadCourseLogo, uploadCourseThumbnail, toErrorMessage, type ResetCourseProgressResult, } from '@/features/admin/content/api';
import { courseFormSchema } from '@/features/admin/content/schemas';
import { fetchSiteContent } from '@/features/site-editor/api';
import { normalizeCourseCategoryList } from '@/features/courses/course-categories';
import { normalizeResourcesItems } from '@/features/public/genflix-resource-items-editor';
import { formatCurrencyInputFromCents, parseCurrencyInputToCents } from '@/lib/currency';
import { publishBuilderNotice } from '@/lib/builder-notice';
import { COURSE_QUIZ_TYPE_OPTIONS, DEFAULT_COURSE_QUIZ_TYPE_SETTINGS, getVisibleCourseQuizTypeOptions, normalizeCourseQuizTypeSettings, } from '@/features/assessments/course-quiz-type-settings';
import { fetchGlobalQuizTypeSettings } from '@/features/admin/quiz-types/api';
import type { Course, CourseCategory, CourseQuizTypeSettings } from '@/types/content';
import type { EditableListItem } from '@/features/site-editor/types';
function slugifyCourseTitle(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
type CourseSettingsFormState = {
    title: string;
    description: string;
    status: Course['status'];
    thumbnail_url: string;
    hero_video_url: string;
    logo_url: string;
    student_hero_image_url: string;
    slug: string;
    launch_date: string;
    price_cents: number;
    currency: Course['currency'];
    is_public: boolean;
    access_expiration_mode: Course['access_expiration_mode'];
    access_expiration_date: string;
    access_expiration_days: number | null;
    show_reviews: boolean;
    categories: string[];
    resource_item_ids: string[];
    creator_id: string;
    creator_commission_percent: number;
    has_linear_progression: boolean;
    quiz_type_settings: CourseQuizTypeSettings;
};
export function CourseSettingsPanel() {
    const { courseTree, refreshTree } = useCourseBuilder();
    const { session } = useAuth();
    const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
    const [form, setForm] = useState<CourseSettingsFormState>({
        title: '',
        description: '',
        status: 'draft',
        thumbnail_url: '',
        hero_video_url: '',
        logo_url: '',
        student_hero_image_url: '',
        slug: '',
        launch_date: '',
        price_cents: 0,
        currency: 'BRL',
        is_public: true,
        access_expiration_mode: 'lifetime',
        access_expiration_date: '',
        access_expiration_days: null,
        show_reviews: true,
        categories: [],
        resource_item_ids: [],
        creator_id: '',
        creator_commission_percent: 0,
        has_linear_progression: true,
        quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
    });
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingStudentHero, setIsUploadingStudentHero] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResettingProgress, setIsResettingProgress] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [resetProgressSuccess, setResetProgressSuccess] = useState<ResetCourseProgressResult | null>(null);
    const [availableCategories, setAvailableCategories] = useState<CourseCategory[]>([]);
    const [globalQuizTypeSettings, setGlobalQuizTypeSettings] = useState({ ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS });
    const [resourceCatalog, setResourceCatalog] = useState<EditableListItem[]>([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    useEffect(() => {
        if (courseTree) {
            const courseTitle = courseTree.course.title || '';
            const savedSlug = courseTree.course.slug?.trim() || '';
            const generatedSlug = slugifyCourseTitle(courseTitle);
            setForm({
                title: courseTitle,
                description: courseTree.course.description ?? '',
                status: courseTree.course.status || 'draft',
                thumbnail_url: courseTree.course.thumbnail_url ?? '',
                hero_video_url: courseTree.course.hero_video_url ?? '',
                logo_url: courseTree.course.logo_url ?? '',
                student_hero_image_url: courseTree.course.student_hero_image_url ?? '',
                slug: savedSlug || generatedSlug,
                launch_date: courseTree.course.launch_date ?? '',
                price_cents: courseTree.course.price_cents ?? 0,
                currency: (courseTree.course.currency as CourseSettingsFormState['currency']) ?? 'BRL',
                is_public: courseTree.course.is_public ?? true,
                access_expiration_mode: courseTree.course.access_expiration_mode ?? 'lifetime',
                access_expiration_date: courseTree.course.access_expiration_date ?? '',
                access_expiration_days: courseTree.course.access_expiration_days ?? null,
                show_reviews: courseTree.course.show_reviews ?? true,
                categories: normalizeCourseCategoryList(courseTree.course.categories.length > 0
                    ? courseTree.course.categories
                    : courseTree.course.category
                        ? [courseTree.course.category]
                        : []),
                resource_item_ids: Array.isArray(courseTree.course.resource_item_ids) ? courseTree.course.resource_item_ids : [],
                creator_id: courseTree.course.creator_id ?? '',
                creator_commission_percent: courseTree.course.creator_commission_percent ?? 0,
                has_linear_progression: courseTree.course.has_linear_progression ?? true,
                quiz_type_settings: normalizeCourseQuizTypeSettings(courseTree.course.quiz_type_settings),
            });
            setIsSlugManuallyEdited(Boolean(savedSlug && savedSlug !== generatedSlug));
            setResetProgressSuccess(null);
        }
    }, [courseTree]);
    useEffect(() => {
        let isMounted = true;
        async function loadCategories() {
            try {
                const categories = await fetchCourseCategories(true);
                if (isMounted) {
                    setAvailableCategories(categories);
                }
            }
            catch {
                if (isMounted) {
                    setAvailableCategories([]);
                }
            }
        }
        void loadCategories();
        return () => {
            isMounted = false;
        };
    }, []);
    useEffect(() => {
        let isMounted = true;
        async function loadSettings() {
            try {
                const loadedSettings = await fetchGlobalQuizTypeSettings();
                if (isMounted) {
                    setGlobalQuizTypeSettings(loadedSettings);
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
    useEffect(() => {
        let isMounted = true;
        async function loadResources() {
            setIsLoadingResources(true);
            try {
                const entries = await fetchSiteContent('resources');
                const resourcesEntry = entries.find((entry) => entry.entry_key === 'resources.items');
                if (isMounted) {
                    setResourceCatalog(normalizeResourcesItems(resourcesEntry?.value));
                }
            }
            catch {
                if (isMounted) {
                    setResourceCatalog([]);
                }
            }
            finally {
                if (isMounted) {
                    setIsLoadingResources(false);
                }
            }
        }
        void loadResources();
        return () => {
            isMounted = false;
        };
    }, []);
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
            setError('Falha ao subir imagem. Tente novamente.');
        }
        finally {
            setIsUploadingThumbnail(false);
        }
    }
    async function handleStudentHeroUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setError(null);
        setIsUploadingStudentHero(true);
        try {
            const url = await uploadCourseThumbnail(file);
            setForm((current) => ({ ...current, student_hero_image_url: url }));
        }
        catch {
            setError('Falha ao subir imagem. Tente novamente.');
        }
        finally {
            setIsUploadingStudentHero(false);
        }
    }
    async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setError(null);
        setIsUploadingLogo(true);
        try {
            const url = await uploadCourseLogo(file);
            setForm((current) => ({ ...current, logo_url: url }));
        }
        catch {
            setError('Falha ao subir o logotipo. Tente novamente.');
        }
        finally {
            setIsUploadingLogo(false);
            event.target.value = '';
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
                title: "Configurações salvas",
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

         <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 md:p-10 flex flex-col gap-10">
            <section className="order-1 rounded-[32px] border border-cyan-100 bg-cyan-50/40 p-5 md:p-6">
               <div className="max-w-3xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-700">Nome do curso</p>
                  <h3 className="text-[2rem] font-black tracking-tight text-slate-900">Identificação e publicação</h3>
                  <p className="max-w-[860px] text-base leading-8 text-slate-600">Defina como o curso será identificado e quais informações aparecerão para os alunos no catálogo.</p>
               </div>

               <div className="mt-6 space-y-6">
                  <label className="block space-y-2">
                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Nome do curso</span>
                     <input className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-4 text-lg font-bold outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: isSlugManuallyEdited ? current.slug : slugifyCourseTitle(event.target.value) }))} placeholder="Informe o nome do curso" />
                  </label>

                  <label className="block space-y-2">
                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Slug público</span>
                     <input className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-4 text-sm font-semibold outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" placeholder="ex: curso-residencia-medica" value={form.slug} onChange={(event) => {
                        setIsSlugManuallyEdited(true);
                        setForm((current) => ({ ...current, slug: slugifyCourseTitle(event.target.value) }));
                     }} />
                     <span className="block text-xs font-medium text-slate-500">Preenchido automaticamente pelo nome do curso. Edite para personalizar o endereço público.</span>
                  </label>

                  <div className="block space-y-2">
                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Descrição do Card do Curso</span>
                     <div className="rich-editor-container">
                        <ReactQuill theme="snow" value={form.description} onChange={(val: string) => setForm((current) => ({ ...current, description: val }))} modules={quillModules} placeholder="Fale sobre os objetivos e o público-alvo do curso..." className="overflow-hidden rounded-[24px] border border-slate-200 bg-white transition-all focus-within:ring-4 focus-within:ring-blue-100" />
                     </div>
                  </div>

                  <label className="block space-y-2">
                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Status de Publicação</span>
                     <select className="w-full cursor-pointer appearance-none rounded-[20px] border border-slate-200 bg-white px-6 py-4 font-bold transition-all focus:ring-4 focus:ring-blue-100" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Course['status'] }))}>
                        <option value="draft">Rascunho (Privado)</option>
                        <option value="published">Publicado (Visível para Alunos)</option>
                        <option value="archived">Arquivado (Desativado)</option>
                     </select>
                  </label>

                   <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/20 p-5 shadow-sm transition-colors hover:bg-blue-50/40">
                     <div className="flex h-6 items-center">
                        <input type="checkbox" checked={form.has_linear_progression} onChange={(event) => setForm((current) => ({ ...current, has_linear_progression: event.target.checked }))} className="h-5 w-5 rounded border-blue-300 text-blue-600 shadow-sm transition-all focus:ring-blue-600" />
                     </div>
                     <div className="space-y-1">
                        <span className="block text-sm font-bold text-slate-900">Ativar Progressão Linear Obrigatória</span>
                        <span className="block max-w-lg text-[11px] leading-relaxed text-slate-500">Se ativado, o aluno deve concluir obrigatoriamente a aula atual para liberar a próxima. Módulos bloqueados só serão liberados ao concluir o módulo anterior (incluindo provas).</span>
                      </div>
                   </label>

                   <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-cyan-200">
                      <input type="checkbox" checked={form.is_public} onChange={(event) => setForm((current) => ({ ...current, is_public: event.target.checked }))}/>
                      <div>
                         <p className="text-sm font-black text-slate-800">Exibir curso no catálogo público</p>
                         <p className="text-xs font-medium text-slate-500">Se desativado, o curso continua no admin mas não aparece para o público.</p>
                      </div>
                   </label>

                   <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-cyan-200">
                      <input type="checkbox" checked={form.show_reviews} onChange={(event) => setForm((current) => ({ ...current, show_reviews: event.target.checked }))}/>
                      <div>
                         <p className="text-sm font-black text-slate-800">Exibir avaliacoes na pagina publica</p>
                         <p className="text-xs font-medium text-slate-500">Quando desativado, a secao de reviews nao aparece no curso.</p>
                      </div>
                   </label>
               </div>
            </section>

            {/* THUMBNAIL UPLOAD AREA */}
            <section className="order-4 rounded-[32px] border border-slate-200 bg-slate-50/40 p-5 md:p-6">
               <div className="max-w-3xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#0F5AA3]">Capa do Curso</p>
                  <h3 className="text-[2rem] font-black tracking-tight text-slate-900">Upload de imagem</h3>
                  <p className="max-w-[860px] text-base leading-8 text-slate-600">A capa alimenta cards e páginas públicas. Use uma imagem em aspecto 4:3, com tamanho recomendado de 1200x900 px (mínimo 800x600 px). O upload gera um asset público apenas para a imagem comercial do curso.
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
                        <p className="text-sm font-semibold text-slate-500">Aspecto definido: 4:3. Recomendado: 1200x900 px. Mínimo: 800x600 px.</p>
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

             <section className="order-5 rounded-[32px] border border-slate-200 bg-slate-50/40 p-5 md:p-6">
               <div className="max-w-3xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#0F5AA3]">Logotipo do Curso</p>
                  <h3 className="text-[2rem] font-black tracking-tight text-slate-900">Upload do logo</h3>
                  <p className="max-w-[860px] text-base leading-8 text-slate-600">Envie o arquivo do logotipo do curso para uso na página pública e em outras superfícies do catálogo. O arquivo será salvo no storage e a URL pública ficará disponível no campo abaixo.</p>
               </div>

               <div className="mt-6 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                  <div className={`relative flex min-h-[194px] items-center justify-center overflow-hidden rounded-[28px] border border-[#0B5D8D]/20 bg-[radial-gradient(circle_at_top,_rgba(36,188,224,0.24),_transparent_55%),linear-gradient(145deg,#1AA0C7_0%,#104E6B_100%)] shadow-[0_24px_44px_rgba(16,78,107,0.18)] ${isUploadingLogo ? 'animate-pulse' : ''}`}>
                     {form.logo_url ? (<img src={form.logo_url} alt="Logotipo do curso" className="absolute inset-0 h-full w-full object-contain p-8"/>) : (<div className="rounded-[20px] border border-white/50 bg-white/92 px-5 py-4 text-center text-[#0F5AA3] shadow-lg shadow-black/10">
                           <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#0F5AA3]/70">Sem logo definido</p>
                           <p className="mt-2 text-sm font-semibold text-[#0F5AA3]">Escolha um arquivo para gerar a URL pública do logotipo.</p>
                        </div>)}
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 md:px-6 md:py-6">
                     <div className="space-y-2">
                        <p className="text-xl font-black tracking-tight text-slate-900">Enviar novo logotipo</p>
                        <p className="text-base leading-7 text-slate-600">PNG e WEBP com fundo transparente costumam funcionar melhor no topo do curso. Depois do upload, confirme em guardar configurações.</p>
                        <p className="text-sm font-semibold text-slate-500">O arquivo será publicado no storage e a URL pública será preenchida automaticamente.</p>
                     </div>

                     <div className="mt-5 flex flex-wrap items-center gap-4">
                        <label className="inline-flex cursor-pointer items-center gap-3">
                           <span className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition-colors hover:border-[#1398B7]/40 hover:bg-white">
                              {isUploadingLogo ? 'Enviando...' : 'Escolher arquivo'}
                           </span>
                           <input type="file" accept="image/*" disabled={isUploadingLogo} onChange={handleLogoUpload} className="sr-only" title="Selecionar logotipo do curso"/>
                        </label>
                        <span className="text-sm font-medium text-slate-500">
                           {isUploadingLogo
            ? 'Enviando logotipo...'
            : form.logo_url
                ? 'Logo atual carregado. Escolha outro arquivo para substituir.'
                : 'Nenhum arquivo escolhido'}
                        </span>
                     </div>

                     {form.logo_url ? (<div className="mt-5 flex flex-wrap items-center gap-3">
                           <a href={form.logo_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#1398B7] transition-colors hover:text-[#0F5AA3]">
                              Abrir logo atual
                           </a>
                           <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, logo_url: '' }))} className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900">
                              Remover logotipo
                           </Button>
                        </div>) : null}

                     <div className="mt-5">
                        <label className="block space-y-2">
                           <span className="text-xs font-black uppercase tracking-widest text-slate-400">URL do logo</span>
                           <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.logo_url} onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))} placeholder="https://..."/>
                        </label>
                     </div>
                  </div>
               </div>
            </section>

             <section className="order-6 rounded-[32px] border border-slate-200 bg-slate-50/40 p-5 md:p-6">
               <div className="max-w-3xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#0F5AA3]">Banner da Área do Aluno</p>
                  <h3 className="text-[2rem] font-black tracking-tight text-slate-900">Imagem do cabeçalho do curso</h3>
                  <p className="max-w-[860px] text-base leading-8 text-slate-600">Essa imagem aparece no topo da área do aluno do curso. Use um banner em aspecto 3:1, com tamanho recomendado de 1800x600 px (mínimo 1200x400 px). Evite colocar textos importantes nas bordas, porque a imagem pode ser recortada em telas menores.</p>
               </div>

               <div className="mt-6 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                  <div className={`relative overflow-hidden rounded-[28px] border border-[#0B5D8D]/20 bg-[radial-gradient(circle_at_top,_rgba(36,188,224,0.24),_transparent_55%),linear-gradient(145deg,#1AA0C7_0%,#104E6B_100%)] shadow-[0_24px_44px_rgba(16,78,107,0.18)] ${form.student_hero_image_url ? 'min-h-[194px]' : 'min-h-[194px]'}`}>
                     {form.student_hero_image_url ? (<>
                           <img src={form.student_hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover"/>
                        </>) : null}

                     <div className="relative flex h-full min-h-[194px] items-center justify-center p-6">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/50 bg-white/92 text-[#0F5AA3] shadow-lg shadow-black/10 transition-all ${isUploadingStudentHero ? 'animate-pulse' : ''}`}>
                           {isUploadingStudentHero ? (<svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m-5-3v6"/>
                              </svg>)}
                        </div>
                     </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 md:px-6 md:py-6">
                     <div className="space-y-2">
                        <p className="text-xl font-black tracking-tight text-slate-900">Enviar novo banner</p>
                        <p className="text-base leading-7 text-slate-600">Formatos recomendados: JPG, PNG ou WEBP. Depois do upload, confirme em guardar configurações.</p>
                        <p className="text-sm font-semibold text-slate-500">Aspecto definido: 3:1. Recomendado: 1800x600 px. Mínimo: 1200x400 px.</p>
                     </div>

                     <div className="mt-5 flex flex-wrap items-center gap-4">
                        <label className="inline-flex cursor-pointer items-center gap-3">
                           <span className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition-colors hover:border-[#1398B7]/40 hover:bg-white">
                              Escolher arquivo
                           </span>
                           <input type="file" accept="image/*" onChange={handleStudentHeroUpload} className="sr-only" title="Selecionar imagem do banner do aluno"/>
                        </label>
                        <span className="text-sm font-medium text-slate-500">
                           {isUploadingStudentHero
            ? 'Enviando imagem...'
            : form.student_hero_image_url
                ? 'Imagem atual carregada. Escolha outro arquivo para substituir.'
                : 'Nenhum arquivo escolhido'}
                        </span>
                     </div>

                     {form.student_hero_image_url ? (<div className="mt-5 flex flex-wrap items-center gap-3">
                           <a href={form.student_hero_image_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#1398B7] transition-colors hover:text-[#0F5AA3]">
                              Abrir imagem atual
                           </a>
                           <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, student_hero_image_url: '' }))} className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900">
                              Remover imagem
                           </Button>
                        </div>) : null}
                  </div>
               </div>
            </section>

             <section className="order-7 rounded-[32px] border border-slate-200 bg-white p-5 md:p-6">
               <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-3xl space-y-2">
                     <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#0F5AA3]">Prévia dos banners</p>
                     <h3 className="text-xl font-black tracking-tight text-slate-900">Conferência rápida da capa e do cabeçalho</h3>
                     <p className="text-sm leading-7 text-slate-600">Veja como as duas imagens aparecem no curso antes de salvar. A capa mantém o aspecto 4:3 e o banner do aluno mantém o aspecto 3:1.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                     Preview sem sombra
                  </div>
               </div>

               <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                     <div className="border-b border-slate-200 px-5 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#0F5AA3]">Capa do curso</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">Aspecto 4:3 - 1200x900 px recomendado</p>
                     </div>
                     <div className="relative aspect-[4/3] bg-slate-100">
                        {form.thumbnail_url ? (
                           <img
                              src={form.thumbnail_url}
                              alt="Prévia da capa do curso"
                              className="absolute inset-0 h-full w-full object-cover"
                           />
                        ) : (
                           <div className="flex h-full items-center justify-center px-6 text-center">
                              <div className="space-y-2">
                                 <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Sem capa definida</p>
                                 <p className="text-sm leading-6 text-slate-500">Envie uma imagem de capa para visualizar aqui a prévia do curso.</p>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                     <div className="border-b border-slate-200 px-5 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#0F5AA3]">Banner da área do aluno</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">Aspecto 3:1 - 1800x600 px recomendado</p>
                     </div>
                     <div className="relative aspect-[3/1] bg-slate-100">
                        {form.student_hero_image_url ? (
                           <img
                              src={form.student_hero_image_url}
                              alt="Prévia do banner do aluno"
                              className="absolute inset-0 h-full w-full object-cover"
                           />
                        ) : (
                           <div className="flex h-full items-center justify-center px-6 text-center">
                              <div className="space-y-2">
                                 <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Sem banner definido</p>
                                 <p className="text-sm leading-6 text-slate-500">Envie a imagem do cabeçalho para visualizar o banner da área do aluno.</p>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </section>

             <div className="contents">

                <section className="order-2 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Categorias</p>
                        <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Categorias do curso</h3>
                        <p className="mt-2 text-sm font-medium text-slate-600">Selecione as mesmas categorias usadas no catálogo. A primeira marcada vira a categoria principal.</p>
                     </div>
                     <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Selecionadas</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{form.categories.length}</p>
                     </div>
                  </div>

                  <div className="mt-6">
                     {availableCategories.length ? (
                       <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {availableCategories.map((category) => {
                            const isSelected = form.categories.includes(category.name);
                            const isSelectable = category.is_active || isSelected;
                            return (
                              <label
                                key={category.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-[22px] border p-4 transition ${isSelected ? 'border-cyan-200 bg-cyan-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-cyan-200'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!isSelectable}
                                  onChange={(event) => {
                                    const currentCategories = normalizeCourseCategoryList(form.categories);
                                    const nextCategories = event.target.checked
                                      ? normalizeCourseCategoryList([...currentCategories, category.name])
                                      : currentCategories.filter((item) => item !== category.name);
                                    setForm((current) => ({
                                      ...current,
                                      categories: nextCategories,
                                    }));
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-black text-slate-900">{category.name}</span>
                                  <span className="mt-1 block text-xs font-medium text-slate-500">
                                    {category.slug ? `/${category.slug}` : 'Sem slug'}
                                    {!category.is_active ? ' · Inativa' : ''}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                       </div>
                     ) : (
                       <p className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm font-medium text-slate-500">
                         Nenhuma categoria cadastrada. Use a aba de categorias em Catálogo de Cursos e volte aqui.
                       </p>
                     )}
                  </div>

                  <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-600">
                     <p className="font-black text-slate-900">Categoria principal</p>
                     <p className="mt-1">{form.categories[0] ?? 'Nenhuma categoria selecionada'}</p>
                  </div>
               </section>

                <section className="order-3 space-y-5 rounded-[28px] border border-cyan-100 bg-cyan-50/60 p-6">
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Vendas e acesso</p>
                     <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Configure o checkout do curso</h3>
                     <p className="mt-2 text-sm font-medium text-slate-600">
                        Os dados abaixo alimentam o checkout do Asaas e a liberação automática do acesso após a compra.
                     </p>
                  </div>

                   <div className="grid gap-4 md:grid-cols-2">
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

                   </div>

                   <div className="space-y-4 rounded-2xl border border-cyan-100 bg-white p-5">
                      <div>
                         <p className="text-xs font-black uppercase tracking-widest text-slate-400">Término do acesso ao curso</p>
                         <p className="mt-2 text-xs font-medium leading-5 text-slate-500">Defina por quanto tempo o aluno poderá acessar o conteúdo depois que a inscrição for liberada.</p>
                      </div>

                      <select className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" value={form.access_expiration_mode} onChange={(event) => {
                         const mode = event.target.value as CourseSettingsFormState['access_expiration_mode'];
                         setForm((current) => ({
                            ...current,
                            access_expiration_mode: mode,
                            access_expiration_date: mode === 'specific_date' ? current.access_expiration_date : '',
                            access_expiration_days: mode === 'days_after_course_open' || mode === 'days_after_enrollment' ? current.access_expiration_days : null,
                         }));
                      }}>
                         <option value="specific_date">Término em uma data específica</option>
                         <option value="days_after_course_open">Término após X dias da abertura das inscrições</option>
                         <option value="days_after_enrollment">Término após X dias da inscrição do aluno</option>
                         <option value="lifetime">Sem período máximo de acesso (vitalício)</option>
                      </select>

                      {form.access_expiration_mode === 'specific_date' ? (
                         <label className="block space-y-2">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Data final de acesso</span>
                            <input type="date" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" value={form.access_expiration_date} onChange={(event) => setForm((current) => ({ ...current, access_expiration_date: event.target.value }))}/>
                         </label>
                      ) : null}

                      {form.access_expiration_mode === 'days_after_course_open' || form.access_expiration_mode === 'days_after_enrollment' ? (
                         <label className="block space-y-2">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Quantidade de dias</span>
                            <input type="number" min={1} step={1} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" value={form.access_expiration_days ?? ''} onChange={(event) => setForm((current) => ({ ...current, access_expiration_days: event.target.value ? Number(event.target.value) : null }))} placeholder="Ex.: 365"/>
                            <span className="block text-xs font-medium text-slate-500">{form.access_expiration_mode === 'days_after_course_open' ? 'A contagem começa na data de lançamento do curso. Se ela não estiver definida, usa a criação do curso.' : 'A contagem começa quando o acesso individual do aluno é liberado.'}</span>
                         </label>
                      ) : null}
                   </div>

               </section>

               <section className="order-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                     <div className="max-w-3xl space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#0F5AA3]">Recursos disponíveis</p>
                        <h3 className="text-xl font-black tracking-tight text-slate-900">Selecione os recursos que aparecem na pagina publica</h3>
                        <p className="text-sm leading-7 text-slate-600">A lista abaixo vem do catalogo oficial em /admin/recursos. Marque apenas o que este curso deve exibir na lateral da pagina publica.</p>
                     </div>
                     <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                        {isLoadingResources ? 'Carregando...' : `${form.resource_item_ids.length} selecionados`}
                     </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                     {resourceCatalog.length ? resourceCatalog.map((resource) => {
            const itemId = resource.id;
            const itemTitle = resource.title || resource.label || itemId;
            const isSelected = form.resource_item_ids.includes(itemId);
            return (<label key={itemId} className={`flex cursor-pointer flex-col gap-3 rounded-[22px] border p-4 transition ${isSelected ? 'border-cyan-200 bg-cyan-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-cyan-200'}`}>
                           <div className="flex items-start justify-between gap-3">
                              <div>
                                 <p className="text-sm font-black text-slate-900">{itemTitle}</p>
                              </div>
                              <input type="checkbox" checked={isSelected} onChange={(event) => {
                    const nextSelected = event.target.checked
                        ? [...form.resource_item_ids, itemId]
                        : form.resource_item_ids.filter((currentId) => currentId !== itemId);
                    setForm((current) => ({ ...current, resource_item_ids: nextSelected }));
                }} />
                           </div>
                        </label>);
        }) : (<div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm font-medium text-slate-500">Nenhum recurso encontrado no catalogo oficial.</div>)}
                  </div>
               </section>

                </div>

                <div className="order-9 space-y-5 border-t border-slate-100 pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                     <div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{'Tipos de Quiz Disponíveis'}</span>
                        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">{'Ative ou desative quais formatos de pergunta podem ser usados neste curso. O builder de avaliações passa a respeitar essa configuração.'}
                        </p>
                        {hiddenQuizTypeCount > 0 ? (<p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-amber-700">
                            {`${hiddenQuizTypeCount} tipo(s) de quiz estão desativados globalmente e não aparecem nesta tela.`}
                          </p>) : null}
                     </div>
                     <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ativos agora</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{enabledQuizTypeCount}</p>
                     </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5">
                     {visibleQuizTypeOptions.length === 0 ? (<div className="rounded-[24px] border border-dashed border-amber-200 bg-amber-50/70 px-5 py-6 text-sm font-semibold text-amber-800">Nenhum tipo de quiz está habilitado globalmente no momento. Ative um tipo na configuração global para liberá-lo neste curso.
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

      <section className="space-y-6 rounded-[32px] border border-rose-200 bg-white p-6 shadow-sm md:p-10">
        <div className="border-b border-rose-100 pb-5">
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Renovar Progresso do Curso</h3>
          <p className="mt-1 text-sm text-slate-500">{'Use esta ação quando precisar reiniciar o curso para todos os alunos e liberar um novo ciclo completo de aulas e avaliações.'}
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
