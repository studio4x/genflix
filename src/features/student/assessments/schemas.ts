import { z } from 'zod'

export const assessmentAnswerSchema = z.object({
  question_id: z.string().uuid('Questao invalida.'),
  option_id: z.string().uuid('Opcao invalida.'),
})

export const submitAssessmentAttemptSchema = z.object({
  assessment_id: z.string().uuid('Avaliacao invalida.'),
  answers: z.array(assessmentAnswerSchema),
})

export type AssessmentAnswerInput = z.infer<typeof assessmentAnswerSchema>
export type SubmitAssessmentAttemptInput = z.infer<
  typeof submitAssessmentAttemptSchema
>

