import { supabase } from '@/services/supabase/client'

interface LessonAudioModerationRequestRow {
  id: string
  lesson_id: string
  user_id: string
  status: 'pending' | 'resolved'
  requested_message: string | null
  technical_error: string | null
  admin_response: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

interface LessonRow {
  id: string
  title: string
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
}

export interface LessonAudioModerationRequestAdminItem extends LessonAudioModerationRequestRow {
  lesson_title: string | null
  requester_name: string | null
  requester_email: string | null
}

export async function fetchLessonAudioModerationRequests(input?: {
  lessonId?: string
  status?: 'pending' | 'resolved'
}) {
  let query = supabase
    .from('lesson_audio_moderation_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (input?.lessonId) {
    query = query.eq('lesson_id', input.lessonId)
  }

  if (input?.status) {
    query = query.eq('status', input.status)
  }

  const requestsResult = await query

  if (requestsResult.error) {
    throw requestsResult.error
  }

  const requests = (requestsResult.data as LessonAudioModerationRequestRow[]) ?? []
  if (requests.length === 0) {
    return [] as LessonAudioModerationRequestAdminItem[]
  }

  const lessonIds = Array.from(new Set(requests.map((request) => request.lesson_id)))
  const userIds = Array.from(new Set(requests.map((request) => request.user_id)))

  const [lessonsResult, profilesResult] = await Promise.all([
    supabase.from('lessons').select('id, title').in('id', lessonIds),
    supabase.from('profiles').select('id, full_name, email').in('id', userIds),
  ])

  if (lessonsResult.error) {
    throw lessonsResult.error
  }

  if (profilesResult.error) {
    throw profilesResult.error
  }

  const lessons = (lessonsResult.data as LessonRow[]) ?? []
  const profiles = (profilesResult.data as ProfileRow[]) ?? []

  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))

  return requests.map((request) => {
    const lesson = lessonMap.get(request.lesson_id)
    const profile = profileMap.get(request.user_id)

    return {
      ...request,
      lesson_title: lesson?.title ?? null,
      requester_name: profile?.full_name ?? null,
      requester_email: profile?.email ?? null,
    } satisfies LessonAudioModerationRequestAdminItem
  })
}

export async function resolveLessonAudioModerationRequest(input: {
  requestId: string
  adminResponse?: string
  resolvedBy: string
}) {
  const result = await supabase
    .from('lesson_audio_moderation_requests')
    .update({
      status: 'resolved',
      admin_response: input.adminResponse?.trim() ? input.adminResponse.trim().slice(0, 1000) : null,
      resolved_at: new Date().toISOString(),
      resolved_by: input.resolvedBy,
    })
    .eq('id', input.requestId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as LessonAudioModerationRequestRow
}
