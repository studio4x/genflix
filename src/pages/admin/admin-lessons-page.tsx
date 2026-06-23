import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { createLesson, deleteLesson, fetchLessons, fetchModule, moveLesson, toErrorMessage, updateLesson, } from '@/features/admin/content/api';
import { lessonFormSchema, type LessonFormInput, } from '@/features/admin/content/schemas';
import type { CourseModule, Lesson } from '@/types/content';
const initialForm: LessonFormInput = {
    title: '',
    description: '',
    is_required: true,
    is_free_preview: false,
    lesson_type: 'video',
    youtube_url: '',
    text_content: '',
    estimated_minutes: 0,
};
interface LessonEditorDraft {
    form: LessonFormInput;
    editingLessonId: string | null;
}
const initialDraft: LessonEditorDraft = {
    form: initialForm,
    editingLessonId: null,
};
export function AdminLessonsPage() {
    const { moduleId } = useParams<{
        moduleId: string;
    }>();
    const [module, setModule] = useState<CourseModule | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const draftStorageKey = useMemo(() => `admin:lessons:${moduleId ?? 'unknown'}:editor-draft`, [moduleId]);
    const { state: draft, setState: setDraft, clear: clearDraft } = useLocalStorageState<LessonEditorDraft>(draftStorageKey, initialDraft);
    const form = draft.form;
    const editingLessonId = draft.editingLessonId;
    const isEditing = useMemo(() => !!editingLessonId, [editingLessonId]);
    const loadData = useCallback(async () => {
        if (!moduleId) {
            setError('Módulo inválido.');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [moduleResult, lessonsResult] = await Promise.all([
                fetchModule(moduleId),
                fetchLessons(moduleId),
            ]);
            setModule(moduleResult);
            setLessons(lessonsResult);
        }
        catch (loadError) {
            setError(toErrorMessage(loadError));
        }
        finally {
            setIsLoading(false);
        }
    }, [moduleId]);
    useEffect(() => {
        void loadData();
    }, [loadData]);
    function resetForm() {
        clearDraft();
        setError(null);
    }
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!moduleId) {
            setError('Módulo inválido.');
            return;
        }
        const parsed = lessonFormSchema.safeParse(form);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            if (editingLessonId) {
                await updateLesson(editingLessonId, parsed.data);
            }
            else {
                await createLesson(moduleId, parsed.data);
            }
            await loadData();
            resetForm();
        }
        catch (submitError) {
            setError(toErrorMessage(submitError));
        }
        finally {
            setIsSubmitting(false);
        }
    }
    function handleEdit(lesson: Lesson) {
        setDraft({
            editingLessonId: lesson.id,
            form: {
                title: lesson.title,
                description: lesson.description ?? '',
                is_required: lesson.is_required,
                is_free_preview: lesson.is_free_preview,
                lesson_type: lesson.lesson_type,
                youtube_url: lesson.youtube_url ?? '',
                text_content: lesson.text_content ?? '',
                estimated_minutes: lesson.estimated_minutes,
            },
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setError(null);
    }
    async function handleDelete(lesson: Lesson) {
        const confirmed = window.confirm(`ATENÇÃO: Excluir a aula "${lesson.title}"

Todos os materiais vinculados ser\u00E3o removidos permanentemente.`);
        if (!confirmed)
            return;
        try {
            await deleteLesson(lesson.id);
            await loadData();
            if (editingLessonId === lesson.id) {
                resetForm();
            }
        }
        catch (deleteError) {
            setError(toErrorMessage(deleteError));
        }
    }
    async function handleMove(current: Lesson, direction: 'up' | 'down') {
        const currentIndex = lessons.findIndex((item) => item.id === current.id);
        if (currentIndex < 0)
            return;
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const target = lessons[targetIndex];
        if (!target)
            return;
        try {
            await moveLesson(current, target);
            await loadData();
        }
        catch (moveError) {
            setError(toErrorMessage(moveError));
        }
    }
    return (<div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="space-y-4 border-b border-slate-100 pb-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link to="/admin/cursos" className="hover:text-blue-600 transition-colors">Cursos</Link>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          {module ? (<>
              <Link to={`/admin/cursos/${module.course_id}/modulos`} className="hover:text-blue-600 transition-colors truncate max-w-[150px] sm:max-w-xs" title="Módulos do Curso">
                Módulos
              </Link>
              <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </>) : null}
          <span className="text-slate-900 truncate max-w-[150px] sm:max-w-xs">{module?.title || 'Carregando...'}</span>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          <span className="text-slate-900 font-semibold">Aulas</span>
        </nav>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestão de Aulas</h2>
          <p className="text-base text-slate-500 mt-1">
            Crie as aulas, configure vídeos e defina a ordem de aprendizado deste módulo.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] items-start">
        {/* Form Column */}
        <section className={`rounded-2xl border bg-white shadow-sm overflow-hidden sticky top-6 transition-all ${isEditing ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
          <div className={`p-5 min-h-[64px] flex items-center border-b ${isEditing ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {isEditing ? (<>
                  <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  Editando Aula
                </>) : (<>
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Nova Aula
                </>)}
            </h3>
          </div>
          
          <form className="p-6 grid gap-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Título da Aula <span className="text-rose-500">*</span></span>
                <input className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400" placeholder="Ex: Aula 1 - Princípios Básicos" value={form.title} onChange={(event) => setDraft((prev) => ({
            ...prev,
            form: { ...prev.form, title: event.target.value },
        }))} required/>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">URL do YouTube <span className="text-slate-400 font-normal ml-1">(Opcional)</span></span>
                  <input className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400" placeholder="https://www.youtube.com/watchv=..." value={form.youtube_url} onChange={(event) => setDraft((prev) => ({
            ...prev,
            form: { ...prev.form, youtube_url: event.target.value },
        }))}/>
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Duração Estimada <span className="text-slate-400 font-normal ml-1">(Minutos)</span></span>
                  <input className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400" type="number" min={0} placeholder="Ex: 15" value={form.estimated_minutes === 0 ? '' : form.estimated_minutes} onChange={(event) => setDraft((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                estimated_minutes: Number(event.target.value || 0),
            },
        }))}/>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Resumo da Aula <span className="text-slate-400 font-normal ml-1">(Opcional)</span></span>
                <textarea className="min-h-[100px] w-full rounded-lg border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y placeholder:text-slate-400" placeholder="Descreva brevemente o conteúdo desta aula." value={form.description} onChange={(event) => setDraft((prev) => ({
            ...prev,
            form: { ...prev.form, description: event.target.value },
        }))}/>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <input checked={form.is_required} type="checkbox" className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600" onChange={(event) => setDraft((prev) => ({
            ...prev,
            form: { ...prev.form, is_required: event.target.checked },
        }))}/>
                <span className="text-sm font-semibold text-slate-900 select-none">Aula Obrigatória para Conclusão</span>
              </label>
            </div>

            {error ? (<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 flex items-start gap-2">
                <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                {error}
              </div>) : null}

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} size="lg" className={`w-full text-sm font-bold shadow-sm ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSubmitting
            ? (isEditing ? 'Atualizando...' : 'Salvando...')
            : (isEditing ? 'Salvar Alterações' : 'Cadastrar Aula')}
              </Button>
              {isEditing ? (<Button type="button" variant="outline" onClick={resetForm} className="w-full text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-slate-200">
                  Cancelar Edição
                </Button>) : null}
            </div>
          </form>
        </section>

        {/* List Column */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Aulas Cadastradas ({lessons.length})
            </h3>
            {isLoading && <span className="text-sm font-medium text-slate-400 animate-pulse">Carregando...</span>}
          </div>

          {!isLoading && lessons.length === 0 ? (<div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-slate-50/50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </div>
              <p className="text-slate-500 font-medium">Nenhuma aula cadastrada ainda.</p>
              <p className="text-sm text-slate-400 mt-1">Utilize o formulário ao lado para adicionar conteúdo a este módulo.</p>
            </div>) : null}

          <div className="space-y-3">
            {lessons.map((lesson, index) => (<article key={lesson.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${editingLessonId === lesson.id ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="p-4 sm:p-5 flex gap-4">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => void handleMove(lesson, 'up')} disabled={index === 0} title="Mover para cima">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                    </Button>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                      {lesson.position}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => void handleMove(lesson, 'down')} disabled={index === lessons.length - 1} title="Mover para baixo">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </Button>
                  </div>

                  <div className="flex-1 space-y-2 py-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-slate-900 leading-tight">{lesson.title}</h4>
                          {lesson.is_required ? (<span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">Obrigatória</span>) : (<span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">Opcional</span>)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800" onClick={() => handleEdit(lesson)}>
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => void handleDelete(lesson)} title="Excluir Aula">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        {lesson.estimated_minutes} {lesson.estimated_minutes === 1 ? 'minuto' : 'minutos'}
                      </span>
                      {lesson.youtube_url ? (<a href={lesson.youtube_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium hover:underline">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          Vídeo Configurado
                        </a>) : (<span className="flex items-center gap-1.5 text-slate-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          Sem Vídeo
                        </span>)}
                    </div>

                    {lesson.description && (<p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mt-2 p-3 bg-slate-50 rounded-lg">{lesson.description}</p>)}
                  </div>
                </div>

                <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex flex-wrap items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-4 text-xs font-bold bg-white border-slate-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 shadow-sm" asChild>
                    <Link to={`/admin/aulas/${lesson.id}/materiais`}>
                      <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                      Gerenciar Materiais
                    </Link>
                  </Button>
                </div>
              </article>))}
          </div>
        </section>
      </div>
    </div>);
}
