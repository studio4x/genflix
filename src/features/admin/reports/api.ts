import { supabase } from '@/services/supabase/client'

export interface CompletionReport {
  student_name: string
  student_email: string
  course_title: string
  is_completed: boolean
  completed_at: string | null
  last_activity: string
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
