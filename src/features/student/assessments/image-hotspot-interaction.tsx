import { useMemo, useState } from 'react'
import { Check, Star, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ImageHotspotInteractionContent, ImageHotspotResponsePayload } from '@/types/content'

interface ImageHotspotInteractionProps {
  content: ImageHotspotInteractionContent
  value: ImageHotspotResponsePayload
  onChange: (payload: ImageHotspotResponsePayload) => void
  readOnly?: boolean
}

type FeedbackTone = 'neutral' | 'success' | 'error'

function getDefaultFeedbackTone(isCorrect: boolean) {
  return isCorrect ? 'success' : 'error'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function ImageHotspotInteraction({
  content,
  value,
  onChange,
  readOnly = false,
}: ImageHotspotInteractionProps) {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('neutral')
  const [feedbackTargetId, setFeedbackTargetId] = useState<string | null>(null)

  const stageUrl = content.asset.signed_url || content.asset.storage_path
  const correctTargetIds = useMemo(
    () => content.targets.filter((target) => target.is_correct).map((target) => target.id),
    [content.targets],
  )
  const foundTargetIds = new Set(value.found_target_ids)
  const incorrectTargetIds = new Set(value.incorrect_target_ids)
  const isSingleAttemptLocked = content.mode === 'single_attempt'
    && Boolean(value.selected_target_id || value.outside_click_count > 0)
  const correctCount = correctTargetIds.length
  const foundCount = value.found_target_ids.filter((targetId) => correctTargetIds.includes(targetId)).length
  const activeFeedbackTarget = feedbackTargetId
    ? content.targets.find((target) => target.id === feedbackTargetId) ?? null
    : null
  const popupPlacement = activeFeedbackTarget
    ? (() => {
      const centerX = activeFeedbackTarget.x + (activeFeedbackTarget.w / 2)
      const centerY = activeFeedbackTarget.y + (activeFeedbackTarget.h / 2)
      const placeLeft = centerX > 56
      return {
        left: placeLeft
          ? clamp(activeFeedbackTarget.x - 1, 12, 94)
          : clamp(activeFeedbackTarget.x + activeFeedbackTarget.w + 2, 6, 88),
        top: clamp(centerY, 18, 82),
        placeLeft,
      }
    })()
    : null

  function emitFeedback(message: string | null, tone: FeedbackTone, targetId: string | null = null) {
    setFeedbackMessage(message)
    setFeedbackTone(tone)
    setFeedbackTargetId(targetId)
  }

  function handleRetry() {
    if (readOnly) {
      return
    }

    emitFeedback(null, 'neutral')
    onChange({
      kind: 'image_hotspot',
      mode: content.mode,
      selected_target_id: null,
      found_target_ids: [],
      incorrect_target_ids: [],
      outside_click_count: 0,
    })
  }

  function handleOutsideClick() {
    if (readOnly || isSingleAttemptLocked) {
      return
    }

    const nextPayload: ImageHotspotResponsePayload = content.mode === 'single_attempt'
      ? {
        kind: 'image_hotspot',
        mode: content.mode,
        selected_target_id: null,
        found_target_ids: [],
        incorrect_target_ids: [],
        outside_click_count: 1,
      }
      : {
        ...value,
        outside_click_count: value.outside_click_count + 1,
        selected_target_id: null,
      }

    emitFeedback(
      content.outside_click_feedback?.trim() || 'Nenhum hotspot valido foi encontrado nesse clique.',
      'error',
      null,
    )
    onChange(nextPayload)
  }

  function handleTargetClick(targetId: string) {
    if (readOnly || isSingleAttemptLocked) {
      return
    }

    const target = content.targets.find((item) => item.id === targetId)
    if (!target) {
      return
    }

    if (content.mode === 'find_all' && target.is_correct && foundTargetIds.has(target.id)) {
      emitFeedback(target.feedback_text?.trim() || 'Esse hotspot correto ja foi encontrado.', 'success', target.id)
      return
    }

    const isCorrect = target.is_correct
    const nextPayload: ImageHotspotResponsePayload = content.mode === 'single_attempt'
      ? {
        kind: 'image_hotspot',
        mode: content.mode,
        selected_target_id: target.id,
        found_target_ids: isCorrect ? [target.id] : [],
        incorrect_target_ids: isCorrect ? [] : [target.id],
        outside_click_count: 0,
      }
      : {
        ...value,
        selected_target_id: target.id,
        found_target_ids: isCorrect
          ? Array.from(new Set([...value.found_target_ids, target.id]))
          : value.found_target_ids,
        incorrect_target_ids: isCorrect
          ? value.incorrect_target_ids
          : Array.from(new Set([...value.incorrect_target_ids, target.id])),
      }

    emitFeedback(
      target.feedback_text?.trim() || (isCorrect ? 'Correto!' : 'Esse hotspot nao e o esperado.'),
      getDefaultFeedbackTone(isCorrect),
      target.id,
    )
    onChange(nextPayload)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <div className="self-start rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30 xl:sticky xl:top-6">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Modo</p>
          <p className="mt-2 text-lg font-black text-slate-900">
            {content.mode === 'single_attempt' ? 'Clique unico' : 'Encontrar todos'}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{content.instruction}</p>
        </div>

        <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Progresso</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {content.mode === 'single_attempt'
                  ? 'A questao encerra no primeiro clique valido.'
                  : 'Continue clicando ate encontrar todos os hotspots corretos.'}
              </p>
            </div>
            <span className="text-lg font-black text-cyan-700">
              {content.mode === 'single_attempt' ? (isSingleAttemptLocked ? '1/1' : '0/1') : `${foundCount}/${correctCount}`}
            </span>
          </div>

          <div className="mt-4 h-2 rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-cyan-500 transition-all"
              style={{
                width: `${content.mode === 'single_attempt'
                  ? (isSingleAttemptLocked ? 100 : 0)
                  : (correctCount ? (foundCount / correctCount) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Hotspots corretos</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {correctCount} area(s) configurada(s) como correta(s).
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
              {content.targets.length} total
            </span>
          </div>

          {content.mode === 'single_attempt' && !readOnly && isSingleAttemptLocked ? (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[36px] border border-slate-200 bg-[#fcfdff] shadow-inner">
        <div className="border-b border-slate-200 bg-white/80 px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Quiz de Hotspot</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Clique na imagem para interagir com os hotspots configurados.
          </p>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <div
            className="relative mx-auto overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg"
            style={{ aspectRatio: `${content.asset.width} / ${content.asset.height}` }}
            onClick={handleOutsideClick}
          >
            {stageUrl ? (
              <img
                src={stageUrl}
                alt={content.asset.alt}
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-8 text-center text-sm font-semibold text-slate-500">
                A imagem desta questao ainda nao foi configurada.
              </div>
            )}

            {content.targets.map((target) => {
              const isCorrectFound = foundTargetIds.has(target.id)
              const isIncorrectMarked = incorrectTargetIds.has(target.id)
              const isHighlighted = isCorrectFound || isIncorrectMarked || value.selected_target_id === target.id

              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleTargetClick(target.id)
                  }}
                  className={cn(
                    'absolute cursor-pointer rounded-[18px] border-2 outline-none transition-all',
                    isCorrectFound
                      ? 'border-emerald-500 bg-emerald-400/22'
                      : isIncorrectMarked
                        ? 'border-rose-500 bg-rose-400/18'
                        : 'border-transparent bg-transparent focus-visible:border-cyan-300/70 focus-visible:bg-cyan-300/8',
                    isHighlighted ? 'shadow-[0_0_0_4px_rgba(34,211,238,0.18)]' : 'shadow-none',
                  )}
                  style={{
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    width: `${target.w}%`,
                    height: `${target.h}%`,
                  }}
                  aria-label={target.label?.trim() || 'Hotspot'}
                >
                  {isCorrectFound ? (
                    <span className="absolute -top-3 right-2 inline-flex size-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                      <Check className="size-4" />
                    </span>
                  ) : isIncorrectMarked ? (
                    <span className="absolute -top-3 right-2 inline-flex size-7 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-lg shadow-rose-500/30">
                      <X className="size-4" />
                    </span>
                  ) : null}
                </button>
              )
            })}

            {content.show_feedback_as_popup && feedbackMessage ? (
              feedbackTone === 'success' && popupPlacement && activeFeedbackTarget ? (
                <div
                  className="absolute z-20"
                  style={{
                    left: `${popupPlacement.left}%`,
                    top: `${popupPlacement.top}%`,
                    transform: popupPlacement.placeLeft ? 'translate(-100%, -50%)' : 'translateY(-50%)',
                  }}
                >
                  <div className={cn(
                    'mb-3 flex',
                    popupPlacement.placeLeft ? 'justify-end pr-4' : 'justify-start pl-4',
                  )}>
                    <div className="inline-flex size-10 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-xl shadow-emerald-500/35">
                      <Check className="size-5" />
                    </div>
                  </div>

                  <div className="w-[320px] max-w-[calc(100vw-4rem)] rounded-[26px] border border-slate-200 bg-white px-5 py-4 shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 text-[15px] font-black leading-7 text-[#2b74dc]">
                        {feedbackMessage}
                      </div>
                      <button
                        type="button"
                        onClick={() => emitFeedback(null, 'neutral', null)}
                        className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Fechar feedback"
                      >
                        <X className="size-5" />
                      </button>
                    </div>

                    <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 shadow-inner">
                      <div className="h-4 w-20 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${content.mode === 'single_attempt'
                              ? 100
                              : (correctCount ? (foundCount / correctCount) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="inline-flex size-9 items-center justify-center rounded-full bg-[#fff4c2] text-amber-500 shadow-sm">
                        <Star className="size-5 fill-current" />
                      </div>
                      <span className="text-2xl font-black text-slate-700">
                        {content.mode === 'single_attempt' ? '1/1' : `${foundCount}/${correctCount}`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-x-6 top-6 z-20 flex justify-center">
                  <div className={cn(
                    'max-w-xl rounded-2xl border px-5 py-4 text-center text-sm font-semibold shadow-xl',
                    feedbackTone === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-slate-200 bg-white text-slate-700',
                  )}>
                    {feedbackMessage}
                  </div>
                </div>
              )
            ) : null}
          </div>

          {!content.show_feedback_as_popup && feedbackMessage ? (
            <div className={cn(
              'mt-5 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-sm',
              feedbackTone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : feedbackTone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700',
            )}>
              {feedbackMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
