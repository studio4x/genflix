import { supabase } from '@/services/supabase/client'
import type {
  Assessment,
  AssessmentCaseStudy,
  AssessmentOption,
  AssessmentQuestion,
} from '@/types/content'

import type {
  AssessmentCaseStudyFormInput,
  AssessmentFormInput,
  AssessmentOptionFormInput,
  AssessmentQuestionFormInput,
} from './schemas'

export interface AssessmentQuestionWithOptions extends AssessmentQuestion {
  options: AssessmentOption[]
}

export interface AssessmentCaseStudyWithQuestions extends AssessmentCaseStudy {
  questions: AssessmentQuestionWithOptions[]
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error('Erro inesperado.')
}

export function toErrorMessage(error: unknown): string {
  return normalizeError(error).message
}

async function getNextAssessmentItemPosition(assessmentId: string) {
  const [questionPositionResult, caseStudyPositionResult] = await Promise.all([
    supabase
      .from('assessment_questions')
      .select('position')
      .eq('assessment_id', assessmentId)
      .is('case_study_id', null)
      .order('position', { ascending: false })
      .limit(1),
    supabase
      .from('assessment_case_studies')
      .select('position')
      .eq('assessment_id', assessmentId)
      .order('position', { ascending: false })
      .limit(1),
  ])

  if (questionPositionResult.error) {
    throw questionPositionResult.error
  }

  if (caseStudyPositionResult.error) {
    throw caseStudyPositionResult.error
  }

  return Math.max(
    questionPositionResult.data?.[0]?.position ?? 0,
    caseStudyPositionResult.data?.[0]?.position ?? 0,
  ) + 1
}

export async function fetchModuleAssessment(moduleId: string) {
  const result = await supabase
    .from('assessments')
    .select('*')
    .eq('assessment_type', 'module')
    .eq('module_id', moduleId)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }
  return (result.data as Assessment | null) ?? null
}

export async function fetchFinalAssessment(courseId: string) {
  const result = await supabase
    .from('assessments')
    .select('*')
    .eq('assessment_type', 'final')
    .eq('course_id', courseId)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }
  return (result.data as Assessment | null) ?? null
}

