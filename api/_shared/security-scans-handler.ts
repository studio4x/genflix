import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getBearerToken, getHeaderValue } from './asaas.js';

type ApiRequest = {
    method: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
    body: unknown;
};

type ApiResponse = {
    status: (statusCode: number) => ApiResponse;
    json: (payload: unknown) => void;
    setHeader: (name: string, value: string) => void;
};

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

type ScannerFinding = {
    scannerKey: string;
    title: string;
    severity: Severity;
    description: string;
    evidence: string;
    recommendation: string;
    fixAvailable: boolean;
    autoFixSupported: boolean;
    metadata: Record<string, unknown>;
};

type SecuritySettingsRow = {
    id: string;
    cron_expression: string;
    auto_fix_enabled: boolean;
    enabled: boolean;
};

type Context = {
    adminClient: SupabaseClient;
    userId: string | null;
    isCron: boolean;
};

const AUDIT_DOC_PATH = path.join(process.cwd(), 'docs', 'AUDITORIA_VULNERABILIDADES_SEGURANCA.md');
const VERCEL_CONFIG_PATH = path.join(process.cwd(), 'vercel.json');
const REQUIRED_SECURITY_HEADERS = [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
    'permissions-policy',
];

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
    res.status(statusCode);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
}

function parseBody(rawBody: unknown) {
    if (!rawBody) {
        return {};
    }
    if (typeof rawBody === 'string') {
        try {
            return JSON.parse(rawBody) as Record<string, unknown>;
        }
        catch {
            return {};
        }
    }
    return typeof rawBody === 'object' ? rawBody as Record<string, unknown> : {};
}

function getFirstQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function toRelative(filePath: string) {
    return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function sanitizeOutput(output: string) {
    return output.slice(0, 3000);
}

async function readFilesRecursively(rootDir: string, extensions: string[]) {
    const result: Array<{ filePath: string; content: string }> = [];

    async function walk(currentDir: string) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.vercel') {
                continue;
            }

            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }

            if (!extensions.some((ext) => entry.name.endsWith(ext))) {
                continue;
            }

            const content = await fs.readFile(fullPath, 'utf8');
            result.push({ filePath: fullPath, content });
        }
    }

    await walk(rootDir);
    return result;
}

function runCommand(command: string, args: string[], timeoutMs = 180000): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, args, { cwd: process.cwd(), shell: false });
        let stdout = '';
        let stderr = '';

        const timeout = setTimeout(() => {
            child.kill();
        }, timeoutMs);

        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });

        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });

        child.on('close', (code) => {
            clearTimeout(timeout);
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });
}

async function assertAdmin(req: ApiRequest, res: ApiResponse): Promise<Context | null> {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const task = getFirstQueryValue(req.query.task);
    const receivedCronSecret = getHeaderValue(req.headers['x-cron-secret']);
    const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization) || getHeaderValue(req.headers.Authorization));
    const cronSecret = process.env.CRON_SECRET;

    if (!supabaseUrl || !serviceRoleKey) {
        jsonResponse(res, 500, { error: 'Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.' });
        return null;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    if (task === 'run_scheduled_security_scan' && cronSecret && receivedCronSecret === cronSecret) {
        return { adminClient, userId: null, isCron: true };
    }

    if (!bearerToken) {
        jsonResponse(res, 401, { error: 'Token de acesso ausente.' });
        return null;
    }

    const userResult = await adminClient.auth.getUser(bearerToken);
    if (userResult.error || !userResult.data.user) {
        jsonResponse(res, 401, { error: 'Token invalido ou expirado.' });
        return null;
    }

    const rolesResult = await adminClient
        .from('user_roles')
        .select('roles(code)')
        .eq('user_id', userResult.data.user.id);

    if (rolesResult.error) {
        jsonResponse(res, 500, { error: 'Nao foi possivel validar as permissoes do usuario.' });
        return null;
    }

    const relations = (rolesResult.data || []) as Array<{
        roles: Array<{ code: string }> | { code: string } | null;
    }>;

    const roles: string[] = [];
    for (const relation of relations) {
        if (!relation.roles) {
            continue;
        }
        if (Array.isArray(relation.roles)) {
            for (const role of relation.roles) {
                roles.push(role.code);
            }
        }
        else {
            roles.push(relation.roles.code);
        }
    }

    if (!roles.includes('admin')) {
        jsonResponse(res, 403, { error: 'Apenas administradores podem acessar a central de seguranca.' });
        return null;
    }

    return { adminClient, userId: userResult.data.user.id, isCron: false };
}

