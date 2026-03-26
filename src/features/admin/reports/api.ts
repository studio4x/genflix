import { supabase } from '@/services/supabase/client'
import {
  fetchLessonAudioModerationRequests,
  resolveLessonAudioModerationRequest,
  type LessonAudioModerationRequestAdminItem,
} from '@/features/admin/lesson-audio/api'

export interface CompletionReport {
  student_name: string
  student_email: string
  course_title: string
  is_completed: boolean
  completed_at: string | null
  last_activity: string
}

export interface AssessmentAttemptRequestReportItem {
  request_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_message: string | null
  admin_response: string | null
  requested_at: string
  reviewed_at: string | null
  student_id: string
  student_email: string
  student_name: string | null
  assessment_id: string
  assessment_title: string
  assessment_type: 'module' | 'final'
  course_id: string
  course_title: string
  module_id: string | null
  module_title: string | null
  base_max_attempts: number
  total_extra_attempts: number
  effective_max_attempts: number
  attempts_used: number
  last_score: number | null
}

export async function fetchCompletionReport(filters: {
  courseId?: string
  studentId?: string
}) {
  const { data, error } = await supabase.rpc('get_reports_completion', {
    _course_id: filters.courseId || null,
    _user_id: filters.studentId || null,
  })

  if (error) throw error
  return data as CompletionReport[]
}

export async function fetchAssessmentAttemptRequests(status?: AssessmentAttemptRequestReportItem['status']) {
  const { data, error } = await supabase.rpc('get_assessment_attempt_requests', {
    _status: status ?? null,
  })

  if (error) throw error
  return (data as AssessmentAttemptRequestReportItem[]) ?? []
}

export async function reviewAssessmentAttemptRequest(input: {
  requestId: string
  decision: 'approved' | 'rejected'
  extraAttempts?: number
  adminResponse?: string
}) {
  const { data, error } = await supabase.rpc('admin_review_assessment_attempt_request', {
    _request_id: input.requestId,
    _decision: input.decision,
    _extra_attempts: input.extraAttempts ?? 1,
    _admin_response: input.adminResponse?.trim() ? input.adminResponse.trim() : null,
  })

  if (error) throw error
  return (data?.[0] as {
    request_id: string
    status: 'approved' | 'rejected'
    total_extra_attempts: number
  } | undefined) ?? null
}

export type { LessonAudioModerationRequestAdminItem }

export async function fetchLessonAudioModerationRequestsReport(status?: 'pending' | 'resolved') {
  return await fetchLessonAudioModerationRequests({
    status,
  })
}

export async function resolveLessonAudioModerationRequestReport(input: {
  requestId: string
  adminResponse?: string
  resolvedBy: string
}) {
  return await resolveLessonAudioModerationRequest(input)
}
