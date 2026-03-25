import { useEffect, useMemo, useState } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import {
  createCourse,
  deleteCourse,
  fetchCourses,
  updateCourse,
  uploadCourseThumbnail,
  toErrorMessage,
  importFullCourse,
} from '@/features/admin/content/api'
import {
  courseFormSchema,
  type CourseFormInput,
} from '@/features/admin/content/schemas'
import type { Course } from '@/types/content'

const initialForm: CourseFormInput = {
  title: '',
  description: '',
  status: 'draft',
  workload_minutes: 0,
  thumbnail_url: '',
}

interface CourseEditorDraft {
  form: CourseFormInput
  editingCourseId: string | null
  isFormOpen: boolean
  isUploadingThumbnail: boolean
}

const initialDraft: CourseEditorDraft = {
  form: initialForm,
  editingCourseId: null,
  isFormOpen: false,
  isUploadingThumbnail: false
}

export function AdminCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { state: draft, setState: setDraft, clear: clearDraft } =
    useLocalStorageState<CourseEditorDraft>('admin:courses:editor-draft', initialDraft)
    
  const form = draft.form
  const editingCourseId = draft.editingCourseId
  const isEditing = useMemo(() => !!editingCourseId, [editingCourseId])
  const isFormOpen = draft.isFormOpen
  const isUploadingThumbnail = draft.isUploadingThumbnail

  // AI Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function loadCourses() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchCourses()
      setCourses(data)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCourses()
  }, [])

  function resetForm() {
    clearDraft()
    setError(null)
  }

  function openNewCourseForm() {
     setDraft({ ...initialDraft, isFormOpen: true })
  }

  async function handleThumbnailUpload(file: File) {
    setDraft((p) => ({ ...p, isUploadingThumbnail: true }))
    setError(null)
    try {
      const url = await uploadCourseThumbnail(file)
      setDraft((p) => ({ ...p, form: { ...p.form, thumbnail_url: url }, isUploadingThumbnail: false }))
    } catch (err) {
      setError(toErrorMessage(err))
      setDraft((p) => ({ ...p, isUploadingThumbnail: false }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }

    const parsed = courseFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      if (editingCourseId) {
        await updateCourse(editingCourseId, parsed.data)
      } else {
        await createCourse(parsed.data, user.id)
      }
      await loadCourses()
      resetForm()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEdit(course: Course) {
    setDraft((p) => ({
      ...p,
      isFormOpen: true,
      editingCourseId: course.id,
      form: {
        title: course.title,
        description: course.description ?? '',
        status: course.status,
        workload_minutes: course.workload_minutes,
        thumbnail_url: course.thumbnail_url ?? '',
      },
    }))
    setError(null)
  }

  async function handleDelete(course: Course) {
    const confirmed = window.confirm(
      `ATENÇÃO: Deseja realmente excluir o curso "${course.title}"?\n\nEssa ação é irreversível.`
    )
    if (!confirmed) return

    setError(null)
    try {
      await deleteCourse(course.id)
      await loadCourses()
      if (editingCourseId === course.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  async function handleImportFull() {
    if (!user?.id) return
    setIsImporting(true)
    setImportError(null)
    try {
      // 1. Limpeza inteligente dos blocos de código Markdown
      let cleanedJson = importJson.trim()
        .replace(/^```(json)?\s+/, '')
        .replace(/\s+```$/, '')
        .trim()
      
      let data
      try {
        // Tenta o parse original (mais seguro se o JSON estiver bem formatado)
        data = JSON.parse(cleanedJson)
      } catch (err1) {
        try {
          // Se falhar, aplica a limpeza de quebras de linha literais dentro de strings
          // O regex agora ignora caracteres estruturais do JSON ({, }, [, ], ", :, ,, números e chaves)
          const fixedJson = cleanedJson.replace(/\n(?!\s*[\{\}\[\]",:0-9\-\.tfn])/g, '\\n')
          data = JSON.parse(fixedJson)
        } catch (err2) {
          console.error('Falha em ambos os parses:', err1, err2)
          throw new Error('O JSON fornecido possui erros de sintaxe (como aspas faltando ou quebras de linha inesperadas).')
        }
      }

      await importFullCourse(data, user.id)
      await loadCourses()
      setIsImportModalOpen(false)
      setImportJson('')
    } catch (err) {
      console.error('Erro no import full:', err)
      setImportError(err instanceof Error ? err.message : 'JSON inválido ou erro na importação.')
    } finally {
      setIsImporting(false)
    }
  }

  const metrics = useMemo(() => {
     return {
        total: courses.length,
        published: courses.filter(c => c.status === 'published').length,
        draft: courses.filter(c => c.status === 'draft').length
     }
  }, [courses])

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 relative">
      
      {/* HEADER ACTION BAR */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-8">
        <div>
           <h2 className="text-4xl font-black tracking-tight text-slate-900">Catálogo de Cursos</h2>
           <p className="text-base font-medium text-slate-500 mt-1">Gerencie seu currículo e acompanhe o status de cada treinamento.</p>
        </div>
        <div className="flex items-center gap-3">
           {isLoading && <span className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin mr-2" />}
           
           <Button 
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              className="h-12 px-6 rounded-2xl border-slate-200 text-slate-500 font-bold hover:bg-slate-50 flex items-center gap-2 group transition-all transform active:scale-95"
            >
               <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               Importar de IA
            </Button>

           <Button 
             onClick={openNewCourseForm}
             className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-6 rounded-2xl shadow-xl shadow-blue-100 flex items-center gap-2 group transition-all transform active:scale-95"
           >
              <svg className="h-5 w-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Adicionar Novo Curso
           </Button>
        </div>
      </header>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
               <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total</p>
               <h4 className="text-2xl font-black text-slate-900 leading-none">{metrics.total}</h4>
            </div>
         </div>
         <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100/50 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
               <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
               <p className="text-sm font-bold text-emerald-600/60 uppercase tracking-widest">Publicados</p>
               <h4 className="text-2xl font-black text-emerald-900 leading-none">{metrics.published}</h4>
            </div>
         </div>
         <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100/50 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
               <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
               <p className="text-sm font-bold text-blue-600/60 uppercase tracking-widest">Em Rascunho</p>
               <h4 className="text-2xl font-black text-blue-900 leading-none">{metrics.draft}</h4>
            </div>
         </div>
      </div>

      {/* CURSOR GRID */}
      <section className="animate-in slide-in-from-bottom-6 duration-700 delay-200">
         {!isLoading && courses.length === 0 ? (
            <div className="rounded-[40px] border-4 border-dashed border-slate-100 p-20 text-center bg-slate-50/30">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm border border-slate-100 text-slate-200 mb-6">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-800">Sua estante está vazia</h3>
              <p className="text-slate-400 mt-2 max-w-sm mx-auto">Clique no botão superior para começar a criar sua primeira experiência de ensino.</p>
            </div>
         ) : (
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
               {courses.map((course) => (
                  <article 
                    key={course.id}
                    className="group relative flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-500 overflow-hidden"
                  >
                    {/* Thumbnail Placeholder / Image */}
                     <Link to={`/admin/cursos/${course.id}/builder`} className="w-full bg-slate-200 relative overflow-hidden block" style={{ aspectRatio: '4/3' }}>
                        {course.thumbnail_url ? (
                           <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center bg-slate-900">
                             <span className="text-4xl font-black text-white/10 uppercase tracking-tighter">LMS</span>
                           </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 z-10" />
                        
                        {/* Status Badge */}
                        <div className={`absolute top-4 left-4 z-20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                          course.status === 'published' ? 'bg-emerald-500 border-emerald-400 text-white' : 
                          course.status === 'draft' ? 'bg-amber-500 border-amber-400 text-white' : 'bg-rose-500 border-rose-400 text-white'
                        }`}>
                           {course.status === 'published' ? 'Publicado' : course.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                        </div>

                        {/* Title Overlay */}
                        <div className="absolute bottom-4 left-4 right-4 z-20">
                           <h4 className="text-lg font-black text-white leading-tight group-hover:text-blue-300 transition-colors line-clamp-2">
                             {course.title}
                           </h4>
                           <div className="flex items-center gap-2 mt-2">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                     <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     {course.workload_minutes} min
                  </span>            </div>
                        </div>

                        {/* Hover Overlay Button */}
                        <div className="absolute inset-0 bg-blue-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30">
                           <Button className="bg-white text-blue-600 font-extrabold rounded-2xl h-12 px-6">
                              Abrir Construtor
                           </Button>
                        </div>
                    </Link>

                    {/* Footer Actions */}
                    <div className="p-6 space-y-4">
                       <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed h-[40px]">
                          {course.description ? course.description.replace(/<[^>]*>?/gm, '') : 'Sem descrição definida para este curso.'}
                       </p>
                       
                       <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                          <Button variant="ghost" className="flex-1 flex flex-col items-center gap-1 h-auto py-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl group/sub" asChild>
                             <Link to={`/admin/cursos/${course.id}/liberacoes`}>
                                <svg className="h-5 w-5 opacity-50 group-hover/sub:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Alunos</span>
                             </Link>
                          </Button>
                          <Button variant="ghost" className="flex-1 flex flex-col items-center gap-1 h-auto py-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl group/sub" asChild>
                             <Link to={`/admin/cursos/${course.id}/avaliacao-final`}>
                                <svg className="h-5 w-5 opacity-50 group-hover/sub:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Final</span>
                             </Link>
                          </Button>
                          <Button 
                             onClick={() => handleEdit(course)}
                             variant="ghost" className="w-10 h-10 p-0 rounded-xl text-slate-300 hover:text-amber-600 hover:bg-amber-50"
                          >
                             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </Button>
                          <Button 
                             onClick={() => void handleDelete(course)}
                             variant="ghost" className="w-10 h-10 p-0 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                          >
                             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2" /></svg>
                          </Button>
                       </div>
                    </div>
                  </article>
               ))}
            </div>
         )}
      </section>

      {/* MODAL OVERLAY FORM */}
      {isFormOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={resetForm} />
            
            <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-y-auto max-h-[95vh] no-scrollbar animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
               <div className="flex items-center justify-between p-8 border-b border-slate-50 bg-slate-50/50">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">
                       {isEditing ? 'Configurações do Curso' : 'Novo Alinhamento'}
                    </h3>
                    <p className="text-sm font-medium text-slate-500">Preencha as informações essenciais do treinamento.</p>
                  </div>
                  <button onClick={resetForm} className="p-3 bg-white hover:bg-slate-50 border border-slate-100 font-bold rounded-2xl text-slate-400 hover:text-slate-900 transition-colors">
                     <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
               </div>

               <form className="p-8 space-y-8" onSubmit={handleSubmit}>
                  <div className="space-y-6">
                      <label className="block space-y-2">
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Identificação</span>
                         <input
                            className="w-full text-lg font-bold rounded-2xl border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                            placeholder="Ex: Treinamento Técnico v2"
                            value={form.title}
                            onChange={(event) => setDraft((p) => ({ ...p, form: { ...p.form, title: event.target.value } }))}
                            required
                         />
                      </label>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Capa do Curso</span>
                            {form.thumbnail_url && (
                               <button 
                                  type="button"
                                  onClick={() => setDraft(p => ({ ...p, form: { ...p.form, thumbnail_url: '' } }))}
                                  className="text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest"
                               >
                                  Remover Imagem
                               </button>
                            )}
                         </div>
                         
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Imagem de Capa (1024x768)</span>
                          <label 
                             className={`
                                relative flex flex-col items-center justify-center w-full rounded-[32px] border-2 border-dashed transition-all cursor-pointer overflow-hidden
                               ${form.thumbnail_url ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 bg-slate-100/30 hover:bg-white hover:border-blue-300'}
                               ${isUploadingThumbnail ? 'animate-pulse' : ''}
                             `}
                             style={{ aspectRatio: '4/3' }}
                          >
                            {form.thumbnail_url ? (
                               <div className="absolute inset-0 group">
                                  <img src={form.thumbnail_url} alt="Capa" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-4 text-center">
                                     <svg className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                     <span className="font-black text-sm uppercase">Alterar Imagem de Capa</span>
                                  </div>
                                </div>
                            ) : (
                               <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                                  {isUploadingThumbnail ? (
                                     <div className="flex flex-col items-center">
                                        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                                        <span className="text-sm font-black text-slate-400 uppercase">Subindo imagem...</span>
                                     </div>
                                  ) : (
                                     <>
                                        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-400 flex items-center justify-center mb-2">
                                           <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <p className="text-sm font-black text-slate-500 uppercase">Fazer Upload de Imagem</p>
                                        <p className="text-xs text-slate-400 font-medium max-w-[200px]">Formatos aceitos: JPG, PNG, WEBP (Recomendado 16:9)</p>
                                     </>
                                  )}
                               </div>
                            )}
                            <input 
                               type="file" 
                               className="sr-only" 
                               accept="image/*"
                               disabled={isUploadingThumbnail}
                               onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleThumbnailUpload(file)
                               }} 
                            />
                         </label>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                         <label className="block space-y-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Status</span>
                            <select
                               className="w-full font-bold rounded-2xl border border-slate-200 bg-slate-100/50 px-6 py-4 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all appearance-none"
                               value={form.status}
                               onChange={(event) => setDraft((p) => ({ ...p, form: { ...p.form, status: event.target.value as any } }))}
                            >
                               <option value="draft">🚀 Em Rascunho</option>
                               <option value="published">✅ Publicado</option>
                               <option value="archived">📦 Arquivado</option>
                            </select>
                         </label>

                         <label className="block space-y-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Duração (Minutos)</span>
                            <input
                               type="number"
                               className="w-full font-bold rounded-2xl border border-slate-200 bg-slate-100/50 px-6 py-4 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                               placeholder="00"
                               min={0}
                               value={form.workload_minutes}
                               onChange={(event) => setDraft((p) => ({ ...p, form: { ...p.form, workload_minutes: Number(event.target.value) } }))}
                               required
                            />
                         </label>
                      </div>

                       <div className="block space-y-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Detalhada</span>
                          <div className="rich-editor-container mini">
                             <ReactQuill 
                                theme="snow"
                                value={form.description}
                                onChange={val => setDraft((p) => ({ ...p, form: { ...p.form, description: val } }))}
                                modules={{
                                   toolbar: [
                                      ['bold', 'italic', 'underline'],
                                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                      ['link', 'clean'],
                                   ],
                                }}
                                placeholder="Qual o propósito deste curso?"
                                className="bg-slate-100/50 rounded-2xl overflow-hidden border border-slate-200 focus-within:ring-4 focus-within:ring-blue-100 focus-within:bg-white transition-all"
                             />
                          </div>
                       </div>
                  </div>

                  {error && (
                     <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-sm font-bold flex gap-3">
                        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {error}
                     </div>
                  )}

                  <div className="pt-4 flex gap-4">
                     <Button type="button" variant="outline" onClick={resetForm} className="flex-1 h-14 rounded-2xl border-slate-200 font-bold text-slate-500 hover:bg-slate-50">
                        Descartar
                     </Button>
                     <Button type="submit" disabled={isSubmitting} className="flex-[2] h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-200">
                        {isSubmitting ? 'Processando...' : isEditing ? 'Salvar Alterações' : 'Criar Curso Agora'}
                     </Button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* AI IMPORT MODAL */}
      {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl border border-white/20 overflow-y-auto max-h-[90vh] no-scrollbar animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                   <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Criar Curso via IA (JSON)</h3>
                      <p className="text-sm text-slate-500 mt-1 font-medium">O JSON deve conter o título, descrição e módulos.</p>
                   </div>
                   <button onClick={() => setIsImportModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>

                <div className="p-8 space-y-6">
                   <div className="space-y-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Código JSON Estruturado</span>
                      <textarea 
                         className="w-full h-80 font-mono text-xs p-6 bg-slate-900 text-emerald-400 rounded-2xl border border-slate-800 focus:ring-4 focus:ring-blue-100 transition-all no-scrollbar"
                         placeholder='{ "title": "Novo Curso", "modules": [...] }'
                         value={importJson}
                         onChange={e => setImportJson(e.target.value)}
                      />
                   </div>

                   {importError && (
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold animate-in slide-in-from-left-2 transition-all">
                         {importError}
                      </div>
                   )}
                </div>

                <div className="p-8 bg-slate-50/50 flex gap-4 border-t border-slate-100">
                   <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="flex-1 h-14 rounded-2xl font-bold text-slate-500">
                      Cancelar
                   </Button>
                   <Button 
                      onClick={handleImportFull}
                      disabled={isImporting || !importJson.trim()}
                      className="flex-[2] h-14 rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100"
                   >
                      {isImporting ? (
                         <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Criando Curso Completo...
                         </span>
                      ) : 'Importar e Criar Curso'}
                   </Button>
                </div>
             </div>
          </div>
       )}
    </div>
  )
}
