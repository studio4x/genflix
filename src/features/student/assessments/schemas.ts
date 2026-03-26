import { z } from 'zod'

export const assessmentAnswerSchema = z.object({
  question_id: z.string().uuid('Questao invalida.'),
  option_id: z.string().uuid('Opcao invalida.').nullable().optional(),
  answer_text: z.string().trim().max(5000, 'Resposta discursiva muito longa.').nullable().optional(),
}).superRefine((value, ctx) => {
  const hasOption = Boolean(value.option_id)
  const hasText = Boolean(value.answer_text?.trim())

  if (!hasOption && !hasText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['option_id'],
      message: 'Resposta obrigatoria.',
    })
  }
})

export const submitAssessmentAttemptSchema = z.object({
  assessment_id: z.string().uuid('Avaliacao invalida.'),
  answers: z.array(assessmentAnswerSchema),
})

export type AssessmentAnswerInput = z.infer<typeof assessmentAnswerSchema>
export type SubmitAssessmentAttemptInput = z.infer<
  typeof submitAssessmentAttemptSchema
>
