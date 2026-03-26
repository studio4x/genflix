import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  deleteMaterial,
  fetchMaterials,
  getSignedMaterialUrl,
  toErrorMessage,
  uploadMaterial,
} from '@/features/admin/content/api'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import type { Lesson, LessonMaterial } from '@/types/content'

function formatBytes(value: number): string {
  if (value === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const normalized = value / 1024 ** unitIndex
  return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function LessonMaterialsPanel() {
  const { courseId, moduleId, lessonId } = useParams<{ courseId: string; moduleId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { courseTree } = useCourseBuilder()
  const uploadInputId = lessonId ? `lesson-material-upload-${lessonId}` : 'lesson-material-upload'

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [materials, setMaterials] = useState<LessonMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (courseTree && lessonId) {
      for (const m of courseTree.modules) {
        const found = m.lessons.find((l) => l.id === lessonId)
        if (found) {
          setLesson(found)
          break
        }
      }
    }
  }, [courseTree, lessonId])

  const loadMaterials = useCallback(async () => {
    if (!lessonId) return
    setIsLoading(true)
    try {
      const result = await fetchMaterials(lessonId)
      setMaterials(result)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !lessonId || !user) return

    setError(null)
    setIsUploading(true)

    try {
      await uploadMaterial(lessonId, file, user.id)
      await loadMaterials()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function handleDelete(material: LessonMaterial) {
    if (!window.confirm(`Excluir o material "${material.file_name}"?`)) return
    try {
      await deleteMaterial(material)
      await loadMaterials()
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  async function handleOpen(material: LessonMaterial) {
    try {
      const signedUrl = await getSignedMaterialUrl(material.storage_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <button 
               onClick={() => navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${lessonId}`)}
               className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1"
             >
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
               Voltar para Aula
             </button>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Materiais de Apoio
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie arquivos complementares para a aula: <span className="font-bold text-slate-700">{lesson?.title}</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8 space-y-8">
        <label
          htmlFor={uploadInputId}
          className={`block bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-4 ${isUploading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
        >
            <div className="p-3 bg-white rounded-full w-fit mx-auto shadow-sm border border-slate-100">
               <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <div>
               <p className="text-sm font-bold text-slate-900">Upload de Novo Material</p>
               <p className="text-xs text-slate-500 mt-1">Clique para selecionar ou arraste arquivos (PDF, ZIP, etc) até 50MB.</p>
            </div>
            <input
              id={uploadInputId}
              type="file"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
              title=""
            />
            <span className={`inline-flex rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white ${isUploading ? 'opacity-80' : 'hover:bg-blue-700'}`}>
              {isUploading ? 'Enviando...' : 'Selecionar Arquivo'}
            </span>
        </label>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600 flex items-start gap-2">
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
          </div>
        )}

        <div className="space-y-4">
           <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Arquivos Anexados</h3>
           
           {isLoading ? (
             <div className="space-y-3">
               {[1, 2].map(i => <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />)}
             </div>
           ) : materials.length === 0 ? (
             <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
                <svg className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-sm text-slate-400">Nenhum material de apoio vinculado a esta aula.</p>
             </div>
           ) : (
             <div className="grid gap-4">
               {materials.map((material) => (
                 <article key={material.id} className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                          <svg className="h-6 w-6 text-slate-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                       </div>
                       <div>
                          <p className="font-bold text-slate-900 leading-tight">{material.file_name}</p>
                          <p className="text-[11px] text-slate-500 font-medium uppercase mt-1">
                            {material.mime_type?.split('/')[1] || 'FILE'} • {formatBytes(material.file_size_bytes)}
                          </p>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => void handleOpen(material)}
                         className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-bold"
                       >
                         Visualizar
                       </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => void handleDelete(material)}
                         className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 h-9 w-9"
                       >
                         <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h5" /></svg>
                       </Button>
                    </div>
                 </article>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
