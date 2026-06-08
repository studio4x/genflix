import { z } from 'zod';
import { DEFAULT_COURSE_QUIZ_TYPE_SETTINGS } from '@/features/assessments/course-quiz-type-settings';
const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/[^\s]+$/i;
const directVideoRegex = /^https?:\/\/[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?$/i;
const assetVideoRegex = /^asset:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const courseQuizTypeSettingsSchema = z.object({
    single_choice: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.single_choice),
    essay_ai: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.essay_ai),
    drag_drop_labeling: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.drag_drop_labeling),
    fill_in_the_blanks: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.fill_in_the_blanks),
    image_hotspot: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.image_hotspot),
    coloring: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.coloring),
    case_study: z.boolean().default(DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.case_study),
}).superRefine((value, ctx) => {
    if (!Object.values(value).some(Boolean)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Ative ao menos um tipo de quiz para este curso.',
            path: [],
        });
    }
    if (value.case_study && !value.single_choice && !value.essay_ai) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Para habilitar estudo de caso, deixe Multipla Escolha ou Discursiva com IA ativos.',
            path: ['case_study'],
        });
    }
});
export const courseFormSchema = z.object({
    title: z.string().trim().min(3, "Título deve ter ao menos 3 caracteres"),
    category: z.string().trim().optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(['draft', 'published', 'archived']),
    thumbnail_url: z.string().optional().or(z.literal('')),
    student_hero_image_url: z.string().optional().or(z.literal('')),
    slug: z.string().trim().optional().or(z.literal('')),
    launch_date: z.string().optional().or(z.literal('')),
    price_cents: z.number().int().min(0).default(0),
    currency: z.enum(['BRL']).default('BRL'),
    is_public: z.boolean().default(true),
    creator_id: z.string().uuid().optional().nullable().or(z.literal('')),
    creator_commission_percent: z.number().min(0).max(100).default(0),
    has_linear_progression: z.boolean().default(true),
    quiz_type_settings: courseQuizTypeSettingsSchema.default({ ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS }),
});
export const publicCourseOutcomeSchema = z.object({
    title: z.string().trim().min(1, "Informe o título do destaque."),
    description: z.string().trim().min(1, "Informe a descrição do destaque."),
});
export const publicCourseModuleSchema = z.object({
    title: z.string().trim().min(1, "Informe o título do módulo."),
    lessonCount: z.number().int().min(0).default(0),
    summary: z.string().trim().default(''),
    items: z.array(z.string().trim().min(1)).default([]),
    lessonLabel: z.string().trim().optional().nullable(),
});
export const coursePublicPageContentSchema = z.object({
    categoryLine: z.string().trim().optional().nullable(),
    aboutParagraphs: z.array(z.string().trim().min(1)).default([]),
    outcomes: z.array(publicCourseOutcomeSchema).default([]),
    includedItems: z.array(z.string().trim().min(1)).default([]),
    bonusSection: z.object({
        enabled: z.boolean().default(true),
        title: z.string().trim().min(1, "Informe o título da seção bônus."),
        description: z.string().trim().min(1, "Informe o texto da seção bônus."),
    }).nullable().optional(),
    contentSource: z.enum(['real', 'custom']).default('custom'),
    customSyllabus: z.array(publicCourseModuleSchema).default([]),
});
export const coursePublicPageFormSchema = z.object({
    category: z.string().trim().optional().or(z.literal('')),
    categoryLine: z.string().trim().optional().or(z.literal('')),
    marketing_description: z.string().trim().min(10, "Informe a descrição principal do curso."),
    mentor_name: z.string().trim().min(2, 'Informe o nome do mentor.'),
    mentor_role: z.string().trim().min(2, 'Informe o cargo ou funcao do mentor.'),
    mentor_bio: z.string().trim().optional().or(z.literal('')),
    bonus_enabled: z.boolean().default(true),
    bonus_title: z.string().trim().optional().or(z.literal('')),
    mentor_initials: z.string().trim().max(4).optional().or(z.literal('')),
    price_label: z.string().trim().min(1, 'Informe o preço exibido na página pública.'),
    secondary_price_label: z.string().trim().min(1, "Informe o subtítulo do checkout."),
    aboutParagraphs: z.array(z.string().trim().min(1)).min(1, 'Adicione pelo menos um paragrafo em Sobre o Curso.'),
    outcomes: z.array(publicCourseOutcomeSchema).min(1, "Adicione pelo menos um destaque em O que você vai aprender."),
    includedItems: z.array(z.string().trim().min(1)).min(1, "Adicione pelo menos um item do que está incluído."),
    contentSource: z.enum(['real', 'custom']).default('custom'),
    customSyllabus: z.array(publicCourseModuleSchema).default([]),
}).superRefine((value, ctx) => {
    if (!value.bonus_enabled) {
        return;
    }
    if (!value.bonus_title?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['bonus_title'],
            message: "Informe o título da seção bônus.",
        });
    }
    if (!value.mentor_bio?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mentor_bio'],
            message: "Informe o texto da seção bônus.",
        });
    }
});
export const moduleFormSchema = z.object({
    title: z.string().trim().min(2, "Título deve ter ao menos 2 caracteres"),
    description: z.string().trim().max(2000).optional(),
    is_required: z.boolean(),
    starts_at: z.string().optional().or(z.literal('')),
    ends_at: z.string().optional().or(z.literal('')),
    release_days_after_enrollment: z.string().optional().or(z.literal('')).refine((value) => {
        if (!value)
            return true;
        return /^\d+$/.test(value.trim());
    }, {
        message: 'Informe um numero inteiro de dias igual ou maior que zero.',
    }),
}).superRefine((value, ctx) => {
    if (value.starts_at && value.ends_at && new Date(value.ends_at) < new Date(value.starts_at)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ends_at'],
            message: "A data final do módulo deve ser posterior ao início.",
        });
    }
});
export const lessonFormSchema = z.object({
    title: z.string().trim().min(2, "Título deve ter ao menos 2 caracteres"),
    description: z.string().trim().max(2000).optional(),
    is_required: z.boolean(),
    lesson_type: z.enum(['video', 'text', 'hybrid', 'file']).default('video'),
    text_content: z.string().optional(),
    youtube_url: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || youtubeRegex.test(value) || directVideoRegex.test(value) || assetVideoRegex.test(value), {
        message: 'Fonte de video invalida',
    }),
    estimated_minutes: z.number().int().min(0),
    starts_at: z.string().optional().or(z.literal('')),
    ends_at: z.string().optional().or(z.literal('')),
}).superRefine((value, ctx) => {
    if (value.starts_at && value.ends_at && new Date(value.ends_at) < new Date(value.starts_at)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ends_at'],
            message: "A data final da aula deve ser posterior ao início.",
        });
    }
});
export const buttonTemplateFormSchema = z.object({
    name: z.string().trim().min(2, "Nome do padrão obrigatório."),
    default_label: z.string().trim().min(2, "Rótulo padrão obrigatório."),
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']),
    theme: z.enum(['blue', 'emerald', 'amber', 'rose', 'slate', 'violet']),
    icon: z.string().trim().min(2, "Ícone obrigatório."),
    is_active: z.boolean().default(true),
});
export const lessonFooterActionFormSchema = z.object({
    scope: z.enum(['lesson', 'module', 'course']).default('lesson'),
    template_id: z.string().uuid().nullable().optional(),
    action_type: z.enum(['file', 'url']),
    label: z.string().trim().optional().or(z.literal('')),
    url: z.string().trim().url('URL inválida').optional().or(z.literal('')),
    position: z.number().int().min(1),
    open_target: z.enum(['same-tab', 'new-tab', 'new-window']).default('new-tab'),
    is_active: z.boolean().default(true),
}).superRefine((value, ctx) => {
    if (value.action_type === 'url' && !value.url) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'Informe a URL do botão.',
        });
    }
});
export type CourseFormInput = z.infer<typeof courseFormSchema>;
export type CoursePublicPageContentInput = z.infer<typeof coursePublicPageContentSchema>;
export type CoursePublicPageFormInput = z.infer<typeof coursePublicPageFormSchema>;
export type ModuleFormInput = z.infer<typeof moduleFormSchema>;
export type LessonFormInput = z.infer<typeof lessonFormSchema>;
export type ButtonTemplateFormInput = z.infer<typeof buttonTemplateFormSchema>;
export type LessonFooterActionFormInput = z.infer<typeof lessonFooterActionFormSchema>;

