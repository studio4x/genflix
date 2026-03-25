import { supabase } from '@/services/supabase/client'
import type {
  Assessment,
  AssessmentAnswer,
  AssessmentAttempt,
  AssessmentOption,
  AssessmentQuestion,
} from '@/types/content'

import {
  submitAssessmentAttemptSchema,
  type AssessmentAnswerInput,
} from './schemas'

export interface StudentCourseAssessmentSummary {
  assessment_id: string
  assessment_type: 'module' | 'final'
  module_id: string | null
  module_position: number | null
  title: string
  description: string | null
  is_required: boolean
  passing_score: number
  max_attempts: number
  is_active: boolean
  is_unlocked: boolean
  attempts_used: number
  last_score: number | null
  last_is_approved: boolean
  remaining_attempts: number
  state: 'blocked' | 'available' | 'approved' | 'failed_limit'
}

export interface StudentAssessmentQuestionWithOptions extends AssessmentQuestion {
  options: AssessmentOption[]
}

export interface SubmitAssessmentAttemptResult {
  attempt_id: string
  score_percent: number
  is_approved: boolean
  attempt_number: number
  max_attempts: number
  remaining_attempts: number
}

export interface StudentAssessmentReview {
  latestAttempt: AssessmentAttempt | null
  answers: AssessmentAnswer[]
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error('Erro inesperado.')
}

export function toErrorMessage(error: unknown): string {
  return toError(error).message
}

export async function fetchStudentCourseAssessments(courseId: string) {
  const result = await supabase.rpc('get_student_course_assessments', {
    _course_id: courseId,
  })

  if (result.error) {
    throw result.error
  }
  return (result.data as StudentCourseAssessmentSummary[]) ?? []
}

export async function fetchAssessmentForExecution(assessmentId: string) {
  const [assessmentResult, questionsResult, optionsResult] = await Promise.all([
    supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .maybeSingle(),
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

  if (assessmentResult.error) {
    throw assessmentResult.error
  }
  if (questionsResult.error) {
    throw questionsResult.error
  }
  if (optionsResult.error) {
    throw optionsResult.error
  }

  const assessment = (assessmentResult.data as Assessment | null) ?? null
  const questions = (questionsResult.data as AssessmentQuestion[]) ?? []
  const options = (optionsResult.data as AssessmentOption[]) ?? []

  const optionsMap = new Map<string, AssessmentOption[]>()
  for (const option of options) {
    const current = optionsMap.get(option.question_id) ?? []
    current.push(option)
    optionsMap.set(option.question_id, current)
  }

  const questionsWithOptions = questions.map((question) => ({
    ...question,
    options: optionsMap.get(question.id) ?? [],
  }))

  return {
    assessment,
    questions: questionsWithOptions as StudentAssessmentQuestionWithOptions[],
  }
}

export async function submitAssessmentAttempt(
  assessmentId: string,
  answers: AssessmentAnswerInput[],
) {
  const parsed = submitAssessmentAttemptSchema.safeParse({
    assessment_id: assessmentId,
    answers,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
  }

  const result = await supabase.rpc('submit_assessment_attempt', {
    _assessment_id: parsed.data.assessment_id,
    _answers: parsed.data.answers,
  })

  if (result.error) {
    throw result.error
  }

  const payload = (result.data?.[0] as SubmitAssessmentAttemptResult | undefined) ?? null
  if (!payload) {
    throw new Error('Falha ao processar tentativa de avaliacao.')
  }

  return payload
}

export async function fetchOwnAssessmentAttempts(assessmentId: string) {
  const result = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('attempt_number', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data as AssessmentAttempt[]) ?? []
}

export async function fetchOwnAssessmentReview(assessmentId: string) {
  const attempts = await fetchOwnAssessmentAttempts(assessmentId)
  const latestAttempt = attempts[0] ?? null

  if (!latestAttempt) {
    return {
      latestAttempt: null,
      answers: [],
    } satisfies StudentAssessmentReview
  }

  const answersResult = await supabase
    .from('assessment_answers')
    .select('*')
    .eq('attempt_id', latestAttempt.id)

  if (answersResult.error) {
    throw answersResult.error
  }

  return {
    latestAttempt,
    answers: (answersResult.data as AssessmentAnswer[]) ?? [],
  } satisfies StudentAssessmentReview
}
