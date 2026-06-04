import { supabase } from '@/services/supabase/client';
export type AiCredentialLocation = 'supabase' | 'vercel' | 'unavailable';
export interface AiCredentialsCheck {
    key: string;
    label: string;
    status: 'ok' | 'warning' | 'error';
    detail: string;
}
export interface AiCredentialsDiagnostics {
    location: AiCredentialLocation;
    checkedAt: string;
    hasOpenAiKey: boolean;
    hasGeminiKey: boolean;
    openAiKeyValid: boolean;
    geminiKeyValid: boolean;
    openAiApiKey?: string | null;
    geminiApiKey?: string | null;
    checks: AiCredentialsCheck[];
}
const AI_CREDENTIALS_SCOPE = 'platform-ai';
export async function fetchAiCredentialsDiagnostics() {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente para gerenciar credenciais.");
    }
    const response = await fetch(`/api/admin/payments/diagnostics?scope=${AI_CREDENTIALS_SCOPE}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const payload = await response.json().catch(() => null) as AiCredentialsDiagnostics & {
        error?: string;
    } | null;
    if (!response.ok || !payload) {
        throw new Error(payload?.error ?? 'Não foi possível carregar o diagnóstico de credenciais de IA.');
    }
    return payload as AiCredentialsDiagnostics;
}
export async function saveAiCredentials(input: {
    openAiApiKey?: string;
    geminiApiKey?: string;
    targetLocation?: Exclude<AiCredentialLocation, 'unavailable'>;
}) {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente para salvar credenciais.');
    }
    const response = await fetch(`/api/admin/payments/diagnostics?scope=${AI_CREDENTIALS_SCOPE}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null) as {
        error?: string;
        diagnostics?: AiCredentialsDiagnostics;
    } | null;
    if (!response.ok || !payload) {
        throw new Error(payload?.error ?? 'Não foi possível salvar as credenciais de IA.');
    }
    return payload;
}
