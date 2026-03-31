import { z } from 'zod'

import type { ApiRequest, ApiResponse } from '../_shared.js'
import {
  createServiceClient,
  parseBody,
  resolveCourseByExternalId,
  resolveOrCreateExternalUser,
  upsertManagedCourseRelease,
  verifySignedIntegrationRequest,
  writeIntegrationLog,
} from '../_shared.js'

const upsertReleaseSchema = z.object({
  request_id: z.string().min(6).optional(),
  source_system: z.literal('homecare_match').default('homecare_match'),
  release_source: z.enum(['purchase', 'free_enrollment', 'integration']),
  external_reference_id: z.string().trim().optional().nullable(),
  user: z.object({
    external_user_id: z.string().trim().min(1),
    email: z.string().email(),
    full_name: z.string().trim().min(2).max(160).optional().nullable(),
  }),
  course: z.object({
    external_course_id: z.string().trim().min(1),
  }),
  access: z.object({
    status: z.enum(['active', 'revoked', 'expired', 'pending']).default('active'),
    starts_at: z.string().datetime().optional().nullable(),
    ends_at: z.string().datetime().optional().nullable(),
    revoked_reason: z.string().trim().optional().nullable(),
  }),
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

    const validationResult = upsertReleaseSchema.safeParse(parsedBody)
    if (!validationResult.success) {
      const message = validationResult.error.issues[0]?.message ?? 'Payload invalido.'
      await writeIntegrationLog(adminClient, {
        source_system: 'homecare_match',
        direction: 'inbound',
        event_type: 'release.upsert',
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
    const user = await resolveOrCreateExternalUser(adminClient, {
      sourceSystem: payload.source_system,
      externalUserId: payload.user.external_user_id,
      email: payload.user.email,
      fullName: payload.user.full_name ?? null,
      externalReferenceId: payload.external_reference_id ?? null,
    })

    const course = await resolveCourseByExternalId(adminClient, {
      sourceSystem: payload.source_system,
      externalCourseId: payload.course.external_course_id,
    })

    const releaseId = await upsertManagedCourseRelease(adminClient, {
      sourceSystem: payload.source_system,
      courseId: course.courseId,
      userId: user.userId,
      releaseSource: payload.release_source,
      releaseStatus: payload.access.status,
      externalReferenceId: payload.external_reference_id ?? null,
      startsAt: payload.access.starts_at ?? null,
      endsAt: payload.access.ends_at ?? null,
      revokedReason: payload.access.revoked_reason ?? null,
    })

    const responsePayload = {
      message: 'Usuario e liberacao sincronizados com sucesso.',
      request_id: requestId,
      user_id: user.userId,
      course_id: course.courseId,
      release_id: releaseId,
      created_user: user.created,
      release_status: payload.access.status,
    }

    await writeIntegrationLog(adminClient, {
      source_system: payload.source_system,
      direction: 'inbound',
      event_type: 'release.upsert',
      request_id: requestId,
      user_id: user.userId,
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
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar liberacao.'
    await writeIntegrationLog(adminClient, {
      source_system: 'homecare_match',
      direction: 'inbound',
      event_type: 'release.upsert',
      request_id: requestId || null,
      http_status: 400,
      status: 'failed',
      payload: parsedBody,
      error_message: message,
    })
    res.status(400).json({ error: message })
  }
}
