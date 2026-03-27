import { supabase } from '@/services/supabase/client'
import {
  exportAssessmentContent,
  importAssessmentContentStructured,
  type ImportAssessmentData,
} from '@/features/admin/assessments/api'
import type {
  Course,
  CourseModule,
  Lesson,
  LessonMaterial,
  Assessment,
} from '@/types/content'

import type {
  CourseFormInput,
  LessonFormInput,
  ModuleFormInput,
} from './schemas'
import type { Session } from '@supabase/supabase-js'

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
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (result.error) {
    throw result.error
  }
  return (result.data as Course[]) ?? []
}

export async function createCourse(input: CourseFormInput, userId: string) {
  const positionResult = await supabase
    .from('courses')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  if (positionResult.error) {
    throw positionResult.error
  }

  const nextDisplayOrder = (positionResult.data?.[0]?.display_order ?? 0) + 1

  const result = await supabase
    .from('courses')
    .insert({
      title: input.title,
      description: input.description?.trim() || null,
      status: input.status,
      display_order: nextDisplayOrder,
      thumbnail_url: input.thumbnail_url?.trim() || null,
      created_by: userId,
    })
    .select('*')
    .single()
  if (result.error) {
    throw result.error
  }
  return result.data as Course
}

export async function updateCoursesDisplayOrder(courses: Pick<Course, 'id' | 'display_order'>[]) {
  for (const course of courses) {
    const result = await supabase
      .from('courses')
      .update({ display_order: course.display_order })
      .eq('id', course.id)

    if (result.error) {
      throw result.error
    }
  }
}

export async function updateCourse(courseId: string, input: CourseFormInput) {
  const result = await supabase
    .from('courses')
    .update({
      title: input.title,
      description: input.description?.trim() || null,
      status: input.status,
      thumbnail_url: input.thumbnail_url?.trim() || null,
      has_linear_progression: input.has_linear_progression,
    })
    .eq('id', courseId)
    .select('*')
    .single()
  if (result.error) {
    throw result.error
  }
  return result.data as Course
}

export interface ResetCourseProgressResult {
  course_id: string
  course_title: string
  impacted_students: number
  deleted_counts: {
    course_progress: number
    lesson_progress: number
    assessment_attempts: number
    assessment_attempt_requests: number
    assessment_attempt_grants: number
  }
  message: string
}

export async function resetCourseProgress(courseId: string, session: Session) {
  const response = await fetch('/api/admin/courses/reset-progress', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ courseId }),
  })

  const payload = await response.json().catch(() => null) as { error?: string } | ResetCourseProgressResult | null

  if (!response.ok) {
    throw new Error(
      payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Nao foi possivel renovar o progresso do curso.',
    )
  }

  return payload as ResetCourseProgressResult
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

