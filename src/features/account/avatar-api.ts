import { prepareStorageUpload, uploadFileWithTicket } from '@/features/storage/r2-upload';
export async function uploadProfileAvatar(file: File, userId: string) {
    const ticket = await prepareStorageUpload({
        uploadKind: 'profile_avatar',
        entityId: userId,
        file,
    });
    await uploadFileWithTicket(ticket, file);
    return {
        storagePath: ticket.upload_path,
        publicUrl: ticket.public_url ?? '',
    };
}
