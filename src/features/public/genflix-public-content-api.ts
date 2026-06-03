import { buildCoursePublicCatalogItem, buildCoursePublicDetail, normalizeCoursePublicPageContent, type CoursePublicPageRowLike, } from '@/features/public/course-public-page-content';
import type { GenflixBlogPost, GenflixCourseDetail, GenflixCourseItem, GenflixCourseModule, } from '@/features/public/genflix-site-content';
import { fixMojibakeText } from '@/lib/text-encoding';
interface PublicCourseRow extends CoursePublicPageRowLike {
    display_order: number;
}
interface PublicBlogPostRow {
    slug: string;
    title: string;
    category: string | null;
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
interface PublicBlogCategoryRow {
    id: string;
    name: string;
    slug: string;
    display_order: number;
}
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const publicCourseSelect = 'id, slug, title, description, category, thumbnail_url, cover_image_url, marketing_title, marketing_description, mentor_name, mentor_role, mentor_bio, mentor_initials, price_label, secondary_price_label, price_cents, currency, public_page_content, display_order';
const publicBlogPostLegacySelect = 'slug, title, category, excerpt, image_url, card_image_url, read_time, author, published_at, content, content_html, featured, status';
const publicBlogPostAllLegacySelect = 'slug, title, category, excerpt, image_url, card_image_url, read_time, author, published_at, content, content_html, featured, status, created_at';
async function fetchPublicRows<T>(path: string, searchParams: URLSearchParams): Promise<T[]> {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração pública do Supabase ausente.');
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}${searchParams.toString()}`, {
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
async function toCourseDetail(row: PublicCourseRow): Promise<GenflixCourseDetail> {
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
    return Object.assign({
        slug: row.slug,
        title: fixMojibakeText(row.title),
        category: fixMojibakeText(row.category ?? 'GenFlix'),
        seoDescription: fixMojibakeText(summary),
        image: row.image_url ?? '/images/genflix/home/featured-2.jpg',
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
        cardImage: row.card_image_url ?? row.image_url ?? '/images/genflix/home/featured-2.jpg',
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
export async function fetchPublicCourseDetailFromSupabase(slug: string) {
    const params = new URLSearchParams({
        select: publicCourseSelect,
        status: 'eq.published',
        is_public: 'eq.true',
        slug: `eq.${slug}`,
        limit: '1',
    });
    const [row] = await fetchPublicRows<PublicCourseRow>('courses', params);
    return row ? await toCourseDetail(row) : null;
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
    return rows.map((row) => row.name.trim()).filter(Boolean);
}
