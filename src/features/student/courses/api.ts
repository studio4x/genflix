import { supabase } from '@/services/supabase/client'
import type { Course, CourseModule, Lesson } from '@/types/content'

export interface CourseModuleWithLessons extends CourseModule {
  lessons: Lesson[]
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

export async function fetchReleasedCourseContent(
  courseId: string,
): Promise<CourseModuleWithLessons[]> {
  const modulesResult = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true })

  if (modulesResult.error) {
    throw modulesResult.error
  }

  const modules = (modulesResult.data as CourseModule[]) ?? []
  if (modules.length === 0) {
    return []
  }

  const moduleIds = modules.map((module) => module.id)
  const lessonsResult = await supabase
    .from('lessons')
    .select('*')
    .in('module_id', moduleIds)
    .order('position', { ascending: true })

  if (lessonsResult.error) {
    throw lessonsResult.error
  }

  const lessons = (lessonsResult.data as Lesson[]) ?? []
  const lessonMap = new Map<string, Lesson[]>()

  for (const lesson of lessons) {
    const current = lessonMap.get(lesson.module_id) ?? []
    current.push(lesson)
    lessonMap.set(lesson.module_id, current)
  }

  return modules.map((module) => ({
    ...module,
    lessons: lessonMap.get(module.id) ?? [],
  }))
}
