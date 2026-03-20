import { z } from 'zod'

export const createStudentFormSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
  fullName: z
    .string()
    .min(2, 'Nome deve ter ao menos 2 caracteres.')
    .max(120, 'Nome deve ter no maximo 120 caracteres.')
    .optional(),
  password: z
    .string()
    .min(10, 'Senha deve ter pelo menos 10 caracteres.')
    .max(72, 'Senha deve ter no maximo 72 caracteres.')
    .regex(/[a-z]/, 'Senha deve conter letra minuscula.')
    .regex(/[A-Z]/, 'Senha deve conter letra maiuscula.')
    .regex(/\d/, 'Senha deve conter numero.')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter simbolo.')
    .optional(),
})

export type CreateStudentInput = z.infer<typeof createStudentFormSchema>

