import { supabase } from '@/services/supabase/client'
import {
  exportAssessmentContent,
  importAssessmentContentStructured,
  type ImportAssessmentData,
} from '@/features/admin/assessments/api'
import { normalizeCourseQuizTypeSettings } from '@/features/assessments/course-quiz-type-settings'
import {
  isLegacyCourseSalesSchemaError,
  stripLegacyCourseSalesFields,
  withLegacyCourseSalesDefaults,
} from '@/features/courses/schema-compat'
import type {
  ButtonTemplate,
  Course,
  CourseCategory,
  CourseQuizTypeSettings,
  CourseModule,
  Lesson,
  LessonFooterAction,
  LessonMaterial,
  ModulePdfAsset,
  Assessment,
} from '@/types/content'

import type {
  ButtonTemplateFormInput,
  CourseFormInput,
  CoursePublicPageContentInput,
  CoursePublicPageFormInput,
  LessonFormInput,
  LessonFooterActionFormInput,
  ModuleFormInput,
} from './schemas'
import type { Session } from '@supabase/supabase-js'

const MATERIALS_BUCKET = 'materials'
const MODULE_PDFS_BUCKET = 'module-pdfs'
const LESSON_FOOTER_ASSETS_BUCKET = 'lesson-footer-assets'
const LESSON_CONTENT_ASSETS_BUCKET = 'lesson-content-assets'
type PrivateStorageProvider = 'supabase' | 'r2'

type UploadPreparationResponse = {
  provider: PrivateStorageProvider
  upload_method: 'supabase_signed_upload' | 'r2_signed_put'
  upload_path: string
  upload_token: string | null
  upload_url: string | null
  upload_headers: Record<string, string> | null
  storage_bucket: string
  storage_provider: PrivateStorageProvider
}

function normalizeSupabaseError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error('Erro inesperado.')
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
  return ((result.data as Course[]) ?? []).map(withLegacyCourseSalesDefaults)
}

async function getAccessTokenOrThrow() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token ?? ''
  if (!accessToken) {
    throw new Error('Sessao expirada. Faça login novamente.')
  }
  return accessToken
}

async function preparePrivateAssetUpload(input: {
  uploadKind: 'lesson_material'
  entityId: string
  file: File
}) {
  const accessToken = await getAccessTokenOrThrow()
  const response = await supabase.functions.invoke<UploadPreparationResponse>('admin-storage-upload', {
    body: {
      access_token: accessToken,
      operation: 'prepare_upload',
      upload_kind: input.uploadKind,
      entity_id: input.entityId,
      file_name: input.file.name,
      mime_type: input.file.type || 'application/octet-stream',
      file_size_bytes: input.file.size,
    },
  })

  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? 'Nao foi possivel preparar o upload protegido.')
  }
  return response.data
}

async function uploadPrivateFile(
  ticket: UploadPreparationResponse,
  file: File,
) {
  if (ticket.upload_method === 'supabase_signed_upload') {
    if (!ticket.upload_token) {
      throw new Error('Token de upload assinado ausente.')
    }
    const signedUploadResult = await supabase.storage
      .from(ticket.storage_bucket)
      .uploadToSignedUrl(ticket.upload_path, ticket.upload_token, file)
    if (signedUploadResult.error) {
      throw signedUploadResult.error
    }
    return
  }

  if (!ticket.upload_url) {
    throw new Error('URL de upload assinada ausente.')
  }

  // Upload grande via fetch pode ser instavel em navegadores com extensoes que
  // interceptam window.fetch; usamos XHR com retry para reduzir abortos de rede.
  const uploadHeaders = buildR2UploadHeaders(file, ticket.upload_headers)
  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await uploadToSignedR2UrlWithXhr(ticket.upload_url, uploadHeaders, file)
      return
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Falha no upload para R2.')
      lastError = normalized
      if (!isRetryableR2UploadError(normalized) || attempt >= maxAttempts) {
        break
      }
      await delay(350 * attempt)
    }
  }

  if (lastError) {
    throw lastError
  }
}

function buildR2UploadHeaders(file: File, signedHeaders: Record<string, string> | null | undefined) {
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
  }

  for (const [rawKey, rawValue] of Object.entries(signedHeaders ?? {})) {
    const key = rawKey.trim()
    const value = String(rawValue ?? '').trim()
    if (!key || !value) {
      continue
    }

    const lowerKey = key.toLowerCase()
    if (lowerKey === 'host' || lowerKey === 'content-length' || lowerKey === 'content-type') {
      continue
    }

    headers[key] = value
  }

  return headers
}

