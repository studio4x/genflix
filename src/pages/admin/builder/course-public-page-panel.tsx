import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, Layers3, Plus, Sparkles, Trash2 } from 'lucide-react'

import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { Button } from '@/components/ui/button'
import {
  updateCoursePublicPage,
  toErrorMessage,
} from '@/features/admin/content/api'
import { coursePublicPageFormSchema } from '@/features/admin/content/schemas'
import {
  buildCoursePublicDetail,
  normalizeCoursePublicPageContent,
} from '@/features/public/course-public-page-content'
import type {
  GenflixCourseModule,
  GenflixCourseOutcome,
} from '@/features/public/genflix-site-content'

type CoursePublicPageFormState = {
  category: string
  categoryLine: string
  marketing_title: string
  marketing_description: string
  cover_image_url: string
  mentor_name: string
  mentor_role: string
  mentor_bio: string
  mentor_initials: string
  price_label: string
  secondary_price_label: string
  aboutParagraphs: string[]
  outcomes: GenflixCourseOutcome[]
  includedItems: string[]
  contentSource: 'real' | 'custom'
  customSyllabus: GenflixCourseModule[]
}

function createEmptyOutcome(): GenflixCourseOutcome {
  return {
    title: '',
    description: '',
  }
}

function createEmptyModule(): GenflixCourseModule {
  return {
    title: '',
    lessonCount: 0,
    summary: '',
    items: [],
    lessonLabel: 'aulas',
  }
}

function buildRealContentModules(courseTree: NonNullable<ReturnType<typeof useCourseBuilder>['courseTree']>): GenflixCourseModule[] {
  const modules = courseTree.modules.map((module) => {
    const items = [
      ...module.lessons.map((lesson) => lesson.title),
      ...module.assessments.map((assessment) => assessment.title),
    ].filter(Boolean)

    return {
      title: module.title,
      lessonCount: items.length,
      summary: items.length ? `${items.length} itens reais serao exibidos nesta secao.` : 'Este modulo ainda nao possui itens publicados.',
      items,
      lessonLabel: items.length === 1 ? 'item' : 'itens',
    } satisfies GenflixCourseModule
  })

  if (courseTree.courseAssessments.length) {
    modules.push({
      title: courseTree.courseAssessments.length === 1 ? 'Avaliacao final' : 'Avaliacoes finais',
      lessonCount: courseTree.courseAssessments.length,
      summary: 'Avaliacoes de encerramento vinculadas ao curso.',
      items: courseTree.courseAssessments.map((assessment) => assessment.title).filter(Boolean),
      lessonLabel: courseTree.courseAssessments.length === 1 ? 'item' : 'itens',
    })
  }

  return modules
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
    </div>
  )
}

