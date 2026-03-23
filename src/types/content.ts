export type CourseStatus = 'draft' | 'published' | 'archived'
export type AssessmentType = 'module' | 'final'

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
  lesson_type: 'video' | 'text'
  youtube_url: string | null
  text_content: string | null
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

export interface Assessment {
  id: string
  course_id: string
  module_id: string | null
  assessment_type: AssessmentType
  title: string
  description: string | null
  is_required: boolean
  passing_score: number
  max_attempts: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssessmentQuestion {
  id: string
  assessment_id: string
  question_text: string
  question_type: 'single_choice'
  position: number
  is_required: boolean
  points: number
  created_at: string
  updated_at: string
}

export interface AssessmentOption {
  id: string
  question_id: string
  option_text: string
  position: number
  is_correct: boolean
  created_at: string
}

export interface AssessmentAttempt {
  id: string
  assessment_id: string
  user_id: string
  attempt_number: number
  status: 'submitted'
  score_percent: number
  correct_answers: number
  total_questions: number
  is_approved: boolean
  started_at: string
  submitted_at: string
  created_at: string
}

export interface AssessmentAnswer {
  id: string
  attempt_id: string
  question_id: string
  selected_option_id: string | null
  is_correct: boolean
  created_at: string
}

export interface CourseProgress {
  id: number
  user_id: string
  course_id: string
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ModuleLearningState = 'blocked' | 'in_progress' | 'completed'

export interface StudentLessonWithProgress {
  id: string
  module_id: string
  position: number
  title: string
  description: string | null
  is_required: boolean
  lesson_type: 'video' | 'text'
  youtube_url: string | null
  text_content: string | null
  estimated_minutes: number
  is_completed: boolean
  completed_at: string | null
}

export interface StudentCourseModuleProgress {
  id: string
  course_id: string
  position: number
  title: string
  description: string | null
  is_required: boolean
  state: ModuleLearningState
  is_unlocked: boolean
  is_completed: boolean
  required_lessons_total: number
  required_lessons_completed: number
  has_required_assessment: boolean
  required_assessment_approved: boolean
  progress_percent: number
  lessons: StudentLessonWithProgress[]
}
