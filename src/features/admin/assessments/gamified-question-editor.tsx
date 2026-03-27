import { useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  AssessmentQuestionAnswerKey,
  AssessmentQuestionAnswerKeyPayload,
  AssessmentQuestionInteraction,
  AssessmentInteractionContent,
  AssessmentQuestionType,
  DragDropLabelingInteractionContent,
  FillInTheBlanksInteractionContent,
} from '@/types/content'

import {
  createAnswerKeyFromInteraction,
  createDefaultInteractionContent,
  getInteractionSlotIds,
  validateInteractionBundle,
} from '@/features/assessments/gamified'

import {
  deleteAssessmentAsset,
  uploadAssessmentAsset,
  type AssessmentQuestionWithOptions,
} from './api'

interface GamifiedQuestionEditorProps {
  question: AssessmentQuestionWithOptions
  onDraftChange: (updates: Partial<AssessmentQuestionWithOptions>) => void
  onPersist: (updates: Partial<AssessmentQuestionWithOptions>) => Promise<void> | void
  onError: (message: string | null) => void
}

function createInteractionRecord(
  question: AssessmentQuestionWithOptions,
  content: AssessmentInteractionContent,
): AssessmentQuestionInteraction {
  const timestamp = new Date().toISOString()

  return {
    question_id: question.id,
    content,
    version: question.interaction?.version ?? 1,
    created_at: question.interaction?.created_at ?? timestamp,
    updated_at: timestamp,
  }
}

function createAnswerKeyRecord(
  question: AssessmentQuestionWithOptions,
  answerKey: AssessmentQuestionAnswerKeyPayload,
  gradingMode: AssessmentQuestionAnswerKey['grading_mode'],
): AssessmentQuestionAnswerKey {
  const timestamp = new Date().toISOString()

  return {
    question_id: question.id,
    grading_mode: gradingMode,
    answer_key: answerKey,
    created_at: question.answer_key?.created_at ?? timestamp,
    updated_at: timestamp,
  }
}

function syncAnswerKeyWithContent(
  content: AssessmentInteractionContent,
  current: AssessmentQuestionAnswerKeyPayload | null | undefined,
) {
  const slotIds = getInteractionSlotIds(content)
  const tokenIds = content.tokens.map((token) => token.id)
  const preservedEntries: AssessmentQuestionAnswerKeyPayload['entries'] = []
  const usedSlots = new Set<string>()
  const usedTokens = new Set<string>()

  for (const entry of current?.entries ?? []) {
    if (!slotIds.includes(entry.slot_id) || !tokenIds.includes(entry.token_id)) {
      continue
    }

    if (usedSlots.has(entry.slot_id) || usedTokens.has(entry.token_id)) {
      continue
    }

    preservedEntries.push(entry)
    usedSlots.add(entry.slot_id)
    usedTokens.add(entry.token_id)
  }

  const availableTokens = tokenIds.filter((tokenId) => !usedTokens.has(tokenId))

  for (const slotId of slotIds) {
    if (usedSlots.has(slotId)) {
      continue
    }

    const nextTokenId = availableTokens.shift()
    if (!nextTokenId) {
      continue
    }

    preservedEntries.push({
      slot_id: slotId,
      token_id: nextTokenId,
    })
    usedSlots.add(slotId)
    usedTokens.add(nextTokenId)
  }

  return {
    entries: preservedEntries,
  } satisfies AssessmentQuestionAnswerKeyPayload
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      resolve({
        width: image.naturalWidth || 1200,
        height: image.naturalHeight || 800,
      })
      URL.revokeObjectURL(objectUrl)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Nao foi possivel ler a imagem selecionada.'))
    }

    image.src = objectUrl
  })
}

function getValidationMessage(
  questionType: AssessmentQuestionType,
  content: AssessmentInteractionContent | null,
  answerKey: AssessmentQuestionAnswerKeyPayload | null,
) {
  if (!content || !answerKey) {
    return 'Configure a interacao e o gabarito para habilitar a correcao automatica.'
  }

  try {
    validateInteractionBundle(questionType, content, answerKey)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Interacao invalida.'
  }
}

