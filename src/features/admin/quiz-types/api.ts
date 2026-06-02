import { supabase } from '@/services/supabase/client';
import { normalizeCourseQuizTypeSettings } from '@/features/assessments/course-quiz-type-settings';
import type { CourseQuizTypeSettings } from '@/types/content';
const GLOBAL_QUIZ_TYPE_SETTINGS_TABLE = 'global_quiz_type_settings';
function normalizeGlobalQuizTypeSettings(value: Partial<CourseQuizTypeSettings> | null | undefined): CourseQuizTypeSettings {
    return normalizeCourseQuizTypeSettings(value);
}
export async function fetchGlobalQuizTypeSettings(): Promise<CourseQuizTypeSettings> {
    const result = await supabase
        .from(GLOBAL_QUIZ_TYPE_SETTINGS_TABLE)
        .select('*')
        .eq('id', 1)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    if (!result.data) {
        return normalizeGlobalQuizTypeSettings(null);
    }
    return normalizeGlobalQuizTypeSettings(result.data as Partial<CourseQuizTypeSettings>);
}
export async function updateGlobalQuizTypeSettings(settings: Partial<CourseQuizTypeSettings>, updatedBy?: string | null) {
    const result = await supabase
        .from(GLOBAL_QUIZ_TYPE_SETTINGS_TABLE)
        .upsert({
        id: 1,
        ...normalizeGlobalQuizTypeSettings(settings),
        updated_by: updatedBy ?? null,
    }, { onConflict: 'id' })
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return normalizeGlobalQuizTypeSettings(result.data as Partial<CourseQuizTypeSettings>);
}
