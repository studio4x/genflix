import { supabase } from '@/services/supabase/client'
import type {
  Course,
  ModuleLearningState,
  StudentCourseModuleProgress,
  StudentLessonWithProgress,
} from '@/types/content'

import {
  lessonCompletionInputSchema,
  type LessonCompletionInput,
} from './schemas'

interface StudentModuleProgressRpcRow {
  module_id: string
  module_position: number
  title: string
  description: string | null
  is_required: boolean
  state: ModuleLearningState
  is_unlocked: boolean
  is_completed: boolean
  required_lessons_total: number
  required_lessons_completed: number
  has_required_assessment: boolean
  required_assessment_approved: boolean
  progress_percent: number
}

interface StudentLessonProgressRpcRow {
  lesson_id: string
  module_id: string
  module_position: number
  lesson_position: number
  title: string
  description: string | null
  is_required: boolean
  lesson_type: 'video' | 'text'
  youtube_url: string | null
  text_content: string | null
  estimated_minutes: number
  is_completed: boolean
  completed_at: string | null
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error('Erro inesperado.')
}

export function toErrorMessage(error: unknown): string {
  return toError(error).message
}

export async function fetchReleasedCourses(): Promise<Course[]> {
  const result = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }
  return (result.data as Course[]) ?? []
}

export async function fetchReleasedCourseById(
  courseId: string,
): Promise<Course | null> {
  const result = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }
  return (result.data as Course | null) ?? null
}

export async function fetchStudentCourseContentWithProgress(
  courseId: string,
): Promise<StudentCourseModuleProgress[]> {
  const [modulesResult, lessonsResult] = await Promise.all([
    supabase.rpc('get_student_course_modules_progress', { _course_id: courseId }),
    supabase.rpc('get_student_unlocked_lessons_progress', { _course_id: courseId }),
  ])

  if (modulesResult.error) {
    throw modulesResult.error
  }

  if (lessonsResult.error) {
    throw lessonsResult.error
  }

  const modules = (modulesResult.data as StudentModuleProgressRpcRow[]) ?? []
  const lessons = (lessonsResult.data as StudentLessonProgressRpcRow[]) ?? []

  const lessonMap = new Map<string, StudentLessonWithProgress[]>()
  for (const lesson of lessons) {
    const current = lessonMap.get(lesson.module_id) ?? []
    current.push({
      id: lesson.lesson_id,
      module_id: lesson.module_id,
      position: lesson.lesson_position,
      title: lesson.title,
      description: lesson.description,
      is_required: lesson.is_required,
      lesson_type: lesson.lesson_type,
      youtube_url: lesson.youtube_url,
      text_content: lesson.text_content,
      estimated_minutes: lesson.estimated_minutes,
      is_completed: lesson.is_completed,
      completed_at: lesson.completed_at,
    })
    lessonMap.set(lesson.module_id, current)
  }

  return modules.map((module) => ({
    id: module.module_id,
    course_id: courseId,
    position: module.module_position,
    title: module.title,
    description: module.description,
    is_required: module.is_required,
    state: module.state,
    is_unlocked: module.is_unlocked,
    is_completed: module.is_completed,
    required_lessons_total: module.required_lessons_total,
    required_lessons_completed: module.required_lessons_completed,
    has_required_assessment: module.has_required_assessment,
    required_assessment_approved: module.required_assessment_approved,
    progress_percent: module.progress_percent,
    lessons: lessonMap.get(module.module_id) ?? [],
  }))
}

export async function setLessonCompletion(payload: LessonCompletionInput) {
  const parsed = lessonCompletionInputSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
  }

  const result = await supabase
    .from('lesson_progress')
    .upsert(
      {
        user_id: parsed.data.user_id,
        lesson_id: parsed.data.lesson_id,
        is_completed: parsed.data.is_completed,
      },
      { onConflict: 'user_id,lesson_id' },
    )

  if (result.error) {
    throw result.error
  }
}
