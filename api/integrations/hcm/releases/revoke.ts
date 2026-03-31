import { z } from 'zod'

import type { ApiRequest, ApiResponse } from '../_shared.js'
import {
  createServiceClient,
  parseBody,
  resolveCourseByExternalId,
  verifySignedIntegrationRequest,
  writeIntegrationLog,
} from '../_shared.js'

const revokeReleaseSchema = z.object({
  request_id: z.string().min(6).optional(),
  source_system: z.literal('homecare_match').default('homecare_match'),
  external_reference_id: z.string().trim().optional().nullable(),
  user: z.object({
    external_user_id: z.string().trim().min(1),
  }),
  course: z.object({
    external_course_id: z.string().trim().min(1),
  }),
  reason: z.string().trim().min(2).default('revoked_by_hcm'),
})

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const parsedBody = parseBody(req.body)
  if (!parsedBody) {
    res.status(400).json({ error: 'Body invalido.' })
    return
  }

  const adminClient = createServiceClient()
  let requestId = ''

  try {
    const signatureContext = verifySignedIntegrationRequest(req, parsedBody)
    requestId = signatureContext.requestId

    const validationResult = revokeReleaseSchema.safeParse(parsedBody)
    if (!validationResult.success) {
      const message = validationResult.error.issues[0]?.message ?? 'Payload invalido.'
      await writeIntegrationLog(adminClient, {
        source_system: 'homecare_match',
        direction: 'inbound',
        event_type: 'release.revoke',
        request_id: requestId,
        external_user_id: typeof parsedBody.user === 'object' && parsedBody.user && 'external_user_id' in parsedBody.user ? String(parsedBody.user.external_user_id) : null,
        external_course_id: typeof parsedBody.course === 'object' && parsedBody.course && 'external_course_id' in parsedBody.course ? String(parsedBody.course.external_course_id) : null,
        http_status: 400,
        status: 'failed',
        payload: parsedBody,
        error_message: message,
      })
      res.status(400).json({ error: message })
      return
    }

    const payload = validationResult.data
    const externalUserResult = await adminClient
      .from('external_user_identities')
      .select('user_id')
      .eq('source_system', payload.source_system)
      .eq('external_user_id', payload.user.external_user_id)
      .maybeSingle()

    if (externalUserResult.error) {
      throw externalUserResult.error
    }

    if (!externalUserResult.data?.user_id) {
      const responsePayload = {
        message: 'Nenhum usuario vinculado encontrado para revogacao.',
        request_id: requestId,
        release_status: 'ignored',
      }

      await writeIntegrationLog(adminClient, {
        source_system: payload.source_system,
        direction: 'inbound',
        event_type: 'release.revoke',
        request_id: requestId,
        external_user_id: payload.user.external_user_id,
        external_course_id: payload.course.external_course_id,
        http_status: 200,
        status: 'ignored',
        payload,
        response_payload: responsePayload,
      })

      res.status(200).json(responsePayload)
      return
    }

    const course = await resolveCourseByExternalId(adminClient, {
      sourceSystem: payload.source_system,
      externalCourseId: payload.course.external_course_id,
    })

    const updateResult = await adminClient
      .from('course_releases')
      .update({
        is_active: false,
        release_status: 'revoked',
        managed_by_integration: true,
        source_system: payload.source_system,
        revoked_at: new Date().toISOString(),
        revoked_reason: payload.reason,
        external_reference_id: payload.external_reference_id ?? null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('course_id', course.courseId)
      .eq('user_id', externalUserResult.data.user_id)
      .eq('release_type', 'user')
      .select('id')

    if (updateResult.error) {
      throw updateResult.error
    }

    const responsePayload = {
      message: 'Liberacao revogada com sucesso.',
      request_id: requestId,
      user_id: externalUserResult.data.user_id,
      course_id: course.courseId,
      affected_releases: updateResult.data?.length ?? 0,
      release_status: 'revoked',
    }

    await writeIntegrationLog(adminClient, {
      source_system: payload.source_system,
      direction: 'inbound',
      event_type: 'release.revoke',
      request_id: requestId,
      user_id: externalUserResult.data.user_id,
      course_id: course.courseId,
      external_user_id: payload.user.external_user_id,
      external_course_id: payload.course.external_course_id,
      http_status: 200,
      status: 'processed',
      payload,
      response_payload: responsePayload,
    })

    res.status(200).json(responsePayload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao revogar liberacao.'
    await writeIntegrationLog(adminClient, {
      source_system: 'homecare_match',
      direction: 'inbound',
      event_type: 'release.revoke',
      request_id: requestId || null,
      http_status: 400,
      status: 'failed',
      payload: parsedBody,
      error_message: message,
    })
    res.status(400).json({ error: message })
  }
}
