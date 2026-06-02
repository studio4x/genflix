import { z } from 'zod';
export const lessonNoteInputSchema = z.object({
    user_id: z.string().uuid("Usurio inv?lido."),
    lesson_id: z.string().uuid('Aula invalida.'),
    note_text: z.string().trim().min(1, 'Digite alguma anotacao.').max(20000, 'A anotacao deve ter no maximo 20000 caracteres.'),
});
export const lessonNoteDeleteSchema = z.object({
    user_id: z.string().uuid("Usurio inv?lido."),
    lesson_id: z.string().uuid('Aula invalida.'),
});
export type LessonNoteInput = z.infer<typeof lessonNoteInputSchema>;
export type LessonNoteDeleteInput = z.infer<typeof lessonNoteDeleteSchema>;
