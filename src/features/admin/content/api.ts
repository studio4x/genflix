import { supabase } from '@/services/supabase/client';
import { mergeContent, sanitizeRichTextHtml, splitContent, type LessonContentBlock, } from './content-blocks';
import { exportAssessmentContent, importAssessmentContentStructured, type ImportAssessmentData, } from '@/features/admin/assessments/api';
import { normalizeCourseQuizTypeSettings } from '@/features/assessments/course-quiz-type-settings';
import { buildCourseMediaPublicUrl, normalizeCourseMediaFields, normalizeCourseMediaPublicUrl } from '@/features/course-media/public-url';
import { getCourseCategories, normalizeCoursePrimaryCategory, } from '@/features/courses/course-categories';
import { isLegacyCourseSalesSchemaError, stripLegacyCourseSalesFields, withLegacyCourseSalesDefaults, } from '@/features/courses/schema-compat';
import { normalizeCoursePublicPageContent } from '@/features/public/course-public-page-content';
import type { ButtonTemplate, Course, CourseAuthor, CourseCategory, CourseQuizTypeSettings, CourseModule, FooterActionScope, Lesson, LessonFooterAction, LessonMaterial, ModulePdfAsset, Assessment, } from '@/types/content';
import type { ButtonTemplateFormInput, CourseFormInput, CoursePublicPageContentInput, CoursePublicPageFormInput, LessonFormInput, LessonFooterActionFormInput, ModuleFormInput, } from './schemas';
import type { Session } from '@supabase/supabase-js';
import { deleteStorageObject, prepareStorageUpload, uploadFileWithTicket, type StorageUploadProgress } from '@/features/storage/r2-upload';
const MATERIALS_BUCKET = 'materials';
const MODULE_PDFS_BUCKET = 'module-pdfs';
const LESSON_FOOTER_ASSETS_BUCKET = 'lesson-footer-assets';
const LESSON_CONTENT_ASSETS_BUCKET = 'lesson-content-assets';
export type UploadProgressSnapshot = StorageUploadProgress;
function normalizeSupabaseError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error('Erro inesperado.');
}
function slugify(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
async function swapPositions(table: 'course_modules' | 'lessons', firstId: string, firstPosition: number, secondId: string, secondPosition: number) {
    const temporaryPosition = Math.max(firstPosition, secondPosition) + 1000000;
    const firstTempUpdate = await supabase
        .from(table)
        .update({ position: temporaryPosition })
        .eq('id', firstId);
    if (firstTempUpdate.error) {
        throw firstTempUpdate.error;
    }
    const secondUpdate = await supabase
        .from(table)
        .update({ position: firstPosition })
        .eq('id', secondId);
    if (secondUpdate.error) {
        throw secondUpdate.error;
    }
    const firstFinalUpdate = await supabase
        .from(table)
        .update({ position: secondPosition })
        .eq('id', firstId);
    if (firstFinalUpdate.error) {
        throw firstFinalUpdate.error;
    }
}
function normalizeCourseMediaValue(value: string | null | undefined) {
    return normalizeCourseMediaPublicUrl(value)?.trim() || null;
}
function normalizeCourseRecord<TCourse extends Course>(course: TCourse) {
    return withLegacyCourseSalesDefaults(normalizeCourseMediaFields(course) as TCourse);
}
export async function fetchCourses(): Promise<Course[]> {
    const result = await supabase
        .from('courses')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
    if (result.error) {
        throw result.error;
    }
    return ((result.data as Course[]) ?? []).map((course) => normalizeCourseRecord(course));
}
async function getAccessTokenOrThrow() {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? '';
    if (!accessToken) {
        throw new Error("Sesso expirada. Fa\u00E7a login novamente.");
    }
    return accessToken;
}
export async function fetchCourseCategories(includeInactive = true): Promise<CourseCategory[]> {
    const query = supabase
        .from('course_categories')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
    const result = includeInactive ? await query : await query.eq('is_active', true);
    if (result.error) {
        throw result.error;
    }
    return (result.data as CourseCategory[]) ?? [];
}
export async function createCourseCategory(input: {
    name: string;
    slug?: string;
    is_active?: boolean;
}) {
    const positionResult = await supabase
        .from('course_categories')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
    if (positionResult.error) {
        throw positionResult.error;
    }
    const nextDisplayOrder = (positionResult.data?.[0]?.display_order ?? 0) + 1;
    const result = await supabase
        .from('course_categories')
        .insert({
        name: input.name.trim(),
        slug: input.slug?.trim() || slugify(input.name),
        display_order: nextDisplayOrder,
        is_active: input.is_active ?? true,
    })
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as CourseCategory;
}
export async function updateCourseCategory(categoryId: string, input: {
    name: string;
    slug?: string;
    is_active?: boolean;
}) {
    const result = await supabase
        .from('course_categories')
        .update({
        name: input.name.trim(),
        slug: input.slug?.trim() || slugify(input.name),
        is_active: input.is_active ?? true,
    })
        .eq('id', categoryId)
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as CourseCategory;
}
export async function deleteCourseCategory(categoryId: string) {
    const result = await supabase
        .from('course_categories')
        .delete()
        .eq('id', categoryId);
    if (result.error) {
        throw result.error;
    }
}
export async function createCourse(input: CourseFormInput, userId: string) {
    const categories = getCourseCategories({
        category: input.category,
        categories: input.categories,
    });
    const positionResult = await supabase
        .from('courses')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
    if (positionResult.error) {
        throw positionResult.error;
    }
    const nextDisplayOrder = (positionResult.data?.[0]?.display_order ?? 0) + 1;
    const payload = {
        title: input.title,
        category: categories[0] ?? null,
        categories,
        description: input.description?.trim() || null,
        public_page_content: {
            cardAuthorName: input.card_author_name?.trim() || '',
            cardAuthorDescription: input.card_author_description?.trim() || '',
        },
        status: input.status,
        display_order: nextDisplayOrder,
        thumbnail_url: normalizeCourseMediaValue(input.thumbnail_url),
        cover_image_url: normalizeCourseMediaValue(input.thumbnail_url),
        hero_video_url: input.hero_video_url?.trim() || null,
        logo_url: normalizeCourseMediaValue(input.logo_url),
        student_hero_image_url: normalizeCourseMediaValue(input.student_hero_image_url),
        show_reviews: input.show_reviews ?? true,
        resource_item_ids: input.resource_item_ids ?? [],
        slug: input.slug?.trim() || slugify(input.title),
        launch_date: input.launch_date?.trim() || null,
        price_cents: input.price_cents ?? 0,
        currency: input.currency,
        is_public: input.is_public,
        access_expiration_mode: input.access_expiration_mode,
        access_expiration_date: input.access_expiration_date?.trim() || null,
        access_expiration_days: input.access_expiration_days ?? null,
        creator_id: input.creator_id || null,
        creator_commission_percent: input.creator_commission_percent ?? 0,
        quiz_type_settings: normalizeCourseQuizTypeSettings(input.quiz_type_settings),
        created_by: userId,
    };
    let result = await supabase
        .from('courses')
        .insert(payload)
        .select('*')
        .single();
    if (result.error && isLegacyCourseSalesSchemaError(result.error)) {
        result = await supabase
            .from('courses')
            .insert(stripLegacyCourseSalesFields(payload))
            .select('*')
            .single();
    }
    if (result.error) {
        throw result.error;
    }
    await syncLegacyCourseAuthors(result.data.id, {
        creator_id: input.creator_id,
        creator_commission_percent: input.creator_commission_percent,
    });
    return normalizeCourseRecord(result.data as Course);
}
async function syncLegacyCourseAuthors(courseId: string, input: Pick<CourseFormInput, 'creator_id' | 'creator_commission_percent'>) {
    const existingAuthorsResult = await supabase
        .from('course_authors')
        .select('id, author_id, commission_percent, display_order')
        .eq('course_id', courseId)
        .order('display_order', { ascending: true });
    if (existingAuthorsResult.error) {
        throw existingAuthorsResult.error;
    }
    const existingAuthors = (existingAuthorsResult.data as Pick<CourseAuthor, 'id' | 'author_id' | 'commission_percent' | 'display_order'>[] | null) ?? [];
    if (existingAuthors.some((author) => !author.author_id)) {
        return;
    }
    if (existingAuthors.length > 1) {
        return;
    }
    const nextCreatorId = input.creator_id?.trim() || '';
    if (!nextCreatorId) {
        if (existingAuthors.length > 0) {
            const deleteResult = await supabase
                .from('course_authors')
                .delete()
                .eq('course_id', courseId);
            if (deleteResult.error) {
                throw deleteResult.error;
            }
        }
        return;
    }
    if (existingAuthors.length > 0) {
        const deleteResult = await supabase
            .from('course_authors')
            .delete()
            .eq('course_id', courseId);
        if (deleteResult.error) {
            throw deleteResult.error;
        }
    }
    const upsertResult = await supabase
        .from('course_authors')
        .upsert({
        course_id: courseId,
        author_id: nextCreatorId,
        commission_percent: input.creator_commission_percent ?? 0,
        display_order: 1,
    }, { onConflict: 'course_id,author_id' });
    if (upsertResult.error) {
        throw upsertResult.error;
    }
}
export async function updateCoursesDisplayOrder(courses: Pick<Course, 'id' | 'display_order'>[]) {
    for (const course of courses) {
        const result = await supabase
            .from('courses')
            .update({ display_order: course.display_order })
            .eq('id', course.id);
        if (result.error) {
            throw result.error;
        }
    }
}
export async function updateCourse(courseId: string, input: CourseFormInput) {
    const categories = getCourseCategories({
        category: input.category,
        categories: input.categories,
    });
    const currentContentResult = await supabase
        .from('courses')
        .select('public_page_content')
        .eq('id', courseId)
        .single();
    if (currentContentResult.error) {
        throw currentContentResult.error;
    }
    const currentPublicPageContent = currentContentResult.data?.public_page_content;
    const nextPublicPageContent = currentPublicPageContent && typeof currentPublicPageContent === 'object' && !Array.isArray(currentPublicPageContent)
        ? { ...(currentPublicPageContent as Record<string, unknown>) }
        : {};
    nextPublicPageContent.cardAuthorName = input.card_author_name?.trim() || '';
    nextPublicPageContent.cardAuthorDescription = input.card_author_description?.trim() || '';
    const payload = {
        title: input.title,
        category: categories[0] ?? null,
        categories,
        description: input.description?.trim() || null,
        public_page_content: nextPublicPageContent,
        status: input.status,
        thumbnail_url: normalizeCourseMediaValue(input.thumbnail_url),
        cover_image_url: normalizeCourseMediaValue(input.thumbnail_url),
        hero_video_url: input.hero_video_url?.trim() || null,
        logo_url: normalizeCourseMediaValue(input.logo_url),
        student_hero_image_url: normalizeCourseMediaValue(input.student_hero_image_url),
        show_reviews: input.show_reviews ?? true,
        resource_item_ids: input.resource_item_ids ?? [],
        slug: input.slug?.trim() || slugify(input.title),
        launch_date: input.launch_date?.trim() || null,
        price_cents: input.price_cents ?? 0,
        currency: input.currency,
        is_public: input.is_public,
        creator_id: input.creator_id || null,
        creator_commission_percent: input.creator_commission_percent ?? 0,
        has_linear_progression: input.has_linear_progression,
        quiz_type_settings: normalizeCourseQuizTypeSettings(input.quiz_type_settings),
    };
    let result = await supabase
        .from('courses')
        .update(payload)
        .eq('id', courseId)
        .select('*')
        .single();
    if (result.error && isLegacyCourseSalesSchemaError(result.error)) {
        result = await supabase
            .from('courses')
            .update(stripLegacyCourseSalesFields(payload))
            .eq('id', courseId)
            .select('*')
            .single();
    }
    if (result.error) {
        throw result.error;
    }
    await syncLegacyCourseAuthors(courseId, {
        creator_id: input.creator_id,
        creator_commission_percent: input.creator_commission_percent,
    });
    return normalizeCourseRecord(result.data as Course);
}
export async function updateCoursePublicPage(courseId: string, input: CoursePublicPageFormInput) {
    const currentResult = await supabase
        .from('courses')
        .select('category,categories,public_page_content,creator_id,creator_commission_percent,marketing_description')
        .eq('id', courseId)
        .maybeSingle();
    if (currentResult.error) {
        throw currentResult.error;
    }
    const existingCategories = getCourseCategories({
        category: currentResult.data?.category ?? null,
        categories: currentResult.data?.categories ?? undefined,
    });
    const existingPublicPageContent = normalizeCoursePublicPageContent(currentResult.data?.public_page_content);
    const existingPrimaryCreatorId = currentResult.data?.creator_id ?? null;
    const existingPrimaryCommissionPercent = currentResult.data?.creator_commission_percent ?? 0;
    const nextPrimaryCategory = normalizeCoursePrimaryCategory(input.category);
    const categories = nextPrimaryCategory
        ? [nextPrimaryCategory, ...existingCategories.filter((category) => category.toLocaleLowerCase('pt-BR') !== nextPrimaryCategory.toLocaleLowerCase('pt-BR'))]
        : existingCategories;
    const publicPageContent: CoursePublicPageContentInput = {
        categoryLine: input.categoryLine?.trim() || null,
        authorContent: sanitizeRichTextHtml(input.authorContent?.trim() || ''),
        cardAuthorName: existingPublicPageContent.cardAuthorName,
        cardAuthorDescription: existingPublicPageContent.cardAuthorDescription,
        aboutParagraphs: input.aboutParagraphs.map((paragraph) => sanitizeRichTextHtml(paragraph.trim())),
        outcomes: existingPublicPageContent.outcomes,
        includedItems: existingPublicPageContent.includedItems,
        bonusSection: {
            enabled: input.bonus_enabled,
            title: input.bonus_title?.trim() || 'Prévia de conteúdo',
            description: sanitizeRichTextHtml(input.mentor_bio?.trim() || ''),
        },
        contentSource: input.contentSource,
        customSyllabus: input.customSyllabus,
    };
    const normalizedAuthors = Array.isArray(input.authors)
        ? input.authors
            .map((author, index) => ({
            author_id: author.author_id?.trim() || null,
            commission_percent: Number(author.commission_percent ?? 0),
            display_order: Number.isFinite(Number(author.display_order)) && Number(author.display_order) > 0
                ? Math.max(1, Math.trunc(Number(author.display_order)))
                : index + 1,
            }))
            .filter((author) => Boolean(author.author_id))
        : [];
    const fallbackAuthors = existingPrimaryCreatorId
        ? [{
                author_id: existingPrimaryCreatorId,
                commission_percent: 100,
                display_order: 1,
            }]
        : [];
    const desiredAuthors = normalizedAuthors.length > 0 ? normalizedAuthors : fallbackAuthors;
    const authorTotal = desiredAuthors.reduce((total, author) => total + author.commission_percent, 0);
    if (desiredAuthors.length > 0 && Math.round(authorTotal * 100) / 100 !== 100) {
        throw new Error('A soma das comissões dos autores precisa fechar em 100%.');
    }
    const result = await supabase
        .from('courses')
        .update({
        category: categories[0] ?? null,
        categories,
        hero_video_url: input.hero_video_url?.trim() || null,
        logo_url: normalizeCourseMediaValue(input.logo_url),
        mentor_name: input.mentor_name?.trim() || null,
        mentor_role: input.mentor_role?.trim() || null,
        mentor_bio: sanitizeRichTextHtml(input.mentor_bio?.trim() || '') || null,
        mentor_initials: input.mentor_initials?.trim() || null,
        secondary_price_label: input.secondary_price_label.trim(),
        public_page_content: publicPageContent,
        creator_id: desiredAuthors.length ? desiredAuthors[0]?.author_id ?? null : existingPrimaryCreatorId,
        creator_commission_percent: desiredAuthors[0]?.commission_percent ?? existingPrimaryCommissionPercent,
    })
        .eq('id', courseId)
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    const existingAuthorsResult = await supabase
        .from('course_authors')
        .select('id')
        .eq('course_id', courseId);
    if (existingAuthorsResult.error) {
        throw existingAuthorsResult.error;
    }
    if (existingAuthorsResult.data?.length) {
        const deleteResult = await supabase
            .from('course_authors')
            .delete()
            .eq('course_id', courseId);
        if (deleteResult.error) {
            throw deleteResult.error;
        }
    }
    for (const author of desiredAuthors) {
        const insertResult = await supabase
            .from('course_authors')
            .insert({
                course_id: courseId,
                author_id: author.author_id,
                commission_percent: author.commission_percent,
                display_order: author.display_order,
            });
        if (insertResult.error) {
            throw insertResult.error;
        }
    }
    return normalizeCourseRecord(result.data as Course);
}
export interface ResetCourseProgressResult {
    course_id: string;
    course_title: string;
    impacted_students: number;
    deleted_counts: {
        course_progress: number;
        lesson_progress: number;
        assessment_attempts: number;
        assessment_attempt_requests: number;
        assessment_attempt_grants: number;
    };
    message: string;
}
export async function resetCourseProgress(courseId: string, session: Session) {
    const response = await fetch('/api/admin/courses/reset-progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ courseId }),
    });
    const payload = await response.json().catch(() => null) as {
        error?: string;
    } | ResetCourseProgressResult | null;
    if (!response.ok) {
        throw new Error(payload && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : "Não foi possível renovar o progresso do curso.");
    }
    return payload as ResetCourseProgressResult;
}
export async function deleteCourse(courseId: string) {
    const result = await supabase.from('courses').delete().eq('id', courseId);
    if (result.error) {
        throw result.error;
    }
}
export async function fetchCourse(courseId: string): Promise<Course | null> {
    const result = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    return result.data ? normalizeCourseRecord(result.data as Course) : null;
}
export async function fetchModules(courseId: string): Promise<CourseModule[]> {
    const result = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });
    if (result.error) {
        throw result.error;
    }
    return (result.data as CourseModule[]) ?? [];
}
export async function createModule(courseId: string, input: ModuleFormInput) {
    const positionResult = await supabase
        .from('course_modules')
        .select('position')
        .eq('course_id', courseId)
        .order('position', { ascending: false })
        .limit(1);
    if (positionResult.error) {
        throw positionResult.error;
    }
    const nextPosition = (positionResult.data?.[0]?.position ?? 0) + 1;
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
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as CourseModule;
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
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as CourseModule;
}
export async function deleteModule(moduleId: string) {
    const result = await supabase.from('course_modules').delete().eq('id', moduleId);
    if (result.error) {
        throw result.error;
    }
}
export async function moveModule(module: CourseModule, targetModule: CourseModule) {
    await swapPositions('course_modules', module.id, module.position, targetModule.id, targetModule.position);
}
export async function reorderModules(courseId: string, orderedModuleIds: string[]) {
    const result = await supabase.rpc('reorder_course_modules', {
        _course_id: courseId,
        _ordered_module_ids: orderedModuleIds,
    });
    if (result.error) {
        throw result.error;
    }
}
export async function fetchModule(moduleId: string): Promise<CourseModule | null> {
    const result = await supabase
        .from('course_modules')
        .select('*')
        .eq('id', moduleId)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    return (result.data as CourseModule | null) ?? null;
}
export async function fetchLessons(moduleId: string): Promise<Lesson[]> {
    const result = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('position', { ascending: true });
    if (result.error) {
        throw result.error;
    }
    return (result.data as Lesson[]) ?? [];
}
export async function createLesson(moduleId: string, input: LessonFormInput) {
    const positionResult = await supabase
        .from('lessons')
        .select('position')
        .eq('module_id', moduleId)
        .order('position', { ascending: false })
        .limit(1);
    if (positionResult.error) {
        throw positionResult.error;
    }
    const nextPosition = (positionResult.data?.[0]?.position ?? 0) + 1;
    const result = await supabase
        .from('lessons')
        .insert({
        module_id: moduleId,
        title: input.title,
        description: input.description?.trim() || null,
        is_required: input.is_required,
        is_free_preview: input.is_free_preview ?? false,
        lesson_type: input.lesson_type,
        youtube_url: input.youtube_url?.trim() || null,
        text_content: input.text_content?.trim() || null,
        estimated_minutes: input.estimated_minutes,
        starts_at: input.starts_at?.trim() || null,
        ends_at: input.ends_at?.trim() || null,
        position: nextPosition,
    })
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as Lesson;
}
export async function updateLesson(lessonId: string, input: LessonFormInput) {
    const result = await supabase
        .from('lessons')
        .update({
        title: input.title,
        description: input.description?.trim() || null,
        is_required: input.is_required,
        is_free_preview: input.is_free_preview ?? false,
        lesson_type: input.lesson_type,
        youtube_url: input.youtube_url?.trim() || null,
        text_content: input.text_content?.trim() || null,
        estimated_minutes: input.estimated_minutes,
        starts_at: input.starts_at?.trim() || null,
        ends_at: input.ends_at?.trim() || null,
    })
        .eq('id', lessonId)
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as Lesson;
}
export async function deleteLesson(lessonId: string) {
    const result = await supabase.from('lessons').delete().eq('id', lessonId);
    if (result.error) {
        throw result.error;
    }
}
export async function moveLesson(lesson: Lesson, targetLesson: Lesson) {
    await swapPositions('lessons', lesson.id, lesson.position, targetLesson.id, targetLesson.position);
}
export async function reorderLessons(moduleId: string, orderedLessonIds: string[]) {
    const result = await supabase.rpc('reorder_module_lessons', {
        _module_id: moduleId,
        _ordered_lesson_ids: orderedLessonIds,
    });
    if (result.error) {
        throw result.error;
    }
}
export async function fetchLesson(lessonId: string): Promise<Lesson | null> {
    const result = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    return (result.data as Lesson | null) ?? null;
}
export async function fetchMaterials(lessonId: string): Promise<LessonMaterial[]> {
    const result = await supabase
        .from('lesson_materials')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false });
    if (result.error) {
        throw result.error;
    }
    return (result.data as LessonMaterial[]) ?? [];
}
export async function uploadMaterial(lessonId: string, file: File, userId: string, options?: {
    onProgress?: (snapshot: UploadProgressSnapshot) => void;
}) {
    const uploadTicket = await prepareStorageUpload({
        uploadKind: 'lesson_material',
        entityId: lessonId,
        file,
    });
    await uploadFileWithTicket(uploadTicket, file, {
        onProgress: options?.onProgress,
    });
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
        .single();
    if (metadataResult.error) {
        await deleteStorageObject({
            uploadKind: 'lesson_material',
            storagePath: uploadTicket.upload_path,
            provider: uploadTicket.storage_provider,
            storageBucket: uploadTicket.storage_bucket,
        });
        throw metadataResult.error;
    }
    return metadataResult.data as LessonMaterial;
}
export async function deleteMaterial(material: LessonMaterial) {
    await deleteStorageObject({
        uploadKind: 'lesson_material',
        storagePath: material.storage_path,
        provider: material.storage_provider ?? 'supabase',
        storageBucket: MATERIALS_BUCKET,
    });
    const metadataDeleteResult = await supabase
        .from('lesson_materials')
        .delete()
        .eq('id', material.id);
    if (metadataDeleteResult.error) {
        throw metadataDeleteResult.error;
    }
}
export async function getSignedMaterialUrl(storagePath: string, expiresInSeconds = 60 * 10) {
    const accessToken = await getAccessTokenOrThrow();
    const response = await supabase.functions.invoke<{
        signed_url: string;
    }>('generate-asset-access', {
        body: {
            access_token: accessToken,
            storage_path: storagePath,
            expires_in_seconds: expiresInSeconds,
        },
    });
    if (response.error || !response.data?.signed_url) {
        throw new Error(response.error?.message ?? "Não foi possível gerar URL assinada do material.");
    }
    return response.data.signed_url;
}
export async function uploadModulePdf(moduleId: string, file: File) {
    const ticket = await prepareStorageUpload({
        uploadKind: 'module_pdf',
        entityId: moduleId,
        file,
    });
    await uploadFileWithTicket(ticket, file);
    const metadataResult = await supabase
        .from('course_modules')
        .update({
        module_pdf_storage_path: ticket.upload_path,
        module_pdf_storage_provider: ticket.storage_provider,
        module_pdf_file_name: file.name,
        module_pdf_uploaded_at: new Date().toISOString(),
    })
        .eq('id', moduleId)
        .select('module_pdf_storage_path, module_pdf_storage_provider, module_pdf_file_name, module_pdf_uploaded_at')
        .single();
    if (metadataResult.error) {
        await deleteStorageObject({
            uploadKind: 'module_pdf',
            storagePath: ticket.upload_path,
            storageBucket: MODULE_PDFS_BUCKET,
        });
        throw metadataResult.error;
    }
    const row = metadataResult.data as {
        module_pdf_storage_path: string;
        module_pdf_storage_provider: 'supabase' | 'r2';
        module_pdf_file_name: string;
        module_pdf_uploaded_at: string | null;
    };
    return {
        storage_path: row.module_pdf_storage_path,
        storage_provider: row.module_pdf_storage_provider,
        file_name: row.module_pdf_file_name,
        uploaded_at: row.module_pdf_uploaded_at,
    } satisfies ModulePdfAsset;
}
export async function deleteModulePdf(module: Pick<CourseModule, 'id' | 'module_pdf_storage_path' | 'module_pdf_storage_provider'>) {
    if (module.module_pdf_storage_path) {
        await deleteStorageObject({
            uploadKind: 'module_pdf',
            storagePath: module.module_pdf_storage_path,
            storageBucket: MODULE_PDFS_BUCKET,
            provider: module.module_pdf_storage_provider ?? 'supabase',
        });
    }
    const result = await supabase
        .from('course_modules')
        .update({
        module_pdf_storage_path: null,
        module_pdf_file_name: null,
        module_pdf_uploaded_at: null,
    })
        .eq('id', module.id);
    if (result.error) {
        throw result.error;
    }
}
export async function getSignedModulePdfUrl(storagePath: string, storageProvider: 'supabase' | 'r2' = 'r2') {
    const response = await supabase.functions.invoke<{ signed_url: string }>('generate-asset-access', {
        body: {
        access_token: (await supabase.auth.getSession()).data.session?.access_token ?? '',
        asset_kind: 'module_pdf',
        storage_bucket: MODULE_PDFS_BUCKET,
        storage_provider: storageProvider,
        storage_path: storagePath,
            expires_in_seconds: 60 * 10,
        },
    });
    if (response.error || !response.data?.signed_url) {
        throw new Error(response.error?.message ?? 'Não foi possível gerar URL assinada do PDF.');
    }
    return response.data.signed_url;
}
export async function uploadLessonContentAsset(file: File, options?: {
    contentType?: string;
}) {
    const ticket = await prepareStorageUpload({
        uploadKind: 'lesson_content_asset',
        entityId: 'lesson-content',
        file,
        mimeType: options?.contentType,
    });
    await uploadFileWithTicket(ticket, file);
    const signedUrl = await getSignedLessonContentAssetUrl(ticket.upload_path, ticket.storage_provider);
    return {
        storage_path: ticket.upload_path,
        storage_provider: ticket.storage_provider,
        signed_url: signedUrl,
    };
}
export async function deleteLessonContentAsset(storagePath: string, storageProvider: 'supabase' | 'r2' = 'r2') {
    await deleteStorageObject({
        uploadKind: 'lesson_content_asset',
        storagePath,
        storageBucket: LESSON_CONTENT_ASSETS_BUCKET,
        provider: storageProvider,
    });
}
export async function getSignedLessonContentAssetUrl(storagePath: string, storageProvider: 'supabase' | 'r2' = 'r2') {
    const response = await supabase.functions.invoke<{ signed_url: string }>('generate-asset-access', {
        body: {
        access_token: (await supabase.auth.getSession()).data.session?.access_token ?? '',
        asset_kind: 'lesson_content_asset',
        storage_bucket: LESSON_CONTENT_ASSETS_BUCKET,
        storage_provider: storageProvider,
        storage_path: storagePath,
            expires_in_seconds: 60 * 60,
        },
    });
    if (response.error || !response.data?.signed_url) {
        throw new Error(response.error?.message ?? 'Não foi possível gerar URL assinada do asset.');
    }
    return response.data.signed_url;
}
export async function fetchButtonTemplates() {
    const result = await supabase
        .from('button_templates')
        .select('*')
        .order('name', { ascending: true });
    if (result.error) {
        throw result.error;
    }
    return (result.data as ButtonTemplate[]) ?? [];
}
export async function createButtonTemplate(input: ButtonTemplateFormInput) {
    const result = await supabase
        .from('button_templates')
        .insert(input)
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as ButtonTemplate;
}
export async function updateButtonTemplate(templateId: string, input: ButtonTemplateFormInput) {
    const result = await supabase
        .from('button_templates')
        .update(input)
        .eq('id', templateId)
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as ButtonTemplate;
}
export async function deleteButtonTemplate(templateId: string) {
    const result = await supabase
        .from('button_templates')
        .delete()
        .eq('id', templateId);
    if (result.error) {
        throw result.error;
    }
}
type FooterActionContext = {
    scope: FooterActionScope;
    lessonId?: string | null;
    moduleId?: string | null;
    courseId?: string | null;
};
const FOOTER_ACTION_SCOPE_ORDER: Record<FooterActionScope, number> = {
    course: 0,
    module: 1,
    lesson: 2,
};
function getFooterActionStoragePrefix(context: FooterActionContext) {
    switch (context.scope) {
        case 'course':
            if (!context.courseId) {
                throw new Error('Curso ausente para o botão global.');
            }
            return `courses/${context.courseId}`;
        case 'module':
            if (!context.moduleId) {
                throw new Error('Módulo ausente para o botão global.');
            }
            return `modules/${context.moduleId}`;
        case 'lesson':
        default:
            if (!context.lessonId) {
                throw new Error('Aula ausente para o botão da aula.');
            }
            return `lessons/${context.lessonId}`;
    }
}
function resolveFooterActionInsertPayload(context: FooterActionContext, input: LessonFooterActionFormInput, userId: string, storagePath: string | null, file?: File | null) {
    const payload: Record<string, unknown> = {
        scope: context.scope,
        template_id: input.template_id ?? null,
        action_type: input.action_type,
        label: input.label?.trim() || null,
        url: input.action_type === 'url' ? input.url?.trim() || null : null,
        storage_path: storagePath,
        file_name: null,
        mime_type: null,
        file_size_bytes: 0,
        position: input.position,
        open_target: input.open_target,
        open_in_new_tab: input.open_target !== 'same-tab',
        is_active: input.is_active,
        created_by: userId,
        lesson_id: context.scope === 'lesson' ? context.lessonId ?? null : null,
        module_id: context.scope === 'module' ? context.moduleId ?? null : null,
        course_id: context.scope === 'course' ? context.courseId ?? null : null,
    };
    if (input.action_type === 'file' && file) {
        payload.file_name = file.name;
        payload.mime_type = file.type || null;
        payload.file_size_bytes = file.size;
    }
    return payload;
}
async function fetchFooterActionsByScope(context: FooterActionContext) {
    if (context.scope === 'lesson' && !context.lessonId) {
        return [];
    }
    if (context.scope === 'module' && !context.moduleId) {
        return [];
    }
    if (context.scope === 'course' && !context.courseId) {
        return [];
    }
    const query = supabase
        .from('lesson_footer_actions')
        .select('*, template:button_templates(*)')
        .eq('scope', context.scope)
        .order('position', { ascending: true });
    const scopedQuery = context.scope === 'lesson'
        ? query.eq('lesson_id', context.lessonId)
        : context.scope === 'module'
            ? query.eq('module_id', context.moduleId)
            : query.eq('course_id', context.courseId);
    const result = await scopedQuery;
    if (result.error) {
        throw result.error;
    }
    return (result.data as LessonFooterAction[]) ?? [];
}

