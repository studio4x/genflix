import { z } from 'zod'

const youtubeRegex =
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/[^\s]+$/i

export const courseFormSchema = z.object({
  title: z.string().trim().min(3, 'Titulo deve ter ao menos 3 caracteres'),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'published', 'archived']),
  workload_minutes: z.number().int().min(0),
  thumbnail_url: z.string().optional().or(z.literal('')),
  has_linear_progression: z.boolean().default(true),
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
  lesson_type: z.enum(['video', 'text', 'hybrid']).default('video'),
  text_content: z.string().optional(),
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
