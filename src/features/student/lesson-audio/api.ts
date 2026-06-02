import { env } from '@/config/env';
import { supabase } from '@/services/supabase/client';
export interface LessonNarrationPart {
    index: number;
    path: string;
    url: string;
}
export interface LessonNarrationPayload {
    lessonId: string;
    contentHash: string;
    model: string;
    voice: string;
    generatedNow: boolean;
    parts: LessonNarrationPart[];
    expiresInSeconds: number;
}
export interface LessonAudioModerationRequest {
    id: string;
    lesson_id: string;
    user_id: string;
    status: 'pending' | 'resolved';
    requested_message: string | null;
    technical_error: string | null;
    admin_response: string | null;
    created_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
}
type PrepareNarrationMode = 'read' | 'generate' | 'regenerate';
export async function prepareLessonNarration(lessonId: string, mode: PrepareNarrationMode = 'generate') {
    let sessionResult = await supabase.auth.getSession();
    let accessToken: string | undefined = sessionResult.data.session?.access_token ?? undefined;
    if (!accessToken) {
        const refreshResult = await supabase.auth.refreshSession();
        accessToken = refreshResult.data.session?.access_token ?? undefined;
        sessionResult = await supabase.auth.getSession();
        accessToken = accessToken ?? sessionResult.data.session?.access_token ?? undefined;
    }
    if (!accessToken) {
        throw new Error("Sesso expirada. Faca login novamente para gerar a narracao.");
    }
    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/generate-lesson-audio`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            lessonId,
            mode,
            access_token: accessToken,
        }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.error === 'string'
            ? payload.error
            : 'Falha ao gerar a narracao da aula.';
        throw new Error(message);
    }
    return payload as LessonNarrationPayload;
}
export async function fetchOwnLessonAudioModerationRequest(lessonId: string) {
    const result = await supabase
        .from('lesson_audio_moderation_requests')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    return (result.data as LessonAudioModerationRequest | null) ?? null;
}
export async function requestLessonAudioModeration(input: {
    lessonId: string;
    technicalError?: string;
    requestedMessage?: string;
}) {
    const authResult = await supabase.auth.getUser();
    const userId = authResult.data.user?.id;
    if (!userId) {
        throw new Error('Sessão expirada. Faça login novamente para avisar a moderação.');
    }
    const pendingRequest = await supabase
        .from('lesson_audio_moderation_requests')
        .select('*')
        .eq('lesson_id', input.lessonId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (pendingRequest.error) {
        throw pendingRequest.error;
    }
    if (pendingRequest.data) {
        return pendingRequest.data as LessonAudioModerationRequest;
    }
    const insertResult = await supabase
        .from('lesson_audio_moderation_requests')
        .insert({
        lesson_id: input.lessonId,
        user_id: userId,
        technical_error: input.technicalError?.trim() ? input.technicalError.trim().slice(0, 2000) : null,
        requested_message: input.requestedMessage?.trim() ? input.requestedMessage.trim().slice(0, 500) : null,
    })
        .select('*')
        .single();
    if (insertResult.error) {
        throw insertResult.error;
    }
    return insertResult.data as LessonAudioModerationRequest;
}
