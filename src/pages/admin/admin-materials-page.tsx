import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { deleteMaterial, fetchLesson, fetchMaterials, fetchModule, getSignedMaterialUrl, toErrorMessage, uploadMaterial, } from '@/features/admin/content/api';
import type { CourseModule, Lesson, LessonMaterial } from '@/types/content';
function formatBytes(value: number): string {
    if (value === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const normalized = value / 1024 ** unitIndex;
    return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
export function AdminMaterialsPage() {
    const { lessonId } = useParams<{
        lessonId: string;
    }>();
    const { user } = useAuth();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [module, setModule] = useState<CourseModule | null>(null);
    const [materials, setMaterials] = useState<LessonMaterial[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const headerTitle = useMemo(() => {
        if (!lesson) {
            return 'Materiais complementares';
        }
        return `Materiais da aula "${lesson.title}"`;
    }, [lesson]);
    const loadData = useCallback(async () => {
        if (!lessonId) {
            setError('Aula invalida.');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const lessonResult = await fetchLesson(lessonId);
            setLesson(lessonResult);
            if (lessonResult?.module_id) {
                const moduleResult = await fetchModule(lessonResult.module_id);
                setModule(moduleResult);
            }
            else {
                setModule(null);
            }
            const materialsResult = await fetchMaterials(lessonId);
            setMaterials(materialsResult);
        }
        catch (loadError) {
            setError(toErrorMessage(loadError));
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
        if (!file || !lessonId || !user) {
            return;
        }
        setError(null);
        setIsUploading(true);
        try {
            await uploadMaterial(lessonId, file, user.id);
            await loadData();
        }
        catch (uploadError) {
            setError(toErrorMessage(uploadError));
        }
        finally {
            setIsUploading(false);
            event.target.value = '';
        }
    }
    async function handleDelete(material: LessonMaterial) {
        const confirmed = window.confirm(`Excluir o material "${material.file_name}"`);
        if (!confirmed) {
            return;
        }
        setError(null);
        try {
            await deleteMaterial(material);
            await loadData();
        }
        catch (deleteError) {
            setError(toErrorMessage(deleteError));
        }
    }
    async function handleOpen(material: LessonMaterial) {
        try {
            const signedUrl = await getSignedMaterialUrl(material.storage_path);
            window.open(signedUrl, '_blank', 'noopener,noreferrer');
        }
        catch (openError) {
            setError(toErrorMessage(openError));
        }
    }
    return (<div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link className="underline" to="/admin/cursos">
            Cursos
          </Link>
          {module ? (<>
              <span>/</span>
              <Link className="underline" to={`/admin/cursos/${module.course_id}/modulos`}>Mdulos
              </Link>
              <span>/</span>
              <Link className="underline" to={`/admin/modulos/${module.id}/aulas`}>
                Aulas
              </Link>
            </>) : null}
          <span>/</span>
          <span>Materiais</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{headerTitle}</h2>
      </div>

      <div className="rounded-lg border bg-slate-50 p-4">
        <label className="space-y-1">
          <span className="block text-sm text-slate-700">
            Upload de material complementar
          </span>
          <input className="w-full rounded-md border bg-white px-3 py-2 text-sm" type="file" onChange={(event) => void handleUpload(event)} disabled={isUploading}/>
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Tipos permitidos: PDF, Office, imagens, texto e ZIP (max 50MB).
        </p>
      </div>

      {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {isUploading ? <p className="text-sm text-slate-600">Enviando arquivo...</p> : null}

      <div className="grid gap-3">
        {materials.map((material) => (<article key={material.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900">{material.file_name}</h3>
                <p className="text-sm text-slate-600">
                  {material.mime_type ?? 'tipo desconhecido'} |{' '}
                  {formatBytes(material.file_size_bytes)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void handleOpen(material)}>
                  Abrir
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleDelete(material)}>
                  Excluir
                </Button>
              </div>
            </div>
          </article>))}

        {!isLoading && materials.length === 0 ? (<p className="text-sm text-slate-600">Nenhum material enviado.</p>) : null}
      </div>
    </div>);
}
