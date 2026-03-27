import { useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

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
  const normalizedContent = normalizeInteractionContent(content, current)
  const slotIds = getInteractionSlotIds(normalizedContent)
  const tokenIds = normalizedContent.tokens.map((token) => token.id)
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

function normalizeInteractionContent(
  content: AssessmentInteractionContent,
  current: AssessmentQuestionAnswerKeyPayload | null | undefined,
) {
  if (content.kind !== 'drag_drop_labeling') {
    return content
  }

  const tokenById = new Map(content.tokens.map((token) => [token.id, token]))
  const usedTokenIds = new Set<string>()

  const normalizedTokens = content.targets.map((target) => {
    const mappedTokenId = current?.entries.find((entry) => entry.slot_id === target.id)?.token_id
    if (mappedTokenId) {
      const mappedToken = tokenById.get(mappedTokenId)
      if (mappedToken && !usedTokenIds.has(mappedToken.id)) {
        usedTokenIds.add(mappedToken.id)
        return {
          ...mappedToken,
          label: mappedToken.label,
        }
      }
    }

    const fallbackToken = content.tokens.find((token) => !usedTokenIds.has(token.id))
    if (fallbackToken) {
      usedTokenIds.add(fallbackToken.id)
      return {
        ...fallbackToken,
        label: fallbackToken.label,
      }
    }

    const nextToken = {
      id: crypto.randomUUID(),
      label: '',
    }
    usedTokenIds.add(nextToken.id)
    return nextToken
  })

  return {
    ...content,
    tokens: normalizedTokens,
  } satisfies DragDropLabelingInteractionContent
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

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

interface FillBlankBuilderItem {
  blankId: string
  tokenId: string
  beforeText: string
  afterText: string
  placeholder: string
  answerText: string
}

function buildFillBlankBuilderItems(
  content: FillInTheBlanksInteractionContent,
  answerKey: AssessmentQuestionAnswerKeyPayload | null,
) {
  const tokenById = new Map(content.tokens.map((token) => [token.id, token]))
  const tokenIdBySlot = new Map((answerKey?.entries ?? []).map((entry) => [entry.slot_id, entry.token_id]))
  const items: FillBlankBuilderItem[] = []

  let pendingBeforeText = ''
  let index = 0

  while (index < content.segments.length) {
    const currentSegment = content.segments[index]

    if (currentSegment.type === 'text') {
      pendingBeforeText += currentSegment.text
      index += 1
      continue
    }

    let afterText = ''
    let nextIndex = index + 1
    while (nextIndex < content.segments.length) {
      const nextSegment = content.segments[nextIndex]
      if (nextSegment?.type !== 'text') {
        break
      }

      afterText += nextSegment.text
      nextIndex += 1
    }

    const tokenId = tokenIdBySlot.get(currentSegment.id)
      ?? content.tokens[items.length]?.id
      ?? crypto.randomUUID()

    items.push({
      blankId: currentSegment.id,
      tokenId,
      beforeText: pendingBeforeText,
      afterText,
      placeholder: currentSegment.placeholder ?? '',
      answerText: tokenById.get(tokenId)?.label ?? '',
    })

    pendingBeforeText = ''
    index = nextIndex
  }

  if (items.length === 0) {
    const fallbackToken = content.tokens[0]
    const preservedText = content.segments
      .filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'text' }> => segment.type === 'text')
      .map((segment) => segment.text)
      .join('')

    items.push({
      blankId: crypto.randomUUID(),
      tokenId: fallbackToken?.id ?? crypto.randomUUID(),
      beforeText: preservedText,
      afterText: '',
      placeholder: '',
      answerText: fallbackToken?.label ?? '',
    })
  }

  return items
}

function buildFillBlankBundle(
  instruction: string,
  items: FillBlankBuilderItem[],
) {
  const tokens = items.map((item) => ({
    id: item.tokenId,
    label: item.answerText,
  }))

  const segments: FillInTheBlanksInteractionContent['segments'] = []

  items.forEach((item) => {
    if (item.beforeText.length > 0) {
      segments.push({
        type: 'text',
        text: item.beforeText,
      })
    }

    segments.push({
      type: 'blank',
      id: item.blankId,
      placeholder: item.placeholder || undefined,
    })

    if (item.afterText.length > 0) {
      segments.push({
        type: 'text',
        text: item.afterText,
      })
    }
  })

  return {
    content: {
      kind: 'fill_in_the_blanks',
      instruction,
      segments: segments.length > 0 ? segments : [{ type: 'text', text: '' }],
      tokens,
    } satisfies FillInTheBlanksInteractionContent,
    answerKey: {
      entries: items.map((item) => ({
        slot_id: item.blankId,
        token_id: item.tokenId,
      })),
    } satisfies AssessmentQuestionAnswerKeyPayload,
  }
}

