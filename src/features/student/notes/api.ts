import { supabase } from '@/services/supabase/client';
import type { LessonNote } from '@/types/content';
import { lessonNoteDeleteSchema, lessonNoteInputSchema, type LessonNoteDeleteInput, type LessonNoteInput, } from './schemas';
async function getAuthenticatedUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }
    const userId = data.user?.id;
    if (!userId) {
        throw new Error("Usurio no autenticado.");
    }
    return userId;
}
export async function fetchLessonNote(lessonId: string): Promise<LessonNote | null> {
    const userId = await getAuthenticatedUserId();
    const result = await supabase
        .from('lesson_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    return (result.data as LessonNote | null) ?? null;
}
export async function fetchLessonNotes(lessonIds: string[]): Promise<LessonNote[]> {
    const userId = await getAuthenticatedUserId();
    const uniqueLessonIds = [...new Set(lessonIds.filter(Boolean))];
    if (uniqueLessonIds.length === 0) {
        return [];
    }
    const result = await supabase
        .from('lesson_notes')
        .select('*')
        .eq('user_id', userId)
        .in('lesson_id', uniqueLessonIds)
        .order('updated_at', { ascending: false });
    if (result.error) {
        throw result.error;
    }
    return (result.data as LessonNote[]) ?? [];
}
export async function upsertLessonNote(input: LessonNoteInput): Promise<LessonNote> {
    const parsed = lessonNoteInputSchema.safeParse(input);
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inv?lidos para salvar a anotacao.");
    }
    const result = await supabase
        .from('lesson_notes')
        .upsert(parsed.data, { onConflict: 'user_id,lesson_id' })
        .select('*')
        .single();
    if (result.error) {
        throw result.error;
    }
    return result.data as LessonNote;
}
export async function deleteLessonNote(input: LessonNoteDeleteInput): Promise<void> {
    const parsed = lessonNoteDeleteSchema.safeParse(input);
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inv?lidos para excluir a anotacao.");
    }
    const result = await supabase
        .from('lesson_notes')
        .delete()
        .eq('user_id', parsed.data.user_id)
        .eq('lesson_id', parsed.data.lesson_id);
    if (result.error) {
        throw result.error;
    }
}
