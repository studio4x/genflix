import { z } from 'zod'

import type { ApiRequest, ApiResponse } from '../_shared.js'
import {
  createServiceClient,
  parseBody,
  requireAuthenticatedUser,
  writeIntegrationLog,
} from '../_shared.js'

const finalizeAccessSchema = z.object({
  state: z.string().uuid('Estado de acesso invalido.'),
})

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const parsedBody = parseBody(req.body)
  const validationResult = finalizeAccessSchema.safeParse(parsedBody)
  if (!validationResult.success) {
    res.status(400).json({ error: validationResult.error.issues[0]?.message ?? 'Payload invalido.' })
    return
  }

  const adminClient = createServiceClient()

  try {
    const { user } = await requireAuthenticatedUser(adminClient, req)
    const { state } = validationResult.data

    const nonceResult = await adminClient
      .from('integration_access_nonces')
      .select('*')
      .eq('id', state)
      .maybeSingle()

    if (nonceResult.error) {
      throw nonceResult.error
    }

    if (!nonceResult.data) {
      throw new Error('Solicitacao de acesso nao encontrada.')
    }

    if (nonceResult.data.consumed_at) {
      throw new Error('Este acesso ja foi finalizado anteriormente.')
    }

    if (Date.parse(nonceResult.data.expires_at) < Date.now()) {
      throw new Error('Este acesso expirou. Gere um novo link na HomeCare Match.')
    }

    if (nonceResult.data.expected_user_id !== user.id) {
      throw new Error('O usuario autenticado nao corresponde ao acesso solicitado.')
    }

    const releaseResult = await adminClient.rpc('is_course_released', {
      _user_id: user.id,
      _course_id: nonceResult.data.expected_course_id,
    })

    if (releaseResult.error) {
      throw releaseResult.error
    }

    if (!releaseResult.data) {
      throw new Error('Seu acesso a este curso esta indisponivel no momento.')
    }

    const consumeResult = await adminClient
      .from('integration_access_nonces')
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq('id', state)

    if (consumeResult.error) {
      throw consumeResult.error
    }

    await writeIntegrationLog(adminClient, {
      source_system: nonceResult.data.source_system,
      direction: 'internal',
      event_type: 'access.finalize',
      request_id: nonceResult.data.jti,
      user_id: user.id,
      course_id: nonceResult.data.expected_course_id,
      external_user_id: nonceResult.data.external_user_id,
      external_course_id: nonceResult.data.external_course_id,
      http_status: 200,
      status: 'processed',
      payload: {
        state,
      },
      response_payload: {
        redirect_url: nonceResult.data.redirect_path,
      },
    })

    res.status(200).json({
      redirect_url: nonceResult.data.redirect_path,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao finalizar acesso.'
    res.status(400).json({ error: message })
  }
}
