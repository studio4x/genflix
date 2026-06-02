import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createAsaasPixTransfer, fetchAsaasBalance, fetchAsaasTransfer, fetchPaymentGatewayConfiguration, getAsaasAccessToken, getBearerToken, getHeaderValue, type AsaasEnvironment, type AsaasTransferPayload, } from '../_shared/asaas.js';
import { queueUserNotification } from '../_shared/notifications.js';
type ApiRequest = {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
};
type ApiResponse = {
    status: (statusCode: number) => ApiResponse;
    json: (payload: unknown) => void;
    setHeader: (name: string, value: string) => void;
};
type CreatorCommissionRecord = {
    id: string;
    course_id: string;
    creator_id: string;
    commission_amount_cents: number;
    status: string;
    eligible_at: string;
};
type CreatorProfileRecord = {
    user_id: string;
    payout_name: string | null;
    pix_key_type: string | null;
    pix_key: string | null;
    is_payout_enabled: boolean;
};
type CourseRecord = {
    id: string;
    title: string | null;
};
type PayoutSettingsRecord = {
    id: number;
    mode: 'manual' | 'automatic';
    interval_days: number;
    minimum_amount_cents: number;
    is_enabled: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
};
type PayoutRecord = {
    id: string;
    creator_id: string;
    course_id: string | null;
    amount_cents: number;
    external_transfer_id: string | null;
    external_status: string | null;
    gateway_code: string | null;
    status: string;
};
type AdminContext = {
    adminClient: SupabaseClient;
    requesterId: string | null;
    isSystem: boolean;
};
type EligibleSelection = {
    commissions: CreatorCommissionRecord[];
    creator: CreatorProfileRecord;
    course: CourseRecord;
    amountCents: number;
};
const registerExternalPayoutSchema = z.object({
    action: z.union([z.literal('register_paid_payout'), z.literal('register_external_payout')]),
    creatorId: z.string().uuid('Criador inválido.'),
    commissionIds: z.array(z.string().uuid('Comissão inválida.')).min(1, 'Selecione ao menos uma comissão.'),
    paidAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
});
const sendPixPayoutSchema = z.object({
    action: z.literal('send_pix_payout'),
    creatorId: z.string().uuid('Criador inválido.'),
    commissionIds: z.array(z.string().uuid('Comissão inválida.')).min(1, 'Selecione ao menos uma comissão.'),
    notes: z.string().max(1000).optional(),
});
const updateSettingsSchema = z.object({
    action: z.literal('update_payout_settings'),
    mode: z.enum(['manual', 'automatic']),
    intervalDays: z.number().int().min(1).max(90),
    minimumAmountCents: z.number().int().min(0),
    isEnabled: z.boolean(),
    nextRunAt: z
        .string()
        .trim()
        .refine((value) => !Number.isNaN(Date.parse(value)), 'Data de proxima execucao invalida.')
        .transform((value) => new Date(value).toISOString())
        .nullable()
        .optional(),
});
const processDueSchema = z.object({
    action: z.literal('process_due_payouts'),
    force: z.boolean().optional(),
});
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
function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
    res.status(statusCode);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
}
function getQueryValue(req: ApiRequest, key: string) {
    const direct = req.query?.[key];
    if (typeof direct === 'string') {
        return direct;
    }
    if (Array.isArray(direct) && direct[0]) {
        return direct[0];
    }
    if (!req.url) {
        return null;
    }
    try {
        const url = new URL(req.url, 'https://genflix.local');
        return url.searchParams.get(key);
    }
    catch {
        return null;
    }
}
function getNextRunAt(intervalDays: number) {
    const next = new Date();
    next.setDate(next.getDate() + intervalDays);
    return next.toISOString();
}
function getSafeAsaasStatus(payload: AsaasTransferPayload | null | undefined) {
    const status = payload?.status;
    return status === 'DONE' || status === 'PENDING' || status === 'CANCELLED' ? status : 'PENDING';
}
function formatTransferDescription(creatorLabel: string, courseTitle: string) {
    return `Repasse GenFlix - ${creatorLabel} - ${courseTitle}`.slice(0, 140);
}
function formatCurrencyCents(amountCents: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format((amountCents ?? 0) / 100);
}
async function fetchCourseTitle(adminClient: SupabaseClient, courseId: string | null | undefined) {
    if (!courseId) {
        return 'seus cursos';
    }
    const result = await adminClient
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .maybeSingle();
    return typeof result.data?.title === 'string' && result.data.title.trim()
        ? result.data.title.trim()
        : 'seus cursos';
}
async function notifyCreatorPayoutEvent(input: {
    adminClient: SupabaseClient;
    creatorId: string;
    courseId?: string | null;
    amountCents: number;
    kind: 'processing' | 'paid' | 'failed';
    failureReason?: string | null;
}) {
    const courseTitle = await fetchCourseTitle(input.adminClient, input.courseId);
    const amountLabel = formatCurrencyCents(input.amountCents);
    const copy = {
        processing: {
            title: 'Repasse iniciado',
            body: `Um repasse de ${amountLabel} referente ao curso ${courseTitle} entrou em processamento.`,
            priority: 'normal' as const,
        },
        paid: {
            title: 'Repasse concluido',
            body: `O repasse de ${amountLabel} referente ao curso ${courseTitle} foi concluido com sucesso.`,
            priority: 'high' as const,
        },
        failed: {
            title: 'Repasse com falha',
            body: `O repasse de ${amountLabel} referente ao curso ${courseTitle} precisa de revis?o. ${input.failureReason ?? 'Verifique o status no painel.'}`,
            priority: 'high' as const,
        },
    }[input.kind];
    await queueUserNotification(input.adminClient, {
        userId: input.creatorId,
        title: copy.title,
        body: copy.body,
        category: 'payout',
        priority: copy.priority,
        actionUrl: '/criador/relatorios',
        channels: ['in-app', 'email'],
        metadata: {
            course_id: input.courseId ?? null,
            amount_cents: input.amountCents,
            payout_status: input.kind,
        },
    }).catch(() => undefined);
}
async function createServiceClient() {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Configuração ausente: Supabase URL e service role são obrigatórios.');
    }
    return {
        supabaseUrl,
        serviceRoleKey,
        adminClient: createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        }),
    };
}
async function createAdminContext(req: ApiRequest, res: ApiResponse): Promise<AdminContext | null> {
    let serviceContext: Awaited<ReturnType<typeof createServiceClient>>;
    try {
        serviceContext = await createServiceClient();
    }
    catch (error) {
        jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Configuração do Supabase ausente.' });
        return null;
    }
    const token = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization));
    if (!token) {
        jsonResponse(res, 401, { error: 'Token de acesso ausente.' });
        return null;
    }
    const userResult = await serviceContext.adminClient.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
        jsonResponse(res, 401, { error: 'Token inválido ou expirado.' });
        return null;
    }
    const rolesResult = await serviceContext.adminClient
        .from('user_roles')
        .select('roles(code)')
        .eq('user_id', userResult.data.user.id);
    if (rolesResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível validar as permissões do usuário.' });
        return null;
    }
    const roles = ((rolesResult.data as Array<{
        roles: {
            code: string;
        } | {
            code: string;
        }[] | null;
    }> | null) ?? [])
        .flatMap((relation) => {
        if (!relation.roles) {
            return [];
        }
        return Array.isArray(relation.roles) ? relation.roles : [relation.roles];
    })
        .map((role) => role.code);
    if (!roles.includes('admin')) {
        jsonResponse(res, 403, { error: 'Apenas administradores podem gerenciar repasses.' });
        return null;
    }
    return {
        adminClient: serviceContext.adminClient,
        requesterId: userResult.data.user.id,
        isSystem: false,
    };
}
async function createCronContext(req: ApiRequest, res: ApiResponse): Promise<AdminContext | null> {
    const expectedSecret = process.env.CREATOR_PAYOUT_CRON_SECRET ?? process.env.CRON_SECRET;
    const receivedSecret = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization));
    if (!expectedSecret || receivedSecret !== expectedSecret) {
        jsonResponse(res, 403, { error: 'Cron de repasses não autorizado.' });
        return null;
    }
    try {
        const serviceContext = await createServiceClient();
        return {
            adminClient: serviceContext.adminClient,
            requesterId: null,
            isSystem: true,
        };
    }
    catch (error) {
        jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Configuração do Supabase ausente.' });
        return null;
    }
}
async function getGatewayContext(adminClient: SupabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Configuração do Supabase ausente.');
    }
    const gatewayConfig = await fetchPaymentGatewayConfiguration(supabaseUrl, serviceRoleKey);
    const environment = (gatewayConfig.environment ?? 'sandbox') as AsaasEnvironment;
    if (!gatewayConfig.is_active || gatewayConfig.gateway_code !== 'asaas') {
        throw new Error('O gateway Asaas não está ativo para repasses.');
    }
    const accessToken = getAsaasAccessToken(environment);
    if (!accessToken) {
        throw new Error(`Token Asaas não configurado para ${environment}.`);
    }
    return {
        adminClient,
        environment,
        accessToken,
    };
}
async function fetchPayoutSettings(adminClient: SupabaseClient): Promise<PayoutSettingsRecord> {
    const result = await adminClient
        .from('creator_payout_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
    if (result.error) {
        throw result.error;
    }
    return (result.data ?? {
        id: 1,
        mode: 'automatic',
        interval_days: 30,
        minimum_amount_cents: 0,
        is_enabled: true,
        last_run_at: null,
        next_run_at: new Date().toISOString(),
    }) as PayoutSettingsRecord;
}
async function handleList(context: AdminContext, res: ApiResponse) {
    const [commissionsResult, payoutsResult, payoutItemsResult, profilesResult, creatorProfilesResult, coursesResult, settingsResult,] = await Promise.all([
        context.adminClient
            .from('creator_commissions')
            .select('*')
            .order('sale_paid_at', { ascending: false })
            .limit(700),
        context.adminClient
            .from('creator_payouts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(150),
        context.adminClient
            .from('creator_payout_items')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1200),
        context.adminClient
            .from('profiles')
            .select('id, full_name, email'),
        context.adminClient
            .from('creator_profiles')
            .select('*'),
        context.adminClient
            .from('courses')
            .select('id, title'),
        context.adminClient
            .from('creator_payout_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle(),
    ]);
    const firstError = commissionsResult.error ??
        payoutsResult.error ??
        payoutItemsResult.error ??
        profilesResult.error ??
        creatorProfilesResult.error ??
        coursesResult.error ??
        settingsResult.error;
    if (firstError) {
        jsonResponse(res, 500, { error: firstError.message });
        return;
    }
    jsonResponse(res, 200, {
        commissions: commissionsResult.data ?? [],
        payouts: payoutsResult.data ?? [],
        payoutItems: payoutItemsResult.data ?? [],
        profiles: profilesResult.data ?? [],
        creatorProfiles: creatorProfilesResult.data ?? [],
        courses: coursesResult.data ?? [],
        payoutSettings: settingsResult.data ?? {
            id: 1,
            mode: 'automatic',
            interval_days: 30,
            minimum_amount_cents: 0,
            is_enabled: true,
            last_run_at: null,
            next_run_at: new Date().toISOString(),
        },
    });
}
async function resolveEligibleSelection(input: {
    adminClient: SupabaseClient;
    creatorId: string;
    commissionIds: string[];
    requireSingleCourse: boolean;
}) {
    const uniqueIds = Array.from(new Set(input.commissionIds));
    const nowIso = new Date().toISOString();
    const [commissionsResult, payoutItemsResult, creatorResult] = await Promise.all([
        input.adminClient
            .from('creator_commissions')
            .select('id, course_id, creator_id, commission_amount_cents, status, eligible_at')
            .in('id', uniqueIds),
        input.adminClient
            .from('creator_payout_items')
            .select('commission_id')
            .in('commission_id', uniqueIds),
        input.adminClient
            .from('creator_profiles')
            .select('user_id, payout_name, pix_key_type, pix_key, is_payout_enabled')
            .eq('user_id', input.creatorId)
            .maybeSingle(),
    ]);
    if (commissionsResult.error) {
        throw commissionsResult.error;
    }
    if (payoutItemsResult.error) {
        throw payoutItemsResult.error;
    }
    if (creatorResult.error) {
        throw creatorResult.error;
    }
    const alreadyLinked = new Set((payoutItemsResult.data ?? []).map((item) => item.commission_id as string));
    if (alreadyLinked.size > 0) {
        throw new Error('Uma ou mais comissões selecionadas já fazem parte de outro repasse.');
    }
    const commissions = (commissionsResult.data ?? []) as CreatorCommissionRecord[];
    if (commissions.length !== uniqueIds.length) {
        throw new Error('Seleção inválida de comissões.');
    }
    const invalid = commissions.find((commission) => (commission.creator_id !== input.creatorId ||
        !['pending', 'eligible'].includes(commission.status) ||
        new Date(commission.eligible_at) > new Date(nowIso)));
    if (invalid) {
        throw new Error('Use apenas comissões elegíveis, pendentes e do mesmo criador.');
    }
    const courseIds = Array.from(new Set(commissions.map((commission) => commission.course_id)));
    if (input.requireSingleCourse && courseIds.length !== 1) {
        throw new Error('O pagamento via Asaas deve agrupar comissões de um único curso por vez.');
    }
    const courseResult = await input.adminClient
        .from('courses')
        .select('id, title')
        .eq('id', courseIds[0])
        .maybeSingle();
    if (courseResult.error) {
        throw courseResult.error;
    }
    const creator = creatorResult.data as CreatorProfileRecord | null;
    if (!creator?.is_payout_enabled || !creator.pix_key || !creator.pix_key_type) {
        throw new Error("O criador precisa estr habilitado para repasse e ter chave PIX cadastrada.");
    }
    const amountCents = commissions.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0);
    if (amountCents <= 0) {
        throw new Error('O total líquido do repasse precisa ser maior que zero.');
    }
    return {
        commissions,
        creator,
        course: (courseResult.data ?? { id: courseIds[0], title: 'Curso' }) as CourseRecord,
        amountCents,
    } satisfies EligibleSelection;
}
async function markPayoutFailedAndRelease(input: {
    adminClient: SupabaseClient;
    payoutId: string;
    commissionIds: string[];
    reason: string;
    rawResponse?: unknown;
}) {
    await input.adminClient
        .from('creator_payout_items')
        .delete()
        .eq('payout_id', input.payoutId);
    await input.adminClient
        .from('creator_commissions')
        .update({
        status: 'eligible',
        notes: input.reason,
    })
        .in('id', input.commissionIds);
    await input.adminClient
        .from('creator_payouts')
        .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: input.reason,
        raw_response: input.rawResponse ?? null,
    })
        .eq('id', input.payoutId);
}
async function finalizePayoutStatus(input: {
    adminClient: SupabaseClient;
    payout: PayoutRecord;
    transferPayload: AsaasTransferPayload;
}) {
    const status = getSafeAsaasStatus(input.transferPayload);
    const nowIso = new Date().toISOString();
    const payoutItems = await input.adminClient
        .from('creator_payout_items')
        .select('commission_id')
        .eq('payout_id', input.payout.id);
    if (payoutItems.error) {
        throw payoutItems.error;
    }
    const commissionIds = (payoutItems.data ?? []).map((item) => item.commission_id as string);
    if (status === 'DONE') {
        await input.adminClient
            .from('creator_payouts')
            .update({
            status: 'paid',
            external_status: status,
            paid_at: nowIso,
            raw_response: input.transferPayload,
        })
            .eq('id', input.payout.id);
        if (commissionIds.length > 0) {
            await input.adminClient
                .from('creator_commissions')
                .update({
                status: 'paid',
                paid_at: nowIso,
            })
                .in('id', commissionIds);
        }
        await notifyCreatorPayoutEvent({
            adminClient: input.adminClient,
            creatorId: input.payout.creator_id,
            courseId: input.payout.course_id,
            amountCents: input.payout.amount_cents,
            kind: 'paid',
        });
        return 'paid';
    }
    if (status === 'CANCELLED') {
        await markPayoutFailedAndRelease({
            adminClient: input.adminClient,
            payoutId: input.payout.id,
            commissionIds,
            reason: 'Transferência cancelada no Asaas.',
            rawResponse: input.transferPayload,
        });
        await notifyCreatorPayoutEvent({
            adminClient: input.adminClient,
            creatorId: input.payout.creator_id,
            courseId: input.payout.course_id,
            amountCents: input.payout.amount_cents,
            kind: 'failed',
            failureReason: 'A transferencia foi cancelada no Asaas.',
        });
        return 'failed';
    }
    await input.adminClient
        .from('creator_payouts')
        .update({
        status: 'processing',
        external_status: status,
        raw_response: input.transferPayload,
    })
        .eq('id', input.payout.id);
    return 'processing';
}
async function sendPayoutViaAsaas(input: {
    context: AdminContext;
    selection: EligibleSelection;
    notes?: string | null;
    source: 'manual' | 'automatic';
}) {
    const gateway = await getGatewayContext(input.context.adminClient);
    const balance = await fetchAsaasBalance(gateway.environment, gateway.accessToken);
    const availableCents = Math.floor(balance * 100);
    if (availableCents < input.selection.amountCents) {
        throw new Error('Saldo Asaas insuficiente para enviar este repasse.');
    }
    const commissionIds = input.selection.commissions.map((commission) => commission.id);
    const externalReference = `genflix-payout-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const creatorLabel = input.selection.creator.payout_name || 'Criador';
    const description = formatTransferDescription(creatorLabel, input.selection.course.title ?? 'Curso');
    const payoutInsert = await input.context.adminClient
        .from('creator_payouts')
        .insert({
        creator_id: input.selection.creator.user_id,
        course_id: input.selection.course.id,
        amount_cents: input.selection.amountCents,
        status: 'processing',
        payout_method: 'asaas',
        gateway_code: 'asaas',
        external_reference: externalReference,
        pix_key_type: input.selection.creator.pix_key_type,
        pix_key: input.selection.creator.pix_key,
        payout_name: input.selection.creator.payout_name,
        scheduled_for: nowIso.slice(0, 10),
        processing_started_at: nowIso,
        created_by: input.context.requesterId,
        notes: input.notes ?? `${input.source === 'automatic' ? 'Repasse automático' : 'Repasse manual'} via Asaas.`,
    })
        .select('*')
        .single();
    if (payoutInsert.error) {
        throw payoutInsert.error;
    }
    const payout = payoutInsert.data as PayoutRecord;
    const itemsInsert = await input.context.adminClient
        .from('creator_payout_items')
        .insert(input.selection.commissions.map((commission) => ({
        payout_id: payout.id,
        commission_id: commission.id,
        amount_cents: commission.commission_amount_cents,
    })));
    if (itemsInsert.error) {
        await markPayoutFailedAndRelease({
            adminClient: input.context.adminClient,
            payoutId: payout.id,
            commissionIds,
            reason: itemsInsert.error.message,
        });
        throw itemsInsert.error;
    }
    await input.context.adminClient
        .from('creator_commissions')
        .update({
        status: 'scheduled',
        notes: input.notes ?? 'Repasse enviado para processamento no Asaas.',
    })
        .in('id', commissionIds);
    try {
        const transfer = await createAsaasPixTransfer({
            environment: gateway.environment,
            accessToken: gateway.accessToken,
            amountCents: input.selection.amountCents,
            pixKey: input.selection.creator.pix_key ?? '',
            pixKeyType: input.selection.creator.pix_key_type ?? '',
            description,
            externalReference,
        });
        await input.context.adminClient
            .from('creator_payouts')
            .update({
            external_transfer_id: transfer.payload.id,
            external_status: transfer.payload.status ?? null,
            raw_request: transfer.requestBody,
            raw_response: transfer.payload,
        })
            .eq('id', payout.id);
        const finalStatus = await finalizePayoutStatus({
            adminClient: input.context.adminClient,
            payout: {
                ...payout,
                external_transfer_id: transfer.payload.id ?? null,
                external_status: transfer.payload.status ?? null,
            },
            transferPayload: transfer.payload,
        });
        if (finalStatus === 'processing') {
            await notifyCreatorPayoutEvent({
                adminClient: input.context.adminClient,
                creatorId: input.selection.creator.user_id,
                courseId: input.selection.course.id,
                amountCents: input.selection.amountCents,
                kind: 'processing',
            });
        }
        return {
            payoutId: payout.id,
            transferId: transfer.payload.id,
            status: finalStatus,
            externalStatus: transfer.payload.status ?? null,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao enviar transferência PIX no Asaas.';
        await markPayoutFailedAndRelease({
            adminClient: input.context.adminClient,
            payoutId: payout.id,
            commissionIds,
            reason: message,
        });
        await notifyCreatorPayoutEvent({
            adminClient: input.context.adminClient,
            creatorId: input.selection.creator.user_id,
            courseId: input.selection.course.id,
            amountCents: input.selection.amountCents,
            kind: 'failed',
            failureReason: message,
        });
        throw error;
    }
}
async function syncProcessingPayouts(context: AdminContext) {
    const gateway = await getGatewayContext(context.adminClient);
    const payoutsResult = await context.adminClient
        .from('creator_payouts')
        .select('id, creator_id, course_id, amount_cents, external_transfer_id, gateway_code, status')
        .eq('payout_method', 'asaas')
        .eq('status', 'processing')
        .not('external_transfer_id', 'is', null)
        .limit(50);
    if (payoutsResult.error) {
        throw payoutsResult.error;
    }
    const results = [];
    for (const payout of (payoutsResult.data ?? []) as PayoutRecord[]) {
        if (!payout.external_transfer_id) {
            continue;
        }
        const transferPayload = await fetchAsaasTransfer({
            environment: gateway.environment,
            accessToken: gateway.accessToken,
            transferId: payout.external_transfer_id,
        });
        const status = await finalizePayoutStatus({
            adminClient: context.adminClient,
            payout,
            transferPayload,
        });
        results.push({ payoutId: payout.id, status, externalStatus: transferPayload.status ?? null });
    }
    return results;
}
async function handleRegisterExternalPayout(context: AdminContext, req: ApiRequest, res: ApiResponse) {
    const body = parseBody(req.body);
    const parsed = registerExternalPayoutSchema.safeParse(body);
    if (!parsed.success) {
        jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const paidAt = parsed.data.paidAt ?? new Date().toISOString();
    const { data, error } = await context.adminClient.rpc('register_creator_commission_payout', {
        _creator_id: parsed.data.creatorId,
        _commission_ids: Array.from(new Set(parsed.data.commissionIds)),
        _paid_at: paidAt,
        _created_by: context.requesterId,
        _notes: parsed.data.notes?.trim() || null,
        _payout_method: 'external',
    });
    if (error) {
        jsonResponse(res, 400, { error: error.message });
        return;
    }
    const payoutRecord = await context.adminClient
        .from('creator_payouts')
        .select('creator_id, course_id, amount_cents')
        .eq('id', data)
        .maybeSingle();
    if (payoutRecord.data) {
        await notifyCreatorPayoutEvent({
            adminClient: context.adminClient,
            creatorId: payoutRecord.data.creator_id as string,
            courseId: payoutRecord.data.course_id as string | null,
            amountCents: Number(payoutRecord.data.amount_cents ?? 0),
            kind: 'paid',
        });
    }
    jsonResponse(res, 200, {
        payoutId: data,
    });
}
async function handleSendPixPayout(context: AdminContext, req: ApiRequest, res: ApiResponse) {
    const body = parseBody(req.body);
    const parsed = sendPixPayoutSchema.safeParse(body);
    if (!parsed.success) {
        jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    try {
        const selection = await resolveEligibleSelection({
            adminClient: context.adminClient,
            creatorId: parsed.data.creatorId,
            commissionIds: parsed.data.commissionIds,
            requireSingleCourse: true,
        });
        const result = await sendPayoutViaAsaas({
            context,
            selection,
            notes: parsed.data.notes?.trim() || null,
            source: 'manual',
        });
        jsonResponse(res, 200, result);
    }
    catch (error) {
        jsonResponse(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível enviar o PIX via Asaas.' });
    }
}
async function handleUpdateSettings(context: AdminContext, req: ApiRequest, res: ApiResponse) {
    const body = parseBody(req.body);
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
        jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const nextRunAt = parsed.data.nextRunAt ?? getNextRunAt(parsed.data.intervalDays);
    const result = await context.adminClient
        .from('creator_payout_settings')
        .upsert({
        id: 1,
        mode: parsed.data.mode,
        interval_days: parsed.data.intervalDays,
        minimum_amount_cents: parsed.data.minimumAmountCents,
        is_enabled: parsed.data.isEnabled,
        next_run_at: nextRunAt,
        updated_by: context.requesterId,
    }, { onConflict: 'id' })
        .select('*')
        .single();
    if (result.error) {
        jsonResponse(res, 500, { error: result.error.message });
        return;
    }
    jsonResponse(res, 200, { payoutSettings: result.data });
}
async function getAutomaticGroups(context: AdminContext, settings: PayoutSettingsRecord) {
    const [commissionsResult, payoutItemsResult, creatorProfilesResult] = await Promise.all([
        context.adminClient
            .from('creator_commissions')
            .select('id, course_id, creator_id, commission_amount_cents, status, eligible_at')
            .in('status', ['pending', 'eligible'])
            .lte('eligible_at', new Date().toISOString())
            .limit(700),
        context.adminClient
            .from('creator_payout_items')
            .select('commission_id')
            .limit(2000),
        context.adminClient
            .from('creator_profiles')
            .select('user_id, payout_name, pix_key_type, pix_key, is_payout_enabled')
            .eq('is_payout_enabled', true),
    ]);
    if (commissionsResult.error) {
        throw commissionsResult.error;
    }
    if (payoutItemsResult.error) {
        throw payoutItemsResult.error;
    }
    if (creatorProfilesResult.error) {
        throw creatorProfilesResult.error;
    }
    const linkedCommissionIds = new Set((payoutItemsResult.data ?? []).map((item) => item.commission_id as string));
    const enabledCreators = new Set(((creatorProfilesResult.data ?? []) as CreatorProfileRecord[])
        .filter((profile) => profile.pix_key && profile.pix_key_type)
        .map((profile) => profile.user_id));
    const grouped = new Map<string, CreatorCommissionRecord[]>();
    for (const commission of (commissionsResult.data ?? []) as CreatorCommissionRecord[]) {
        if (linkedCommissionIds.has(commission.id) || !enabledCreators.has(commission.creator_id)) {
            continue;
        }
        const key = `${commission.creator_id}:${commission.course_id}`;
        grouped.set(key, [...(grouped.get(key) ?? []), commission]);
    }
    return Array.from(grouped.values())
        .map((commissions) => ({
        creatorId: commissions[0].creator_id,
        commissionIds: commissions.map((commission) => commission.id),
        amountCents: commissions.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0),
    }))
        .filter((group) => group.amountCents > 0 && group.amountCents >= settings.minimum_amount_cents);
}
async function handleProcessDuePayouts(context: AdminContext, req: ApiRequest, res: ApiResponse) {
    const body = parseBody(req.body);
    const parsed = processDueSchema.safeParse(body ?? { action: 'process_due_payouts' });
    const force = parsed.success ? Boolean(parsed.data.force) : false;
    try {
        const settings = await fetchPayoutSettings(context.adminClient);
        const now = new Date();
        const nextRunAt = settings.next_run_at ? new Date(settings.next_run_at) : null;
        const shouldRun = force || (settings.is_enabled && settings.mode === 'automatic' && (!nextRunAt || nextRunAt <= now));
        const synced = await syncProcessingPayouts(context);
        if (!shouldRun) {
            jsonResponse(res, 200, {
                processed: false,
                reason: 'Ciclo automático ainda não venceu ou está desativado.',
                synced,
            });
            return;
        }
        const groups = await getAutomaticGroups(context, settings);
        const payouts = [];
        const failures = [];
        for (const group of groups) {
            try {
                const selection = await resolveEligibleSelection({
                    adminClient: context.adminClient,
                    creatorId: group.creatorId,
                    commissionIds: group.commissionIds,
                    requireSingleCourse: true,
                });
                payouts.push(await sendPayoutViaAsaas({
                    context,
                    selection,
                    source: 'automatic',
                }));
            }
            catch (error) {
                failures.push({
                    creatorId: group.creatorId,
                    error: error instanceof Error ? error.message : 'Falha no repasse automático.',
                });
            }
        }
        const nextRun = getNextRunAt(settings.interval_days);
        await context.adminClient
            .from('creator_payout_settings')
            .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun,
            updated_by: context.requesterId,
        })
            .eq('id', 1);
        jsonResponse(res, 200, {
            processed: true,
            payouts,
            failures,
            synced,
            nextRunAt: nextRun,
        });
    }
    catch (error) {
        jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Não foi possível processar repasses automáticos.' });
    }
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method === 'OPTIONS') {
        jsonResponse(res, 200, { ok: true });
        return;
    }
    const cronTask = getQueryValue(req, 'task');
    if (req.method === 'GET' && cronTask === 'process_due_payouts') {
        const context = await createCronContext(req, res);
        if (!context) {
            return;
        }
        await handleProcessDuePayouts(context, req, res);
        return;
    }
    const context = await createAdminContext(req, res);
    if (!context) {
        return;
    }
    if (req.method === 'GET') {
        await handleList(context, res);
        return;
    }
    if (req.method === 'POST') {
        const body = parseBody(req.body);
        const action = typeof body?.action === 'string' ? body.action : null;
        if (action === 'register_paid_payout' || action === 'register_external_payout') {
            await handleRegisterExternalPayout(context, req, res);
            return;
        }
        if (action === 'send_pix_payout') {
            await handleSendPixPayout(context, req, res);
            return;
        }
        if (action === 'update_payout_settings') {
            await handleUpdateSettings(context, req, res);
            return;
        }
        if (action === 'process_due_payouts') {
            await handleProcessDuePayouts(context, req, res);
            return;
        }
        jsonResponse(res, 400, { error: 'Ação de repasse inválida.' });
        return;
    }
    jsonResponse(res, 405, { error: 'Método não permitido.' });
}
