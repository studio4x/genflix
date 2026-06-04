import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { AppVersion } from '@/components/layout/AppVersion';
import { Button } from '@/components/ui/button';
import { fetchAdminCourseTree, toErrorMessage, importCourseContent, exportFullCourseContent, exportModuleContent } from '@/features/admin/content/api';
import type { AdminCourseTree } from '@/features/admin/content/api';
import { CourseTreeDnd } from '@/features/admin/content/components/course-tree-dnd';
import { exportFinalAssessmentContent } from '@/features/admin/assessments/api';
import { downloadJsonFile } from '@/lib/download';
import { BUILDER_NOTICE_EVENT, clearBuilderNotice, readBuilderNotice, type BuilderNoticePayload, } from '@/lib/builder-notice';
interface BuilderContextData {
    courseTree: AdminCourseTree | null;
    refreshTree: () => Promise<void>;
    isLoading: boolean;
}
type ImportJsonFormatKind = 'course' | 'module' | 'assessment' | 'unknown';
function extractCleanImportJson(rawJson: string) {
    let cleanedJson = rawJson.trim();
    const match = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        cleanedJson = match[1].trim();
    }
    else {
        cleanedJson = cleanedJson.replace(/^```(json)?\s+/, '').replace(/\s+```$/, '').trim();
    }
    return cleanedJson;
}
function parseImportJson(rawJson: string) {
    const cleanedJson = extractCleanImportJson(rawJson);
    let data: unknown;
    try {
        data = JSON.parse(cleanedJson);
    }
    catch (err1) {
        try {
            const fixedJson = cleanedJson.replace(/\n(?!\s*[{}[\]",:0-9\-.tfn])/g, '\\n');
            data = JSON.parse(fixedJson);
        }
        catch (err2) {
            console.error('Falha em ambos os parses:', err1, err2);
            const errorMsg = err2 instanceof Error ? err2.message : String(err2);
            throw new Error(`Erro de sintaxe no JSON: ${errorMsg}. Verifique aspas e quebras de linha.`);
        }
    }
    const cleanData = JSON.parse(JSON.stringify(data), (_key, value) => {
        if (typeof value === 'string') {
            let v = value.replace(/\\"/g, '"');
            v = v.replace(/\\'/g, "'");
            return v;
        }
        return value;
    });
    return cleanData;
}
function detectImportJsonFormat(input: unknown): { kind: ImportJsonFormatKind; label: string; description: string } | null {
    if (!input || typeof input !== 'object') {
        return null;
    }
    if (Array.isArray(input)) {
        return {
            kind: 'module',
            label: 'Lista de módulos',
            description: 'O JSON contém vários módulos para importar de uma vez.',
        };
    }
    const record = input as Record<string, unknown>;
    if ('modules' in record && Array.isArray(record.modules)) {
        return {
            kind: 'course',
            label: 'Curso completo',
            description: 'O JSON contém título, metadados e a lista de módulos do curso.',
        };
    }
    if (('questions' in record || 'case_studies' in record) && !('modules' in record)) {
        return {
            kind: 'assessment',
            label: 'Avaliação final',
            description: 'O JSON contém apenas a estrutura da avaliação final.',
        };
    }
    if ('lessons' in record || 'assessments' in record) {
        return {
            kind: 'module',
            label: 'Módulo único',
            description: 'O JSON contém um módulo isolado com aulas e, opcionalmente, avaliações.',
        };
    }
    return {
        kind: 'unknown',
        label: 'Formato não reconhecido',
        description: 'O JSON foi lido, mas não corresponde aos formatos esperados de curso, módulo ou avaliação.',
    };
}
const BuilderContext = createContext<BuilderContextData | undefined>(undefined);
export function useCourseBuilder() {
    const context = useContext(BuilderContext);
    if (!context) {
        throw new Error('useCourseBuilder must be used within AdminCourseBuilderLayout');
    }
    return context;
}
export function AdminCourseBuilderLayout() {
    const { courseId } = useParams<{
        courseId: string;
    }>();
    const navigate = useNavigate();
    const [courseTree, setCourseTree] = useState<AdminCourseTree | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // local toggle for sidebar (so users can collapse it if needed)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    // AI Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importFileName, setImportFileName] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [clearExisting, setClearExisting] = useState(false);
    const [moduleIdToReplace, setModuleIdToReplace] = useState<string | null>(null);
    const [isReplaceMode, setIsReplaceMode] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedModuleIdToExport, setSelectedModuleIdToExport] = useState<string>('');
    const [isExportingCourse, setIsExportingCourse] = useState(false);
    const [isExportingModule, setIsExportingModule] = useState(false);
    const [isExportingFinal, setIsExportingFinal] = useState(false);
    const [builderNotice, setBuilderNotice] = useState<BuilderNoticePayload | null>(null);
    const [isBuilderNoticeModalOpen, setIsBuilderNoticeModalOpen] = useState(false);
    const refreshTree = useCallback(async () => {
        if (!courseId)
            return;
        setIsLoading(true);
        setError(null);
        try {
            const tree = await fetchAdminCourseTree(courseId);
            setCourseTree(tree);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsLoading(false);
        }
    }, [courseId]);
    useEffect(() => {
        void refreshTree();
    }, [refreshTree]);
    useEffect(() => {
        if (!courseTree?.modules.length) {
            setSelectedModuleIdToExport('');
            return;
        }
        setSelectedModuleIdToExport((prev) => prev && courseTree.modules.some((m) => m.id === prev) ? prev : courseTree.modules[0].id);
    }, [courseTree]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const syncNotice = () => {
            const nextNotice = readBuilderNotice();
            setBuilderNotice(nextNotice);
            setIsBuilderNoticeModalOpen(Boolean(nextNotice));
        };
        syncNotice();
        window.addEventListener(BUILDER_NOTICE_EVENT, syncNotice as EventListener);
        return () => window.removeEventListener(BUILDER_NOTICE_EVENT, syncNotice as EventListener);
    }, []);
    async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!file.name.toLowerCase().endsWith('.json')) {
            setImportError('Selecione um arquivo .json válido.');
            event.target.value = '';
            return;
        }
        try {
            const fileContent = await file.text();
            setImportJson(fileContent);
            setImportFileName(file.name);
            setImportError(null);
        }
        catch (error) {
            console.error('Falha ao ler arquivo JSON:', error);
            setImportError('Não foi possível ler o arquivo JSON selecionado.');
        }
        finally {
            event.target.value = '';
        }
    }
    function closeImportModal() {
        setIsImportModalOpen(false);
        setImportFileName(null);
    }
    async function handleImport() {
        if (!courseId)
            return;
        setIsImporting(true);
        setImportError(null);
        try {
            // 1. Extração robusta do JSON de blocos de código Markdown
            const cleanData = parseImportJson(importJson);
            await importCourseContent(courseId, cleanData, clearExisting, moduleIdToReplace || undefined);
            await refreshTree();
            closeImportModal();
            setImportJson('');
            setClearExisting(false);
            setModuleIdToReplace(null);
            setIsReplaceMode(false);
        }
        catch (err: unknown) {
            console.error('Erro no import:', err);
            const errorMessage = err instanceof Error
                ? err.message
                : (typeof err === 'string' ? err : 'Erro inesperado na importacao.');
            setImportError(errorMessage);
        }
        finally {
            setIsImporting(false);
        }
    }
    const importJsonPreview = (() => {
        if (!importJson.trim()) {
            return null;
        }
        try {
            return detectImportJsonFormat(parseImportJson(importJson));
        }
        catch {
            return null;
        }
    })();
    async function handleExportCourse() {
        if (!courseId || !courseTree)
            return;
        setIsExportingCourse(true);
        setError(null);
        try {
            const data = await exportFullCourseContent(courseId);
            downloadJsonFile(`curso_completo_${courseTree.course.title}`, data);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsExportingCourse(false);
        }
    }
    async function handleExportModule() {
        if (!selectedModuleIdToExport || !courseTree)
            return;
        setIsExportingModule(true);
        setError(null);
        try {
            const module = courseTree.modules.find((m) => m.id === selectedModuleIdToExport);
            const data = await exportModuleContent(selectedModuleIdToExport);
            downloadJsonFile(`mdulo_${module?.title || 'curso'}`, data);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsExportingModule(false);
        }
    }
    async function handleExportFinalAssessment() {
        if (!courseId || !courseTree)
            return;
        setIsExportingFinal(true);
        setError(null);
        try {
            const data = await exportFinalAssessmentContent(courseId);
            downloadJsonFile(`avaliao_final_${courseTree.course.title}`, data);
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsExportingFinal(false);
        }
    }
    if (isLoading && !courseTree) {
        return (<div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"/>
      </div>);
    }
    if (error || !courseTree) {
        return (<div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800">Falha ao carregar o curso</h2>
        <p className="text-slate-500 mb-4">{error}</p>
        <Button onClick={() => navigate('/admin/cursos')}>Voltar aos Cursos</Button>
      </div>);
    }
    const { course, modules } = courseTree;
    // Nav paths
    // const coursePath = `/admin/cursos/${courseId}/builder`
    return (<BuilderContext.Provider value={{ courseTree, refreshTree, isLoading }}>
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
        
        {/* TOPBAR */}
         <header className="shrink-0 h-14 border-b border-slate-200 bg-white shadow-sm z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/cursos')} className="text-slate-500 hover:text-slate-900 -ml-2">
               <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
               Voltar
            </Button>
            <div className="h-5 border-l border-slate-200"></div>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <h1 className="text-sm font-bold text-slate-800 line-clamp-1 ml-1">{course.title}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${course.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {course.status === 'published' ? 'Publicado' : 'Rascunho'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="hidden md:flex h-8" asChild>
               <a href={`/aluno/cursos/${course.id}`} target="_blank" rel="noreferrer">
                 <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                 Visualizar
               </a>
            </Button>
          </div>
        </header>
        {/* WORKSPACE AREA */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* SIDEBAR - COURSE TREE */}
          <aside className={`shrink-0 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${isSidebarOpen ? 'w-[252px]' : 'w-0 overflow-hidden'}`}>
            {/* Componente de Árvore com Drag and Drop */}
            <CourseTreeDnd tree={courseTree} onRefresh={refreshTree}/>
            
            <div className="p-3 border-t border-slate-100">
               <div className="space-y-1">
                  <Link to={`/admin/cursos/${courseId}/builder/public-page`} className="group flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                     <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="3" strokeWidth={2}/></svg>Página Pública do Curso
                  </Link>
                  <Link to={`/admin/cursos/${courseId}/builder/settings`} className="group flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                     <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                     Configurações do Curso
                  </Link>
                  <Link to={`/admin/cursos/${courseId}/builder/releases`} className="group flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                     <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-4-4H11a4 4 0 00-4 4v2m10 0H7m10-10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                     Atribuir a Alunos e Grupos
                  </Link>
                  <Link to={`/admin/cursos/${courseId}/builder/assessments`} className="group flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                     <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                     Gerenciar Avaliações
                  </Link>

                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                     <button type="button" onClick={() => setIsExportModalOpen(true)} className="group w-full flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-colors text-slate-600 hover:bg-slate-100">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        Exportar Conteúdo
                     </button>

                     <Button variant="outline" size="sm" className="w-full text-[11px] font-black text-blue-600 border-blue-200 bg-blue-50/20 hover:bg-blue-600 hover:text-white transition-all h-10 gap-2 rounded-xl" onClick={() => setIsImportModalOpen(true)}>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        Importar Conteúdo (IA)
                     </Button>
                  </div>
               </div>
            </div>
          </aside>

          {/* IMPORT MODAL */}
          {isImportModalOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
               <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl border border-white/20 overflow-y-auto max-h-[95vh] no-scrollbar animate-in zoom-in-95 duration-300">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Importação em Massa (IA)</h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Cole o JSON gerado pela sua IA favorita abaixo.</p>
                     </div>
                     <button onClick={closeImportModal} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                  </div>

                  <div className="p-8 space-y-6">
                     <div className="space-y-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Código JSON Estruturado</span>
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-colors hover:bg-slate-100">
                          <div className="min-w-0">
                            <span className="block text-sm font-black text-slate-900">Anexar arquivo .json</span>
                            <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                              {importFileName ? `Arquivo selecionado: ${importFileName}` : 'Escolha um arquivo JSON para preencher o campo automaticamente.'}
                            </span>
                          </div>
                          <span className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-600 shadow-sm">
                            Selecionar arquivo
                          </span>
                          <input type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleImportFileChange(event)} />
                        </label>
                        <textarea className="w-full h-80 font-mono text-xs p-6 bg-slate-900 text-emerald-400 rounded-2xl border border-slate-800 focus:ring-4 focus:ring-blue-100 transition-all no-scrollbar" placeholder='[ { "title": "Módulo 1", "lessons": [...] } ]' value={importJson} onChange={e => setImportJson(e.target.value)}/>
                        {importJsonPreview && (<div className={`rounded-xl border px-4 py-3 text-xs font-semibold ${importJsonPreview.kind === 'course'
                ? 'border-blue-100 bg-blue-50 text-blue-700'
                : importJsonPreview.kind === 'assessment'
                    ? 'border-amber-100 bg-amber-50 text-amber-700'
                    : importJsonPreview.kind === 'module'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                           <span className="block font-black uppercase tracking-widest text-[10px] mb-1">Formato detectado</span>
                           <span className="block">{importJsonPreview.label}</span>
                           <span className="mt-1 block text-[11px] font-medium leading-relaxed opacity-90">{importJsonPreview.description}</span>
                        </div>)}
                     </div>

                     {importError && (<div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold animate-in slide-in-from-left-2 transition-all">
                           {importError}
                        </div>)}


                     {/* Toggle Mode */}
                     {!clearExisting && (<div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2">
                           <button onClick={() => { setIsReplaceMode(false); setModuleIdToReplace(null); }} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${!isReplaceMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{'Adicionar novos módulos'}
                           </button>
                           <button onClick={() => { setIsReplaceMode(true); }} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${isReplaceMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                              Substituir Módulo Existente
                           </button>
                        </div>)}

                     {isReplaceMode && !clearExisting && (<div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 text-rose-500">Selecione o Módulo a ser APAGADO e substituído</span>
                           <select className="w-full h-14 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none" value={moduleIdToReplace || ''} onChange={e => setModuleIdToReplace(e.target.value || null)}>
                              <option value="">Escolha um módulo...</option>
                              {modules.map((m, idx) => (<option key={m.id} value={m.id}>Módulo {idx + 1}: {m.title}</option>))}
                           </select>
                           <p className="text-[11px] text-slate-400 font-medium pl-1 italic">* Todo o conteúdo do módulo selecionado (aulas/quizzes) será deletado e o novo JSON será inserido no lugar.</p>
                        </div>)}

                     <label className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 cursor-pointer group hover:bg-amber-50 transition-colors">
                        <input type="checkbox" checked={clearExisting} onChange={e => {
                setClearExisting(e.target.checked);
                if (e.target.checked) {
                    setIsReplaceMode(false);
                    setModuleIdToReplace(null);
                }
            }} className="h-5 w-5 rounded-lg border-amber-200 text-amber-600 focus:ring-amber-500"/>
                        <div className="flex-1">
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-amber-900">Limpar TODO o curso primeiro</span>
                              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                           </div>
                           <p className="text-[11px] text-amber-600 font-bold mt-0.5">Apaga absolutamente todos os módulos atuais e recomeça o curso do zero.</p>
                        </div>
                     </label>
                  </div>

                  <div className="p-8 bg-slate-50/50 flex gap-4 border-t border-slate-100">
                     <Button variant="ghost" onClick={closeImportModal} className="flex-1 h-14 rounded-2xl font-bold text-slate-500">
                        Cancelar
                     </Button>
                     <Button onClick={handleImport} disabled={isImporting || !importJson.trim()} className="flex-[2] h-14 rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100">
                        {isImporting ? (<span className="flex items-center gap-2">
                              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Importando Módulos...
                           </span>) : 'Iniciar Importação'}
                     </Button>
                  </div>
               </div>
            </div>)}

          {/* EXPORT MODAL */}
          {isExportModalOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl border border-white/20 overflow-y-auto max-h-[95vh] no-scrollbar animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Exportar Conteúdo (JSON)</h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Baixe a estrutura do curso, módulo ou avaliação final.</p>
                  </div>
                  <button onClick={() => setIsExportModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                <div className="p-8 space-y-4">
                  <Button variant="outline" size="sm" className="w-full h-11 justify-start text-sm font-bold" onClick={() => void handleExportCourse()} disabled={isExportingCourse}>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    {isExportingCourse ? 'Exportando curso...' : 'Curso completo'}
                  </Button>

                  <div className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Módulo para exportação</label>
                    <select className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" value={selectedModuleIdToExport} onChange={(e) => setSelectedModuleIdToExport(e.target.value)} disabled={courseTree.modules.length === 0}>
                      {courseTree.modules.length === 0 ? (<option value="">Sem módulos</option>) : (courseTree.modules.map((m, idx) => (<option key={m.id} value={m.id}>Módulo {idx + 1}: {m.title}</option>)))}
                    </select>
                    <Button variant="outline" size="sm" className="w-full h-11 justify-start text-sm font-bold" onClick={() => void handleExportModule()} disabled={!selectedModuleIdToExport || isExportingModule}>
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      {isExportingModule ? 'Exportando módulo...' : 'Módulo selecionado'}
                    </Button>
                  </div>

                  <Button variant="outline" size="sm" className="w-full h-11 justify-start text-sm font-bold" onClick={() => void handleExportFinalAssessment()} disabled={isExportingFinal}>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    {isExportingFinal ? 'Exportando avaliação final...' : 'Avaliação final'}
                  </Button>
                </div>
              </div>
            </div>)}

          {/* MAIN CANVAS */}
          <main className="flex-1 h-full bg-slate-50/50 relative overflow-y-auto w-full border-t border-slate-100 shadow-inner">
             <div className="absolute inset-0 p-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
               <Outlet />
             </div>
          </main>
        </div>
        {builderNotice && isBuilderNoticeModalOpen && (<div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-2xl rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-8">
                <div>
                  <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${builderNotice.type === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : builderNotice.type === 'error'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'}`}>
                    {builderNotice.type === 'success' ? 'Concluído' : builderNotice.type === 'error' ? 'Erro' : 'Processando'}
                  </div>
                  <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{builderNotice.title}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium',
            }).format(new Date(builderNotice.createdAt))}
                  </p>
                </div>
                <button type="button" onClick={() => {
                setIsBuilderNoticeModalOpen(false);
                if (builderNotice.type !== 'pending') {
                    clearBuilderNotice();
                    setBuilderNotice(null);
                }
            }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="space-y-5 p-8">
                <div className={`rounded-2xl border p-5 ${builderNotice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : builderNotice.type === 'error'
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-amber-200 bg-amber-50'}`}>
                  <p className={`text-sm font-semibold ${builderNotice.type === 'success'
                ? 'text-emerald-800'
                : builderNotice.type === 'error'
                    ? 'text-rose-800'
                    : 'text-amber-800'}`}>
                    {builderNotice.message}
                  </p>
                </div>
                {builderNotice.details && builderNotice.details.length > 0 && (<div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Resumo do processamento</p>
                    <div className="mt-4 space-y-2">
                      {builderNotice.details.map((detail, index) => (<div key={`${builderNotice.createdAt}-${index}`} className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
                          {detail}
                        </div>))}
                    </div>
                  </div>)}
              </div>
              <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 p-8">
                <Button type="button" className={`h-12 rounded-2xl px-8 font-black shadow-xl ${builderNotice.type === 'pending'
                ? 'bg-amber-500 shadow-amber-100 hover:bg-amber-600'
                : 'bg-blue-600 shadow-blue-100 hover:bg-blue-700'}`} onClick={() => {
                setIsBuilderNoticeModalOpen(false);
                if (builderNotice.type !== 'pending') {
                    clearBuilderNotice();
                    setBuilderNotice(null);
                }
            }}>
                  {builderNotice.type === 'pending' ? 'Continuar acompanhando' : 'Fechar'}
                </Button>
              </div>
            </div>
          </div>)}
        <div className="pointer-events-none absolute bottom-4 right-6">
          <AppVersion className="text-[10px] font-black uppercase tracking-widest text-slate-400"/>
        </div>
      </div>
    </BuilderContext.Provider>);
}
