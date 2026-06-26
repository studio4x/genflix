import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

type ApiRequest = {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
};

type ApiResponse = {
    status: (statusCode: number) => ApiResponse;
    json: (payload: unknown) => void;
    setHeader: (name: string, value: string) => void;
};

type CourseRecord = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    price_cents: number | null;
    currency: string | null;
    is_public: boolean | null;
};

type LegacyCourseRecord = {
    id: string;
    title: string;
    description: string | null;
    status: string;
};

type PaymentGatewayConfig = {
    environment?: 'sandbox' | 'production';
    gateway_code?: string;
    is_active?: boolean;
};

type CheckoutErrorPayload = {
    id?: string;
    message?: string;
    errors?: Array<{
        description?: string;
    }>;
};

const startCheckoutSchema = z.object({
    courseId: z.string().uuid('Curso invalido.'),
    buyerName: z.string().trim().max(160).optional(),
    buyerEmail: z.string().trim().email('E-mail invalido.').optional().or(z.literal('')),
    buyerDocument: z.string().trim().optional(),
    buyerPhone: z.string().trim().optional(),
    buyerAddress: z.string().trim().optional(),
    buyerAddressNumber: z.string().trim().optional(),
    buyerAddressComplement: z.string().trim().optional(),
    buyerPostalCode: z.string().trim().optional(),
    buyerState: z.string().trim().optional(),
    buyerProvince: z.string().trim().optional(),
    buyerCity: z.string().trim().optional(),
    buyerUserId: z.string().trim().uuid().optional().or(z.literal('')),
});

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
    res.status(statusCode);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
}

function parseBody(rawBody: unknown) {
    if (!rawBody) {
        return null;
    }
    if (typeof rawBody === 'string') {
        try {
            return JSON.parse(rawBody) as Record<string, unknown>;
        }
        catch {
            return null;
        }
    }
    if (typeof rawBody === 'object') {
        return rawBody as Record<string, unknown>;
    }
    return null;
}

function getHeaderValue(value: string | string[] | undefined) {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }
    return null;
}

function getBearerToken(headerValue: string | null) {
    if (!headerValue) {
        return null;
    }
    const [scheme, token] = headerValue.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }
    return token.trim();
}

function normalizeUrl(value: string | null | undefined) {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol.replace(/\/$/, '');
}

function getPublicAppUrl() {
    return (
        normalizeUrl(process.env.APP_PUBLIC_URL) ||
        normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
        normalizeUrl(process.env.VERCEL_URL) ||
        'https://genflix-omega.vercel.app'
    );
}

function getRequestOrigin() {
    return getPublicAppUrl();
}

function getAsaasBaseUrl(environment: 'sandbox' | 'production') {
    return environment === 'sandbox'
        ? 'https://api-sandbox.asaas.com'
        : 'https://api.asaas.com';
}

function getAsaasAccessToken(environment: 'sandbox' | 'production') {
    return environment === 'sandbox'
        ? process.env.ASAAS_ACCESS_TOKEN_SANDBOX || process.env.ASAAS_ACCESS_TOKEN
        : process.env.ASAAS_ACCESS_TOKEN_PRODUCTION || process.env.ASAAS_ACCESS_TOKEN;
}

function normalizeText(value: string | null | undefined) {
    const normalized = value?.trim() || '';
    return normalized.length > 0 ? normalized : null;
}

function normalizeDigits(value: string | number | null | undefined) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
}

function normalizeStateCode(value: string | null | undefined) {
    const normalized = normalizeText(value)?.toUpperCase() || null;
    return normalized ? normalized.slice(0, 2) : null;
}

function limitAsaasName(value: string, fallback: string) {
    const normalized = normalizeText(value) || normalizeText(fallback) || '';
    return normalized.slice(0, 30);
}