export function GamifiedQuestionEditor({
  question,
  onDraftChange,
  onPersist,
  onError,
}: GamifiedQuestionEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)

  const interactionContent = useMemo(() => {
    if (question.interaction?.content) {
      return question.interaction.content
    }

    return createDefaultInteractionContent(question.question_type)
  }, [question.interaction, question.question_type])

  const gradingMode = question.answer_key?.grading_mode ?? 'partial_by_item'
  const answerKeyPayload = useMemo(() => {
    if (!interactionContent) {
      return null
    }

    return syncAnswerKeyWithContent(
      interactionContent,
      question.answer_key?.answer_key ?? createAnswerKeyFromInteraction(interactionContent),
    )
  }, [interactionContent, question.answer_key?.answer_key])

  const validationMessage = getValidationMessage(question.question_type, interactionContent, answerKeyPayload)

  if (!interactionContent) {
    return null
  }

  const activeInteraction = interactionContent

  const assignedTokenBySlot = new Map(
    (answerKeyPayload?.entries ?? []).map((entry) => [entry.slot_id, entry.token_id]),
  )

  async function commit(
    content: AssessmentInteractionContent,
    answerKey = syncAnswerKeyWithContent(content, answerKeyPayload),
    nextGradingMode = gradingMode,
  ) {
    const patch: Partial<AssessmentQuestionWithOptions> = {
      interaction: createInteractionRecord(question, content),
      answer_key: createAnswerKeyRecord(question, answerKey, nextGradingMode),
    }

    onDraftChange(patch)
    await onPersist(patch)
  }

  function updateDraft(
    content: AssessmentInteractionContent,
    answerKey = syncAnswerKeyWithContent(content, answerKeyPayload),
    nextGradingMode = gradingMode,
  ) {
    onDraftChange({
      interaction: createInteractionRecord(question, content),
      answer_key: createAnswerKeyRecord(question, answerKey, nextGradingMode),
    })
  }

  function updateTokenLabel(tokenId: string, label: string) {
    const nextContent = {
      ...activeInteraction,
      tokens: activeInteraction.tokens.map((token) => (
        token.id === tokenId
          ? { ...token, label }
          : token
      )),
    } satisfies AssessmentInteractionContent

    updateDraft(nextContent)
  }

  function addToken() {
    const nextContent = {
      ...activeInteraction,
      tokens: [
        ...activeInteraction.tokens,
        {
          id: crypto.randomUUID(),
          label: activeInteraction.kind === 'drag_drop_labeling'
            ? `Rotulo ${activeInteraction.tokens.length + 1}`
            : `Resposta ${activeInteraction.tokens.length + 1}`,
        },
      ],
    } satisfies AssessmentInteractionContent

    void commit(nextContent)
  }

  function deleteToken(tokenId: string) {
    if (activeInteraction.tokens.length === 1) {
      onError('Mantenha ao menos um item no banco de respostas.')
      return
    }

    const nextContent = {
      ...activeInteraction,
      tokens: activeInteraction.tokens.filter((token) => token.id !== tokenId),
    } satisfies AssessmentInteractionContent

    void commit(nextContent)
  }

  function updateSlotAnswer(slotId: string, tokenId: string) {
    const nextEntries = (answerKeyPayload?.entries ?? []).filter((entry) => entry.slot_id !== slotId && entry.token_id !== tokenId)
    nextEntries.push({
      slot_id: slotId,
      token_id: tokenId,
    })

    void commit(activeInteraction, { entries: nextEntries })
  }

  async function handleAssetSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || activeInteraction.kind !== 'drag_drop_labeling') {
      return
    }

    setIsUploadingAsset(true)
    onError(null)

    try {
      const dimensions = await readImageDimensions(file)
      const previousStoragePath = activeInteraction.asset.storage_path
      const uploaded = await uploadAssessmentAsset(file)
      const nextContent: DragDropLabelingInteractionContent = {
        ...activeInteraction,
        asset: {
          storage_path: uploaded.storage_path,
          signed_url: uploaded.signed_url,
          alt: activeInteraction.asset.alt || file.name,
          width: dimensions.width,
          height: dimensions.height,
        },
      }

      await commit(nextContent)

      if (previousStoragePath && previousStoragePath !== uploaded.storage_path) {
        void deleteAssessmentAsset(previousStoragePath).catch(() => null)
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Falha ao enviar a imagem do exercicio.')
    } finally {
      setIsUploadingAsset(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  function renderTokenBank() {
    return (
      <section className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Banco de respostas</p>
            <p className="mt-2 text-sm font-medium text-cyan-950">
              Cada item do banco deve ser associado a uma unica area ou lacuna nesta v1.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-100"
            onClick={addToken}
          >
            Adicionar item
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {activeInteraction.tokens.map((token, index) => (
            <div key={token.id} className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                  Item {index + 1}
                </span>
                <button
                  type="button"
                  className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                  onClick={() => deleteToken(token.id)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <input
                className="mt-3 w-full rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                value={token.label}
                onChange={(event) => updateTokenLabel(token.id, event.target.value)}
                onBlur={() => void commit({
                  ...activeInteraction,
                  tokens: activeInteraction.tokens.map((item) => (
                    item.id === token.id
                      ? { ...item, label: token.label }
                      : item
                  )),
                })}
                placeholder="Rotulo exibido ao aluno"
              />
            </div>
          ))}
        </div>
      </section>
    )
  }

  function renderDragDropEditor(content: DragDropLabelingInteractionContent) {
    const canvasScalePercent = Math.round(canvasScale * 100)

    function updateTarget(
      targetId: string,
      field: keyof DragDropLabelingInteractionContent['targets'][number],
      value: string | number,
    ) {
      const nextContent: DragDropLabelingInteractionContent = {
        ...content,
        targets: content.targets.map((target) => (
          target.id === targetId
            ? { ...target, [field]: value }
            : target
        )),
      }

      updateDraft(nextContent)
    }

    function addTargetAt(x: number, y: number) {
      const nextToken = {
        id: crypto.randomUUID(),
        label: `Rotulo ${content.tokens.length + 1}`,
      }

      const nextContent: DragDropLabelingInteractionContent = {
        ...content,
        tokens: [...content.tokens, nextToken],
        targets: [
          ...content.targets,
          {
            id: crypto.randomUUID(),
            x,
            y,
            w: 18,
            h: 10,
            label: `Area ${content.targets.length + 1}`,
          },
        ],
      }

      const nextAnswerKey = syncAnswerKeyWithContent(nextContent, answerKeyPayload)
      setSelectedTargetId(nextContent.targets[nextContent.targets.length - 1]?.id ?? null)
      void commit(nextContent, nextAnswerKey)
    }

    function handleStageClick(event: MouseEvent<HTMLDivElement>) {
      if (!content.asset.signed_url) {
        onError('Envie uma imagem primeiro para posicionar as areas.')
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100 - 9))
      const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100 - 5))
      addTargetAt(Math.round(x * 100) / 100, Math.round(y * 100) / 100)
    }

    function removeTarget(targetId: string) {
      if (content.targets.length === 1) {
        onError('Mantenha ao menos uma area de encaixe.')
        return
      }

      const nextContent: DragDropLabelingInteractionContent = {
        ...content,
        targets: content.targets.filter((target) => target.id !== targetId),
      }

      void commit(nextContent)
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Canvas interativo</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Clique na imagem para criar novas areas. O preview do aluno usa a mesma base visual.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zoom</span>
                {[0.75, 1, 1.5].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={cn(
                      'rounded-xl px-2 py-1 text-xs font-black transition-colors',
                      Math.abs(canvasScale - preset) < 0.01
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-500 hover:bg-white hover:text-cyan-700',
                    )}
                    onClick={() => setCanvasScale(preset)}
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleAssetSelected(event)}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-slate-200 bg-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAsset}
              >
                {isUploadingAsset ? 'Enviando...' : 'Enviar imagem'}
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Escala da imagem</p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Ajuste apenas a visualizacao do editor para mapear melhor as areas.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 shadow-sm">
                  {canvasScalePercent}%
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition-colors hover:border-cyan-200 hover:text-cyan-700"
                  onClick={() => setCanvasScale((value) => Math.max(0.6, Math.round((value - 0.1) * 100) / 100))}
                >
                  -
                </button>
                <input
                  type="range"
                  min={0.6}
                  max={2.4}
                  step={0.05}
                  value={canvasScale}
                  onChange={(event) => setCanvasScale(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-600"
                />
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition-colors hover:border-cyan-200 hover:text-cyan-700"
                  onClick={() => setCanvasScale((value) => Math.min(2.4, Math.round((value + 0.1) * 100) / 100))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded-[28px] border border-slate-200 bg-slate-50/30 p-3">
              <div
                className="mx-auto transition-[width] duration-200"
                style={{
                  width: `${canvasScalePercent}%`,
                  minWidth: canvasScale > 1 ? `${canvasScalePercent}%` : '320px',
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleStageClick}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                    }
                  }}
                  className={cn(
                    'relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_38%),linear-gradient(135deg,_#f8fafc,_#eef2ff)]',
                    !content.asset.signed_url && 'flex min-h-[380px] items-center justify-center',
                  )}
                  style={{
                    aspectRatio: `${content.asset.width || 1200} / ${content.asset.height || 800}`,
                  }}
                >
                  {content.asset.signed_url ? (
                    <img
                      src={content.asset.signed_url}
                      alt={content.asset.alt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex max-w-sm flex-col items-center gap-3 px-8 text-center text-slate-500">
                      <div className="rounded-full border border-cyan-200 bg-white p-4 text-cyan-600 shadow-sm">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2 1.586-1.586a2 2 0 012.828 0L20 14m-6-10h6a2 2 0 012 2v6M4 8V6a2 2 0 012-2h6" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold">
                        Envie uma imagem anatomica, esquema ou ilustracao para posicionar os hotspots.
                      </p>
                    </div>
                  )}

                  {content.targets.map((target, index) => (
                    <button
                      key={target.id}
                      type="button"
                      className={cn(
                        'absolute rounded-2xl border-2 border-dashed bg-white/70 text-[11px] font-black uppercase tracking-widest text-slate-700 shadow-lg backdrop-blur-sm transition-all',
                        selectedTargetId === target.id
                          ? 'border-cyan-500 ring-4 ring-cyan-100'
                          : 'border-cyan-200 hover:border-cyan-400',
                      )}
                      style={{
                        left: `${target.x}%`,
                        top: `${target.y}%`,
                        width: `${target.w}%`,
                        height: `${target.h}%`,
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedTargetId(target.id)
                      }}
                    >
                      {target.label?.trim() || `Area ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Metadados do asset</p>
              <div className="mt-4 space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Texto alternativo</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                    value={content.asset.alt}
                    onChange={(event) => updateDraft({
                      ...content,
                      asset: {
                        ...content.asset,
                        alt: event.target.value,
                      },
                    })}
                    onBlur={() => void commit(content)}
                    placeholder="Descreva a ilustracao para acessibilidade"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Largura</p>
                    <p className="mt-2 text-lg font-black text-slate-900">{content.asset.width}px</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Altura</p>
                    <p className="mt-2 text-lg font-black text-slate-900">{content.asset.height}px</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Areas e gabarito</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Edite posicao, tamanho e a resposta correta de cada hotspot.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {content.targets.map((target, index) => (
              <div
                key={target.id}
                className={cn(
                  'rounded-[28px] border bg-white p-4 shadow-sm transition-all',
                  selectedTargetId === target.id ? 'border-cyan-300 shadow-cyan-100/80' : 'border-slate-200',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Area {index + 1}
                  </span>
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    onClick={() => removeTarget(target.id)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome interno</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                      value={target.label ?? ''}
                      onChange={(event) => updateTarget(target.id, 'label', event.target.value)}
                      onBlur={() => void commit(content)}
                      placeholder="Ex.: Mitocondria"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {(['x', 'y', 'w', 'h'] as const).map((field) => (
                      <label key={field} className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{field}%</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                          value={target[field]}
                          onChange={(event) => updateTarget(target.id, field, Number(event.target.value || 0))}
                          onBlur={() => void commit(content)}
                        />
                      </label>
                    ))}
                  </div>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resposta correta</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                      value={assignedTokenBySlot.get(target.id) ?? ''}
                      onChange={(event) => updateSlotAnswer(target.id, event.target.value)}
                    >
                      <option value="" disabled>Selecione um item</option>
                      {content.tokens.map((token) => (
                        <option key={token.id} value={token.id}>{token.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  function renderFillInTheBlanksEditor(content: FillInTheBlanksInteractionContent) {
    const blanks = content.segments.filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'blank' }> => segment.type === 'blank')

    function updateSegmentText(index: number, text: string) {
      const nextContent: FillInTheBlanksInteractionContent = {
        ...content,
        segments: content.segments.map((segment, segmentIndex) => (
          segmentIndex === index && segment.type === 'text'
            ? { ...segment, text }
            : segment
        )),
      }

      updateDraft(nextContent)
    }

    function updateBlank(blankId: string, placeholder: string) {
      const nextContent: FillInTheBlanksInteractionContent = {
        ...content,
        segments: content.segments.map((segment) => (
          segment.type === 'blank' && segment.id === blankId
            ? { ...segment, placeholder }
            : segment
        )),
      }

      updateDraft(nextContent)
    }

    function addTextSegment() {
      const nextContent: FillInTheBlanksInteractionContent = {
        ...content,
        segments: [...content.segments, { type: 'text', text: 'Novo trecho de texto. ' }],
      }

      void commit(nextContent)
    }

    function addBlankSegment() {
      const nextToken = {
        id: crypto.randomUUID(),
        label: `Resposta ${content.tokens.length + 1}`,
      }
      const nextContent: FillInTheBlanksInteractionContent = {
        ...content,
        tokens: [...content.tokens, nextToken],
        segments: [
          ...content.segments,
          { type: 'blank', id: crypto.randomUUID(), placeholder: 'lacuna' },
        ],
      }

      void commit(nextContent)
    }

    function removeSegment(index: number) {
      if (content.segments.length === 1) {
        onError('Mantenha ao menos um segmento de texto ou lacuna.')
        return
      }

      const removedSegment = content.segments[index]
      const nextContent: FillInTheBlanksInteractionContent = {
        ...content,
        segments: content.segments.filter((_, segmentIndex) => segmentIndex !== index),
      }

      let nextAnswerKey = answerKeyPayload
      if (removedSegment?.type === 'blank') {
        nextAnswerKey = {
          entries: (answerKeyPayload?.entries ?? []).filter((entry) => entry.slot_id !== removedSegment.id),
        }
      }

      void commit(nextContent, syncAnswerKeyWithContent(nextContent, nextAnswerKey))
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Construtor de texto</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Monte o enunciado em segmentos. Cada lacuna recebe uma resposta correta do banco.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={addTextSegment}>
                Adicionar texto
              </Button>
              <Button type="button" className="rounded-2xl bg-cyan-600 hover:bg-cyan-700" onClick={addBlankSegment}>
                Inserir lacuna
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {content.segments.map((segment, index) => (
              <div key={segment.type === 'blank' ? segment.id : `text-${index}`} className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest',
                    segment.type === 'blank'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'bg-slate-200 text-slate-500',
                  )}>
                    {segment.type === 'blank' ? 'Lacuna' : 'Texto'}
                  </span>
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    onClick={() => removeSegment(index)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {segment.type === 'text' ? (
                  <textarea
                    className="mt-4 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                    value={segment.text}
                    onChange={(event) => updateSegmentText(index, event.target.value)}
                    onBlur={() => void commit(content)}
                    placeholder="Trecho antes, entre ou depois das lacunas."
                  />
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Placeholder</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                        value={segment.placeholder ?? ''}
                        onChange={(event) => updateBlank(segment.id, event.target.value)}
                        onBlur={() => void commit(content)}
                        placeholder="Ex.: termo principal"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resposta correta</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                        value={assignedTokenBySlot.get(segment.id) ?? ''}
                        onChange={(event) => updateSlotAnswer(segment.id, event.target.value)}
                      >
                        <option value="" disabled>Selecione um item</option>
                        {content.tokens.map((token) => (
                          <option key={token.id} value={token.id}>{token.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(236,254,255,0.8),_rgba(255,255,255,1))] p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Preview do aluno</p>
          <div className="mt-4 rounded-[28px] border border-white bg-white p-6 shadow-sm">
            <p className="text-base leading-8 text-slate-700">
              {content.segments.map((segment, index) => (
                segment.type === 'text' ? (
                  <span key={`text-${index}`}>{segment.text}</span>
                ) : (
                  <span
                    key={segment.id}
                    className="mx-1 inline-flex min-w-[120px] items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-700 shadow-sm"
                  >
                    {content.tokens.find((token) => token.id === assignedTokenBySlot.get(segment.id))?.label
                      ?? segment.placeholder
                      ?? 'lacuna'}
                  </span>
                )
              ))}
            </p>
          </div>

          <div className="mt-5 rounded-[28px] border border-cyan-100 bg-cyan-50/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Mapa de lacunas</p>
            <div className="mt-4 space-y-3">
              {blanks.map((blank, index) => (
                <div key={blank.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Lacuna {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{blank.placeholder || 'Sem placeholder'}</p>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                    {content.tokens.find((token) => token.id === assignedTokenBySlot.get(blank.id))?.label ?? 'Sem resposta'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-[32px] border border-cyan-200 bg-[linear-gradient(180deg,_rgba(236,254,255,0.55),_rgba(255,255,255,1))] p-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Instrucao ao aluno</p>
          <textarea
            className="min-h-[110px] w-full rounded-[28px] border border-cyan-100 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            value={activeInteraction.instruction}
            onChange={(event) => updateDraft({
              ...activeInteraction,
              instruction: event.target.value,
            })}
            onBlur={() => void commit(activeInteraction)}
            placeholder="Explique como o aluno deve interagir com o exercicio."
          />
        </div>

        <div className="rounded-[28px] border border-white bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Modo de correcao</p>
          <div className="mt-4 grid gap-3">
            {[
              {
                value: 'partial_by_item' as const,
                title: 'Parcial por item',
                description: 'Cada area ou lacuna correta soma parte da nota total.',
              },
              {
                value: 'all_or_nothing' as const,
                title: 'Tudo ou nada',
                description: 'A questao so pontua quando todos os itens estiverem corretos.',
              },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={cn(
                  'rounded-2xl border px-4 py-4 text-left transition-all',
                  gradingMode === mode.value
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/60',
                )}
                onClick={() => void commit(
                  activeInteraction,
                  answerKeyPayload ?? createAnswerKeyFromInteraction(activeInteraction) ?? { entries: [] },
                  mode.value,
                )}
              >
                <p className="text-sm font-black">{mode.title}</p>
                <p className="mt-2 text-xs font-medium leading-relaxed">{mode.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeInteraction.kind === 'drag_drop_labeling'
        ? renderDragDropEditor(activeInteraction)
        : renderFillInTheBlanksEditor(activeInteraction)}

      {renderTokenBank()}

      <div className={cn(
        'rounded-[28px] border px-5 py-4 text-sm font-semibold',
        validationMessage
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      )}>
        {validationMessage ?? 'Interacao valida. O backend ja possui o gabarito necessario para corrigir esta questao.'}
      </div>
    </div>
  )
}