export function GamifiedQuestionEditor({
  question,
  onDraftChange,
  onPersist,
  onError,
}: GamifiedQuestionEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [draggingTargetId, setDraggingTargetId] = useState<string | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [isAssetMetadataOpen, setIsAssetMetadataOpen] = useState(false)
  const [isAdvancedAnswerToolsOpen, setIsAdvancedAnswerToolsOpen] = useState(false)
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false)
  const [openFillBlankId, setOpenFillBlankId] = useState<string | null>(null)

  const interactionContent = useMemo(() => {
    if (question.interaction?.content) {
      return normalizeInteractionContent(
        question.interaction.content,
        question.answer_key?.answer_key,
      )
    }

    return createDefaultInteractionContent(question.question_type)
  }, [question.answer_key?.answer_key, question.interaction, question.question_type])

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
  const scoringItemCount = activeInteraction.kind === 'drag_drop_labeling'
    ? activeInteraction.targets.length
    : activeInteraction.segments.filter((segment) => segment.type === 'blank').length
  const questionPoints = Number(question.points || 0)
  const pointsPerItem = scoringItemCount > 0 ? questionPoints / scoringItemCount : 0

  const assignedTokenBySlot = new Map(
    (answerKeyPayload?.entries ?? []).map((entry) => [entry.slot_id, entry.token_id]),
  )

  async function commit(
    content: AssessmentInteractionContent,
    answerKey = syncAnswerKeyWithContent(content, answerKeyPayload),
    nextGradingMode = gradingMode,
  ) {
    const normalizedContent = normalizeInteractionContent(content, answerKey)
    const normalizedAnswerKey = syncAnswerKeyWithContent(normalizedContent, answerKey)
    const patch: Partial<AssessmentQuestionWithOptions> = {
      interaction: createInteractionRecord(question, normalizedContent),
      answer_key: createAnswerKeyRecord(question, normalizedAnswerKey, nextGradingMode),
    }

    onDraftChange(patch)
    await onPersist(patch)
  }

  function updateDraft(
    content: AssessmentInteractionContent,
    answerKey = syncAnswerKeyWithContent(content, answerKeyPayload),
    nextGradingMode = gradingMode,
  ) {
    const normalizedContent = normalizeInteractionContent(content, answerKey)
    const normalizedAnswerKey = syncAnswerKeyWithContent(normalizedContent, answerKey)
    onDraftChange({
      interaction: createInteractionRecord(question, normalizedContent),
      answer_key: createAnswerKeyRecord(question, normalizedAnswerKey, nextGradingMode),
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
    if (activeInteraction.kind === 'drag_drop_labeling') {
      onError('No arrastar e soltar, o banco de respostas acompanha automaticamente a quantidade de areas.')
      return
    }

    const nextContent = {
      ...activeInteraction,
      tokens: [
        ...activeInteraction.tokens,
        {
          id: crypto.randomUUID(),
          label: `Resposta ${activeInteraction.tokens.length + 1}`,
        },
      ],
    } satisfies AssessmentInteractionContent

    void commit(nextContent)
  }

  function deleteToken(tokenId: string) {
    if (activeInteraction.kind === 'drag_drop_labeling') {
      onError('Remova ou adicione areas para sincronizar o banco de respostas deste exercicio.')
      return
    }

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
              {activeInteraction.kind === 'drag_drop_labeling'
                ? 'No arrastar e soltar, cada area cria automaticamente um campo correspondente no banco de respostas.'
                : 'Cada item do banco deve ser associado a uma unica area ou lacuna nesta v1.'}
            </p>
          </div>

          {activeInteraction.kind !== 'drag_drop_labeling' ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-100"
              onClick={addToken}
            >
              Adicionar item
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {activeInteraction.tokens.map((token, index) => (
            <div key={token.id} className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                  {activeInteraction.kind === 'drag_drop_labeling' ? `Area ${index + 1}` : `Item ${index + 1}`}
                </span>
                {activeInteraction.kind !== 'drag_drop_labeling' ? (
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    onClick={() => deleteToken(token.id)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>

              <input
                type="text"
                className="mt-3 w-full rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                value={token.label}
                onChange={(event) => updateTokenLabel(token.id, event.target.value)}
                onBlur={(event) => {
                  const nextLabel = event.currentTarget.value
                  void commit({
                    ...activeInteraction,
                    tokens: activeInteraction.tokens.map((item) => (
                      item.id === token.id
                        ? { ...item, label: nextLabel }
                        : item
                    )),
                  })
                }}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder={activeInteraction.kind === 'drag_drop_labeling' ? `Rotulo ${index + 1}` : 'Resposta correta exibida ao aluno. Pode ter mais de uma palavra.'}
              />
            </div>
          ))}
        </div>

        {activeInteraction.kind === 'drag_drop_labeling' ? (
          <div className="mt-5 rounded-2xl border border-cyan-100/80 bg-white/70 p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setIsAdvancedAnswerToolsOpen((current) => !current)}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Ajuste avancado</p>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  Abra apenas se quiser refinar coordenadas, tamanho das areas ou revisar o gabarito manualmente.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-cyan-700">
                {isAdvancedAnswerToolsOpen ? 'Fechar' : 'Abrir'}
                <svg
                  className={cn('h-4 w-4 transition-transform', isAdvancedAnswerToolsOpen ? 'rotate-180' : '')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            {isAdvancedAnswerToolsOpen ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">Areas e gabarito</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    Edite hotspots, coordenadas, tamanhos e a associacao final de cada area.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
                  onClick={() => setIsTargetsModalOpen(true)}
                >
                  Editar {activeInteraction.targets.length} area(s)
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
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
      const nextContent: DragDropLabelingInteractionContent = {
        ...content,
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

    function startTargetDrag(
      event: ReactPointerEvent<HTMLButtonElement>,
      target: DragDropLabelingInteractionContent['targets'][number],
    ) {
      const stageElement = stageRef.current
      if (!stageElement) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setSelectedTargetId(target.id)
      setDraggingTargetId(target.id)

      const rect = stageElement.getBoundingClientRect()
      const offsetXPercent = ((event.clientX - rect.left) / rect.width) * 100 - target.x
      const offsetYPercent = ((event.clientY - rect.top) / rect.height) * 100 - target.y

      let currentContent = content

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentStage = stageRef.current
        if (!currentStage) {
          return
        }

        const currentRect = currentStage.getBoundingClientRect()
        const x = Math.max(
          0,
          Math.min(100 - target.w, ((moveEvent.clientX - currentRect.left) / currentRect.width) * 100 - offsetXPercent),
        )
        const y = Math.max(
          0,
          Math.min(100 - target.h, ((moveEvent.clientY - currentRect.top) / currentRect.height) * 100 - offsetYPercent),
        )

        currentContent = {
          ...currentContent,
          targets: currentContent.targets.map((item) => (
            item.id === target.id
              ? {
                ...item,
                x: Math.round(x * 100) / 100,
                y: Math.round(y * 100) / 100,
              }
              : item
          )),
        }

        updateDraft(currentContent)
      }

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        setDraggingTargetId(null)
        void commit(currentContent)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp, { once: true })
    }

    function renderTargetsPanel() {
      return (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Areas e gabarito</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Edite posicao, tamanho e a resposta correta de cada hotspot.
              </p>
            </div>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
              {content.targets.length} area(s)
            </span>
          </div>

          <div className="space-y-4">
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
                      {content.tokens.map((token, tokenIndex) => (
                        <option key={token.id} value={token.id}>
                          {token.label.trim() || `Rotulo ${tokenIndex + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }

    function renderTargetsSidebar() {
      return (
        <aside className="self-start rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Areas no canvas</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Selecione uma area para destacar no canvas ou abrir o ajuste detalhado.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700 shadow-sm">
              {content.targets.length}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-slate-200 bg-white"
              onClick={() => setSelectedTargetId(null)}
              disabled={!selectedTargetId}
            >
              Limpar selecao
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
              onClick={() => setIsTargetsModalOpen(true)}
            >
              Ajuste detalhado
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {content.targets.map((target, index) => {
              const assignedToken = content.tokens.find((token) => token.id === assignedTokenBySlot.get(target.id))
              const isSelected = selectedTargetId === target.id

              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => setSelectedTargetId(target.id)}
                  className={cn(
                    'block w-full rounded-[24px] border bg-white p-4 text-left shadow-sm transition-all',
                    isSelected
                      ? 'border-cyan-300 shadow-cyan-100/80 ring-4 ring-cyan-100'
                      : 'border-slate-200 hover:border-cyan-200 hover:bg-cyan-50/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Area {index + 1}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {Math.round(target.x)}% / {Math.round(target.y)}%
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-black text-slate-900">
                    {target.label?.trim() || `Area ${index + 1}`}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Resposta: {assignedToken?.label.trim() || `Rotulo ${index + 1}`}
                  </p>
                </button>
              )
            })}
          </div>
        </aside>
      )
    }

    return (
      <div className="space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Imagem base</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Envie ou substitua a imagem usada como base visual do exercicio.
              </p>
            </div>

            <div className="flex items-center gap-3">
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
                {isUploadingAsset ? 'Enviando...' : content.asset.signed_url ? 'Trocar imagem' : 'Enviar imagem'}
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Area de canvas</p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Clique na imagem para criar novas areas e ajuste o zoom para posicionar melhor cada hotspot.
                  </p>
                </div>
                <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 md:flex">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zoom</span>
                  {[0.75, 1, 1.5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={cn(
                        'rounded-xl px-2 py-1 text-xs font-black transition-colors',
                        Math.abs(canvasScale - preset) < 0.01
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-cyan-700',
                      )}
                      onClick={() => setCanvasScale(preset)}
                    >
                      {Math.round(preset * 100)}%
                    </button>
                  ))}
                </div>
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
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 shadow-sm">
                  {canvasScalePercent}%
                </span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="overflow-auto rounded-[28px] border border-slate-200 bg-slate-50/30 p-3">
                  <div
                    className="mx-auto transition-[width] duration-200"
                    style={{
                      width: `${canvasScalePercent}%`,
                      minWidth: canvasScale > 1 ? `${canvasScalePercent}%` : '320px',
                    }}
                  >
                    <div
                      ref={stageRef}
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
                            draggingTargetId === target.id ? 'cursor-grabbing' : 'cursor-grab',
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
                          onPointerDown={(event) => startTargetDrag(event, target)}
                        >
                          {target.label?.trim() || `Area ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 rounded-2xl text-left"
                    onClick={() => setIsAssetMetadataOpen((current) => !current)}
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Metadados do asset</p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        {isAssetMetadataOpen
                          ? 'Edite texto alternativo e confira as dimensoes da imagem.'
                          : 'Clique para abrir texto alternativo, largura e altura.'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
                      {isAssetMetadataOpen ? 'Fechar' : 'Abrir'}
                      <svg
                        className={cn('h-4 w-4 transition-transform', isAssetMetadataOpen ? 'rotate-180' : '')}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {isAssetMetadataOpen ? (
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
                  ) : null}
                </div>
              </div>

              {renderTargetsSidebar()}
            </div>
          </div>
        </section>
        {isTargetsModalOpen ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[40px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 p-8">
                <div>
                  <h3 className="text-left text-xl font-black tracking-tight text-slate-900">Areas e Gabarito</h3>
                  <p className="mt-1 text-left text-sm font-medium text-slate-500">
                    Ajuste cada hotspot sem comprimir o canvas principal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTargetsModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 p-8">
                {renderTargetsPanel()}
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 p-8">
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-slate-900 px-6 font-black text-white hover:bg-slate-800"
                  onClick={() => setIsTargetsModalOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function renderFillInTheBlanksEditor(content: FillInTheBlanksInteractionContent) {
    const items = buildFillBlankBuilderItems(content, answerKeyPayload)
    const expandedItemId = items.some((item) => item.blankId === openFillBlankId)
      ? openFillBlankId
      : items[0]?.blankId ?? null

    function updateItemsDraft(nextItems: FillBlankBuilderItem[]) {
      const nextBundle = buildFillBlankBundle(content.instruction, nextItems)
      updateDraft(nextBundle.content, nextBundle.answerKey)
    }

    function commitItems(nextItems: FillBlankBuilderItem[]) {
      const nextBundle = buildFillBlankBundle(content.instruction, nextItems)
      return commit(nextBundle.content, nextBundle.answerKey)
    }

    function patchItems(blankId: string, updates: Partial<FillBlankBuilderItem>) {
      return items.map((item) => (
        item.blankId === blankId
          ? { ...item, ...updates }
          : item
      ))
    }

    function updateItem(blankId: string, updates: Partial<FillBlankBuilderItem>) {
      updateItemsDraft(patchItems(blankId, updates))
    }

    function addPromptItem() {
      const nextIndex = items.length + 1
      const nextItem: FillBlankBuilderItem = {
        blankId: crypto.randomUUID(),
        tokenId: crypto.randomUUID(),
        beforeText: '',
        afterText: '',
        placeholder: `lacuna ${nextIndex}`,
        answerText: `Resposta ${nextIndex}`,
      }
      const nextItems = [...items, nextItem]
      setOpenFillBlankId(nextItem.blankId)
      void commitItems(nextItems)
    }

    function removePromptItem(blankId: string) {
      if (items.length === 1) {
        onError('Mantenha ao menos uma pergunta com lacuna neste exercicio.')
        return
      }

      const nextItems = items.filter((item) => item.blankId !== blankId)
      const fallbackOpenId = nextItems[0]?.blankId ?? null
      setOpenFillBlankId((current) => (current === blankId ? fallbackOpenId : current))
      void commitItems(nextItems)
    }

    return (
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Perguntas com lacunas</p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Cada card representa uma frase com uma lacuna. Abra, preencha os campos e defina a resposta correta no mesmo lugar.
            </p>
          </div>

          <Button
            type="button"
            className="rounded-2xl bg-teal-600 px-5 hover:bg-teal-700"
            onClick={addPromptItem}
          >
            Adicionar nova pergunta
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {items.map((item, index) => {
            const isOpen = expandedItemId === item.blankId
            const previewLabel = item.answerText.trim() || item.placeholder.trim() || 'Sem resposta definida'

            return (
              <div key={item.blankId} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2 px-5 py-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left transition-colors hover:text-teal-700"
                    onClick={() => setOpenFillBlankId((current) => current === item.blankId ? null : item.blankId)}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-teal-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
                          Pergunta {index + 1}
                        </span>
                        <span className="truncate text-sm font-semibold text-slate-700">
                          {previewLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        {item.beforeText.trim() || item.afterText.trim()
                          ? 'Texto configurado'
                          : 'Clique para escrever a frase e definir a lacuna.'}
                      </p>
                    </div>

                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
                      <svg className={cn('h-4 w-4 transition-transform', isOpen ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    onClick={() => removePromptItem(item.blankId)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {isOpen ? (
                  <div className="space-y-5 border-t border-slate-200 bg-white px-5 py-5">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Texto antes da lacuna</span>
                        <textarea
                          className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                          value={item.beforeText}
                          onChange={(event) => updateItem(item.blankId, { beforeText: event.target.value })}
                          onBlur={(event) => void commitItems(patchItems(item.blankId, { beforeText: event.currentTarget.value }))}
                          placeholder="Ex.: A fisiologia é a ciência que estuda..."
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Texto depois da lacuna</span>
                        <textarea
                          className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                          value={item.afterText}
                          onChange={(event) => updateItem(item.blankId, { afterText: event.target.value })}
                          onBlur={(event) => void commitItems(patchItems(item.blankId, { afterText: event.currentTarget.value }))}
                          placeholder="Ex.: ...dos seres vivos."
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Placeholder da lacuna</span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                          value={item.placeholder}
                          onChange={(event) => updateItem(item.blankId, { placeholder: event.target.value })}
                          onBlur={(event) => void commitItems(patchItems(item.blankId, { placeholder: event.currentTarget.value }))}
                          placeholder="Ex.: termo principal"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resposta correta</span>
                        <input
                          className="w-full rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                          value={item.answerText}
                          onChange={(event) => updateItem(item.blankId, { answerText: event.target.value })}
                          onBlur={(event) => void commitItems(patchItems(item.blankId, { answerText: event.currentTarget.value }))}
                          placeholder="Digite a resposta correta completa"
                        />
                      </label>
                    </div>

                    <div className="rounded-[24px] border border-teal-100 bg-teal-50/60 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-700">Preview da pergunta</p>
                      <p className="mt-4 text-base leading-8 text-slate-700">
                        {item.beforeText || <span className="text-slate-400">Texto antes da lacuna</span>}
                        <span className="mx-2 inline-flex min-w-[140px] items-center justify-center rounded-2xl border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700 shadow-sm">
                          {item.answerText || item.placeholder || 'Lacuna'}
                        </span>
                        {item.afterText || <span className="text-slate-400">Texto depois da lacuna</span>}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
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
                description: scoringItemCount > 0
                  ? `A nota desta pergunta sera dividida entre ${scoringItemCount} item(ns). Cada item correto vale ${formatPoints(pointsPerItem)} ponto(s).`
                  : 'A nota desta pergunta sera dividida igualmente entre os itens corretos.',
              },
              {
                value: 'all_or_nothing' as const,
                title: 'Tudo ou nada',
                description: scoringItemCount > 0
                  ? `O aluno so recebe os ${formatPoints(questionPoints)} ponto(s) desta pergunta se acertar todos os ${scoringItemCount} item(ns). Se errar 1, recebe 0.`
                  : 'O aluno so pontua se acertar todos os itens da pergunta.',
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

      {activeInteraction.kind === 'drag_drop_labeling' ? renderTokenBank() : null}

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
