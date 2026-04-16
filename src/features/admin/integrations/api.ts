import { supabase } from '@/services/supabase/client'
import type { ExternalCourseMapping, CourseRelease } from '@/types/content'

export type IntegrationDirection = 'inbound' | 'outbound' | 'internal'
export type IntegrationLogStatus = 'received' | 'processed' | 'failed' | 'ignored'
export type IntegrationOutboxStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter'

export interface IntegrationLogRecord {
  id: number
  source_system: string
  direction: IntegrationDirection
  event_type: string
  request_id: string | null
  correlation_id: string | null
  user_id: string | null
  course_id: string | null
  external_user_id: string | null
  external_course_id: string | null
  http_status: number | null
  status: IntegrationLogStatus
  payload: Record<string, unknown>
  response_payload: Record<string, unknown> | null
  error_message: string | null
  created_at: string
}

export interface IntegrationOutboxRecord {
  id: string
  source_system: string
  event_type: string
  user_id: string
  course_id: string
  payload: Record<string, unknown>
  delivery_status: IntegrationOutboxStatus
  attempt_count: number
  next_attempt_at: string
  last_attempt_at: string | null
  delivered_at: string | null
  last_error: string | null
  created_at: string
}

export interface IntegrationLogView extends IntegrationLogRecord {
  course_title: string | null
  user_label: string | null
}

export interface IntegrationOutboxView extends IntegrationOutboxRecord {
  course_title: string | null
  user_label: string | null
}

export interface IntegrationManagedReleaseView extends CourseRelease {
  user_label: string | null
  group_label: string | null
}

export interface IntegrationDashboardSnapshot {
  mapping_count: number
  failed_logs_count: number
  pending_outbox_count: number
  processed_logs_count: number
  logs: IntegrationLogView[]
  outbox: IntegrationOutboxView[]
}

export interface CourseIntegrationSnapshot {
  mapping: ExternalCourseMapping | null
  releases: IntegrationManagedReleaseView[]
  logs: IntegrationLogView[]
  outbox: IntegrationOutboxView[]
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

async function fetchCourseTitles(courseIds: string[]) {
  if (courseIds.length === 0) {
    return new Map<string, string>()
  }

  const result = await supabase
    .from('courses')
    .select('id, title')
    .in('id', courseIds)

  if (result.error) {
    throw result.error
  }

  return new Map(((result.data as { id: string; title: string }[]) ?? []).map((course) => [course.id, course.title]))
}

async function fetchUserLabels(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, string>()
  }

  const result = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  if (result.error) {
    throw result.error
  }

  return new Map(
    ((result.data as { id: string; email: string | null; full_name: string | null }[]) ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() || profile.email || profile.id,
    ]),
  )
}

async function fetchGroupLabels(groupIds: string[]) {
  if (groupIds.length === 0) {
    return new Map<string, string>()
  }

  const result = await supabase
    .from('access_groups')
    .select('id, name')
    .in('id', groupIds)

  if (result.error) {
    throw result.error
  }

  return new Map(((result.data as { id: string; name: string }[]) ?? []).map((group) => [group.id, group.name]))
}

async function enrichLogs(logs: IntegrationLogRecord[]): Promise<IntegrationLogView[]> {
  const courseIds = Array.from(new Set(logs.map((log) => log.course_id).filter(Boolean) as string[]))
  const userIds = Array.from(new Set(logs.map((log) => log.user_id).filter(Boolean) as string[]))
  const [courseTitles, userLabels] = await Promise.all([
    fetchCourseTitles(courseIds),
    fetchUserLabels(userIds),
  ])

  return logs.map((log) => ({
    ...log,
    course_title: log.course_id ? courseTitles.get(log.course_id) ?? null : null,
    user_label: log.user_id ? userLabels.get(log.user_id) ?? null : null,
  }))
}

async function enrichOutbox(outbox: IntegrationOutboxRecord[]): Promise<IntegrationOutboxView[]> {
  const courseIds = Array.from(new Set(outbox.map((item) => item.course_id)))
  const userIds = Array.from(new Set(outbox.map((item) => item.user_id)))
  const [courseTitles, userLabels] = await Promise.all([
    fetchCourseTitles(courseIds),
    fetchUserLabels(userIds),
  ])

  return outbox.map((item) => ({
    ...item,
    course_title: courseTitles.get(item.course_id) ?? null,
    user_label: userLabels.get(item.user_id) ?? null,
  }))
}

