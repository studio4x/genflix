import { z } from 'zod'

import type { ApiRequest, ApiResponse } from '../_shared.js'
import {
  parseBody,
  buildAppBaseUrl,
  createServiceClient,
  resolveCourseByExternalId,
  verifyExternalAccessToken,
  writeIntegrationLog,
} from '../_shared.js'

const resolveAccessSchema = z.object({
  token: z.string().min(20, 'Token obrigatorio.'),
  access_token: z.string().min(20).optional().nullable(),
})

function buildRedirectPath(courseId: string, rawRedirectPath?: string | null) {
  const fallback = `/aluno/cursos/${courseId}`
  if (!rawRedirectPath) {
    return fallback
  }

  if (rawRedirectPath === fallback || rawRedirectPath.startsWith(`${fallback}/`)) {
    return rawRedirectPath
  }

  return fallback
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const parsedBody = parseBody(req.body)
  const validationResult = resolveAccessSchema.safeParse(parsedBody)
  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.issues[0]?.message ?? 'Payload invalido.' })
    return
  }

  const adminClient = createServiceClient()

  try {
    const input = validationResult.data
    const claims = verifyExternalAccessToken(input.token)
    const course = await resolveCourseByExternalId(adminClient, {
      sourceSystem: claims.source_system,
      externalCourseId: claims.external_course_id,
    })

    const identityResult = await adminClient
      .from('external_user_identities')
      .select('user_id, external_email')
      .eq('source_system', claims.source_system)
      .eq('external_user_id', claims.external_user_id)
      .maybeSingle()

    if (identityResult.error) {
      throw identityResult.error
    }

    if (!identityResult.data?.user_id) {
      throw new Error('Usuario externo ainda nao sincronizado no LMS.')
    }

    const userId = identityResult.data.user_id as string
    const userEmail = identityResult.data.external_email || claims.email
    if (!userEmail) {
      throw new Error('Usuario externo sem e-mail vinculado no LMS.')
    }

    const releaseResult = await adminClient.rpc('is_course_released', {
      _user_id: userId,
      _course_id: course.courseId,
    })

    if (releaseResult.error) {
      throw releaseResult.error
    }

    if (!releaseResult.data) {
      await writeIntegrationLog(adminClient, {
        source_system: claims.source_system,
        direction: 'internal',
        event_type: 'access.resolve',
        request_id: claims.jti,
        user_id: userId,
        course_id: course.courseId,
        external_user_id: claims.external_user_id,
        external_course_id: claims.external_course_id,
        http_status: 403,
        status: 'ignored',
        payload: claims,
        error_message: 'Acesso ao curso indisponivel ou revogado.',
      })
      res.status(403).json({ error: 'Seu acesso a este curso esta indisponivel no momento.' })
      return
    }

    if (input.access_token) {
      const userResult = await adminClient.auth.getUser(input.access_token)
      if (!userResult.error && userResult.data.user?.id === userId) {
        const directRedirect = buildRedirectPath(course.courseId, claims.redirect_path)

        await writeIntegrationLog(adminClient, {
          source_system: claims.source_system,
          direction: 'internal',
          event_type: 'access.resolve',
          request_id: claims.jti,
          user_id: userId,
          course_id: course.courseId,
          external_user_id: claims.external_user_id,
          external_course_id: claims.external_course_id,
          http_status: 200,
          status: 'processed',
          payload: claims,
          response_payload: {
            mode: 'direct',
            redirect_url: directRedirect,
          },
        })

        res.status(200).json({
          mode: 'direct',
          redirect_url: directRedirect,
        })
        return
      }
    }

    const existingNonceResult = await adminClient
      .from('integration_access_nonces')
      .select('id, expires_at, consumed_at, redirect_path')
      .eq('source_system', claims.source_system)
      .eq('jti', claims.jti)
      .maybeSingle()

    if (existingNonceResult.error) {
      throw existingNonceResult.error
    }

    let nonceId = existingNonceResult.data?.id as string | undefined
    const redirectPath = buildRedirectPath(course.courseId, claims.redirect_path)

    if (existingNonceResult.data?.consumed_at) {
      throw new Error('Este link de acesso ja foi utilizado.')
    }

    if (
      existingNonceResult.data?.expires_at
      && Date.parse(existingNonceResult.data.expires_at) < Date.now()
    ) {
      throw new Error('Este link de acesso expirou. Gere um novo acesso na HomeCare Match.')
    }

    if (!nonceId) {
      const nonceInsertResult = await adminClient
        .from('integration_access_nonces')
        .insert({
          source_system: claims.source_system,
          jti: claims.jti,
          external_user_id: claims.external_user_id,
          external_course_id: claims.external_course_id,
          expected_user_id: userId,
          expected_course_id: course.courseId,
          redirect_path: redirectPath,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()

      if (nonceInsertResult.error || !nonceInsertResult.data?.id) {
        throw new Error(nonceInsertResult.error?.message ?? 'Falha ao preparar acesso ao curso.')
      }

      nonceId = nonceInsertResult.data.id as string
    }

    const appBaseUrl = buildAppBaseUrl(req)
    const redirectTo = `${appBaseUrl}/auth/hcm-access?phase=complete&state=${nonceId}`
    const generatedLinkResult = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo,
      },
    })

    const actionLink = generatedLinkResult.data?.properties?.action_link
    if (generatedLinkResult.error || !actionLink) {
      throw new Error(generatedLinkResult.error?.message ?? 'Falha ao criar acesso autenticado ao LMS.')
    }

    await writeIntegrationLog(adminClient, {
      source_system: claims.source_system,
      direction: 'internal',
      event_type: 'access.resolve',
      request_id: claims.jti,
      user_id: userId,
      course_id: course.courseId,
      external_user_id: claims.external_user_id,
      external_course_id: claims.external_course_id,
      http_status: 200,
      status: 'processed',
      payload: claims,
      response_payload: {
        mode: 'magic_link',
        redirect_url: actionLink,
      },
    })

    res.status(200).json({
      mode: 'magic_link',
      redirect_url: actionLink,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao resolver acesso ao curso.'
    res.status(400).json({ error: message })
  }
}
