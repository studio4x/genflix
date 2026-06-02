import { z } from 'zod';
export const assignableUserRoleCodes = ['aluno', 'criador', 'admin'] as const;
export const createAdminUserFormSchema = z.object({
    email: z.string().email('Informe um e-mail válido.'),
    fullName: z.string().min(2, "N?ome deve ter ao menos 2 caracteres.").max(120).optional(),
    password: z
        .string()
        .min(10, 'Senha deve ter pelo menos 10 caracteres.')
        .max(72, 'Senha deve ter no máximo 72 caracteres.')
        .regex(/[a-z]/, 'Senha deve conter letra minúscula.')
        .regex(/[A-Z]/, 'Senha deve conter letra maiúscula.')
        .regex(/\d/, 'Senha deve conter número.')
        .regex(/[^A-Za-z0-9]/, 'Senha deve conter símbolo.')
        .optional(),
    roleCode: z.enum(assignableUserRoleCodes),
});
export type CreateAdminUserFormInput = z.infer<typeof createAdminUserFormSchema>;
