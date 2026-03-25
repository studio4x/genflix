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
  const result = await supabase.functions.invoke('generate-lesson-audio', {
    body: {
      lessonId,
    },
  })

  if (result.error) {
    throw result.error
  }

  return result.data as LessonNarrationPayload
}
