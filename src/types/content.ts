export type CourseStatus = 'draft' | 'published' | 'archived'

export interface Course {
  id: string
  title: string
  description: string | null
  status: CourseStatus
  workload_hours: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  description: string | null
  position: number
  is_required: boolean
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  description: string | null
  position: number
  is_required: boolean
  lesson_type: 'video'
  youtube_url: string | null
  estimated_minutes: number
  created_at: string
  updated_at: string
}

export interface LessonMaterial {
  id: string
  lesson_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number
  created_by: string | null
  created_at: string
}

export interface AccessGroup {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AccessGroupMember {
  id: number
  group_id: string
  user_id: string
  created_at: string
}

export interface CourseRelease {
  id: string
  course_id: string
  release_type: 'user' | 'group'
  user_id: string | null
  group_id: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}
