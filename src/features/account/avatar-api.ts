import { prepareStorageUpload, uploadFileWithTicket } from '@/features/storage/r2-upload';
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
        publicUrl: ticket.public_url,
    };
}