async function resolveFooterActionStorage(storagePath: string) {
    const materialResult = await supabase
        .from('lesson_materials')
        .select('storage_provider')
        .eq('storage_path', storagePath)
        .limit(1)
        .maybeSingle();
    if (materialResult.error) {
        throw materialResult.error;
    }
    if (materialResult.data) {
        return {
            bucket: MATERIALS_BUCKET,
            provider: materialResult.data.storage_provider ?? 'supabase',
            shouldDeleteObject: false,
        } as const;
    }
    return {
        bucket: LESSON_FOOTER_ASSETS_BUCKET,
        provider: 'r2' as const,
        shouldDeleteObject: true,
    };
}
export async function fetchLessonFooterActions(lessonId: string) {
    const lessonResult = await supabase
        .from('lessons')
        .select('id, module_id')
        .eq('id', lessonId)
        .single();
    if (lessonResult.error) {
        throw lessonResult.error;
    }
    const moduleResult = await supabase
        .from('course_modules')
        .select('id, course_id')
        .eq('id', lessonResult.data?.module_id)
        .single();
    if (moduleResult.error) {
        throw moduleResult.error;
    }
    const [courseActions, moduleActions, lessonActions] = await Promise.all([
        fetchFooterActionsByScope({ scope: 'course', courseId: moduleResult.data?.course_id ?? null }),
        fetchFooterActionsByScope({ scope: 'module', moduleId: lessonResult.data?.module_id ?? null }),
        fetchFooterActionsByScope({ scope: 'lesson', lessonId }),
    ]);
    return [...courseActions, ...moduleActions, ...lessonActions].sort((first, second) => {
        const scopeDelta = FOOTER_ACTION_SCOPE_ORDER[first.scope] - FOOTER_ACTION_SCOPE_ORDER[second.scope];
        if (scopeDelta !== 0) {
            return scopeDelta;
        }
        if (first.position !== second.position) {
            return first.position - second.position;
        }
        return first.created_at.localeCompare(second.created_at);
    });
}
export async function fetchModuleFooterActions(moduleId: string) {
    return fetchFooterActionsByScope({ scope: 'module', moduleId });
}
export async function fetchCourseFooterActions(courseId: string) {
    return fetchFooterActionsByScope({ scope: 'course', courseId });
}
async function createFooterAction(context: FooterActionContext, input: LessonFooterActionFormInput, userId: string, file?: File | null) {
    if (input.action_type === 'file' && !file) {
        throw new Error('Selecione um arquivo para o botão.');
    }
    let storagePath: string | null = null;
    if (input.action_type === 'file' && file) {
        const entityId = getFooterActionStoragePrefix(context);
        const ticket = await prepareStorageUpload({
            uploadKind: 'lesson_footer_asset',
            entityId,
            file,
        });
        await uploadFileWithTicket(ticket, file);
        storagePath = ticket.upload_path;
    }
    const result = await supabase
        .from('lesson_footer_actions')
        .insert(resolveFooterActionInsertPayload(context, input, userId, storagePath, file))
        .select('*, template:button_templates(*)')
        .single();
    if (result.error) {
        if (storagePath) {
            await deleteStorageObject({
                uploadKind: 'lesson_footer_asset',
                storagePath,
                storageBucket: LESSON_FOOTER_ASSETS_BUCKET,
            });
        }
        throw result.error;
    }
    return result.data as LessonFooterAction;
}
export async function createLessonFooterAction(lessonId: string, input: LessonFooterActionFormInput, userId: string, file?: File | null) {
    if (!lessonId) {
        throw new Error('Aula ausente para criar o botão.');
    }
    return createFooterAction({ scope: 'lesson', lessonId }, input, userId, file);
}
export async function createModuleFooterAction(moduleId: string, input: LessonFooterActionFormInput, userId: string, file?: File | null) {
    if (!moduleId) {
        throw new Error('Módulo ausente para criar o botão.');
    }
    return createFooterAction({ scope: 'module', moduleId }, input, userId, file);
}
export async function createCourseFooterAction(courseId: string, input: LessonFooterActionFormInput, userId: string, file?: File | null) {
    if (!courseId) {
        throw new Error('Curso ausente para criar o botão.');
    }
    return createFooterAction({ scope: 'course', courseId }, input, userId, file);
}
export async function updateLessonFooterAction(actionId: string, input: LessonFooterActionFormInput, file?: File | null) {
    const currentResult = await supabase
        .from('lesson_footer_actions')
        .select('*')
        .eq('id', actionId)
        .single();
    if (currentResult.error) {
        throw currentResult.error;
    }
    const current = currentResult.data as LessonFooterAction;
    let storagePath = current.storage_path;
    let fileName = current.file_name;
    let mimeType = current.mime_type;
    let fileSizeBytes = current.file_size_bytes;
    if (input.action_type === 'file' && file) {
        const contextPrefix = current.scope === 'course'
            ? `courses/${current.course_id}`
            : current.scope === 'module'
                ? `modules/${current.module_id}`
                : `lessons/${current.lesson_id}`;
        if (contextPrefix.includes('null')) {
            throw new Error('Não foi possível identificar o destino do arquivo do botão.');
        }
        const ticket = await prepareStorageUpload({
            uploadKind: 'lesson_footer_asset',
            entityId: contextPrefix,
            file,
        });
        await uploadFileWithTicket(ticket, file);
        if (current.storage_path) {
            const currentStorage = await resolveFooterActionStorage(current.storage_path);
            if (currentStorage.shouldDeleteObject) {
                await deleteStorageObject({
                    uploadKind: 'lesson_footer_asset',
                    storagePath: current.storage_path,
                    storageBucket: currentStorage.bucket,
                    provider: currentStorage.provider,
                });
            }
        }
        storagePath = ticket.upload_path;
        fileName = file.name;
        mimeType = file.type || null;
        fileSizeBytes = file.size;
    }
    const result = await supabase
        .from('lesson_footer_actions')
        .update({
        scope: current.scope,
        template_id: input.template_id ?? null,
        action_type: input.action_type,
        label: input.label?.trim() || null,
        url: input.action_type === 'url' ? input.url?.trim() || null : null,
        lesson_id: current.scope === 'lesson' ? current.lesson_id : null,
        module_id: current.scope === 'module' ? current.module_id : null,
        course_id: current.scope === 'course' ? current.course_id : null,
        storage_path: input.action_type === 'file' ? storagePath : null,
        file_name: input.action_type === 'file' ? fileName : null,
        mime_type: input.action_type === 'file' ? mimeType : null,
        file_size_bytes: input.action_type === 'file' ? fileSizeBytes : 0,
        position: input.position,
        open_target: input.open_target,
        open_in_new_tab: input.open_target !== 'same-tab',
        is_active: input.is_active,
    })
        .eq('id', actionId)
        .select('*, template:button_templates(*)')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as LessonFooterAction;
}
export async function deleteLessonFooterAction(action: LessonFooterAction) {
    if (action.storage_path) {
        const storage = await resolveFooterActionStorage(action.storage_path);
        if (storage.shouldDeleteObject) {
            await deleteStorageObject({
                uploadKind: 'lesson_footer_asset',
                storagePath: action.storage_path,
                storageBucket: storage.bucket,
                provider: storage.provider,
            });
        }
    }
    const result = await supabase
        .from('lesson_footer_actions')
        .delete()
        .eq('id', action.id);
    if (result.error) {
        throw result.error;
    }
}
export async function getSignedLessonFooterActionUrl(storagePath: string) {
    const storage = await resolveFooterActionStorage(storagePath);
    const response = await supabase.functions.invoke<{ signed_url: string }>('generate-asset-access', {
        body: {
        access_token: (await supabase.auth.getSession()).data.session?.access_token ?? '',
        asset_kind: 'lesson_footer_asset',
        storage_bucket: storage.bucket,
        storage_provider: storage.provider,
        storage_path: storagePath,
            expires_in_seconds: 60 * 10,
        },
    });
    if (response.error || !response.data?.signed_url) {
        throw new Error(response.error?.message ?? 'Não foi possível gerar URL assinada do arquivo.');
    }
    return response.data.signed_url;
}
export type AdminCourseTree = {
    course: Course;
    courseAuthors: CourseAuthor[];
    modules: (CourseModule & {
        lessons: Lesson[];
        assessments: Assessment[];
    })[];
    courseAssessments: Assessment[];
};
export async function fetchAdminCourseTree(courseId: string): Promise<AdminCourseTree> {
    const [courseResult, courseAuthorsResult, modulesResult, lessonsResult, assessmentsResult] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('course_authors').select('*').eq('course_id', courseId).order('display_order', { ascending: true }),
        supabase.from('course_modules').select('*').eq('course_id', courseId).order('position', { ascending: true }),
        supabase.from('lessons').select('*, course_modules!inner(course_id)').eq('course_modules.course_id', courseId).order('position', { ascending: true }),
        supabase.from('assessments').select('*').eq('course_id', courseId).order('created_at', { ascending: true })
    ]);
    if (courseResult.error)
        throw courseResult.error;
    if (courseAuthorsResult.error)
        throw courseAuthorsResult.error;
    if (modulesResult.error)
        throw modulesResult.error;
    if (lessonsResult.error)
        throw lessonsResult.error;
    if (assessmentsResult.error)
        throw assessmentsResult.error;
    const course = courseResult.data as Course;
    const courseAuthors = (courseAuthorsResult.data as CourseAuthor[]) ?? [];
    const modules = (modulesResult.data as CourseModule[]) ?? [];
    const lessons = (lessonsResult.data as Lesson[]) ?? [];
    const assessments = (assessmentsResult.data as Assessment[]) ?? [];
    const treeModules = modules.map(m => {
        return {
            ...m,
            lessons: lessons.filter(l => l.module_id === m.id),
            assessments: assessments.filter(a => a.module_id === m.id)
        };
    });
    // Course-level assessments (no module_id or course final assessment)
    const courseAssessments = assessments.filter(a => !a.module_id);
    return { course: normalizeCourseRecord(course), courseAuthors, modules: treeModules, courseAssessments };
}
export function toErrorMessage(error: unknown): string {
    const normalizedError = normalizeSupabaseError(error);
    return normalizedError.message || 'Erro inesperado.';
}
export async function uploadCourseThumbnail(file: File): Promise<string> {
    const ticket = await prepareStorageUpload({
        uploadKind: 'course_media',
        entityId: 'thumbnails',
        file,
    });
    await uploadFileWithTicket(ticket, file);
    return buildCourseMediaPublicUrl(ticket.upload_path) || normalizeCourseMediaPublicUrl(ticket.public_url) || '';
}
export async function uploadCourseLogo(file: File): Promise<string> {
    const ticket = await prepareStorageUpload({
        uploadKind: 'course_media',
        entityId: 'course-logos',
        file,
    });
    await uploadFileWithTicket(ticket, file);
    return buildCourseMediaPublicUrl(ticket.upload_path) || normalizeCourseMediaPublicUrl(ticket.public_url) || '';
}
export async function uploadManualAuthorPhoto(file: File, courseId: string): Promise<string> {
    const ticket = await prepareStorageUpload({
        uploadKind: 'site_asset',
        entityId: `course-authors/${courseId}`,
        file,
    });
    await uploadFileWithTicket(ticket, file);
    return ticket.public_url ?? '';
}
/**
 * IMPORTAÇÃO EM MASSA (IA)
 * Permite subir uma estrutura completa de módulos, aulas e quizzes via JSON.
 */
