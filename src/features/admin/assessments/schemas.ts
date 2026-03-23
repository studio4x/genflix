import { z } from 'zod'

export const assessmentFormSchema = z.object({
  title: z.string().trim().min(2, 'Titulo deve ter ao menos 2 caracteres.'),
  description: z.string().trim().max(2000).optional(),
  is_required: z.boolean(),
  passing_score: z
    .number()
    .min(0, 'Nota minima deve ser maior ou igual a 0.')
    .max(100, 'Nota minima deve ser menor ou igual a 100.'),
  max_attempts: z
    .number()
    .int()
    .min(1, 'Tentativas deve ser ao menos 1.')
    .max(20, 'Tentativas deve ser no maximo 20.'),
  is_active: z.boolean(),
})

export const assessmentQuestionFormSchema = z.object({
  question_text: z
    .string()
    .trim()
    .min(2, 'Pergunta deve ter ao menos 2 caracteres.'),
  is_required: z.boolean(),
  points: z.number().min(0.01, 'Pontuacao deve ser maior que zero.'),
})

export const assessmentOptionFormSchema = z.object({
  question_id: z.string().uuid('Questao invalida.'),
  option_text: z.string().trim().min(1, 'Opcao deve ter ao menos 1 caractere.'),
  is_correct: z.boolean(),
})

export type AssessmentFormInput = z.infer<typeof assessmentFormSchema>
export type AssessmentQuestionFormInput = z.infer<
  typeof assessmentQuestionFormSchema
>
export type AssessmentOptionFormInput = z.infer<typeof assessmentOptionFormSchema>

