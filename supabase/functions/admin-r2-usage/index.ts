import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DeleteObjectCommand, ListBucketsCommand, ListObjectsV2Command, S3Client } from 'https://esm.sh/@aws-sdk/client-s3@3.916.0';
import { createSignedGetUrl } from '../_shared/storage-provider.ts';
import { buildCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts';
type CloudflareApiEnvelope<T> = {
    success: boolean;
    errors?: Array<{
        code: number;
        message: string;
    }>;
    result: T;
};
type CloudflareR2Bucket = {
    name: string;
    creation_date: string;
    location: string;
    storage_class: string;
    jurisdiction?: string;
};
type CloudflareR2BucketUsage = {
    end: string;
    payloadSize: string;
    metadataSize: string;
    objectCount: string;
    uploadCount: string;
    infrequentAccessPayloadSize?: string;
    infrequentAccessMetadataSize?: string;
    infrequentAccessObjectCount?: string;
    infrequentAccessUploadCount?: string;
};
type R2UsageBucketRow = {
    name: string;
    location: string;
    storage_class: string;
    jurisdiction: string | null;
    creation_date: string;
    usage_end: string;
    payload_size_bytes: number;
    metadata_size_bytes: number;
    total_size_bytes: number;
    object_count: number;
    upload_count: number;
    infrequent_access_payload_size_bytes: number;
    infrequent_access_metadata_size_bytes: number;
    infrequent_access_total_size_bytes: number;
    infrequent_access_object_count: number;
    infrequent_access_upload_count: number;
};
type R2ObjectListingRow = {
    key: string;
    size_bytes: number;
    last_modified: string | null;
    etag: string | null;
    preview_url: string | null;
};

function isPreviewableImageObjectKey(key: string) {
    return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(key);
}
Deno.serve(async (request) => {
    const corsHeaders = buildCorsHeaders(request);
    if (request.method === 'OPTIONS') {
        if (!isAllowedOrigin(request.headers.get('origin'))) {
            return new Response("origin no permitida", { status: 403, headers: corsHeaders });
        }
        return new Response('ok', { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
        return jsonResponse(request, { error: "Mtodo no permitido." }, 405);
    }
    try {
        const body = await request.json().catch(() => ({}));
        const action = resolveAction(body?.action);
        const accessToken = getAccessToken(request, body);
        if (!accessToken) {
            return jsonResponse(request, { error: 'Token de acesso ausente.' }, 401);
        }
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse(request, { error: "Configurao ausente do Supabase." }, 500);
        }
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: userError, } = await supabaseAdmin.auth.getUser(accessToken);
        if (userError || !user) {
            return jsonResponse(request, { error: "Token inv?lido ou expirado." }, 401);
        }
        const roleCheck = await supabaseAdmin.rpc('has_role', {
            _user_id: user.id,
            _role_code: 'admin',
        });
        if (roleCheck.error) {
            return jsonResponse(request, { error: 'Falha ao validar perfil de administrador.' }, 500);
        }
        if (!roleCheck.data) {
            return jsonResponse(request, { error: 'Apenas administradores podem visualizar o uso do storage.' }, 403);
        }
        if (action === 'list_objects') {
            const bucket = typeof body?.bucket === 'string' ? body.bucket.trim() : '';
            const prefix = typeof body?.prefix === 'string' ? body.prefix.trim() : '';
            const continuationToken = typeof body?.continuation_token === 'string'
                ? body.continuation_token.trim()
                : '';
            if (!bucket) {
                return jsonResponse(request, { error: "bucket obrigatrio para listagem de arquivos." }, 400);
            }
            const listing = await listR2ObjectsViaS3({
                bucket,
                prefix,
                continuationToken: continuationToken || undefined,
            });
            return jsonResponse(request, {
                bucket,
                prefix,
                checked_at: new Date().toISOString(),
                objects: listing.objects,
                continuation_token: listing.continuationToken ?? null,
            });
        }
        if (action === 'delete_object') {
            const bucket = typeof body?.bucket === 'string' ? body.bucket.trim() : '';
            const key = typeof body?.key === 'string' ? body.key.trim() : '';
            if (!bucket || !key) {
                return jsonResponse(request, { error: "bucket e key sao obrigatrios para exclusao." }, 400);
            }
            await deleteR2ObjectViaS3({ bucket, key });
            return jsonResponse(request, {
                ok: true,
                bucket,
                key,
                deleted_at: new Date().toISOString(),
            });
        }
        const accountId = (Deno.env.get('R2_ACCOUNT_ID') ?? '').trim();
        const cloudflareToken = (Deno.env.get('CLOUDFLARE_API_TOKEN') ?? Deno.env.get('CLOUDFLARE_ACCESS_TOKEN') ?? '').trim();
        let bucketRows: R2UsageBucketRow[] = [];
        let source: 'cloudflare-api' | 'r2-s3' = 'cloudflare-api';
        if (accountId && cloudflareToken) {
            try {
                bucketRows = await loadUsageFromCloudflareApi({ accountId, cloudflareToken });
            }
            catch (error) {
                source = 'r2-s3';
                bucketRows = await loadUsageFromR2S3();
            }
        }
        else {
            source = 'r2-s3';
            bucketRows = await loadUsageFromR2S3();
        }
        const totals = bucketRows.reduce((acc, bucket) => ({
            payload_size_bytes: acc.payload_size_bytes + bucket.payload_size_bytes,
            metadata_size_bytes: acc.metadata_size_bytes + bucket.metadata_size_bytes,
            total_size_bytes: acc.total_size_bytes + bucket.total_size_bytes,
            object_count: acc.object_count + bucket.object_count,
            upload_count: acc.upload_count + bucket.upload_count,
            infrequent_access_total_size_bytes: acc.infrequent_access_total_size_bytes + bucket.infrequent_access_total_size_bytes,
            infrequent_access_object_count: acc.infrequent_access_object_count + bucket.infrequent_access_object_count,
        }), {
            payload_size_bytes: 0,
            metadata_size_bytes: 0,
            total_size_bytes: 0,
            object_count: 0,
            upload_count: 0,
            infrequent_access_total_size_bytes: 0,
            infrequent_access_object_count: 0,
        });
        return jsonResponse(request, {
            account_id: accountId,
            checked_at: new Date().toISOString(),
            source,
            bucket_count: bucketRows.length,
            buckets: bucketRows,
            totals,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado ao consultar a Cloudflare.';
        return jsonResponse(request, { error: message }, 500);
    }
});
type FunctionAction = 'overview' | 'list_objects' | 'delete_object';
function resolveAction(value: unknown): FunctionAction {
    if (value === 'list_objects') {
        return value;
    }
    if (value === 'delete_object') {
        return value;
    }
    return 'overview';
}
function getAccessToken(request: Request, body: Record<string, unknown>) {
    const authHeader = request.headers.get('Authorization');
    const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
    const accessTokenFromBody = typeof body?.access_token === 'string' ? body.access_token.trim() : '';
    return accessTokenFromBody || accessTokenFromHeader;
}
function toNumber(value: string | undefined) {
    if (!value) {
        return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
async function cloudflareRequest<T>(input: {
    accountId: string;
    token: string;
    path: string;
}) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${input.accountId}${input.path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${input.token}`,
            'Content-Type': 'application/json',
        },
    });
    const payload = (await response.json()) as CloudflareApiEnvelope<T>;
    if (!response.ok || !payload.success) {
        const details = payload.errors?.map((entry) => `${entry.code}: ${entry.message}`).join('; ') ?? 'erro desconhecido';
        throw new Error(`Cloudflare API falhou: ${details}`);
    }
    return payload.result;
}
async function loadUsageFromCloudflareApi(input: {
    accountId: string;
    cloudflareToken: string;
}) {
    const bucketList = await cloudflareRequest<{
        buckets: CloudflareR2Bucket[];
    }>({
        accountId: input.accountId,
        token: input.cloudflareToken,
        path: '/r2/buckets',
    });
    return await Promise.all((bucketList.buckets ?? []).map(async (bucket) => {
        const usage = await cloudflareRequest<CloudflareR2BucketUsage>({
            accountId: input.accountId,
            token: input.cloudflareToken,
            path: `/r2/buckets/${encodeURIComponent(bucket.name)}/usage`,
        });
        const payloadSizeBytes = toNumber(usage.payloadSize);
        const metadataSizeBytes = toNumber(usage.metadataSize);
        const infrequentAccessPayloadSizeBytes = toNumber(usage.infrequentAccessPayloadSize);
        const infrequentAccessMetadataSizeBytes = toNumber(usage.infrequentAccessMetadataSize);
        return {
            name: bucket.name,
            location: bucket.location,
            storage_class: bucket.storage_class,
            jurisdiction: bucket.jurisdiction ?? null,
            creation_date: bucket.creation_date,
            usage_end: usage.end,
            payload_size_bytes: payloadSizeBytes,
            metadata_size_bytes: metadataSizeBytes,
            total_size_bytes: payloadSizeBytes + metadataSizeBytes,
            object_count: toNumber(usage.objectCount),
            upload_count: toNumber(usage.uploadCount),
            infrequent_access_payload_size_bytes: infrequentAccessPayloadSizeBytes,
            infrequent_access_metadata_size_bytes: infrequentAccessMetadataSizeBytes,
            infrequent_access_total_size_bytes: infrequentAccessPayloadSizeBytes + infrequentAccessMetadataSizeBytes,
            infrequent_access_object_count: toNumber(usage.infrequentAccessObjectCount),
            infrequent_access_upload_count: toNumber(usage.infrequentAccessUploadCount),
        };
    }));
}
async function loadUsageFromR2S3() {
    const client = createR2S3Client();
    const configuredBuckets = resolveConfiguredBuckets();
    let buckets: Array<{
        Name?: string;
        CreationDate?: Date;
    }> = [];
    try {
        const listBucketsResult = await client.send(new ListBucketsCommand({}));
        buckets = listBucketsResult.Buckets ?? [];
    }
    catch (error) {
        if (configuredBuckets.length === 0) {
            const message = error instanceof Error ? error.message : 'Access Denied';
            throw new Error(`N?o foi possvel listar buckets no R2 (${message}). Configure R2_PRIVATE_BUCKET ou R2_BUCKETS para usar credencial restrita.`);
        }
    }
    if (buckets.length === 0 && configuredBuckets.length > 0) {
        buckets = configuredBuckets.map((name) => ({ Name: name }));
    }
    const usageEnd = new Date().toISOString();
    return await Promise.all(buckets.map(async (bucket) => {
        const bucketName = bucket.Name ?? 'unknown';
        const createdAt = bucket.CreationDate?.toISOString() ?? usageEnd;
        let continuationToken: string | undefined;
        let objectCount = 0;
        let totalPayloadSize = 0;
        do {
            const page = await client.send(new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            }));
            const objects = page.Contents ?? [];
            for (const objectEntry of objects) {
                objectCount += 1;
                totalPayloadSize += objectEntry.Size ?? 0;
            }
            continuationToken = page.NextContinuationToken;
        } while (continuationToken);
        return {
            name: bucketName,
            location: 'auto',
            storage_class: 'Standard',
            jurisdiction: null,
            creation_date: createdAt,
            usage_end: usageEnd,
            payload_size_bytes: totalPayloadSize,
            metadata_size_bytes: 0,
            total_size_bytes: totalPayloadSize,
            object_count: objectCount,
            upload_count: objectCount,
            infrequent_access_payload_size_bytes: 0,
            infrequent_access_metadata_size_bytes: 0,
            infrequent_access_total_size_bytes: 0,
            infrequent_access_object_count: 0,
            infrequent_access_upload_count: 0,
        };
    }));
}
async function listR2ObjectsViaS3(input: {
    bucket: string;
    prefix: string;
    continuationToken?: string;
}) {
    const client = createR2S3Client();
    const page = await client.send(new ListObjectsV2Command({
        Bucket: input.bucket,
        Prefix: input.prefix || undefined,
        ContinuationToken: input.continuationToken,
        MaxKeys: 200,
    }));
    const objects = await Promise.all((page.Contents ?? []).map(async (entry) => {
        const key = entry.Key ?? '';
        if (!key) {
            return null;
        }
        const previewUrl = isPreviewableImageObjectKey(key)
            ? await createSignedGetUrl({
                provider: 'r2',
                bucket: input.bucket,
                objectPath: key,
                expiresInSeconds: 60 * 10,
                supabaseAdmin: undefined as unknown as ReturnType<typeof createClient>,
            })
            : null;
        return {
            key,
            size_bytes: entry.Size ?? 0,
            last_modified: entry.LastModified ? entry.LastModified.toISOString() : null,
            etag: entry.ETag ?? null,
            preview_url: previewUrl,
        } satisfies R2ObjectListingRow;
    }));
    return {
        objects: objects.filter((entry): entry is R2ObjectListingRow => entry !== null),
        continuationToken: page.NextContinuationToken ?? null,
    };
}
async function deleteR2ObjectViaS3(input: {
    bucket: string;
    key: string;
}) {
    const client = createR2S3Client();
    await client.send(new DeleteObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
    }));
}
function createR2S3Client() {
    const endpoint = (Deno.env.get('R2_S3_ENDPOINT') ?? Deno.env.get('R2_ENDPOINT') ?? '').trim();
    const accessKeyId = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
    const secretAccessKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
    if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error('Secrets ausentes para fallback S3 do R2 (R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).');
    }
    return new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
    });
}
function resolveConfiguredBuckets() {
    const fromSingle = (Deno.env.get('R2_PRIVATE_BUCKET') ?? '').trim();
    const fromList = (Deno.env.get('R2_BUCKETS') ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    const merged = fromSingle ? [fromSingle, ...fromList] : fromList;
    return Array.from(new Set(merged));
}
function jsonResponse(request: Request, payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            ...buildCorsHeaders(request),
            'Content-Type': 'application/json',
        },
    });
}
