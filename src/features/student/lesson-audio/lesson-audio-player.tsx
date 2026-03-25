import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { prepareLessonNarration, type LessonNarrationPayload } from './api'

interface LessonAudioPlayerProps {
  lessonId: string
}

export function LessonAudioPlayer({ lessonId }: LessonAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [narration, setNarration] = useState<LessonNarrationPayload | null>(null)
  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  const [isPreparing, setIsPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shouldAutoPlayNext, setShouldAutoPlayNext] = useState(false)

  const currentPart = useMemo(() => {
    return narration?.parts[currentPartIndex] ?? null
  }, [currentPartIndex, narration])

  useEffect(() => {
    setNarration(null)
    setCurrentPartIndex(0)
    setError(null)
    setShouldAutoPlayNext(false)
  }, [lessonId])

  useEffect(() => {
    if (!shouldAutoPlayNext || !audioRef.current) {
      return
    }

    const player = audioRef.current
    void player.play().catch(() => null)
    setShouldAutoPlayNext(false)
  }, [currentPart, shouldAutoPlayNext])

  async function handlePrepareNarration() {
    setIsPreparing(true)
    setError(null)

    try {
      const payload = await prepareLessonNarration(lessonId)
      setNarration(payload)
      setCurrentPartIndex(0)
      setError(null)
    } catch (prepareError) {
      const message = prepareError instanceof Error ? prepareError.message : 'Falha ao preparar a narracao da aula.'
      setError(message)
    } finally {
      setIsPreparing(false)
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

  return (
    <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-sm">
      <div className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="inline-flex rounded-full bg-sky-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              Texto para Fala
            </span>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Narracao em audio da aula</h3>
            <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              O conteudo textual desta aula pode ser narrado em audio gerado por IA para escuta no player abaixo.
            </p>
          </div>

          <Button
            size="lg"
            className="h-12 rounded-2xl bg-slate-900 px-6 font-bold hover:bg-slate-800"
            disabled={isPreparing}
            onClick={() => void handlePrepareNarration()}
          >
            {isPreparing ? 'Preparando audio...' : narration ? 'Atualizar narracao' : 'Gerar narracao'}
          </Button>
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
                A narracao foi dividida em partes para processar todo o conteudo da aula. O player avanca automaticamente para o proximo trecho.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  )
}
