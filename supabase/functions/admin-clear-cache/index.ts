import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts'

Deno.serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request)

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request.headers.get('origin'))) {
      return new Response('origin n?o permitida', { status: 403, headers: corsHeaders })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo n?o permitido.' }, 405)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const accessToken = getAccessToken(request, body)
    if (!accessToken) {
      return jsonResponse(request, { error: 'Token de acesso ausente.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(request, { error: 'Configura??o ausente do Supabase.' }, 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return jsonResponse(request, { error: 'Token invalido ou expirado.' }, 401)
    }

    const roleCheck = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role_code: 'admin',
    })
    if (roleCheck.error) {
      return jsonResponse(request, { error: 'Falha ao validar perfil de administrador.' }, 500)
    }
    if (!roleCheck.data) {
      return jsonResponse(request, { error: 'Apenas administradores podem limpar o cache do servidor.' }, 403)
    }

    const invalidateResult = await supabaseAdmin.rpc('admin_clear_server_cache')
    if (invalidateResult.error) {
      return jsonResponse(request, { error: 'Falha ao invalidar cache no servidor.' }, 500)
    }

    return jsonResponse(request, {
      ok: true,
      refreshed_at: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao limpar cache.'
    return jsonResponse(request, { error: message }, 500)
  }
})

function getAccessToken(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get('Authorization')
  const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const accessTokenFromBody = typeof body?.access_token === 'string' ? body.access_token.trim() : ''
  return accessTokenFromBody || accessTokenFromHeader
}

function jsonResponse(request: Request, payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(request),
      'Content-Type': 'application/json',
    },
  })
}
