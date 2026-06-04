import { DEFAULT_COURSE_QUIZ_TYPE_SETTINGS } from '@/features/assessments/course-quiz-type-settings';

export type JsonModelTemplate = {
    id: string;
    title: string;
    description: string;
    fileName: string;
    data: unknown;
};

const sharedFirstLesson = {
    title: 'Boas-vindas e visão geral',
    description: 'Apresenta o objetivo do curso e o que a pessoa vai aprender.',
    lesson_type: 'text' as const,
    text_content: '<p>Bem-vindo ao curso. Este conteúdo é um exemplo de aula com blocos ricos.</p>',
    blocks: [
        {
            type: 'rich-text' as const,
            content: '<p>Bem-vindo ao curso.</p><p>Este é um bloco rico de exemplo.</p>',
        },
    ],
    estimated_minutes: 8,
};

const sharedModuleAssessment = {
    title: 'Quiz de fixação',
    description: 'Verifica a compreensão dos pontos principais do módulo.',
    assessment_type: 'module' as const,
    passing_score: 70,
    max_attempts: 3,
    estimated_minutes: 10,
    questions: [
        {
            question_text: 'Qual é o objetivo principal deste módulo?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'Entender os conceitos básicos e a estrutura do conteúdo.',
                    is_correct: true,
                },
                {
                    option_text: 'Saltar direto para a avaliação final.',
                    is_correct: false,
                },
            ],
        },
    ],
    case_studies: [],
};

const sharedFinalAssessment = {
    title: 'Avaliação final',
    description: 'Modelo para o quiz final do curso.',
    passing_score: 70,
    max_attempts: 3,
    estimated_minutes: 15,
    questions: [
        {
            question_text: 'Qual alternativa resume melhor o conteúdo apresentado?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'A estrutura do curso organiza o conteúdo em módulos, aulas e avaliações.',
                    is_correct: true,
                },
                {
                    option_text: 'O JSON só suporta texto simples sem estrutura.',
                    is_correct: false,
                },
            ],
        },
    ],
    case_studies: [
        {
            title: 'Aplicação prática',
            case_text: 'Leia o cenário e responda com base nos conceitos do curso.',
            questions: [
                {
                    question_text: 'Como você aplicaria o conteúdo aprendido nesse cenário?',
                    question_type: 'essay_ai' as const,
                    points: 2,
                    is_required: true,
                    essay_expected_answer: 'Resposta aberta demonstrando compreensão prática do conteúdo.',
                },
            ],
        },
    ],
};

export const JSON_MODEL_TEMPLATES: JsonModelTemplate[] = [
    {
        id: 'full-course',
        title: 'Curso completo',
        description: 'Estrutura do curso com múltiplos módulos, aulas, quizzes e configurações globais.',
        fileName: 'modelo-json-curso-completo',
        data: {
            title: 'Curso de Exemplo',
            description: 'Descrição do curso em HTML ou texto.',
            workload_minutes: 240,
            thumbnail_url: 'https://example.com/thumb.jpg',
            status: 'draft',
            quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
            modules: [
                {
                    title: 'Módulo 1 - Fundamentos',
                    description: 'Primeiro módulo do curso com base teórica e prática.',
                    lessons: [sharedFirstLesson],
                    assessments: [sharedModuleAssessment],
                },
                {
                    title: 'Módulo 2 - Aplicação',
                    description: 'Segundo módulo para aprofundamento.',
                    lessons: [
                        {
                            ...sharedFirstLesson,
                            title: 'Aplicação guiada',
                            description: 'Reforço prático dos conceitos do curso.',
                        },
                    ],
                    assessments: [],
                },
            ],
        },
    },
    {
        id: 'first-module',
        title: '1º módulo do curso',
        description: 'Estrutura do curso já com as informações básicas e o primeiro módulo pronto para preencher.',
        fileName: 'modelo-json-primeiro-modulo-do-curso',
        data: {
            title: 'Curso de Exemplo',
            description: 'Resumo breve do curso para contextualizar o primeiro módulo.',
            workload_minutes: 180,
            thumbnail_url: 'https://example.com/thumb.jpg',
            status: 'draft',
            quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
            modules: [
                {
                    title: 'Módulo 1 - Boas-vindas',
                    description: 'Primeiro contato com o conteúdo do curso.',
                    lessons: [sharedFirstLesson],
                    assessments: [sharedModuleAssessment],
                },
            ],
        },
    },
    {
        id: 'module',
        title: 'Módulo avulso',
        description: 'Um módulo isolado com aulas e avaliações, ideal para substituir ou anexar em um curso existente.',
        fileName: 'modelo-json-modulo-avulso',
        data: {
            title: 'Módulo avulso',
            description: 'Descrição do módulo isolado.',
            lessons: [sharedFirstLesson],
            assessments: [sharedModuleAssessment],
        },
    },
    {
        id: 'final-assessment',
        title: 'Avaliação final',
        description: 'JSON do quiz final do curso, com perguntas e estudos de caso.',
        fileName: 'modelo-json-avaliacao-final',
        data: sharedFinalAssessment,
    },
];

export function stringifyJsonModel(data: unknown) {
    return JSON.stringify(data, null, 2);
}
