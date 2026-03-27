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

const resetCourseProgressSchema = z.object({
  courseId: z.string().uuid('Curso invalido.'),
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
    res.status(403).json({ error: 'Apenas administradores podem renovar o progresso de cursos.' })
    return null
  }

  return adminClient
}

function collectDistinctUserIds(...collections: Array<Array<{ user_id?: string | null }>>) {
  return new Set(
    collections.flatMap((collection) => collection.map((item) => item.user_id).filter((userId): userId is string => Boolean(userId))),
  )
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const adminClient = await createAdminClient(req, res)
  if (!adminClient) {
    return
  }

  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    res.status(400).json({ error: 'Body invalido.' })
    return
  }

  const validationResult = resetCourseProgressSchema.safeParse({
    courseId: typeof parsedBody.courseId === 'string' ? parsedBody.courseId.trim() : undefined,
  })

  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.issues[0]?.message ?? 'Dados invalidos.' })
    return
  }

  const { courseId } = validationResult.data

  const courseResult = await adminClient
    .from('courses')
    .select('id, title')
    .eq('id', courseId)
    .maybeSingle()

  if (courseResult.error) {
    res.status(500).json({ error: 'Nao foi possivel localizar o curso informado.' })
    return
  }

  if (!courseResult.data) {
    res.status(404).json({ error: 'Curso nao encontrado.' })
    return
  }

  const modulesResult = await adminClient
    .from('course_modules')
    .select('id')
    .eq('course_id', courseId)

  if (modulesResult.error) {
    res.status(500).json({ error: 'Nao foi possivel localizar os modulos do curso.' })
    return
  }

  const moduleIds = ((modulesResult.data as Array<{ id: string }> | null) ?? []).map((module) => module.id)

  const lessonsResult = moduleIds.length > 0
    ? await adminClient
      .from('lessons')
      .select('id')
      .in('module_id', moduleIds)
    : { data: [], error: null }

  if (lessonsResult.error) {
    res.status(500).json({ error: 'Nao foi possivel localizar as aulas do curso.' })
    return
  }

  const lessonIds = ((lessonsResult.data as Array<{ id: string }> | null) ?? []).map((lesson) => lesson.id)

  const assessmentsResult = await adminClient
    .from('assessments')
    .select('id')
    .eq('course_id', courseId)

  if (assessmentsResult.error) {
    res.status(500).json({ error: 'Nao foi possivel localizar as avaliacoes do curso.' })
    return
  }

  const assessmentIds = ((assessmentsResult.data as Array<{ id: string }> | null) ?? []).map((assessment) => assessment.id)

  const [existingCourseProgressResult, existingLessonProgressResult, existingAttemptsResult] = await Promise.all([
    adminClient
      .from('course_progress')
      .select('user_id')
      .eq('course_id', courseId),
    lessonIds.length > 0
      ? adminClient
        .from('lesson_progress')
        .select('user_id')
        .in('lesson_id', lessonIds)
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length > 0
      ? adminClient
        .from('assessment_attempts')
        .select('user_id')
        .in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (existingCourseProgressResult.error || existingLessonProgressResult.error || existingAttemptsResult.error) {
    res.status(500).json({ error: 'Nao foi possivel mapear o progresso atual do curso.' })
    return
  }

  const impactedUsers = collectDistinctUserIds(
    (existingCourseProgressResult.data as Array<{ user_id: string }> | null) ?? [],
    (existingLessonProgressResult.data as Array<{ user_id: string }> | null) ?? [],
    (existingAttemptsResult.data as Array<{ user_id: string }> | null) ?? [],
  )

  const deletedCounts = {
    course_progress: 0,
    lesson_progress: 0,
    assessment_attempts: 0,
    assessment_attempt_requests: 0,
    assessment_attempt_grants: 0,
  }

  if (assessmentIds.length > 0) {
    const deleteRequestsResult = await adminClient
      .from('assessment_attempt_requests')
      .delete()
      .in('assessment_id', assessmentIds)
      .select('id')

    if (deleteRequestsResult.error) {
      res.status(500).json({ error: 'Falha ao limpar pedidos de nova tentativa do curso.' })
      return
    }
    deletedCounts.assessment_attempt_requests = deleteRequestsResult.data?.length ?? 0

    const deleteGrantsResult = await adminClient
      .from('assessment_attempt_grants')
      .delete()
      .in('assessment_id', assessmentIds)
      .select('id')

    if (deleteGrantsResult.error) {
      res.status(500).json({ error: 'Falha ao limpar liberacoes extras de tentativas do curso.' })
      return
    }
    deletedCounts.assessment_attempt_grants = deleteGrantsResult.data?.length ?? 0

    const deleteAttemptsResult = await adminClient
      .from('assessment_attempts')
      .delete()
      .in('assessment_id', assessmentIds)
      .select('id')

    if (deleteAttemptsResult.error) {
      res.status(500).json({ error: 'Falha ao limpar tentativas de avaliacao do curso.' })
      return
    }
    deletedCounts.assessment_attempts = deleteAttemptsResult.data?.length ?? 0
  }

  if (lessonIds.length > 0) {
    const deleteLessonProgressResult = await adminClient
      .from('lesson_progress')
      .delete()
      .in('lesson_id', lessonIds)
      .select('id')

    if (deleteLessonProgressResult.error) {
      res.status(500).json({ error: 'Falha ao limpar progresso de aulas do curso.' })
      return
    }
    deletedCounts.lesson_progress = deleteLessonProgressResult.data?.length ?? 0
  }

  const deleteCourseProgressResult = await adminClient
    .from('course_progress')
    .delete()
    .eq('course_id', courseId)
    .select('id')

  if (deleteCourseProgressResult.error) {
    res.status(500).json({ error: 'Falha ao limpar o progresso geral do curso.' })
    return
  }
  deletedCounts.course_progress = deleteCourseProgressResult.data?.length ?? 0

  res.status(200).json({
    course_id: courseId,
    course_title: courseResult.data.title,
    impacted_students: impactedUsers.size,
    deleted_counts: deletedCounts,
    message: 'O progresso de todos os alunos neste curso foi renovado com sucesso.',
  })
}
