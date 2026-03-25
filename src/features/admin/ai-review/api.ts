import { supabase } from '@/services/supabase/client'

import type { ImportModuleData } from '@/features/admin/content/api'

export interface CourseAiReviewStandards {
  course_id: string
  ideal_course_structure: string | null
  required_elements: string | null
  bibliography_rules: string | null
  table_formatting_rules: string | null
  additional_review_rules: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface CourseAiReviewStandardsInput {
  ideal_course_structure: string
  required_elements: string
  bibliography_rules: string
  table_formatting_rules: string
  additional_review_rules: string
}

export interface ModuleAiReviewIssue {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'structure' | 'lesson' | 'assessment' | 'bibliography' | 'table' | 'formatting' | 'consistency'
  location: string
  title: string
  current_state: string
  recommended_fix: string
  suggested_result: string
}

export interface ModuleAiReviewResult {
  summary: string
  quality_score: number
  ready_to_publish: boolean
  issues: ModuleAiReviewIssue[]
  corrected_module: ImportModuleData | null
}

export async function fetchCourseAiReviewStandards(courseId: string) {
  const result = await supabase
    .from('course_ai_review_standards')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle()

  if (result.error) {
    throw result.error
  }

  return (result.data as CourseAiReviewStandards | null) ?? null
}

export async function upsertCourseAiReviewStandards(
  courseId: string,
  input: CourseAiReviewStandardsInput,
  userId: string,
) {
  const result = await supabase
    .from('course_ai_review_standards')
    .upsert({
      course_id: courseId,
      ideal_course_structure: input.ideal_course_structure.trim() || null,
      required_elements: input.required_elements.trim() || null,
      bibliography_rules: input.bibliography_rules.trim() || null,
      table_formatting_rules: input.table_formatting_rules.trim() || null,
      additional_review_rules: input.additional_review_rules.trim() || null,
      updated_by: userId,
    })
    .select('*')
    .single()

  if (result.error) {
    throw result.error
  }

  return result.data as CourseAiReviewStandards
}

export async function analyzeModuleWithAi(input: {
  courseId: string
  moduleId: string
}) {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente para usar a analise com IA.')
  }

  const result = await supabase.functions.invoke('analyze-course-module', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      courseId: input.courseId,
      moduleId: input.moduleId,
    },
  })

  if (result.error) {
    throw result.error
  }

  return result.data as ModuleAiReviewResult
}
