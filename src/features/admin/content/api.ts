import { supabase } from '@/services/supabase/client'
import type {
  Course,
  CourseModule,
  Lesson,
  LessonMaterial,
} from '@/types/content'

import type {
  CourseFormInput,
  LessonFormInput,
  ModuleFormInput,
} from './schemas'

const MATERIALS_BUCKET = 'materials'

function normalizeSupabaseError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error('Erro inesperado.')
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function swapPositions(
  table: 'course_modules' | 'lessons',
  firstId: string,
  firstPosition: number,
  secondId: string,
  secondPosition: number,
) {
  const temporaryPosition = Math.max(firstPosition, secondPosition) + 1000000

  const firstTempUpdate = await supabase
    .from(table)
    .update({ position: temporaryPosition })
    .eq('id', firstId)
  if (firstTempUpdate.error) {
    throw firstTempUpdate.error
  }

  const secondUpdate = await supabase
    .from(table)
    .update({ position: firstPosition })
    .eq('id', secondId)
  if (secondUpdate.error) {
    throw secondUpdate.error
  }

  const firstFinalUpdate = await supabase
    .from(table)
    .update({ position: secondPosition })
    .eq('id', firstId)
  if (firstFinalUpdate.error) {
    throw firstFinalUpdate.error
  }
}

export async function fetchCourses(): Promise<Course[]> {
  const result = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })
  if (result.error) {
    throw result.error
  }
  return (result.data as Course[]) ?? []
}

export async function createCourse(input: CourseFormInput, userId: string) {
  const result = await supabase
    .from('courses')
    .insert({
      title: input.title,
      description: input.description?.trim() || null,
      status: input.status,
      workload_hours: input.workload_hours,
      created_by: userId,
    })
    .select('*')
    .single()
  if (result.error) {
    throw result.error
  }
  return result.data as Course
}

export async function updateCourse(courseId: string, input: CourseFormInput) {
  const result = await supabase
    .from('courses')
    .update({
      title: input.title,
      description: input.description?.trim() || null,
      status: input.status,
      workload_hours: input.workload_hours,
    })
    .eq('id', courseId)
    .select('*')
    .single()
  if (result.error) {
    throw result.error
  }
  return result.data as Course
}

export async function deleteCourse(courseId: string) {
  const result = await supabase.from('courses').delete().eq('id', courseId)
  if (result.error) {
    throw result.error
  }
}

export async function fetchCourse(courseId: string): Promise<Course | null> {
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

export async function fetchModules(courseId: string): Promise<CourseModule[]> {
  const result = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true })
  if (result.error) {
    throw result.error
  }
  return (result.data as CourseModule[]) ?? []
}

export async function createModule(courseId: string, input: ModuleFormInput) {
  const positionResult = await supabase
    .from('course_modules')
    .select('position')
    .eq('course_id', courseId)
    .order('position', { ascending: false })
    .limit(1)

  if (positionResult.error) {
    throw positionResult.error
  }

  const nextPosition = (positionResult.data?.[0]?.position ?? 0) + 1

  const result = await supabase
    .from('course_modules')
    .insert({
      course_id: courseId,
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
      position: nextPosition,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as CourseModule
}

export async function updateModule(moduleId: string, input: ModuleFormInput) {
  const result = await supabase
    .from('course_modules')
    .update({
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
    })
    .eq('id', moduleId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as CourseModule
}

export async function deleteModule(moduleId: string) {
  const result = await supabase.from('course_modules').delete().eq('id', moduleId)
  if (result.error) {
    throw result.error
  }
}

export async function moveModule(
  module: CourseModule,
  targetModule: CourseModule,
) {
  await swapPositions(
    'course_modules',
    module.id,
    module.position,
    targetModule.id,
    targetModule.position,
  )
}

export async function fetchModule(moduleId: string): Promise<CourseModule | null> {
  const result = await supabase
    .from('course_modules')
    .select('*')
    .eq('id', moduleId)
    .maybeSingle()
  if (result.error) {
    throw result.error
  }
  return (result.data as CourseModule | null) ?? null
}

export async function fetchLessons(moduleId: string): Promise<Lesson[]> {
  const result = await supabase
    .from('lessons')
    .select('*')
    .eq('module_id', moduleId)
    .order('position', { ascending: true })
  if (result.error) {
    throw result.error
  }
  return (result.data as Lesson[]) ?? []
}

export async function createLesson(moduleId: string, input: LessonFormInput) {
  const positionResult = await supabase
    .from('lessons')
    .select('position')
    .eq('module_id', moduleId)
    .order('position', { ascending: false })
    .limit(1)

  if (positionResult.error) {
    throw positionResult.error
  }

  const nextPosition = (positionResult.data?.[0]?.position ?? 0) + 1

  const result = await supabase
    .from('lessons')
    .insert({
      module_id: moduleId,
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
      lesson_type: 'video',
      youtube_url: input.youtube_url?.trim() || null,
      estimated_minutes: input.estimated_minutes,
      position: nextPosition,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as Lesson
}

export async function updateLesson(lessonId: string, input: LessonFormInput) {
  const result = await supabase
    .from('lessons')
    .update({
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
      youtube_url: input.youtube_url?.trim() || null,
      estimated_minutes: input.estimated_minutes,
    })
    .eq('id', lessonId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as Lesson
}

export async function deleteLesson(lessonId: string) {
  const result = await supabase.from('lessons').delete().eq('id', lessonId)
  if (result.error) {
    throw result.error
  }
}

export async function moveLesson(lesson: Lesson, targetLesson: Lesson) {
  await swapPositions(
    'lessons',
    lesson.id,
    lesson.position,
    targetLesson.id,
    targetLesson.position,
  )
}

export async function fetchLesson(lessonId: string): Promise<Lesson | null> {
  const result = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle()
  if (result.error) {
    throw result.error
  }
  return (result.data as Lesson | null) ?? null
}

export async function fetchMaterials(lessonId: string): Promise<LessonMaterial[]> {
  const result = await supabase
    .from('lesson_materials')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }
  return (result.data as LessonMaterial[]) ?? []
}

export async function uploadMaterial(
  lessonId: string,
  file: File,
  userId: string,
) {
  const objectPath = `${lessonId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const uploadResult = await supabase.storage
    .from(MATERIALS_BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const metadataResult = await supabase
    .from('lesson_materials')
    .insert({
      lesson_id: lessonId,
      storage_path: objectPath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      created_by: userId,
    })
    .select('*')
    .single()

  if (metadataResult.error) {
    await supabase.storage.from(MATERIALS_BUCKET).remove([objectPath])
    throw metadataResult.error
  }

  return metadataResult.data as LessonMaterial
}

export async function deleteMaterial(material: LessonMaterial) {
  const storageDeleteResult = await supabase.storage
    .from(MATERIALS_BUCKET)
    .remove([material.storage_path])
  if (storageDeleteResult.error) {
    throw storageDeleteResult.error
  }

  const metadataDeleteResult = await supabase
    .from('lesson_materials')
    .delete()
    .eq('id', material.id)
  if (metadataDeleteResult.error) {
    throw metadataDeleteResult.error
  }
}

export async function getSignedMaterialUrl(storagePath: string) {
  const result = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10)

  if (result.error) {
    throw result.error
  }

  return result.data.signedUrl
}

export function toErrorMessage(error: unknown): string {
  const normalizedError = normalizeSupabaseError(error)
  return normalizedError.message || 'Erro inesperado.'
}
