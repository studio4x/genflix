export type CourseStatus = 'draft' | 'published' | 'archived'
export type AssessmentType = 'module' | 'final'
export type AssessmentGradingMode = 'partial_by_item' | 'all_or_nothing'
export type AssessmentQuestionType =
  | 'single_choice'
  | 'essay_ai'
  | 'case_study_ai'
  | 'case_study_single_choice'
  | 'drag_drop_labeling'
  | 'fill_in_the_blanks'

export interface AssessmentInteractionToken {
  id: string
  label: string
}

export interface AssessmentInteractionAsset {
  storage_path: string
  signed_url?: string | null
  alt: string
  width: number
  height: number
}

export interface DragDropLabelingTarget {
  id: string
  x: number
  y: number
  w: number
  h: number
  label?: string | null
}

export interface DragDropLabelingInteractionContent {
  kind: 'drag_drop_labeling'
  instruction: string
  asset: AssessmentInteractionAsset
  tokens: AssessmentInteractionToken[]
  targets: DragDropLabelingTarget[]
}

export type FillInTheBlanksSegment =
  | {
    type: 'text'
    text: string
  }
  | {
    type: 'blank'
    id: string
    placeholder?: string | null
  }

export interface FillInTheBlanksEditorBlank {
  blank_id: string
  token_id: string
  placeholder?: string | null
  answer_text: string
  trailing_text: string
}

export interface FillInTheBlanksEditorGroup {
  id: string
  leading_text: string
  blanks: FillInTheBlanksEditorBlank[]
  extra_tokens?: AssessmentInteractionToken[] | null
}

export interface FillInTheBlanksInteractionContent {
  kind: 'fill_in_the_blanks'
  instruction: string
  segments: FillInTheBlanksSegment[]
  tokens: AssessmentInteractionToken[]
  editor_groups?: FillInTheBlanksEditorGroup[] | null
}

export type AssessmentInteractionContent =
  | DragDropLabelingInteractionContent
  | FillInTheBlanksInteractionContent

export interface AssessmentQuestionAnswerKeyEntry {
  slot_id: string
  token_id: string
}

export interface AssessmentQuestionAnswerKeyPayload {
  entries: AssessmentQuestionAnswerKeyEntry[]
}

export interface AssessmentQuestionInteraction {
  question_id: string
  content: AssessmentInteractionContent
  version: number
  created_at: string
  updated_at: string
}

export interface AssessmentQuestionAnswerKey {
  question_id: string
  grading_mode: AssessmentGradingMode
  answer_key: AssessmentQuestionAnswerKeyPayload
  created_at: string
  updated_at: string
}

export interface AssessmentInteractionResponseEntry {
  slot_id: string
  token_id: string | null
}

export interface AssessmentInteractionResponsePayload {
  entries: AssessmentInteractionResponseEntry[]
}

export interface Course {
  id: string
  title: string
  description: string | null
  status: CourseStatus
  display_order: number
  thumbnail_url: string | null
  workload_minutes: number
  has_linear_progression: boolean
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
  lesson_type: 'video' | 'text' | 'hybrid'
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
  estimated_minutes: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssessmentQuestion {
  id: string
  assessment_id: string
  question_text: string
  question_type: AssessmentQuestionType
  essay_expected_answer: string | null
  case_study_id: string | null
  case_question_position: number | null
  position: number
  is_required: boolean
  points: number
  created_at: string
  updated_at: string
}

export interface AssessmentQuestionWithInteraction extends AssessmentQuestion {
  interaction: AssessmentQuestionInteraction | null
  answer_key: AssessmentQuestionAnswerKey | null
}

export interface AssessmentCaseStudy {
  id: string
  assessment_id: string
  title: string | null
  case_text: string
  position: number
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
  earned_points: number
  possible_points: number
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
  answer_text: string | null
  response_payload: AssessmentInteractionResponsePayload | null
  earned_points: number
  is_correct: boolean
  ai_feedback: string | null
  ai_evaluation: Record<string, unknown> | null
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
  lesson_type: 'video' | 'text' | 'hybrid'
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
