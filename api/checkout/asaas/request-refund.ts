import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getAsaasAccessToken, getAsaasBaseUrl, getBearerToken, getHeaderValue } from '../../_shared/asaas.js';
type ApiRequest = {
    method: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
};
type ApiResponse = {
    status: (statusCode: number) => ApiResponse;
    json: (payload: unknown) => void;
    setHeader: (name: string, value: string) => void;
};
const requestSchema = z.object({
    checkoutSessionId: z.string().uuid("Pedido inv?lido."),
    reason: z.string().trim().max(1200).optional(),
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
type CheckoutSessionRow = {
    id: string;
    user_id: string | null;
    status: string;
    course_id: string | null;
    created_at: string;
    released_at: string | null;
    external_payment_id: string | null;
    gateway_environment: 'sandbox' | 'production';
    raw_response: Record<string, unknown> | null;
    courses: {
        title: string | null;
    } | Array<{
        title: string | null;
    }> | null;
};
const REFUND_WINDOW_DAYS = 7;
const REFUND_WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
function canRefundWithinWindow(referenceIsoDate: string | null | undefined) {
    if (!referenceIsoDate) {
        return false;
    }
    const referenceTime = Date.parse(referenceIsoDate);
    if (!Number.isFinite(referenceTime)) {
        return false;
    }
    return Date.now() - referenceTime <= REFUND_WINDOW_MS;
}
function getAsaasRefundError(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const typed = payload as {
        message: unknown;
        errors: Array<{
            description: unknown;
        }>;
    };
    if (typeof typed.message === 'string' && typed.message.trim().length > 0) {
        return typed.message.trim();
    }
    const description = typed.errors?.[0]?.description;
    if (typeof description === 'string' && description.trim().length > 0) {
        return description.trim();
    }
    return null;
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method === 'OPTIONS') {
        jsonResponse(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'POST') {
        jsonResponse(res, 405, { error: "M?todo no permitido." });
        return;
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        jsonResponse(res, 500, { error: "Configura??o do Supabase ausente." });
        return;
    }
    const accessToken = getBearerToken(getHeaderValue(req.headers.authorization) || getHeaderValue(req.headers.Authorization));
    if (!accessToken) {
        jsonResponse(res, 401, { error: "Token ausente ou inv?lido." });
        return;
    }
    const body = parseBody(req.body);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
        jsonResponse(res, 400, { error: parsed.error.issues[0]?.message || 'Dados invalidos.' });
        return;
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
        jsonResponse(res, 401, { error: "Token ausente ou inv?lido." });
        return;
    }
    const { data: session, error: sessionError } = await adminClient
        .from('commerce_checkout_sessions')
        .select(`
      id,
      user_id,
      status,
      course_id,
      created_at,
      released_at,
      external_payment_id,
      gateway_environment,
      raw_response,
      courses:course_id ( title )
    `)
        .eq('id', parsed.data.checkoutSessionId)
        .maybeSingle();
    if (sessionError) {
        jsonResponse(res, 500, { error: "No foi possvel validar o pedido." });
        return;
    }
    const checkout = session as CheckoutSessionRow | null;
    if (!checkout || checkout.user_id !== userData.user.id) {
        jsonResponse(res, 404, { error: "Pedido no encontrado para est conta." });
        return;
    }
    const status = checkout.status.trim().toLowerCase();
    if (status === 'refunded' || status === 'chargeback') {
        jsonResponse(res, 409, { error: 'Este pedido ja foi estornado.' });
        return;
    }
    if (status === 'refund_pending') {
        jsonResponse(res, 200, { ok: true, alreadyPending: true });
        return;
    }
    if (status !== 'paid') {
        jsonResponse(res, 409, { error: 'Apenas pedidos pagos podem solicitar reembolso.' });
        return;
    }
    const referenceDate = checkout.released_at || checkout.created_at;
    if (!canRefundWithinWindow(referenceDate)) {
        jsonResponse(res, 409, { error: 'O prazo de 7 dias para solicitar reembolso deste pedido ja expirou.' });
        return;
    }
    if (!checkout.external_payment_id) {
        jsonResponse(res, 409, { error: "No foi possvel identificar o pagamento no gateway para estorno autom?tico." });
        return;
    }
    const asaasAccessToken = getAsaasAccessToken(checkout.gateway_environment);
    if (!asaasAccessToken) {
        jsonResponse(res, 500, { error: 'Token do gateway de pagamento ausente para processar o estorno.' });
        return;
    }
    const nowIso = new Date().toISOString();
    const requestedReason = parsed.data.reason?.trim() || '';
    const refundDescription = requestedReason.length > 0
        ? requestedReason.slice(0, 240)
        : 'Solicitacao automatica de reembolso via painel do aluno.';
    const courseRelation = Array.isArray(checkout.courses) ? checkout.courses[0] : checkout.courses;
    const courseTitle = courseRelation?.title?.trim() || 'Curso sem titulo';
    const asaasRefundResponse = await fetch(`${getAsaasBaseUrl(checkout.gateway_environment)}/v3/payments/${checkout.external_payment_id}/refund`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            access_token: asaasAccessToken,
        },
        body: JSON.stringify({
            description: refundDescription,
        }),
    });
    const asaasRefundPayload = await asaasRefundResponse.json().catch(() => null) as unknown;
    if (!asaasRefundResponse.ok) {
        jsonResponse(res, 502, {
            error: getAsaasRefundError(asaasRefundPayload) || 'Nao foi possivel processar o estorno automatico no gateway de pagamento.',
        });
        return;
    }
    const updateSessionResult = await adminClient
        .from('commerce_checkout_sessions')
        .update({
        status: 'refund_pending',
        raw_response: {
            ...(checkout.raw_response || {}),
            refundRequest: {
                requestedAt: nowIso,
                description: refundDescription,
                gatewayResponse: asaasRefundPayload || {},
                source: 'student_dashboard',
            },
        },
        updated_at: nowIso,
    })
        .eq('id', checkout.id);
    if (updateSessionResult.error) {
        jsonResponse(res, 500, { error: 'Nao foi possivel registrar a solicitacao de reembolso.' });
        return;
    }
    await adminClient.rpc('cancel_creator_commission_for_checkout', {
        _checkout_session_id: checkout.id,
        _reason: 'student_refund_requested',
    });
    if (checkout.course_id) {
        await adminClient
            .from('course_releases')
            .update({
            is_active: false,
            release_status: 'revoked',
            revoked_at: nowIso,
            revoked_reason: 'refund_requested_by_student',
        })
            .eq('course_id', checkout.course_id)
            .eq('user_id', userData.user.id)
            .eq('source_system', 'asaas')
            .eq('managed_by_integration', true);
    }
    jsonResponse(res, 200, {
        ok: true,
        status: 'refund_pending',
        message: `Estorno solicitado automaticamente para o curso ${courseTitle}.`,
        supportTicketId: null,
    });
}