function isValidCpf(value: string | null | undefined) {
    const digits = normalizeDigits(value);
    if (!digits || digits.length !== 11) {
        return false;
    }
    if (/^(\d)\1{10}$/.test(digits)) {
        return false;
    }
    const numbers = digits.split('').map((digit) => Number(digit));
    const calcDigit = (length: number) => {
        let sum = 0;
        for (let i = 0; i < length; i += 1) {
            sum += numbers[i] * (length + 1 - i);
        }
        const remainder = (sum * 10) % 11;
        return remainder === 10 ? 0 : remainder;
    };
    const firstDigit = calcDigit(9);
    const secondDigit = calcDigit(10);
    return firstDigit === numbers[9] && secondDigit === numbers[10];
}

function getErrorMessage(error: unknown) {
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = Reflect.get(error, 'message');
        if (typeof message === 'string') {
            return message;
        }
    }
    return '';
}

function isLegacyCourseSalesSchemaError(error: unknown) {
    const message = getErrorMessage(error).toLowerCase();
    return ['slug', 'launch_date', 'price_cents', 'currency', 'is_public'].some((column) => {
        return (
            message.includes(`courses.${column}`) ||
            message.includes(`column ${column}`) ||
            message.includes(`'${column}' column`) ||
            message.includes(`"${column}"`)
        ) && (
            message.includes('does not exist') ||
            message.includes('could not find') ||
            message.includes('schema cache')
        );
    });
}

function mapCpfError(error: unknown) {
    const message = getErrorMessage(error).toLowerCase();
    if (message.includes('cpf') || message.includes('document') || message.includes('invalid')) {
        return 'CPF invalido.';
    }
    return null;
}

function readMetadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === 'string' ? value : null;
}

function readAsaasError(payload: CheckoutErrorPayload | null, fallback: string) {
    return (
        payload?.message?.trim() ||
        payload?.errors?.[0]?.description?.trim() ||
        fallback
    );
}

async function queueUserNotification(
    adminClient: SupabaseClient,
    input: {
        userId: string;
        title: string;
        body: string;
        category?: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        actionUrl?: string | null;
        channels?: Array<'push' | 'email' | 'whatsapp' | 'in-app'>;
        metadata?: Record<string, unknown>;
    }
) {
    const { error } = await adminClient.rpc('create_user_notification', {
        _user_id: input.userId,
        _title: input.title,
        _body: input.body,
        _category: input.category || 'system',
        _priority: input.priority || 'normal',
        _action_url: input.actionUrl || null,
        _channels: input.channels || ['in-app'],
        _metadata: input.metadata || {},
    });
    if (error) {
        throw error;
    }
}

