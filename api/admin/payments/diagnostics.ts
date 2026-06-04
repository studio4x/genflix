import { createClient } from '@supabase/supabase-js';
import {
  fetchPaymentGatewayConfiguration,
  getAsaasAccessToken,
  getAsaasBaseUrl,
  getBearerToken,
  getConfiguredAsaasWebhookSecrets,
  getHeaderValue,
} from '../../_shared/asaas.js';

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

type DiagnosticStatus = 'ok' | 'warning' | 'error';

type DiagnosticCheck = {
  key: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
};

type CredentialLocation = 'supabase' | 'vercel' | 'unavailable';

type CredentialsCheck = {
  key: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
};

type CredentialsDiagnosticsResponse = {
  location: CredentialLocation;
  checkedAt: string;
  hasOpenAiKey: boolean;
  hasGeminiKey: boolean;
  openAiKeyValid: boolean;
  geminiKeyValid: boolean;
  openAiApiKey: string | null;
  geminiApiKey: string | null;
  checks: CredentialsCheck[];
};

type SessionRow = {
  id: string;
  external_payment_id: string | null;
  gateway_environment: 'sandbox' | 'production' | null;
  checkout_url: string | null;
  raw_response: Record<string, unknown> | null;
};

type NarrationCredentialsRow = {
  openai_api_key: string | null;
  gemini_api_key: string | null;
};

function isLikelyOpenAiApiKey(value: string) {
  return /^sk-(proj-|pro-)?[A-Za-z0-9_-]{12,}$/i.test(value);
}

function isLikelyGeminiApiKey(value: string) {
  return /^AIza[0-9A-Za-z_-]{20,}$/i.test(value);
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNestedString(source: Record<string, unknown> | null, path: string[]) {
  let cursor: unknown = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return readString(cursor);
}

function hasEnvironmentToken(environment: 'sandbox' | 'production') {
  if (environment === 'sandbox') {
    return Boolean(process.env.ASAAS_ACCESS_TOKEN_SANDBOX || process.env.ASAAS_ACCESS_TOKEN);
  }
  return Boolean(process.env.ASAAS_ACCESS_TOKEN_PRODUCTION || process.env.ASAAS_ACCESS_TOKEN);
}

function hasEnvironmentWebhookSecret(environment: 'sandbox' | 'production') {
  if (environment === 'sandbox') {
    return Boolean(process.env.ASAAS_WEBHOOK_SECRET_SANDBOX || process.env.ASAAS_WEBHOOK_SECRET);
  }
  return Boolean(process.env.ASAAS_WEBHOOK_SECRET_PRODUCTION || process.env.ASAAS_WEBHOOK_SECRET);
}

function getSupabaseManagementContext() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (!accessToken || !projectRef) {
    return null;
  }
  return { accessToken, projectRef };
}

function getVercelManagementContext() {
  const token = process.env.VERCEL_ACCESS_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_ORG_ID?.trim();
  if (!token || !projectId || !teamId) {
    return null;
  }
  return { token, projectId, teamId };
}

async function assertAdmin(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração ausente: Supabase URL e service role são obrigatórios.' });
    return null;
  }

  const token = getBearerToken(getHeaderValue(req.headers.authorization) || getHeaderValue(req.headers.Authorization));
  if (!token) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' });
    return null;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userResult = await adminClient.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    jsonResponse(res, 401, { error: 'Token inválido ou expirado.' });
    return null;
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id);

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'Não foi possível validar as permissões do usuário.' });
    return null;
  }

  const roles = ((rolesResult.data as Array<{
    roles: { code: string } | { code: string }[] | null;
  }> | null) || [])
    .flatMap((relation) => {
      if (!relation.roles) {
        return [];
      }
      return Array.isArray(relation.roles) ? relation.roles : [relation.roles];
    })
    .map((role) => role.code);

  if (!roles.includes('admin')) {
    jsonResponse(res, 403, { error: 'Apenas administradores podem acessar este diagnóstico.' });
    return null;
  }

  return { supabaseUrl, serviceRoleKey, adminClient, userId: userResult.data.user.id };
}