async function enrichReleases(releases: CourseRelease[]): Promise<IntegrationManagedReleaseView[]> {
  const userIds = Array.from(new Set(releases.map((release) => release.user_id).filter(Boolean) as string[]))
  const groupIds = Array.from(new Set(releases.map((release) => release.group_id).filter(Boolean) as string[]))
  const [userLabels, groupLabels] = await Promise.all([
    fetchUserLabels(userIds),
    fetchGroupLabels(groupIds),
  ])

  return releases.map((release) => ({
    ...release,
    user_label: release.user_id ? userLabels.get(release.user_id) ?? release.user_id : null,
    group_label: release.group_id ? groupLabels.get(release.group_id) ?? release.group_id : null,
  }))
}

export async function fetchIntegrationDashboardSnapshot(): Promise<IntegrationDashboardSnapshot> {
  const [mappingCountResult, failedLogsCountResult, processedLogsCountResult, pendingOutboxCountResult, logsResult, outboxResult] =
    await Promise.all([
      supabase
        .from('external_course_mappings')
        .select('id', { count: 'exact', head: true })
        .eq('source_system', 'genflix')
        .eq('is_active', true),
      supabase
        .from('integration_logs')
        .select('id', { count: 'exact', head: true })
        .eq('source_system', 'genflix')
        .eq('status', 'failed'),
      supabase
        .from('integration_logs')
        .select('id', { count: 'exact', head: true })
        .eq('source_system', 'genflix')
        .eq('status', 'processed'),
      supabase
        .from('integration_event_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('source_system', 'genflix')
        .in('delivery_status', ['pending', 'processing', 'failed', 'dead_letter']),
      supabase
        .from('integration_logs')
        .select('*')
        .eq('source_system', 'genflix')
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('integration_event_outbox')
        .select('*')
        .eq('source_system', 'genflix')
        .order('created_at', { ascending: false })
        .limit(24),
    ])

  if (mappingCountResult.error) throw mappingCountResult.error
  if (failedLogsCountResult.error) throw failedLogsCountResult.error
  if (processedLogsCountResult.error) throw processedLogsCountResult.error
  if (pendingOutboxCountResult.error) throw pendingOutboxCountResult.error
  if (logsResult.error) throw logsResult.error
  if (outboxResult.error) throw outboxResult.error

  const logs = await enrichLogs((logsResult.data as IntegrationLogRecord[]) ?? [])
  const outbox = await enrichOutbox((outboxResult.data as IntegrationOutboxRecord[]) ?? [])

  return {
    mapping_count: mappingCountResult.count ?? 0,
    failed_logs_count: failedLogsCountResult.count ?? 0,
    pending_outbox_count: pendingOutboxCountResult.count ?? 0,
    processed_logs_count: processedLogsCountResult.count ?? 0,
    logs,
    outbox,
  }
}

export async function fetchCourseIntegrationSnapshot(courseId: string): Promise<CourseIntegrationSnapshot> {
  const [mappingResult, releasesResult, logsResult, outboxResult] = await Promise.all([
    supabase
      .from('external_course_mappings')
      .select('*')
      .eq('course_id', courseId)
      .eq('source_system', 'genflix')
      .maybeSingle(),
    supabase
      .from('course_releases')
      .select('*')
      .eq('course_id', courseId)
      .eq('managed_by_integration', true)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('integration_logs')
      .select('*')
      .eq('course_id', courseId)
      .eq('source_system', 'genflix')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('integration_event_outbox')
      .select('*')
      .eq('course_id', courseId)
      .eq('source_system', 'genflix')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (mappingResult.error) throw mappingResult.error
  if (releasesResult.error) throw releasesResult.error
  if (logsResult.error) throw logsResult.error
  if (outboxResult.error) throw outboxResult.error

  const [releases, logs, outbox] = await Promise.all([
    enrichReleases((releasesResult.data as CourseRelease[]) ?? []),
    enrichLogs((logsResult.data as IntegrationLogRecord[]) ?? []),
    enrichOutbox((outboxResult.data as IntegrationOutboxRecord[]) ?? []),
  ])

  return {
    mapping: (mappingResult.data as ExternalCourseMapping | null) ?? null,
    releases,
    logs,
    outbox,
  }
}
