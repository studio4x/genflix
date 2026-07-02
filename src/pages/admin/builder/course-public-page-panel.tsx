import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, Layers3, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { updateCoursePublicPage, uploadCourseLogo, toErrorMessage, } from '@/features/admin/content/api';
import { coursePublicPageFormSchema } from '@/features/admin/content/schemas';
import { fetchAdminUsers, type AdminUserListItem } from '@/features/admin/users/api';
import { buildCoursePublicDetail, normalizeCoursePublicPageContent, } from '@/features/public/course-public-page-content';
import { publishBuilderNotice } from '@/lib/builder-notice';
import type { GenflixCourseModule, } from '@/features/public/genflix-site-content';
type CourseAuthorAssignmentForm = {
    author_id: string;
    commission_percent: number;
    display_order: number;
};
type CoursePublicPageFormState = {
    category: string;
    categoryLine: string;
    marketing_description: string;
    hero_video_url: string;
    logo_url: string;
    mentor_name: string;
    mentor_role: string;
    mentor_bio: string;
    bonus_enabled: boolean;
    bonus_title: string;
    mentor_initials: string;
    price_label: string;
    secondary_price_label: string;
    authors: CourseAuthorAssignmentForm[];
    aboutParagraphs: string[];
    includedItems: string[];
    contentSource: 'real' | 'custom';
    customSyllabus: GenflixCourseModule[];
};
function createEmptyModule(): GenflixCourseModule {
    return {
        title: '',
        lessonCount: 0,
        summary: '',
        items: [],
        lessonLabel: 'aulas',
    };
}
function createEmptyAuthorAssignment(index = 0): CourseAuthorAssignmentForm {
    return {
        author_id: '',
        commission_percent: index === 0 ? 100 : 0,
        display_order: index + 1,
    };
}
function normalizeAuthorAssignments(value: unknown): CourseAuthorAssignmentForm[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return [];
        }
        const record = entry as Record<string, unknown>;
        const author_id = typeof record.author_id === 'string' ? record.author_id.trim() : '';
        if (!author_id) {
            return [];
        }
        const commissionPercent = Number(record.commission_percent ?? 0);
        const displayOrder = Number(record.display_order ?? index + 1);
        return [{
                author_id,
                commission_percent: Number.isFinite(commissionPercent) ? commissionPercent : 0,
                display_order: Number.isFinite(displayOrder) && displayOrder > 0 ? Math.trunc(displayOrder) : index + 1,
            }];
    });
}
function buildRealContentModules(courseTree: NonNullable<ReturnType<typeof useCourseBuilder>['courseTree']>): GenflixCourseModule[] {
    const modules = courseTree.modules.map((module) => {
        const items = [
            ...module.lessons.map((lesson) => lesson.title),
            ...module.assessments.map((assessment) => assessment.title),
        ].filter(Boolean);
        return {
            title: module.title,
            lessonCount: items.length,
            summary: items.length ? `${items.length} itens reais serão exibidos nesta seção.` : "Este módulo ainda não possui itens publicados.",
            items,
            lessonLabel: items.length === 1 ? 'item' : 'itens',
        } satisfies GenflixCourseModule;
    });
    if (courseTree.courseAssessments.length) {
        modules.push({
            title: courseTree.courseAssessments.length === 1 ? "Avaliação final" : "Avaliações finais",
            lessonCount: courseTree.courseAssessments.length,
            summary: "Avaliações de encerramento vinculadas ao curso.",
            items: courseTree.courseAssessments.map((assessment) => assessment.title).filter(Boolean),
            lessonLabel: courseTree.courseAssessments.length === 1 ? 'item' : 'itens',
        });
    }
    return modules;
}
function SectionHeading({ eyebrow, title, description, }: {
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (<div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
    </div>);
}
export function CoursePublicPagePanel() {
    const { courseTree, refreshTree } = useCourseBuilder();
    const { session } = useAuth();
    const [form, setForm] = useState<CoursePublicPageFormState>({
        category: '',
        categoryLine: '',
        marketing_description: '',
        hero_video_url: '',
        logo_url: '',
        mentor_name: '',
        mentor_role: '',
        mentor_bio: '',
        bonus_enabled: true,
        bonus_title: 'Prévia de conteúdo',
        mentor_initials: '',
        price_label: '',
        secondary_price_label: '',
        authors: [createEmptyAuthorAssignment()],
        aboutParagraphs: [''],
        includedItems: [''],
        contentSource: 'custom',
        customSyllabus: [createEmptyModule()],
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const resolvedDetail = useMemo(() => {
        if (!courseTree) {
            return null;
        }
        return buildCoursePublicDetail(courseTree.course);
    }, [courseTree]);
    const [creatorUsers, setCreatorUsers] = useState<AdminUserListItem[]>([]);
    const realContentModules = useMemo(() => {
        if (!courseTree) {
            return [];
        }
        return buildRealContentModules(courseTree);
    }, [courseTree]);
    useEffect(() => {
        let isMounted = true;
        async function loadCreatorUsers() {
            if (!courseTree) {
                return;
            }
            try {
                if (!session) {
                    return;
                }
                const users = await fetchAdminUsers(session);
                if (!isMounted) {
                    return;
                }
                setCreatorUsers(users.filter((candidate) => candidate.roles.some((role) => role.code === 'criador' || role.code === 'professor')));
            }
            catch {
                if (isMounted) {
                    setCreatorUsers([]);
                }
            }
        }
        void loadCreatorUsers();
        return () => {
            isMounted = false;
        };
    }, [courseTree, session]);
    useEffect(() => {
        if (!courseTree || !resolvedDetail) {
            return;
        }
        const content = normalizeCoursePublicPageContent(courseTree.course.public_page_content);
        const existingAuthors = normalizeAuthorAssignments(courseTree.courseAuthors);
        setForm({
            category: courseTree.course.category ?? '',
            categoryLine: content.categoryLine ?? resolvedDetail.categoryLine,
            marketing_description: courseTree.course.marketing_description ?? resolvedDetail.description,
            hero_video_url: courseTree.course.hero_video_url ?? '',
            logo_url: courseTree.course.logo_url ?? '',
            mentor_name: courseTree.course.mentor_name ?? resolvedDetail.mentor.name,
            mentor_role: courseTree.course.mentor_role ?? resolvedDetail.mentor.role,
            mentor_bio: content.bonusSection?.description ?? courseTree.course.mentor_bio ?? resolvedDetail.bonusSection.description,
            bonus_enabled: content.bonusSection?.enabled ?? resolvedDetail.bonusSection.enabled,
            bonus_title: content.bonusSection?.title ?? resolvedDetail.bonusSection.title,
            mentor_initials: courseTree.course.mentor_initials ?? resolvedDetail.mentor.initials,
            price_label: courseTree.course.price_label ?? resolvedDetail.priceLabel,
            secondary_price_label: courseTree.course.secondary_price_label ?? resolvedDetail.secondaryPriceLabel,
            authors: existingAuthors.length ? existingAuthors : [createEmptyAuthorAssignment()],
            aboutParagraphs: content.aboutParagraphs.length ? content.aboutParagraphs : resolvedDetail.aboutParagraphs,
            includedItems: content.includedItems.length ? content.includedItems : resolvedDetail.includedItems,
            contentSource: content.contentSource,
            customSyllabus: content.customSyllabus.length ? content.customSyllabus : resolvedDetail.syllabus,
        });
    }, [courseTree, resolvedDetail]);
    if (!courseTree || !resolvedDetail) {
        return null;
    }
    const courseCategories = courseTree.course.categories?.length
        ? courseTree.course.categories
        : courseTree.course.category
            ? [courseTree.course.category]
            : [];
    function updateField<K extends keyof CoursePublicPageFormState>(key: K, value: CoursePublicPageFormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
        setSuccess(false);
    }
    function updateParagraph(index: number, value: string) {
        updateField('aboutParagraphs', form.aboutParagraphs.map((paragraph, paragraphIndex) => paragraphIndex === index ? value : paragraph));
    }
    function updateIncludedItem(index: number, value: string) {
        updateField('includedItems', form.includedItems.map((item, itemIndex) => itemIndex === index ? value : item));
    }
    function updateCustomModule(index: number, patch: Partial<GenflixCourseModule>) {
        updateField('customSyllabus', form.customSyllabus.map((module, moduleIndex) => moduleIndex === index ? { ...module, ...patch } : module));
    }
    function updateAuthor(index: number, patch: Partial<CourseAuthorAssignmentForm>) {
        updateField('authors', form.authors.map((author, authorIndex) => authorIndex === index ? { ...author, ...patch } : author));
    }
    async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setError(null);
        setIsUploadingLogo(true);
        try {
            const url = await uploadCourseLogo(file);
            updateField('logo_url', url);
        }
        catch (uploadError) {
            setError(toErrorMessage(uploadError));
        }
        finally {
            setIsUploadingLogo(false);
            event.target.value = '';
        }
    }
    function addAuthor() {
        updateField('authors', [...form.authors, createEmptyAuthorAssignment(form.authors.length)]);
    }
    function removeAuthor(index: number) {
        const nextAuthors = form.authors.filter((_, authorIndex) => authorIndex !== index);
        updateField('authors', nextAuthors.length ? nextAuthors : [createEmptyAuthorAssignment()]);
    }
    const selectedAuthorIds = new Set(form.authors.map((author) => author.author_id).filter(Boolean));
    const authorCommissionTotal = form.authors.reduce((total, author) => total + Number(author.commission_percent || 0), 0);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!courseTree) {
            return;
        }
        if (Math.round(authorCommissionTotal * 100) / 100 !== 100) {
            setError('A soma das comissões dos autores precisa fechar em 100%.');
            return;
        }
        setError(null);
        setSuccess(false);
        setIsSubmitting(true);
        try {
            const parsed = coursePublicPageFormSchema.safeParse({
                ...form,
                category: courseTree.course.category ?? form.category,
                hero_video_url: form.hero_video_url.trim(),
                logo_url: form.logo_url.trim(),
                mentor_bio: form.mentor_bio.trim(),
                bonus_title: form.bonus_title.trim(),
                aboutParagraphs: form.aboutParagraphs.map((item) => item.trim()).filter(Boolean),
                includedItems: form.includedItems.map((item) => item.trim()).filter(Boolean),
                authors: form.authors.map((author, index) => ({
                    author_id: author.author_id,
                    commission_percent: Number(author.commission_percent || 0),
                    display_order: Number(author.display_order || index + 1),
                })).filter((author) => author.author_id),
                customSyllabus: form.customSyllabus
                    .map((module) => ({
                    title: module.title.trim(),
                    lessonCount: Number(module.lessonCount) || 0,
                    summary: module.summary.trim(),
                    items: Array.isArray(module.items) ? module.items.map((item) => item.trim()).filter(Boolean) : [],
                    lessonLabel: module.lessonLabel?.trim() || undefined,
                }))
                    .filter((module) => module.title),
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos para a página pública.");
            }
            await updateCoursePublicPage(courseTree.course.id, parsed.data);
            await refreshTree();
            setSuccess(true);
            publishBuilderNotice({
                type: 'success',
                title: "Página pública salva",
                message: `A página pública do curso "${courseTree.course.title}" foi atualizada com sucesso.`,
            });
            setTimeout(() => setSuccess(false), 3000);
        }
        catch (submitError) {
            setError(toErrorMessage(submitError));
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (<div className="w-full animate-in fade-in duration-500 pb-24">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Página pública do curso</h2>
        <p className="mt-1 text-sm text-slate-500">
          Edite aqui todos os textos e blocos exibidos em <span className="font-semibold text-slate-700">/cursos/{courseTree.course.slug ?? courseTree.course.id}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        {error ? (<div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600">
            {error}
          </div>) : null}

        {success ? (<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Página pública atualizada com sucesso.
          </div>) : null}

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading eyebrow="Hero" title="Cabeçalho principal do curso" description="Esses campos controlam a primeira dobra da página do curso, incluindo título, hero em vídeo, logo e o bloco lateral de checkout."/>

          <div className="mt-8 space-y-5">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 px-5 py-4">
                <span className="text-xs font-black uppercase tracking-widest text-cyan-700">Categoria do curso</span>
                <p className="mt-2 text-lg font-black tracking-tight text-slate-900">{courseCategories.length ? courseCategories.join(' • ') : 'Sem categoria definida'}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Essa categoria vem do modal de edição do curso e é usada também na página pública.</p>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Linha de categoria</span>
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.categoryLine} onChange={(event) => updateField('categoryLine', event.target.value)} placeholder="Ex: SAUDE - ONLINE"/>
              </label>

              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 px-5 py-4">
                <span className="text-xs font-black uppercase tracking-widest text-cyan-700">Nome do curso</span>
                <p className="mt-2 text-lg font-black tracking-tight text-slate-900">{courseTree.course.title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Edite esse nome em Configurações do Curso. A página pública usa o mesmo título.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 px-1">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Prévia do banner do aluno</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">3:1</span>
                </div>
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[3/1] w-full overflow-hidden bg-slate-900">
                    {courseTree.course.student_hero_image_url ? (
                      <img
                        src={courseTree.course.student_hero_image_url}
                        alt="Prévia do banner da área do aluno"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,#1AA0C7_0%,#104E6B_100%)] px-6 text-center text-white">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">Nenhum banner configurado</p>
                          <p className="mt-2 text-sm font-semibold text-white/85">Envie uma imagem em Configurações do Curso para visualizar essa área.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium leading-6 text-slate-500">
                      Essa imagem aparece no topo da área do aluno. Se ainda estiver vazia, o curso usa um fallback neutro.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">URL do vídeo do hero</span>
                  <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.hero_video_url} onChange={(event) => updateField('hero_video_url', event.target.value)} placeholder="https://..."/>
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Logotipo do curso</span>
                  <div className={`rounded-2xl border px-5 py-5 ${isUploadingLogo ? 'border-cyan-200 bg-cyan-50/40' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {form.logo_url ? (
                          <img src={form.logo_url} alt="Logotipo do curso" className="h-full w-full object-contain p-2" />
                        ) : (
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Logo</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-black text-slate-900">Enviar novo logotipo</p>
                        <p className="text-xs leading-5 text-slate-500">O arquivo será salvo no storage e a URL pública será preenchida automaticamente.</p>
                        <div className="flex flex-wrap gap-3 pt-2">
                          <label className="inline-flex cursor-pointer items-center gap-3">
                            <span className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition-colors hover:border-[#1398B7]/40 hover:bg-slate-50">
                              {isUploadingLogo ? 'Enviando...' : 'Escolher arquivo'}
                            </span>
                            <input type="file" accept="image/*" disabled={isUploadingLogo} onChange={handleLogoUpload} className="sr-only" title="Selecionar logotipo do curso"/>
                          </label>
                          {form.logo_url ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => updateField('logo_url', '')} className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900">
                              Remover logotipo
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.logo_url} onChange={(event) => updateField('logo_url', event.target.value)} placeholder="https://..."/>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Preço exibido</span>
                  <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.price_label} onChange={(event) => updateField('price_label', event.target.value)} placeholder="Ex: R$ 294,90" required/>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Subtítulo do checkout</span>
                  <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.secondary_price_label} onChange={(event) => updateField('secondary_price_label', event.target.value)} placeholder="Ex: Acesso imediato + materiais inclusos" required/>
                </label>
              </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading eyebrow="Autores" title="Autores do curso e itens inclusos" description="Vincule um ou mais autores ao curso, ajuste os percentuais de comissão e mantenha os campos de bônus e benefícios da página pública."/>

          <div className="mt-8 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Autores do curso</p>
                  <p className="text-xs font-medium text-slate-500">Cada autor precisa ter uma comissão configurada. A soma deve fechar em 100%.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={addAuthor}>
                  <Plus className="mr-2 h-4 w-4"/>
                  Adicionar autor
                </Button>
              </div>

              <div className="space-y-4">
                {form.authors.map((author, index) => {
                  const selectedUser = creatorUsers.find((candidate) => candidate.id === author.author_id);
                  return (
                    <article key={`author-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_120px]">
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Autor</span>
                          <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400" value={author.author_id} onChange={(event) => updateAuthor(index, { author_id: event.target.value })}>
                            <option value="">Selecione um autor</option>
                            {creatorUsers.map((candidate) => (
                              <option key={candidate.id} value={candidate.id} disabled={selectedAuthorIds.has(candidate.id) && candidate.id !== author.author_id}>
                                {candidate.full_name || candidate.email}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs font-medium text-slate-500">
                            {selectedUser ? selectedUser.email : 'Escolha um usuário com regra de autor/professor.'}
                          </p>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Comissão (%)</span>
                          <input type="number" min={0} max={100} step={0.01} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400" value={author.commission_percent} onChange={(event) => updateAuthor(index, { commission_percent: Number(event.target.value || 0) })}/>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Ordem</span>
                          <input type="number" min={1} step={1} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400" value={author.display_order} onChange={(event) => updateAuthor(index, { display_order: Number(event.target.value || 1) })}/>
                        </label>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-500">Use a ordem para controlar a exibição pública da lista de autores.</p>
                        <Button type="button" variant="outline" size="sm" className="rounded-2xl" onClick={() => removeAuthor(index)} disabled={form.authors.length === 1}>
                          Remover
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className={`rounded-[20px] border px-4 py-3 text-sm font-semibold ${Math.round(authorCommissionTotal * 100) / 100 === 100 ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                {Math.round(authorCommissionTotal * 100) / 100 === 100
                  ? 'A soma das comissões está fechando em 100%.'
                  : `A soma atual das comissões é ${authorCommissionTotal.toFixed(2)}%. Ajuste até fechar em 100%.`}
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.bonus_enabled} onChange={(event) => updateField('bonus_enabled', event.target.checked)}/>
              Exibir seção bônus abaixo do botão comprar
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Título da seção bônus</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={form.bonus_title} onChange={(event) => updateField('bonus_title', event.target.value)} placeholder="Ex: Prévia de conteúdo" disabled={!form.bonus_enabled}/>
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Descrição da seção bônus</span>
              <textarea className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium leading-7 text-slate-700 outline-none focus:border-cyan-400 focus:bg-white" value={form.mentor_bio} onChange={(event) => updateField('mentor_bio', event.target.value)} placeholder="Ex: Tenha acesso a uma prévia completa dos principais tópicos do curso." disabled={!form.bonus_enabled}/>
            </label>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">O que está incluído</p>
                <p className="text-xs font-medium text-slate-500">Lista dos chips exibidos abaixo do formulário de compra.</p>
              </div>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('includedItems', [...form.includedItems, ''])}>
                <Plus className="mr-2 h-4 w-4"/>
                Adicionar item
              </Button>
            </div>

            {form.includedItems.map((item, index) => (<div key={`included-item-${index}`} className="flex items-center gap-3">
                <input className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white" value={item} onChange={(event) => updateIncludedItem(index, event.target.value)} placeholder="Ex: Acesso imediato ao curso"/>
                <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-2xl" onClick={() => updateField('includedItems', form.includedItems.filter((_, itemIndex) => itemIndex !== index))} disabled={form.includedItems.length === 1}>
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </div>))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading eyebrow="Corpo" title="Sobre o curso e destaques" description="Esses blocos alimentam as seções de texto corrido e a estrutura editorial da página pública."/>

          <div className="mt-8 space-y-8">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">Sobre o curso</p>
                    <p className="text-xs font-medium text-slate-500">Cada bloco abaixo aceita formatação HTML e pode ser alternado entre visual e código.</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('aboutParagraphs', [...form.aboutParagraphs, ''])}>
                    <Plus className="mr-2 h-4 w-4"/>
                    Adicionar paragrafo
                  </Button>
                </div>

              {form.aboutParagraphs.map((paragraph, index) => (<div key={`about-${index}`} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <RichTextEditor
                      value={paragraph}
                      onChange={(value) => updateParagraph(index, value)}
                      placeholder="Parágrafo da seção Sobre o curso"
                      minHeightClassName="min-h-[220px]"
                      enableHtmlMode
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" className="mt-1 h-12 w-12 rounded-2xl" onClick={() => updateField('aboutParagraphs', form.aboutParagraphs.filter((_, paragraphIndex) => paragraphIndex !== index))} disabled={form.aboutParagraphs.length === 1}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>))}
              </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-600">
              A seção <span className="font-black text-slate-900">O que você vai aprender</span> foi removida da interface pública, mas os dados antigos continuam preservados no banco por compatibilidade.
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading eyebrow="Conteúdo do curso" title="Escolha entre outline real ou conteúdo personalizado" description="No modo real, a página pública lista apenas os nomes dos módulos, aulas e quizzes cadastrados no construtor. No modo personalizado, você controla os cards manualmente."/>

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-2">
            <div className="grid gap-2 md:grid-cols-2">
              <button type="button" onClick={() => updateField('contentSource', 'real')} className={`rounded-[22px] px-5 py-4 text-left transition ${form.contentSource === 'real'
            ? 'bg-white shadow-sm ring-1 ring-cyan-200'
            : 'text-slate-600 hover:bg-white/70'}`}>
                <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Layers3 className="h-4 w-4 text-cyan-700"/>Mostrar conteúdo real do curso
                </span>
                <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">Exibe dinamicamente os nomes dos módulos, aulas e quizzes criados no construtor.
                </span>
              </button>

              <button type="button" onClick={() => updateField('contentSource', 'custom')} className={`rounded-[22px] px-5 py-4 text-left transition ${form.contentSource === 'custom'
            ? 'bg-white shadow-sm ring-1 ring-cyan-200'
            : 'text-slate-600 hover:bg-white/70'}`}>
                <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <BookOpen className="h-4 w-4 text-cyan-700"/>Mostrar conteúdo personalizado
                </span>
                <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">Mantém a estrutura atual da página pública com cards customizados por módulo.
                </span>
              </button>
            </div>
          </div>

          {form.contentSource === 'real' ? (<div className="mt-8 space-y-4">
              {realContentModules.length ? realContentModules.map((module, index) => (<article key={`${module.title}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-900">{module.title}</p>
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Módulo {index + 1}
                      </p>
                    </div>
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800">
                      {module.lessonCount} {module.lessonLabel ?? 'itens'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {module.items?.length ? module.items.map((item) => (<div key={`${module.title}-${item}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        {item}
                      </div>)) : (<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-400">Nenhum item real criado neste módulo ainda.
                      </div>)}
                  </div>
                </article>)) : (<div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm font-medium text-slate-500">Ainda não existem módulos, aulas ou quizzes suficientes para montar o outline real deste curso.
                </div>)}
            </div>) : (<div className="mt-8 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Cards personalizados de conteúdo</p>
                  <p className="text-xs font-medium text-slate-500">Estrutura igual à seção atual da página pública.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('customSyllabus', [...form.customSyllabus, createEmptyModule()])}>
                  <Plus className="mr-2 h-4 w-4"/>Adicionar módulo
                </Button>
              </div>

              {form.customSyllabus.map((module, index) => (<article key={`custom-module-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Módulo {index + 1}</p>
                      <p className="mt-2 text-sm font-medium text-slate-500">Use essa estrutura quando quiser vender o curso com uma narrativa mais editorial.</p>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl bg-white" onClick={() => updateField('customSyllabus', form.customSyllabus.filter((_, moduleIndex) => moduleIndex !== index))} disabled={form.customSyllabus.length === 1}>
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Título do módulo</span>
                      <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400" value={module.title} onChange={(event) => updateCustomModule(index, { title: event.target.value })} placeholder="Ex: Primeiros passos"/>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Quantidade exibida</span>
                      <input type="number" min={0} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400" value={module.lessonCount} onChange={(event) => updateCustomModule(index, { lessonCount: Number(event.target.value) || 0 })}/>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Rótulo da quantidade</span>
                      <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400" value={module.lessonLabel ?? ''} onChange={(event) => updateCustomModule(index, { lessonLabel: event.target.value })} placeholder="Ex: aulas"/>
                    </label>

                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Resumo do módulo</span>
                      <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-700 outline-none focus:border-cyan-400" value={module.summary} onChange={(event) => updateCustomModule(index, { summary: event.target.value })} placeholder="Resumo que aparece ao expandir o card na p\u00e1gina p\u00fablica."/>
                    </label>
                  </div>
                </article>))}
            </div>)}
        </section>

        <div className="flex justify-end">
          <Button type="submit" className="h-12 rounded-2xl px-8 font-black" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando página pública...' : 'Salvar página pública'}
          </Button>
        </div>
      </form>
    </div>);
}
