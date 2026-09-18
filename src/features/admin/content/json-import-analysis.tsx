import type { ReactNode } from 'react';

export type JsonImportTarget = 'course' | 'content' | 'assessment';
export type JsonImportFormat = 'course' | 'module-list' | 'module' | 'lesson' | 'assessment' | 'unknown';

export type JsonImportAnalysis = {
    canImport: boolean;
    format: JsonImportFormat | null;
    label: string;
    description: string;
    summary: string[];
    errors: string[];
    warnings: string[];
    parsedData: unknown | null;
};

type JsonRecord = Record<string, unknown>;

const LESSON_TYPES = new Set(['video', 'text', 'hybrid', 'file']);

function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function cleanImportJson(rawJson: string) {
    const cleanedJson = rawJson.trim();
    const match = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match?.[1]) {
        return match[1].trim();
    }
    return cleanedJson.replace(/^```(?:json)?\s+/i, '').replace(/\s+```$/, '').trim();
}

export function parseImportJson<T = unknown>(rawJson: string): T {
    const cleanedJson = cleanImportJson(rawJson);
    if (!cleanedJson) {
        throw new Error('Cole ou selecione um JSON antes de continuar.');
    }

    let data: unknown;
    try {
        data = JSON.parse(cleanedJson);
    }
    catch (firstError) {
        try {
            const fixedJson = cleanedJson.replace(/\n(?!\s*[[\]{}",:0-9.tfn-])/g, '\\n');
            data = JSON.parse(fixedJson);
        }
        catch (secondError) {
            const errorMessage = getErrorMessage(secondError || firstError);
            throw new Error(`Erro de sintaxe no JSON: ${errorMessage}. Verifique aspas e quebras de linha.`);
        }
    }

    return JSON.parse(JSON.stringify(data), (_key, value) => {
        if (typeof value === 'string') {
            return value.replace(/\\"/g, '"').replace(/\\'/g, "'");
        }
        return value;
    }) as T;
}

function pushSummary(summary: string[], count: number, singular: string, plural = `${singular}s`) {
    if (count > 0) {
        summary.push(`${count} ${count === 1 ? singular : plural}`);
    }
}

function analyzeQuestion(question: unknown, path: string, errors: string[], warnings: string[]) {
    if (!isRecord(question)) {
        errors.push(`${path} precisa ser um objeto.`);
        return;
    }
    if (typeof question.question_text !== 'string' || !question.question_text.trim()) {
        errors.push(`${path} não possui question_text preenchido.`);
    }
    if (question.question_type !== undefined && typeof question.question_type !== 'string') {
        errors.push(`${path}.question_type precisa ser um texto.`);
    }
    if (question.points !== undefined && typeof question.points !== 'number') {
        errors.push(`${path}.points precisa ser um número.`);
    }
    if (question.is_required !== undefined && typeof question.is_required !== 'boolean') {
        errors.push(`${path}.is_required precisa ser booleano.`);
    }
    if (question.options !== undefined) {
        if (!Array.isArray(question.options)) {
            errors.push(`${path}.options precisa ser uma lista.`);
        }
        else {
            const correctOptions = question.options.filter((option) => isRecord(option) && option.is_correct === true);
            if (question.question_type === 'single_choice' && correctOptions.length !== 1) {
                errors.push(`${path} precisa ter exatamente uma alternativa correta.`);
            }
            question.options.forEach((option, optionIndex) => {
                if (!isRecord(option) || typeof option.option_text !== 'string' || typeof option.is_correct !== 'boolean') {
                    errors.push(`${path}.options[${optionIndex}] precisa conter option_text e is_correct.`);
                }
            });
        }
    }
    else if (question.question_type === 'single_choice') {
        warnings.push(`${path} é single_choice, mas não possui options.`);
    }
    if (question.interaction !== undefined && !isRecord(question.interaction)) {
        errors.push(`${path}.interaction precisa ser um objeto.`);
    }
}

function analyzeAssessment(value: unknown, path: string, errors: string[], warnings: string[]) {
    if (!isRecord(value)) {
        errors.push(`${path} precisa ser um objeto.`);
        return { questionCount: 0, caseStudyCount: 0 };
    }
    const questions = value.questions;
    const caseStudies = value.case_studies;
    if (questions !== undefined && !Array.isArray(questions)) {
        errors.push(`${path}.questions precisa ser uma lista.`);
    }
    if (caseStudies !== undefined && !Array.isArray(caseStudies)) {
        errors.push(`${path}.case_studies precisa ser uma lista.`);
    }
    const questionItems = Array.isArray(questions) ? questions : [];
    const caseStudyItems = Array.isArray(caseStudies) ? caseStudies : [];
    if (questionItems.length === 0 && caseStudyItems.length === 0) {
        errors.push(`${path} precisa conter questions ou case_studies com conteúdo.`);
    }
    questionItems.forEach((question, index) => analyzeQuestion(question, `${path}.questions[${index}]`, errors, warnings));
    caseStudyItems.forEach((caseStudy, caseStudyIndex) => {
        const casePath = `${path}.case_studies[${caseStudyIndex}]`;
        if (!isRecord(caseStudy)) {
            errors.push(`${casePath} precisa ser um objeto.`);
            return;
        }
        if (typeof caseStudy.case_text !== 'string' || !caseStudy.case_text.trim()) {
            errors.push(`${casePath} não possui case_text preenchido.`);
        }
        if (!Array.isArray(caseStudy.questions)) {
            errors.push(`${casePath}.questions precisa ser uma lista.`);
            return;
        }
        caseStudy.questions.forEach((question, index) => analyzeQuestion(question, `${casePath}.questions[${index}]`, errors, warnings));
    });
    return {
        questionCount: questionItems.length + caseStudyItems.reduce((total, item) => total + (isRecord(item) && Array.isArray(item.questions) ? item.questions.length : 0), 0),
        caseStudyCount: caseStudyItems.length,
    };
}

function analyzeLesson(value: unknown, path: string, errors: string[], warnings: string[]) {
    if (!isRecord(value)) {
        errors.push(`${path} precisa ser um objeto.`);
        return;
    }
    if (typeof value.title !== 'string' || !value.title.trim()) {
        errors.push(`${path} não possui title preenchido.`);
    }
    if (typeof value.lesson_type !== 'string' || !LESSON_TYPES.has(value.lesson_type)) {
        errors.push(`${path}.lesson_type precisa ser video, text, hybrid ou file.`);
    }
    if (value.estimated_minutes !== undefined && (typeof value.estimated_minutes !== 'number' || !Number.isInteger(value.estimated_minutes))) {
        errors.push(`${path}.estimated_minutes precisa ser um número inteiro.`);
    }
    if (value.blocks !== undefined && !Array.isArray(value.blocks)) {
        errors.push(`${path}.blocks precisa ser uma lista.`);
    }
    if ((value.lesson_type === 'text' || value.lesson_type === 'hybrid') && typeof value.text_content !== 'string' && !Array.isArray(value.blocks)) {
        warnings.push(`${path} é uma aula ${value.lesson_type}, mas não possui text_content ou blocks.`);
    }
    if (value.lesson_type === 'video' && typeof value.youtube_url !== 'string') {
        warnings.push(`${path} é uma aula de vídeo sem youtube_url.`);
    }
}

function analyzeModule(value: unknown, path: string, errors: string[], warnings: string[]) {
    if (!isRecord(value)) {
        errors.push(`${path} precisa ser um objeto.`);
        return { lessonCount: 0, assessmentCount: 0, questionCount: 0, caseStudyCount: 0 };
    }
    if (typeof value.title !== 'string' || !value.title.trim()) {
        errors.push(`${path} não possui title preenchido.`);
    }
    if (value.lessons !== undefined && !Array.isArray(value.lessons)) {
        errors.push(`${path}.lessons precisa ser uma lista.`);
    }
    if (value.assessments !== undefined && !Array.isArray(value.assessments)) {
        errors.push(`${path}.assessments precisa ser uma lista.`);
    }
    const lessons = Array.isArray(value.lessons) ? value.lessons : [];
    const assessments = Array.isArray(value.assessments) ? value.assessments : [];
    lessons.forEach((lesson, index) => analyzeLesson(lesson, `${path}.lessons[${index}]`, errors, warnings));
    let questionCount = 0;
    let caseStudyCount = 0;
    assessments.forEach((assessment, index) => {
        const assessmentPath = `${path}.assessments[${index}]`;
        if (!isRecord(assessment) || typeof assessment.title !== 'string' || !assessment.title.trim()) {
            errors.push(`${assessmentPath} não possui title preenchido.`);
        }
        const assessmentSummary = analyzeAssessment(assessment, assessmentPath, errors, warnings);
        questionCount += assessmentSummary.questionCount;
        caseStudyCount += assessmentSummary.caseStudyCount;
    });
    return {
        lessonCount: lessons.length,
        assessmentCount: assessments.length,
        questionCount,
        caseStudyCount,
    };
}

export function analyzeImportedJson(rawJson: string, options: { target: JsonImportTarget }): JsonImportAnalysis {
    if (!rawJson.trim()) {
        return {
            canImport: false,
            format: null,
            label: 'Aguardando JSON',
            description: 'Cole um JSON ou selecione um arquivo para iniciar a análise.',
            summary: [],
            errors: [],
            warnings: [],
            parsedData: null,
        };
    }
    let parsedData: unknown;
    try {
        parsedData = parseImportJson(rawJson);
    }
    catch (error) {
        return {
            canImport: false,
            format: null,
            label: 'JSON inválido',
            description: 'O conteúdo não pôde ser convertido em um objeto JSON válido.',
            summary: [],
            errors: [getErrorMessage(error)],
            warnings: [],
            parsedData: null,
        };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const summary: string[] = [];
    let format: JsonImportFormat = 'unknown';
    let label = 'Formato não reconhecido';
    let description = 'O JSON foi lido, mas não corresponde a uma estrutura de importação reconhecida.';
    let moduleCount = 0;
    let lessonCount = 0;
    let assessmentCount = 0;
    let questionCount = 0;
    let caseStudyCount = 0;

    if (Array.isArray(parsedData)) {
        format = 'module-list';
        label = 'Lista de módulos';
        description = 'A lista será importada como módulos, aulas e avaliações no curso atual.';
        moduleCount = parsedData.length;
        if (moduleCount === 0) {
            errors.push('A lista de módulos está vazia.');
        }
        parsedData.forEach((module, index) => {
            const moduleSummary = analyzeModule(module, `modules[${index}]`, errors, warnings);
            lessonCount += moduleSummary.lessonCount;
            assessmentCount += moduleSummary.assessmentCount;
            questionCount += moduleSummary.questionCount;
            caseStudyCount += moduleSummary.caseStudyCount;
        });
    }
    else if (isRecord(parsedData)) {
        if (Array.isArray(parsedData.modules)) {
            format = 'course';
            label = 'Curso completo';
            description = 'O JSON contém os metadados do curso e sua estrutura de módulos, aulas e avaliações.';
            moduleCount = parsedData.modules.length;
            if (typeof parsedData.title !== 'string' || !parsedData.title.trim()) {
                errors.push('O curso não possui title preenchido.');
            }
            if (moduleCount === 0) {
                errors.push('O curso precisa conter pelo menos um módulo.');
            }
            parsedData.modules.forEach((module, index) => {
                const moduleSummary = analyzeModule(module, `modules[${index}]`, errors, warnings);
                lessonCount += moduleSummary.lessonCount;
                assessmentCount += moduleSummary.assessmentCount;
                questionCount += moduleSummary.questionCount;
                caseStudyCount += moduleSummary.caseStudyCount;
            });
        }
        else if (Array.isArray(parsedData.lessons) || Array.isArray(parsedData.assessments)) {
            format = 'module';
            label = 'Módulo avulso';
            description = 'O JSON contém um módulo com suas aulas e avaliações.';
            const moduleSummary = analyzeModule(parsedData, 'module', errors, warnings);
            moduleCount = 1;
            lessonCount = moduleSummary.lessonCount;
            assessmentCount = moduleSummary.assessmentCount;
            questionCount = moduleSummary.questionCount;
            caseStudyCount = moduleSummary.caseStudyCount;
            if (lessonCount === 0 && assessmentCount === 0) {
                errors.push('O módulo precisa conter lessons ou assessments.');
            }
        }
        else if (Array.isArray(parsedData.questions) || Array.isArray(parsedData.case_studies)) {
            format = 'assessment';
            label = 'Quiz / avaliação';
            description = 'O JSON contém perguntas e/ou estudos de caso para uma avaliação.';
            const assessmentSummary = analyzeAssessment(parsedData, 'assessment', errors, warnings);
            questionCount = assessmentSummary.questionCount;
            caseStudyCount = assessmentSummary.caseStudyCount;
            assessmentCount = 1;
        }
        else if (typeof parsedData.lesson_type === 'string') {
            format = 'lesson';
            label = 'Aula isolada';
            description = 'O JSON contém uma aula isolada. Para importá-la, coloque-a dentro de lessons de um módulo.';
            analyzeLesson(parsedData, 'lesson', errors, warnings);
            lessonCount = 1;
            if (options.target !== 'content') {
                errors.push('Uma aula isolada não pode ser importada neste ponto; use um módulo com lessons.');
            }
        }
        else {
            errors.push('A estrutura precisa conter modules, lessons, assessments, questions ou case_studies.');
        }
    }
    else {
        errors.push('O JSON precisa ser um objeto ou uma lista de módulos.');
    }

    pushSummary(summary, moduleCount, 'módulo', 'módulos');
    pushSummary(summary, lessonCount, 'aula', 'aulas');
    pushSummary(summary, assessmentCount, 'avaliação', 'avaliações');
    pushSummary(summary, questionCount, 'pergunta', 'perguntas');
    pushSummary(summary, caseStudyCount, 'estudo de caso', 'estudos de caso');

    if (options.target === 'course' && format !== 'course') {
        errors.unshift('Este importador espera um curso completo com a propriedade modules.');
    }
    if (options.target === 'assessment' && format !== 'assessment') {
        errors.unshift('Este importador espera um quiz ou avaliação com questions ou case_studies.');
    }
    if (options.target === 'content' && format === 'unknown') {
        errors.unshift('Este importador espera um curso, módulo, lista de módulos ou avaliação.');
    }

    return {
        canImport: errors.length === 0,
        format,
        label,
        description,
        summary,
        errors,
        warnings,
        parsedData,
    };
}

export function JsonImportAnalysisPanel({ analysis, className = '' }: { analysis: JsonImportAnalysis; className?: string }) {
    if (!analysis.parsedData && analysis.errors.length === 0) {
        return null;
    }
    const hasWarnings = analysis.warnings.length > 0;
    const tone = analysis.errors.length > 0
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : hasWarnings
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900';
    const statusLabel = analysis.errors.length > 0
        ? 'Não está pronto para importar'
        : hasWarnings
            ? 'Análise concluída com avisos'
            : 'JSON pronto para importar';
    return (<div aria-live="polite" className={`rounded-2xl border p-4 text-left ${tone} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Análise prévia</p>
          <p className="mt-1 text-sm font-black">{statusLabel}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed opacity-80">{analysis.description}</p>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
          {analysis.label}
        </span>
      </div>

      {analysis.summary.length > 0 ? (<div className="mt-3 flex flex-wrap gap-2">
        {analysis.summary.map((item) => (<span key={item} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold">{item}</span>))}
      </div>) : null}

      {analysis.errors.length > 0 ? (<div className="mt-3 space-y-1 text-xs font-semibold">
        <p className="font-black uppercase tracking-[0.12em]">Corrija antes de importar</p>
        {analysis.errors.slice(0, 6).map((error) => (<p key={error}>• {error}</p>))}
        {analysis.errors.length > 6 ? <p>• Existem outros erros estruturais.</p> : null}
      </div>) : null}

      {hasWarnings ? (<div className="mt-3 space-y-1 text-xs font-semibold">
        <p className="font-black uppercase tracking-[0.12em]">Avisos</p>
        {analysis.warnings.slice(0, 4).map((warning) => (<p key={warning}>• {warning}</p>))}
        {analysis.warnings.length > 4 ? <p>• Existem outros avisos para revisar.</p> : null}
      </div>) : null}
    </div>) as ReactNode;
}
