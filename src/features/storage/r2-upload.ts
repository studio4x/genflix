import { supabase } from '@/services/supabase/client';

export type StorageUploadTicket = {
    provider: 'r2' | 'supabase';
    upload_method: 'r2_signed_put' | 'supabase_signed_upload';
    upload_path: string;
    upload_token: string | null;
    upload_url: string | null;
    upload_headers: Record<string, string> | null;
    storage_bucket: string;
    storage_provider: 'r2' | 'supabase';
    public_url: string | null;
};

export type StorageUploadKind =
    | 'lesson_material'
    | 'site_asset'
    | 'profile_avatar'
    | 'support_attachment'
    | 'assessment_asset'
    | 'module_pdf'
    | 'lesson_content_asset'
    | 'lesson_footer_asset'
    | 'course_media'
    | 'lesson_audio';

export type StorageUploadProgress = {
    loadedBytes: number;
    totalBytes: number;
    percent: number;
    etaSeconds: number | null;
};

async function getAccessTokenOrThrow() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? '';
    if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }
    return accessToken;
}

export async function prepareStorageUpload(input: {
    uploadKind: StorageUploadKind;
    entityId: string;
    file: File;
    provider?: 'r2' | 'supabase';
    mimeType?: string;
}) {
    const accessToken = await getAccessTokenOrThrow();
    const response = await supabase.functions.invoke<StorageUploadTicket>('admin-storage-upload', {
        body: {
            access_token: accessToken,
            operation: 'prepare_upload',
            upload_kind: input.uploadKind,
            entity_id: input.entityId,
            file_name: input.file.name,
            mime_type: input.mimeType?.trim() || input.file.type || 'application/octet-stream',
            file_size_bytes: input.file.size,
            provider: input.provider ?? 'r2',
        },
    });
    if (response.error || !response.data) {
        throw new Error(response.error?.message ?? 'Não foi possível preparar o upload.');
    }
    return response.data;
}

export async function uploadFileWithTicket(ticket: StorageUploadTicket, file: File, options?: {
    onProgress?: (snapshot: StorageUploadProgress) => void;
    maxAttempts?: number;
}) {
    if (ticket.upload_method === 'supabase_signed_upload') {
        if (!ticket.upload_token) {
            throw new Error('Token de upload assinado ausente.');
        }
        options?.onProgress?.({
            loadedBytes: 0,
            totalBytes: file.size,
            percent: 0,
            etaSeconds: null,
        });
        const { error } = await supabase.storage
            .from(ticket.storage_bucket)
            .uploadToSignedUrl(ticket.upload_path, ticket.upload_token, file);
        if (error) {
            throw error;
        }
        options?.onProgress?.({
            loadedBytes: file.size,
            totalBytes: file.size,
            percent: 100,
            etaSeconds: 0,
        });
        return;
    }
    if (!ticket.upload_url) {
        throw new Error('URL de upload assinada ausente.');
    }
    const headers = buildR2UploadHeaders(file, ticket.upload_headers);
    const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await uploadToSignedR2UrlWithXhr(ticket.upload_url, headers, file, options?.onProgress);
            return;
        }
        catch (error) {
            const normalized = error instanceof Error ? error : new Error('Falha no upload para R2.');
            lastError = normalized;
            if (!isRetryableR2UploadError(normalized) || attempt >= maxAttempts) {
                break;
            }
            await delay(350 * attempt);
        }
    }
    if (lastError) {
        throw lastError;
    }
}

export async function deleteStorageObject(input: {
    uploadKind: StorageUploadKind;
    storagePath: string;
    storageBucket?: string;
    provider?: 'r2' | 'supabase';
}) {
    const accessToken = await getAccessTokenOrThrow();
    const response = await supabase.functions.invoke<{ ok: boolean }>('admin-storage-upload', {
        body: {
            access_token: accessToken,
            operation: 'delete_object',
            upload_kind: input.uploadKind,
            storage_path: input.storagePath,
            storage_bucket: input.storageBucket,
            provider: input.provider ?? 'r2',
        },
    });
    if (response.error) {
        throw new Error(response.error.message);
    }
}

function buildR2UploadHeaders(file: File, signedHeaders: Record<string, string> | null | undefined) {
    const headers: Record<string, string> = {
        'Content-Type': file.type || 'application/octet-stream',
    };
    for (const [rawKey, rawValue] of Object.entries(signedHeaders ?? {})) {
        const key = rawKey.trim();
        const value = String(rawValue ?? '').trim();
        if (!key || !value) {
            continue;
        }
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'host' || lowerKey === 'content-length' || lowerKey === 'content-type') {
            continue;
        }
        headers[key] = value;
    }
    return headers;
}

async function uploadToSignedR2UrlWithXhr(url: string, headers: Record<string, string>, file: File, onProgress?: (snapshot: StorageUploadProgress) => void) {
    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const startTime = Date.now();
        xhr.open('PUT', url, true);
        for (const [key, value] of Object.entries(headers)) {
            try {
                xhr.setRequestHeader(key, value);
            }
            catch {
                // Ignore unsupported headers.
            }
        }
        xhr.onerror = () => reject(new Error('Falha de rede durante upload para R2 (status 0).'));
        xhr.onabort = () => reject(new Error('Upload para R2 foi abortado (status 0).'));
        xhr.upload.onprogress = (event) => {
            const loadedBytes = Number.isFinite(event.loaded) ? event.loaded : 0;
            const totalBytes = event.lengthComputable && Number.isFinite(event.total) && event.total > 0
                ? event.total
                : file.size;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
            const elapsedSeconds = Math.max((Date.now() - startTime) / 1000, 0.001);
            const bytesPerSecond = loadedBytes / elapsedSeconds;
            const remainingBytes = Math.max(totalBytes - loadedBytes, 0);
            const etaSeconds = bytesPerSecond > 0 ? Math.ceil(remainingBytes / bytesPerSecond) : null;
            onProgress?.({ loadedBytes, totalBytes, percent, etaSeconds });
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress?.({
                    loadedBytes: file.size,
                    totalBytes: file.size,
                    percent: 100,
                    etaSeconds: 0,
                });
                resolve();
                return;
            }
            reject(new Error(`Falha no upload para R2 (${xhr.status}). ${xhr.responseText || ''}`.trim()));
        };
        xhr.send(file);
    });
}

function isRetryableR2UploadError(error: Error) {
    const message = error.message.toLowerCase();
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? Number(statusMatch[1]) : null;
    return (message.includes('status 0')
        || message.includes('network')
        || message.includes('abort')
        || message.includes('timeout')
        || (status !== null && status >= 500));
}

function delay(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), ms);
    });
}
