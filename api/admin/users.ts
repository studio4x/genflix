import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { sendPasswordResetEmail } from '../_shared/email.js'

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

type RoleRow = {
  id: number
  code: string
  name: string
}

type RoleRelationRow = {
  user_id: string
  created_at: string
  roles: { code: string; name: string } | { code: string; name: string }[] | null
}

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
}

type RecoveryLinkData = {
  properties?: {
    action_link?: string
  } | null
}

const assignableRoleCodes = ['aluno', 'criador', 'admin'] as const
type AssignableRoleCode = (typeof assignableRoleCodes)[number]

const createUserSchema = z.object({
  email: z.string().email('E-mail invalido.'),
  fullName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(120).optional(),
  password: z
    .string()
    .min(10, 'Senha deve ter pelo menos 10 caracteres.')
    .max(72, 'Senha deve ter no maximo 72 caracteres.')
    .regex(/[a-z]/, 'Senha deve conter letra minuscula.')
    .regex(/[A-Z]/, 'Senha deve conter letra maiuscula.')
    .regex(/\d/, 'Senha deve conter numero.')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter simbolo.')
    .optional(),
  roleCode: z.enum(assignableRoleCodes),
})

const updateRoleSchema = z.object({
  userId: z.string().uuid('Usuario invalido.'),
  roleCode: z.enum(assignableRoleCodes),
})

const resetPasswordSchema = z.object({
  userId: z.string().uuid('Usuario invalido.'),
})

const deleteUserSchema = z.object({
  userId: z.string().uuid('Usuario invalido.'),
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

function createTemporaryPassword() {
  const token = randomBytes(9).toString('base64url')
  return `Genflix#${token}9a`
}

function getRequestOrigin(req: ApiRequest) {
  const origin = getHeaderValue(req.headers.origin)
  if (origin) {
    return origin
  }

  const host = getHeaderValue(req.headers['x-forwarded-host']) ?? getHeaderValue(req.headers.host)
  const protocol = getHeaderValue(req.headers['x-forwarded-proto']) ?? 'https'

  if (!host) {
    return process.env.APP_PUBLIC_URL ?? 'https://genflix-omega.vercel.app'
  }

  return `${protocol}://${host}`
}

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

async function createAdminClient(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.' })
    return null
  }

  const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!bearerToken) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const requesterResult = await adminClient.auth.getUser(bearerToken)
  if (requesterResult.error || !requesterResult.data.user) {
    jsonResponse(res, 401, { error: 'Token invalido ou expirado.' })
    return null
  }

  const requesterRolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', requesterResult.data.user.id)

  if (requesterRolesResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel validar o perfil do solicitante.' })
    return null
  }

  const requesterRoles = ((requesterRolesResult.data as Array<{ roles: { code: string } | { code: string }[] | null }> | null) ?? [])
    .flatMap((relation) => {
      if (!relation.roles) {
        return []
      }

      return Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    })
    .map((role) => role.code)

  if (!requesterRoles.includes('admin')) {
    jsonResponse(res, 403, { error: 'Apenas administradores podem acessar usuarios.' })
    return null
  }

  return {
    adminClient,
    requesterId: requesterResult.data.user.id,
  }
}

function normalizeAssignableRoleCode(roleCode: AssignableRoleCode) {
  if (roleCode === 'aluno') {
    return 'student'
  }

  return roleCode
}

function getManagedRoleCodes(roleCode: AssignableRoleCode) {
  if (roleCode === 'admin') {
    return ['admin', 'criador', 'professor']
  }

  if (roleCode === 'criador') {
    return ['admin', 'criador', 'professor']
  }

  return ['admin', 'criador', 'professor', 'student']
}

async function loadRoleRows(adminClient: SupabaseClient) {
  const result = await adminClient
    .from('roles')
    .select('id, code, name')
    .in('code', ['admin', 'student', 'criador', 'professor'])

  if (result.error) {
    throw result.error
  }

  return (result.data as RoleRow[] | null) ?? []
}

