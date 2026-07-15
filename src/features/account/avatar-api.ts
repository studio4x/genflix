import { prepareStorageUpload, uploadFileWithTicket } from '@/features/storage/r2-upload';
import { env } from '@/config/env';
export function resolveProfileAvatarUrl(value: string | null | undefined) {
    const normalizedValue = value?.trim() ?? '';
    if (!normalizedValue) {
        return null;
    }
    try {
        const parsedUrl = new URL(normalizedValue);
        if (!parsedUrl.hostname.endsWith('.r2.cloudflarestorage.com')) {
            return normalizedValue;
        }
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        const profileAvatarIndex = pathSegments.indexOf('profile-avatars');
        if (profileAvatarIndex < 0) {
            return normalizedValue;
        }
        const storagePath = pathSegments.slice(profileAvatarIndex).join('/');
        return `${env.VITE_SUPABASE_URL}/functions/v1/public-profile-avatar?storage_path=${encodeURIComponent(storagePath)}`;
    }
    catch {
        return normalizedValue;
    }
}
export async function uploadProfileAvatar(file: File, userId: string) {
    const ticket = await prepareStorageUpload({
        uploadKind: 'profile_avatar',
        entityId: userId,
        provider: 'r2',
        file,
    });
    if (ticket.provider !== 'r2' || ticket.storage_provider !== 'r2' || ticket.upload_method !== 'r2_signed_put') {
        throw new Error('O avatar precisa ser enviado para o storage R2.');
    }
    if (!ticket.public_url) {
        throw new Error('O storage R2 não retornou a URL pública do avatar.');
    }
    await uploadFileWithTicket(ticket, file);
    return {
        storagePath: ticket.upload_path,
        publicUrl: `${env.VITE_SUPABASE_URL}/functions/v1/public-profile-avatar?storage_path=${encodeURIComponent(ticket.upload_path)}`,
    };
}
