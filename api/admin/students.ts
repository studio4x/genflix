import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type RoleRelationRow = {
  roles: { code: string } | { code: string }[] | null
}

const providedPasswordSchema = z
  .string()
  .min(10, 'Senha deve ter pelo menos 10 caracteres.')
  .max(72, 'Senha deve ter no maximo 72 caracteres.')
  .regex(/[a-z]/, 'Senha deve conter letra minuscula.')
  .regex(/[A-Z]/, 'Senha deve conter letra maiuscula.')
  .regex(/\d/, 'Senha deve conter numero.')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter simbolo.')

const createStudentSchema = z.object({
  email: z.string().email('E-mail invalido.'),
  fullName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(120).optional(),
  password: providedPasswordSchema.optional(),
})

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0]
  }
  return null
}

function getBearerToken(authHeader: string | null) {
  if (!authHeader) {
    return null
  }
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }
  return token.trim()
}

function parseBody(rawBody: unknown) {
  if (!rawBody) {
    return null
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as Record<string, unknown>
  }

  return null
}

function hasAdminRole(relations: RoleRelationRow[]) {
  return relations.some((relation) => {
    if (!relation.roles) {
      return false
    }
    const roles = Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    return roles.some((role) => role.code === 'admin')
  })
}

function createTemporaryPassword() {
  const token = randomBytes(9).toString('base64url')
  return `Aluno#${token}9a`
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({
      error: 'Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.',
    })
    return
  }

  const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization))
  if (!bearerToken) {
    res.status(401).json({ error: 'Token de acesso ausente.' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const requesterResult = await adminClient.auth.getUser(bearerToken)
  if (requesterResult.error || !requesterResult.data.user) {
    res.status(401).json({ error: 'Token invalido ou expirado.' })
    return
  }

  const requesterId = requesterResult.data.user.id

  const requesterRolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', requesterId)

  if (requesterRolesResult.error) {
    res.status(500).json({ error: 'Nao foi possivel validar perfil do solicitante.' })
    return
  }

  const requesterRoles = (requesterRolesResult.data as RoleRelationRow[]) ?? []
  if (!hasAdminRole(requesterRoles)) {
    res.status(403).json({ error: 'Apenas administradores podem criar alunos.' })
    return
  }

  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    res.status(400).json({ error: 'Body invalido.' })
    return
  }

  const validationResult = createStudentSchema.safeParse({
    email:
      typeof parsedBody.email === 'string' ? parsedBody.email.trim().toLowerCase() : undefined,
    fullName:
      typeof parsedBody.fullName === 'string'
        ? parsedBody.fullName.trim() || undefined
        : undefined,
    password:
      typeof parsedBody.password === 'string'
        ? parsedBody.password.trim() || undefined
        : undefined,
  })

  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const payload = validationResult.data
  const generatedPassword = payload.password ? null : createTemporaryPassword()
  const passwordToUse = payload.password ?? generatedPassword

  const createdUserResult = await adminClient.auth.admin.createUser({
    email: payload.email,
    password: passwordToUse,
    email_confirm: true,
    user_metadata: payload.fullName ? { full_name: payload.fullName } : undefined,
  })

  if (createdUserResult.error || !createdUserResult.data.user) {
    res.status(400).json({
      error: createdUserResult.error?.message ?? 'Nao foi possivel criar aluno.',
    })
    return
  }

  const createdUser = createdUserResult.data.user

  const studentRoleResult = await adminClient
    .from('roles')
    .select('id')
    .eq('code', 'student')
    .maybeSingle()

  if (studentRoleResult.error || !studentRoleResult.data) {
    res.status(500).json({ error: 'Role student nao encontrada.' })
    return
  }

  const assignRoleResult = await adminClient.from('user_roles').upsert(
    {
      user_id: createdUser.id,
      role_id: studentRoleResult.data.id,
    },
    {
      onConflict: 'user_id,role_id',
      ignoreDuplicates: true,
    },
  )

  if (assignRoleResult.error) {
    res.status(500).json({ error: 'Aluno criado, mas falhou ao associar role student.' })
    return
  }

  if (payload.fullName) {
    const profileUpsertResult = await adminClient.from('profiles').upsert(
      {
        id: createdUser.id,
        email: createdUser.email ?? payload.email,
        full_name: payload.fullName,
      },
      { onConflict: 'id' },
    )

    if (profileUpsertResult.error) {
      res.status(500).json({ error: 'Aluno criado, mas falhou ao salvar nome no perfil.' })
      return
    }
  }

  res.status(201).json({
    user_id: createdUser.id,
    email: createdUser.email ?? payload.email,
    temporary_password: generatedPassword,
    message: 'Aluno criado com sucesso.',
  })
}
