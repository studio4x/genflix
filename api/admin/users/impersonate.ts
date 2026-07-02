import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPublicAppUrl } from '../../_shared/app-url.js';

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

type RecoveryLinkData = {
  properties?: {
    action_link?: string;
  } | null;
};

const schema = z.object({
  userId: z.string().uuid('Usuário inválido.'),
});

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

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
}

async function createAdminClient(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.' });
    return null;
  }
  const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization));
  if (!bearerToken) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' });
    return null;
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const requesterResult = await adminClient.auth.getUser(bearerToken);
  if (requesterResult.error || !requesterResult.data.user) {
    jsonResponse(res, 401, { error: 'Token inválido ou expirado.' });
    return null;
  }
  const requesterRolesResult = await adminClient.from('user_roles').select('roles(code)').eq('user_id', requesterResult.data.user.id);
  if (requesterRolesResult.error) {
    jsonResponse(res, 500, { error: 'Não foi possível validar o perfil do solicitante.' });
    return null;
  }
  const requesterRoles = ((requesterRolesResult.data as Array<{
    roles: { code: string } | { code: string }[] | null;
  }> | null) ?? [])
    .flatMap((relation) => {
      if (!relation.roles) {
        return [];
      }
      return Array.isArray(relation.roles) ? relation.roles : [relation.roles];
    })
    .map((role) => role.code);
  if (!requesterRoles.includes('admin')) {
    jsonResponse(res, 403, { error: 'Apenas administradores podem acessar esta ação.' });
    return null;
  }
  return {
    adminClient,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const context = await createAdminClient(req, res);
  if (!context) {
    return;
  }

  const parsedBody = parseBody(req.body);
  if (!parsedBody) {
    jsonResponse(res, 400, { error: 'Body inválido.' });
    return;
  }

  const validationResult = schema.safeParse({
    userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
  });
  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { userId } = validationResult.data;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuração ausente.' });
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const userResult = await adminClient.auth.admin.getUserById(userId);
  if (userResult.error || !userResult.data.user?.email) {
    jsonResponse(res, 404, { error: 'Usuário não encontrado ou sem e-mail cadastrado.' });
    return;
  }

  const linkResult = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: userResult.data.user.email,
    options: {
      redirectTo: `${getPublicAppUrl()}/auth/callback?next=/aluno`,
    },
  });
  if (linkResult.error) {
    jsonResponse(res, 400, { error: linkResult.error.message ?? 'Não foi possível gerar o link de acesso.' });
    return;
  }

  const linkData = linkResult.data as RecoveryLinkData;
  const actionLink = linkData.properties?.action_link;
  if (!actionLink) {
    jsonResponse(res, 500, { error: 'O Supabase não retornou um link válido.' });
    return;
  }

  jsonResponse(res, 200, {
    user_id: userId,
    email: userResult.data.user.email,
    action_link: actionLink,
    message: 'Link de acesso gerado com sucesso.',
  });
}
