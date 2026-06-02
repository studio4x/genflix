import { supabase } from '@/services/supabase/client';
type SecuritySettings = {
    id: string;
    cron_expression: string;
    auto_fix_enabled: boolean;
    enabled: boolean;
};
type SecurityRun = {
    id: string;
    trigger_source: 'manual' | 'scheduled';
    status: 'running' | 'completed' | 'failed';
    started_at: string;
    finished_at: string | null;
    findings_total: number;
    findings_open: number;
    findings_fixed: number;
    error_message: string | null;
    metadata: Record<string, unknown>;
};
type SecurityFinding = {
    id: string;
    run_id: string;
    scanner_key: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    status: 'open' | 'fixed';
    description: string;
    evidence: string | null;
    recommendation: string | null;
    fix_available: boolean;
    auto_fix_supported: boolean;
    fixed_at: string | null;
    fixed_via: 'manual' | 'automatic' | null;
    metadata: Record<string, unknown>;
    created_at: string;
};
type SecurityFix = {
    id: string;
    finding_id: string;
    run_id: string | null;
    action_type: 'manual' | 'automatic';
    status: 'applied' | 'failed';
    details: string | null;
    created_at: string;
};
export type SecurityScanDashboard = {
    settings: SecuritySettings;
    runs: SecurityRun[];
    findings: SecurityFinding[];
    fixes: SecurityFix[];
    execution?: {
        runId: string;
        findingsTotal: number;
        autoFixed: number;
    };
};
async function getAuthToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}
async function requestSecurityApi<T>(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const token = await getAuthToken();
    const response = await fetch("/api/admin/notificationstask=security_scans", {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : "Falha na central de seguran?a.");
    }
    return payload as T;
}
export async function fetchSecurityDashboard() {
    return requestSecurityApi<SecurityScanDashboard>('GET');
}
export async function runSecurityScan() {
    return requestSecurityApi<SecurityScanDashboard>('POST', { action: 'run_scan' });
}
export async function updateSecuritySettings(input: {
    cronExpression: string;
    autoFixEnabled: boolean;
    enabled: boolean;
}) {
    return requestSecurityApi<SecurityScanDashboard>('POST', {
        action: 'update_settings',
        cronExpression: input.cronExpression,
        autoFixEnabled: input.autoFixEnabled,
        enabled: input.enabled,
    });
}
export async function fixSecurityFinding(findingId: string) {
    return requestSecurityApi<SecurityScanDashboard>('POST', {
        action: 'fix_finding',
        findingId,
    });
}
