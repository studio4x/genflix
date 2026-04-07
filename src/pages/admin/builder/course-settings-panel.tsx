import { useState, useEffect } from 'react'
import ReactQuill from 'react-quill'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import {
  fetchCourseAiReviewStandards,
  upsertCourseAiReviewStandards,
} from '@/features/admin/ai-review/api'
import {
  fetchCourseExternalMapping,
  resetCourseProgress,
  upsertCourseExternalMapping,
  updateCourse,
  uploadCourseThumbnail,
  toErrorMessage,
  type ResetCourseProgressResult,
} from '@/features/admin/content/api'
import { courseFormSchema } from '@/features/admin/content/schemas'
import {
  canCourseUseCaseStudies,
  COURSE_QUIZ_TYPE_OPTIONS,
  DEFAULT_COURSE_QUIZ_TYPE_SETTINGS,
  normalizeCourseQuizTypeSettings,
} from '@/features/assessments/course-quiz-type-settings'
import 'react-quill/dist/quill.snow.css'

export function CourseSettingsPanel() {
  const { courseTree, refreshTree } = useCourseBuilder()
  const { user, session } = useAuth()
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    thumbnail_url: '',
    has_linear_progression: true,
    quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
  })
  const [externalCourseId, setExternalCourseId] = useState('')
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingAiStandards, setIsSavingAiStandards] = useState(false)
  const [isResettingProgress, setIsResettingProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [aiStandardsSuccess, setAiStandardsSuccess] = useState(false)
  const [resetProgressSuccess, setResetProgressSuccess] = useState<ResetCourseProgressResult | null>(null)
  const [aiStandards, setAiStandards] = useState({
    ideal_course_structure: '',
    required_elements: '',
    bibliography_rules: '',
    table_formatting_rules: '',
    additional_review_rules: '',
  })

  useEffect(() => {
    if (courseTree) {
      setForm({
        title: courseTree.course.title || '',
        description: courseTree.course.description ?? '',
        status: (courseTree.course.status as any) || 'draft',
        thumbnail_url: courseTree.course.thumbnail_url ?? '',
        has_linear_progression: courseTree.course.has_linear_progression ?? true,
        quiz_type_settings: normalizeCourseQuizTypeSettings(courseTree.course.quiz_type_settings),
      })
      setExternalCourseId('')
      setResetProgressSuccess(null)
    }
  }, [courseTree])

  useEffect(() => {
    async function loadExternalMapping() {
      if (!courseTree) return

      try {
        const mapping = await fetchCourseExternalMapping(courseTree.course.id)
        setExternalCourseId(mapping?.external_course_id ?? '')
      } catch (err) {
        setError(toErrorMessage(err))
      }
    }

    void loadExternalMapping()
  }, [courseTree])

  useEffect(() => {
    async function loadAiStandards() {
      if (!courseTree) return

      try {
        const standards = await fetchCourseAiReviewStandards(courseTree.course.id)
        setAiStandards({
          ideal_course_structure: standards?.ideal_course_structure ?? '',
          required_elements: standards?.required_elements ?? '',
          bibliography_rules: standards?.bibliography_rules ?? '',
          table_formatting_rules: standards?.table_formatting_rules ?? '',
          additional_review_rules: standards?.additional_review_rules ?? '',
        })
      } catch (err) {
        setError(toErrorMessage(err))
      }
    }

    void loadAiStandards()
  }, [courseTree])

  async function handleThumbnailUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploadingThumbnail(true)

    try {
      const url = await uploadCourseThumbnail(file)
      setForm(f => ({ ...f, thumbnail_url: url }))
    } catch (err) {
      setError('Falha ao subir imagem. Tente novamente.')
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseTree) return

    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    try {
      const parsed = courseFormSchema.safeParse(form)
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      }

      await updateCourse(courseTree.course.id, parsed.data)
      await upsertCourseExternalMapping(courseTree.course.id, externalCourseId)
      await refreshTree()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveAiStandards(e: React.FormEvent) {
    e.preventDefault()
    if (!courseTree || !user) return

    setError(null)
    setAiStandardsSuccess(false)
    setIsSavingAiStandards(true)

    try {
      await upsertCourseAiReviewStandards(courseTree.course.id, aiStandards, user.id)
      setAiStandardsSuccess(true)
      setTimeout(() => setAiStandardsSuccess(false), 3000)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsSavingAiStandards(false)
    }
  }

  async function handleResetCourseProgress() {
    if (!courseTree || !session) {
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    const shouldContinue = window.confirm(
      `Tem certeza que deseja renovar o progresso de todos os alunos no curso "${courseTree.course.title}"? Esta ação apaga progresso das aulas, tentativas de avaliação, pedidos de nova tentativa e o progresso geral do curso para todos os alunos.`,
    )

    if (!shouldContinue) {
      return
    }

    setError(null)
    setResetProgressSuccess(null)
    setIsResettingProgress(true)

    try {
      const result = await resetCourseProgress(courseTree.course.id, session)
      setResetProgressSuccess(result)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsResettingProgress(false)
    }
  }

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean'],
    ],
  }

  const enabledQuizTypeCount = Object.values(form.quiz_type_settings).filter(Boolean).length
  const canUseCaseStudies = canCourseUseCaseStudies(form.quiz_type_settings)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Detalhes Principais</h2>
        <p className="text-sm text-slate-500 mt-1">Essas informações definem como os alunos verão seu curso no catálogo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
         {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-sm tracking-tight animate-in slide-in-from-top-2 duration-300">
               {error}
            </div>
         )}
         
         {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold text-sm tracking-tight animate-in slide-in-from-top-2 duration-300">
               Configurações salvas com sucesso!
            </div>
         )}

         <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 md:p-10 space-y-10">
            {/* THUMBNAIL UPLOAD AREA */}
            <div className="space-y-4">
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Capa do Curso (1024x768)</span>
               <div 
                  className={`relative group w-full rounded-[24px] border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
                     form.thumbnail_url ? 'border-transparent' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50'
                  }`}
                  style={{ aspectRatio: '4/3' }}
               >
                  {form.thumbnail_url ? (
                     <>
                        <img src={form.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                           <p className="text-white font-black text-sm uppercase tracking-widest">Alterar Imagem</p>
                           <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, thumbnail_url: '' }))} className="bg-white/20 border-white/40 text-white hover:bg-white hover:text-slate-900 font-bold">Remover</Button>
                        </div>
                     </>
                  ) : (
                     <div className="flex flex-col items-center gap-4 p-8 text-center" style={{ height: '100%' }}>
                        <div className={`h-16 w-16 rounded-[20px] bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:rotate-6 transition-all duration-300 ${isUploadingThumbnail ? 'animate-pulse' : ''}`}>
                           {isUploadingThumbnail ? (
                              <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           ) : (
                              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           )}
                        </div>
                        <div className="space-y-1">
                           <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Upload da Capa</p>
                           <p className="text-xs font-medium text-slate-400">Arraste ou clique para selecionar (JPG, PNG ou WEBP)</p>
                        </div>
                     </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Selecionar imagem da capa" />
               </div>
            </div>

            <div className="grid gap-8">
               <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Curso</span>
                  <input 
                     className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                     placeholder="Ex: Primeiros Socorros Avançado"
                     value={form.title}
                     onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                     required
                  />
               </label>

               <label className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">ID do Curso na HomeCare Match</span>
                  <input
                     className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                     placeholder="Ex: hcm-curso-suporte-ventilatorio"
                     value={externalCourseId}
                     onChange={e => setExternalCourseId(e.target.value)}
                  />
                  <p className="text-xs font-medium leading-6 text-slate-500">
                     Esse identificador sera usado pela plataforma principal para sincronizar liberacao, revogacao e acesso direto ao curso.
                  </p>
                  {courseTree ? (
                    <Button variant="outline" size="sm" asChild className="mt-2">
                      <Link to={`/admin/cursos/${courseTree.course.id}/builder/integration`}>Abrir painel da integracao</Link>
                    </Button>
                  ) : null}
               </label>

               <div className="block space-y-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Detalhada</span>
                  <div className="rich-editor-container">
                     <ReactQuill 
                        theme="snow"
                        value={form.description}
                        onChange={val => setForm(f => ({ ...f, description: val }))}
                        modules={quillModules}
                        placeholder="Fale sobre os objetivos e o público-alvo do curso..."
                        className="bg-slate-100/50 rounded-[24px] overflow-hidden border border-slate-200 focus-within:ring-4 focus-within:ring-blue-100 focus-within:bg-white transition-all"
                     />
                  </div>
               </div>

                  <label className="block space-y-2">
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Status de Publicação</span>
                     <select 
                        className="w-full font-bold rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                        value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                     >
                        <option value="draft">Rascunho (Privado)</option>
                        <option value="published">Publicado (Visível para Alunos)</option>
                        <option value="archived">Arquivado (Desativado)</option>
                     </select>
                  </label>
               </div>

               <div className="pt-6 border-t border-slate-100">
                  <label className="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/20 cursor-pointer hover:bg-blue-50/40 transition-colors shadow-sm">
                     <div className="flex items-center h-6">
                        <input 
                           type="checkbox"
                           checked={form.has_linear_progression}
                           onChange={e => setForm(f => ({ ...f, has_linear_progression: e.target.checked }))}
                           className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-600 shadow-sm transition-all"
                        />
                     </div>
                     <div className="space-y-1">
                        <span className="text-sm font-bold text-slate-900 block">Ativar Progressão Linear Obrigatória</span>
                        <span className="text-[11px] text-slate-500 block leading-relaxed max-w-lg">
                           Se ativado, o aluno deve concluir obrigatoriamente a aula atual para liberar a próxima. Módulos bloqueados só serão liberados ao concluir o módulo anterior (incluindo provas).
                        </span>
                     </div>
                  </label>
               </div>

               <div className="pt-6 border-t border-slate-100 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                     <div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Tipos de Quiz Disponiveis</span>
                        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
                           Ative ou desative quais formatos de pergunta podem ser usados neste curso. O builder de avaliacoes passa a respeitar essa configuracao.
                        </p>
                     </div>
                     <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ativos agora</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{enabledQuizTypeCount}</p>
                     </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5">
                     <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {COURSE_QUIZ_TYPE_OPTIONS.map((option) => {
                          const isEnabled = form.quiz_type_settings[option.key]

                          return (
                            <label
                              key={option.key}
                              className={`block rounded-[24px] border p-5 shadow-sm transition-all ${isEnabled ? option.accentClassName : 'border-slate-200 bg-white text-slate-500'}`}
                            >
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
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(event) => setForm((current) => ({
                                    ...current,
                                    quiz_type_settings: {
                                      ...current.quiz_type_settings,
                                      [option.key]: event.target.checked,
                                    },
                                  }))}
                                  className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                              </div>
                              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
                                {option.helper}
                              </p>
                            </label>
                          )
                        })}
                     </div>
                  </div>

                  <div className={`rounded-[24px] border px-5 py-4 text-sm font-semibold ${canUseCaseStudies ? 'border-violet-100 bg-violet-50/70 text-violet-800' : 'border-amber-100 bg-amber-50/80 text-amber-800'}`}>
                     {canUseCaseStudies
                       ? 'Estudo de caso esta pronto para uso no builder, porque pelo menos um tipo de pergunta interna esta ativo.'
                       : 'Estudo de caso exige Multipla Escolha ou Discursiva com IA ativos para aparecer como opcao no builder.'}
                  </div>
               </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex justify-end">
               <Button 
                  type="submit"
                  disabled={isSubmitting || isUploadingThumbnail}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 h-16 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
               >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Salvando...
                    </>
                  ) : 'Salvar Alterações'}
               </Button>
            </div>
      </form>

      <form onSubmit={handleSaveAiStandards} className="space-y-8">
        {aiStandardsSuccess && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold tracking-tight text-emerald-600 animate-in slide-in-from-top-2 duration-300">
            Padrões da revisão com IA salvos com sucesso!
          </div>
        )}

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-10 space-y-8">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Padrões do Curso Perfeito</h3>
            <p className="mt-1 text-sm text-slate-500">
              Defina aqui os critérios que a IA deve usar ao revisar cada módulo individualmente.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Estrutura ideal do curso</span>
            <textarea
              className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Descreva como deve ser a sequência ideal de aulas, profundidade, carga, ritmo e coerência pedagógica."
              value={aiStandards.ideal_course_structure}
              onChange={(e) => setAiStandards((prev) => ({ ...prev, ideal_course_structure: e.target.value }))}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Elementos obrigatórios por módulo</span>
            <textarea
              className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Ex: objetivo claro, exemplos práticos, quiz coerente, conclusão, linguagem profissional."
              value={aiStandards.required_elements}
              onChange={(e) => setAiStandards((prev) => ({ ...prev, required_elements: e.target.value }))}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Regras de bibliografia e referências</span>
            <textarea
              className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Defina quando a aula deve conter referências, como citar e que tipo de fonte é aceitável."
              value={aiStandards.bibliography_rules}
              onChange={(e) => setAiStandards((prev) => ({ ...prev, bibliography_rules: e.target.value }))}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Regras de tabelas e formatação</span>
            <textarea
              className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Ex: não deixar colunas vazias, cabeçalhos claros, consistência entre linhas, HTML válido."
              value={aiStandards.table_formatting_rules}
              onChange={(e) => setAiStandards((prev) => ({ ...prev, table_formatting_rules: e.target.value }))}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Regras adicionais de revisão</span>
            <textarea
              className="min-h-[120px] w-full rounded-[20px] border border-slate-200 bg-slate-100/50 px-6 py-4 text-sm font-medium text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Inclua qualquer outra orientação para a IA validar e corrigir o módulo."
              value={aiStandards.additional_review_rules}
              onChange={(e) => setAiStandards((prev) => ({ ...prev, additional_review_rules: e.target.value }))}
            />
          </label>

          <div className="flex justify-end border-t border-slate-100 pt-8">
            <Button
              type="submit"
              disabled={isSavingAiStandards}
              className="h-14 rounded-2xl bg-slate-900 px-10 font-black shadow-xl shadow-slate-100 hover:bg-slate-800"
            >
              {isSavingAiStandards ? 'Salvando Padrões...' : 'Salvar Padrões da IA'}
            </Button>
          </div>
        </div>
      </form>

      <section className="space-y-6 rounded-[32px] border border-rose-200 bg-white p-6 shadow-sm md:p-10">
        <div className="border-b border-rose-100 pb-5">
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Renovar Progresso do Curso</h3>
          <p className="mt-1 text-sm text-slate-500">
            Use esta ação quando precisar reiniciar o curso para todos os alunos e liberar um novo ciclo completo de aulas e avaliações.
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

        {resetProgressSuccess ? (
          <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
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
          </div>
        ) : null}

        <div className="flex justify-end border-t border-slate-100 pt-8">
          <Button
            type="button"
            disabled={isResettingProgress}
            onClick={() => void handleResetCourseProgress()}
            className="h-14 rounded-2xl bg-rose-600 px-10 font-black shadow-xl shadow-rose-100 hover:bg-rose-700"
          >
            {isResettingProgress ? 'Renovando progresso...' : 'Renovar progresso de todos os alunos'}
          </Button>
        </div>
      </section>
    </div>
  )
}