function createRoleMap(roleRows: RoleRow[]) {
  return new Map(roleRows.map((role) => [role.code, role]))
}

function sortRolesByPriority(roleA: { code: string }, roleB: { code: string }) {
  const priority = (code: string) => {
    if (code === 'admin') return 0
    if (code === 'criador' || code === 'professor') return 1
    if (code === 'student' || code === 'aluno') return 2
    return 3
  }

  return priority(roleA.code) - priority(roleB.code)
}

async function handleListUsers(req: ApiRequest, res: ApiResponse) {
  const context = await createAdminClient(req, res)
  if (!context) {
    return
  }
  const { adminClient } = context

  const [profilesResult, rolesResult] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, email, full_name, created_at, updated_at'),
    adminClient
      .from('user_roles')
      .select('user_id, created_at, roles(code, name)'),
  ])

  if (profilesResult.error || rolesResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel carregar os usuarios.' })
    return
  }

  const profiles = (profilesResult.data as ProfileRow[] | null) ?? []
  const roleRelations = (rolesResult.data as RoleRelationRow[] | null) ?? []

  const usersById = new Map(
    profiles.map((profile) => [
      profile.id,
      {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        roles: [] as Array<{ code: string; name: string; assigned_at: string | null }>,
      },
    ]),
  )

  for (const relation of roleRelations) {
    const user = usersById.get(relation.user_id)
    if (!user || !relation.roles) {
      continue
    }

    const roles = Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    for (const role of roles) {
      user.roles.push({
        code: role.code,
        name: role.name,
        assigned_at: relation.created_at ?? null,
      })
    }
  }

  const users = Array.from(usersById.values())
    .map((user) => ({
      ...user,
      roles: user.roles.sort(sortRolesByPriority),
    }))
    .sort((userA, userB) => {
      const labelA = (userA.full_name?.trim() || userA.email || userA.id).toLocaleLowerCase('pt-BR')
      const labelB = (userB.full_name?.trim() || userB.email || userB.id).toLocaleLowerCase('pt-BR')
      return labelA.localeCompare(labelB, 'pt-BR')
    })

  jsonResponse(res, 200, { users })
}

async function ensureRoleAssignment(
  adminClient: SupabaseClient,
  roleMap: Map<string, RoleRow>,
  userId: string,
  roleCode: AssignableRoleCode,
) {
  const normalizedRoleCode = normalizeAssignableRoleCode(roleCode)
  const targetRole = roleMap.get(normalizedRoleCode)

  if (!targetRole) {
    throw new Error(`Role ${normalizedRoleCode} nao encontrada.`)
  }

  const managedRoleCodes = getManagedRoleCodes(roleCode)
  const managedRoleIds = managedRoleCodes
    .map((code) => roleMap.get(code)?.id)
    .filter((roleId): roleId is number => typeof roleId === 'number')

  if (managedRoleIds.length > 0) {
    const deleteResult = await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .in('role_id', managedRoleIds)

    if (deleteResult.error) {
      throw deleteResult.error
    }
  }

  const insertResult = await adminClient.from('user_roles').upsert(
    {
      user_id: userId,
      role_id: targetRole.id,
    },
    {
      onConflict: 'user_id,role_id',
      ignoreDuplicates: true,
    },
  )

  if (insertResult.error) {
    throw insertResult.error
  }
}

