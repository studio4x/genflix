import { env } from '@/config/env'
import { supabase } from '@/services/supabase/client'

export interface LessonNarrationPart {
  index: number
  path: string
  url: string
}

export interface LessonNarrationPayload {
  lessonId: string
  contentHash: string
  model: string
  voice: string
  generatedNow: boolean
  parts: LessonNarrationPart[]
  expiresInSeconds: number
}

export async function prepareLessonNarration(lessonId: string) {
  let sessionResult = await supabase.auth.getSession()
  let accessToken: string | undefined = sessionResult.data.session?.access_token ?? undefined

  if (!accessToken) {
    const refreshResult = await supabase.auth.refreshSession()
    accessToken = refreshResult.data.session?.access_token ?? undefined
    sessionResult = await supabase.auth.getSession()
    accessToken = accessToken ?? sessionResult.data.session?.access_token ?? undefined
  }

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente para gerar a narracao.')
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/generate-lesson-audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      lessonId,
      access_token: accessToken,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : 'Falha ao gerar a narracao da aula.'
    throw new Error(message)
  }

  return payload as LessonNarrationPayload
}