export async function reorderModules(_courseId: string, orderedModuleIds: string[]) {
  const updates = orderedModuleIds.map((id, index) => 
    supabase
      .from('course_modules')
      .update({ position: index + 1 })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  const firstError = results.find(r => r.error)?.error
  if (firstError) throw firstError
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
      lesson_type: input.lesson_type,
      youtube_url: input.youtube_url?.trim() || null,
      text_content: input.text_content?.trim() || null,
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
      lesson_type: input.lesson_type,
      youtube_url: input.youtube_url?.trim() || null,
      text_content: input.text_content?.trim() || null,
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

export async function reorderLessons(_moduleId: string, orderedLessonIds: string[]) {
  const updates = orderedLessonIds.map((id, index) => 
    supabase
      .from('lessons')
      .update({ position: index + 1 })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  const firstError = results.find(r => r.error)?.error
  if (firstError) throw firstError
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

export type AdminCourseTree = {
  course: Course
  modules: (CourseModule & {
    lessons: Lesson[]
    assessments: Assessment[]
  })[]
  courseAssessments: Assessment[]
}

export async function fetchAdminCourseTree(courseId: string): Promise<AdminCourseTree> {
  const [courseResult, modulesResult, lessonsResult, assessmentsResult] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),
    supabase.from('course_modules').select('*').eq('course_id', courseId).order('position', { ascending: true }),
    supabase.from('lessons').select('*, course_modules!inner(course_id)').eq('course_modules.course_id', courseId).order('position', { ascending: true }),
    supabase.from('assessments').select('*').eq('course_id', courseId).order('created_at', { ascending: true })
  ])

  if (courseResult.error) throw courseResult.error
  if (modulesResult.error) throw modulesResult.error
  if (lessonsResult.error) throw lessonsResult.error
  if (assessmentsResult.error) throw assessmentsResult.error

  const course = courseResult.data as Course
  const modules = (modulesResult.data as CourseModule[]) ?? []
  const lessons = (lessonsResult.data as Lesson[]) ?? []
  const assessments = (assessmentsResult.data as Assessment[]) ?? []

  const treeModules = modules.map(m => {
    return {
      ...m,
      lessons: lessons.filter(l => l.module_id === m.id),
      assessments: assessments.filter(a => a.module_id === m.id)
    }
  })

  // Course-level assessments (no module_id or course final assessment)
  const courseAssessments = assessments.filter(a => !a.module_id)

  return { course, modules: treeModules, courseAssessments }
}

export function toErrorMessage(error: unknown): string {
  const normalizedError = normalizeSupabaseError(error)
  return normalizedError.message || 'Erro inesperado.'
}

export async function uploadCourseThumbnail(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const filePath = `${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('thumbnails')
    .upload(filePath, file)

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from('thumbnails')
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * IMPORTAÇÃO EM MASSA (IA)
 * Permite subir uma estrutura completa de módulos, aulas e quizzes via JSON.
 */
export interface ImportModuleData {
  title: string
  description?: string
  lessons?: {
    title: string
    description?: string
    lesson_type: 'video' | 'text' | 'hybrid'
    youtube_url?: string
    text_content?: string
    estimated_minutes?: number
  }[]
  assessments?: {
    title: string
    description?: string
    assessment_type: 'module'
    passing_score?: number
    max_attempts?: number
    estimated_minutes?: number
    questions?: ImportAssessmentData['questions']
    case_studies?: ImportAssessmentData['case_studies']
  }[]
}

export interface ExportModuleData {
  title: string
  description?: string
  lessons?: {
    title: string
    description?: string
    lesson_type: 'video' | 'text' | 'hybrid'
    youtube_url?: string
    text_content?: string
    estimated_minutes?: number
  }[]
  assessments?: (ImportAssessmentData & { assessment_type: 'module' })[]
}

export interface ExportCourseFullData {
  title: string
  description?: string
  workload_minutes?: number
  thumbnail_url?: string
  status?: 'draft' | 'published' | 'archived'
  modules: ExportModuleData[]
}

export async function exportModuleContent(moduleId: string): Promise<ExportModuleData> {
  const moduleResult = await supabase
    .from('course_modules')
    .select('*')
    .eq('id', moduleId)
    .single()

  if (moduleResult.error) {
    throw moduleResult.error
  }

  const module = moduleResult.data as CourseModule

  const [lessonsResult, assessmentsResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('*')
      .eq('module_id', moduleId)
      .order('position', { ascending: true }),
    supabase
      .from('assessments')
      .select('*')
      .eq('module_id', moduleId)
      .eq('assessment_type', 'module')
      .order('created_at', { ascending: true }),
  ])

  if (lessonsResult.error) {
    throw lessonsResult.error
  }

  if (assessmentsResult.error) {
    throw assessmentsResult.error
  }

  const lessons = (lessonsResult.data as Lesson[]) ?? []
  const assessments = (assessmentsResult.data as Assessment[]) ?? []

  const exportedAssessments = await Promise.all(
    assessments.map(async (assessment) => ({
      ...(await exportAssessmentContent(assessment.id)),
      assessment_type: 'module' as const,
    })),
  )

  return {
    title: module.title,
    description: module.description ?? '',
    lessons: lessons.map((lesson) => ({
      title: lesson.title,
      description: lesson.description ?? '',
      lesson_type: lesson.lesson_type,
      youtube_url: lesson.youtube_url ?? '',
      text_content: lesson.text_content ?? '',
      estimated_minutes: lesson.estimated_minutes,
    })),
    assessments: exportedAssessments,
  }
}

export async function exportFullCourseContent(courseId: string): Promise<ExportCourseFullData> {
  const [courseResult, modulesResult] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),
    supabase
      .from('course_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('position', { ascending: true }),
  ])

  if (courseResult.error) {
    throw courseResult.error
  }

  if (modulesResult.error) {
    throw modulesResult.error
  }

  const course = courseResult.data as Course
  const modules = (modulesResult.data as CourseModule[]) ?? []
  const exportedModules = await Promise.all(modules.map((module) => exportModuleContent(module.id)))

  return {
    title: course.title,
    description: course.description ?? '',
    workload_minutes: course.workload_minutes,
    thumbnail_url: course.thumbnail_url ?? '',
    status: course.status,
    modules: exportedModules,
  }
}

export async function clearCourseContent(courseId: string) {
  // O cascade delete do banco cuidará das aulas, materiais e quizzes vinculados aos módulos.
  // IMPORTANTE: Deletar primeiro os assessments sem módulo (Assessment Final)
  const { error: aError } = await supabase
    .from('assessments')
    .delete()
    .eq('course_id', courseId)
    .is('module_id', null)
  
  if (aError) throw aError

  const { error: mError } = await supabase
    .from('course_modules')
    .delete()
    .eq('course_id', courseId)
  
  if (mError) throw mError
}

async function createModuleLessons(moduleId: string, lessons: ImportModuleData['lessons']) {
  if (!lessons || lessons.length === 0) return

  const lessonsToInsert = lessons.map((lesson, index) => ({
    module_id: moduleId,
    title: lesson.title,
    description: lesson.description || null,
    lesson_type: lesson.lesson_type,
    youtube_url: lesson.youtube_url || null,
    text_content: lesson.text_content || null,
    estimated_minutes: lesson.estimated_minutes || 10,
    position: index + 1,
  }))

  const { error } = await supabase.from('lessons').insert(lessonsToInsert)
  if (error) throw error
}

async function createModuleAssessments(courseId: string, moduleId: string, assessments: ImportModuleData['assessments']) {
  if (!assessments || assessments.length === 0) return

  for (const assessmentData of assessments) {
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        course_id: courseId,
        module_id: moduleId,
        assessment_type: 'module',
        title: assessmentData.title,
        description: assessmentData.description || null,
        passing_score: assessmentData.passing_score || 70,
        max_attempts: assessmentData.max_attempts || 3,
        estimated_minutes: assessmentData.estimated_minutes || 10,
        is_active: true,
      })
      .select()
      .single()

    if (assessmentError) throw assessmentError

    await importAssessmentContentStructured(assessment.id as string, {
      title: assessmentData.title,
      description: assessmentData.description,
      passing_score: assessmentData.passing_score,
      max_attempts: assessmentData.max_attempts,
      estimated_minutes: assessmentData.estimated_minutes,
      questions: assessmentData.questions,
      case_studies: assessmentData.case_studies,
    })
  }
}

async function replaceModuleContentInPlace(courseId: string, moduleId: string, moduleData: ImportModuleData) {
  const { error: updateModuleError } = await supabase
    .from('course_modules')
    .update({
      title: moduleData.title,
      description: moduleData.description || null,
    })
    .eq('id', moduleId)
    .eq('course_id', courseId)

  if (updateModuleError) throw updateModuleError

  const { error: deleteAssessmentsError } = await supabase
    .from('assessments')
    .delete()
    .eq('course_id', courseId)
    .eq('module_id', moduleId)

  if (deleteAssessmentsError) throw deleteAssessmentsError

  const { error: deleteLessonsError } = await supabase
    .from('lessons')
    .delete()
    .eq('module_id', moduleId)

  if (deleteLessonsError) throw deleteLessonsError

  await createModuleLessons(moduleId, moduleData.lessons)
  await createModuleAssessments(courseId, moduleId, moduleData.assessments)
}

export async function importCourseContent(
  courseId: string,
  input: ImportCourseFullData | ImportModuleData[] | ImportAssessmentData,
  clearExisting: boolean = false,
  moduleIdToReplace?: string
) {
  if (clearExisting) {
    await clearCourseContent(courseId)
  }

  const fullCourseInput = !Array.isArray(input) && 'modules' in input ? input : null
  const assessmentOnlyInput = !Array.isArray(input) && ('questions' in input || 'case_studies' in input) && !('modules' in input) ? input : null

  // Se for um curso completo, atualizamos os metadados do curso atual também
  if (fullCourseInput) {
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        title: fullCourseInput.title,
        description: fullCourseInput.description || null,
        workload_minutes: fullCourseInput.workload_minutes || 0
      })
      .eq('id', courseId)

    if (updateError) throw updateError
  }

  const modules = (Array.isArray(input) ? input : fullCourseInput?.modules ?? []) as ImportModuleData[]
  const isAssessmentOnly = assessmentOnlyInput !== null

  if (modules.length === 0 && !isAssessmentOnly) {
    throw new Error('Nenhum módulo ou conjunto de questões encontrado no JSON para importar.')
  }

  if (moduleIdToReplace && modules.length > 0) {
    await replaceModuleContentInPlace(courseId, moduleIdToReplace, modules[0])

    if (modules.length === 1) {
      return
    }
  }

  // Caso especial: Importação de Avaliação Final (sem módulos)
  if (isAssessmentOnly) {
    const assessmentInput = assessmentOnlyInput as ImportAssessmentData | null

    if (!assessmentInput) {
      throw new Error('Dados da avaliacao final invalidos.')
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .upsert({
        course_id: courseId,
        module_id: null,
        assessment_type: 'final',
        title: assessmentInput.title,
        description: assessmentInput.description || null,
        passing_score: assessmentInput.passing_score || 70,
        max_attempts: assessmentInput.max_attempts || 3,
        estimated_minutes: assessmentInput.estimated_minutes || 10,
        is_active: true,
      }, { onConflict: 'course_id, assessment_type' })
      .select()
      .single()

    if (assessmentError) throw assessmentError

    await importAssessmentContentStructured(assessment.id as string, assessmentInput)
    return
  }

  if (false) {
    const assessmentInput = assessmentOnlyInput as ImportAssessmentData

    // bloco legado mantido apenas para referencia



    // 1. Criar ou atualizar a avaliação final do curso
    const { data: assessment, error: aError } = await supabase
      .from('assessments')
      .upsert({
        course_id: courseId,
        module_id: null,
        assessment_type: 'final',
        title: assessmentInput.title,
        description: assessmentInput.description || null,
        passing_score: assessmentInput.passing_score || 70,
        max_attempts: assessmentInput.max_attempts || 3,
        estimated_minutes: assessmentInput.estimated_minutes || 10,
        is_active: true
      }, { onConflict: 'course_id, assessment_type' })
      .select()
      .single()

    if (aError) throw aError

    // 2. Limpar questões se necessário (UPSERT em cascata seria ideal, mas fazemos manual)
    await supabase.from('assessment_questions').delete().eq('assessment_id', assessment.id)

    // 3. Inserir questões
    const legacyQuestions = assessmentInput.questions ?? []
    for (let qIdx = 0; qIdx < legacyQuestions.length; qIdx++) {
      const qData = legacyQuestions[qIdx]
      const questionType = qData.question_type === 'essay_ai' ? 'essay_ai' : 'single_choice'
      const { data: question, error: qError } = await supabase
        .from('assessment_questions')
        .insert({
          assessment_id: assessment.id,
          question_text: qData.question_text,
          points: questionType === 'essay_ai' ? 0 : (qData.points || 1),
          position: qIdx + 1,
          is_required: qData.is_required ?? true,
          question_type: questionType,
          essay_expected_answer: questionType === 'essay_ai'
            ? qData.essay_expected_answer?.trim() || null
            : null,
        })
        .select()
        .single()

      if (qError) throw qError

      const legacyOptions = qData.options ?? []
      if (questionType === 'single_choice' && legacyOptions.length > 0) {
        const optionsToInsert = legacyOptions.map((o, oIdx: number) => ({
          question_id: question.id,
          option_text: o.option_text,
          is_correct: o.is_correct,
          position: oIdx + 1
        }))
        await supabase.from('assessment_options').insert(optionsToInsert)
      }
    }
    return // Sucesso na importação apenas de avaliação
  }

  // 1. Cálculo da posição inicial
  let startPosition = 0

  const { data: lastModule } = await supabase
    .from('course_modules')
    .select('position')
    .eq('course_id', courseId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  if (lastModule) {
    startPosition = lastModule.position
  }

  const modulesToInsert = moduleIdToReplace ? modules.slice(1) : modules

  // 2. Loop de inserção
  for (let mIdx = 0; mIdx < modulesToInsert.length; mIdx++) {
    const mData = modulesToInsert[mIdx]

    // Inserir Módulo
    const { data: module, error: mError } = await supabase
      .from('course_modules')
      .insert({
        course_id: courseId,
        title: mData.title,
        description: mData.description || null,
        position: startPosition + mIdx + 1
      })
      .select()
      .single()

    if (mError) throw mError

    await createModuleLessons(module.id, mData.lessons)
    await createModuleAssessments(courseId, module.id, mData.assessments)
  }
}
export interface ImportCourseFullData {
  title: string
  description?: string
  workload_minutes?: number
  thumbnail_url?: string
  status?: 'draft' | 'published'
  modules: ImportModuleData[]
}

export async function importFullCourse(data: ImportCourseFullData, userId: string) {
  const positionResult = await supabase
    .from('courses')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  if (positionResult.error) throw positionResult.error
  const nextDisplayOrder = (positionResult.data?.[0]?.display_order ?? 0) + 1

  // 1. Criar o Curso Base
  const { data: course, error: cError } = await supabase
    .from('courses')
    .insert({
      title: data.title,
      description: data.description || null,
      status: data.status || 'draft',
      display_order: nextDisplayOrder,
      workload_minutes: data.workload_minutes || 0,
      thumbnail_url: data.thumbnail_url || null,
      created_by: userId
    })
    .select()
    .single()

  if (cError) throw cError

  // 2. Importar Conteúdo (Módulos/Aulas/Quizzes ou Avaliação Direta)
  await importCourseContent(course.id, data, false)
  
  return course
}
