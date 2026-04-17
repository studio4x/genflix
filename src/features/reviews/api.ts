import { supabase } from '@/services/supabase/client'

export interface CourseReview {
  id: string
  author_id: string
  author_display_name: string | null
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  helpful_count: number
  unhelpful_count: number
  created_at: string
  updated_at: string
}

export interface ReviewStats {
  target_id: string
  target_type: 'course'
  total_reviews: number
  avg_rating: number
  rating_distribution: Record<'1' | '2' | '3' | '4' | '5', number>
}

export interface SubmitCourseReviewInput {
  courseId: string
  rating: number
  title: string
  content: string
}

const emptyDistribution: ReviewStats['rating_distribution'] = {
  '1': 0,
  '2': 0,
  '3': 0,
  '4': 0,
  '5': 0,
}

export async function fetchCourseReviews(courseId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, author_id, author_display_name, rating, title, content, is_verified_purchase, helpful_count, unhelpful_count, created_at, updated_at')
    .eq('target_type', 'course')
    .eq('target_resource_id', courseId)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('is_verified_purchase', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw error
  }

  return (data ?? []) as CourseReview[]
}

export async function fetchCourseReviewStats(courseId: string) {
  const { data, error } = await supabase
    .from('review_stats')
    .select('target_id, target_type, total_reviews, avg_rating, rating_distribution')
    .eq('target_type', 'course')
    .eq('target_id', courseId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as ReviewStats | null) ?? {
    target_id: courseId,
    target_type: 'course',
    total_reviews: 0,
    avg_rating: 0,
    rating_distribution: emptyDistribution,
  }
}

export async function submitCourseReview(input: SubmitCourseReviewInput) {
  const { data, error } = await supabase.rpc('submit_course_review', {
    _course_id: input.courseId,
    _rating: input.rating,
    _title: input.title,
    _content: input.content,
  })

  if (error) {
    throw error
  }

  return data as CourseReview
}

export async function voteReviewHelpful(reviewId: string, isHelpful: boolean) {
  const { error } = await supabase.rpc('vote_review_helpful', {
    _review_id: reviewId,
    _is_helpful: isHelpful,
  })

  if (error) {
    throw error
  }
}