async function fetchAiCredentialsFromDatabase(adminClient: any) {
  const result = await (adminClient
    .from('narration_ai_credentials') as any)
    .select('openai_api_key, gemini_api_key')
    .eq('id', true)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = (result.data ?? null) as NarrationCredentialsRow | null;
  return {
    openAiApiKey: readOptionalString(row?.openai_api_key),
    geminiApiKey: readOptionalString(row?.gemini_api_key),
  };
}

async function buildAiCredentialsDiagnostics(context: {
  supabaseUrl: string;
  serviceRoleKey: string;
  adminClient: any;
}) : Promise<CredentialsDiagnosticsResponse> {
  const checks: CredentialsCheck[] = [];
  const supabaseContext = getSupabaseManagementContext();
  const vercelContext = getVercelManagementContext();

  const dbCredentials = await fetchAiCredentialsFromDatabase(context.adminClient).catch(() => ({
    openAiApiKey: null,
    geminiApiKey: null,
  }));

  const envOpenAiKey = readOptionalString(process.env.OPENAI_API_KEY);
  const envGeminiKey = readOptionalString(process.env.GEMINI_API_KEY);
  const dbOpenAiKeyValid = Boolean(dbCredentials.openAiApiKey && isLikelyOpenAiApiKey(dbCredentials.openAiApiKey));
  const dbGeminiKeyValid = Boolean(dbCredentials.geminiApiKey && isLikelyGeminiApiKey(dbCredentials.geminiApiKey));
  const envOpenAiKeyValid = Boolean(envOpenAiKey && isLikelyOpenAiApiKey(envOpenAiKey));
  const envGeminiKeyValid = Boolean(envGeminiKey && isLikelyGeminiApiKey(envGeminiKey));
  const hasOpenAiKey = Boolean(dbOpenAiKeyValid || envOpenAiKeyValid);
  const hasGeminiKey = Boolean(dbGeminiKeyValid || envGeminiKeyValid);

  let location: CredentialLocation = 'unavailable';
  if (dbCredentials.openAiApiKey || dbCredentials.geminiApiKey) {
    location = 'supabase';
  }
  else if (envOpenAiKey || envGeminiKey) {
    location = 'vercel';
  }
  else if (supabaseContext) {
    location = 'supabase';
  }
  else if (vercelContext) {
    location = 'vercel';
  }

  checks.push({
    key: 'ai-storage',
    label: 'Armazenamento da IA',
    status: location === 'unavailable' ? 'error' : 'ok',
    detail: location === 'supabase'
      ? 'Credenciais disponíveis no banco de dados da plataforma.'
      : location === 'vercel'
        ? 'Credenciais disponíveis no ambiente do deploy.'
      : 'Nenhuma fonte de credenciais foi encontrada.',
  });

  if (!hasOpenAiKey && !hasGeminiKey) {
    checks.push({
      key: 'ai-provider',
      label: 'Credenciais de IA',
      status: 'error',
      detail: 'Nenhuma chave encontrada. Configure ao menos uma IA para os recursos automáticos.',
    });
  }
  else if (!hasOpenAiKey || !hasGeminiKey) {
    checks.push({
      key: 'ai-provider',
      label: 'Credenciais de IA',
      status: 'warning',
      detail: 'Apenas uma IA está configurada. O fallback pode ficar indisponível.',
    });
  }
  else {
    checks.push({
      key: 'ai-provider',
      label: 'Credenciais de IA',
      status: 'ok',
      detail: 'OpenAI e Gemini estão disponíveis para os fluxos de IA da plataforma.',
    });
  }

  if (dbCredentials.openAiApiKey && !dbOpenAiKeyValid) {
    checks.push({
      key: 'openai-key-format',
      label: 'OpenAI API Key',
      status: 'error',
      detail: 'A chave salva no banco parece inválida. O formato esperado costuma começar com "sk-" ou "sk-proj-".',
    });
  }

  if (dbCredentials.geminiApiKey && !dbGeminiKeyValid) {
    checks.push({
      key: 'gemini-key-format',
      label: 'Gemini API Key',
      status: 'error',
      detail: 'A chave salva no banco parece inválida. O formato esperado costuma começar com "AIza".',
    });
  }

  if (supabaseContext) {
    checks.push({
      key: 'supabase-management',
      label: 'Gerenciamento Supabase',
      status: 'ok',
      detail: 'Access token e project ref disponíveis para sincronização de secrets.',
    });
  }
  else {
    checks.push({
      key: 'supabase-management',
      label: 'Gerenciamento Supabase',
      status: dbCredentials.openAiApiKey || dbCredentials.geminiApiKey ? 'ok' : 'warning',
      detail: dbCredentials.openAiApiKey || dbCredentials.geminiApiKey
        ? 'Gerenciamento direto opcional. As credenciais já estão persistidas no banco de dados.'
        : 'SUPABASE_ACCESS_TOKEN ou SUPABASE_PROJECT_REF ausente.',
    });
  }

  if (vercelContext) {
    checks.push({
      key: 'vercel-management',
      label: 'Gerenciamento Vercel',
      status: 'ok',
      detail: 'Variáveis de ambiente da Vercel disponíveis para leitura.',
    });
  }
  else {
    checks.push({
      key: 'vercel-management',
      label: 'Gerenciamento Vercel',
      status: envOpenAiKey || envGeminiKey || dbCredentials.openAiApiKey || dbCredentials.geminiApiKey ? 'ok' : 'warning',
      detail: envOpenAiKey || envGeminiKey || dbCredentials.openAiApiKey || dbCredentials.geminiApiKey
        ? 'Gerenciamento direto opcional. A plataforma já possui fonte válida de credenciais de IA.'
        : 'VERCEL_ACCESS_TOKEN/VERCEL_TOKEN, VERCEL_PROJECT_ID ou VERCEL_ORG_ID ausente.',
    });
  }

  return {
    location,
    checkedAt: new Date().toISOString(),
    hasOpenAiKey,
    hasGeminiKey,
    openAiKeyValid: hasOpenAiKey,
    geminiKeyValid: hasGeminiKey,
    openAiApiKey: location === 'supabase' ? dbCredentials.openAiApiKey : null,
    geminiApiKey: location === 'supabase' ? dbCredentials.geminiApiKey : null,
    checks,
  };
}