async function scanChecklistFindings(): Promise<ScannerFinding[]> {
    try {
        const content = await fs.readFile(AUDIT_DOC_PATH, 'utf8');
        const findings: ScannerFinding[] = [];
        const regex = /^### \[(.*)\]\s+(.+)$/gm;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content))) {
            const status = match[1].trim().toUpperCase();
            const title = match[2].trim();
            if (!title || status === 'OK') {
                continue;
            }

            findings.push({
                scannerKey: `audit-checklist-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                title: `Checklist de vulnerabilidade pendente: ${title}`,
                severity: 'high',
                description: 'Existe item no checklist de auditoria que ainda nao foi marcado como resolvido.',
                evidence: `Arquivo: docs/AUDITORIA_VULNERABILIDADES_SEGURANCA.md | item: ${title} | status atual: [${status}]`,
                recommendation: 'Corrigir a vulnerabilidade correspondente e atualizar o checklist para [OK] apos validacao.',
                fixAvailable: false,
                autoFixSupported: false,
                metadata: { status, title },
            });
        }

        return findings;
    }
    catch {
        return [];
    }
}

async function scanDangerousHtml(): Promise<ScannerFinding[]> {
    const files = await readFilesRecursively(path.join(process.cwd(), 'src'), ['.tsx', '.ts']);
    const findings: ScannerFinding[] = [];

    for (const file of files) {
        if (!file.content.includes('dangerouslySetInnerHTML')) {
            continue;
        }

        const hasSanitizationHint = /sanitize|dompurify|sanitiz/i.test(file.content);
        if (hasSanitizationHint) {
            continue;
        }

        findings.push({
            scannerKey: `dangerous-html-${toRelative(file.filePath).replace(/[^a-z0-9]+/gi, '-')}`,
            title: 'Uso de dangerouslySetInnerHTML sem indicio de sanitizacao',
            severity: 'high',
            description: 'Renderizacao direta de HTML pode permitir XSS persistente ou refletido se o conteudo nao for sanitizado.',
            evidence: `Arquivo: ${toRelative(file.filePath)}`,
            recommendation: 'Aplicar sanitizacao estrita com whitelist antes de renderizar HTML dinamico.',
            fixAvailable: false,
            autoFixSupported: false,
            metadata: {},
        });
    }

    return findings;
}

async function scanCorsWildcard(): Promise<ScannerFinding[]> {
    const root = path.join(process.cwd(), 'supabase', 'functions');
    const files = await readFilesRecursively(root, ['.ts', '.js']);
    const findings: ScannerFinding[] = [];
    const wildcardOriginRegexes = [
        /['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/i,
        /set\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]\s*\)/i,
    ];

    for (const file of files) {
        if (!file.content.includes('Access-Control-Allow-Origin')) {
            continue;
        }

        const hasRealWildcard = wildcardOriginRegexes.some((regex) => regex.test(file.content));
        if (!hasRealWildcard) {
            continue;
        }

        findings.push({
            scannerKey: `cors-wildcard-${toRelative(file.filePath).replace(/[^a-z0-9]+/gi, '-')}`,
            title: 'CORS permissivo com origem coringa em Edge Function',
            severity: 'medium',
            description: 'Access-Control-Allow-Origin com * amplia a superficie de chamada cross-origin.',
            evidence: `Arquivo: ${toRelative(file.filePath)}`,
            recommendation: 'Restringir origem para APP_PUBLIC_URL e ambientes explicitamente permitidos.',
            fixAvailable: false,
            autoFixSupported: false,
            metadata: {},
        });
    }

    return findings;
}

async function scanVercelSecurityHeaders(): Promise<ScannerFinding[]> {
    try {
        const content = await fs.readFile(VERCEL_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(content) as {
            headers?: Array<{
                source: string;
                headers: Array<{
                    key: string;
                    value: string;
                }>;
            }>;
        };

        const headerKeys = new Set<string>();
        for (const rule of parsed.headers || []) {
            for (const header of rule.headers || []) {
                headerKeys.add(header.key.toLowerCase());
            }
        }

        const missing = REQUIRED_SECURITY_HEADERS.filter((header) => !headerKeys.has(header));
        if (missing.length === 0) {
            return [];
        }

        return [{
            scannerKey: 'vercel-security-headers-missing',
            title: 'Headers de hardening HTTP ausentes no vercel.json',
            severity: 'medium',
            description: 'Nao foram encontrados todos os headers de seguranca recomendados para producao.',
            evidence: `Headers ausentes: ${missing.join(', ')}`,
            recommendation: 'Adicionar os headers faltantes no vercel.json para reduzir exposicao a clickjacking, sniffing e XSS.',
            fixAvailable: true,
            autoFixSupported: true,
            metadata: { missingHeaders: missing },
        }];
    }
    catch {
        return [];
    }
}

async function scanNpmAudit(): Promise<ScannerFinding[]> {
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    try {
        const result = await runCommand(npmBin, ['audit', '--json', '--audit-level=moderate']);
        const payload = `${result.stdout}\n${result.stderr}`;
        const jsonStart = payload.indexOf('{');
        if (jsonStart < 0) {
            return [];
        }

        const parsed = JSON.parse(payload.slice(jsonStart)) as {
            metadata?: {
                vulnerabilities?: {
                    info?: number;
                    low?: number;
                    moderate?: number;
                    high?: number;
                    critical?: number;
                    total?: number;
                };
            };
        };

        const vulnerabilities = parsed.metadata?.vulnerabilities;
        const total = vulnerabilities?.total || 0;
        if (total <= 0) {
            return [];
        }

        const severity: Severity = (vulnerabilities?.critical || 0) > 0
            ? 'critical'
            : (vulnerabilities?.high || 0) > 0
                ? 'high'
                : 'medium';

        return [{
            scannerKey: 'npm-audit-vulnerabilities',
            title: 'Dependencias com vulnerabilidades conhecidas (npm audit)',
            severity,
            description: 'O npm audit detectou vulnerabilidades em dependencias do projeto.',
            evidence: `Totais: critical=${vulnerabilities?.critical || 0}, high=${vulnerabilities?.high || 0}, moderate=${vulnerabilities?.moderate || 0}, low=${vulnerabilities?.low || 0}, info=${vulnerabilities?.info || 0}`,
            recommendation: 'Executar npm audit fix e revisar o changelog das dependencias antes de publicar.',
            fixAvailable: true,
            autoFixSupported: true,
            metadata: {
                vulnerabilities: {
                    info: vulnerabilities?.info || 0,
                    low: vulnerabilities?.low || 0,
                    moderate: vulnerabilities?.moderate || 0,
                    high: vulnerabilities?.high || 0,
                    critical: vulnerabilities?.critical || 0,
                    total,
                },
            },
        }];
    }
    catch {
        return [];
    }
}

async function scanSuspiciousPatterns(): Promise<ScannerFinding[]> {
    const files = await readFilesRecursively(process.cwd(), ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']);
    const selfScannerPathSuffixes = [
        'api/_shared/security-scans-handler.ts',
        'api/_shared/security-scans-handler.js',
    ];
    const signatures = [
        /eval\s*\(\s*atob\s*\(/i,
        /fromCharCode\s*\(/i,
        /powershell\s+-enc/i,
        /coinhive|cryptonight|xmrig/i,
    ];
    const findings: ScannerFinding[] = [];

    for (const file of files) {
        const relativePath = toRelative(file.filePath);
        if (selfScannerPathSuffixes.some((suffix) => relativePath === suffix || relativePath.endsWith(`/${suffix}`))) {
            continue;
        }

        for (const signature of signatures) {
            if (signature.test(file.content)) {
                findings.push({
                    scannerKey: `suspicious-pattern-${relativePath.replace(/[^a-z0-9]+/gi, '-')}`,
                    title: 'Padrao potencialmente malicioso detectado em arquivo',
                    severity: 'high',
                    description: 'Foi detectado um padrao comum em scripts ofuscados ou maliciosos e o arquivo deve ser revisado.',
                    evidence: `Arquivo: ${relativePath} | assinatura: ${signature.source}`,
                    recommendation: 'Revisar manualmente o arquivo e remover codigo suspeito nao autorizado.',
                    fixAvailable: false,
                    autoFixSupported: false,
                    metadata: { signature: signature.source },
                });
                break;
            }
        }
    }

    return findings;
}

async function runAllScanners() {
    const results = await Promise.all([
        scanChecklistFindings(),
        scanDangerousHtml(),
        scanCorsWildcard(),
        scanVercelSecurityHeaders(),
        scanNpmAudit(),
        scanSuspiciousPatterns(),
    ]);

    return results.flat();
}

async function applyHeaderFix() {
    const content = await fs.readFile(VERCEL_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(content) as {
        headers?: Array<{
            source: string;
            headers: Array<{ key: string; value: string }>;
        }>;
    };

    const secureDefaults = [
        { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https: wss:; frame-ancestors 'none';" },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    if (!parsed.headers) {
        parsed.headers = [];
    }

    let globalRule = parsed.headers.find((rule) => rule.source === '/(.*)');
    if (!globalRule) {
        globalRule = { source: '/(.*)', headers: [] };
        parsed.headers.push(globalRule);
    }

    const existing = new Set(globalRule.headers.map((header) => header.key.toLowerCase()));
    for (const header of secureDefaults) {
        if (!existing.has(header.key.toLowerCase())) {
            globalRule.headers.push(header);
        }
    }

    await fs.writeFile(VERCEL_CONFIG_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    return 'Headers de seguranca adicionados ou normalizados em vercel.json.';
}

async function applyNpmAuditFix() {
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = await runCommand(npmBin, ['audit', 'fix', '--audit-level=moderate']);
    const details = sanitizeOutput(`${result.stdout}\n${result.stderr}`.trim());
    if (result.code !== 0) {
        throw new Error(`npm audit fix retornou codigo ${result.code}. Saida: ${details}`);
    }
    return details || 'npm audit fix executado com sucesso.';
}

async function applyFixForFinding(scannerKey: string) {
    if (scannerKey === 'vercel-security-headers-missing') {
        return applyHeaderFix();
    }
    if (scannerKey === 'npm-audit-vulnerabilities') {
        return applyNpmAuditFix();
    }
    throw new Error('Nao existe correcao automatica implementada para este tipo de achado.');
}

async function ensureSettings(adminClient: SupabaseClient) {
    const settingsResult = await adminClient
        .from('security_scan_settings')
        .select('id, cron_expression, auto_fix_enabled, enabled')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle<SecuritySettingsRow>();

    if (settingsResult.error) {
        throw settingsResult.error;
    }

    if (settingsResult.data) {
        return settingsResult.data;
    }

    const insertResult = await adminClient
        .from('security_scan_settings')
        .insert({ cron_expression: '0 */6 * * *', auto_fix_enabled: false, enabled: true })
        .select('id, cron_expression, auto_fix_enabled, enabled')
        .single<SecuritySettingsRow>();

    if (insertResult.error) {
        throw insertResult.error;
    }

    return insertResult.data;
}

async function executeScan(adminClient: SupabaseClient, userId: string | null, triggerSource: 'manual' | 'scheduled') {
    const settings = await ensureSettings(adminClient);
    const runResult = await adminClient
        .from('security_scan_runs')
        .insert({
            trigger_source: triggerSource,
            status: 'running',
            created_by: userId,
            metadata: {
                autoFixEnabled: settings.auto_fix_enabled,
            },
        })
        .select('id')
        .single<{ id: string }>();

    if (runResult.error || !runResult.data) {
        throw runResult.error || new Error('Nao foi possivel iniciar a execucao da varredura.');
    }

    const runId = runResult.data.id;

    try {
        const scannedFindings = await runAllScanners();
        const insertPayload = scannedFindings.map((finding) => ({
            run_id: runId,
            scanner_key: finding.scannerKey,
            title: finding.title,
            severity: finding.severity,
            status: 'open',
            description: finding.description,
            evidence: finding.evidence || null,
            recommendation: finding.recommendation || null,
            fix_available: finding.fixAvailable,
            auto_fix_supported: finding.autoFixSupported,
            metadata: finding.metadata || {},
        }));

        if (insertPayload.length > 0) {
            const insertFindingsResult = await adminClient.from('security_scan_findings').insert(insertPayload);
            if (insertFindingsResult.error) {
                throw insertFindingsResult.error;
            }
        }

        let autoFixed = 0;
        if (settings.auto_fix_enabled) {
            const findingsResult = await adminClient
                .from('security_scan_findings')
                .select('id, scanner_key')
                .eq('run_id', runId)
                .eq('status', 'open')
                .eq('auto_fix_supported', true);

            if (findingsResult.error) {
                throw findingsResult.error;
            }

            for (const finding of findingsResult.data || []) {
                try {
                    const details = await applyFixForFinding(finding.scanner_key);
                    await adminClient
                        .from('security_scan_findings')
                        .update({
                            status: 'fixed',
                            fixed_at: new Date().toISOString(),
                            fixed_by: userId,
                            fixed_via: 'automatic',
                        })
                        .eq('id', finding.id);

                    await adminClient.from('security_scan_fixes').insert({
                        finding_id: finding.id,
                        run_id: runId,
                        action_type: 'automatic',
                        status: 'applied',
                        details,
                        applied_by: userId,
                    });
                    autoFixed += 1;
                }
                catch (error) {
                    await adminClient.from('security_scan_fixes').insert({
                        finding_id: finding.id,
                        run_id: runId,
                        action_type: 'automatic',
                        status: 'failed',
                        details: error instanceof Error ? error.message : 'Falha desconhecida.',
                        applied_by: userId,
                    });
                }
            }
        }

        const openResult = await adminClient
            .from('security_scan_findings')
            .select('id', { count: 'exact', head: true })
            .eq('run_id', runId)
            .eq('status', 'open');

        const fixedResult = await adminClient
            .from('security_scan_findings')
            .select('id', { count: 'exact', head: true })
            .eq('run_id', runId)
            .eq('status', 'fixed');

        await adminClient
            .from('security_scan_runs')
            .update({
                status: 'completed',
                finished_at: new Date().toISOString(),
                findings_total: scannedFindings.length,
                findings_open: openResult.count || 0,
                findings_fixed: fixedResult.count || 0,
                metadata: {
                    autoFixEnabled: settings.auto_fix_enabled,
                    autoFixed,
                },
            })
            .eq('id', runId);

        return { runId, findingsTotal: scannedFindings.length, autoFixed };
    }
    catch (error) {
        await adminClient
            .from('security_scan_runs')
            .update({
                status: 'failed',
                finished_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : 'Falha ao executar varredura.',
            })
            .eq('id', runId);
        throw error;
    }
}

async function fetchDashboard(adminClient: SupabaseClient) {
    const settings = await ensureSettings(adminClient);
    const [runsResult, allFindingsResult, fixesResult] = await Promise.all([
        adminClient
            .from('security_scan_runs')
            .select('id, trigger_source, status, started_at, finished_at, findings_total, findings_open, findings_fixed, error_message, metadata')
            .order('started_at', { ascending: false })
            .limit(15),
        adminClient
            .from('security_scan_findings')
            .select('id, run_id, scanner_key, title, severity, status, description, evidence, recommendation, fix_available, auto_fix_supported, fixed_at, fixed_via, metadata, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        adminClient
            .from('security_scan_fixes')
            .select('id, finding_id, run_id, action_type, status, details, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
    ]);

    if (runsResult.error) {
        throw runsResult.error;
    }
    if (allFindingsResult.error) {
        throw allFindingsResult.error;
    }
    if (fixesResult.error) {
        throw fixesResult.error;
    }

    const latestRunId = runsResult.data?.[0]?.id || null;
    const findings = (allFindingsResult.data || []).filter((finding) => finding.run_id === latestRunId);

    return {
        settings,
        runs: runsResult.data || [],
        findings,
        fixes: fixesResult.data || [],
    };
}

export async function handleSecurityScans(req: ApiRequest, res: ApiResponse) {
    if (req.method === 'OPTIONS') {
        jsonResponse(res, 200, { ok: true });
        return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        return;
    }

    const context = await assertAdmin(req, res);
    if (!context) {
        return;
    }

    const body = parseBody(req.body);
    const action = typeof body.action === 'string' ? body.action : 'list';

    try {
        if (req.method === 'GET' || action === 'list') {
            const dashboard = await fetchDashboard(context.adminClient);
            jsonResponse(res, 200, dashboard);
            return;
        }

        if (action === 'run_scan') {
            const triggerSource: 'manual' | 'scheduled' = context.isCron ? 'scheduled' : 'manual';
            const result = await executeScan(context.adminClient, context.userId, triggerSource);
            const dashboard = await fetchDashboard(context.adminClient);
            jsonResponse(res, 200, { ...dashboard, execution: result });
            return;
        }

        if (action === 'update_settings') {
            const cronExpression = typeof body.cronExpression === 'string' && body.cronExpression.trim()
                ? body.cronExpression.trim()
                : null;
            const autoFixEnabled = Boolean(body.autoFixEnabled);
            const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;

            if (!cronExpression) {
                jsonResponse(res, 400, { error: 'Expressao cron obrigatoria.' });
                return;
            }

            const settings = await ensureSettings(context.adminClient);
            const updateResult = await context.adminClient
                .from('security_scan_settings')
                .update({
                    cron_expression: cronExpression,
                    auto_fix_enabled: autoFixEnabled,
                    enabled,
                    updated_by: context.userId,
                })
                .eq('id', settings.id);

            if (updateResult.error) {
                throw updateResult.error;
            }

            const dashboard = await fetchDashboard(context.adminClient);
            jsonResponse(res, 200, dashboard);
            return;
        }

        if (action === 'fix_finding') {
            const findingId = typeof body.findingId === 'string' ? body.findingId : null;
            if (!findingId) {
                jsonResponse(res, 400, { error: 'findingId obrigatorio.' });
                return;
            }

            const findingResult = await context.adminClient
                .from('security_scan_findings')
                .select('id, scanner_key, run_id, status, fix_available')
                .eq('id', findingId)
                .single<{
                    id: string;
                    scanner_key: string;
                    run_id: string;
                    status: 'open' | 'fixed';
                    fix_available: boolean;
                }>();

            if (findingResult.error || !findingResult.data) {
                jsonResponse(res, 404, { error: 'Achado nao encontrado.' });
                return;
            }

            if (findingResult.data.status === 'fixed') {
                const dashboard = await fetchDashboard(context.adminClient);
                jsonResponse(res, 200, dashboard);
                return;
            }

            if (!findingResult.data.fix_available) {
                jsonResponse(res, 400, { error: 'Este achado nao possui correcao automatizada no painel.' });
                return;
            }

            try {
                const details = await applyFixForFinding(findingResult.data.scanner_key);
                await context.adminClient
                    .from('security_scan_findings')
                    .update({
                        status: 'fixed',
                        fixed_at: new Date().toISOString(),
                        fixed_by: context.userId,
                        fixed_via: 'manual',
                    })
                    .eq('id', findingId);

                await context.adminClient.from('security_scan_fixes').insert({
                    finding_id: findingId,
                    run_id: findingResult.data.run_id,
                    action_type: 'manual',
                    status: 'applied',
                    details,
                    applied_by: context.userId,
                });
            }
            catch (error) {
                await context.adminClient.from('security_scan_fixes').insert({
                    finding_id: findingId,
                    run_id: findingResult.data.run_id,
                    action_type: 'manual',
                    status: 'failed',
                    details: error instanceof Error ? error.message : 'Falha desconhecida ao corrigir.',
                    applied_by: context.userId,
                });
                throw error;
            }

            const dashboard = await fetchDashboard(context.adminClient);
            jsonResponse(res, 200, dashboard);
            return;
        }

        jsonResponse(res, 400, { error: 'Acao invalida.' });
    }
    catch (error) {
        jsonResponse(res, 500, {
            error: error instanceof Error ? error.message : 'Falha ao processar a central de seguranca.',
        });
    }
}