async function handleCreateUser(req: ApiRequest, res: ApiResponse) {
  const context = await createAdminClient(req, res)
  if (!context) {
    return
  }
  const { adminClient } = context

  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    jsonResponse(res, 400, { error: 'Body invalido.' })
    return
  }

  const validationResult = createUserSchema.safeParse({
    email: typeof parsedBody.email === 'string' ? parsedBody.email.trim().toLowerCase() : undefined,
    fullName: typeof parsedBody.fullName === 'string' ? parsedBody.fullName.trim() || undefined : undefined,
    password: typeof parsedBody.password === 'string' ? parsedBody.password.trim() || undefined : undefined,
    roleCode: parsedBody.roleCode,
  })

  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const payload = validationResult.data
  const generatedPassword = payload.password ? null : createTemporaryPassword()
  const passwordToUse = payload.password ?? generatedPassword
  const roleRows = await loadRoleRows(adminClient)
  const roleMap = createRoleMap(roleRows)

  const createdUserResult = await adminClient.auth.admin.createUser({
    email: payload.email,
    password: passwordToUse,
    email_confirm: true,
    user_metadata: payload.fullName ? { full_name: payload.fullName } : undefined,
  })

  if (createdUserResult.error || !createdUserResult.data.user) {
    jsonResponse(res, 400, {
      error: createdUserResult.error?.message ?? 'Nao foi possivel criar o usuario.',
    })
    return
  }

  const createdUser = createdUserResult.data.user

  try {
    await ensureRoleAssignment(adminClient, roleMap, createdUser.id, payload.roleCode)
  } catch (assignmentError) {
    jsonResponse(res, 500, {
      error: assignmentError instanceof Error ? assignmentError.message : 'Nao foi possivel associar a role do usuario.',
    })
    return
  }

  const profileUpsertResult = await adminClient.from('profiles').upsert(
    {
      id: createdUser.id,
      email: createdUser.email ?? payload.email,
      full_name: payload.fullName ?? null,
    },
    { onConflict: 'id' },
  )

  if (profileUpsertResult.error) {
    jsonResponse(res, 500, { error: 'Usuario criado, mas falhou ao salvar o perfil.' })
    return
  }

  jsonResponse(res, 201, {
    user_id: createdUser.id,
    email: createdUser.email ?? payload.email,
    role_code: payload.roleCode,
    temporary_password: generatedPassword,
    message: 'Usuario criado com sucesso.',
  })
}

async function handleUpdateUserRole(req: ApiRequest, res: ApiResponse) {
  const context = await createAdminClient(req, res)
  if (!context) {
    return
  }
  const { adminClient } = context

  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    jsonResponse(res, 400, { error: 'Body invalido.' })
    return
  }

  const validationResult = updateRoleSchema.safeParse({
    userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
    roleCode: parsedBody.roleCode,
  })

  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const roleRows = await loadRoleRows(adminClient)
  const roleMap = createRoleMap(roleRows)
  const { userId, roleCode } = validationResult.data

  const userResult = await adminClient
    .from('profiles')
    .select('id, email, full_name, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (userResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel localizar o usuario.' })
    return
  }

  if (!userResult.data) {
    jsonResponse(res, 404, { error: 'Usuario nao encontrado.' })
    return
  }

  try {
    await ensureRoleAssignment(adminClient, roleMap, userId, roleCode)
  } catch (assignmentError) {
    jsonResponse(res, 500, {
      error: assignmentError instanceof Error ? assignmentError.message : 'Nao foi possivel atualizar a role do usuario.',
    })
    return
  }

  jsonResponse(res, 200, {
    user_id: userId,
    email: userResult.data.email,
    role_code: roleCode,
    message: 'Role atualizada com sucesso.',
  })
}

