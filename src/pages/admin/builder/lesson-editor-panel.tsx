import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createLesson, deleteMaterial, deleteLesson, fetchMaterials, fetchLessonFooterActions, getSignedMaterialUrl, uploadMaterial, updateLesson, toErrorMessage, type UploadProgressSnapshot, } from '@/features/admin/content/api';
import { lessonFormSchema, type LessonFormInput } from '@/features/admin/content/schemas';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import { useAuth } from '@/app/providers/auth-provider';
import { fetchLessonAudioModerationRequests, resolveLessonAudioModerationRequest, type LessonAudioModerationRequestAdminItem, } from '@/features/admin/lesson-audio/api';
import { splitContent, mergeContent, } from '@/features/admin/content/content-blocks';
import type { LessonContentBlock } from '@/features/admin/content/content-blocks';
import { Button } from '@/components/ui/button';
import { getLessonFooterActionIconName, getLessonFooterButtonClassName, renderButtonTemplateIcon, } from '@/features/admin/content/button-template-icons';
import { LessonContentBlocksEditor } from '@/features/admin/content/lesson-content-blocks';
import { LessonAudioPlayer } from '@/features/student/lesson-audio/lesson-audio-player';
import { publishBuilderNotice } from '@/lib/builder-notice';
import type { LessonFooterAction, LessonMaterial } from '@/types/content';
const initialForm: LessonFormInput = {
    title: '',
    description: '',
    is_required: true,
    lesson_type: 'video',
    youtube_url: '',
    text_content: '',
    estimated_minutes: 0,
    starts_at: '',
    ends_at: '',
};
function formatBytes(value: number): string {
    if (value === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const normalized = value / 1024 ** unitIndex;
    return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
function formatEtaSeconds(value: number | null): string {
    if (value === null)
        return 'calculando...';
    if (value <= 0)
        return '0s';
    return `${value}s`;
}
function getYouTubeEmbedUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('youtu.be')) {
            const videoId = parsed.pathname.replace('/', '').trim();
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }
        if (host.includes('youtube.com') || host.includes('m.youtube.com')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId)
                return `https://www.youtube.com/embed/${videoId}`;
            const parts = parsed.pathname.split('/').filter(Boolean);
            const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts');
            if (embedIndex >= 0 && parts[embedIndex + 1]) {
                return `https://www.youtube.com/embed/${parts[embedIndex + 1]}`;
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
function isDirectVideoUrl(url: string): boolean {
    return /^https?:\/\/[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?$/i.test(url);
}
export function LessonEditorPanel() {
    const { courseId, moduleId, lessonId } = useParams<{
        courseId: string;
        moduleId: string;
        lessonId?: string;
    }>();
    const navigate = useNavigate();
    const { courseTree, refreshTree } = useCourseBuilder();
    const { user } = useAuth();
    const isNew = lessonId === 'nova';
    const [form, setForm] = useState<LessonFormInput>(initialForm);
    const [blocks, setBlocks] = useState<LessonContentBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoInputMode, setVideoInputMode] = useState<'url' | 'asset'>('url');
    const [lessonMaterials, setLessonMaterials] = useState<LessonMaterial[]>([]);
    const [isLoadingLessonMaterials, setIsLoadingLessonMaterials] = useState(false);
    const [isUploadingProtectedVideo, setIsUploadingProtectedVideo] = useState(false);
    const [isRemovingProtectedVideo, setIsRemovingProtectedVideo] = useState(false);
    const [isUploadingFileLessonAsset, setIsUploadingFileLessonAsset] = useState(false);
    const [pendingProtectedVideoFile, setPendingProtectedVideoFile] = useState<File | null>(null);
    const [pendingFileLessonAsset, setPendingFileLessonAsset] = useState<File | null>(null);
    const [protectedVideoUploadProgress, setProtectedVideoUploadProgress] = useState<UploadProgressSnapshot | null>(null);
    const [fileLessonUploadProgress, setFileLessonUploadProgress] = useState<UploadProgressSnapshot | null>(null);
    const [protectedVideoPreviewUrl, setProtectedVideoPreviewUrl] = useState<string | null>(null);
    const [isLoadingProtectedVideoPreview, setIsLoadingProtectedVideoPreview] = useState(false);
    const [audioRequests, setAudioRequests] = useState<LessonAudioModerationRequestAdminItem[]>([]);
    const [footerActions, setFooterActions] = useState<LessonFooterAction[]>([]);
    const [isLoadingAudioRequests, setIsLoadingAudioRequests] = useState(false);
    const [isLoadingFooterActions, setIsLoadingFooterActions] = useState(false);
    const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
    const [audioResponseByRequest, setAudioResponseByRequest] = useState<Record<string, string>>({});
    useEffect(() => {
        if (isNew) {
            setForm(initialForm);
            setBlocks([{ type: 'rich-text', content: '' }]);
            setVideoInputMode('url');
            setLessonMaterials([]);
            setPendingProtectedVideoFile(null);
            setPendingFileLessonAsset(null);
            return;
        }
        if (courseTree && lessonId) {
            let found = null;
            for (const m of courseTree.modules) {
                const lesson = m.lessons.find((l) => l.id === lessonId);
                if (lesson) {
                    found = lesson;
                    break;
                }
            }
            if (found) {
                const textContent = found.text_content ?? '';
                setBlocks(splitContent(textContent));
                setForm({
                    title: found.title,
                    description: found.description ?? '',
                    is_required: found.is_required,
                    lesson_type: found.lesson_type,
                    youtube_url: found.youtube_url ?? '',
                    text_content: textContent,
                    estimated_minutes: found.estimated_minutes,
                    starts_at: found.starts_at ? found.starts_at.slice(0, 16) : '',
                    ends_at: found.ends_at ? found.ends_at.slice(0, 16) : '',
                });
                setVideoInputMode(found.youtube_url?.startsWith('asset:') ? 'asset' : 'url');
            }
        }
    }, [isNew, lessonId, courseTree]);
    useEffect(() => {
        async function loadLessonMaterials() {
            if (isNew || !lessonId) {
                setLessonMaterials([]);
                return;
            }
            setIsLoadingLessonMaterials(true);
            try {
                const materials = await fetchMaterials(lessonId);
                setLessonMaterials(materials);
            }
            catch (err) {
                console.error('Erro ao buscar materiais da aula:', err);
            }
            finally {
                setIsLoadingLessonMaterials(false);
            }
        }
        void loadLessonMaterials();
    }, [isNew, lessonId]);
    useEffect(() => {
        async function loadProtectedVideoPreview() {
            if (videoInputMode !== 'asset') {
                setProtectedVideoPreviewUrl(null);
                return;
            }
            const value = form.youtube_url?.trim() ?? '';
            if (!value.startsWith('asset:')) {
                setProtectedVideoPreviewUrl(null);
                return;
            }
            const materialId = value.slice('asset:'.length).trim();
            const linkedMaterial = lessonMaterials.find((material) => material.id === materialId);
            if (!linkedMaterial?.storage_path) {
                setProtectedVideoPreviewUrl(null);
                return;
            }
            setIsLoadingProtectedVideoPreview(true);
            try {
                const signedUrl = await getSignedMaterialUrl(linkedMaterial.storage_path);
                setProtectedVideoPreviewUrl(signedUrl);
            }
            catch {
                setProtectedVideoPreviewUrl(null);
            }
            finally {
                setIsLoadingProtectedVideoPreview(false);
            }
        }
        void loadProtectedVideoPreview();
    }, [videoInputMode, form.youtube_url, lessonMaterials]);
    useEffect(() => {
        async function loadAudioRequests() {
            if (isNew || !lessonId)
                return;
            setIsLoadingAudioRequests(true);
            try {
                const requests = await fetchLessonAudioModerationRequests({ lessonId });
                setAudioRequests(requests);
            }
            catch (err) {
                console.error('Erro ao buscar solicita\u00e7\u00f5es de narra\u00e7\u00e3o:', err);
            }
            finally {
                setIsLoadingAudioRequests(false);
            }
        }
        void loadAudioRequests();
    }, [isNew, lessonId]);
    useEffect(() => {
        async function loadFooterActions() {
            if (isNew || !lessonId) {
                setFooterActions([]);
                return;
            }
            setIsLoadingFooterActions(true);
            try {
                const actions = await fetchLessonFooterActions(lessonId);
                setFooterActions(actions);
            }
            catch (err) {
                console.error('Erro ao buscar bot\u00f5es da aula:', err);
            }
            finally {
                setIsLoadingFooterActions(false);
            }
        }
        void loadFooterActions();
    }, [isNew, lessonId]);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!moduleId || !courseId)
            return;
        const parsed = lessonFormSchema.safeParse(form);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const finalHtml = mergeContent(blocks);
            const dataToSave: LessonFormInput = {
                ...form,
                youtube_url: (form.lesson_type === 'video' || form.lesson_type === 'hybrid')
                    ? (form.youtube_url?.trim() ?? '')
                    : '',
                text_content: (form.lesson_type === 'text' || form.lesson_type === 'hybrid')
                    ? finalHtml
                    : '',
            };
            if (!isNew && lessonId) {
                await updateLesson(lessonId, dataToSave);
                publishBuilderNotice({
                    type: 'success',
                    title: 'Aula salva',
                    message: `As alteracoes da aula "${form.title}" foram salvas com sucesso.`,
                });
            }
            else {
                const created = await createLesson(moduleId, dataToSave);
                await refreshTree();
                publishBuilderNotice({
                    type: 'success',
                    title: 'Aula criada',
                    message: `A aula "${form.title}" foi criada com sucesso.`,
                });
                navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${created.id}`, { replace: true });
                return;
            }
            await refreshTree();
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsSubmitting(false);
        }
    }
    async function handleDelete() {
        if (!lessonId || isNew)
            return;
        const confirmed = window.confirm("ATEN\u00C7\u00C3O: Excluir esta aula permanentemente");
        if (!confirmed)
            return;
        setIsDeleting(true);
        try {
            await deleteLesson(lessonId);
            await refreshTree();
            navigate(`/admin/cursos/${courseId}/builder`);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsDeleting(false);
        }
    }
    async function handleResolveAudioRequest(requestId: string) {
        if (!user?.id)
            return;
        setResolvingRequestId(requestId);
        try {
            await resolveLessonAudioModerationRequest({
                requestId,
                adminResponse: audioResponseByRequest[requestId] ?? '',
                resolvedBy: user.id,
            });
            if (lessonId) {
                const requests = await fetchLessonAudioModerationRequests({ lessonId });
                setAudioRequests(requests);
            }
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setResolvingRequestId(null);
        }
    }
    async function uploadLessonAsset(file: File | null, options: {
        uploadType: 'protected-v?deo' | 'file-lesson';
    }) {
        if (!file || !lessonId || !user?.id) {
            setError('Salve a aula e autentique-se para enviar arquivos.');
            return;
        }
        setError(null);
        if (options.uploadType === 'protected-v?deo') {
            setIsUploadingProtectedVideo(true);
            setProtectedVideoUploadProgress({
                loadedBytes: 0,
                totalBytes: file.size,
                percent: 0,
                etaSeconds: null,
            });
        }
        else {
            setIsUploadingFileLessonAsset(true);
            setFileLessonUploadProgress({
                loadedBytes: 0,
                totalBytes: file.size,
                percent: 0,
                etaSeconds: null,
            });
        }
        try {
            const uploaded = await uploadMaterial(lessonId, file, user.id, {
                onProgress: (snapshot) => {
                    if (options.uploadType === 'protected-v?deo') {
                        setProtectedVideoUploadProgress(snapshot);
                    }
                    else {
                        setFileLessonUploadProgress(snapshot);
                    }
                },
            });
            setLessonMaterials((prev) => [uploaded, ...prev.filter((item) => item.id !== uploaded.id)]);
            if (options.uploadType === 'protected-v?deo') {
                setForm((prev) => ({ ...prev, youtube_url: `asset:${uploaded.id}` }));
                setVideoInputMode('asset');
                setPendingProtectedVideoFile(null);
                publishBuilderNotice({
                    type: 'success',
                    title: 'Video protegido enviado',
                    message: `O arquivo "${uploaded.file_name}" foi vinculado como fonte audiovisual da aula.`,
                });
            }
            else {
                setPendingFileLessonAsset(null);
                publishBuilderNotice({
                    type: 'success',
                    title: 'Arquivo enviado',
                    message: `O arquivo "${uploaded.file_name}" foi adicionado aos materiais desta aula.`,
                });
            }
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            if (options.uploadType === 'protected-v?deo') {
                setIsUploadingProtectedVideo(false);
                setProtectedVideoUploadProgress(null);
            }
            else {
                setIsUploadingFileLessonAsset(false);
                setFileLessonUploadProgress(null);
            }
        }
    }
    async function removeProtectedVideoAsset() {
        const value = form.youtube_url?.trim() ?? '';
        if (!value.startsWith('asset:')) {
            setError('Nenhum v?deo protegido vinculado para remover.');
            return;
        }
        const materialId = value.slice('asset:'.length).trim();
        const linkedMaterial = lessonMaterials.find((item) => item.id === materialId);
        if (!linkedMaterial) {
            setError("N?o foi poss?vel localizar o arquivo vinculado para remo\u00e7\u00e3o.");
            return;
        }
        const confirmed = window.confirm(`Deseja remover o v?deo protegido "${linkedMaterial.file_name}"

Esta a??o exclui o arquivo do storage privado.`);
        if (!confirmed) {
            return;
        }
        setError(null);
        setIsRemovingProtectedVideo(true);
        try {
            await deleteMaterial(linkedMaterial);
            setLessonMaterials((prev) => prev.filter((item) => item.id !== linkedMaterial.id));
            setForm((prev) => ({ ...prev, youtube_url: '' }));
            setProtectedVideoPreviewUrl(null);
            setPendingProtectedVideoFile(null);
            publishBuilderNotice({
                type: 'success',
                title: 'Video removido',
                message: `O arquivo "${linkedMaterial.file_name}" foi removido do storage e desvinculado da aula.`,
            });
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsRemovingProtectedVideo(false);
        }
    }
    return (<div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
       <style>{`
         .quill { background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0 !important; }
         .ql-toolbar { border: none !important; border-bottom: 1px solid #f1f5f9 !important; background: #f8fafc; }
         .ql-container { border: none !important; min-height: 400px; font-family: inherit; font-size: 16px; }
         .ql-editor { min-height: 400px; padding: 20px 24px; color: #1e293b; line-height: 1.6; }
         .ql-editor.ql-blank::before { color: #94a3b8; font-style: normal; }
         .ql-editor h1, .ql-editor h2, .ql-editor h3 { font-weight: 800; color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; }
         .ql-editor p { margin-bottom: 1em; }
         
         /* Estilos para Tabelas no Editor */
         .ql-editor table { width: 100% !important; border-collapse: collapse; margin: 24px 0; }
         .ql-editor th { background: #f8fafc; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; }
         .ql-editor td { padding: 8px 12px; border: 1px solid #e2e8f0; vertical-align: top; }
       `}</style>

       <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isNew ? "Criar Nova Aula" : 'Editor de Aula'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure o formato pedag?gico e o conte?do da sua aula.
            </p>
          </div>
          {!isNew && (<Button variant="outline" size="sm" className="bg-white px-4 h-10 font-bold border-slate-200" onClick={() => navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${lessonId}/materiais`)}>
              <svg className="h-4 w-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              Botoes e URLs da Aula
            </Button>)}
       </div>

       {!isNew && lessonId && (form.lesson_type === 'text' || form.lesson_type === 'hybrid') ? (<div className="space-y-4">
           <LessonAudioPlayer lessonId={lessonId} isAdmin/>

           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
             <div className="border-b border-slate-100 px-6 py-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">
                 Solicita??es de modera??o da narra??o
               </h3>
             </div>
             <div className="space-y-4 p-6">
               {isLoadingAudioRequests ? (<p className="text-sm text-slate-500">Carregando solicita??es...</p>) : audioRequests.length === 0 ? (<p className="text-sm text-slate-500">Nenhuma solicita??o registrada para esta aula.</p>) : (audioRequests.map((request) => {
                const isPending = request.status === 'pending';
                const isResolving = resolvingRequestId === request.id;
                return (<div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                       <div className="flex flex-wrap items-center justify-between gap-2">
                         <p className="text-sm font-bold text-slate-800">
                           {request.requester_name ?? request.requester_email ?? 'Aluno'}
                         </p>
                         <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                           {isPending ? 'Pendente' : 'Resolvida'}
                         </span>
                       </div>
                       <p className="mt-2 text-xs text-slate-500">
                         Solicita??o em {new Date(request.created_at).toLocaleString('pt-BR')}
                       </p>
                       {request.technical_error ? (<p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600">{request.technical_error}</p>) : null}

                       {isPending ? (<div className="mt-3 space-y-2">
                           <textarea className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Resposta opcional para o aluno." value={audioResponseByRequest[request.id] ?? ''} onChange={(event) => setAudioResponseByRequest((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                        }))}/>
                           <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={isResolving} onClick={() => void handleResolveAudioRequest(request.id)}>
                             {isResolving ? 'Salvando...' : 'Marcar como resolvida'}
                           </Button>
                         </div>) : request.admin_response ? (<p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600">{request.admin_response}</p>) : null}
                     </div>);
            }))}
             </div>
           </div>
         </div>) : null}

       <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 space-y-10 flex-1">
             
             {/* Bloco 1: Identifica??o */}
             <fieldset className="space-y-4">
               <legend className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 w-full mb-6 flex items-center gap-2">
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">01</span>
                 Identifica??o da Aula
               </legend>
               
               <label className="block space-y-2">
                 <span className="text-sm font-bold text-slate-800">T?tulo da Aula <span className="text-rose-500">*</span></span>
                 <input className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white placeholder:text-slate-400" placeholder="Ex: Princ?pios do m?dulo" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required/>
               </label>

               <label className="block space-y-2">
                 <span className="text-sm font-bold text-slate-800">Descri??o Curta (Opcional)</span>
                 <textarea className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white resize-y placeholder:text-slate-400" placeholder="Uma breve introdu??o sobre o que ser? abordado." value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}/>
               </label>
             </fieldset>

             {/* Bloco 2: Formato */}
             <fieldset className="space-y-6">
               <legend className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 w-full mb-6 flex items-center gap-2">
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">02</span>
                 Formato Pedag?gico
               </legend>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-100/80 p-1.5 rounded-2xl">
                 <button type="button" onClick={() => setForm(prev => ({ ...prev, lesson_type: 'video' }))} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'video' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                   Apenas V?deo
                 </button>
                 <button type="button" onClick={() => setForm(prev => ({ ...prev, lesson_type: 'text' }))} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'text' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                   Apenas Texto
                 </button>
                 <button type="button" onClick={() => setForm(prev => ({ ...prev, lesson_type: 'hybrid' }))} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'hybrid' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                   V?deo + Texto
                 </button>
                 <button type="button" onClick={() => setForm(prev => ({ ...prev, lesson_type: 'file' }))} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${form.lesson_type === 'file' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 7h10"/></svg>
                   Apenas Arquivo
                 </button>
               </div>

               {(form.lesson_type === 'video' || form.lesson_type === 'hybrid') && (<div className="animate-in slide-in-from-top-2 duration-300 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
                   <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Bloco 03: Conte?do em V?deo</p>
                   <h4 className="text-2xl font-black text-slate-900">Fonte audiovisual</h4>

                   <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-1">
                     <button type="button" onClick={() => setVideoInputMode('url')} className={`rounded-xl px-4 py-4 text-left transition ${videoInputMode === 'url' ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                       <p className="text-sm font-black">Usar URL do v?deo</p>
                       <p className={`mt-1 text-sm ${videoInputMode === 'url' ? 'text-slate-200' : 'text-slate-500'}`}>
                         Usa YouTube ou link direto quando quiser apontar para um arquivo externo.
                       </p>
                     </button>
                     <button type="button" onClick={() => setVideoInputMode('asset')} className={`rounded-xl px-4 py-4 text-left transition ${videoInputMode === 'asset' ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                       <p className="text-sm font-black">Usar upload protegido</p>
                       <p className={`mt-1 text-sm ${videoInputMode === 'asset' ? 'text-slate-200' : 'text-slate-500'}`}>
                         Envia o v?deo para a plataforma e publica apenas a refer?ncia protegida.
                       </p>
                     </button>
                   </div>

                   <div className="rounded-xl border border-slate-200 bg-white p-4">
                     <p className="text-lg font-black text-slate-900">
                       {videoInputMode === 'url' ? 'Sem URL de v?deo' : 'Upload protegido selecionado'}
                     </p>
                     <p className="mt-2 text-sm text-slate-600">
                       {videoInputMode === 'url'
                ? 'Defina um link do YouTube ou de um v?deo direto enquanto o modo de URL estiver ativo.'
                : "Selecione um arquivo e clique em Enviar v?deo protegido para concluir esta aula sem depender de link externo."}
                     </p>
                   </div>

                   <div className="rounded-xl border border-slate-200 bg-white p-4">
                     <div className="flex flex-wrap items-center justify-between gap-3">
                       <p className="text-lg font-black text-slate-900">Pr?-visualiza??o do v?deo</p>
                       <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${videoInputMode === 'url'
                ? 'bg-sky-100 text-sky-800'
                : 'bg-emerald-100 text-emerald-800'}`}>
                         {videoInputMode === 'url' ? 'URL externa' : 'Upload protegido'}
                       </span>
                     </div>
                     <p className="text-sm text-slate-500">Esta visualiza??o usa a origem selecionada no alternador acima.</p>
                     <div className="mt-4">
                       {videoInputMode === 'asset' ? (isLoadingProtectedVideoPreview ? (<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                             Carregando pr?-visualiza??o do v?deo protegido...
                           </div>) : protectedVideoPreviewUrl ? (<div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                             <video className="aspect-video w-full" controls preload="metadata" src={protectedVideoPreviewUrl}>O navegador n?o suporta reprodu\u00e7\u00e3o de v\u00eddeo.
                             </video>
                           </div>) : (<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Ainda n?o existe v?deo para pr?-visualizar neste modo.
                           </div>)) : (() => {
                const url = form.youtube_url?.trim() ?? '';
                if (!url) {
                    return (<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Ainda n?o existe v?deo para pr?-visualizar neste modo.
                             </div>);
                }
                const youtubeEmbedUrl = getYouTubeEmbedUrl(url);
                if (youtubeEmbedUrl) {
                    return (<div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                               <iframe className="aspect-video w-full" src={youtubeEmbedUrl} title="Pr?-visualiza??o do v?deo" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
                             </div>);
                }
                if (isDirectVideoUrl(url)) {
                    return (<div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                               <video className="aspect-video w-full" controls preload="metadata" src={url}>O navegador n?o suporta reprodu\u00e7\u00e3o de v\u00eddeo.
                               </video>
                             </div>);
                }
                return (<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                             URL inv?lida para pr?-visualiza??o.
                           </div>);
            })()}
                     </div>
                   </div>

                   <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                     <p className="font-black">Nota de prote??o</p>
                     <p className="mt-2 text-sm">
                       Nenhum player web garante prote??o total contra pirataria. O upload protegido reduz o risco com bucket privado e refer?ncia assinada tempor?ria.
                     </p>
                   </div>

                   {videoInputMode === 'url' ? (<label className="block space-y-2">
                       <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">URL do v?deo</span>
                       <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-inner transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400" placeholder="https://youtube.com/watchv=... ou https://cdn.exemplo.com/v?deo.mp4" value={form.youtube_url} onChange={(event) => setForm((prev) => ({ ...prev, youtube_url: event.target.value }))}/>
                       <p className="text-sm text-slate-600">
                         Aceita links do YouTube ou URLs diretas de arquivo de v?deo como .mp4, .webm, .mov e .m4v.
                       </p>
                     </label>) : (<div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                       <p className="text-lg font-black text-slate-900">Upload protegido de v?deo</p>
                       <p className="text-sm text-slate-600">
                         Recomendado para aulas pagas. O v?deo fica em storage privado e a aula salva a refer?ncia no formato <code>asset:uuid</code>.
                       </p>
                       {isNew || !lessonId ? (<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                           Salve a aula primeiro para habilitar o upload protegido.
                         </p>) : (<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                           <input type="file" accept="video/*" onChange={(event) => setPendingProtectedVideoFile(event.target.files?.[0] ?? null)} className="text-sm"/>
                           <Button type="button" disabled={!pendingProtectedVideoFile || isUploadingProtectedVideo} onClick={() => void uploadLessonAsset(pendingProtectedVideoFile, { uploadType: 'protected-v?deo' })} className="bg-slate-900 text-white hover:bg-slate-800">
                             {isUploadingProtectedVideo ? 'Enviando v?deo...' : 'Enviar v?deo protegido'}
                           </Button>
                         </div>)}
                       {protectedVideoUploadProgress ? (<div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                           <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                             <span>Progresso do upload</span>
                             <span>{protectedVideoUploadProgress.percent}%</span>
                           </div>
                           <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                             <div className="h-full rounded-full bg-slate-900 transition-all duration-300" style={{ width: `${protectedVideoUploadProgress.percent}%` }}/>
                           </div>
                           <p className="mt-2 text-xs text-slate-600">
                             {formatBytes(protectedVideoUploadProgress.loadedBytes)} de {formatBytes(protectedVideoUploadProgress.totalBytes)} â€¢
                             {' '}Previs?o de t?rmino: {formatEtaSeconds(protectedVideoUploadProgress.etaSeconds)}
                           </p>
                         </div>) : null}
                       {form.youtube_url?.startsWith('asset:') ? (<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                           <p className="text-xs text-slate-500">Refer?ncia protegida atual: {form.youtube_url}</p>
                           <Button type="button" variant="outline" className="h-9 rounded-lg border-rose-200 bg-white px-3 text-xs font-black text-rose-700 hover:bg-rose-50" onClick={() => void removeProtectedVideoAsset()} disabled={isRemovingProtectedVideo || isUploadingProtectedVideo}>
                             {isRemovingProtectedVideo ? 'Removendo...' : 'Remover v?deo protegido'}
                           </Button>
                         </div>) : null}
                     </div>)}
                 </div>)}
               {form.lesson_type === 'file' ? (<div className="animate-in slide-in-from-top-2 duration-300 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
                   <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Bloco 03: Conte?do em Arquivo</p>
                   <h4 className="text-xl font-black text-slate-900">Upload do arquivo principal</h4>
                   <p className="text-sm text-slate-600">No formato "apenas arquivo", envie o arquivo para os materiais desta aula.
                   </p>
                   {isNew || !lessonId ? (<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                       Salve a aula primeiro para habilitar o upload de arquivo.
                     </p>) : (<div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                       <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                         <input type="file" onChange={(event) => setPendingFileLessonAsset(event.target.files?.[0] ?? null)} className="text-sm"/>
                         <Button type="button" disabled={!pendingFileLessonAsset || isUploadingFileLessonAsset} onClick={() => void uploadLessonAsset(pendingFileLessonAsset, { uploadType: 'file-lesson' })} className="bg-slate-900 text-white hover:bg-slate-800">
                           {isUploadingFileLessonAsset ? 'Enviando arquivo...' : 'Enviar arquivo'}
                         </Button>
                       </div>
                       <p className="text-xs text-slate-500">Limite atual conforme configura??o do storage protegido.</p>
                       {fileLessonUploadProgress ? (<div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                           <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                             <span>Progresso do upload</span>
                             <span>{fileLessonUploadProgress.percent}%</span>
                           </div>
                           <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                             <div className="h-full rounded-full bg-slate-900 transition-all duration-300" style={{ width: `${fileLessonUploadProgress.percent}%` }}/>
                           </div>
                           <p className="mt-2 text-xs text-slate-600">
                             {formatBytes(fileLessonUploadProgress.loadedBytes)} de {formatBytes(fileLessonUploadProgress.totalBytes)} â€¢
                             {' '}Previs?o de t?rmino: {formatEtaSeconds(fileLessonUploadProgress.etaSeconds)}
                           </p>
                         </div>) : null}
                     </div>)}
                   <div className="rounded-xl border border-slate-200 bg-white p-4">
                     <p className="text-sm font-black text-slate-900">Arquivos ja enviados</p>
                     {isLoadingLessonMaterials ? (<p className="mt-2 text-sm text-slate-500">Carregando arquivos...</p>) : lessonMaterials.length === 0 ? (<p className="mt-2 text-sm text-slate-500">Nenhum arquivo enviado para esta aula.</p>) : (<ul className="mt-3 space-y-2 text-sm text-slate-600">
                         {lessonMaterials.slice(0, 5).map((material) => (<li key={material.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                             <span className="font-semibold text-slate-800">{material.file_name}</span>
                             <span className="ml-2 text-xs text-slate-500">{formatBytes(material.file_size_bytes)}</span>
                           </li>))}
                       </ul>)}
                   </div>
                 </div>) : null}
                {(form.lesson_type === 'text' || form.lesson_type === 'hybrid') && (<div className="animate-in slide-in-from-top-2 duration-300 space-y-6">
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-800">Estrutura do Conte?do</span>
                      </div>

                      <LessonContentBlocksEditor blocks={blocks} onChange={setBlocks} onError={setError} />
                   </div>)}

               <div className="pt-4 border-t border-slate-50">
                 <label className="block space-y-2 max-w-[200px]">
                   <span className="text-sm font-bold text-slate-800">Carga Hor?ria Estimada (Min)</span>
                   <input className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white placeholder:text-slate-400" type="number" min={0} placeholder="Ex: 20" value={form.estimated_minutes === 0 ? '' : form.estimated_minutes} onChange={(e) => setForm((prev) => ({ ...prev, estimated_minutes: Number(e.target.value || 0) }))}/>
                 </label>
               </div>
             </fieldset>

             {/* Bloco 3: Regras */}
             <fieldset className="space-y-4">
               <legend className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 w-full mb-6 flex items-center gap-2">
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">03</span>
                 Configura??es de Conclus?o
               </legend>
               <label className="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/20 cursor-pointer hover:bg-blue-50/40 transition-colors shadow-sm">
                 <div className="flex items-center h-6">
                   <input checked={form.is_required} type="checkbox" className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-600 shadow-sm transition-all" onChange={(e) => setForm((prev) => ({ ...prev, is_required: e.target.checked }))}/>
                 </div>
                 <div>
                   <span className="text-sm font-bold text-slate-900 block">Marcar como Aula Obrigat?ria</span>
                   <span className="text-[11px] text-slate-500 mt-1 block leading-relaxed">Se ativado, esta aula deve ser visualizada/lida para que o aluno receba o certificado de conclus?o do curso.</span>
                 </div>
               </label>

               <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                 <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Libera??o Programada</p>
                 <div className="mt-4 grid gap-4 md:grid-cols-2">
                   <label className="block space-y-2">
                     <span className="text-sm font-bold text-slate-800">Liberar em</span>
                     <input type="datetime-local" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner" value={form.starts_at ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}/>
                   </label>
                   <label className="block space-y-2">
                     <span className="text-sm font-bold text-slate-800">Expirar em</span>
                     <input type="datetime-local" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm shadow-inner" value={form.ends_at ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))}/>
                   </label>
                 </div>
                 <p className="mt-3 text-[11px] text-slate-500">A aula s? libera quando o m?dulo tamb?m estiver dentro da janela configurada.
                 </p>
               </div>

               <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                   <div>
                     <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{'Bot\u00f5es no Rodap\u00e9 da Aula'}</p>
                     <p className="mt-2 text-sm text-slate-500">
                       {'Configure arquivos e links que aparecem como bot?es no rodap? do player do aluno.'}
                     </p>
                   </div>
                   {!isNew ? (<Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${lessonId}/materiais`)}>
                       {'Gerenciar bot?es'}
                     </Button>) : null}
                 </div>

                 {isNew ? (<p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                     {'Salve a aula primeiro para cadastrar bot?es, materiais e URLs do rodap?.'}
                   </p>) : isLoadingFooterActions ? (<p className="mt-4 text-sm text-slate-500">{'Carregando bot?es configurados...'}</p>) : footerActions.length === 0 ? (<p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{'Nenhum bot?o configurado ainda para esta aula.'}
                   </p>) : (<div className="mt-4 grid gap-3">
                     {footerActions.map((action, index) => (<div key={action.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                         <div className="flex flex-wrap items-center gap-2">
                           <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                             {index + 1}
                           </span>
                           <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                             {action.action_type === 'file' ? 'Arquivo' : 'URL'}
                           </span>
                         </div>
                         <div className="mt-3">
                           <Button type="button" variant="outline" className={getLessonFooterButtonClassName(action.template)}>
                             {renderButtonTemplateIcon(getLessonFooterActionIconName(action))}
                             {action.label?.trim() || action.template?.default_label || action.file_name || 'Bot?o sem r?tulo'}
                           </Button>
                         </div>
                       </div>))}
                   </div>)}
               </div>
             </fieldset>

          </div>

          {error && (<div className="mx-6 md:mx-8 mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600 flex items-start gap-2 animate-pulse">
              <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              {error}
            </div>)}
          
          <div className="bg-slate-50 border-t border-slate-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            {!isNew && (<Button type="button" variant="outline" onClick={handleDelete} disabled={isDeleting || isSubmitting} className="border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 w-full sm:w-auto transition-all">
                {isDeleting ? 'Excluindo...' : 'Remover Aula'}
              </Button>)}
            <div className={`flex gap-3 w-full sm:w-auto ${isNew ? 'sm:justify-end' : ''}`}>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 shadow-md font-bold transition-all active:scale-95">
                {isSubmitting ? 'Salvando...' : (isNew ? 'Criar Aula' : 'Salvar Alterações')}
              </Button>
            </div>
          </div>
       </form>
    </div>);
}


