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
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente para gerar a narracao.')
  }

  const result = await supabase.functions.invoke('generate-lesson-audio', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      lessonId,
    },
  })

  if (result.error) {
    throw result.error
  }

  return result.data as LessonNarrationPayload
}