async function handleResetUserPassword(req: ApiRequest, res: ApiResponse) {
  const context = await createAdminClient(req, res)
  if (!context) {
    return
  }
  const { adminClient } = context

  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    jsonResponse(res, 400, { error: 'Body invalido.' })
    return
  }

  const validationResult = resetPasswordSchema.safeParse({
    userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
  })

  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const { userId } = validationResult.data

  const authUserResult = await adminClient.auth.admin.getUserById(userId)
  if (authUserResult.error || !authUserResult.data.user?.email) {
    jsonResponse(res, 404, { error: 'Usuario nao encontrado ou sem e-mail cadastrado.' })
    return
  }

  const profileResult = await adminClient
    .from('profiles')
    .select('id, email, full_name, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (profileResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel localizar o perfil do usuario.' })
    return
  }

  const email = profileResult.data?.email ?? authUserResult.data.user.email
  const linkResult = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${getRequestOrigin(req)}/redefinir-senha`,
    },
  })

  if (linkResult.error) {
    jsonResponse(res, 400, {
      error: linkResult.error.message ?? 'Nao foi possivel gerar o link de redefinicao.',
    })
    return
  }

  const linkData = linkResult.data as RecoveryLinkData
  const actionLink = linkData.properties?.action_link

  if (!actionLink) {
    jsonResponse(res, 500, { error: 'O Supabase nao retornou um link de redefinicao valido.' })
    return
  }

  const metadataFullName =
    typeof authUserResult.data.user.user_metadata?.full_name === 'string'
      ? authUserResult.data.user.user_metadata.full_name
      : null

  try {
    await sendPasswordResetEmail({
      to: email,
      fullName: profileResult.data?.full_name ?? metadataFullName,
      actionLink,
    })
  } catch (emailError) {
    jsonResponse(res, 500, {
      error: emailError instanceof Error ? emailError.message : 'Nao foi possivel enviar o e-mail de redefinicao.',
    })
    return
  }

  jsonResponse(res, 200, {
    user_id: userId,
    email,
    temporary_password: null,
    message: 'E-mail de redefinicao enviado com sucesso.',
  })
}

async function handleDeleteUser(req: ApiRequest, res: ApiResponse) {
  const context = await createAdminClient(req, res)
  if (!context) {
    return
  }

  const { adminClient, requesterId } = context
  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    jsonResponse(res, 400, { error: 'Body invalido.' })
    return
  }

  const validationResult = deleteUserSchema.safeParse({
    userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
  })

  if (!validationResult.success) {
    jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const { userId } = validationResult.data

  if (userId === requesterId) {
    jsonResponse(res, 400, { error: 'Voce nao pode excluir seu proprio usuario.' })
    return
  }

  const userResult = await adminClient
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (userResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel localizar o usuario.' })
    return
  }

  if (!userResult.data) {
    jsonResponse(res, 404, { error: 'Usuario nao encontrado.' })
    return
  }

  const userRolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userId)

  if (userRolesResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel validar as roles do usuario.' })
    return
  }

  const userRoleCodes = ((userRolesResult.data as Array<{ roles: { code: string } | { code: string }[] | null }> | null) ?? [])
    .flatMap((relation) => {
      if (!relation.roles) {
        return []
      }
      return Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    })
    .map((role) => role.code)

  if (userRoleCodes.includes('admin')) {
    const adminCountResult = await adminClient
      .from('user_roles')
      .select('user_id, roles!inner(code)', { count: 'exact', head: true })
      .eq('roles.code', 'admin')

    if (adminCountResult.error) {
      jsonResponse(res, 500, { error: 'Nao foi possivel validar os administradores restantes.' })
      return
    }

    const remainingAdmins = adminCountResult.count ?? 0
    if (remainingAdmins <= 1) {
      jsonResponse(res, 400, { error: 'Nao e possivel excluir o ultimo administrador.' })
      return
    }
  }

  const deleteAuthResult = await adminClient.auth.admin.deleteUser(userId)
  if (deleteAuthResult.error) {
    jsonResponse(res, 400, {
      error: deleteAuthResult.error.message ?? 'Nao foi possivel excluir o usuario.',
    })
    return
  }

  jsonResponse(res, 200, {
    user_id: userId,
    email: userResult.data.email,
    message: 'Usuario excluido com sucesso.',
  })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    await handleListUsers(req, res)
    return
  }

  if (req.method === 'POST') {
    await handleCreateUser(req, res)
    return
  }

  if (req.method === 'PUT') {
    await handleUpdateUserRole(req, res)
    return
  }

  if (req.method === 'PATCH') {
    await handleResetUserPassword(req, res)
    return
  }

  if (req.method === 'DELETE') {
    await handleDeleteUser(req, res)
    return
  }

  res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE')
  res.status(405).json({ error: 'Metodo nao permitido.' })
}
