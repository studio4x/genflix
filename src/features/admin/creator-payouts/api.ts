import { supabase } from '@/services/supabase/client';
export type CreatorCommissionStatus = 'pending' | 'eligible' | 'scheduled' | 'paid' | 'canceled' | 'refunded' | 'failed';
export type CreatorPayoutStatus = 'draft' | 'scheduled' | 'processing' | 'paid' | 'failed' | 'canceled';
export type CreatorPayoutMode = 'manual' | 'automatic';
export interface AdminCreatorCommission {
    id: string;
    course_id: string;
    creator_id: string;
    checkout_session_id: string | null;
    external_payment_id: string | null;
    gross_amount_cents: number;
    commission_rate: number;
    commission_amount_cents: number;
    status: CreatorCommissionStatus;
    sale_paid_at: string;
    eligible_at: string;
    canceled_at: string | null;
    refunded_at: string | null;
    paid_at: string | null;
    notes: string | null;
    adjustment_for_commission_id?: string | null;
    adjustment_reason?: string | null;
    created_at: string;
}
export interface AdminCreatorPayout {
    id: string;
    creator_id: string;
    course_id: string | null;
    amount_cents: number;
    status: CreatorPayoutStatus;
    payout_method: 'external' | 'asaas';
    gateway_code: string | null;
    external_transfer_id: string | null;
    external_reference: string | null;
    external_status: string | null;
    pix_key_type: string | null;
    pix_key: string | null;
    payout_name: string | null;
    scheduled_for: string | null;
    paid_at: string | null;
    processing_started_at: string | null;
    failed_at: string | null;
    failure_reason: string | null;
    created_by: string | null;
    notes: string | null;
    created_at: string;
}
export interface AdminCreatorPayoutItem {
    id: string;
    payout_id: string;
    commission_id: string;
    amount_cents: number;
    created_at: string;
}
export interface AdminCreatorProfile {
    user_id: string;
    payout_name: string | null;
    document: string | null;
    pix_key_type: string | null;
    pix_key: string | null;
    default_commission_percent: number;
    payout_hold_days: number;
    is_payout_enabled: boolean;
}
export interface AdminCreatorProfileIdentity {
    id: string;
    full_name: string | null;
    email: string | null;
}
export interface AdminCreatorCourseIdentity {
    id: string;
    title: string | null;
}
export interface AdminCreatorPayoutSettings {
    id: number;
    mode: CreatorPayoutMode;
    interval_days: number;
    minimum_amount_cents: number;
    is_enabled: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}
export interface AdminCreatorPayoutDashboard {
    commissions: AdminCreatorCommission[];
    payouts: AdminCreatorPayout[];
    payoutItems: AdminCreatorPayoutItem[];
    profiles: AdminCreatorProfileIdentity[];
    creatorProfiles: AdminCreatorProfile[];
    courses: AdminCreatorCourseIdentity[];
    payoutSettings: AdminCreatorPayoutSettings;
}
async function getAccessToken() {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
        throw new Error('Sessão expirada. Entre novamente para gerenciar repasses.');
    }
    return accessToken;
}
async function postCreatorPayoutAction<TPayload>(body: Record<string, unknown>, fallbackError: string) {
    const accessToken = await getAccessToken();
    const response = await fetch('/api/admin/creator-payouts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as (TPayload & {
        error?: string;
    }) | null;
    if (!response.ok) {
        throw new Error(payload?.error ?? fallbackError);
    }
    return payload;
}
export async function fetchAdminCreatorPayoutDashboard(): Promise<AdminCreatorPayoutDashboard> {
    const accessToken = await getAccessToken();
    const response = await fetch('/api/admin/creator-payouts', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const payload = await response.json().catch(() => null) as (AdminCreatorPayoutDashboard & {
        error?: string;
    }) | null;
    if (!response.ok) {
        throw new Error(payload?.error ?? 'Não foi possível carregar repasses de criadores.');
    }
    if (!payload) {
        throw new Error('A API de repasses retornou uma resposta vazia.');
    }
    return payload;
}
export async function registerPaidCreatorPayout(input: {
    creatorId: string;
    commissionIds: string[];
    paidAt?: string;
    notes?: string;
}) {
    const payload = await postCreatorPayoutAction<{
        payoutId?: string;
    }>({
        action: 'register_external_payout',
        creatorId: input.creatorId,
        commissionIds: input.commissionIds,
        paidAt: input.paidAt,
        notes: input.notes,
    }, 'Não foi possível registrar o repasse.');
    return payload?.payoutId ?? null;
}
export async function sendPixCreatorPayout(input: {
    creatorId: string;
    commissionIds: string[];
    notes?: string;
}) {
    return postCreatorPayoutAction<{
        payoutId?: string;
        transferId?: string;
        status?: string;
        externalStatus?: string | null;
    }>({
        action: 'send_pix_payout',
        creatorId: input.creatorId,
        commissionIds: input.commissionIds,
        notes: input.notes,
    }, 'Não foi possível enviar o PIX via Asaas.');
}
export async function updateCreatorPayoutSettings(input: {
    mode: CreatorPayoutMode;
    intervalDays: number;
    minimumAmountCents: number;
    isEnabled: boolean;
    nextRunAt?: string | null;
}) {
    const payload = await postCreatorPayoutAction<{
        payoutSettings?: AdminCreatorPayoutSettings;
    }>({
        action: 'update_payout_settings',
        mode: input.mode,
        intervalDays: input.intervalDays,
        minimumAmountCents: input.minimumAmountCents,
        isEnabled: input.isEnabled,
        nextRunAt: input.nextRunAt ?? null,
    }, 'Não foi possível salvar as configurações de repasse.');
    if (!payload?.payoutSettings) {
        throw new Error('A API não retornou as configurações de repasse.');
    }
    return payload.payoutSettings;
}
export async function processDueCreatorPayouts(force = true) {
    return postCreatorPayoutAction<{
        processed?: boolean;
        payouts?: Array<{
            payoutId?: string;
            status?: string;
        }>;
        failures?: Array<{
            creatorId?: string;
            error?: string;
        }>;
        synced?: Array<{
            payoutId?: string;
            status?: string;
        }>;
        nextRunAt?: string;
        reason?: string;
    }>({
        action: 'process_due_payouts',
        force,
    }, 'Não foi possível executar o ciclo de repasses.');
}
export function formatMoneyFromCents(valueInCents: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(valueInCents / 100);
}