async function uploadToSignedR2UrlWithXhr(url: string, headers: Record<string, string>, file: File) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)

    for (const [key, value] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(key, value)
      } catch {
        // Ignora headers nao permitidos pelo navegador (ex.: host).
      }
    }

    xhr.onerror = () => {
      reject(new Error('Falha de rede durante upload para R2 (status 0).'))
    }

    xhr.onabort = () => {
      reject(new Error('Upload para R2 foi abortado (status 0).'))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(`Falha no upload para R2 (${xhr.status}). ${xhr.responseText || ''}`.trim()))
    }

    xhr.send(file)
  })
}

function isRetryableR2UploadError(error: Error) {
  const message = error.message.toLowerCase()
  const statusMatch = message.match(/\((\d{3})\)/)
  const status = statusMatch ? Number(statusMatch[1]) : null
  return (
    message.includes('status 0') ||
    message.includes('network') ||
    message.includes('abort') ||
    message.includes('timeout') ||
    (status !== null && status >= 500)
  )
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms)
  })
}

async function deletePrivateObject(input: {
  storagePath: string
  storageProvider: PrivateStorageProvider
  storageBucket: string
}) {
  const accessToken = await getAccessTokenOrThrow()
  const response = await supabase.functions.invoke<{ ok: boolean }>('admin-storage-upload', {
    body: {
      access_token: accessToken,
      operation: 'delete_object',
      provider: input.storageProvider,
      storage_path: input.storagePath,
      storage_bucket: input.storageBucket,
    },
  })
  if (response.error) {
    throw new Error(response.error.message)
  }
}

