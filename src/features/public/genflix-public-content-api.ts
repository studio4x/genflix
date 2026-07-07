import { buildCoursePublicCatalogItem, buildCoursePublicDetail, normalizeCoursePublicPageContent, type CoursePublicPageRowLike, } from '@/features/public/course-public-page-content';
import { publicSupabase } from '@/services/supabase/public-client';
import type { GenflixBlogPost, GenflixCourseDetail, GenflixCourseItem, GenflixCourseModule, } from '@/features/public/genflix-site-content';
import { slugifyCourseCategoryValue } from '@/features/courses/course-categories';
import { normalizeSiteAssetPublicUrl } from '@/features/site-assets/public-url';
import { fixMojibakeText } from '@/lib/text-encoding';
interface PublicCourseRow extends CoursePublicPageRowLike {
    display_order: number;
    launch_date: string | null;
    created_at: string;
}
interface PublicCourseDetailRow extends CoursePublicPageRowLike {
    authors?: unknown;
}
interface PublicAuthorProfileRow {
    user_id: string;
    public_slug: string | null;
    public_title: string | null;
    public_short_bio: string | null;
    public_long_bio: string | null;
    public_areas: string[] | null;
    public_education: string | null;
    public_experience: string | null;
    public_photo_url: string | null;
    public_website_url: string | null;
    public_instagram_url: string | null;
    public_linkedin_url: string | null;
    public_youtube_url: string | null;
    payout_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
    courses: unknown;
}
interface PublicBlogPostRow {
    slug: string;
    title: string;
    category: string | null;
    display_order?: number | null;
    seo_description: string | null;
    excerpt?: string | null;
    image_url: string | null;
    card_image_url?: string | null;
    read_time: string | null;
    author: string | null;
    published_at: string | null;
    content: unknown;
    content_html: string | null;
    featured: boolean;
    status?: string | null;
    created_at?: string | null;
}
interface PublicCourseCategoryRow {
    name: string;
    slug: string;
    display_order: number;
}
export interface PublicCourseCategoryFilter {
    name: string;
    slug: string;
    displayOrder: number;
}
interface PublicBlogCategoryRow {
    id: string;
    name: string;
    slug: string;
    display_order: number;
}
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const publicCourseSelect = 'id, slug, title, description, category, categories, thumbnail_url, cover_image_url, hero_video_url, logo_url, show_reviews, resource_item_ids, marketing_description, mentor_name, mentor_role, mentor_bio, mentor_initials, price_label, secondary_price_label, price_cents, currency, public_page_content, display_order, launch_date, created_at';
const publicBlogPostLegacySelect = 'slug, title, category, display_order, excerpt, image_url, card_image_url, read_time, author, published_at, content, content_html, featured, status';
const publicBlogPostAllLegacySelect = 'slug, title, category, display_order, excerpt, image_url, card_image_url, read_time, author, published_at, content, content_html, featured, status, created_at';
async function fetchPublicRows<T>(path: string, searchParams: URLSearchParams): Promise<T[]> {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração pública do Supabase ausente.');
    }
    const queryString = searchParams.toString();
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}${queryString ? `?${queryString}` : ''}`, {
        cache: 'no-store',
        headers: {
            apikey: supabaseAnonKey,
            'cache-control': 'no-store, max-age=0',
            pragma: 'no-cache',
        },
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Não foi possível carregar o conteúdo público.');
    }
    return (await response.json()) as T[];
}
function toCourseItem(row: PublicCourseRow): GenflixCourseItem {
    return buildCoursePublicCatalogItem(row);
}
function toTimestamp(value: string | null | undefined) {
    if (!value) {
        return null;
    }
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}
function sortPublicCourseRowsByPublicationDate(rows: PublicCourseRow[]) {
    return [...rows].sort((left, right) => {
        const leftPublishedAt = toTimestamp(left.launch_date);
        const rightPublishedAt = toTimestamp(right.launch_date);
        const leftCreatedAt = toTimestamp(left.created_at) ?? 0;
        const rightCreatedAt = toTimestamp(right.created_at) ?? 0;
        const leftSortDate = leftPublishedAt ?? leftCreatedAt;
        const rightSortDate = rightPublishedAt ?? rightCreatedAt;
        if (rightSortDate !== leftSortDate) {
            return rightSortDate - leftSortDate;
        }
        if ((rightPublishedAt ?? 0) !== (leftPublishedAt ?? 0)) {
            return (rightPublishedAt ?? 0) - (leftPublishedAt ?? 0);
        }
        return rightCreatedAt - leftCreatedAt;
    });
}
function normalizeOutlineModule(value: unknown): GenflixCourseModule | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const row = value as {
        title?: unknown;
        items?: unknown;
    };
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const items = Array.isArray(row.items)
        ? row.items.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : [];
    if (!title) {
        return null;
    }
    return {
        title,
        lessonCount: items.length,
        summary: items.length ? `${items.length} itens liberados nesta etapa.` : "Sem itens publicados nesta etapa.",
        items,
        lessonLabel: items.length === 1 ? 'item' : 'itens',
    };
}
async function fetchPublicCourseOutline(courseId: string): Promise<GenflixCourseModule[]> {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração pública do Supabase ausente.');
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_course_outline`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            'cache-control': 'no-store, max-age=0',
            pragma: 'no-cache',
        },
        body: JSON.stringify({ _course_id: courseId }),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "N?o foi possvel carregar o outline pblico do curso.");
    }
    const payload = (await response.json()) as unknown;
    return Array.isArray(payload)
        ? payload.map(normalizeOutlineModule).filter((item): item is GenflixCourseModule => Boolean(item))
        : [];
}
async function fetchPublicRpc<T>(functionName: string, payload: Record<string, unknown>): Promise<T | null> {
    const { data, error } = await publicSupabase.rpc(functionName, payload);
    if (error) {
        throw error;
    }
    if (Array.isArray(data)) {
        return (data[0] as T | undefined) ?? null;
    }
    return (data as T | null) ?? null;
}
async function toCourseDetail(row: PublicCourseDetailRow): Promise<GenflixCourseDetail> {
    const content = normalizeCoursePublicPageContent(row.public_page_content);
    const realSyllabus = content.contentSource === 'real'
        ? await fetchPublicCourseOutline(row.id).catch(() => [])
        : [];
    return buildCoursePublicDetail(row, { realSyllabus });
}
function toBlogPost(row: PublicBlogPostRow): GenflixBlogPost {
    const content = Array.isArray(row.content)
        ? row.content
            .map((item) => {
            if (item && typeof item === 'object' && 'text' in item) {
                const text = (item as {
                    text?: unknown;
                }).text;
                return typeof text === 'string' ? text : '';
            }
            return typeof item === 'string' ? item : '';
        })
            .filter(Boolean)
        : [];
    const fallbackSeoDescription = content.join(' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const summary = row.seo_description?.trim() || row.excerpt?.trim() || fallbackSeoDescription;
    const imageUrl = normalizeSiteAssetPublicUrl(row.image_url) ?? '/images/genflix/home/featured-2.jpg';
    const cardImageUrl = normalizeSiteAssetPublicUrl(row.card_image_url ?? row.image_url ?? null) ?? '/images/genflix/home/featured-2.jpg';
    return Object.assign({
        slug: row.slug,
        title: fixMojibakeText(row.title),
        category: fixMojibakeText(row.category ?? 'GenFlix'),
        seoDescription: fixMojibakeText(summary),
        image: imageUrl,
        readTime: row.read_time ?? '5 min',
        author: row.author ?? 'Equipe GenFlix',
        publishedAt: row.published_at
            ? new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }).format(new Date(row.published_at))
            : '',
        content,
        contentHtml: row.content_html ?? '',
        featured: row.featured,
    }, {
        cardImage: cardImageUrl,
    }) as GenflixBlogPost;
}
function normalizeBlogStatus(value: string | null | undefined) {
    return (value ?? '').trim().toLowerCase();
}
function isBlogPostPublic(row: PublicBlogPostRow) {
    const status = normalizeBlogStatus(row.status);
    const hasPublishedAt = Boolean(row.published_at);
    if (status === 'published') {
        return true;
    }
    if (status === 'scheduled' && hasPublishedAt) {
        const publishDate = new Date(row.published_at as string);
        return !Number.isNaN(publishDate.getTime()) && publishDate.getTime() <= Date.now();
    }
    if (!status && hasPublishedAt) {
        return true;
    }
    return false;
}
function sortPublicBlogRows(rows: PublicBlogPostRow[]) {
    return [...rows].sort((left, right) => {
        const leftFeatured = left.featured ? 1 : 0;
        const rightFeatured = right.featured ? 1 : 0;
        if (rightFeatured !== leftFeatured) {
            return rightFeatured - leftFeatured;
        }
        const leftOrder = left.display_order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.display_order ?? Number.MAX_SAFE_INTEGER;
        if (rightOrder !== leftOrder) {
            return leftOrder - rightOrder;
        }
        const leftPublished = left.published_at ? new Date(left.published_at).getTime() : 0;
        const rightPublished = right.published_at ? new Date(right.published_at).getTime() : 0;
        if (rightPublished !== leftPublished) {
            return rightPublished - leftPublished;
        }
        const leftCreated = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightCreated = right.created_at ? new Date(right.created_at).getTime() : 0;
        return rightCreated - leftCreated;
    });
}
async function fetchAllBlogRowsForPublic() {
    const params = new URLSearchParams({
        select: publicBlogPostAllLegacySelect,
        order: 'display_order.asc,published_at.desc',
    });
    return await fetchPublicBlogRowsWithFallback(params);
}
async function fetchPublicBlogRowsWithFallback(params: URLSearchParams) {
    const isMissingColumn = (message: string, column: string) => message.includes(`column blog_posts.${column} does not exist`);
    let activeParams = new URLSearchParams(params);
    try {
        return await fetchPublicRows<PublicBlogPostRow>('blog_posts', activeParams);
    }
    catch (firstError) {
        const firstMessage = firstError instanceof Error ? firstError.message : '';
        if (!(isMissingColumn(firstMessage, "seo_description") || isMissingColumn(firstMessage, 'card_image_url'))) {
            throw firstError;
        }
        activeParams.set('select', publicBlogPostLegacySelect);
        if (isMissingColumn(firstMessage, 'card_image_url')) {
            activeParams.set('select', publicBlogPostLegacySelect.replace('card_image_url, ', ''));
        }
    }
    try {
        return await fetchPublicRows<PublicBlogPostRow>('blog_posts', activeParams);
    }
    catch (secondError) {
        const secondMessage = secondError instanceof Error ? secondError.message : '';
        if (!isMissingColumn(secondMessage, 'status')) {
            throw secondError;
        }
        activeParams.delete('or');
        activeParams.set('published_at', 'not.is.null');
        return await fetchPublicRows<PublicBlogPostRow>('blog_posts', activeParams);
    }
}
export async function fetchPublicCoursesFromSupabase() {
    const params = new URLSearchParams({
        select: publicCourseSelect,
        status: 'eq.published',
        is_public: 'eq.true',
        order: 'display_order.asc',
    });
    const rows = await fetchPublicRows<PublicCourseRow>('courses', params);
    return rows.map(toCourseItem);
}
export async function fetchLatestPublicCoursesFromSupabase(limit = 6) {
    const params = new URLSearchParams({
        select: publicCourseSelect,
        status: 'eq.published',
        is_public: 'eq.true',
        order: 'launch_date.desc,created_at.desc,display_order.asc',
    });
    const rows = await fetchPublicRows<PublicCourseRow>('courses', params);
    return sortPublicCourseRowsByPublicationDate(rows)
        .slice(0, Math.max(0, Math.trunc(limit)))
        .map(toCourseItem);
}
export async function fetchPublicCourseDetailFromSupabase(slug: string) {
    const row = await fetchPublicRpc<PublicCourseDetailRow>('get_public_course_detail', { _slug: slug });
    return row ? await toCourseDetail(row) : null;
}
export interface PublicAuthorCourseItem {
    id: string;
    slug: string;
    title: string;
    category: string | null;
    categories: string[] | null;
    thumbnail_url: string | null;
    cover_image_url: string | null;
    hero_video_url: string | null;
    price_label: string | null;
    secondary_price_label: string | null;
    price_cents: number | null;
    currency: string | null;
    display_order: number;
    launch_date: string | null;
    commission_percent: number;
}
export interface PublicAuthorProfile {
    userId: string;
    publicSlug: string;
    publicTitle: string;
    publicShortBio: string;
    publicLongBio: string;
    publicAreas: string[];
    publicEducation: string;
    publicExperience: string;
    publicPhotoUrl: string | null;
    publicWebsiteUrl: string;
    publicInstagramUrl: string;
    publicLinkedinUrl: string;
    publicYoutubeUrl: string;
    payoutName: string;
    fullName: string;
    avatarUrl: string | null;
    courses: PublicAuthorCourseItem[];
}
export async function fetchPublicAuthorProfileFromSupabase(slug: string): Promise<PublicAuthorProfile | null> {
    const row = await fetchPublicRpc<PublicAuthorProfileRow>('get_public_author_profile', { _slug: slug });
    if (!row) {
        return null;
    }
    const courses = Array.isArray(row.courses)
        ? row.courses.flatMap((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return [];
            }
            const record = item as Record<string, unknown>;
            const id = typeof record.id === 'string' ? record.id : '';
            const courseSlug = typeof record.slug === 'string' ? record.slug : '';
            const title = typeof record.title === 'string' ? record.title : '';
            if (!id || !courseSlug || !title) {
                return [];
            }
            return [{
                    id,
                    slug: courseSlug,
                    title,
                    category: typeof record.category === 'string' ? record.category : null,
                    categories: Array.isArray(record.categories) ? record.categories.filter((item): item is string => typeof item === 'string') : null,
                    thumbnail_url: typeof record.thumbnail_url === 'string' ? record.thumbnail_url : null,
                    cover_image_url: typeof record.cover_image_url === 'string' ? record.cover_image_url : null,
                    hero_video_url: typeof record.hero_video_url === 'string' ? record.hero_video_url : null,
                    price_label: typeof record.price_label === 'string' ? record.price_label : null,
                    secondary_price_label: typeof record.secondary_price_label === 'string' ? record.secondary_price_label : null,
                    price_cents: typeof record.price_cents === 'number' ? record.price_cents : null,
                    currency: typeof record.currency === 'string' ? record.currency : null,
                    display_order: typeof record.display_order === 'number' ? record.display_order : 0,
                    launch_date: typeof record.launch_date === 'string' ? record.launch_date : null,
                    commission_percent: typeof record.commission_percent === 'number' ? record.commission_percent : 0,
                }];
        })
        : [];
    return {
        userId: row.user_id,
        publicSlug: row.public_slug ?? '',
        publicTitle: row.public_title ?? row.payout_name ?? row.full_name ?? 'Autor GenFlix',
        publicShortBio: row.public_short_bio ?? '',
        publicLongBio: row.public_long_bio ?? row.public_short_bio ?? '',
        publicAreas: row.public_areas ?? [],
        publicEducation: row.public_education ?? '',
        publicExperience: row.public_experience ?? '',
        publicPhotoUrl: row.public_photo_url ?? row.avatar_url ?? null,
        publicWebsiteUrl: row.public_website_url ?? '',
        publicInstagramUrl: row.public_instagram_url ?? '',
        publicLinkedinUrl: row.public_linkedin_url ?? '',
        publicYoutubeUrl: row.public_youtube_url ?? '',
        payoutName: row.payout_name ?? '',
        fullName: row.full_name ?? '',
        avatarUrl: row.avatar_url ?? null,
        courses,
    };
}
export interface PublicCourseFreePreviewLesson {
    id: string;
    moduleId: string;
    title: string;
    description: string | null;
    lessonType: 'video' | 'text' | 'hybrid' | 'file';
    youtubeUrl: string | null;
    textContent: string | null;
    estimatedMinutes: number;
    position: number;
}
export interface PublicCourseFreePreviewModule {
    id: string;
    title: string;
    description: string | null;
    position: number;
    lessons: PublicCourseFreePreviewLesson[];
}
export interface PublicCourseFreePreview {
    courseId: string;
    courseSlug: string;
    firstFreeLessonId: string | null;
    modules: PublicCourseFreePreviewModule[];
}
export interface PublicCoursePlayerLesson {
    id: string;
    moduleId: string;
    title: string;
    description: string | null;
    lessonType: 'video' | 'text' | 'hybrid' | 'file';
    youtubeUrl: string | null;
    textContent: string | null;
    estimatedMinutes: number;
    position: number;
    startsAt: string | null;
    endsAt: string | null;
    isFreePreview: boolean;
    isUnlocked: boolean;
}
export interface PublicCoursePlayerModule {
    id: string;
    title: string;
    description: string | null;
    position: number;
    isRequired: boolean;
    isUnlocked: boolean;
    startsAt: string | null;
    endsAt: string | null;
    lessons: PublicCoursePlayerLesson[];
}
export interface PublicCoursePlayerView {
    courseId: string;
    courseSlug: string;
    firstLessonId: string | null;
    firstAccessibleLessonId: string | null;
    modules: PublicCoursePlayerModule[];
}
function trimPreviewText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizePreviewLesson(value: unknown): PublicCourseFreePreviewLesson | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const id = trimPreviewText(record.id);
    const moduleId = trimPreviewText(record.module_id);
    const title = trimPreviewText(record.title);
    if (!id || !moduleId || !title) {
        return null;
    }
    const lessonType = record.lesson_type === 'text' || record.lesson_type === 'hybrid' || record.lesson_type === 'file'
        ? record.lesson_type
        : 'video';
    return {
        id,
        moduleId,
        title,
        description: typeof record.description === 'string' ? record.description.trim() || null : null,
        lessonType,
        youtubeUrl: typeof record.youtube_url === 'string' ? record.youtube_url.trim() || null : null,
        textContent: typeof record.text_content === 'string' ? record.text_content : null,
        estimatedMinutes: typeof record.estimated_minutes === 'number' && Number.isFinite(record.estimated_minutes)
            ? Math.max(0, Math.round(record.estimated_minutes))
            : 0,
        position: typeof record.position === 'number' && Number.isFinite(record.position)
            ? Math.max(0, Math.round(record.position))
            : 0,
    };
}
function normalizePreviewModule(value: unknown): PublicCourseFreePreviewModule | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const id = trimPreviewText(record.id);
    const title = trimPreviewText(record.title);
    if (!id || !title) {
        return null;
    }
    const lessons = Array.isArray(record.lessons)
        ? record.lessons.map(normalizePreviewLesson).filter((item): item is PublicCourseFreePreviewLesson => Boolean(item))
        : [];
    return {
        id,
        title,
        description: typeof record.description === 'string' ? record.description.trim() || null : null,
        position: typeof record.position === 'number' && Number.isFinite(record.position)
            ? Math.max(0, Math.round(record.position))
            : 0,
        lessons,
    };
}
function normalizePlayerLesson(value: unknown): PublicCoursePlayerLesson | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const id = trimPreviewText(record.id);
    const moduleId = trimPreviewText(record.module_id);
    const title = trimPreviewText(record.title);
    if (!id || !moduleId || !title) {
        return null;
    }
    const lessonType = record.lesson_type === 'text' || record.lesson_type === 'hybrid' || record.lesson_type === 'file'
        ? record.lesson_type
        : 'video';
    return {
        id,
        moduleId,
        title,
        description: typeof record.description === 'string' ? record.description.trim() || null : null,
        lessonType,
        youtubeUrl: typeof record.youtube_url === 'string' ? record.youtube_url.trim() || null : null,
        textContent: typeof record.text_content === 'string' ? record.text_content : null,
        estimatedMinutes: typeof record.estimated_minutes === 'number' && Number.isFinite(record.estimated_minutes)
            ? Math.max(0, Math.round(record.estimated_minutes))
            : 0,
        position: typeof record.position === 'number' && Number.isFinite(record.position)
            ? Math.max(0, Math.round(record.position))
            : 0,
        startsAt: typeof record.starts_at === 'string' ? record.starts_at : null,
        endsAt: typeof record.ends_at === 'string' ? record.ends_at : null,
        isFreePreview: record.is_free_preview === true,
        isUnlocked: record.is_unlocked === true,
    };
}
function normalizePlayerModule(value: unknown): PublicCoursePlayerModule | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const id = trimPreviewText(record.id);
    const title = trimPreviewText(record.title);
    if (!id || !title) {
        return null;
    }
    const lessons = Array.isArray(record.lessons)
        ? record.lessons.map(normalizePlayerLesson).filter((item): item is PublicCoursePlayerLesson => Boolean(item))
        : [];
    return {
        id,
        title,
        description: typeof record.description === 'string' ? record.description.trim() || null : null,
        position: typeof record.position === 'number' && Number.isFinite(record.position)
            ? Math.max(0, Math.round(record.position))
            : 0,
        isRequired: record.is_required === true,
        isUnlocked: record.is_unlocked === true,
        startsAt: typeof record.starts_at === 'string' ? record.starts_at : null,
        endsAt: typeof record.ends_at === 'string' ? record.ends_at : null,
        lessons,
    };
}
export async function fetchPublicCourseFreePreviewFromSupabase(slug: string): Promise<PublicCourseFreePreview | null> {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração pública do Supabase ausente.');
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_course_free_preview`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            'cache-control': 'no-store, max-age=0',
            pragma: 'no-cache',
        },
        body: JSON.stringify({ _slug: slug }),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Não foi possível carregar a prévia gratuita do curso.');
    }
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const record = payload as Record<string, unknown>;
    const courseId = trimPreviewText(record.course_id);
    const courseSlug = trimPreviewText(record.course_slug);
    const firstFreeLessonId = trimPreviewText(record.first_free_lesson_id) || null;
    const modules = Array.isArray(record.modules)
        ? record.modules.map(normalizePreviewModule).filter((item): item is PublicCourseFreePreviewModule => Boolean(item))
        : [];
    if (!courseId || !courseSlug) {
        return null;
    }
    return {
        courseId,
        courseSlug,
        firstFreeLessonId,
        modules,
    };
}
export async function fetchPublicCoursePlayerViewFromSupabase(slug: string): Promise<PublicCoursePlayerView | null> {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração pública do Supabase ausente.');
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_course_player_view`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            'cache-control': 'no-store, max-age=0',
            pragma: 'no-cache',
        },
        body: JSON.stringify({ _slug: slug }),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Não foi possível carregar a visualização pública do curso.');
    }
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const record = payload as Record<string, unknown>;
    const courseId = trimPreviewText(record.course_id);
    const courseSlug = trimPreviewText(record.course_slug);
    const firstLessonId = trimPreviewText(record.first_lesson_id) || null;
    const firstAccessibleLessonId = trimPreviewText(record.first_accessible_lesson_id) || null;
    const modules = Array.isArray(record.modules)
        ? record.modules.map(normalizePlayerModule).filter((item): item is PublicCoursePlayerModule => Boolean(item))
        : [];
    if (!courseId || !courseSlug) {
        return null;
    }
    return {
        courseId,
        courseSlug,
        firstLessonId,
        firstAccessibleLessonId,
        modules,
    };
}
export async function fetchPublicBlogPostsFromSupabase() {
    const rows = await fetchAllBlogRowsForPublic();
    return sortPublicBlogRows(rows).filter(isBlogPostPublic).map(toBlogPost);
}
export async function fetchPublicBlogPostFromSupabase(slug: string) {
    const normalizedSlug = decodeURIComponent(slug).trim();
    if (!normalizedSlug) {
        return null;
    }
    const params = new URLSearchParams({
        select: publicBlogPostAllLegacySelect,
        slug: `eq.${normalizedSlug}`,
        limit: '1',
    });
    const [row] = await fetchPublicBlogRowsWithFallback(params);
    if (row && isBlogPostPublic(row)) {
        return toBlogPost(row);
    }
    const allRows = await fetchAllBlogRowsForPublic();
    const fallbackRow = allRows.find((item) => item.slug?.trim().toLowerCase() === normalizedSlug.toLowerCase());
    if (!fallbackRow || !isBlogPostPublic(fallbackRow)) {
        return null;
    }
    return toBlogPost(fallbackRow);
}
export async function fetchPublicBlogCategoriesFromSupabase() {
    const params = new URLSearchParams({
        select: 'id,name,slug,display_order',
        is_active: 'eq.true',
        order: 'display_order.asc,name.asc',
    });
    const rows = await fetchPublicRows<PublicBlogCategoryRow>('blog_categories', params);
    return rows
        .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        slug: row.slug.trim(),
        display_order: row.display_order,
    }))
        .filter((row) => Boolean(row.name && row.slug));
}
export async function fetchPublicCourseCategoriesFromSupabase() {
    const params = new URLSearchParams({
        select: 'name,slug,display_order',
        is_active: 'eq.true',
        order: 'display_order.asc,name.asc',
    });
    const rows = await fetchPublicRows<PublicCourseCategoryRow>('course_categories', params);
    return rows
        .map((row) => {
        const name = row.name.trim();
        const slug = row.slug.trim() || slugifyCourseCategoryValue(name);
        return {
            name,
            slug,
            displayOrder: row.display_order,
        } satisfies PublicCourseCategoryFilter;
    })
        .filter((row) => Boolean(row.name && row.slug));
}