export async function createModuleAssessment(
  courseId: string,
  moduleId: string,
  input: AssessmentFormInput,
  userId: string,
) {
  const result = await supabase
    .from('assessments')
    .insert({
      course_id: courseId,
      module_id: moduleId,
      assessment_type: 'module',
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
      passing_score: input.passing_score,
      max_attempts: input.max_attempts,
      estimated_minutes: input.estimated_minutes,
      is_active: input.is_active,
      created_by: userId,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as Assessment
}

export async function createFinalAssessment(
  courseId: string,
  input: AssessmentFormInput,
  userId: string,
) {
  const result = await supabase
    .from('assessments')
    .insert({
      course_id: courseId,
      module_id: null,
      assessment_type: 'final',
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
      passing_score: input.passing_score,
      max_attempts: input.max_attempts,
      estimated_minutes: input.estimated_minutes,
      is_active: input.is_active,
      created_by: userId,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as Assessment
}

export async function updateAssessment(assessmentId: string, input: AssessmentFormInput) {
  const result = await supabase
    .from('assessments')
    .update({
      title: input.title,
      description: input.description?.trim() || null,
      is_required: input.is_required,
      passing_score: input.passing_score,
      max_attempts: input.max_attempts,
      estimated_minutes: input.estimated_minutes,
      is_active: input.is_active,
    })
    .eq('id', assessmentId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as Assessment
}

export async function fetchAssessmentQuestions(assessmentId: string) {
  const [questionsResult, optionsResult] = await Promise.all([
    supabase
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('position', { ascending: true }),
    supabase
      .from('assessment_options')
      .select('*, assessment_questions!inner(assessment_id)')
      .eq('assessment_questions.assessment_id', assessmentId)
      .order('position', { ascending: true }),
  ])

  if (questionsResult.error) {
    throw questionsResult.error
  }
  if (optionsResult.error) {
    throw optionsResult.error
  }

  const questions = (questionsResult.data as AssessmentQuestion[]) ?? []
  const options = (optionsResult.data as AssessmentOption[]) ?? []
  const optionsMap = new Map<string, AssessmentOption[]>()

  for (const option of options) {
    const current = optionsMap.get(option.question_id) ?? []
    current.push(option)
    optionsMap.set(option.question_id, current)
  }

  return questions.map((question) => ({
    ...question,
    options: optionsMap.get(question.id) ?? [],
  })) as AssessmentQuestionWithOptions[]
}

function mapCaseStudiesWithQuestions(
  caseStudies: AssessmentCaseStudy[],
  questions: AssessmentQuestionWithOptions[],
) {
  return caseStudies.map((caseStudy) => ({
    ...caseStudy,
    questions: questions
      .filter((question) => question.case_study_id === caseStudy.id)
      .sort((questionA, questionB) => (questionA.case_question_position ?? 0) - (questionB.case_question_position ?? 0)),
  })) satisfies AssessmentCaseStudyWithQuestions[]
}

export async function fetchAssessmentCaseStudies(
  assessmentId: string,
  questionsInput?: AssessmentQuestionWithOptions[],
) {
  const caseStudiesResult = await supabase
    .from('assessment_case_studies')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('position', { ascending: true })

  if (caseStudiesResult.error) {
    throw caseStudiesResult.error
  }

  const caseStudies = (caseStudiesResult.data as AssessmentCaseStudy[]) ?? []
  const questions = questionsInput ?? await fetchAssessmentQuestions(assessmentId)

  return mapCaseStudiesWithQuestions(caseStudies, questions)
}

export async function createAssessmentQuestion(
  assessmentId: string,
  input: AssessmentQuestionFormInput,
) {
  const nextPosition = input.case_study_id
    ? await supabase
      .from('assessment_case_studies')
      .select('position')
      .eq('id', input.case_study_id)
      .single()
      .then(({ data, error }) => {
        if (error) throw error
        return data.position as number
      })
    : await getNextAssessmentItemPosition(assessmentId)

  const result = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: assessmentId,
      question_text: input.question_text,
      question_type: input.question_type,
      essay_expected_answer: input.question_type === 'essay_ai' || input.question_type === 'case_study_ai'
        ? input.essay_expected_answer?.trim() || null
        : null,
      case_study_id: input.case_study_id ?? null,
      case_question_position: input.case_question_position ?? null,
      position: nextPosition,
      is_required: input.is_required,
      points: input.points,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentQuestion
}

export async function updateAssessmentQuestion(
  questionId: string,
  input: AssessmentQuestionFormInput,
) {
  const result = await supabase
    .from('assessment_questions')
    .update({
      question_text: input.question_text,
      question_type: input.question_type,
      essay_expected_answer: input.question_type === 'essay_ai' || input.question_type === 'case_study_ai'
        ? input.essay_expected_answer?.trim() || null
        : null,
      case_study_id: input.case_study_id ?? null,
      case_question_position: input.case_question_position ?? null,
      is_required: input.is_required,
      points: input.points,
    })
    .eq('id', questionId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentQuestion
}

export async function deleteAssessmentQuestion(questionId: string) {
  const result = await supabase
    .from('assessment_questions')
    .delete()
    .eq('id', questionId)

  if (result.error) {
    throw result.error
  }
}

export async function deleteAssessmentOptionsByQuestion(questionId: string) {
  const result = await supabase
    .from('assessment_options')
    .delete()
    .eq('question_id', questionId)

  if (result.error) {
    throw result.error
  }
}

export async function createAssessmentCaseStudy(
  assessmentId: string,
  input: AssessmentCaseStudyFormInput,
) {
  const nextPosition = await getNextAssessmentItemPosition(assessmentId)

  const result = await supabase
    .from('assessment_case_studies')
    .insert({
      assessment_id: assessmentId,
      title: input.title?.trim() || null,
      case_text: input.case_text.trim(),
      position: nextPosition,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentCaseStudy
}

export async function updateAssessmentCaseStudy(
  caseStudyId: string,
  input: AssessmentCaseStudyFormInput,
) {
  const result = await supabase
    .from('assessment_case_studies')
    .update({
      title: input.title?.trim() || null,
      case_text: input.case_text.trim(),
    })
    .eq('id', caseStudyId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentCaseStudy
}

export async function deleteAssessmentCaseStudy(caseStudyId: string) {
  const result = await supabase
    .from('assessment_case_studies')
    .delete()
    .eq('id', caseStudyId)

  if (result.error) {
    throw result.error
  }
}

export async function createAssessmentOption(input: AssessmentOptionFormInput) {
  const positionResult = await supabase
    .from('assessment_options')
    .select('position')
    .eq('question_id', input.question_id)
    .order('position', { ascending: false })
    .limit(1)

  if (positionResult.error) {
    throw positionResult.error
  }

  const nextPosition = (positionResult.data?.[0]?.position ?? 0) + 1

  const result = await supabase
    .from('assessment_options')
    .insert({
      question_id: input.question_id,
      option_text: input.option_text,
      position: nextPosition,
      is_correct: input.is_correct,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentOption
}

export async function updateAssessmentOption(
  optionId: string,
  input: Omit<AssessmentOptionFormInput, 'question_id'>,
) {
  const result = await supabase
    .from('assessment_options')
    .update({
      option_text: input.option_text,
      is_correct: input.is_correct,
    })
    .eq('id', optionId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentOption
}

export async function deleteAssessmentOption(optionId: string) {
  const result = await supabase
    .from('assessment_options')
    .delete()
    .eq('id', optionId)

  if (result.error) {
    throw result.error
  }
}


export interface ImportAssessmentQuestionData {
  question_text: string
  question_type?: 'single_choice' | 'essay_ai' | 'case_study_ai' | 'case_study_single_choice'
  points?: number
  is_required?: boolean
  essay_expected_answer?: string
  options?: {
    option_text: string
    is_correct: boolean
  }[]
}

export interface ImportAssessmentCaseStudyData {
  title?: string
  case_text: string
  questions: ImportAssessmentQuestionData[]
}

export interface ImportAssessmentData {
  title: string
  description?: string
  passing_score?: number
  max_attempts?: number
  estimated_minutes?: number
  questions?: ImportAssessmentQuestionData[]
  case_studies?: ImportAssessmentCaseStudyData[]
}

export async function exportAssessmentContent(assessmentId: string): Promise<ImportAssessmentData> {
  const assessmentResult = await supabase
    .from('assessments')
    .select('*')
    .eq('id', assessmentId)
    .single()

  if (assessmentResult.error) {
    throw assessmentResult.error
  }

  const assessment = assessmentResult.data as Assessment
  const questions = await fetchAssessmentQuestions(assessmentId)
  const caseStudies = await fetchAssessmentCaseStudies(assessmentId, questions)

  return {
    title: assessment.title,
    description: assessment.description ?? '',
    passing_score: assessment.passing_score,
    max_attempts: assessment.max_attempts,
    estimated_minutes: assessment.estimated_minutes,
    questions: questions
      .filter((question) => !question.case_study_id)
      .map((question) => ({
        question_text: question.question_text,
        question_type: question.question_type,
        points: question.points,
        is_required: question.is_required,
        essay_expected_answer: question.essay_expected_answer ?? undefined,
        options: question.question_type === 'essay_ai' || question.question_type === 'case_study_ai'
          ? []
          : question.options.map((option) => ({
            option_text: option.option_text,
            is_correct: option.is_correct,
          })),
      })),
    case_studies: caseStudies.map((caseStudy) => ({
      title: caseStudy.title ?? undefined,
      case_text: caseStudy.case_text,
      questions: caseStudy.questions.map((question) => ({
        question_text: question.question_text,
        question_type: question.question_type,
        points: question.points,
        is_required: question.is_required,
        essay_expected_answer: question.essay_expected_answer ?? undefined,
        options: question.question_type === 'case_study_ai'
          ? []
          : question.options.map((option) => ({
            option_text: option.option_text,
            is_correct: option.is_correct,
          })),
      })),
    })),
  }
}

export async function exportFinalAssessmentContent(courseId: string): Promise<ImportAssessmentData> {
  const finalAssessment = await fetchFinalAssessment(courseId)
  if (!finalAssessment) {
    throw new Error('Nenhuma avaliacao final encontrada para este curso.')
  }
  return exportAssessmentContent(finalAssessment.id)
}

export async function importAssessmentContent(assessmentId: string, data: ImportAssessmentData) {
  // 1. Atualizar dados básicos da avaliação
  const { error: updateError } = await supabase
    .from('assessments')
    .update({
      title: data.title,
      description: data.description || null,
      passing_score: data.passing_score || 70,
      max_attempts: data.max_attempts || 3,
      estimated_minutes: data.estimated_minutes || 10,
    })
    .eq('id', assessmentId)

  if (updateError) throw updateError

  // 2. Limpar questões existentes (Opcional, mas recomendado para importação limpa)
  // O cascade delete do banco cuidará das opções.
  const { error: deleteError } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('assessment_id', assessmentId)

  if (deleteError) throw deleteError

  // 3. Inserir novas questões e opções
  if (data.questions && data.questions.length > 0) {
    for (let qIdx = 0; qIdx < data.questions.length; qIdx++) {
      const qData = data.questions[qIdx]
      const questionType = qData.question_type === 'essay_ai' ? 'essay_ai' : 'single_choice'
      
      const { data: question, error: qError } = await supabase
        .from('assessment_questions')
        .insert({
          assessment_id: assessmentId,
          question_text: qData.question_text,
          points: questionType === 'essay_ai' ? 0 : (qData.points || 1),
          is_required: qData.is_required ?? true,
          position: qIdx + 1,
          question_type: questionType,
          essay_expected_answer: questionType === 'essay_ai'
            ? qData.essay_expected_answer?.trim() || null
            : null,
        })
        .select()
        .single()

      if (qError) throw qError

      if (questionType === 'single_choice' && qData.options && qData.options.length > 0) {
        const optionsToInsert = qData.options.map((option, oIdx: number) => ({
          question_id: question.id,
          option_text: option.option_text,
          is_correct: option.is_correct,
          position: oIdx + 1
        }))

        const { error: oError } = await supabase.from('assessment_options').insert(optionsToInsert)
        if (oError) throw oError
      }
    }
  }
}

export async function importAssessmentContentStructured(assessmentId: string, data: ImportAssessmentData) {
  const { error: updateError } = await supabase
    .from('assessments')
    .update({
      title: data.title,
      description: data.description || null,
      passing_score: data.passing_score || 70,
      max_attempts: data.max_attempts || 3,
      estimated_minutes: data.estimated_minutes || 10,
    })
    .eq('id', assessmentId)

  if (updateError) throw updateError

  const { error: deleteCaseStudiesError } = await supabase
    .from('assessment_case_studies')
    .delete()
    .eq('assessment_id', assessmentId)

  if (deleteCaseStudiesError) throw deleteCaseStudiesError

  const { error: deleteQuestionsError } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('assessment_id', assessmentId)

  if (deleteQuestionsError) throw deleteQuestionsError

  const standaloneQuestions = data.questions ?? []
  const caseStudies = data.case_studies ?? []
  let nextPosition = 1

  for (const questionInput of standaloneQuestions) {
    const questionType = normalizeImportQuestionType(questionInput.question_type, false)
    const question = await insertImportedQuestion({
      assessmentId,
      input: questionInput,
      questionType,
      position: nextPosition,
      caseStudyId: null,
      caseQuestionPosition: null,
    })

    await insertImportedOptions(question.id, questionType, questionInput.options)
    nextPosition += 1
  }

  for (const caseStudyInput of caseStudies) {
    const caseStudyResult = await supabase
      .from('assessment_case_studies')
      .insert({
        assessment_id: assessmentId,
        title: caseStudyInput.title?.trim() || null,
        case_text: caseStudyInput.case_text.trim(),
        position: nextPosition,
      })
      .select('*')
      .single()

    if (caseStudyResult.error) {
      throw caseStudyResult.error
    }

    const caseStudyId = caseStudyResult.data.id as string

    for (let index = 0; index < caseStudyInput.questions.length; index += 1) {
      const questionInput = caseStudyInput.questions[index]
      const questionType = normalizeImportQuestionType(questionInput.question_type, true)
      const question = await insertImportedQuestion({
        assessmentId,
        input: questionInput,
        questionType,
        position: nextPosition,
        caseStudyId,
        caseQuestionPosition: index + 1,
      })

      await insertImportedOptions(question.id, questionType, questionInput.options)
    }

    nextPosition += 1
  }
}

function normalizeImportQuestionType(
  questionType: ImportAssessmentQuestionData['question_type'],
  insideCaseStudy: boolean,
): AssessmentQuestion['question_type'] {
  if (insideCaseStudy) {
    return questionType === 'case_study_ai' || questionType === 'case_study_single_choice'
      ? questionType
      : 'case_study_single_choice'
  }

  return questionType === 'essay_ai' ? 'essay_ai' : 'single_choice'
}

async function insertImportedQuestion(input: {
  assessmentId: string
  input: ImportAssessmentQuestionData
  questionType: AssessmentQuestion['question_type']
  position: number
  caseStudyId: string | null
  caseQuestionPosition: number | null
}) {
  const result = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: input.assessmentId,
      question_text: input.input.question_text,
      points: input.questionType === 'essay_ai' ? 0 : (input.input.points || 1),
      is_required: input.input.is_required ?? true,
      position: input.position,
      question_type: input.questionType,
      essay_expected_answer: input.questionType === 'essay_ai' || input.questionType === 'case_study_ai'
        ? input.input.essay_expected_answer?.trim() || null
        : null,
      case_study_id: input.caseStudyId,
      case_question_position: input.caseQuestionPosition,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AssessmentQuestion
}

async function insertImportedOptions(
  questionId: string,
  questionType: AssessmentQuestion['question_type'],
  options: ImportAssessmentQuestionData['options'],
) {
  if (questionType === 'essay_ai' || questionType === 'case_study_ai' || !options?.length) {
    return
  }

  const result = await supabase
    .from('assessment_options')
    .insert(options.map((option, index) => ({
      question_id: questionId,
      option_text: option.option_text,
      is_correct: option.is_correct,
      position: index + 1,
    })))

  if (result.error) {
    throw result.error
  }
}

export async function deleteAssessment(assessmentId: string) {
  const result = await supabase
    .from('assessments')
    .delete()
    .eq('id', assessmentId)

  if (result.error) {
    throw result.error
  }
}
