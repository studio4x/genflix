import { supabase } from '@/services/supabase/client';
const PROFILE_AVATARS_BUCKET = 'profile-avatars';
function sanitizeFileName(fileName: string) {
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
    const base = parts.join('.')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return {
        base: base || 'avatar',
        extension: extension || 'jpg',
    };
}
export async function uploadProfileAvatar(file: File, userId: string) {
    const { base, extension } = sanitizeFileName(file.name);
    const storagePath = `avatars/${userId}/${Date.now()}-${crypto.randomUUID()}-${base}.${extension}`;
    const uploadResult = await supabase.storage.from(PROFILE_AVATARS_BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
    });
    if (uploadResult.error) {
        throw uploadResult.error;
    }
    const publicUrl = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
    return {
        storagePath,
        publicUrl,
    };
}