export function CoursePublicPagePanel() {
  const { courseTree, refreshTree } = useCourseBuilder()
  const [form, setForm] = useState<CoursePublicPageFormState>({
    category: '',
    categoryLine: '',
    marketing_title: '',
    marketing_description: '',
    cover_image_url: '',
    mentor_name: '',
    mentor_role: '',
    mentor_bio: '',
    mentor_initials: '',
    price_label: '',
    secondary_price_label: '',
    aboutParagraphs: [''],
    outcomes: [createEmptyOutcome()],
    includedItems: [''],
    contentSource: 'custom',
    customSyllabus: [createEmptyModule()],
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resolvedDetail = useMemo(() => {
    if (!courseTree) {
      return null
    }

    return buildCoursePublicDetail(courseTree.course)
  }, [courseTree])

  const realContentModules = useMemo(() => {
    if (!courseTree) {
      return []
    }

    return buildRealContentModules(courseTree)
  }, [courseTree])

  useEffect(() => {
    if (!courseTree || !resolvedDetail) {
      return
    }

    const content = normalizeCoursePublicPageContent(courseTree.course.public_page_content)
    const fallbackCategory = courseTree.course.category ?? resolvedDetail.categoryLine.split(' - ')[0] ?? ''

    setForm({
      category: fallbackCategory,
      categoryLine: content.categoryLine ?? resolvedDetail.categoryLine,
      marketing_title: courseTree.course.marketing_title ?? resolvedDetail.title,
      marketing_description: courseTree.course.marketing_description ?? resolvedDetail.description,
      cover_image_url: courseTree.course.cover_image_url ?? resolvedDetail.coverImage,
      mentor_name: courseTree.course.mentor_name ?? resolvedDetail.mentor.name,
      mentor_role: courseTree.course.mentor_role ?? resolvedDetail.mentor.role,
      mentor_bio: courseTree.course.mentor_bio ?? resolvedDetail.mentor.bio,
      mentor_initials: courseTree.course.mentor_initials ?? resolvedDetail.mentor.initials,
      price_label: courseTree.course.price_label ?? resolvedDetail.priceLabel,
      secondary_price_label: courseTree.course.secondary_price_label ?? resolvedDetail.secondaryPriceLabel,
      aboutParagraphs: content.aboutParagraphs.length ? content.aboutParagraphs : resolvedDetail.aboutParagraphs,
      outcomes: content.outcomes.length ? content.outcomes : resolvedDetail.outcomes,
      includedItems: content.includedItems.length ? content.includedItems : resolvedDetail.includedItems,
      contentSource: content.contentSource,
      customSyllabus: content.customSyllabus.length ? content.customSyllabus : resolvedDetail.syllabus,
    })
  }, [courseTree, resolvedDetail])

  if (!courseTree || !resolvedDetail) {
    return null
  }

  function updateField<K extends keyof CoursePublicPageFormState>(key: K, value: CoursePublicPageFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSuccess(false)
  }

  function updateParagraph(index: number, value: string) {
    updateField(
      'aboutParagraphs',
      form.aboutParagraphs.map((paragraph, paragraphIndex) => paragraphIndex === index ? value : paragraph),
    )
  }

  function updateIncludedItem(index: number, value: string) {
    updateField(
      'includedItems',
      form.includedItems.map((item, itemIndex) => itemIndex === index ? value : item),
    )
  }

  function updateOutcome(index: number, patch: Partial<GenflixCourseOutcome>) {
    updateField(
      'outcomes',
      form.outcomes.map((outcome, outcomeIndex) => outcomeIndex === index ? { ...outcome, ...patch } : outcome),
    )
  }

  function updateCustomModule(index: number, patch: Partial<GenflixCourseModule>) {
    updateField(
      'customSyllabus',
      form.customSyllabus.map((module, moduleIndex) => moduleIndex === index ? { ...module, ...patch } : module),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!courseTree) {
      return
    }

    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    try {
      const parsed = coursePublicPageFormSchema.safeParse({
        ...form,
        aboutParagraphs: form.aboutParagraphs.map((item) => item.trim()).filter(Boolean),
        includedItems: form.includedItems.map((item) => item.trim()).filter(Boolean),
        outcomes: form.outcomes
          .map((item) => ({ title: item.title.trim(), description: item.description.trim() }))
          .filter((item) => item.title && item.description),
        customSyllabus: form.customSyllabus
          .map((module) => ({
            title: module.title.trim(),
            lessonCount: Number(module.lessonCount) || 0,
            summary: module.summary.trim(),
            items: Array.isArray(module.items) ? module.items.map((item) => item.trim()).filter(Boolean) : [],
            lessonLabel: module.lessonLabel?.trim() || undefined,
          }))
          .filter((module) => module.title),
      })

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Dados invalidos para a pagina publica.')
      }

      await updateCoursePublicPage(courseTree.course.id, parsed.data)
      await refreshTree()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full animate-in fade-in duration-500 pb-24">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Pagina publica do curso</h2>
        <p className="mt-1 text-sm text-slate-500">
          Edite aqui todos os textos e blocos exibidos em <span className="font-semibold text-slate-700">/cursos/{courseTree.course.slug ?? courseTree.course.id}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            Pagina publica atualizada com sucesso.
          </div>
        ) : null}

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading
            eyebrow="Hero"
            title="Cabecalho principal do curso"
            description="Esses campos controlam a primeira dobra da pagina do curso, incluindo titulo, descricao, imagem e bloco lateral de checkout."
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Categoria</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  placeholder="Ex: Saude"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Linha de categoria</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                  value={form.categoryLine}
                  onChange={(event) => updateField('categoryLine', event.target.value)}
                  placeholder="Ex: SAUDE - ONLINE"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Titulo publico</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                  value={form.marketing_title}
                  onChange={(event) => updateField('marketing_title', event.target.value)}
                  placeholder="Titulo exibido no topo da pagina"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Descricao principal</span>
                <textarea
                  className="min-h-[132px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium leading-7 text-slate-700 outline-none focus:border-cyan-400 focus:bg-white"
                  value={form.marketing_description}
                  onChange={(event) => updateField('marketing_description', event.target.value)}
                  placeholder="Resumo principal do curso para a dobra inicial."
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">URL da imagem de capa</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                  value={form.cover_image_url}
                  onChange={(event) => updateField('cover_image_url', event.target.value)}
                  placeholder="https://..."
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Preco exibido</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                    value={form.price_label}
                    onChange={(event) => updateField('price_label', event.target.value)}
                    placeholder="Ex: R$ 294,90"
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Subtitulo do checkout</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                    value={form.secondary_price_label}
                    onChange={(event) => updateField('secondary_price_label', event.target.value)}
                    placeholder="Ex: Acesso imediato + materiais inclusos"
                    required
                  />
                </label>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950/95">
              {form.cover_image_url ? (
                <img src={form.cover_image_url} alt="" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(19,152,183,0.48),_transparent_56%),linear-gradient(180deg,#15323B_0%,#0C1D22_100%)] p-8 text-center text-white">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60">{form.categoryLine || 'CURSO - ONLINE'}</p>
                    <p className="mt-4 text-2xl font-black leading-tight">{form.marketing_title || 'Preview da capa publica'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading
            eyebrow="Sidebar"
            title="Mentor e itens inclusos"
            description="Os campos abaixo abastecem o card lateral: mentor, texto da previa de conteudo e lista de beneficios do curso."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Nome do mentor</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                value={form.mentor_name}
                onChange={(event) => updateField('mentor_name', event.target.value)}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Cargo / funcao</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                value={form.mentor_role}
                onChange={(event) => updateField('mentor_role', event.target.value)}
                required
              />
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Texto da previa de conteudo</span>
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium leading-7 text-slate-700 outline-none focus:border-cyan-400 focus:bg-white"
                value={form.mentor_bio}
                onChange={(event) => updateField('mentor_bio', event.target.value)}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Iniciais do mentor</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold uppercase outline-none focus:border-cyan-400 focus:bg-white"
                value={form.mentor_initials}
                onChange={(event) => updateField('mentor_initials', event.target.value.toUpperCase())}
                maxLength={4}
              />
            </label>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">O que esta incluido</p>
                <p className="text-xs font-medium text-slate-500">Lista dos chips exibidos abaixo do formulario de compra.</p>
              </div>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('includedItems', [...form.includedItems, ''])}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar item
              </Button>
            </div>

            {form.includedItems.map((item, index) => (
              <div key={`included-item-${index}`} className="flex items-center gap-3">
                <input
                  className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold outline-none focus:border-cyan-400 focus:bg-white"
                  value={item}
                  onChange={(event) => updateIncludedItem(index, event.target.value)}
                  placeholder="Ex: Acesso imediato ao curso"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-2xl"
                  onClick={() => updateField('includedItems', form.includedItems.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={form.includedItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading
            eyebrow="Corpo"
            title="Sobre o curso e destaques"
            description="Esses blocos alimentam as secoes de texto corrido e os cards de O que voce vai aprender."
          />

          <div className="mt-8 space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Sobre o curso</p>
                  <p className="text-xs font-medium text-slate-500">Cada campo abaixo representa um paragrafo exibido na secao.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('aboutParagraphs', [...form.aboutParagraphs, ''])}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar paragrafo
                </Button>
              </div>

              {form.aboutParagraphs.map((paragraph, index) => (
                <div key={`about-${index}`} className="flex items-start gap-3">
                  <textarea
                    className="min-h-[110px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium leading-7 text-slate-700 outline-none focus:border-cyan-400 focus:bg-white"
                    value={paragraph}
                    onChange={(event) => updateParagraph(index, event.target.value)}
                    placeholder="Paragrafo da secao Sobre o Curso"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-1 h-12 w-12 rounded-2xl"
                    onClick={() => updateField('aboutParagraphs', form.aboutParagraphs.filter((_, paragraphIndex) => paragraphIndex !== index))}
                    disabled={form.aboutParagraphs.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">O que voce vai aprender</p>
                  <p className="text-xs font-medium text-slate-500">Cards de destaque exibidos em duas colunas na pagina publica.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('outcomes', [...form.outcomes, createEmptyOutcome()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar destaque
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {form.outcomes.map((outcome, index) => (
                  <article key={`outcome-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-2xl bg-white"
                        onClick={() => updateField('outcomes', form.outcomes.filter((_, outcomeIndex) => outcomeIndex !== index))}
                        disabled={form.outcomes.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
                        value={outcome.title}
                        onChange={(event) => updateOutcome(index, { title: event.target.value })}
                        placeholder="Titulo do card"
                      />
                      <textarea
                        className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-700 outline-none focus:border-cyan-400"
                        value={outcome.description}
                        onChange={(event) => updateOutcome(index, { description: event.target.value })}
                        placeholder="Descricao do card"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <SectionHeading
            eyebrow="Conteudo do curso"
            title="Escolha entre outline real ou conteudo personalizado"
            description="No modo real, a pagina publica lista apenas os nomes dos modulos, aulas e quizzes cadastrados no construtor. No modo personalizado, voce controla os cards manualmente."
          />

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-2">
            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => updateField('contentSource', 'real')}
                className={`rounded-[22px] px-5 py-4 text-left transition ${
                  form.contentSource === 'real'
                    ? 'bg-white shadow-sm ring-1 ring-cyan-200'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Layers3 className="h-4 w-4 text-cyan-700" />
                  Mostrar conteudo real do curso
                </span>
                <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">
                  Exibe dinamicamente os nomes dos modulos, aulas e quizzes criados no construtor.
                </span>
              </button>

              <button
                type="button"
                onClick={() => updateField('contentSource', 'custom')}
                className={`rounded-[22px] px-5 py-4 text-left transition ${
                  form.contentSource === 'custom'
                    ? 'bg-white shadow-sm ring-1 ring-cyan-200'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <BookOpen className="h-4 w-4 text-cyan-700" />
                  Mostrar conteudo personalizado
                </span>
                <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">
                  Mantem a estrutura atual da pagina publica com cards customizados por modulo.
                </span>
              </button>
            </div>
          </div>

          {form.contentSource === 'real' ? (
            <div className="mt-8 space-y-4">
              {realContentModules.length ? realContentModules.map((module, index) => (
                <article key={`${module.title}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-900">{module.title}</p>
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Modulo {index + 1}
                      </p>
                    </div>
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800">
                      {module.lessonCount} {module.lessonLabel ?? 'itens'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {module.items?.length ? module.items.map((item) => (
                      <div key={`${module.title}-${item}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        {item}
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-400">
                        Nenhum item real criado neste modulo ainda.
                      </div>
                    )}
                  </div>
                </article>
              )) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm font-medium text-slate-500">
                  Ainda nao existem modulos, aulas ou quizzes suficientes para montar o outline real deste curso.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Cards personalizados de conteudo</p>
                  <p className="text-xs font-medium text-slate-500">Estrutura igual a secao atual da pagina publica.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateField('customSyllabus', [...form.customSyllabus, createEmptyModule()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar modulo
                </Button>
              </div>

              {form.customSyllabus.map((module, index) => (
                <article key={`custom-module-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Modulo {index + 1}</p>
                      <p className="mt-2 text-sm font-medium text-slate-500">Use essa estrutura quando quiser vender o curso com uma narrativa mais editorial.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-2xl bg-white"
                      onClick={() => updateField('customSyllabus', form.customSyllabus.filter((_, moduleIndex) => moduleIndex !== index))}
                      disabled={form.customSyllabus.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Titulo do modulo</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
                        value={module.title}
                        onChange={(event) => updateCustomModule(index, { title: event.target.value })}
                        placeholder="Ex: Primeiros passos"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Quantidade exibida</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
                        value={module.lessonCount}
                        onChange={(event) => updateCustomModule(index, { lessonCount: Number(event.target.value) || 0 })}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Rotulo da quantidade</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
                        value={module.lessonLabel ?? ''}
                        onChange={(event) => updateCustomModule(index, { lessonLabel: event.target.value })}
                        placeholder="Ex: aulas"
                      />
                    </label>

                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Resumo do modulo</span>
                      <textarea
                        className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-700 outline-none focus:border-cyan-400"
                        value={module.summary}
                        onChange={(event) => updateCustomModule(index, { summary: event.target.value })}
                        placeholder="Resumo que aparece ao expandir o card na pagina publica."
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <Button type="submit" className="h-12 rounded-2xl px-8 font-black" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando pagina publica...' : 'Salvar pagina publica'}
          </Button>
        </div>
      </form>
    </div>
  )
}
