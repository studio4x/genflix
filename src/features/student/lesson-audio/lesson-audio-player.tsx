import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import {
  fetchOwnLessonAudioModerationRequest,
  prepareLessonNarration,
  requestLessonAudioModeration,
  type LessonAudioModerationRequest,
  type LessonNarrationPayload,
} from './api'

interface LessonAudioPlayerProps {
  lessonId: string
  isAdmin?: boolean
}

export function LessonAudioPlayer({ lessonId, isAdmin = false }: LessonAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [narration, setNarration] = useState<LessonNarrationPayload | null>(null)
  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  const [isLoadingNarration, setIsLoadingNarration] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isRequestingModeration, setIsRequestingModeration] = useState(false)
  const [moderationRequest, setModerationRequest] = useState<LessonAudioModerationRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [technicalErrorMessage, setTechnicalErrorMessage] = useState<string | null>(null)
  const [shouldAutoPlayNext, setShouldAutoPlayNext] = useState(false)

  const currentPart = useMemo(() => {
    return narration?.parts[currentPartIndex] ?? null
  }, [currentPartIndex, narration])

  useEffect(() => {
    setNarration(null)
    setCurrentPartIndex(0)
    setError(null)
    setTechnicalErrorMessage(null)
    setShouldAutoPlayNext(false)
  }, [lessonId])

  useEffect(() => {
    async function loadInitialNarrationState() {
      setIsLoadingNarration(true)
      try {
        const [existingRequest, existingNarration] = await Promise.all([
          fetchOwnLessonAudioModerationRequest(lessonId),
          prepareLessonNarration(lessonId, 'read').catch((loadError) => {
            const message = loadError instanceof Error ? loadError.message : ''
            if (message === 'NARRATION_NOT_READY') {
              return null
            }
            throw loadError
          }),
        ])

        setModerationRequest(existingRequest)
        if (existingNarration) {
          setNarration(existingNarration)
          setCurrentPartIndex(0)
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar a narração da aula.'
        if (isAdmin) {
          setError(message)
        } else {
          setError('Não foi possível carregar a narração desta aula no momento.')
          setTechnicalErrorMessage(message)
        }
      } finally {
        setIsLoadingNarration(false)
      }
    }

    void loadInitialNarrationState()
  }, [isAdmin, lessonId])

  useEffect(() => {
    if (!shouldAutoPlayNext || !audioRef.current) {
      return
    }

    const player = audioRef.current
    void player.play().catch(() => null)
    setShouldAutoPlayNext(false)
  }, [currentPart, shouldAutoPlayNext])

  async function handlePrepareNarration(mode: 'generate' | 'regenerate') {
    setIsPreparing(true)
    setError(null)

    try {
      const payload = await prepareLessonNarration(lessonId, mode)
      setNarration(payload)
      setCurrentPartIndex(0)
      setError(null)
      setTechnicalErrorMessage(null)
    } catch (prepareError) {
      const message = prepareError instanceof Error ? prepareError.message : 'Falha ao preparar a narracao da aula.'
      if (isAdmin) {
        setError(message)
      } else {
        setError('Não foi possível gerar o áudio desta aula no momento.')
        setTechnicalErrorMessage(message)
      }
    } finally {
      setIsPreparing(false)
    }
  }

  async function handleRequestModeration() {
    setIsRequestingModeration(true)
    setError(null)

    try {
      const created = await requestLessonAudioModeration({
        lessonId,
        technicalError: technicalErrorMessage ?? undefined,
      })
      setModerationRequest(created)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Falha ao avisar a moderação.'
      setError(message)
    } finally {
      setIsRequestingModeration(false)
    }
  }

  function handlePartEnded() {
    if (!narration || currentPartIndex >= narration.parts.length - 1) {
      return
    }

    setCurrentPartIndex((index) => index + 1)
    setShouldAutoPlayNext(true)
  }

  function handleAudioError() {
    const mediaError = audioRef.current?.error

    // Ignore canceled loads during source switching; only surface real media failures.
    if (!mediaError) {
      return
    }

    setError('Falha ao reproduzir o audio. Gere novamente para renovar os links.')
  }

  const canGenerateAsStudent = !isAdmin && !narration && !isLoadingNarration
  const canRegenerateAsAdmin = isAdmin && !isLoadingNarration
  const hasPendingModerationRequest = moderationRequest?.status === 'pending'

  return (
    <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-sm">
      <div className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="inline-flex rounded-full bg-sky-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              Texto para Fala
            </span>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Narração em áudio da aula</h3>
            <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              O conteúdo textual desta aula pode ser narrado em áudio gerado por IA para escuta no player abaixo.
            </p>
          </div>

          {canGenerateAsStudent ? (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-slate-900 px-6 font-bold hover:bg-slate-800"
              disabled={isPreparing}
              onClick={() => void handlePrepareNarration('generate')}
            >
              {isPreparing ? 'Preparando áudio...' : 'Gerar Narração'}
            </Button>
          ) : null}

          {canRegenerateAsAdmin ? (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-slate-900 px-6 font-bold hover:bg-slate-800"
              disabled={isPreparing}
              onClick={() => void handlePrepareNarration(narration ? 'regenerate' : 'generate')}
            >
              {isPreparing ? 'Preparando áudio...' : narration ? 'Gerar Novamente' : 'Gerar Narração'}
            </Button>
          ) : null}
        </div>

        {narration ? (
          <div className="space-y-4 rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-bold text-slate-700">
                {narration.parts.length > 1
                  ? `Trecho ${currentPartIndex + 1} de ${narration.parts.length}`
                  : 'Audio completo da aula'}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-sky-600">
                Voz gerada por IA
              </span>
            </div>

            {currentPart ? (
              <audio
                ref={audioRef}
                key={currentPart.path}
                controls
                preload="metadata"
                className="w-full"
                src={currentPart.url}
                onEnded={handlePartEnded}
                onLoadedMetadata={() => setError(null)}
                onError={handleAudioError}
              />
            ) : null}

            {narration.parts.length > 1 ? (
              <p className="text-xs font-medium leading-relaxed text-slate-500">
                A narração foi dividida em partes para processar todo o conteúdo da aula. O player avança automaticamente para o próximo trecho.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {!isAdmin && technicalErrorMessage ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <p className="font-medium text-amber-900">
              Se o problema continuar, você pode solicitar revisão da equipe.
            </p>
            <Button
              variant="outline"
              className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
              disabled={isRequestingModeration || hasPendingModerationRequest}
              onClick={() => void handleRequestModeration()}
            >
              {hasPendingModerationRequest
                ? 'Moderação avisada'
                : isRequestingModeration
                  ? 'Enviando...'
                  : 'Avisar a moderação'}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
