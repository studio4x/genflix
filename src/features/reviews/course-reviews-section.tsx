import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, MessageSquareText, Star, ThumbsDown, ThumbsUp } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  fetchCourseReviews,
  fetchCourseReviewStats,
  submitCourseReview,
  voteReviewHelpful,
  type CourseReview,
  type ReviewStats,
} from './api'

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const iconClassName = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className="flex items-center gap-1" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.round(value)
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            className={cn(
              'text-[#D8E6EB] transition-colors',
              isFilled ? 'text-[#1398B7]' : '',
              readonly ? 'cursor-default' : 'hover:text-[#0A3640]',
            )}
            aria-label={`${star} estrelas`}
          >
            <Star className={cn(iconClassName, isFilled ? 'fill-current' : '')} />
          </button>
        )
      })}
    </div>
  )
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getDistributionValue(stats: ReviewStats, star: 1 | 2 | 3 | 4 | 5) {
  const total = Number(stats.total_reviews || 0)
  const count = Number(stats.rating_distribution[String(star) as keyof ReviewStats['rating_distribution']] ?? 0)

  return {
    count,
    percent: total > 0 ? Math.round((count / total) * 100) : 0,
  }
}

function ReviewCard({
  review,
  onVote,
  isVoting,
}: {
  review: CourseReview
  onVote: (reviewId: string, isHelpful: boolean) => void
  isVoting: boolean
}) {
  return (
    <article className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#E8F6FA] text-sm font-black text-[#0A3640]">
              {(review.author_display_name || 'A')[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-readex text-sm font-semibold text-[#183139]">
                {review.author_display_name || 'Aluno GenFlix'}
              </p>
              <p className="text-xs font-medium text-[#6d7f85]">{formatReviewDate(review.created_at)}</p>
            </div>
          </div>

          {review.is_verified_purchase ? (
            <span className="mt-3 inline-flex items-center gap-1 bg-[#E8F6FA] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A3640]">
              <BadgeCheck className="h-3.5 w-3.5 text-[#1398B7]" />
              Compra verificada
            </span>
          ) : null}
        </div>

        <StarRating value={review.rating} readonly />
      </div>

      <h3 className="mt-4 font-readex text-lg font-semibold text-[#15323b]">{review.title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#5f7077]">{review.content}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isVoting}
          onClick={() => onVote(review.id, true)}
          className="inline-flex items-center gap-2 border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2 text-xs font-black text-[#5F7077] transition-colors hover:border-[#1398B7] hover:text-[#0A3640] disabled:opacity-60"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Útil {review.helpful_count}
        </button>
        <button
          type="button"
          disabled={isVoting}
          onClick={() => onVote(review.id, false)}
          className="inline-flex items-center gap-2 border border-[#D8E6EB] bg-[#F2F7F9] px-3 py-2 text-xs font-black text-[#5F7077] transition-colors hover:border-[#1398B7] hover:text-[#0A3640] disabled:opacity-60"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Não ajudou {review.unhelpful_count}
        </button>
      </div>
    </article>
  )
}

export function CourseReviewsSection({
  courseId,
  courseTitle,
}: {
  courseId?: string
  courseTitle: string
}) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(courseId))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [votingReviewId, setVotingReviewId] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    if (!courseId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [reviewRows, reviewStats] = await Promise.all([
        fetchCourseReviews(courseId),
        fetchCourseReviewStats(courseId),
      ])
      setReviews(reviewRows)
      setStats(reviewStats)
    } catch {
      setReviews([])
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const summary = useMemo(() => {
    if (stats) {
      return stats
    }

    return {
      target_id: courseId ?? '',
      target_type: 'course' as const,
      total_reviews: 0,
      avg_rating: 0,
      rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    }
  }, [courseId, stats])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!courseId) {
      setMessage('Este curso ainda não aceita avaliações.')
      return
    }

    if (!user) {
      setMessage('Entre na sua conta para avaliar este curso.')
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    try {
      await submitCourseReview({
        courseId,
        rating,
        title,
        content,
      })
      setTitle('')
      setContent('')
      setRating(5)
      setMessage('Avaliação publicada com sucesso. Obrigado por contribuir com a comunidade GenFlix.')
      await loadReviews()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar sua avaliação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVote(reviewId: string, isHelpful: boolean) {
    if (!user) {
      setMessage('Entre na sua conta para votar em uma avaliação.')
      return
    }

    setVotingReviewId(reviewId)
    setMessage(null)
    try {
      await voteReviewHelpful(reviewId, isHelpful)
      await loadReviews()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar seu voto.')
    } finally {
      setVotingReviewId(null)
    }
  }

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border border-[#D8E6EB] bg-[#F2F7F9] p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Avaliações</p>
            <h2 className="mt-3 font-readex text-2xl font-semibold tracking-[-0.04em] text-[#183139]">
              O que alunos dizem sobre o curso
            </h2>

            <div className="mt-6 flex items-end gap-3">
              <span className="font-readex text-5xl font-semibold leading-none text-[#0A3640]">
                {Number(summary.avg_rating || 0).toFixed(1)}
              </span>
              <div className="pb-1">
                <StarRating value={Number(summary.avg_rating || 0)} readonly />
                <p className="mt-1 text-xs font-semibold text-[#6d7f85]">
                  {summary.total_reviews} avaliação{summary.total_reviews === 1 ? '' : 'ões'}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const distribution = getDistributionValue(summary, star as 1 | 2 | 3 | 4 | 5)
                return (
                  <div key={star} className="grid grid-cols-[34px_1fr_42px] items-center gap-3 text-xs font-bold text-[#5F7077]">
                    <span>{star}★</span>
                    <div className="h-2 bg-[#D8E6EB]">
                      <div
                        className="h-full bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)]"
                        style={{ width: `${distribution.percent}%` }}
                      />
                    </div>
                    <span className="text-right">{distribution.percent}%</span>
                  </div>
                )
              })}
            </div>
          </aside>

          <div className="space-y-6">
            <form onSubmit={(event) => void handleSubmit(event)} className="border border-[#D8E6EB] bg-[#F2F7F9] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Deixe sua avaliação</p>
                  <h3 className="mt-2 font-readex text-xl font-semibold text-[#183139]">{courseTitle}</h3>
                </div>
                <StarRating value={rating} onChange={setRating} size="lg" />
              </div>

              {!user ? (
                <div className="mt-5 border border-[#D8E6EB] bg-white p-4 text-sm font-semibold text-[#5f7077]">
                  Para avaliar, entre na sua conta GenFlix.
                  <Link to="/login" className="ml-2 font-black text-[#1398B7] underline">
                    Entrar
                  </Link>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={3}
                    maxLength={100}
                    required
                    placeholder="Título da avaliação"
                    className="h-12 border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#183139] outline-none transition-colors focus:border-[#1398B7]"
                  />
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    minLength={3}
                    maxLength={3000}
                    required
                    rows={4}
                    placeholder="Conte como foi sua experiência com este curso..."
                    className="resize-none border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold leading-7 text-[#183139] outline-none transition-colors focus:border-[#1398B7]"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {message ? <p className="text-sm font-semibold text-[#5f7077]">{message}</p> : <span />}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-none bg-[#1398B7] px-5 font-readex text-sm font-medium text-white hover:bg-[#0A3640] disabled:opacity-70"
                    >
                      {isSubmitting ? 'Salvando...' : 'Publicar avaliação'}
                    </Button>
                  </div>
                </div>
              )}
            </form>

            {isLoading ? (
              <div className="border border-[#D8E6EB] bg-white p-6 text-sm font-semibold text-[#6d7f85]">
                Carregando avaliações...
              </div>
            ) : reviews.length === 0 ? (
              <div className="border border-dashed border-[#BEE3EA] bg-white p-8 text-center">
                <MessageSquareText className="mx-auto h-8 w-8 text-[#1398B7]" />
                <h3 className="mt-4 font-readex text-lg font-semibold text-[#183139]">Ainda não há avaliações</h3>
                <p className="mt-2 text-sm leading-7 text-[#6d7f85]">
                  Seja a primeira pessoa a compartilhar uma experiência sobre este curso.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onVote={handleVote}
                    isVoting={votingReviewId === review.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
