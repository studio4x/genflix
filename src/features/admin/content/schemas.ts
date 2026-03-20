import { z } from 'zod'

const youtubeRegex =
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/[^\s]+$/i

export const courseFormSchema = z.object({
  title: z.string().trim().min(3, 'Titulo deve ter ao menos 3 caracteres'),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'published', 'archived']),
  workload_hours: z.number().int().min(0),
})

export const moduleFormSchema = z.object({
  title: z.string().trim().min(2, 'Titulo deve ter ao menos 2 caracteres'),
  description: z.string().trim().max(2000).optional(),
  is_required: z.boolean(),
})

export const lessonFormSchema = z.object({
  title: z.string().trim().min(2, 'Titulo deve ter ao menos 2 caracteres'),
  description: z.string().trim().max(2000).optional(),
  is_required: z.boolean(),
  youtube_url: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || youtubeRegex.test(value), {
      message: 'URL do YouTube invalida',
    }),
  estimated_minutes: z.number().int().min(0),
})

export type CourseFormInput = z.infer<typeof courseFormSchema>
export type ModuleFormInput = z.infer<typeof moduleFormSchema>
export type LessonFormInput = z.infer<typeof lessonFormSchema>