export async function fetchCourseCategories(includeInactive = true): Promise<CourseCategory[]> {
  const query = supabase
    .from('course_categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  const result = includeInactive ? await query : await query.eq('is_active', true)
  if (result.error) {
    throw result.error
  }
  return (result.data as CourseCategory[]) ?? []
}

export async function createCourseCategory(input: { name: string; slug?: string; is_active?: boolean }) {
  const positionResult = await supabase
    .from('course_categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  if (positionResult.error) {
    throw positionResult.error
  }

  const nextDisplayOrder = (positionResult.data?.[0]?.display_order ?? 0) + 1
  const result = await supabase
    .from('course_categories')
    .insert({
      name: input.name.trim(),
      slug: input.slug?.trim() || slugify(input.name),
      display_order: nextDisplayOrder,
      is_active: input.is_active ?? true,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as CourseCategory
}

export async function updateCourseCategory(
  categoryId: string,
  input: { name: string; slug?: string; is_active?: boolean },
) {
  const result = await supabase
    .from('course_categories')
    .update({
      name: input.name.trim(),
      slug: input.slug?.trim() || slugify(input.name),
      is_active: input.is_active ?? true,
    })
    .eq('id', categoryId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as CourseCategory
}

export async function deleteCourseCategory(categoryId: string) {
  const result = await supabase
    .from('course_categories')
    .delete()
    .eq('id', categoryId)

  if (result.error) {
    throw result.error
  }
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

  const payload = {
    title: input.title,
    category: input.category?.trim() || null,
    description: input.description?.trim() || null,
    status: input.status,
    display_order: nextDisplayOrder,
    thumbnail_url: input.thumbnail_url?.trim() || null,
    slug: input.slug?.trim() || slugify(input.title),
    launch_date: input.launch_date?.trim() || null,
    price_cents: input.price_cents ?? 0,
    currency: input.currency,
    is_public: input.is_public,
    creator_id: input.creator_id || null,
    creator_commission_percent: input.creator_commission_percent ?? 0,
    quiz_type_settings: normalizeCourseQuizTypeSettings(input.quiz_type_settings),
    created_by: userId,
  }

  let result = await supabase
    .from('courses')
    .insert(payload)
    .select('*')
    .single()

  if (result.error && isLegacyCourseSalesSchemaError(result.error)) {
    result = await supabase
      .from('courses')
      .insert(stripLegacyCourseSalesFields(payload))
      .select('*')
      .single()
  }

  if (result.error) {
    throw result.error
  }
  return withLegacyCourseSalesDefaults(result.data as Course)
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
  const payload = {
    title: input.title,
    category: input.category?.trim() || null,
    description: input.description?.trim() || null,
    status: input.status,
    thumbnail_url: input.thumbnail_url?.trim() || null,
    slug: input.slug?.trim() || slugify(input.title),
    launch_date: input.launch_date?.trim() || null,
    price_cents: input.price_cents ?? 0,
    currency: input.currency,
    is_public: input.is_public,
    creator_id: input.creator_id || null,
    creator_commission_percent: input.creator_commission_percent ?? 0,
    has_linear_progression: input.has_linear_progression,
    quiz_type_settings: normalizeCourseQuizTypeSettings(input.quiz_type_settings),
  }

  let result = await supabase
    .from('courses')
    .update(payload)
    .eq('id', courseId)
    .select('*')
    .single()

  if (result.error && isLegacyCourseSalesSchemaError(result.error)) {
    result = await supabase
      .from('courses')
      .update(stripLegacyCourseSalesFields(payload))
      .eq('id', courseId)
      .select('*')
      .single()
  }

  if (result.error) {
    throw result.error
  }
  return withLegacyCourseSalesDefaults(result.data as Course)
}

export async function updateCoursePublicPage(courseId: string, input: CoursePublicPageFormInput) {
  const publicPageContent: CoursePublicPageContentInput = {
    categoryLine: input.categoryLine?.trim() || null,
    aboutParagraphs: input.aboutParagraphs,
    outcomes: input.outcomes,
    includedItems: input.includedItems,
    bonusSection: {
      enabled: input.bonus_enabled,
      title: input.bonus_title?.trim() || 'Prévia de conteúdo',
      description: input.mentor_bio?.trim() || '',
    },
    contentSource: input.contentSource,
    customSyllabus: input.customSyllabus,
  }

  const result = await supabase
    .from('courses')
    .update({
      category: input.category?.trim() || null,
      marketing_title: input.marketing_title.trim(),
      marketing_description: input.marketing_description.trim(),
      mentor_name: input.mentor_name.trim(),
      mentor_role: input.mentor_role.trim(),
      mentor_bio: input.mentor_bio?.trim() || null,
      mentor_initials: input.mentor_initials?.trim() || null,
      price_label: input.price_label.trim(),
      secondary_price_label: input.secondary_price_label.trim(),
      public_page_content: publicPageContent,
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
  return result.data ? withLegacyCourseSalesDefaults(result.data as Course) : null
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
      starts_at: input.starts_at?.trim() || null,
      ends_at: input.ends_at?.trim() || null,
      release_days_after_enrollment: input.release_days_after_enrollment?.trim()
        ? Number(input.release_days_after_enrollment.trim())
        : null,
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
      starts_at: input.starts_at?.trim() || null,
      ends_at: input.ends_at?.trim() || null,
      release_days_after_enrollment: input.release_days_after_enrollment?.trim()
        ? Number(input.release_days_after_enrollment.trim())
        : null,
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
      starts_at: input.starts_at?.trim() || null,
      ends_at: input.ends_at?.trim() || null,
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
      starts_at: input.starts_at?.trim() || null,
      ends_at: input.ends_at?.trim() || null,
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
  const uploadTicket = await preparePrivateAssetUpload({
    uploadKind: 'lesson_material',
    entityId: lessonId,
    file,
  })
  await uploadPrivateFile(uploadTicket, file)

  const metadataResult = await supabase
    .from('lesson_materials')
    .insert({
      lesson_id: lessonId,
      storage_path: uploadTicket.upload_path,
      storage_provider: uploadTicket.storage_provider,
      file_name: file.name,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      created_by: userId,
    })
    .select('*')
    .single()

  if (metadataResult.error) {
    await deletePrivateObject({
      storagePath: uploadTicket.upload_path,
      storageProvider: uploadTicket.storage_provider,
      storageBucket: uploadTicket.storage_bucket,
    })
    throw metadataResult.error
  }

  return metadataResult.data as LessonMaterial
}

export async function deleteMaterial(material: LessonMaterial) {
  await deletePrivateObject({
    storagePath: material.storage_path,
    storageProvider: material.storage_provider ?? 'supabase',
    storageBucket: MATERIALS_BUCKET,
  })

  const metadataDeleteResult = await supabase
    .from('lesson_materials')
    .delete()
    .eq('id', material.id)
  if (metadataDeleteResult.error) {
    throw metadataDeleteResult.error
  }
}

export async function getSignedMaterialUrl(storagePath: string, expiresInSeconds = 60 * 10) {
  const accessToken = await getAccessTokenOrThrow()
  const response = await supabase.functions.invoke<{
    signed_url: string
  }>('generate-asset-access', {
    body: {
      access_token: accessToken,
      storage_path: storagePath,
      expires_in_seconds: expiresInSeconds,
    },
  })

  if (response.error || !response.data?.signed_url) {
    throw new Error(response.error?.message ?? 'Nao foi possivel gerar URL assinada do material.')
  }

  return response.data.signed_url
}

export async function uploadModulePdf(
  moduleId: string,
  file: File,
) {
  const objectPath = `${moduleId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const uploadResult = await supabase.storage
    .from(MODULE_PDFS_BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/pdf',
    })

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const metadataResult = await supabase
    .from('course_modules')
    .update({
      module_pdf_storage_path: objectPath,
      module_pdf_storage_provider: 'supabase',
      module_pdf_file_name: file.name,
      module_pdf_uploaded_at: new Date().toISOString(),
    })
    .eq('id', moduleId)
    .select('module_pdf_storage_path, module_pdf_storage_provider, module_pdf_file_name, module_pdf_uploaded_at')
    .single()

  if (metadataResult.error) {
    await supabase.storage.from(MODULE_PDFS_BUCKET).remove([objectPath])
    throw metadataResult.error
  }

  const row = metadataResult.data as {
    module_pdf_storage_path: string
    module_pdf_storage_provider: 'supabase' | 'r2'
    module_pdf_file_name: string
    module_pdf_uploaded_at: string | null
  }

  return {
    storage_path: row.module_pdf_storage_path,
    storage_provider: row.module_pdf_storage_provider,
    file_name: row.module_pdf_file_name,
    uploaded_at: row.module_pdf_uploaded_at,
  } satisfies ModulePdfAsset
}

export async function deleteModulePdf(module: Pick<CourseModule, 'id' | 'module_pdf_storage_path'>) {
  if (module.module_pdf_storage_path) {
    const removeResult = await supabase.storage
      .from(MODULE_PDFS_BUCKET)
      .remove([module.module_pdf_storage_path])

    if (removeResult.error) {
      throw removeResult.error
    }
  }

  const result = await supabase
    .from('course_modules')
    .update({
      module_pdf_storage_path: null,
      module_pdf_file_name: null,
      module_pdf_uploaded_at: null,
    })
    .eq('id', module.id)

  if (result.error) {
    throw result.error
  }
}

export async function getSignedModulePdfUrl(storagePath: string) {
  const result = await supabase.storage
    .from(MODULE_PDFS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10)

  if (result.error) {
    throw result.error
  }

  return result.data.signedUrl
}

export async function uploadLessonContentAsset(file: File) {
  const objectPath = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const uploadResult = await supabase.storage
    .from(LESSON_CONTENT_ASSETS_BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const signedUrl = await getSignedLessonContentAssetUrl(objectPath)
  return {
    storage_path: objectPath,
    signed_url: signedUrl,
  }
}

export async function deleteLessonContentAsset(storagePath: string) {
  const result = await supabase.storage
    .from(LESSON_CONTENT_ASSETS_BUCKET)
    .remove([storagePath])

  if (result.error) {
    throw result.error
  }
}

export async function getSignedLessonContentAssetUrl(storagePath: string) {
  const result = await supabase.storage
    .from(LESSON_CONTENT_ASSETS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (result.error) {
    throw result.error
  }

  return result.data.signedUrl
}

export async function fetchButtonTemplates() {
  const result = await supabase
    .from('button_templates')
    .select('*')
    .order('name', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data as ButtonTemplate[]) ?? []
}

export async function createButtonTemplate(input: ButtonTemplateFormInput) {
  const result = await supabase
    .from('button_templates')
    .insert(input)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as ButtonTemplate
}

export async function updateButtonTemplate(templateId: string, input: ButtonTemplateFormInput) {
  const result = await supabase
    .from('button_templates')
    .update(input)
    .eq('id', templateId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as ButtonTemplate
}

export async function deleteButtonTemplate(templateId: string) {
  const result = await supabase
    .from('button_templates')
    .delete()
    .eq('id', templateId)

  if (result.error) {
    throw result.error
  }
}

export async function fetchLessonFooterActions(lessonId: string) {
  const result = await supabase
    .from('lesson_footer_actions')
    .select('*, template:button_templates(*)')
    .eq('lesson_id', lessonId)
    .order('position', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data as LessonFooterAction[]) ?? []
}

export async function createLessonFooterAction(
  lessonId: string,
  input: LessonFooterActionFormInput,
  userId: string,
  file?: File | null,
) {
  let storagePath: string | null = null
  let fileName: string | null = null
  let mimeType: string | null = null
  let fileSizeBytes = 0

  if (input.action_type === 'file' && file) {
    storagePath = `${lessonId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    const uploadResult = await supabase.storage
      .from(LESSON_FOOTER_ASSETS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadResult.error) {
      throw uploadResult.error
    }

    fileName = file.name
    mimeType = file.type || null
    fileSizeBytes = file.size
  }

  const result = await supabase
    .from('lesson_footer_actions')
    .insert({
      lesson_id: lessonId,
      template_id: input.template_id ?? null,
      action_type: input.action_type,
      label: input.label?.trim() || null,
      url: input.action_type === 'url' ? input.url?.trim() || null : null,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      position: input.position,
      open_in_new_tab: input.open_in_new_tab,
      is_active: input.is_active,
      created_by: userId,
    })
    .select('*, template:button_templates(*)')
    .single()

  if (result.error) {
    if (storagePath) {
      await supabase.storage.from(LESSON_FOOTER_ASSETS_BUCKET).remove([storagePath])
    }
    throw result.error
  }

  return result.data as LessonFooterAction
}

export async function updateLessonFooterAction(
  actionId: string,
  input: LessonFooterActionFormInput,
  file?: File | null,
) {
  const currentResult = await supabase
    .from('lesson_footer_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (currentResult.error) {
    throw currentResult.error
  }

  const current = currentResult.data as LessonFooterAction
  let storagePath = current.storage_path
  let fileName = current.file_name
  let mimeType = current.mime_type
  let fileSizeBytes = current.file_size_bytes

  if (input.action_type === 'file' && file) {
    const nextStoragePath = `${current.lesson_id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    const uploadResult = await supabase.storage
      .from(LESSON_FOOTER_ASSETS_BUCKET)
      .upload(nextStoragePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadResult.error) {
      throw uploadResult.error
    }

    if (current.storage_path) {
      await supabase.storage.from(LESSON_FOOTER_ASSETS_BUCKET).remove([current.storage_path])
    }

    storagePath = nextStoragePath
    fileName = file.name
    mimeType = file.type || null
    fileSizeBytes = file.size
  }

  const result = await supabase
    .from('lesson_footer_actions')
    .update({
      template_id: input.template_id ?? null,
      action_type: input.action_type,
      label: input.label?.trim() || null,
      url: input.action_type === 'url' ? input.url?.trim() || null : null,
      storage_path: input.action_type === 'file' ? storagePath : null,
      file_name: input.action_type === 'file' ? fileName : null,
      mime_type: input.action_type === 'file' ? mimeType : null,
      file_size_bytes: input.action_type === 'file' ? fileSizeBytes : 0,
      position: input.position,
      open_in_new_tab: input.open_in_new_tab,
      is_active: input.is_active,
    })
    .eq('id', actionId)
    .select('*, template:button_templates(*)')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as LessonFooterAction
}

export async function deleteLessonFooterAction(action: LessonFooterAction) {
  if (action.storage_path) {
    const storageDeleteResult = await supabase.storage
      .from(LESSON_FOOTER_ASSETS_BUCKET)
      .remove([action.storage_path])

    if (storageDeleteResult.error) {
      throw storageDeleteResult.error
    }
  }

  const result = await supabase
    .from('lesson_footer_actions')
    .delete()
    .eq('id', action.id)

  if (result.error) {
    throw result.error
  }
}

export async function getSignedLessonFooterActionUrl(storagePath: string) {
  const result = await supabase.storage
    .from(LESSON_FOOTER_ASSETS_BUCKET)
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

  return { course: withLegacyCourseSalesDefaults(course), modules: treeModules, courseAssessments }
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
    lesson_type: 'video' | 'text' | 'hybrid' | 'file'
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
    lesson_type: 'video' | 'text' | 'hybrid' | 'file'
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
  quiz_type_settings?: CourseQuizTypeSettings
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
    quiz_type_settings: normalizeCourseQuizTypeSettings(course.quiz_type_settings),
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
        workload_minutes: fullCourseInput.workload_minutes || 0,
        quiz_type_settings: normalizeCourseQuizTypeSettings(fullCourseInput.quiz_type_settings),
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
  quiz_type_settings?: CourseQuizTypeSettings
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
      quiz_type_settings: normalizeCourseQuizTypeSettings(data.quiz_type_settings),
      created_by: userId
    })
    .select()
    .single()

  if (cError) throw cError

  // 2. Importar Conteúdo (Módulos/Aulas/Quizzes ou Avaliação Direta)
  await importCourseContent(course.id, data, false)
  
  return course
}

