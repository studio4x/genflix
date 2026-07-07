import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export type StorageProvider = 'supabase' | 'r2';
type SignedUploadTicket = {
    provider: 'supabase';
    upload_method: 'supabase_signed_upload';
    upload_path: string;
    upload_token: string;
    upload_url: null;
    upload_headers: Record<string, string>;
} | {
    provider: 'r2';
    upload_method: 'r2_signed_put';
    upload_path: string;
    upload_token: null;
    upload_url: string;
    upload_headers: Record<string, string>;
};
export function resolveStorageProvider(input: unknown): StorageProvider {
    if (input === 'r2' || input === 'supabase') {
        return input;
    }
    const fromEnv = (Deno.env.get('STORAGE_PROVIDER_DEFAULT') ?? 'r2').trim().toLowerCase();
    return fromEnv === 'r2' ? 'r2' : 'supabase';
}
export function sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}
export function buildObjectPath(prefix: string, fileName: string) {
    return `${prefix}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}
function resolveR2BucketName(bucket: string) {
    const configuredBucket = (Deno.env.get('R2_PRIVATE_BUCKET') ?? '').trim();
    return configuredBucket || bucket;
}
export function getSignedGetTtlSeconds(defaultSeconds = 300) {
    const raw = Number.parseInt(Deno.env.get('R2_SIGNED_GET_EXPIRES_SECONDS') ?? '', 10);
    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return defaultSeconds;
}
export function getSignedPutTtlSeconds(defaultSeconds = 600) {
    const raw = Number.parseInt(Deno.env.get('R2_SIGNED_PUT_EXPIRES_SECONDS') ?? '', 10);
    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return defaultSeconds;
}
export function getMaxUploadSizeBytes(defaultBytes = 50 * 1024 * 1024) {
    const raw = Number.parseInt(Deno.env.get('R2_MAX_FILE_SIZE_BYTES') ?? '', 10);
    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return defaultBytes;
}
export function buildR2ObjectUrl(bucket: string, objectPath: string) {
    const endpoint = Deno.env.get('R2_S3_ENDPOINT')?.trim() ?? '';
    if (!endpoint) {
        throw new Error('R2_S3_ENDPOINT no configurado.');
    }
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    const normalizedBucket = resolveR2BucketName(bucket);
    const normalizedPath = objectPath.replace(/^\/+/, '');
    return `${normalizedEndpoint}/${normalizedBucket}/${normalizedPath}`;
}
export async function createSignedPutUrl(input: {
    provider: StorageProvider;
    bucket: string;
    objectPath: string;
    mimeType: string;
    supabaseAdmin: ReturnType<typeof createClient>;
}) {
    if (input.provider === 'supabase') {
        const uploadResult = await input.supabaseAdmin.storage
            .from(input.bucket)
            .createSignedUploadUrl(input.objectPath);
        if (uploadResult.error || !uploadResult.data?.token) {
            throw new Error(uploadResult.error?.message ?? "N?o foi possvel gerar URL assinada de upload.");
        }
        return {
            provider: 'supabase',
            upload_method: 'supabase_signed_upload',
            upload_path: input.objectPath,
            upload_token: uploadResult.data.token,
            upload_url: null,
            upload_headers: {},
        } satisfies SignedUploadTicket;
    }
    const signedRequest = await signR2Request({
        method: 'PUT',
        bucket: resolveR2BucketName(input.bucket),
        objectPath: input.objectPath,
        expiresInSeconds: getSignedPutTtlSeconds(600),
        headers: {
            'content-type': input.mimeType || 'application/octet-stream',
        },
    });
    return {
        provider: 'r2',
        upload_method: 'r2_signed_put',
        upload_path: input.objectPath,
        upload_token: null,
        upload_url: signedRequest.url,
        upload_headers: signedRequest.headers,
    } satisfies SignedUploadTicket;
}
export async function createSignedGetUrl(input: {
    provider: StorageProvider;
    bucket: string;
    objectPath: string;
    expiresInSeconds: number;
    supabaseAdmin: ReturnType<typeof createClient>;
}) {
    if (input.provider === 'supabase') {
        const signedResult = await input.supabaseAdmin.storage
            .from(input.bucket)
            .createSignedUrl(input.objectPath, input.expiresInSeconds);
        if (signedResult.error || !signedResult.data?.signedUrl) {
            throw new Error(signedResult.error?.message ?? "N?o foi possvel gerar URL assinada de leitura.");
        }
        return signedResult.data.signedUrl;
    }
    const signedRequest = await signR2Request({
        method: 'GET',
        bucket: resolveR2BucketName(input.bucket),
        objectPath: input.objectPath,
        expiresInSeconds: input.expiresInSeconds,
    });
    return signedRequest.url;
}
export async function deleteObject(input: {
    provider: StorageProvider;
    bucket: string;
    objectPath: string;
    supabaseAdmin: ReturnType<typeof createClient>;
}) {
    if (input.provider === 'supabase') {
        const removeResult = await input.supabaseAdmin.storage
            .from(input.bucket)
            .remove([input.objectPath]);
        if (removeResult.error) {
            throw new Error(removeResult.error.message);
        }
        return;
    }
    const signedRequest = await signR2Request({
        method: 'DELETE',
        bucket: resolveR2BucketName(input.bucket),
        objectPath: input.objectPath,
        expiresInSeconds: 120,
    });
    const response = await fetch(signedRequest.url, {
        method: 'DELETE',
        headers: signedRequest.headers,
    });
    if (!response.ok && response.status !== 404) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Falha ao remover objeto no R2 (${response.status}): ${errorBody}`);
    }
}
async function signR2Request(input: {
    method: 'GET' | 'PUT' | 'DELETE';
    bucket: string;
    objectPath: string;
    expiresInSeconds: number;
    headers?: Record<string, string>;
}) {
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')?.trim() ?? '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')?.trim() ?? '';
    const url = buildR2ObjectUrl(input.bucket, input.objectPath);
    if (!accessKeyId || !secretAccessKey) {
        throw new Error('Credenciais R2 ausentes na Edge Function.');
    }
    const aws = new AwsClient({
        accessKeyId,
        secretAccessKey,
    });
    const request = new Request(url, {
        method: input.method,
        headers: input.headers,
    });
    const signed = await aws.sign(request, {
        aws: {
            signQuery: true,
            allHeaders: true,
            expires: input.expiresInSeconds,
        },
    });
    const signedHeaders: Record<string, string> = {};
    signed.headers.forEach((value, key) => {
        signedHeaders[key] = value;
    });
    return {
        url: signed.url,
        headers: signedHeaders,
    };
}
