import { DEFAULT_COURSE_QUIZ_TYPE_SETTINGS } from '@/features/assessments/course-quiz-type-settings';

export type JsonModelTemplate = {
    id: string;
    title: string;
    description: string;
    fileName: string;
    data: unknown;
};

function createLesson(title: string, description: string, minutes: number, content: string) {
    return {
        title,
        description,
        lesson_type: 'text' as const,
        text_content: content,
        blocks: [
            {
                type: 'rich-text' as const,
                content,
            },
        ],
        estimated_minutes: minutes,
    };
}

function createModuleAssessment(title: string, questionPrefix: string) {
    return {
        title,
        description: 'Verifica a compreensão dos pontos principais do módulo.',
        assessment_type: 'module' as const,
        passing_score: 70,
        max_attempts: 3,
        estimated_minutes: 10,
        questions: [
            {
                question_text: `Qual é o objetivo principal de ${questionPrefix}?`,
                question_type: 'single_choice' as const,
                points: 1,
                is_required: true,
                options: [
                    {
                        option_text: 'Entender os conceitos básicos e a estrutura do conteúdo.',
                        is_correct: true,
                    },
                    {
                        option_text: 'Pular direto para a avaliação final.',
                        is_correct: false,
                    },
                    {
                        option_text: 'Usar apenas conteúdo visual sem texto.',
                        is_correct: false,
                    },
                    {
                        option_text: 'Ignorar a organização em módulos.',
                        is_correct: false,
                    },
                ],
            },
        ],
        case_studies: [],
    };
}

function createThreeLessonModule(moduleTitle: string, moduleDescription: string, prefix: string) {
    return {
        title: moduleTitle,
        description: moduleDescription,
        lessons: [
            createLesson(`${prefix} - Aula 1`, 'Introduz o tema principal do módulo.', 8, `<p>${prefix} - Aula 1: conteúdo introdutório.</p>`),
            createLesson(`${prefix} - Aula 2`, 'Amplia a compreensão com um segundo passo.', 10, `<p>${prefix} - Aula 2: aprofundamento do conteúdo.</p>`),
            createLesson(`${prefix} - Aula 3`, 'Fecha o ciclo com revisão prática.', 12, `<p>${prefix} - Aula 3: revisão e aplicação.</p>`),
        ],
        assessments: [
            createModuleAssessment('Quiz de fixação', prefix),
        ],
    };
}

function createFinalAssessmentQuestionSet() {
    return [
        {
            question_text: 'Qual alternativa resume melhor a organização do curso?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'Módulos, aulas e avaliações trabalham juntos para estruturar o aprendizado.',
                    is_correct: true,
                },
                {
                    option_text: 'O curso só possui uma lista solta de textos.',
                    is_correct: false,
                },
                {
                    option_text: 'Os módulos não têm relação com as aulas.',
                    is_correct: false,
                },
                {
                    option_text: 'A avaliação final substitui todo o conteúdo do curso.',
                    is_correct: false,
                },
            ],
        },
        {
            question_text: 'Como o JSON exportado trata as aulas ricas?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'Ele preserva os blocos estruturados além do texto consolidado.',
                    is_correct: true,
                },
                {
                    option_text: 'Ele elimina todos os blocos e deixa só o título.',
                    is_correct: false,
                },
                {
                    option_text: 'Ele converte tudo para imagem.',
                    is_correct: false,
                },
                {
                    option_text: 'Ele ignora o conteúdo da aula.',
                    is_correct: false,
                },
            ],
        },
        {
            question_text: 'Quando usar um módulo avulso?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'Quando você quer substituir ou anexar um módulo em um curso existente.',
                    is_correct: true,
                },
                {
                    option_text: 'Somente ao criar um curso do zero.',
                    is_correct: false,
                },
                {
                    option_text: 'Apenas para avaliações finais.',
                    is_correct: false,
                },
                {
                    option_text: 'Quando não há aulas dentro dele.',
                    is_correct: false,
                },
            ],
        },
        {
            question_text: 'O que deve existir em um curso completo exportado?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'Metadados do curso e uma lista de módulos.',
                    is_correct: true,
                },
                {
                    option_text: 'Somente uma avaliação final.',
                    is_correct: false,
                },
                {
                    option_text: 'Apenas o título do primeiro módulo.',
                    is_correct: false,
                },
                {
                    option_text: 'Somente o conteúdo do editor visual.',
                    is_correct: false,
                },
            ],
        },
        {
            question_text: 'Qual é a função da avaliação final?',
            question_type: 'single_choice' as const,
            points: 1,
            is_required: true,
            options: [
                {
                    option_text: 'Validar a assimilação geral do curso.',
                    is_correct: true,
                },
                {
                    option_text: 'Reescrever todos os módulos automaticamente.',
                    is_correct: false,
                },
                {
                    option_text: 'Substituir o conteúdo das aulas.',
                    is_correct: false,
                },
                {
                    option_text: 'Remover a necessidade de perguntas.',
                    is_correct: false,
                },
            ],
        },
    ];
}

