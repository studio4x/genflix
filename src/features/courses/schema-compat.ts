import type { Course } from '@/types/content';
const LEGACY_COURSE_SALES_COLUMNS = ['slug', 'launch_date', 'price_cents', 'currency', 'is_public'] as const;
function getErrorMessage(error: unknown) {
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = Reflect.get(error, 'message');
        if (typeof message === 'string') {
            return message;
        }
    }
    return '';
}
export function isLegacyCourseSalesSchemaError(error: unknown) {
    const message = getErrorMessage(error).toLowerCase();
    return LEGACY_COURSE_SALES_COLUMNS.some((column) => {
        return (message.includes(`courses.${column}`) ||
            message.includes(`column ${column}`) ||
            message.includes(`'${column}' column`) ||
            message.includes(`"${column}"`)) && (message.includes('does not exist') ||
            message.includes('could not find') ||
            message.includes('schema cache'));
    });
}
export function withLegacyCourseSalesDefaults<T extends Partial<Course>>(course: T) {
    const categories = Array.isArray(course.categories)
        ? course.categories.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    const primaryCategory = typeof course.category === 'string' && course.category.trim().length > 0
        ? course.category.trim()
        : null;
    return {
        ...course,
        slug: course.slug ?? null,
        category: primaryCategory,
        categories: categories.length > 0 ? categories : primaryCategory ? [primaryCategory] : [],
        launch_date: course.launch_date ?? null,
        price_cents: course.price_cents ?? 0,
        currency: course.currency ?? 'BRL',
        is_public: course.is_public ?? true,
    } as T & Pick<Course, 'slug' | 'category' | 'categories' | 'launch_date' | 'price_cents' | 'currency' | 'is_public'>;
}
export function stripLegacyCourseSalesFields<T extends Record<string, unknown>>(payload: T) {
    const { slug, category, categories, launch_date, price_cents, currency, is_public, ...legacySafePayload } = payload;
    void slug;
    void category;
    void categories;
    void launch_date;
    void price_cents;
    void currency;
    void is_public;
    return legacySafePayload;
}
