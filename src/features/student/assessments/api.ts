import { env } from '@/config/env'
import { supabase } from '@/services/supabase/client'
import type {
  Assessment,
  AssessmentAnswer,
  AssessmentAttempt,
  AssessmentCaseStudy,
  AssessmentInteractionResponsePayload,
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
  state: 'blocked' | 'blocked_by_schedule' | 'available' | 'approved' | 'failed_limit'
}

export interface StudentAssessmentOption {
  id: string
  question_id: string
  option_text: string
  position: number
}

export interface StudentAssessmentInteraction {
  question_id: string
  content: AssessmentQuestion['question_type'] extends never ? never : Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export interface StudentAssessmentQuestionWithOptions extends AssessmentQuestion {
  options: StudentAssessmentOption[]
  interaction: StudentAssessmentInteraction | null
}

export interface StudentAssessmentCaseStudyWithQuestions extends AssessmentCaseStudy {
  questions: StudentAssessmentQuestionWithOptions[]
}

export interface SubmitAssessmentAttemptResult {
  attempt_id: string
  score_percent: number
  earned_points: number
  possible_points: number
  is_approved: boolean
  attempt_number: number
  max_attempts: number
  remaining_attempts: number
  score_mode: 'objective_only' | 'essay_only'
  correct_answers: number
  total_questions: number
  essay_feedbacks: {
    question_id: string
    question_text: string
    answer_text: string
    is_correct: boolean
    feedback: string
  }[]
  choice_feedbacks: {
    question_id: string
    question_text: string
    selected_option_id: string | null
    correct_option_id: string | null
    is_correct: boolean
    earned_points: number
    possible_points: number
  }[]
  interaction_feedbacks: {
    question_id: string
    question_text: string
    is_correct: boolean
    earned_points: number
    possible_points: number
    entries: {
      slot_id: string
      submitted_token_id: string | null
      expected_token_id: string
      is_correct: boolean
    }[]
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
  const accessToken = await resolveAccessToken()
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/get-assessment-execution`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      assessment_id: assessmentId,
      access_token: accessToken,
    }),
  })

  const responseText = await response.text()
  let payload:
    | {
      assessment?: Assessment | null
      questions?: StudentAssessmentQuestionWithOptions[]
      caseStudies?: StudentAssessmentCaseStudyWithQuestions[]
      error?: string
    }
    | null = null

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as {
        assessment?: Assessment | null
        questions?: StudentAssessmentQuestionWithOptions[]
        caseStudies?: StudentAssessmentCaseStudyWithQuestions[]
        error?: string
      }
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const fallbackMessage = responseText.trim() || `Falha ao carregar avaliacao (${response.status}).`
    console.error('Falha ao carregar avaliacao para execucao:', {
      assessmentId,
      status: response.status,
      payload,
      responseText,
    })
    throw new Error(payload && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : fallbackMessage)
  }

  return {
    assessment: (payload?.assessment as Assessment | null) ?? null,
    questions: (payload?.questions as StudentAssessmentQuestionWithOptions[]) ?? [],
    caseStudies: (payload?.caseStudies as StudentAssessmentCaseStudyWithQuestions[]) ?? [],
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

export function buildInteractionAnswerPayload(entries: Record<string, string | null>): AssessmentInteractionResponsePayload {
  return {
    entries: Object.entries(entries).map(([slotId, tokenId]) => ({
      slot_id: slotId,
      token_id: tokenId,
    })),
  }
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
