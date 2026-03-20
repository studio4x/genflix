import { z } from 'zod'

export const lessonCompletionInputSchema = z.object({
  user_id: z.string().uuid('Usuario invalido.'),
  lesson_id: z.string().uuid('Aula invalida.'),
  is_completed: z.boolean(),
})

export type LessonCompletionInput = z.infer<typeof lessonCompletionInputSchema>

