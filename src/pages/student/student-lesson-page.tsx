import { useEffect, useState } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import 'react-quill/dist/quill.snow.css'
import {
  fetchStudentCourseContentWithProgress,
  setLessonCompletion,
  toErrorMessage,
} from '@/features/student/courses/api'
import type { StudentCourseModuleProgress, StudentLessonWithProgress } from '@/types/content'
import { splitContent } from '@/features/admin/content/content-blocks'
import { ContentBlocksRenderer } from '@/features/admin/content/content-blocks-renderer'

export function StudentLessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const { modules, setModules } = useOutletContext<{ modules: StudentCourseModuleProgress[], setModules: (m: any) => void }>()
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false)
  const [activeLessonDetails, setActiveLessonDetails] = useState<any>(null)

  useEffect(() => {
    async function loadActiveLesson() {
      if (!lessonId) return
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single()
        
        if (!error && data) {
          setActiveLessonDetails(data)
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes da aula:', err)
      }
    }
    void loadActiveLesson()
    window.scrollTo(0, 0)
  }, [lessonId])

  // Find the exact lesson details
  let currentLesson: StudentLessonWithProgress | null = null
  
  // Flatten timeline to find prev/next (including quizzes would be nice)
  const timeline: { moduleId: string; lessonId?: string; assessmentId?: string; type: 'lesson' | 'quiz', isBlocked: boolean; title: string, is_completed: boolean }[] = []
  
  for (const m of modules) {
    for (const l of m.lessons) {
      timeline.push({
        moduleId: m.id,
        lessonId: l.id,
        type: 'lesson',
        isBlocked: m.state === 'blocked',
        title: l.title,
        is_completed: l.is_completed
      })
      if (l.id === lessonId) {
        currentLesson = l
      }
    }
    // Also add module quiz to timeline if it exists
    // (Optional logic, let's keep it simple for now)
  }

  const currentIndex = timeline.findIndex(item => item.lessonId === lessonId)
  const prevItem = currentIndex > 0 ? timeline[currentIndex - 1] : null
  const nextItem = currentIndex < timeline.length - 1 ? timeline[currentIndex + 1] : null

  if (!currentLesson) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
         <div className="h-20 w-20 rounded-[32px] bg-slate-100 flex items-center justify-center text-slate-400 mb-6">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </div>
         <h2 className="text-xl font-black text-slate-900">Aula não encontrada</h2>
         <p className="text-slate-500 mt-2">O conteúdo solicitado pode ter sido movido ou excluído.</p>
         <Button onClick={() => navigate(`/aluno/cursos/${courseId}`)} className="mt-8 rounded-2xl">Voltar ao curso</Button>
      </div>
    )
  }

  const videoUrl = activeLessonDetails?.youtube_url || currentLesson.youtube_url
  const textContent = activeLessonDetails?.text_content || currentLesson.text_content
  const lessonType = activeLessonDetails?.lesson_type || currentLesson.lesson_type
  
  const extractVideoId = (url: string | null) => {
    if (!url) return null
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }
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

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 pb-32">
        {/* TITLE AREA TOP */}
        <div className="space-y-4 pt-4 border-b border-slate-100 pb-8">
            <div className="flex items-center gap-3 mb-2">
            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                Aula Atual
            </span>
            {lessonType === 'hybrid' && (
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    Vídeo + Texto
                </span>
            )}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">{currentLesson.title}</h1>
            {(activeLessonDetails?.description || currentLesson.description) && (
            <div className="text-lg font-medium text-slate-500 leading-relaxed max-w-3xl">
                {activeLessonDetails?.description || currentLesson.description}
            </div>
            )}
        </div>

        {/* VIDEO PLAYER AREA */}
        {((lessonType === 'video' || lessonType === 'hybrid') && videoId) && (
            <div className="w-full aspect-video rounded-[32px] overflow-hidden bg-black shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-500">
            <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
            </div>
        )}

        {/* TEXT CONTENT AREA */}
        {(lessonType === 'text' || lessonType === 'hybrid') && textContent && (
            <div className="w-full bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                <div className="p-8 sm:p-12">
                <ContentBlocksRenderer 
                    blocks={splitContent(textContent)} 
                    className="lesson-content-html min-h-[100px]"
                />
                </div>
            </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200 mt-12 bg-white/80 backdrop-blur-md p-6 rounded-[32px] sticky bottom-4 z-20 shadow-xl shadow-slate-200/50">
            <button
            disabled={isTogglingCompletion}
            onClick={handleToggleCompletion}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                currentLesson.is_completed 
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100'
            }`}
            >
            {isTogglingCompletion ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : currentLesson.is_completed ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
                <svg className="h-5 w-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            {currentLesson.is_completed ? 'Aula Concluída' : 'Marcar como Concluída'}
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
                variant="outline"
                disabled={!prevItem || prevItem.isBlocked}
                onClick={() => navigate(`/aluno/cursos/${courseId}/player/aulas/${prevItem!.lessonId}`)}
                className="flex-1 sm:flex-none h-12 rounded-xl"
            >
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Anterior
            </Button>
            <Button
                className="flex-1 sm:flex-none h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-base shadow-sm"
                disabled={!nextItem || nextItem.isBlocked}
                onClick={() => navigate(`/aluno/cursos/${courseId}/player/aulas/${nextItem!.lessonId}`)}
            >
                Próxima Aula
                <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Button>
            </div>
        </div>
    </div>
  )
}
