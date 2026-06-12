import { createClient } from '@supabase/supabase-js';

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

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  cpf: string | null;
  whatsapp_number: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  postal_code: string | null;
  state: string | null;
  province: string | null;
  city: string | null;
  timezone: string;
  locale: string;
};

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
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

function getBearerToken(authHeader: string | null) {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

function parseBody(rawBody: unknown) {
  if (!rawBody) {
    return null;
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as Record<string, unknown>;
  }

  return null;
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuracao do Supabase ausente.');
  }

  return { supabaseUrl, serviceRoleKey };
}

function normalizeNullableString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCpfDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function isValidCpf(value: string) {
  const digits = normalizeCpfDigits(value);

  if (digits.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateCheckDigit = (input: string, factor: number) => {
    let sum = 0;

    for (let index = 0; index < input.length; index += 1) {
      sum += Number(input[index]) * (factor - index);
    }

    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(`${digits.slice(0, 9)}${firstCheckDigit}`, 11);

  return firstCheckDigit === Number(digits[9]) && secondCheckDigit === Number(digits[10]);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'PATCH') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  const parsedBody = parseBody(req.body);
  const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization));

  if (!bearerToken) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' });
    return;
  }

  const cpfFromRequest = normalizeNullableString(parsedBody?.cpf);
  if (typeof cpfFromRequest === 'string' && !isValidCpf(cpfFromRequest)) {
    jsonResponse(res, 400, { error: 'CPF inválido.' });
    return;
  }

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authUserResult = await adminClient.auth.getUser(bearerToken);
    if (authUserResult.error || !authUserResult.data.user) {
      jsonResponse(res, 401, { error: 'Token inválido ou expirado.' });
      return;
    }

    const updatePayload = {
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'full_name')
        ? { full_name: normalizeNullableString(parsedBody?.full_name) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'avatar_url')
        ? { avatar_url: normalizeNullableString(parsedBody?.avatar_url) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'cpf')
        ? { cpf: cpfFromRequest }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'address')
        ? { address: normalizeNullableString(parsedBody?.address) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'address_number')
        ? { address_number: normalizeNullableString(parsedBody?.address_number) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'address_complement')
        ? { address_complement: normalizeNullableString(parsedBody?.address_complement) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'postal_code')
        ? { postal_code: normalizeNullableString(parsedBody?.postal_code) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'state')
        ? { state: normalizeNullableString(parsedBody?.state) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'province')
        ? { province: normalizeNullableString(parsedBody?.province) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'city')
        ? { city: normalizeNullableString(parsedBody?.city) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'timezone')
        ? { timezone: normalizeNullableString(parsedBody?.timezone) ?? 'America/Sao_Paulo' }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'locale')
        ? { locale: normalizeNullableString(parsedBody?.locale) ?? 'pt-BR' }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody ?? {}, 'whatsapp_number')
        ? { whatsapp_number: normalizeNullableString(parsedBody?.whatsapp_number) }
        : {}),
    };

    if (Object.keys(updatePayload).length === 0) {
      jsonResponse(res, 400, { error: 'Nenhuma alteracao de perfil foi informada.' });
      return;
    }

    const profileResult = await adminClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', authUserResult.data.user.id)
      .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale')
      .single();

    if (profileResult.error) {
      jsonResponse(res, 500, { error: profileResult.error.message || 'Nao foi possivel atualizar o perfil.' });
      return;
    }

    jsonResponse(res, 200, { profile: profileResult.data as ProfileRow });
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Nao foi possivel atualizar o perfil.',
    });
  }
}
