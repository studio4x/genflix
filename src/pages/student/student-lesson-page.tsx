import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { splitContent } from '@/features/admin/content/content-blocks'
import { ContentBlocksRenderer } from '@/features/admin/content/content-blocks-renderer'
import { fetchMaterials, getSignedMaterialUrl } from '@/features/admin/content/api'
import type { StudentCourseAssessmentSummary } from '@/features/student/assessments/api'
import { exportModuleToPdf } from '@/features/student/content/pdf-exporter'
import { LessonAudioPlayer } from '@/features/student/lesson-audio/lesson-audio-player'
import {
  fetchStudentCourseContentWithProgress,
  setLessonCompletion,
  toErrorMessage,
} from '@/features/student/courses/api'
import { supabase } from '@/services/supabase/client'
import type {
  Lesson,
  LessonMaterial,
  StudentCourseModuleProgress,
  StudentLessonWithProgress,
} from '@/types/content'
import 'react-quill/dist/quill.snow.css'

function formatBytes(value: number): string {
  if (value === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const normalized = value / 1024 ** unitIndex
  return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function extractVideoId(url: string | null) {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export function StudentLessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { course, modules, assessments, setModules } = useOutletContext<{
    course: { title: string }
    modules: StudentCourseModuleProgress[]
    assessments: StudentCourseAssessmentSummary[]
    setModules: (modules: StudentCourseModuleProgress[]) => void
  }>()

  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false)
  const [activeLessonDetails, setActiveLessonDetails] = useState<Lesson | null>(null)
  const [materials, setMaterials] = useState<LessonMaterial[]>([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  useEffect(() => {
    async function loadActiveLesson() {
      if (!lessonId) return

      try {
        const [{ data, error }, materialsResult] = await Promise.all([
          supabase
            .from('lessons')
            .select('*')
            .eq('id', lessonId)
            .single(),
          fetchMaterials(lessonId),
        ])

        if (!error && data) {
          setActiveLessonDetails(data)
        }

        setMaterials(materialsResult)
      } catch (err) {
        console.error('Erro ao buscar detalhes da aula:', err)
      }
    }

    void loadActiveLesson()
    window.scrollTo(0, 0)
  }, [lessonId])

  let currentLesson: StudentLessonWithProgress | null = null

  const timeline: {
    moduleId: string
    lessonId?: string
    assessmentId?: string
    type: 'lesson' | 'quiz'
    isBlocked: boolean
    title: string
    is_completed: boolean
  }[] = []

  for (const module of modules) {
    for (const lesson of module.lessons) {
      timeline.push({
        moduleId: module.id,
        lessonId: lesson.id,
        type: 'lesson',
        isBlocked: module.state === 'blocked',
        title: lesson.title,
        is_completed: lesson.is_completed,
      })

      if (lesson.id === lessonId) {
        currentLesson = lesson
      }
    }
  }

  const currentIndex = timeline.findIndex((item) => item.lessonId === lessonId)
  const prevItem = currentIndex > 0 ? timeline[currentIndex - 1] : null
  const nextItem = currentIndex < timeline.length - 1 ? timeline[currentIndex + 1] : null
  const currentModule = currentLesson
    ? modules.find((module) => module.id === currentLesson.module_id) ?? null
    : null
  const isLastLessonOfModule = Boolean(
    currentModule &&
    currentModule.lessons[currentModule.lessons.length - 1]?.id === currentLesson?.id,
  )
  const nextModuleQuiz = currentModule
    ? assessments.find((assessment) => assessment.assessment_type === 'module' && assessment.module_id === currentModule.id) ?? null
    : null

  const nextAction = isLastLessonOfModule && nextModuleQuiz
    ? {
        label: 'Ir para o Quiz do Módulo',
        disabled: false,
        onClick: () => navigate(`/aluno/cursos/${courseId}/player/avaliacoes/${nextModuleQuiz.assessment_id}`),
      }
    : {
        label: 'Próxima Aula',
        disabled: !nextItem || nextItem.isBlocked,
        onClick: () => navigate(`/aluno/cursos/${courseId}/player/aulas/${nextItem!.lessonId}`),
      }

  if (!currentLesson) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[32px] bg-slate-100 text-slate-400">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900">Aula não encontrada</h2>
        <p className="mt-2 text-slate-500">O conteúdo solicitado pode ter sido movido ou excluído.</p>
        <Button onClick={() => navigate(`/aluno/cursos/${courseId}`)} className="mt-8 rounded-2xl">
          Voltar ao curso
        </Button>
      </div>
    )
  }

  const videoUrl = activeLessonDetails?.youtube_url || currentLesson.youtube_url
  const textContent = activeLessonDetails?.text_content || currentLesson.text_content
  const lessonType = activeLessonDetails?.lesson_type || currentLesson.lesson_type
  const videoId = extractVideoId(videoUrl)

  async function handleToggleCompletion() {
    if (!user || !currentLesson) return

    setIsTogglingCompletion(true)
    try {
      await setLessonCompletion({
        user_id: user.id,
        lesson_id: currentLesson.id,
        is_completed: !currentLesson.is_completed,
      })

      const refreshedModules = await fetchStudentCourseContentWithProgress(courseId!)
      setModules(refreshedModules)
    } catch (err) {
      alert(toErrorMessage(err))
    } finally {
      setIsTogglingCompletion(false)
    }
  }

  async function handleOpenMaterial(material: LessonMaterial) {
    setIsLoadingMaterials(true)
    try {
      const signedUrl = await getSignedMaterialUrl(material.storage_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      alert(toErrorMessage(err))
    } finally {
      setIsLoadingMaterials(false)
    }
  }

  async function handleDownloadModulePdf() {
    if (!currentModule) return

    setIsGeneratingPdf(true)
    try {
      await exportModuleToPdf(course.title, currentModule.title, currentModule.id)
    } catch (err) {
      alert(toErrorMessage(err))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] animate-in fade-in space-y-8 p-4 pb-32 duration-500 sm:p-8">
      <div className="space-y-4 border-b border-slate-100 pb-8 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
              Aula Atual
            </span>
            {lessonType === 'hybrid' && (
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Vídeo + Texto
              </span>
            )}
          </div>

          {currentModule ? (
            <Button
              type="button"
              variant="outline"
              disabled={isGeneratingPdf}
              onClick={() => void handleDownloadModulePdf()}
              className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900"
            >
              {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF do Módulo'}
            </Button>
          ) : null}
        </div>

        <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
          {currentLesson.title}
        </h1>

        {(activeLessonDetails?.description || currentLesson.description) && (
          <div className="max-w-5xl text-lg font-medium leading-relaxed text-slate-500">
            {activeLessonDetails?.description || currentLesson.description}
          </div>
        )}
      </div>

      {(lessonType === 'video' || lessonType === 'hybrid') && videoId && (
        <div className="aspect-video w-full animate-in zoom-in-95 overflow-hidden rounded-[32px] bg-black shadow-2xl ring-1 ring-slate-900/10 duration-500">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {(lessonType === 'text' || lessonType === 'hybrid') && textContent && (
        <div className="space-y-6">
          <LessonAudioPlayer lessonId={currentLesson.id} />

          <div className="w-full animate-in slide-in-from-bottom-4 overflow-hidden rounded-[40px] border border-slate-100 bg-white shadow-sm duration-700">
            <div className="p-8 sm:p-12 xl:p-16">
              <ContentBlocksRenderer
                blocks={splitContent(textContent)}
                className="lesson-content-html min-h-[100px]"
              />
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
              Materiais de Apoio
            </span>
            <span className="text-xs font-medium text-slate-500">
              Arquivos complementares desta aula
            </span>
          </div>
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          {materials.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-500">
                Nenhum material de apoio vinculado a esta aula.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {materials.map((material) => (
                <article
                  key={material.id}
                  className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{material.file_name}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {material.mime_type?.split('/')[1] || 'FILE'} • {formatBytes(material.file_size_bytes)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoadingMaterials}
                    onClick={() => void handleOpenMaterial(material)}
                    className="rounded-xl border-slate-200 bg-white font-bold"
                  >
                    {isLoadingMaterials ? 'Abrindo...' : 'Abrir Material'}
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-4 z-20 mt-12 flex flex-col items-center justify-between gap-4 rounded-[32px] border-t border-slate-200 bg-white/80 p-6 pt-8 shadow-xl shadow-slate-200/50 backdrop-blur-md sm:flex-row">
        <button
          disabled={isTogglingCompletion}
          onClick={handleToggleCompletion}
          className={`flex items-center gap-2 rounded-xl px-6 py-3 font-bold transition-all ${
            currentLesson.is_completed
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
              : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700'
          }`}
        >
          {isTogglingCompletion ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : currentLesson.is_completed ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {currentLesson.is_completed ? 'Aula Concluída' : 'Marcar como Concluída'}
        </button>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <Button
            variant="outline"
            disabled={!prevItem || prevItem.isBlocked}
            onClick={() => navigate(`/aluno/cursos/${courseId}/player/aulas/${prevItem!.lessonId}`)}
            className="h-12 flex-1 rounded-xl sm:flex-none"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </Button>
          <Button
            className="h-12 flex-1 rounded-xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800 sm:flex-none"
            disabled={nextAction.disabled}
            onClick={nextAction.onClick}
          >
            {nextAction.label}
            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}
