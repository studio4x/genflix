import { supabase } from '@/services/supabase/client';
export type NarrationCredentialLocation = 'supabase' | 'vercel' | 'unavailable';
export interface NarrationCredentialsCheck {
    key: string;
    label: string;
    status: 'ok' | 'warning' | 'error';
    detail: string;
}
export interface NarrationCredentialsDiagnostics {
    location: NarrationCredentialLocation;
    checkedAt: string;
    hasOpenAiKey: boolean;
    hasGeminiKey: boolean;
    openAiApiKey?: string | null;
    geminiApiKey?: string | null;
    checks: NarrationCredentialsCheck[];
}
export async function fetchNarrationCredentialsDiagnostics() {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
        throw new Error("Sesso expirada. Faca login novamente para gerenciar credenciais.");
    }
    const response = await fetch("/api/admin/payments/diagnosticsscope=narration-ai", {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const payload = await response.json().catch(() => null) as NarrationCredentialsDiagnostics & {
        error?: string;
    } | null;
    if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "N?o foi possvel carregar o diagnostico de credenciais de narracao.");
    }
    return payload as NarrationCredentialsDiagnostics;
}
export async function saveNarrationCredentials(input: {
    openAiApiKey?: string;
    geminiApiKey?: string;
    targetLocation?: Exclude<NarrationCredentialLocation, 'unavailable'>;
}) {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
        throw new Error("Sesso expirada. Faca login novamente para salvar credenciais.");
    }
    const response = await fetch("/api/admin/payments/diagnosticsscope=narration-ai", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null) as {
        error?: string;
        diagnostics?: NarrationCredentialsDiagnostics;
    } | null;
    if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "N?o foi possvel salvar as credenciais de narracao.");
    }
    return payload;
}