const sharedFinalAssessment = {
    title: 'Avaliação final',
    description: 'Modelo para o quiz final do curso.',
    passing_score: 70,
    max_attempts: 3,
    estimated_minutes: 15,
    questions: createFinalAssessmentQuestionSet(),
    case_studies: [],
};

export const JSON_MODEL_TEMPLATES: JsonModelTemplate[] = [
    {
        id: 'full-course',
        title: 'Curso completo',
        description: 'Estrutura do curso com 3 módulos, 3 aulas por módulo, quizzes e configurações globais.',
        fileName: 'modelo-json-curso-completo',
        data: {
            title: 'Curso de Exemplo',
            description: 'Descrição do curso em HTML ou texto.',
            workload_minutes: 360,
            thumbnail_url: 'https://example.com/thumb.jpg',
            status: 'draft',
            quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
            modules: [
                createThreeLessonModule('Módulo 1 - Fundamentos', 'Primeiro módulo do curso com base teórica e prática.', 'Fundamentos'),
                createThreeLessonModule('Módulo 2 - Aplicação', 'Segundo módulo para aprofundamento.', 'Aplicação'),
                createThreeLessonModule('Módulo 3 - Consolidação', 'Terceiro módulo com revisão e fechamento.', 'Consolidação'),
            ],
        },
    },
    {
        id: 'first-module',
        title: '1º módulo do curso',
        description: 'Estrutura do curso já com as informações básicas e o primeiro módulo preenchido com 3 aulas e quiz.',
        fileName: 'modelo-json-primeiro-modulo-do-curso',
        data: {
            title: 'Curso de Exemplo',
            description: 'Resumo breve do curso para contextualizar o primeiro módulo.',
            workload_minutes: 180,
            thumbnail_url: 'https://example.com/thumb.jpg',
            status: 'draft',
            quiz_type_settings: { ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS },
            modules: [
                createThreeLessonModule('Módulo 1 - Boas-vindas', 'Primeiro contato com o conteúdo do curso.', 'Boas-vindas'),
            ],
        },
    },
    {
        id: 'module',
        title: 'Módulo avulso',
        description: 'Um módulo isolado com 3 aulas e avaliação, ideal para substituir ou anexar em um curso existente.',
        fileName: 'modelo-json-modulo-avulso',
        data: {
            title: 'Módulo avulso',
            description: 'Descrição do módulo isolado.',
            lessons: [
                createLesson('Aula 1 - Introdução', 'Apresenta o tema principal do módulo.', 8, '<p>Módulo avulso - aula 1.</p>'),
                createLesson('Aula 2 - Desenvolvimento', 'Aprofunda o conteúdo com um novo exemplo.', 10, '<p>Módulo avulso - aula 2.</p>'),
                createLesson('Aula 3 - Encerramento', 'Fecha o módulo com revisão prática.', 12, '<p>Módulo avulso - aula 3.</p>'),
            ],
            assessments: [
                createModuleAssessment('Quiz de fixação', 'o módulo avulso'),
            ],
        },
    },
    {
        id: 'final-assessment',
        title: 'Avaliação final',
        description: 'JSON do quiz final do curso, com 5 perguntas de múltipla escolha e 4 alternativas cada.',
        fileName: 'modelo-json-avaliacao-final',
        data: sharedFinalAssessment,
    },
];

export function stringifyJsonModel(data: unknown) {
    return JSON.stringify(data, null, 2);
}
