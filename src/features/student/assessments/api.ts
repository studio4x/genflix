import { env } from '@/config/env'
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
  score_mode: 'objective_only' | 'essay_only'
  essay_feedbacks: {
    question_id: string
    question_text: string
    answer_text: string
    is_correct: boolean
    feedback: string
  }[]
}

export interface StudentAssessmentReview {
  latestAttempt: AssessmentAttempt | null
  answers: AssessmentAnswer[]
}

export interface AssessmentAttemptRequest {
  id: string
  assessment_id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_message: string | null
  admin_response: string | null
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
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
      .select('id, assessment_id, question_text, question_type, position, is_required, points, created_at, updated_at')
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
    essay_expected_answer: null,
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

  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const accessToken = await resolveAccessToken(attempt > 1)
    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/submit-assessment-attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        assessment_id: parsed.data.assessment_id,
        answers: parsed.data.answers,
        access_token: accessToken,
      }),
    })

    const payload = await response.json().catch(() => null) as SubmitAssessmentAttemptResult | { error?: string } | null
    if (response.ok && payload) {
      return payload as SubmitAssessmentAttemptResult
    }

    const errorMessage = payload && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Falha ao processar tentativa de avaliacao.'

    if (response.status === 401 && attempt < maxAttempts) {
      continue
    }

    throw new Error(errorMessage)
  }

  throw new Error('Falha ao processar tentativa de avaliacao.')
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

export async function fetchOwnAssessmentAttemptRequest(assessmentId: string) {
  const result = await supabase
    .from('assessment_attempt_requests')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }

  return (result.data as AssessmentAttemptRequest | null) ?? null
}

export async function requestAssessmentAttemptRetry(
  assessmentId: string,
  requestedMessage?: string,
) {
  const result = await supabase.rpc('request_assessment_attempt_retry', {
    _assessment_id: assessmentId,
    _requested_message: requestedMessage?.trim() ? requestedMessage.trim() : null,
  })

  if (result.error) {
    throw result.error
  }

  return (result.data?.[0] as { request_id: string; status: AssessmentAttemptRequest['status'] } | undefined) ?? null
}

async function resolveAccessToken(forceRefresh = false) {
  let sessionResult = await supabase.auth.getSession()
  let accessToken: string | undefined = sessionResult.data.session?.access_token ?? undefined

  if (forceRefresh || !accessToken) {
    const refreshResult = await supabase.auth.refreshSession()
    accessToken = refreshResult.data.session?.access_token ?? undefined
    sessionResult = await supabase.auth.getSession()
    accessToken = accessToken ?? sessionResult.data.session?.access_token ?? undefined
  }

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente para enviar a avaliacao.')
  }

  return accessToken
}
