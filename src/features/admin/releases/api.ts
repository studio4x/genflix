import { supabase } from '@/services/supabase/client'
import type { Profile } from '@/types/auth'
import type {
  AccessGroup,
  AccessGroupMember,
  CourseRelease,
} from '@/types/content'

import type {
  AccessGroupFormInput,
  GroupReleaseInput,
  UserReleaseInput,
} from './schemas'

export interface CourseReleaseView extends CourseRelease {
  user_label: string | null
  group_label: string | null
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

export async function fetchProfiles() {
  const result = await supabase
    .from('profiles')
    .select('id, email, full_name, timezone, locale')
    .order('email', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data as Profile[]) ?? []
}

export async function fetchAccessGroups() {
  const result = await supabase
    .from('access_groups')
    .select('*')
    .order('name', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data as AccessGroup[]) ?? []
}

export async function createAccessGroup(
  payload: AccessGroupFormInput,
  createdBy: string,
) {
  const result = await supabase
    .from('access_groups')
    .insert({
      name: payload.name,
      description: payload.description?.trim() || null,
      is_active: payload.is_active,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AccessGroup
}

export async function updateAccessGroup(
  groupId: string,
  payload: AccessGroupFormInput,
) {
  const result = await supabase
    .from('access_groups')
    .update({
      name: payload.name,
      description: payload.description?.trim() || null,
      is_active: payload.is_active,
    })
    .eq('id', groupId)
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AccessGroup
}

export async function deleteAccessGroup(groupId: string) {
  const result = await supabase.from('access_groups').delete().eq('id', groupId)
  if (result.error) {
    throw result.error
  }
}

export interface GroupMemberView extends AccessGroupMember {
  profile: Profile | null
}

export async function fetchGroupMembers(groupId: string) {
  const membersResult = await supabase
    .from('access_group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (membersResult.error) {
    throw membersResult.error
  }

  const members = (membersResult.data as AccessGroupMember[]) ?? []
  if (members.length === 0) {
    return [] as GroupMemberView[]
  }

  const userIds = members.map((member) => member.user_id)
  const profilesResult = await supabase
    .from('profiles')
    .select('id, email, full_name, timezone, locale')
    .in('id', userIds)

  if (profilesResult.error) {
    throw profilesResult.error
  }

  const profileMap = new Map(
    ((profilesResult.data as Profile[]) ?? []).map((profile) => [profile.id, profile]),
  )

  return members.map((member) => ({
    ...member,
    profile: profileMap.get(member.user_id) ?? null,
  }))
}

export async function addGroupMember(groupId: string, userId: string) {
  const result = await supabase
    .from('access_group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as AccessGroupMember
}

export async function removeGroupMember(memberId: number) {
  const result = await supabase
    .from('access_group_members')
    .delete()
    .eq('id', memberId)
  if (result.error) {
    throw result.error
  }
}

export async function fetchCourseReleases(courseId: string): Promise<CourseReleaseView[]> {
  const [releaseResult, profilesResult, groupsResult] = await Promise.all([
    supabase
      .from('course_releases')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false }),
    fetchProfiles(),
    fetchAccessGroups(),
  ])

  if (releaseResult.error) {
    throw releaseResult.error
  }

  const profileMap = new Map(
    profilesResult.map((profile) => [profile.id, profile]),
  )
  const groupMap = new Map(groupsResult.map((group) => [group.id, group]))
  const releases = (releaseResult.data as CourseRelease[]) ?? []

  return releases.map((release) => ({
    ...release,
    user_label: release.user_id
      ? profileMap.get(release.user_id)?.email ?? release.user_id
      : null,
    group_label: release.group_id
      ? groupMap.get(release.group_id)?.name ?? release.group_id
      : null,
  }))
}

export async function createUserRelease(
  courseId: string,
  payload: UserReleaseInput,
  createdBy: string,
) {
  const result = await supabase
    .from('course_releases')
    .insert({
      course_id: courseId,
      release_type: 'user',
      user_id: payload.user_id,
      created_by: createdBy,
      is_active: true,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as CourseRelease
}

export async function createGroupRelease(
  courseId: string,
  payload: GroupReleaseInput,
  createdBy: string,
) {
  const result = await supabase
    .from('course_releases')
    .insert({
      course_id: courseId,
      release_type: 'group',
      group_id: payload.group_id,
      created_by: createdBy,
      is_active: true,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }
  return result.data as CourseRelease
}

export async function deleteCourseRelease(releaseId: string) {
  const result = await supabase.from('course_releases').delete().eq('id', releaseId)
  if (result.error) {
    throw result.error
  }
}