async function upsertAiCredentialsInDatabase(adminClient: any, input: {
  openAiApiKey: string | null;
  geminiApiKey: string | null;
}) {
  const current = await fetchAiCredentialsFromDatabase(adminClient).catch(() => ({
    openAiApiKey: null,
    geminiApiKey: null,
  }));

  const result = await (adminClient
    .from('narration_ai_credentials') as any)
    .upsert({
      id: true,
      openai_api_key: input.openAiApiKey ?? current.openAiApiKey,
      gemini_api_key: input.geminiApiKey ?? current.geminiApiKey,
      updated_by: null,
    }, { onConflict: 'id' })
    .select('openai_api_key, gemini_api_key')
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function handleAiCredentialsScope(req: ApiRequest, res: ApiResponse, context: NonNullable<Awaited<ReturnType<typeof assertAdmin>>>) {
  if (req.method === 'GET') {
    const diagnostics = await buildAiCredentialsDiagnostics(context);
    jsonResponse(res, 200, diagnostics);
    return;
  }

  const rawBody = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as {
    openAiApiKey?: unknown;
    geminiApiKey?: unknown;
    targetLocation?: unknown;
  };

  const openAiApiKey = readOptionalString(rawBody.openAiApiKey);
  const geminiApiKey = readOptionalString(rawBody.geminiApiKey);

  if (!openAiApiKey && !geminiApiKey) {
    jsonResponse(res, 400, { error: 'Informe ao menos uma credencial (OpenAI ou Gemini).' });
    return;
  }

  await upsertAiCredentialsInDatabase(context.adminClient, {
    openAiApiKey,
    geminiApiKey,
  });

  const diagnostics = await buildAiCredentialsDiagnostics(context);
  jsonResponse(res, 200, {
    ok: true,
    location: readOptionalString(rawBody.targetLocation) === 'vercel' ? 'vercel' : diagnostics.location,
    diagnostics,
  });
}

async function resolveInvoiceUrlFromAsaas(input: {
  paymentId: string;
  environment: 'sandbox' | 'production';
  accessToken: string;
}) {
  const response = await fetch(`${getAsaasBaseUrl(input.environment)}/v3/payments/${input.paymentId}`, {
    method: 'GET',
    headers: {
      access_token: input.accessToken,
    },
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    return null;
  }

  return (
    readString(payload.invoiceUrl) ||
    readString(payload.bankSlipUrl) ||
    readString(payload.transactionReceiptUrl) ||
    null
  );
}

async function handleResolveInvoiceUrl(req: ApiRequest, res: ApiResponse, context: NonNullable<Awaited<ReturnType<typeof assertAdmin>>>) {
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as {
    sessionId?: unknown;
  };

  const sessionId = readString(body.sessionId);
  if (!sessionId) {
    jsonResponse(res, 400, { error: 'sessionId obrigatório.' });
    return;
  }

  const sessionResult = await context.adminClient
    .from('commerce_checkout_sessions')
    .select('id, external_payment_id, gateway_environment, checkout_url, raw_response')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionResult.error) {
    jsonResponse(res, 500, { error: 'Não foi possível carregar o pedido.' });
    return;
  }

  const session = (sessionResult.data ?? null) as SessionRow | null;
  if (!session) {
    jsonResponse(res, 404, { error: 'Pedido não encontrado.' });
    return;
  }

  const paymentId = readString(session.external_payment_id);
  const environment = session.gateway_environment || (await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey)).environment || 'sandbox';
  const asaasToken = getAsaasAccessToken(environment);

  if (paymentId && asaasToken) {
    const invoiceUrl = await resolveInvoiceUrlFromAsaas({
      paymentId,
      environment,
      accessToken: asaasToken,
    });

    if (invoiceUrl) {
      jsonResponse(res, 200, { url: invoiceUrl, source: 'asaas-payment' });
      return;
    }
  }

  const rawResponse = session.raw_response || {};
  const fallbackUrl =
    readNestedString(rawResponse, ['payment', 'invoiceUrl']) ||
    readNestedString(rawResponse, ['invoiceUrl']) ||
    readNestedString(rawResponse, ['payment', 'bankSlipUrl']) ||
    readNestedString(rawResponse, ['bankSlipUrl']) ||
    readNestedString(rawResponse, ['payment', 'transactionReceiptUrl']) ||
    readNestedString(rawResponse, ['transactionReceiptUrl']) ||
    session.checkout_url;

  if (!fallbackUrl) {
    jsonResponse(res, 404, { error: 'Fatura não disponível para este pedido.' });
    return;
  }

  jsonResponse(res, 200, { url: fallbackUrl, source: 'session-fallback' });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Método não permitido.' });
    return;
  }

  const context = await assertAdmin(req, res);
  if (!context) {
    return;
  }

  const scope = getHeaderValue(req.query.scope);
  if (scope === 'narration-ai' || scope === 'platform-ai' || scope === 'ai-credentials') {
    await handleAiCredentialsScope(req, res, context);
    return;
  }

  if (req.method === 'POST') {
    await handleResolveInvoiceUrl(req, res, context);
    return;
  }

  const checks: DiagnosticCheck[] = [
    {
      key: 'supabase-service-role',
      label: 'Service role do Supabase',
      status: 'ok',
      detail: 'Variável disponível no ambiente do deploy.',
    },
  ];

  try {
    const gatewayConfig = await fetchPaymentGatewayConfiguration(context.supabaseUrl, context.serviceRoleKey);
    const activeEnvironment = gatewayConfig.environment || 'sandbox';
    const asaasToken = getAsaasAccessToken(activeEnvironment);
    const webhookSecrets = getConfiguredAsaasWebhookSecrets();

    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas' ? 'ok' : 'error',
      detail: gatewayConfig.is_active && gatewayConfig.gateway_code === 'asaas'
        ? `Asaas ativo em ${activeEnvironment}.`
        : 'Gateway inativo ou diferente de Asaas.',
    });

    checks.push({
      key: 'asaas-active-token',
      label: `Token Asaas do ambiente ativo (${activeEnvironment})`,
      status: asaasToken ? 'ok' : 'error',
      detail: asaasToken
        ? 'Token encontrado no ambiente do deploy.'
        : `Configure ASAAS_ACCESS_TOKEN_${activeEnvironment.toUpperCase()} ou ASAAS_ACCESS_TOKEN.`,
    });

    checks.push({
      key: 'asaas-sandbox-token',
      label: 'Token Asaas sandbox',
      status: hasEnvironmentToken('sandbox') ? 'ok' : activeEnvironment === 'sandbox' ? 'error' : 'warning',
      detail: hasEnvironmentToken('sandbox')
        ? 'Credencial sandbox disponível para testes controlados.'
        : 'Configure ASAAS_ACCESS_TOKEN_SANDBOX antes de validar compras e repasses em sandbox.',
    });

    checks.push({
      key: 'asaas-production-token',
      label: 'Token Asaas produção',
      status: hasEnvironmentToken('production') ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasEnvironmentToken('production')
        ? 'Credencial de produção disponível para operação real.'
        : 'Producao ainda pendente. Configure ASAAS_ACCESS_TOKEN_PRODUCTION quando a conta Asaas final estiver aprovada.',
    });

    checks.push({
      key: 'webhook-secret',
      label: 'Segredo do webhook',
      status: webhookSecrets.length > 0 ? 'ok' : 'warning',
      detail: webhookSecrets.length > 0
        ? 'Webhook com segredo configurado para pelo menos um ambiente do Asaas.'
        : 'Webhook sem segredo dedicado. Funciona, mas recomenda-se configurar ASAAS_WEBHOOK_SECRET.',
    });

    checks.push({
      key: 'webhook-secret-sandbox',
      label: 'Segredo do webhook sandbox',
      status: hasEnvironmentWebhookSecret('sandbox') ? 'ok' : activeEnvironment === 'sandbox' ? 'error' : 'warning',
      detail: hasEnvironmentWebhookSecret('sandbox')
        ? 'Segredo do webhook sandbox disponível.'
        : 'Configure ASAAS_WEBHOOK_SECRET_SANDBOX antes de validar callbacks em sandbox.',
    });

    checks.push({
      key: 'webhook-secret-production',
      label: 'Segredo do webhook produção',
      status: hasEnvironmentWebhookSecret('production') ? 'ok' : activeEnvironment === 'production' ? 'error' : 'warning',
      detail: hasEnvironmentWebhookSecret('production')
        ? 'Segredo do webhook produção disponível.'
        : 'Configure ASAAS_WEBHOOK_SECRET_PRODUCTION ou ASAAS_WEBHOOK_SECRET para callbacks de produção.',
    });

    checks.push({
      key: 'public-url',
      label: 'URL pública do app',
      status: process.env.APP_PUBLIC_URL || process.env.VERCEL_URL ? 'ok' : 'warning',
      detail: process.env.APP_PUBLIC_URL
        ? `APP_PUBLIC_URL configurada: ${process.env.APP_PUBLIC_URL}.`
        : 'APP_PUBLIC_URL não configurada. O sistema usará a origem da requisição para montar callbacks e webhook.',
    });

    jsonResponse(res, 200, {
      environment: activeEnvironment,
      checkedAt: new Date().toISOString(),
      checks,
    });
  }
  catch (error) {
    checks.push({
      key: 'gateway-settings',
      label: 'Registro do gateway',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Não foi possível carregar a configuração do gateway.',
    });

    jsonResponse(res, 200, {
      environment: null,
      checkedAt: new Date().toISOString(),
      checks,
    });
  }
}
