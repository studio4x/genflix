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

type StudentRoleRow = {
  user_id: string
}

type StudentProfileRow = {
  id: string
  email: string
  full_name: string | null
  timezone: string
  locale: string
  created_at: string
  updated_at: string
}

type AccessGroupMemberRow = {
  group_id: string
  user_id: string
}

type CourseReleaseRow = {
  course_id: string
  user_id: string | null
  group_id: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

type CourseProgressRow = {
  user_id: string
  course_id: string
  is_completed: boolean
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

function createSetMap(keys: string[]) {
  return new Map(keys.map((key) => [key, new Set<string>()]))
}

function createArrayMap(keys: string[]) {
  return new Map(keys.map((key) => [key, [] as string[]]))
}

function isReleaseActiveNow(release: Pick<CourseReleaseRow, 'is_active' | 'starts_at' | 'ends_at'>, nowMs: number) {
  if (!release.is_active) {
    return false
  }

  const startsAtMs = release.starts_at ? Date.parse(release.starts_at) : null
  const endsAtMs = release.ends_at ? Date.parse(release.ends_at) : null

  if (startsAtMs !== null && Number.isFinite(startsAtMs) && startsAtMs > nowMs) {
    return false
  }

  if (endsAtMs !== null && Number.isFinite(endsAtMs) && endsAtMs < nowMs) {
    return false
  }

  return true
}

async function createAdminClient(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({
      error: 'Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.',
    })
    return null
  }

  const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization))
  if (!bearerToken) {
    res.status(401).json({ error: 'Token de acesso ausente.' })
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
    res.status(401).json({ error: 'Token invalido ou expirado.' })
    return null
  }

  const requesterRolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', requesterResult.data.user.id)

  if (requesterRolesResult.error) {
    res.status(500).json({ error: 'Nao foi possivel validar perfil do solicitante.' })
    return null
  }

  const requesterRoles = (requesterRolesResult.data as RoleRelationRow[]) ?? []
  if (!hasAdminRole(requesterRoles)) {
    res.status(403).json({ error: 'Apenas administradores podem acessar alunos.' })
    return null
  }

  return adminClient
}

async function handleListStudents(req: ApiRequest, res: ApiResponse) {
  const adminClient = await createAdminClient(req, res)
  if (!adminClient) {
    return
  }

  const studentRolesResult = await adminClient
    .from('user_roles')
    .select('user_id, roles!inner(code)')
    .eq('roles.code', 'student')

  if (studentRolesResult.error) {
    res.status(500).json({ error: 'Nao foi possivel localizar os alunos cadastrados.' })
    return
  }

  const studentIds = Array.from(
    new Set(((studentRolesResult.data as StudentRoleRow[] | null) ?? []).map((item) => item.user_id)),
  )

  if (studentIds.length === 0) {
    res.status(200).json({ students: [] })
    return
  }

  const [profilesResult, groupMembersResult, directReleasesResult, courseProgressResult] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, email, full_name, timezone, locale, created_at, updated_at')
      .in('id', studentIds),
    adminClient
      .from('access_group_members')
      .select('group_id, user_id')
      .in('user_id', studentIds),
    adminClient
      .from('course_releases')
      .select('course_id, user_id, group_id, starts_at, ends_at, is_active')
      .eq('is_active', true),
    adminClient
      .from('course_progress')
      .select('user_id, course_id, is_completed')
      .in('user_id', studentIds),
  ])

  if (profilesResult.error || groupMembersResult.error || directReleasesResult.error || courseProgressResult.error) {
    res.status(500).json({ error: 'Nao foi possivel consolidar a listagem de alunos.' })
    return
  }

  const profiles = (profilesResult.data as StudentProfileRow[] | null) ?? []
  const groupMembers = (groupMembersResult.data as AccessGroupMemberRow[] | null) ?? []
  const allReleases = (directReleasesResult.data as CourseReleaseRow[] | null) ?? []
  const courseProgress = (courseProgressResult.data as CourseProgressRow[] | null) ?? []

  const groupIds = Array.from(new Set(groupMembers.map((member) => member.group_id)))
  const activeReleases = allReleases.filter((release) => isReleaseActiveNow(release, Date.now()))
  const directUserReleases = activeReleases.filter((release) => Boolean(release.user_id))
  const groupReleases = groupIds.length > 0
    ? activeReleases.filter((release) => release.group_id && groupIds.includes(release.group_id))
    : []

  const groupMembersByGroupId = createArrayMap(groupIds)
  for (const member of groupMembers) {
    const current = groupMembersByGroupId.get(member.group_id)
    if (current) {
      current.push(member.user_id)
    }
  }

  const enrolledCoursesByUser = createSetMap(studentIds)
  for (const release of directUserReleases) {
    if (!release.user_id) {
      continue
    }
    enrolledCoursesByUser.get(release.user_id)?.add(release.course_id)
  }

  for (const release of groupReleases) {
    if (!release.group_id) {
      continue
    }
    const memberUserIds = groupMembersByGroupId.get(release.group_id) ?? []
    for (const userId of memberUserIds) {
      enrolledCoursesByUser.get(userId)?.add(release.course_id)
    }
  }

  const completedCoursesByUser = createSetMap(studentIds)
  for (const progress of courseProgress) {
    if (progress.is_completed) {
      completedCoursesByUser.get(progress.user_id)?.add(progress.course_id)
    }
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const students = studentIds
    .map((studentId) => {
      const profile = profilesById.get(studentId)
      return {
        id: studentId,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        timezone: profile?.timezone ?? 'America/Sao_Paulo',
        locale: profile?.locale ?? 'pt-BR',
        created_at: profile?.created_at ?? '',
        updated_at: profile?.updated_at ?? '',
        enrolled_courses_count: enrolledCoursesByUser.get(studentId)?.size ?? 0,
        completed_courses_count: completedCoursesByUser.get(studentId)?.size ?? 0,
      }
    })
    .sort((studentA, studentB) => {
      const labelA = (studentA.full_name?.trim() || studentA.email || studentA.id).toLocaleLowerCase('pt-BR')
      const labelB = (studentB.full_name?.trim() || studentB.email || studentB.id).toLocaleLowerCase('pt-BR')
      return labelA.localeCompare(labelB, 'pt-BR')
    })

  res.status(200).json({ students })
}

async function handleCreateStudent(req: ApiRequest, res: ApiResponse) {
  const adminClient = await createAdminClient(req, res)
  if (!adminClient) {
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    await handleListStudents(req, res)
    return
  }

  if (req.method === 'POST') {
    await handleCreateStudent(req, res)
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Metodo nao permitido.' })
}