export interface ImportModuleData {
    title: string;
    description?: string;
    lessons?: {
        title: string;
        description?: string;
        lesson_type: 'video' | 'text' | 'hybrid' | 'file';
        youtube_url?: string;
        text_content?: string;
        blocks?: LessonContentBlock[];
        estimated_minutes?: number;
        is_free_preview?: boolean;
    }[];
    assessments?: {
        title: string;
        description?: string;
        assessment_type: 'module';
        passing_score?: number;
        max_attempts?: number;
        estimated_minutes?: number;
        questions?: ImportAssessmentData['questions'];
        case_studies?: ImportAssessmentData['case_studies'];
    }[];
}
export interface ExportModuleData {
    title: string;
    description?: string;
    lessons?: {
        title: string;
        description?: string;
        lesson_type: 'video' | 'text' | 'hybrid' | 'file';
        youtube_url?: string;
        text_content?: string;
        blocks?: LessonContentBlock[];
        estimated_minutes?: number;
        is_free_preview?: boolean;
    }[];
    assessments?: (ImportAssessmentData & {
        assessment_type: 'module';
    })[];
}
export interface ExportCourseFullData {
    title: string;
    description?: string;
    workload_minutes?: number;
    thumbnail_url?: string;
    cover_image_url?: string;
    hero_video_url?: string;
    logo_url?: string;
    student_hero_image_url?: string;
    show_reviews?: boolean;
    resource_item_ids?: string[];
    status?: 'draft' | 'published' | 'archived';
    quiz_type_settings?: CourseQuizTypeSettings;
    modules: ExportModuleData[];
}
export async function exportModuleContent(moduleId: string): Promise<ExportModuleData> {
    const moduleResult = await supabase
        .from('course_modules')
        .select('*')
        .eq('id', moduleId)
        .single();
    if (moduleResult.error) {
        throw moduleResult.error;
    }
    const module = moduleResult.data as CourseModule;
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
    ]);
    if (lessonsResult.error) {
        throw lessonsResult.error;
    }
    if (assessmentsResult.error) {
        throw assessmentsResult.error;
    }
    const lessons = (lessonsResult.data as Lesson[]) ?? [];
    const assessments = (assessmentsResult.data as Assessment[]) ?? [];
    const exportedAssessments = await Promise.all(assessments.map(async (assessment) => ({
        ...(await exportAssessmentContent(assessment.id)),
        assessment_type: 'module' as const,
    })));
    return {
        title: module.title,
        description: module.description ?? '',
        lessons: lessons.map((lesson) => ({
            title: lesson.title,
            description: lesson.description ?? '',
            lesson_type: lesson.lesson_type,
            youtube_url: lesson.youtube_url ?? '',
            text_content: lesson.text_content ?? '',
            // Inclui a estrutura dos blocos para preservar a edição rica no JSON exportado.
            blocks: splitContent(lesson.text_content ?? ''),
            estimated_minutes: lesson.estimated_minutes,
            is_free_preview: lesson.is_free_preview,
        })),
        assessments: exportedAssessments,
    };
}
export async function exportFullCourseContent(courseId: string): Promise<ExportCourseFullData> {
    const [courseResult, modulesResult] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase
            .from('course_modules')
            .select('*')
            .eq('course_id', courseId)
            .order('position', { ascending: true }),
    ]);
    if (courseResult.error) {
        throw courseResult.error;
    }
    if (modulesResult.error) {
        throw modulesResult.error;
    }
    const course = courseResult.data as Course;
    const modules = (modulesResult.data as CourseModule[]) ?? [];
    const exportedModules = await Promise.all(modules.map((module) => exportModuleContent(module.id)));
    return {
        title: course.title,
        description: course.description ?? '',
        workload_minutes: course.workload_minutes,
        thumbnail_url: course.thumbnail_url ?? '',
        cover_image_url: course.cover_image_url ?? course.thumbnail_url ?? '',
        hero_video_url: course.hero_video_url ?? '',
        logo_url: course.logo_url ?? '',
        student_hero_image_url: course.student_hero_image_url ?? '',
        show_reviews: course.show_reviews,
        resource_item_ids: course.resource_item_ids ?? [],
        status: course.status,
        quiz_type_settings: normalizeCourseQuizTypeSettings(course.quiz_type_settings),
        modules: exportedModules,
    };
}
export async function clearCourseContent(courseId: string) {
    // O cascade delete do banco cuidará das aulas, materiais e quizzes vinculados aos módulos.
    // IMPORTANTE: Deletar primeiro os assessments sem módulo (Assessment Final)
    const { error: aError } = await supabase
        .from('assessments')
        .delete()
        .eq('course_id', courseId)
        .is('module_id', null);
    if (aError)
        throw aError;
    const { error: mError } = await supabase
        .from('course_modules')
        .delete()
        .eq('course_id', courseId);
    if (mError)
        throw mError;
}
async function createModuleLessons(moduleId: string, lessons: ImportModuleData['lessons']) {
    if (!lessons || lessons.length === 0)
        return;
    const resolveLessonTextContent = (lesson: NonNullable<ImportModuleData['lessons']>[number]) => {
        if (Array.isArray(lesson.blocks) && lesson.blocks.length > 0) {
            try {
                return mergeContent(lesson.blocks);
            }
            catch (error) {
                console.warn('Falha ao reconstruir blocks da aula; usando text_content como fallback.', error);
            }
        }
        return lesson.text_content || null;
    };
    const lessonsToInsert = lessons.map((lesson, index) => ({
        module_id: moduleId,
        title: lesson.title,
        description: lesson.description || null,
        lesson_type: lesson.lesson_type,
        youtube_url: lesson.youtube_url || null,
        text_content: resolveLessonTextContent(lesson),
        estimated_minutes: lesson.estimated_minutes || 10,
        is_free_preview: lesson.is_free_preview ?? false,
        position: index + 1,
    }));
    const { error } = await supabase.from('lessons').insert(lessonsToInsert);
    if (error)
        throw error;
}
async function createModuleAssessments(courseId: string, moduleId: string, assessments: ImportModuleData['assessments']) {
    if (!assessments || assessments.length === 0)
        return;
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
            .single();
        if (assessmentError)
            throw assessmentError;
        await importAssessmentContentStructured(assessment.id as string, {
            title: assessmentData.title,
            description: assessmentData.description,
            passing_score: assessmentData.passing_score,
            max_attempts: assessmentData.max_attempts,
            estimated_minutes: assessmentData.estimated_minutes,
            questions: assessmentData.questions,
            case_studies: assessmentData.case_studies,
        });
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
        .eq('course_id', courseId);
    if (updateModuleError)
        throw updateModuleError;
    const { error: deleteAssessmentsError } = await supabase
        .from('assessments')
        .delete()
        .eq('course_id', courseId)
        .eq('module_id', moduleId);
    if (deleteAssessmentsError)
        throw deleteAssessmentsError;
    const { error: deleteLessonsError } = await supabase
        .from('lessons')
        .delete()
        .eq('module_id', moduleId);
    if (deleteLessonsError)
        throw deleteLessonsError;
    await createModuleLessons(moduleId, moduleData.lessons);
    await createModuleAssessments(courseId, moduleId, moduleData.assessments);
}
export async function importCourseContent(courseId: string, input: ImportCourseFullData | ImportModuleData | ImportModuleData[] | ImportAssessmentData, clearExisting: boolean = false, moduleIdToReplace?: string) {
    if (clearExisting) {
        await clearCourseContent(courseId);
    }
    const fullCourseInput = !Array.isArray(input) && 'modules' in input ? input : null;
    const assessmentOnlyInput = !Array.isArray(input) && ('questions' in input || 'case_studies' in input) && !('modules' in input) ? input : null;
    const moduleLikeInput = !Array.isArray(input) && !fullCourseInput && !assessmentOnlyInput && ('lessons' in input || 'assessments' in input)
        ? input
        : null;
    // Se for um curso completo, atualizamos os metadados do curso atual também
    if (fullCourseInput) {
        const { error: updateError } = await supabase
            .from('courses')
            .update({
            title: fullCourseInput.title,
            description: fullCourseInput.description || null,
            workload_minutes: fullCourseInput.workload_minutes || 0,
            thumbnail_url: normalizeCourseMediaValue(fullCourseInput.thumbnail_url),
            cover_image_url: normalizeCourseMediaValue(fullCourseInput.cover_image_url || fullCourseInput.thumbnail_url),
            hero_video_url: fullCourseInput.hero_video_url || null,
            logo_url: normalizeCourseMediaValue(fullCourseInput.logo_url),
            student_hero_image_url: normalizeCourseMediaValue(fullCourseInput.student_hero_image_url),
            show_reviews: fullCourseInput.show_reviews ?? true,
            resource_item_ids: fullCourseInput.resource_item_ids ?? [],
            quiz_type_settings: normalizeCourseQuizTypeSettings(fullCourseInput.quiz_type_settings),
        })
            .eq('id', courseId);
        if (updateError)
            throw updateError;
    }
    const inputModules = Array.isArray(input) ? input : fullCourseInput?.modules;
    const modules = (inputModules ?? (moduleLikeInput ? [moduleLikeInput] : [])) as ImportModuleData[];
    const isAssessmentOnly = assessmentOnlyInput !== null;
    if (modules.length === 0 && !isAssessmentOnly) {
        throw new Error('Nenhum módulo ou conjunto de questões encontrado no JSON para importar.');
    }
    if (moduleIdToReplace && modules.length > 0) {
        await replaceModuleContentInPlace(courseId, moduleIdToReplace, modules[0]);
        if (modules.length === 1) {
            return;
        }
    }
    // Caso especial: Importação de Avaliação Final (sem módulos)
    if (isAssessmentOnly) {
        const assessmentInput = assessmentOnlyInput as ImportAssessmentData | null;
        if (!assessmentInput) {
            throw new Error("Dados da avaliação final inválidos.");
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
            .single();
        if (assessmentError)
            throw assessmentError;
        await importAssessmentContentStructured(assessment.id as string, assessmentInput);
        return;
    }
    // 1. Cálculo da posição inicial
    let startPosition = 0;
    const { data: lastModule } = await supabase
        .from('course_modules')
        .select('position')
        .eq('course_id', courseId)
        .order('position', { ascending: false })
        .limit(1)
        .single();
    if (lastModule) {
        startPosition = lastModule.position;
    }
    const modulesToInsert = moduleIdToReplace ? modules.slice(1) : modules;
    // 2. Loop de inserção
    for (let mIdx = 0; mIdx < modulesToInsert.length; mIdx++) {
        const mData = modulesToInsert[mIdx];
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
            .single();
        if (mError)
            throw mError;
        await createModuleLessons(module.id, mData.lessons);
        await createModuleAssessments(courseId, module.id, mData.assessments);
    }
}
export interface ImportCourseFullData {
    title: string;
    description?: string;
    workload_minutes?: number;
    thumbnail_url?: string;
    cover_image_url?: string;
    hero_video_url?: string;
    logo_url?: string;
    student_hero_image_url?: string;
    show_reviews?: boolean;
    resource_item_ids?: string[];
    status?: 'draft' | 'published';
    quiz_type_settings?: CourseQuizTypeSettings;
    modules: ImportModuleData[];
}
export async function importFullCourse(data: ImportCourseFullData, userId: string) {
    const positionResult = await supabase
        .from('courses')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
    if (positionResult.error)
        throw positionResult.error;
    const nextDisplayOrder = (positionResult.data?.[0]?.display_order ?? 0) + 1;
    // 1. Criar o Curso Base
    const { data: course, error: cError } = await supabase
        .from('courses')
        .insert({
        title: data.title,
        description: data.description || null,
        status: data.status || 'draft',
        display_order: nextDisplayOrder,
        categories: [],
        workload_minutes: data.workload_minutes || 0,
        thumbnail_url: normalizeCourseMediaValue(data.thumbnail_url),
        cover_image_url: normalizeCourseMediaValue(data.cover_image_url || data.thumbnail_url),
        hero_video_url: data.hero_video_url || null,
        logo_url: normalizeCourseMediaValue(data.logo_url),
        student_hero_image_url: normalizeCourseMediaValue(data.student_hero_image_url),
        show_reviews: data.show_reviews ?? true,
        resource_item_ids: data.resource_item_ids ?? [],
        quiz_type_settings: normalizeCourseQuizTypeSettings(data.quiz_type_settings),
        created_by: userId
    })
        .select()
        .single();
    if (cError)
        throw cError;
    // 2. Importar Conteúdo (Módulos/Aulas/Quizzes ou Avaliação Direta)
    await importCourseContent(course.id, data, false);
    return normalizeCourseRecord(course as Course);
}