async function loadCourse(adminClient: SupabaseClient, courseId: string) {
    const primary = await adminClient
        .from('courses')
        .select('id, title, description, status, price_cents, currency, is_public')
        .eq('id', courseId)
        .maybeSingle();

    if (!primary.error) {
        return {
            course: primary.data as CourseRecord | null,
            error: null as unknown,
            usingLegacySchema: false,
        };
    }

    if (!isLegacyCourseSalesSchemaError(primary.error)) {
        return {
            course: null as CourseRecord | null,
            error: primary.error,
            usingLegacySchema: false,
        };
    }

    const legacy = await adminClient
        .from('courses')
        .select('id, title, description, status')
        .eq('id', courseId)
        .maybeSingle();

    if (legacy.error) {
        return {
            course: null as CourseRecord | null,
            error: legacy.error,
            usingLegacySchema: true,
        };
    }

    const legacyCourse = legacy.data as LegacyCourseRecord | null;
    return {
        course: legacyCourse
            ? {
                ...legacyCourse,
                price_cents: null,
                currency: 'BRL',
                is_public: true,
            }
            : null,
        error: null as unknown,
        usingLegacySchema: true,
    };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method === 'OPTIONS') {
        jsonResponse(res, 200, { ok: true });
        return;
    }

    if (req.method !== 'POST') {
        jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        jsonResponse(res, 500, { error: 'Configuracao do Supabase ausente.' });
        return;
    }

    const body = parseBody(req.body);
    const parsed = startCheckoutSchema.safeParse(body);
    if (!parsed.success) {
        jsonResponse(res, 400, {
            error: parsed.error.issues[0]?.message || 'Dados invalidos.',
        });
        return;
    }

    const accessToken = getBearerToken(
        getHeaderValue(req.headers.authorization) || getHeaderValue(req.headers.Authorization)
    );
    if (!accessToken) {
        jsonResponse(res, 401, { error: 'Token de acesso obrigatorio para iniciar o checkout.' });
        return;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
        jsonResponse(res, 401, { error: 'Token ausente ou invalido.' });
        return;
    }

    const authUser = userData.user;
    const authMetadata = authUser.user_metadata as Record<string, unknown> | null | undefined;
    const buyerUserId = normalizeText(parsed.data.buyerUserId);
    if (buyerUserId && buyerUserId !== authUser.id) {
        jsonResponse(res, 403, { error: 'buyerUserId nao corresponde ao usuario autenticado.' });
        return;
    }

    const resolvedUserId = authUser.id;

    const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, email, full_name, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city')
        .eq('id', resolvedUserId)
        .maybeSingle();

    if (profileError) {
        jsonResponse(res, 500, { error: 'Nao foi possivel carregar o perfil do usuario.' });
        return;
    }

    const { course, error: courseError, usingLegacySchema } = await loadCourse(adminClient, parsed.data.courseId);
    if (courseError) {
        jsonResponse(res, 500, { error: 'Nao foi possivel carregar o curso.' });
        return;
    }

    if (!course || course.status !== 'published' || course.is_public !== true) {
        jsonResponse(res, 404, { error: 'Curso indisponivel para compra.' });
        return;
    }

    if (usingLegacySchema) {
        jsonResponse(res, 503, { error: 'Checkout indisponivel ate concluir a migracao comercial do banco.' });
        return;
    }

    const buyerName = limitAsaasName(
        parsed.data.buyerName ||
        profile?.full_name ||
        readMetadataText(authMetadata, 'full_name') ||
        authUser.email ||
        'Aluno GenFlix',
        'Aluno GenFlix'
    );

    const buyerEmail = normalizeText(parsed.data.buyerEmail) || normalizeText(profile?.email) || normalizeText(authUser.email);
    const buyerDocument = normalizeDigits(parsed.data.buyerDocument) ||
        normalizeDigits(profile?.cpf) ||
        normalizeDigits(readMetadataText(authMetadata, 'document')) ||
        normalizeDigits(readMetadataText(authMetadata, 'cpf'));
    const buyerPhone = normalizeDigits(parsed.data.buyerPhone) ||
        normalizeDigits(profile?.whatsapp_number) ||
        normalizeDigits(readMetadataText(authMetadata, 'phone')) ||
        normalizeDigits(readMetadataText(authMetadata, 'phone_number'));
    const buyerAddress = normalizeText(parsed.data.buyerAddress) || normalizeText(profile?.address);
    const buyerAddressNumber = normalizeText(parsed.data.buyerAddressNumber) || normalizeText(profile?.address_number);
    const buyerAddressComplement = normalizeText(parsed.data.buyerAddressComplement) || normalizeText(profile?.address_complement);
    const buyerPostalCode = normalizeDigits(parsed.data.buyerPostalCode) || normalizeDigits(profile?.postal_code);
    const buyerState = normalizeStateCode(parsed.data.buyerState) || normalizeStateCode(profile?.state);
    const buyerProvince = normalizeText(parsed.data.buyerProvince) || normalizeText(profile?.province);
    const buyerCity = normalizeDigits(parsed.data.buyerCity) || normalizeDigits(profile?.city as string | undefined);

    if (!buyerEmail) {
        jsonResponse(res, 400, { error: 'Informe um e-mail valido para iniciar o checkout.' });
        return;
    }

    if (!isValidCpf(buyerDocument)) {
        jsonResponse(res, 400, { error: 'CPF invalido.' });
        return;
    }

    if (!buyerPhone || buyerPhone.length < 10) {
        jsonResponse(res, 400, { error: 'Informe um celular valido para iniciar o checkout.' });
        return;
    }

    if (!buyerAddress || !buyerAddressNumber || !buyerPostalCode || buyerPostalCode.length !== 8 || !buyerState || !buyerProvince || !buyerCity) {
        jsonResponse(res, 400, { error: 'Informe o endereco completo para iniciar o checkout.' });
        return;
    }

    const profileUpsertResult = await adminClient.from('profiles').upsert({
        id: resolvedUserId,
        email: buyerEmail,
        full_name: buyerName,
        cpf: buyerDocument,
        whatsapp_number: buyerPhone,
        address: buyerAddress,
        address_number: buyerAddressNumber,
        address_complement: buyerAddressComplement,
        postal_code: buyerPostalCode,
        state: buyerState,
        province: buyerProvince,
        city: buyerCity,
    }, { onConflict: 'id' });

    if (profileUpsertResult.error) {
        const cpfError = mapCpfError(profileUpsertResult.error);
        if (cpfError) {
            jsonResponse(res, 400, { error: cpfError });
            return;
        }
        console.error('checkout_profile_upsert_failed', profileUpsertResult.error);
        jsonResponse(res, 500, { error: 'Nao foi possivel atualizar o perfil do usuario.' });
        return;
    }

    const origin = getRequestOrigin();
    const priceCents = Number(course.price_cents || 0);

    if (priceCents <= 0) {
        const releaseResult = await adminClient.from('course_releases').upsert({
            course_id: course.id,
            release_type: 'user',
            user_id: resolvedUserId,
            group_id: null,
            starts_at: null,
            ends_at: null,
            is_active: true,
            created_by: resolvedUserId,
            release_source: 'purchase',
            release_status: 'active',
            source_system: 'asaas',
            external_reference_id: `free-${course.id}-${resolvedUserId}`,
            managed_by_integration: true,
            last_synced_at: new Date().toISOString(),
        }, { onConflict: 'course_id,user_id' });

        if (releaseResult.error) {
            console.error('checkout_free_release_failed', releaseResult.error);
            jsonResponse(res, 500, { error: 'Nao foi possivel liberar o curso gratuito.' });
            return;
        }

        await queueUserNotification(adminClient, {
            userId: resolvedUserId,
            title: 'Curso liberado com sucesso',
            body: `O acesso ao curso ${course.title || 'selecionado'} ja esta disponivel na sua area do aluno.`,
            category: 'payment',
            priority: 'high',
            actionUrl: `/aluno/cursos/${course.id}`,
            channels: ['in-app', 'email'],
            metadata: {
                course_id: course.id,
                release_mode: 'free',
            },
        }).catch((error) => {
            console.error('checkout_free_notification_failed', error);
        });

        jsonResponse(res, 200, {
            checkoutUrl: `${origin}/aluno/cursos/${course.id}`,
            mode: 'free',
        });
        return;
    }

    const gatewayConfigResult = await adminClient
        .from('payment_gateway_settings')
        .select('environment, gateway_code, is_active')
        .eq('id', 1)
        .maybeSingle();

    if (gatewayConfigResult.error) {
        console.error('checkout_gateway_config_failed', gatewayConfigResult.error);
        jsonResponse(res, 500, { error: 'Nao foi possivel carregar a configuracao do gateway.' });
        return;
    }

    const gatewayConfig = (gatewayConfigResult.data as PaymentGatewayConfig | null) || {
        environment: 'sandbox' as const,
        gateway_code: 'asaas',
        is_active: true,
    };

    if (!gatewayConfig.is_active || gatewayConfig.gateway_code !== 'asaas') {
        jsonResponse(res, 400, { error: 'Gateway de pagamento indisponivel.' });
        return;
    }

    const asaasEnvironment = gatewayConfig.environment || 'sandbox';
    const asaasToken = getAsaasAccessToken(asaasEnvironment);
    if (!asaasToken) {
        jsonResponse(res, 500, { error: 'Chave do Asaas nao configurada para o ambiente ativo.' });
        return;
    }

    const checkoutSessionId = crypto.randomUUID();
    const totalAmount = priceCents / 100;
    const minimumInstallmentBase = Math.floor(totalAmount / 50);
    const maxInstallmentCount = minimumInstallmentBase >= 2
        ? Math.max(2, Math.min(12, minimumInstallmentBase))
        : null;
    const chargeTypes = maxInstallmentCount ? ['DETACHED', 'INSTALLMENT'] : ['DETACHED'];

    const successUrl = new URL('/checkout/confirmacao', origin);
    successUrl.searchParams.set('courseId', course.id);
    successUrl.searchParams.set('courseTitle', course.title || '');
    successUrl.searchParams.set('courseValue', String(totalAmount));
    successUrl.searchParams.set('currency', course.currency || 'BRL');

    const cancelUrl = new URL(`/aluno/cursos/${course.id}`, origin);
    cancelUrl.searchParams.set('checkout', 'cancel');

    const expiredUrl = new URL(`/aluno/cursos/${course.id}`, origin);
    expiredUrl.searchParams.set('checkout', 'expired');

    const checkoutRequest: Record<string, unknown> = {
        billingTypes: ['CREDIT_CARD'],
        chargeTypes,
        minutesToExpire: 1440,
        externalReference: checkoutSessionId,
        callback: {
            successUrl: successUrl.toString(),
            cancelUrl: cancelUrl.toString(),
            expiredUrl: expiredUrl.toString(),
        },
        items: [
            {
                name: limitAsaasName(course.title, 'Curso GenFlix'),
                description: (course.description || '').replace(/<[^>]*>/gm, ' ').trim() || course.title,
                quantity: 1,
                value: totalAmount,
            },
        ],
        customerData: {
            name: buyerName,
            email: buyerEmail,
            cpfCnpj: buyerDocument,
            phone: buyerPhone,
            address: buyerAddress,
            addressNumber: buyerAddressNumber,
            complement: buyerAddressComplement,
            postalCode: buyerPostalCode,
            province: buyerProvince,
            city: Number(buyerCity),
        },
    };

    if (maxInstallmentCount) {
        checkoutRequest.installment = {
            maxInstallmentCount,
        };
    }

    const createCheckoutResponse = await fetch(`${getAsaasBaseUrl(asaasEnvironment)}/v3/checkouts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            access_token: asaasToken,
        },
        body: JSON.stringify(checkoutRequest),
    });

    const checkoutPayload = await createCheckoutResponse.json().catch(() => null) as CheckoutErrorPayload | null;
    const checkoutPayloadMessage = readAsaasError(checkoutPayload, 'Nao foi possivel criar o checkout.');

    if (!createCheckoutResponse.ok || !checkoutPayload?.id) {
        console.error('checkout_create_failed', {
            status: createCheckoutResponse.status,
            payload: checkoutPayload,
            message: checkoutPayloadMessage,
        });
        jsonResponse(res, createCheckoutResponse.status || 502, {
            error: checkoutPayloadMessage,
        });
        return;
    }

    const checkoutUrl = `${asaasEnvironment === 'sandbox' ? 'https://sandbox.asaas.com' : 'https://asaas.com'}/checkoutSession/show?id=${checkoutPayload.id}`;

    const sessionInsert = await adminClient.from('commerce_checkout_sessions').insert({
        id: checkoutSessionId,
        course_id: course.id,
        user_id: resolvedUserId,
        amount_cents: priceCents,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_document: buyerDocument,
        buyer_phone: buyerPhone,
        buyer_address: buyerAddress,
        buyer_address_number: buyerAddressNumber,
        buyer_address_complement: buyerAddressComplement,
        buyer_postal_code: buyerPostalCode,
        buyer_state: buyerState,
        buyer_province: buyerProvince,
        buyer_city: buyerCity,
        gateway_code: 'asaas',
        gateway_environment: asaasEnvironment,
        external_reference_id: checkoutSessionId,
        external_reference: checkoutSessionId,
        external_checkout_id: checkoutPayload.id,
        checkout_url: checkoutUrl,
        status: 'active',
        raw_request: checkoutRequest,
        raw_response: checkoutPayload,
    });

    if (sessionInsert.error) {
        console.error('checkout_session_insert_failed', sessionInsert.error);
        jsonResponse(res, 500, { error: 'Nao foi possivel registrar o pedido antes de enviar ao pagamento.' });
        return;
    }

    jsonResponse(res, 200, {
        checkoutUrl,
        checkoutId: checkoutPayload.id,
    });
}
