import { z } from 'zod';
import { assessmentInteractionContentSchema, assessmentQuestionAnswerKeyPayloadSchema, isGamifiedQuestionType, validateInteractionBundle, } from '@/features/assessments/gamified';

export const assessmentFormSchema = z.object({
    title: z.string().trim().min(2, "Título deve ter ao menos 2 caracteres."),
    description: z.string().trim().max(2000).optional(),
    is_required: z.boolean(),
    passing_score: z
        .number()
        .min(0, "Nota mínima deve ser maior ou igual a 0.")
        .max(100, "Nota mínima deve ser menor ou igual a 100."),
    max_attempts: z
        .number()
        .int()
        .min(1, 'Tentativas deve ser ao menos 1.')
        .max(20, 'Tentativas deve ser no máximo 20.'),
    estimated_minutes: z
        .number()
        .int()
        .min(1, 'Duração deve ser ao menos 1 minuto.')
        .max(600, 'Duração deve ser no máximo 600 minutos.'),
    is_active: z.boolean(),
});

export const assessmentQuestionFormSchema = z.object({
    question_text: z
        .string()
        .trim()
        .min(2, 'Pergunta deve ter ao menos 2 caracteres.'),
    question_type: z.enum([
        'single_choice',
        'essay_ai',
        'case_study_ai',
        'case_study_single_choice',
        'drag_drop_labeling',
        'fill_in_the_blanks',
        'image_hotspot',
        'coloring',
    ]),
    essay_expected_answer: z.string().trim().optional(),
    case_study_id: z.string().uuid("Estudo de caso inválido.").nullable().optional(),
    case_question_position: z.number().int().min(1, 'Posição interna inválida.').nullable().optional(),
    interaction_content: assessmentInteractionContentSchema.nullable().optional(),
    grading_mode: z.enum(['partial_by_item', 'all_or_nothing']).optional(),
    answer_key: assessmentQuestionAnswerKeyPayloadSchema.nullable().optional(),
    is_required: z.boolean(),
    points: z.number().min(0, "Pontuação não pode ser negativa."),
}).superRefine((value, ctx) => {
    const isStandaloneEssay = value.question_type === 'essay_ai';
    const isCaseStudyAi = value.question_type === 'case_study_ai';
    const isCaseStudySingleChoice = value.question_type === 'case_study_single_choice';
    const isCaseStudyQuestion = isCaseStudyAi || isCaseStudySingleChoice;
    const isGamified = isGamifiedQuestionType(value.question_type);
    if (isCaseStudyQuestion && !value.case_study_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['case_study_id'],
            message: 'Informe o estudo de caso vinculado.',
        });
    }
    if (isCaseStudyQuestion && !value.case_question_position) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['case_question_position'],
            message: 'Informe a posição da pergunta dentro do estudo de caso.',
        });
    }
    if (!isCaseStudyQuestion && value.case_study_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['case_study_id'],
            message: 'Perguntas independentes não podem ser vinculadas a estudo de caso.',
        });
    }
    if (!isCaseStudyQuestion && value.case_question_position) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['case_question_position'],
            message: 'Perguntas independentes não usam posição interna de estudo de caso.',
        });
    }
    if (isStandaloneEssay || isCaseStudyAi) {
        if ((value.essay_expected_answer?.trim().length ?? 0) < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['essay_expected_answer'],
                message: 'Informe a resposta válida esperada para a questão discursiva.',
            });
        }
        if (isStandaloneEssay && value.points !== 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['points'],
                message: 'Questões discursivas com IA não geram pontos.',
            });
        }
        if (isCaseStudyAi && value.points <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['points'],
                message: 'Perguntas discursivas do estudo de caso devem ter pontuação maior que zero.',
            });
        }
        return;
    }
    if (isGamified) {
        if (value.case_study_id || value.case_question_position) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['question_type'],
                message: 'Questões gamificadas não podem ficar dentro de estudo de caso na v1.',
            });
        }
        if (value.points <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['points'],
                message: 'Pontuação deve ser maior que zero.',
            });
        }
        try {
            validateInteractionBundle(value.question_type, value.interaction_content ?? null, value.answer_key ?? null);
        }
        catch (error) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['interaction_content'],
                message: error instanceof Error ? error.message : 'Interação gamificada inválida.',
            });
        }
        return;
    }
    if (value.points <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['points'],
            message: 'Pontuação deve ser maior que zero.',
        });
    }
});

export const assessmentCaseStudyFormSchema = z.object({
    title: z.string().trim().max(160).optional(),
    case_text: z.string().trim().min(10, 'Descreva o caso com pelo menos 10 caracteres.'),
});

export const assessmentOptionFormSchema = z.object({
    question_id: z.string().uuid('Questão inválida.'),
    option_text: z.string().trim().min(1, 'Opção deve ter ao menos 1 caractere.'),
    is_correct: z.boolean(),
});

export type AssessmentFormInput = z.infer<typeof assessmentFormSchema>;
export type AssessmentQuestionFormInput = z.infer<typeof assessmentQuestionFormSchema>;
export type AssessmentOptionFormInput = z.infer<typeof assessmentOptionFormSchema>;
export type AssessmentCaseStudyFormInput = z.infer<typeof assessmentCaseStudyFormSchema>;
