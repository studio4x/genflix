import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, Search, Star, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  fetchAdminCourseReviews,
  moderateCourseReview,
  type AdminCourseReview,
  type ReviewModerationStatus,
} from '@/features/reviews/api'
import { cn } from '@/lib/utils'

const statusLabels: Record<ReviewModerationStatus | 'all', string> = {
  all: 'Todos',
  pending: 'Pendentes',
  approved: 'Aprovadas',
  rejected: 'Rejeitadas',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#1398B7]" aria-label={`${rating} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn('h-4 w-4', star <= rating ? 'fill-current' : 'text-[#D8E6EB]')}
        />
      ))}
    </span>
  )
}

export function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminCourseReview[]>([])
  const [status, setStatus] = useState<ReviewModerationStatus | 'all'>('pending')
  const [rating, setRating] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [moderationReason, setModerationReason] = useState('')
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const rows = await fetchAdminCourseReviews({ status, rating, query })
      setReviews(rows)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar avaliações.')
    } finally {
      setIsLoading(false)
    }
  }, [query, rating, status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReviews()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [loadReviews])

  const counters = useMemo(() => {
    return reviews.reduce(
      (acc, review) => {
        acc.total += 1
        acc[review.moderation_status] += 1
        return acc
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 },
    )
  }, [reviews])

  async function handleModerate(reviewId: string, action: 'approve' | 'reject') {
    setActiveReviewId(reviewId)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await moderateCourseReview(reviewId, action, action === 'reject' ? moderationReason : undefined)
      setModerationReason('')
      setSuccessMessage(action === 'approve' ? 'Avaliação aprovada.' : 'Avaliação rejeitada.')
      await loadReviews()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível moderar a avaliação.')
    } finally {
      setActiveReviewId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Reviews</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Reviews dos cursos</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
            Modere avaliações enviadas por alunos, aprove conteúdos válidos e rejeite reviews fora das diretrizes.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadReviews()}
          disabled={isLoading}
          className="h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading ? 'animate-spin' : '')} />
          Atualizar
        </Button>
      </header>

      {errorMessage ? (
        <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ['Total', counters.total],
          ['Pendentes', counters.pending],
          ['Aprovadas', counters.approved],
          ['Rejeitadas', counters.rejected],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#D8E6EB] bg-white p-4 shadow-[0_12px_28px_rgba(10,54,64,0.04)]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8BA0A7]">{label}</p>
            <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{value}</p>
          </div>
        ))}
      </section>

      <section className="border border-[#D8E6EB] bg-[#F8FBFC] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8BA0A7]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full border border-[#D8E6EB] bg-white pl-10 pr-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
              placeholder="Buscar por curso, autor, título ou conteúdo"
            />
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ReviewModerationStatus | 'all')}
            className="h-12 border border-[#D8E6EB] bg-white px-3 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={rating ?? ''}
            onChange={(event) => setRating(event.target.value ? Number(event.target.value) : null)}
            className="h-12 border border-[#D8E6EB] bg-white px-3 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"
          >
            <option value="">Todas as notas</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>{value} estrelas</option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        {isLoading && reviews.length === 0 ? (
          <div className="border border-[#D8E6EB] bg-white p-6 text-sm font-bold text-[#6d7f84]">
            Carregando avaliações...
          </div>
        ) : reviews.length === 0 ? (
          <div className="border border-dashed border-[#D8E6EB] bg-white p-8 text-center">
            <p className="font-readex text-lg font-semibold text-[#15323b]">Nenhuma avaliação neste recorte</p>
            <p className="mt-2 text-sm font-medium text-[#6d7f84]">Ajuste os filtros ou aguarde novas avaliações.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                        review.moderation_status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : review.moderation_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {statusLabels[review.moderation_status]}
                    </span>
                    {review.is_verified_purchase ? (
                      <span className="bg-[#E8F6FA] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A3640]">
                        Compra verificada
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-[#8BA0A7]">{formatDate(review.created_at)}</span>
                  </div>

                  <h2 className="mt-3 font-readex text-xl font-semibold text-[#15323b]">{review.title}</h2>
                  <p className="mt-1 text-sm font-bold text-[#6d7f84]">
                    {review.course_title || 'Curso não identificado'} · {review.author_display_name || review.author_email || 'Aluno GenFlix'}
                  </p>
                  <div className="mt-3">
                    <RatingStars rating={review.rating} />
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-7 text-[#5f7077]">{review.content}</p>
                  {review.moderation_reason ? (
                    <p className="mt-3 border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                      Motivo da rejeição: {review.moderation_reason}
                    </p>
                  ) : null}
                </div>

                <div className="w-full shrink-0 space-y-3 lg:w-72">
                  <textarea
                    value={moderationReason}
                    onChange={(event) => setModerationReason(event.target.value)}
                    rows={3}
                    maxLength={300}
                    className="w-full resize-none border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                    placeholder="Motivo opcional para rejeição"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleModerate(review.id, 'approve')}
                      disabled={activeReviewId === review.id}
                      className="rounded-none bg-emerald-600 font-black text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleModerate(review.id, 'reject')}
                      disabled={activeReviewId === review.id}
                      variant="destructive"
                      className="rounded-none font-black"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
