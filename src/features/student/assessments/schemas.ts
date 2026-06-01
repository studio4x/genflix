import { z } from 'zod'

import { assessmentInteractionResponsePayloadSchema } from '@/features/assessments/gamified'

export const assessmentAnswerSchema = z.object({
  question_id: z.string().uuid('Questao invalida.'),
  option_id: z.string().uuid('Opcao invalida.').nullable().optional(),
  answer_text: z.string().trim().max(5000, 'Resposta discursiva muito longa.').nullable().optional(),
  response_payload: assessmentInteractionResponsePayloadSchema.nullable().optional(),
}).superRefine((value, ctx) => {
  const hasOption = Boolean(value.option_id)
  const hasText = Boolean(value.answer_text?.trim())
  const hasInteractionPayload = value.response_payload
    ? ('entries' in value.response_payload
      ? value.response_payload.entries.length > 0
      : Boolean(
        value.response_payload.selected_target_id
        || value.response_payload.found_target_ids.length
        || value.response_payload.incorrect_target_ids.length
        || value.response_payload.outside_click_count > 0,
      ))
    : false

  if (!hasOption && !hasText && !hasInteractionPayload) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['option_id'],
      message: 'Resposta obrigatoria.',
    })
  }
})

export const submitAssessmentAttemptSchema = z.object({
  assessment_id: z.string().uuid('Avalia??o invalida.'),
  answers: z.array(assessmentAnswerSchema),
})

export type AssessmentAnswerInput = z.infer<typeof assessmentAnswerSchema>
export type SubmitAssessmentAttemptInput = z.infer<
  typeof submitAssessmentAttemptSchema
>
