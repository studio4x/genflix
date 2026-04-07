import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  AssessmentQuestionAnswerKey,
  AssessmentQuestionAnswerKeyPayload,
  AssessmentQuestionInteraction,
  AssessmentInteractionContent,
  AssessmentQuestionType,
  ColoringInteractionContent,
  DragDropLabelingInteractionContent,
  FillInTheBlanksInteractionContent,
  LegacyColoringInteractionContent,
} from '@/types/content'

import {
  createAnswerKeyFromInteraction,
  createDefaultInteractionContent,
  getColoringRenderMode,
  getColoringSlotIds,
  getInteractionSlotIds,
  validateInteractionBundle,
} from '@/features/assessments/gamified'
import {
  applyColoringSvgRuntimeState,
  getColoringSvgRegionIdFromEventTarget,
  isSvgFile,
  parseColoringSvgFile,
} from '@/features/assessments/coloring-svg'

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

type CanvasInteractionContent = DragDropLabelingInteractionContent | LegacyColoringInteractionContent
const COLORING_POINT_SIZE_PERCENT = 1.4
const COLOR_NAME_SUGGESTIONS = [
  { label: 'Branco', hex: '#ffffff' },
  { label: 'Preto', hex: '#111827' },
  { label: 'Cinza', hex: '#94a3b8' },
  { label: 'Azul', hex: '#2563eb' },
  { label: 'Azul Claro', hex: '#38bdf8' },
  { label: 'Azul Escuro', hex: '#1d4ed8' },
  { label: 'Verde', hex: '#16a34a' },
  { label: 'Verde Claro', hex: '#22c55e' },
  { label: 'Verde Escuro', hex: '#166534' },
  { label: 'Vermelho', hex: '#dc2626' },
  { label: 'Laranja', hex: '#f97316' },
  { label: 'Amarelo', hex: '#facc15' },
  { label: 'Dourado', hex: '#ca8a04' },
  { label: 'Roxo', hex: '#7c3aed' },
  { label: 'Rosa', hex: '#db2777' },
  { label: 'Marrom', hex: '#8b5e3c' },
  { label: 'Bege', hex: '#d6b48a' },
  { label: 'Ciano', hex: '#06b6d4' },
  { label: 'Turquesa', hex: '#14b8a6' },
] as const

const SVG_COLORING_EXAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" fill="none">
  <path id="teto" d="M318 206L514 166H742L880 218L786 260H360L318 206Z" fill="none" stroke="#111827" stroke-width="8"/>
  <path id="porta-esquerda" d="M392 312H520V560H392Z" fill="none" stroke="#111827" stroke-width="8"/>
  <g data-region-id="capo">
    <path d="M650 318H926L892 468H650V318Z" fill="none" stroke="#111827" stroke-width="8"/>
  </g>
</svg>`

function shouldOpenSvgInstructions(message: string) {
  const normalizedMessage = message.toLowerCase()

  return normalizedMessage.includes('regioes utilizaveis no svg')
    || normalizedMessage.includes('como preparar svg')
    || normalizedMessage.includes('modo de colorir por regioes')
    || normalizedMessage.includes('data-region-id')
    || normalizedMessage.includes('pecas pintaveis')
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
  if (normalizedContent.kind === 'fill_in_the_blanks' && normalizedContent.editor_groups?.length) {
    const slotIds = new Set(getInteractionSlotIds(normalizedContent))
    const tokenIds = new Set(normalizedContent.tokens.map((token) => token.id))

    return {
      entries: normalizedContent.editor_groups.flatMap((group) =>
        group.blanks
          .filter((blank) => slotIds.has(blank.blank_id) && tokenIds.has(blank.token_id))
          .map((blank) => ({
            slot_id: blank.blank_id,
            token_id: blank.token_id,
          })),
      ),
    } satisfies AssessmentQuestionAnswerKeyPayload
  }

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
) : AssessmentInteractionContent {
  if (content.kind !== 'drag_drop_labeling' && content.kind !== 'coloring') {
    return content
  }

  if (content.kind === 'coloring' && 'targets' in content) {
    content = {
      ...content,
      render_mode: 'legacy_rect',
      targets: content.targets.map((target, index) => ({
        ...target,
        w: COLORING_POINT_SIZE_PERCENT,
        h: COLORING_POINT_SIZE_PERCENT,
        label: target.label?.trim() || `Ponto ${index + 1}`,
      })),
    } satisfies LegacyColoringInteractionContent
  }

  const tokenById = new Map(content.tokens.map((token) => [token.id, token]))
  const usedTokenIds = new Set<string>()

  if (content.kind === 'coloring') {
    const coloringSlotIds = getColoringSlotIds(content)
    const normalizedTokens: ColoringInteractionContent['tokens'] = coloringSlotIds.map((slotId, index) => {
      const mappedTokenId = current?.entries.find((entry) => entry.slot_id === slotId)?.token_id
      if (mappedTokenId) {
        const mappedToken = tokenById.get(mappedTokenId)
        if (mappedToken && !usedTokenIds.has(mappedToken.id) && 'hex' in mappedToken) {
          usedTokenIds.add(mappedToken.id)
          return {
            id: mappedToken.id,
            label: resolveColorTokenLabel(mappedToken.label, mappedToken.hex, index),
            hex: mappedToken.hex,
          }
        }
      }

      const fallbackToken = content.tokens.find((token) => !usedTokenIds.has(token.id))
      if (fallbackToken) {
        usedTokenIds.add(fallbackToken.id)
        return {
          id: fallbackToken.id,
          label: resolveColorTokenLabel(fallbackToken.label, fallbackToken.hex, index),
          hex: fallbackToken.hex,
        }
      }

      const nextToken = {
        id: crypto.randomUUID(),
        label: getSuggestedColorLabel(['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed', '#db2777'][index % 6]!),
        hex: ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed', '#db2777'][index % 6],
      }
      usedTokenIds.add(nextToken.id)
      return nextToken
    })

    return {
      ...content,
      tokens: normalizedTokens,
    } satisfies ColoringInteractionContent
  }

  const normalizedTokens: DragDropLabelingInteractionContent['tokens'] = content.targets.map((target, index) => {
    const mappedTokenId = current?.entries.find((entry) => entry.slot_id === target.id)?.token_id
    if (mappedTokenId) {
      const mappedToken = tokenById.get(mappedTokenId)
      if (mappedToken && !usedTokenIds.has(mappedToken.id)) {
        usedTokenIds.add(mappedToken.id)
        return {
          id: mappedToken.id,
          label: mappedToken.label,
        }
      }
    }

    const fallbackToken = content.tokens.find((token) => !usedTokenIds.has(token.id))
    if (fallbackToken) {
      usedTokenIds.add(fallbackToken.id)
      return {
        id: fallbackToken.id,
        label: fallbackToken.label,
      }
    }

    const nextToken = {
      id: crypto.randomUUID(),
      label: `Rotulo ${index + 1}`,
    }
    usedTokenIds.add(nextToken.id)
    return nextToken
  })

  return {
    ...content,
    tokens: normalizedTokens,
  }
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
      reject(new Error('Não foi possível ler a imagem selecionada.'))
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
    return 'Configure a interação e o gabarito para habilitar a correção automática.'
  }

  try {
    validateInteractionBundle(questionType, content, answerKey)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Interação inválida.'
  }
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().toLowerCase()
  const match = normalized.match(/^#([0-9a-f]{6})$/)
  if (!match) {
    return null
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function getSuggestedColorLabel(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return 'Cor'
  }

  let bestMatch: string = COLOR_NAME_SUGGESTIONS[0]?.label ?? 'Cor'
  let bestDistance = Number.POSITIVE_INFINITY

  for (const suggestion of COLOR_NAME_SUGGESTIONS) {
    const suggestionRgb = hexToRgb(suggestion.hex)
    if (!suggestionRgb) {
      continue
    }

    const distance = Math.sqrt(
      ((rgb.r - suggestionRgb.r) ** 2)
      + ((rgb.g - suggestionRgb.g) ** 2)
      + ((rgb.b - suggestionRgb.b) ** 2),
    )

    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = suggestion.label
    }
  }

  return bestMatch
}

function isGenericColorLabel(label: string, index: number) {
  const normalized = label.trim().toLowerCase()
  return normalized.length === 0 || normalized === `cor ${index + 1}` || /^cor\s+\d+$/i.test(normalized)
}

function resolveColorTokenLabel(label: string, hex: string, index: number) {
  return isGenericColorLabel(label, index) ? getSuggestedColorLabel(hex) : label
}

function getPointBadgeTextColor(hex?: string | null) {
  if (!hex || !/^#([0-9a-fA-F]{6})$/.test(hex)) {
    return '#0f172a'
  }

  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  const luminance = ((0.299 * red) + (0.587 * green) + (0.114 * blue)) / 255

  return luminance > 0.7 ? '#0f172a' : '#ffffff'
}

function getCanvasTargetTemplate(content: CanvasInteractionContent, index: number) {
  if (content.kind === 'coloring') {
    return {
      w: COLORING_POINT_SIZE_PERCENT,
      h: COLORING_POINT_SIZE_PERCENT,
      label: `Ponto ${index + 1}`,
    }
  }

  return {
    w: 18,
    h: 10,
    label: `Area ${index + 1}`,
  }
}

function buildColoringPointTargetsFromRegions(
  content: Extract<ColoringInteractionContent, { render_mode: 'svg_regions' }>,
): LegacyColoringInteractionContent['targets'] {
  const count = Math.max(content.regions.length, 1)
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))))
  const rows = Math.max(1, Math.ceil(count / columns))

  return content.regions.map((region, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const centerX = columns === 1 ? 50 : 14 + (column * (72 / Math.max(columns - 1, 1)))
    const centerY = rows === 1 ? 50 : 18 + (row * (60 / Math.max(rows - 1, 1)))

    return {
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(100 - COLORING_POINT_SIZE_PERCENT, Math.round((centerX - (COLORING_POINT_SIZE_PERCENT / 2)) * 100) / 100)),
      y: Math.max(0, Math.min(100 - COLORING_POINT_SIZE_PERCENT, Math.round((centerY - (COLORING_POINT_SIZE_PERCENT / 2)) * 100) / 100)),
      w: COLORING_POINT_SIZE_PERCENT,
      h: COLORING_POINT_SIZE_PERCENT,
      label: region.label?.trim() || `Ponto ${index + 1}`,
    }
  })
}

function createColoringPointsContent(source: ColoringInteractionContent): LegacyColoringInteractionContent {
  if ('targets' in source) {
    return {
      ...source,
      render_mode: 'legacy_rect',
      targets: source.targets.map((target, index) => ({
        ...target,
        w: COLORING_POINT_SIZE_PERCENT,
        h: COLORING_POINT_SIZE_PERCENT,
        label: target.label?.trim() || `Ponto ${index + 1}`,
      })),
    }
  }

  return {
    kind: 'coloring',
    render_mode: 'legacy_rect',
    instruction: source.instruction,
    asset: source.asset,
    tokens: source.tokens,
    targets: buildColoringPointTargetsFromRegions(source),
  }
}

function createSvgColoringPlaceholderContent(source: ColoringInteractionContent) {
  const defaultContent = createDefaultInteractionContent('coloring')
  if (!defaultContent || defaultContent.kind !== 'coloring' || !('regions' in defaultContent)) {
    return null
  }

  const fallbackToken = source.tokens[0] ?? defaultContent.tokens[0]

  return {
    ...defaultContent,
    instruction: source.instruction,
    asset: {
      ...defaultContent.asset,
      alt: source.asset.alt || defaultContent.asset.alt,
    },
    tokens: fallbackToken ? [{ ...fallbackToken }] : defaultContent.tokens,
  } satisfies Extract<ColoringInteractionContent, { render_mode: 'svg_regions' }>
}

type FillBlankEditorGroup = NonNullable<FillInTheBlanksInteractionContent['editor_groups']>[number]
type FillBlankEditorBlank = FillBlankEditorGroup['blanks'][number]

function buildFillBlankEditorGroups(
  content: FillInTheBlanksInteractionContent,
  answerKey: AssessmentQuestionAnswerKeyPayload | null,
) {
  const tokenById = new Map(content.tokens.map((token) => [token.id, token]))
  const tokenIdBySlot = new Map((answerKey?.entries ?? []).map((entry) => [entry.slot_id, entry.token_id]))
  const storedGroups = content.editor_groups?.filter((group) => group.blanks.length > 0) ?? []

  if (storedGroups.length > 0) {
    return storedGroups.map((group) => ({
      id: group.id,
      leading_text: group.leading_text,
      blanks: group.blanks.map((blank) => {
        const resolvedTokenId = tokenIdBySlot.get(blank.blank_id) ?? blank.token_id
        return {
          ...blank,
          token_id: resolvedTokenId,
          answer_text: tokenById.get(resolvedTokenId)?.label ?? blank.answer_text,
          trailing_text: blank.trailing_text ?? '',
          placeholder: blank.placeholder ?? '',
        }
      }),
      extra_tokens: (group.extra_tokens ?? []).map((token) => ({
        id: token.id,
        label: tokenById.get(token.id)?.label ?? token.label ?? '',
      })),
    })) satisfies FillBlankEditorGroup[]
  }

  const fallbackGroups: FillBlankEditorGroup[] = []
  let currentGroup: FillBlankEditorGroup = {
    id: crypto.randomUUID(),
    leading_text: '',
    blanks: [],
    extra_tokens: [],
  }

  let pendingText = ''
  const usedTokenIds = new Set<string>()

  for (const segment of content.segments) {
    if (segment.type === 'text') {
      pendingText += segment.text
      continue
    }

    if (currentGroup.blanks.length === 0) {
      currentGroup.leading_text = pendingText
    } else {
      currentGroup.blanks[currentGroup.blanks.length - 1]!.trailing_text = pendingText
    }

    pendingText = ''

    const tokenId = tokenIdBySlot.get(segment.id)
      ?? content.tokens[currentGroup.blanks.length]?.id
      ?? crypto.randomUUID()
    usedTokenIds.add(tokenId)

    currentGroup.blanks.push({
      blank_id: segment.id,
      token_id: tokenId,
      placeholder: segment.placeholder ?? '',
      answer_text: tokenById.get(tokenId)?.label ?? '',
      trailing_text: '',
    })
  }

  if (currentGroup.blanks.length > 0) {
    currentGroup.blanks[currentGroup.blanks.length - 1]!.trailing_text = pendingText
    currentGroup.extra_tokens = content.tokens.filter((token) => !usedTokenIds.has(token.id))
    fallbackGroups.push(currentGroup)
  }

  if (fallbackGroups.length === 0) {
    fallbackGroups.push({
      id: crypto.randomUUID(),
      leading_text: content.segments
        .filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'text' }> => segment.type === 'text')
        .map((segment) => segment.text)
        .join(''),
      blanks: [
        {
          blank_id: crypto.randomUUID(),
          token_id: content.tokens[0]?.id ?? crypto.randomUUID(),
          placeholder: '',
          answer_text: content.tokens[0]?.label ?? '',
          trailing_text: '',
        },
      ],
      extra_tokens: [],
    })
  }

  return fallbackGroups
}

function buildFillBlankBundle(
  instruction: string,
  groups: FillBlankEditorGroup[],
) {
  const tokens: FillInTheBlanksInteractionContent['tokens'] = []
  const segments: FillInTheBlanksInteractionContent['segments'] = []
  const entries: AssessmentQuestionAnswerKeyPayload['entries'] = []

  groups.forEach((group, groupIndex) => {
    if (group.leading_text.length > 0) {
      segments.push({
        type: 'text',
        text: group.leading_text,
      })
    }

    group.blanks.forEach((blank) => {
      tokens.push({
        id: blank.token_id,
        label: blank.answer_text,
      })
      segments.push({
        type: 'blank',
        id: blank.blank_id,
        placeholder: blank.placeholder || undefined,
      })
      entries.push({
        slot_id: blank.blank_id,
        token_id: blank.token_id,
      })

      if (blank.trailing_text.length > 0) {
        segments.push({
          type: 'text',
          text: blank.trailing_text,
        })
      }
    })

    for (const extraToken of group.extra_tokens ?? []) {
      if (!extraToken.label.trim()) {
        continue
      }

      tokens.push({
        id: extraToken.id,
        label: extraToken.label,
      })
    }

    if (groupIndex < groups.length - 1) {
      segments.push({
        type: 'text',
        text: '\n\n',
      })
    }
  })

  return {
    content: {
      kind: 'fill_in_the_blanks',
      instruction,
      segments: segments.length > 0 ? segments : [{ type: 'text', text: '' }],
      tokens,
      editor_groups: groups,
    } satisfies FillInTheBlanksInteractionContent,
    answerKey: {
      entries,
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
  const svgStageRef = useRef<HTMLDivElement | null>(null)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [draggingTargetId, setDraggingTargetId] = useState<string | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [isAssetMetadataOpen, setIsAssetMetadataOpen] = useState(false)
  const [isAdvancedAnswerToolsOpen, setIsAdvancedAnswerToolsOpen] = useState(false)
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false)
  const [isSvgInstructionsModalOpen, setIsSvgInstructionsModalOpen] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [openFillBlankId, setOpenFillBlankId] = useState<string | null | undefined>(undefined)

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
  const scoringItemCount = activeInteraction.kind === 'drag_drop_labeling' || activeInteraction.kind === 'coloring'
    ? getInteractionSlotIds(activeInteraction).length
    : activeInteraction.segments.filter((segment) => segment.type === 'blank').length
  const questionPoints = Number(question.points || 0)
  const pointsPerItem = scoringItemCount > 0 ? questionPoints / scoringItemCount : 0

  const assignedTokenBySlot = new Map(
    (answerKeyPayload?.entries ?? []).map((entry) => [entry.slot_id, entry.token_id]),
  )
  const latestInteractionRef = useRef<AssessmentInteractionContent>(interactionContent)
  const latestAnswerKeyRef = useRef<AssessmentQuestionAnswerKeyPayload | null>(answerKeyPayload)
  const activeColoringSvgInteraction = activeInteraction.kind === 'coloring' && 'regions' in activeInteraction
    ? activeInteraction
    : null
  const isColoringSvgMode = Boolean(activeColoringSvgInteraction)

  latestInteractionRef.current = interactionContent
  latestAnswerKeyRef.current = answerKeyPayload

  useEffect(() => {
    if (!isColoringSvgMode) {
      return
    }

    if (selectedTargetId && activeColoringSvgInteraction?.regions.some((region) => region.region_id === selectedTargetId)) {
      return
    }

    setSelectedTargetId(activeColoringSvgInteraction?.regions[0]?.region_id ?? null)
  }, [activeColoringSvgInteraction, isColoringSvgMode, selectedTargetId])

  useEffect(() => {
    if (!activeColoringSvgInteraction) {
      return
    }

    applyColoringSvgRuntimeState(svgStageRef.current, {
      regionAssignments: Object.fromEntries(assignedTokenBySlot),
      colorHexByTokenId: new Map(activeColoringSvgInteraction.tokens.map((token) => [token.id, token.hex])),
      selectedRegionId: selectedTargetId,
      interactive: true,
    })
  }, [activeColoringSvgInteraction, assignedTokenBySlot, selectedTargetId])

  async function commit(
    content: AssessmentInteractionContent,
    answerKey = syncAnswerKeyWithContent(content, answerKeyPayload),
    nextGradingMode = gradingMode,
  ) {
    const normalizedContent = normalizeInteractionContent(content, answerKey)
    const normalizedAnswerKey = syncAnswerKeyWithContent(normalizedContent, answerKey)
    latestInteractionRef.current = normalizedContent
    latestAnswerKeyRef.current = normalizedAnswerKey
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
    latestInteractionRef.current = normalizedContent
    latestAnswerKeyRef.current = normalizedAnswerKey
    onDraftChange({
      interaction: createInteractionRecord(question, normalizedContent),
      answer_key: createAnswerKeyRecord(question, normalizedAnswerKey, nextGradingMode),
    })
  }

  function commitLatestDraft(nextGradingMode = gradingMode) {
    return commit(
      latestInteractionRef.current,
      latestAnswerKeyRef.current ?? syncAnswerKeyWithContent(latestInteractionRef.current, answerKeyPayload),
      nextGradingMode,
    )
  }

  function updateTokenLabel(tokenId: string, label: string) {
    const nextContent: AssessmentInteractionContent = activeInteraction.kind === 'coloring'
      ? {
        ...activeInteraction,
        tokens: activeInteraction.tokens.map((token) => (
          token.id === tokenId
            ? { ...token, label }
            : token
        )),
      }
      : {
        ...activeInteraction,
        tokens: activeInteraction.tokens.map((token) => (
          token.id === tokenId
            ? { ...token, label }
            : token
        )),
      }

    updateDraft(nextContent)
  }

  function applyColorHexToContent(content: ColoringInteractionContent, tokenId: string, hex: string) {
    return {
      ...content,
      tokens: content.tokens.map((token, index) => {
        if (token.id !== tokenId) {
          return token
        }

        const nextLabel = (
          isGenericColorLabel(token.label, index)
          || token.label.trim().toLowerCase() === getSuggestedColorLabel(token.hex).toLowerCase()
        )
          ? getSuggestedColorLabel(hex)
          : token.label

        return {
          ...token,
          hex,
          label: nextLabel,
        }
      }),
    } satisfies ColoringInteractionContent
  }

  function updateColorHex(tokenId: string, hex: string) {
    if (activeInteraction.kind !== 'coloring') {
      return
    }

    const nextContent = applyColorHexToContent(activeInteraction, tokenId, hex)

    updateDraft(nextContent)
  }

  function addToken() {
    if (activeInteraction.kind !== 'fill_in_the_blanks') {
      onError('No arrastar e soltar, o banco de respostas acompanha automaticamente a quantidade de áreas.')
      return
    }

    const nextContent: FillInTheBlanksInteractionContent = {
      ...activeInteraction,
      tokens: [
        ...activeInteraction.tokens,
        {
          id: crypto.randomUUID(),
          label: `Resposta ${activeInteraction.tokens.length + 1}`,
        },
      ],
    }

    void commit(nextContent)
  }

  function deleteToken(tokenId: string) {
    if (activeInteraction.kind !== 'fill_in_the_blanks') {
      onError('Remova ou adicione áreas para sincronizar o banco de respostas deste exercício.')
      return
    }

    if (activeInteraction.tokens.length === 1) {
      onError('Mantenha ao menos um item no banco de respostas.')
      return
    }

    const nextContent: FillInTheBlanksInteractionContent = {
      ...activeInteraction,
      tokens: activeInteraction.tokens.filter((token) => token.id !== tokenId),
    }

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
    if (!file || (activeInteraction.kind !== 'drag_drop_labeling' && activeInteraction.kind !== 'coloring')) {
      return
    }

    setIsUploadingAsset(true)
    setAssetError(null)
    onError(null)

    try {
      const previousStoragePath = activeInteraction.asset.storage_path
      const uploaded = await uploadAssessmentAsset(file)
      let nextContent: AssessmentInteractionContent

      if (activeInteraction.kind === 'coloring' && getColoringRenderMode(activeInteraction) === 'svg_regions') {
        if (!isSvgFile(file)) {
          throw new Error('No modo SVG, envie um arquivo .svg com id ou data-region-id nas pecas pintaveis.')
        }

        const svgAsset = await parseColoringSvgFile(file)
        nextContent = {
          ...activeInteraction,
          render_mode: 'svg_regions',
          svg_markup: svgAsset.svgMarkup,
          regions: svgAsset.regions,
          asset: {
            storage_path: uploaded.storage_path,
            signed_url: uploaded.signed_url,
            alt: activeInteraction.asset.alt || file.name,
            width: svgAsset.width,
            height: svgAsset.height,
          },
        } satisfies ColoringInteractionContent
      } else {
        const dimensions = await readImageDimensions(file)
        nextContent = {
          ...(activeInteraction as CanvasInteractionContent),
          asset: {
            storage_path: uploaded.storage_path,
            signed_url: uploaded.signed_url,
            alt: activeInteraction.asset.alt || file.name,
            width: dimensions.width,
            height: dimensions.height,
          },
        }
      }

      await commit(nextContent)
      setAssetError(null)

      if (previousStoragePath && previousStoragePath !== uploaded.storage_path) {
        void deleteAssessmentAsset(previousStoragePath).catch(() => null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar a imagem do exercicio.'
      if (shouldOpenSvgInstructions(message)) {
        setIsSvgInstructionsModalOpen(true)
      }
      setAssetError(message)
    } finally {
      setIsUploadingAsset(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  async function switchColoringMode(nextMode: 'svg_regions' | 'legacy_rect') {
    if (activeInteraction.kind !== 'coloring') {
      return
    }

    const currentMode = getColoringRenderMode(activeInteraction)
    if (currentMode === nextMode) {
      return
    }

    setAssetError(null)
    setSelectedTargetId(null)
    onError(null)

    if (nextMode === 'svg_regions') {
      const nextContent = createSvgColoringPlaceholderContent(activeInteraction)
      if (!nextContent) {
        onError('Nao foi possivel preparar o modo SVG do quiz de colorir.')
        return
      }

      await commit(nextContent)
      setSelectedTargetId(nextContent.regions[0]?.region_id ?? null)
      return
    }

    const nextContent = createColoringPointsContent(activeInteraction)
    await commit(nextContent)
    setSelectedTargetId(nextContent.targets[0]?.id ?? null)
  }

  function renderAssetError() {
    if (!assetError) {
      return null
    }

    return (
      <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-relaxed text-rose-700">
        {assetError}
      </div>
    )
  }

  function renderColoringModeSelector() {
    if (activeInteraction.kind !== 'coloring') {
      return null
    }

    const currentMode = getColoringRenderMode(activeInteraction)

    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Tipo de imagem</p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Escolha entre um SVG com regioes identificadas ou uma imagem comum para posicionar pontos pequenos.
            </p>
          </div>
          <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-2">
            {[
              {
                value: 'svg_regions' as const,
                title: 'SVG com regioes',
                description: 'Use SVG com id ou data-region-id em cada peca pintavel para preencher a forma real.',
              },
              {
                value: 'legacy_rect' as const,
                title: 'Imagem normal com pontos',
                description: 'Use PNG, JPG ou SVG comum para posicionar um ponto pequeno indicando o local da cor.',
              },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={cn(
                  'rounded-[24px] border px-4 py-4 text-left transition-all',
                  currentMode === mode.value
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/60',
                )}
                onClick={() => void switchColoringMode(mode.value)}
              >
                <p className="text-sm font-black">{mode.title}</p>
                <p className="mt-2 text-xs font-medium leading-relaxed">{mode.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    )
  }

  function renderTokenBank() {
    const coloringSlotIds = activeInteraction.kind === 'coloring'
      ? getColoringSlotIds(activeInteraction)
      : []

    return (
      <section className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Banco de respostas</p>
            <p className="mt-2 text-sm font-medium text-cyan-950">
              {activeInteraction.kind === 'drag_drop_labeling'
                ? 'No arrastar e soltar, cada área cria automaticamente um campo correspondente no banco de respostas.'
                : 'Cada item do banco deve ser associado a uma única área ou lacuna nesta v1.'}
            </p>
          </div>

          {activeInteraction.kind !== 'drag_drop_labeling' && activeInteraction.kind !== 'coloring' ? (
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
                  {activeInteraction.kind === 'drag_drop_labeling'
                    ? `Area ${index + 1}`
                    : activeInteraction.kind === 'coloring'
                      ? `${isColoringSvgMode ? 'Regiao' : 'Ponto'} ${index + 1}`
                      : `Item ${index + 1}`}
                </span>
                {activeInteraction.kind !== 'drag_drop_labeling' && activeInteraction.kind !== 'coloring' ? (
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

              {activeInteraction.kind === 'coloring' ? (
                <label className="mt-3 flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3">
                  <input
                    type="color"
                    className="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white"
                    value={'hex' in token ? token.hex : '#2563eb'}
                    onChange={(event) => updateColorHex(token.id, event.target.value)}
                    onBlur={(event) => {
                      const nextHex = event.currentTarget.value
                      void commit(applyColorHexToContent(activeInteraction, token.id, nextHex))
                    }}
                  />
                  <span className="text-sm font-semibold text-slate-700">{'hex' in token ? token.hex : '#2563eb'}</span>
                </label>
              ) : null}
              <input
                type="text"
                className="mt-3 w-full rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                value={token.label}
                onChange={(event) => updateTokenLabel(token.id, event.target.value)}
                onBlur={(event) => {
                  const nextLabel = event.currentTarget.value
                  if (activeInteraction.kind === 'coloring') {
                    void commit({
                      ...activeInteraction,
                      tokens: activeInteraction.tokens.map((item) => (
                        item.id === token.id
                          ? { ...item, label: nextLabel }
                          : item
                      )),
                    })
                    return
                  }

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
                placeholder={activeInteraction.kind === 'drag_drop_labeling' ? `Rótulo ${index + 1}` : activeInteraction.kind === 'coloring' ? 'Nome da cor' : 'Resposta correta exibida ao aluno. Pode ter mais de uma palavra.'}
              />
            </div>
          ))}
        </div>

        {activeInteraction.kind === 'drag_drop_labeling' || (activeInteraction.kind === 'coloring' && !isColoringSvgMode) ? (
          <div className="mt-5 rounded-2xl border border-cyan-100/80 bg-white/70 p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setIsAdvancedAnswerToolsOpen((current) => !current)}
            >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Ajuste avançado</p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    {isColoringSvgMode
                      ? 'Abra apenas se quiser revisar o gabarito das regioes detectadas.'
                      : activeInteraction.kind === 'coloring'
                        ? 'Abra apenas se quiser refinar coordenadas dos pontos ou revisar o gabarito manualmente.'
                        : 'Abra apenas se quiser refinar coordenadas, tamanho das areas ou revisar o gabarito manualmente.'}
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
                  <p className="text-sm font-black text-slate-900">
                    {activeInteraction.kind === 'coloring' ? 'Pontos e gabarito' : 'Areas e gabarito'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {activeInteraction.kind === 'coloring'
                      ? 'Edite coordenadas dos pontos e a associacao final de cada cor.'
                      : 'Edite hotspots, coordenadas, tamanhos e a associacao final de cada area.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
                  onClick={() => setIsTargetsModalOpen(true)}
                >
                  Editar {activeInteraction.kind === 'drag_drop_labeling' ? activeInteraction.targets.length : coloringSlotIds.length} {activeInteraction.kind === 'drag_drop_labeling' ? 'area(s)' : isColoringSvgMode ? 'regiao(s)' : 'ponto(s)'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    )
  }

  function renderColoringSvgEditor(content: Extract<ColoringInteractionContent, { render_mode: 'svg_regions' }>) {
    function updateRegion(regionId: string, updates: Partial<(typeof content.regions)[number]>) {
      updateDraft({
        ...content,
        regions: content.regions.map((region) => (
          region.region_id === regionId
            ? { ...region, ...updates }
            : region
        )),
      })
    }

    function commitRegion(regionId: string, updates: Partial<(typeof content.regions)[number]>) {
      void commit({
        ...content,
        regions: content.regions.map((region) => (
          region.region_id === regionId
            ? { ...region, ...updates }
            : region
        )),
      })
    }

    const selectedRegion = content.regions.find((region) => region.region_id === selectedTargetId) ?? content.regions[0] ?? null

    return (
      <div className="space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">SVG base</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Envie um SVG preparado com `id` ou `data-region-id` em cada peca pintavel.
              </p>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Precisa de ajuda para montar o arquivo? Abra o guia em modal e veja um exemplo pronto.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
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
                {isUploadingAsset ? 'Enviando...' : content.asset.storage_path ? 'Trocar SVG' : 'Enviar SVG'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                onClick={() => setIsSvgInstructionsModalOpen(true)}
              >
                Como preparar SVG
              </Button>
            </div>
          </div>

          {renderAssetError()}

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_38%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] p-3">
                <div
                  ref={svgStageRef}
                  className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white [&>svg]:h-full [&>svg]:w-full"
                  style={{ aspectRatio: `${content.asset.width || 1200} / ${content.asset.height || 800}` }}
                  dangerouslySetInnerHTML={{ __html: content.svg_markup }}
                  onClick={(event) => {
                    const regionId = getColoringSvgRegionIdFromEventTarget(event.target)
                    if (regionId) {
                      setSelectedTargetId(regionId)
                    }
                  }}
                />
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
                        ? 'Edite texto alternativo e confira as dimensoes do SVG.'
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
                        onBlur={() => void commitLatestDraft()}
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

            <aside className="self-start rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Regioes detectadas</p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Clique em uma regiao para destacar no preview e ajustar o nome interno ou a cor correta.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700 shadow-sm">
                  {content.regions.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {content.regions.map((region, index) => {
                  const assignedTokenId = assignedTokenBySlot.get(region.region_id) ?? ''
                  const assignedToken = content.tokens.find((token) => token.id === assignedTokenId) ?? null
                  const isSelected = selectedRegion?.region_id === region.region_id

                  return (
                    <div
                      key={region.region_id}
                      className={cn(
                        'rounded-[24px] border bg-white p-4 text-left shadow-sm transition-all',
                        isSelected
                          ? 'border-cyan-300 shadow-cyan-100/80 ring-4 ring-cyan-100'
                          : 'border-slate-200',
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 text-left"
                        onClick={() => setSelectedTargetId(region.region_id)}
                      >
                        <div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Regiao {index + 1}
                          </span>
                          <p className="mt-3 text-sm font-black text-slate-900">
                            {region.label?.trim() || `Regiao ${index + 1}`}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {region.region_id}
                        </span>
                      </button>

                      <div className="mt-4 space-y-3">
                        <label className="block space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome interno</span>
                          <input
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                            value={region.label ?? ''}
                            onChange={(event) => updateRegion(region.region_id, { label: event.target.value })}
                            onBlur={(event) => commitRegion(region.region_id, { label: event.currentTarget.value })}
                            placeholder={`Regiao ${index + 1}`}
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor correta</span>
                          <select
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                            value={assignedTokenId}
                            onChange={(event) => updateSlotAnswer(region.region_id, event.target.value)}
                          >
                            <option value="" disabled>Selecione uma cor</option>
                            {content.tokens.map((token, tokenIndex) => (
                              <option key={token.id} value={token.id}>
                                {token.label.trim() || `Cor ${tokenIndex + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span
                            className="h-9 w-9 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: assignedToken?.hex ?? '#E2E8F0' }}
                          />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview</p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {assignedToken?.label?.trim() || 'Nenhuma cor associada'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        </section>
      </div>
    )
  }

  function renderDragDropEditor(content: CanvasInteractionContent) {
    const canvasScalePercent = Math.round(canvasScale * 100)
    const isColoringPointMode = content.kind === 'coloring'
    const targetNoun = isColoringPointMode ? 'ponto' : 'area'
    const targetLabelPrefix = isColoringPointMode ? 'Ponto' : 'Area'
    const answerLabel = isColoringPointMode ? 'Cor correta' : 'Resposta correta'
    const editableTargetFields: Array<'x' | 'y' | 'w' | 'h'> = isColoringPointMode ? ['x', 'y'] : ['x', 'y', 'w', 'h']

    function updateTarget(
      targetId: string,
      field: keyof CanvasInteractionContent['targets'][number],
      value: string | number,
    ) {
      const nextContent: CanvasInteractionContent = {
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
      const targetTemplate = getCanvasTargetTemplate(content, content.targets.length)
      const nextContent: CanvasInteractionContent = {
        ...content,
        targets: [
          ...content.targets,
          {
            id: crypto.randomUUID(),
            x,
            y,
            w: targetTemplate.w,
            h: targetTemplate.h,
            label: targetTemplate.label,
          },
        ],
      }

      const nextAnswerKey = syncAnswerKeyWithContent(nextContent, answerKeyPayload)
      setSelectedTargetId(nextContent.targets[nextContent.targets.length - 1]?.id ?? null)
      void commit(nextContent, nextAnswerKey)
    }

    function handleStageClick(event: MouseEvent<HTMLDivElement>) {
      if (!content.asset.signed_url) {
        setAssetError(
          isColoringPointMode
            ? 'Envie uma imagem primeiro para posicionar os pontos de cor.'
            : 'Envie uma imagem primeiro para posicionar as areas.',
        )
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const targetTemplate = getCanvasTargetTemplate(content, content.targets.length)
      const x = Math.max(
        0,
        Math.min(100 - targetTemplate.w, ((event.clientX - rect.left) / rect.width) * 100 - (targetTemplate.w / 2)),
      )
      const y = Math.max(
        0,
        Math.min(100 - targetTemplate.h, ((event.clientY - rect.top) / rect.height) * 100 - (targetTemplate.h / 2)),
      )
      addTargetAt(Math.round(x * 100) / 100, Math.round(y * 100) / 100)
      }

    function removeTarget(targetId: string) {
      if (content.targets.length === 1) {
        onError(isColoringPointMode ? 'Mantenha ao menos um ponto de cor.' : 'Mantenha ao menos uma área de encaixe.')
        return
      }

      const nextContent: CanvasInteractionContent = {
        ...content,
        targets: content.targets.filter((target) => target.id !== targetId),
      }

      void commit(nextContent)
    }

    function startTargetDrag(
      event: ReactPointerEvent<HTMLButtonElement>,
      target: CanvasInteractionContent['targets'][number],
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
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                {isColoringPointMode ? 'Pontos e gabarito' : 'Areas e gabarito'}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {isColoringPointMode
                  ? 'Edite a posicao de cada ponto e associe a cor correta.'
                  : 'Edite posicao, tamanho e a resposta correta de cada hotspot.'}
              </p>
            </div>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
              {content.targets.length} {targetNoun}(s)
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
                    {targetLabelPrefix} {index + 1}
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
                      onBlur={() => void commitLatestDraft()}
                      placeholder="Ex.: Mitocondria"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {editableTargetFields.map((field) => (
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
                          onBlur={() => void commitLatestDraft()}
                        />
                      </label>
                    ))}
                  </div>

                  {isColoringPointMode ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                      O marcador do quiz de colorir usa tamanho fixo para manter apenas um ponto pequeno na imagem.
                    </div>
                  ) : null}

                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{answerLabel}</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                      value={assignedTokenBySlot.get(target.id) ?? ''}
                      onChange={(event) => updateSlotAnswer(target.id, event.target.value)}
                    >
                      <option value="" disabled>Selecione um item</option>
                      {content.tokens.map((token, tokenIndex) => (
                        <option key={token.id} value={token.id}>
                          {token.label.trim() || `${isColoringPointMode ? 'Cor' : 'Rotulo'} ${tokenIndex + 1}`}
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
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                {isColoringPointMode ? 'Pontos na imagem' : 'Areas no canvas'}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {isColoringPointMode
                  ? 'Selecione um ponto para destacar na imagem ou abrir o ajuste detalhado.'
                  : 'Selecione uma area para destacar no canvas ou abrir o ajuste detalhado.'}
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
              Limpar seleção
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
                      {targetLabelPrefix} {index + 1}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {Math.round(target.x)}% / {Math.round(target.y)}%
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-black text-slate-900">
                    {target.label?.trim() || `${targetLabelPrefix} ${index + 1}`}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {content.kind === 'coloring' ? 'Cor' : 'Resposta'}: {assignedToken?.label.trim() || `${isColoringPointMode ? 'Cor' : 'Rotulo'} ${index + 1}`}
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
                {isColoringPointMode
                  ? 'Envie uma imagem comum para posicionar um ponto pequeno em cada local da cor.'
                  : 'Envie ou substitua a imagem usada como base visual do exercicio.'}
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

          {renderAssetError()}

          <div className="mt-5 space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    {isColoringPointMode ? 'Area da imagem' : 'Area de canvas'}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    {isColoringPointMode
                      ? 'Clique na imagem para criar novos pontos e ajuste o zoom para posicionar cada marcador com precisao.'
                      : 'Clique na imagem para criar novas areas e ajuste o zoom para posicionar melhor cada hotspot.'}
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
                            {isColoringPointMode
                              ? 'Envie uma imagem, foto, esquema ou SVG comum para posicionar os pontos de cor.'
                              : 'Envie uma imagem anatomica, esquema ou ilustracao para posicionar os hotspots.'}
                          </p>
                        </div>
                      )}

                      {content.targets.map((target, index) => {
                        const assignedToken = content.kind === 'coloring'
                          ? content.tokens.find((token) => token.id === assignedTokenBySlot.get(target.id)) ?? null
                          : null
                        const pointColor = assignedToken?.hex ?? '#ffffff'

                        return (
                          <button
                            key={target.id}
                            type="button"
                            className={cn(
                              'absolute bg-transparent transition-all',
                              draggingTargetId === target.id ? 'cursor-grabbing' : 'cursor-grab',
                              isColoringPointMode
                                ? selectedTargetId === target.id
                                  ? 'rounded-full'
                                  : ''
                                : selectedTargetId === target.id
                                  ? 'rounded-2xl border-2 border-dashed border-cyan-500'
                                  : 'border border-transparent',
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
                            <span
                              className={cn(
                                'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-black shadow-lg transition-all',
                                isColoringPointMode ? 'h-3.5 w-3.5 text-[7px] border-slate-700/70' : 'h-7 w-7 text-[11px]',
                                selectedTargetId === target.id
                                  ? isColoringPointMode
                                    ? 'ring-2 ring-cyan-100 shadow-[0_0_0_4px_rgba(34,211,238,0.18),0_4px_12px_rgba(15,23,42,0.28)]'
                                    : 'border-cyan-500 bg-cyan-500 text-white ring-4 ring-cyan-100'
                                  : isColoringPointMode
                                    ? 'shadow-[0_3px_10px_rgba(15,23,42,0.18)]'
                                    : 'border-white bg-white/95 hover:border-cyan-300 hover:text-cyan-700',
                              )}
                              style={isColoringPointMode ? { backgroundColor: pointColor, color: getPointBadgeTextColor(pointColor) } : undefined}
                            >
                              {index + 1}
                            </span>
                          </button>
                        )
                      })}
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
                          onBlur={() => void commitLatestDraft()}
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
                  <h3 className="text-left text-xl font-black tracking-tight text-slate-900">
                    {isColoringPointMode ? 'Pontos e Gabarito' : 'Areas e Gabarito'}
                  </h3>
                  <p className="mt-1 text-left text-sm font-medium text-slate-500">
                    {isColoringPointMode
                      ? 'Ajuste cada ponto sem comprimir a imagem principal.'
                      : 'Ajuste cada hotspot sem comprimir o canvas principal.'}
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
        {isSvgInstructionsModalOpen ? (
          <div
            className="fixed inset-0 z-[135] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsSvgInstructionsModalOpen(false)}
          >
            <div
              className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[40px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-8">
                <div>
                  <h3 className="text-left text-xl font-black tracking-tight text-slate-900">Como preparar o SVG para colorir</h3>
                  <p className="mt-1 text-left text-sm font-medium text-slate-500">
                    Guia rapido para criar regioes detectaveis no quiz com preenchimento real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSvgInstructionsModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 p-8">
                <section className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Passo 1</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">Separe cada peca em uma regiao propria.</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Passo 2</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">Defina `id` ou `data-region-id` em cada regiao.</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Passo 3</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">Exporte em SVG e envie o arquivo no quiz.</p>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Checklist</p>
                    <div className="mt-4 space-y-4 text-sm font-medium leading-relaxed text-cyan-950">
                      <p><strong>1.</strong> O arquivo precisa ser realmente `SVG`, nao PNG, PDF ou imagem vetorizada exportada de forma errada.</p>
                      <p><strong>2.</strong> Cada peca pintavel deve ter um `id` proprio ou `data-region-id`.</p>
                      <p><strong>3.</strong> As pecas devem ser formas fechadas. `path`, `polygon`, `rect`, `circle` e `ellipse` funcionam melhor.</p>
                      <p><strong>4.</strong> `fill=\"none\"` pode ser usado. O sistema injeta o preenchimento durante a interacao do aluno.</p>
                      <p><strong>5.</strong> Se usar {'<g>'}, o grupo tambem pode ter `data-region-id`, desde que os shapes internos pertençam a uma unica peca.</p>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-amber-100 bg-amber-50/70 p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">Evite</p>
                    <div className="mt-4 space-y-4 text-sm font-medium leading-relaxed text-amber-950">
                      <p><strong>1.</strong> Linhas soltas com {'<line>'} ou paths abertos sem area interna para preencher.</p>
                      <p><strong>2.</strong> Deixar varias pecas diferentes dentro da mesma regiao quando o aluno precisa colori-las separadamente.</p>
                      <p><strong>3.</strong> Confiar apenas em nomes visuais da camada no editor grafico sem exportar o `id` no SVG final.</p>
                      <p><strong>4.</strong> SVGs com tudo achatado em um unico path sem divisao por partes do desenho.</p>
                    </div>
                  </section>
                </div>

                <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Exemplo minimo</p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        Este formato ja pode ser detectado pelo editor.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      id ou data-region-id
                    </span>
                  </div>

                  <pre className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-950 px-5 py-5 text-xs leading-6 text-slate-100">
                    <code>{SVG_COLORING_EXAMPLE}</code>
                  </pre>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Ferramentas externas</p>
                  <div className="mt-4 space-y-4 text-sm font-medium leading-relaxed text-slate-700">
                    <p>No Illustrator, Figma, Inkscape ou Corel, o ponto principal e garantir que cada peca exportada tenha identificador unico no SVG final.</p>
                    <p>Se quiser, eu posso no proximo passo adicionar um validador visual no upload, mostrando quais ids o sistema encontrou antes de salvar.</p>
                  </div>
                </section>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 p-8">
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-slate-900 px-6 font-black text-white hover:bg-slate-800"
                  onClick={() => setIsSvgInstructionsModalOpen(false)}
                >
                  Fechar guia
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function renderFillInTheBlanksEditor(content: FillInTheBlanksInteractionContent) {
    const groups = buildFillBlankEditorGroups(content, answerKeyPayload)
    const expandedGroupId = openFillBlankId === undefined
      ? groups[0]?.id ?? null
      : groups.some((group) => group.id === openFillBlankId)
        ? openFillBlankId
        : groups[0]?.id ?? null

    function updateGroupsDraft(nextGroups: FillBlankEditorGroup[]) {
      const nextBundle = buildFillBlankBundle(content.instruction, nextGroups)
      updateDraft(nextBundle.content, nextBundle.answerKey)
    }

    function commitGroups(nextGroups: FillBlankEditorGroup[]) {
      const nextBundle = buildFillBlankBundle(content.instruction, nextGroups)
      return commit(nextBundle.content, nextBundle.answerKey)
    }

    function patchGroups(groupId: string, updater: (group: FillBlankEditorGroup) => FillBlankEditorGroup) {
      return groups.map((group) => (
        group.id === groupId
          ? updater(group)
          : group
      ))
    }

    function updateGroup(groupId: string, updates: Partial<FillBlankEditorGroup>) {
      updateGroupsDraft(patchGroups(groupId, (group) => ({ ...group, ...updates })))
    }

    function patchBlank(groupId: string, blankId: string, updates: Partial<FillBlankEditorBlank>) {
      return patchGroups(groupId, (group) => ({
        ...group,
        blanks: group.blanks.map((blank) => (
          blank.blank_id === blankId
            ? { ...blank, ...updates }
            : blank
        )),
      }))
    }

    function updateBlank(groupId: string, blankId: string, updates: Partial<FillBlankEditorBlank>) {
      updateGroupsDraft(patchBlank(groupId, blankId, updates))
    }

    function addPromptItem() {
      const nextGroupIndex = groups.length + 1
      const nextGroup: FillBlankEditorGroup = {
        id: crypto.randomUUID(),
        leading_text: '',
        blanks: [
          {
            blank_id: crypto.randomUUID(),
            token_id: crypto.randomUUID(),
            placeholder: `lacuna ${nextGroupIndex}.1`,
            answer_text: `Resposta ${nextGroupIndex}.1`,
            trailing_text: '',
          },
        ],
      }

      setOpenFillBlankId(nextGroup.id)
      void commitGroups([...groups, nextGroup])
    }

    function removePromptItem(groupId: string) {
      if (groups.length === 1) {
        onError('Mantenha ao menos uma pergunta com lacuna neste exercício.')
        return
      }

      const nextGroups = groups.filter((group) => group.id !== groupId)
      setOpenFillBlankId((current) => (current === groupId ? nextGroups[0]?.id ?? null : current))
      void commitGroups(nextGroups)
    }

    function addBlankToGroup(groupId: string) {
      const groupIndex = groups.findIndex((group) => group.id === groupId)
      const group = groups[groupIndex]
      if (!group) return

      const nextBlankIndex = group.blanks.length + 1
      const nextGroups = patchGroups(groupId, (currentGroup) => ({
        ...currentGroup,
        blanks: [
          ...currentGroup.blanks,
          {
            blank_id: crypto.randomUUID(),
            token_id: crypto.randomUUID(),
            placeholder: `lacuna ${groupIndex + 1}.${nextBlankIndex}`,
            answer_text: `Resposta ${groupIndex + 1}.${nextBlankIndex}`,
            trailing_text: '',
          },
        ],
      }))

      setOpenFillBlankId(groupId)
      void commitGroups(nextGroups)
    }

    function addExtraToken(groupId: string) {
      const nextGroups = patchGroups(groupId, (currentGroup) => ({
        ...currentGroup,
        extra_tokens: [
          ...(currentGroup.extra_tokens ?? []),
          {
            id: crypto.randomUUID(),
            label: '',
          },
        ],
      }))

      setOpenFillBlankId(groupId)
      void commitGroups(nextGroups)
    }

    function updateExtraToken(groupId: string, tokenId: string, label: string) {
      updateGroupsDraft(patchGroups(groupId, (currentGroup) => ({
        ...currentGroup,
        extra_tokens: (currentGroup.extra_tokens ?? []).map((token) => (
          token.id === tokenId
            ? { ...token, label }
            : token
        )),
      })))
    }

    function commitExtraToken(groupId: string, tokenId: string, label: string) {
      void commitGroups(patchGroups(groupId, (currentGroup) => ({
        ...currentGroup,
        extra_tokens: (currentGroup.extra_tokens ?? []).map((token) => (
          token.id === tokenId
            ? { ...token, label }
            : token
        )),
      })))
    }

    function removeExtraToken(groupId: string, tokenId: string) {
      void commitGroups(patchGroups(groupId, (currentGroup) => ({
        ...currentGroup,
        extra_tokens: (currentGroup.extra_tokens ?? []).filter((token) => token.id !== tokenId),
      })))
    }

    function removeBlank(groupId: string, blankId: string) {
      const group = groups.find((item) => item.id === groupId)
      if (!group) return

      if (group.blanks.length === 1) {
        onError('Cada pergunta precisa manter ao menos uma lacuna.')
        return
      }

      void commitGroups(patchGroups(groupId, (currentGroup) => ({
        ...currentGroup,
        blanks: currentGroup.blanks.filter((blank) => blank.blank_id !== blankId),
      })))
    }

    return (
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Perguntas com lacunas</p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Cada card representa uma pergunta. Dentro dela voce pode escrever o texto inicial e adicionar uma ou varias lacunas.
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
          {groups.map((group, index) => {
            const isOpen = expandedGroupId === group.id
            const previewLabel = group.blanks
              .map((blank) => blank.answer_text.trim() || blank.placeholder?.trim() || 'lacuna')
              .join(' • ')

            return (
              <div key={group.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2 px-5 py-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left transition-colors hover:text-teal-700"
                    onClick={() => setOpenFillBlankId((current) => current === group.id ? null : group.id)}
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
                        {group.leading_text.trim() || group.blanks.some((blank) => blank.trailing_text.trim().length > 0)
                          ? `${group.blanks.length} lacuna(s) nesta pergunta`
                          : 'Clique para escrever a frase e definir as lacunas.'}
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
                    onClick={() => removePromptItem(group.id)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {isOpen ? (
                  <div className="space-y-5 border-t border-slate-200 bg-white px-5 py-5">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Texto inicial da pergunta</span>
                      <textarea
                        className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                        value={group.leading_text}
                        onChange={(event) => updateGroup(group.id, { leading_text: event.target.value })}
                        onBlur={(event) => void commitGroups(patchGroups(group.id, (currentGroup) => ({
                          ...currentGroup,
                          leading_text: event.currentTarget.value,
                        })))}
                        placeholder="Ex.: A fisiologia é a ciência que estuda..."
                      />
                    </label>

                    <div className="space-y-4">
                      {group.blanks.map((blank, blankIndex) => (
                        <div key={blank.blank_id} className="rounded-[24px] border border-teal-100 bg-teal-50/40 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700 shadow-sm">
                              Lacuna {blankIndex + 1}
                            </span>
                            <button
                              type="button"
                              className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                              onClick={() => removeBlank(group.id, blank.blank_id)}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Placeholder da lacuna</span>
                              <input
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                                value={blank.placeholder ?? ''}
                                onChange={(event) => updateBlank(group.id, blank.blank_id, { placeholder: event.target.value })}
                                onBlur={(event) => void commitGroups(patchBlank(group.id, blank.blank_id, { placeholder: event.currentTarget.value }))}
                                placeholder="Ex.: termo principal"
                              />
                            </label>

                            <label className="block space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resposta correta</span>
                              <input
                                className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                                value={blank.answer_text}
                                onChange={(event) => updateBlank(group.id, blank.blank_id, { answer_text: event.target.value })}
                                onBlur={(event) => void commitGroups(patchBlank(group.id, blank.blank_id, { answer_text: event.currentTarget.value }))}
                                placeholder="Digite a resposta correta completa"
                              />
                            </label>
                          </div>

                          <label className="mt-4 block space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Texto depois desta lacuna</span>
                            <textarea
                              className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                              value={blank.trailing_text}
                              onChange={(event) => updateBlank(group.id, blank.blank_id, { trailing_text: event.target.value })}
                              onBlur={(event) => void commitGroups(patchBlank(group.id, blank.blank_id, { trailing_text: event.currentTarget.value }))}
                              placeholder="Texto que continua depois desta lacuna."
                            />
                          </label>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
                      onClick={() => addBlankToGroup(group.id)}
                    >
                      Adicionar lacuna nesta pergunta
                    </Button>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Alternativas do banco</p>
                          <p className="mt-2 text-sm font-medium text-slate-600">
                            Adicione palavras extras para aparecerem no banco do aluno como distratores.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          onClick={() => addExtraToken(group.id)}
                        >
                          Adicionar alternativa
                        </Button>
                      </div>

                      {(group.extra_tokens ?? []).length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {(group.extra_tokens ?? []).map((token, tokenIndex) => (
                            <div key={token.id} className="flex items-center gap-3 rounded-2xl border border-white bg-white p-3 shadow-sm">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Alternativa {tokenIndex + 1}
                              </span>
                              <input
                                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-700 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                                value={token.label}
                                onChange={(event) => updateExtraToken(group.id, token.id, event.target.value)}
                                onBlur={(event) => commitExtraToken(group.id, token.id, event.currentTarget.value)}
                                placeholder="Ex.: azul, verde, anatomia..."
                              />
                              <button
                                type="button"
                                className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                onClick={() => removeExtraToken(group.id, token.id)}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm font-medium text-slate-500">
                          Nenhuma alternativa extra cadastrada nesta pergunta.
                        </p>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-teal-100 bg-teal-50/60 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-700">Preview da pergunta</p>
                      <p className="mt-4 text-base leading-8 text-slate-700">
                        {group.leading_text || <span className="text-slate-400">Texto inicial da pergunta</span>}
                        {group.blanks.map((blank) => (
                          <span key={blank.blank_id}>
                            <span className="mx-2 inline-flex min-w-[140px] items-center justify-center rounded-2xl border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700 shadow-sm">
                              {blank.answer_text || blank.placeholder || 'Lacuna'}
                            </span>
                            {blank.trailing_text || <span className="text-slate-400"> texto depois desta lacuna</span>}
                          </span>
                        ))}
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
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">Instrução ao aluno</p>
          <textarea
            className="min-h-[110px] w-full rounded-[28px] border border-cyan-100 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            value={activeInteraction.instruction}
            onChange={(event) => updateDraft({
              ...activeInteraction,
              instruction: event.target.value,
            })}
            onBlur={() => void commitLatestDraft()}
            placeholder="Explique como o aluno deve interagir com o exercício."
          />
        </div>

        <div className="rounded-[28px] border border-white bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Modo de correção</p>
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

      {activeInteraction.kind === 'coloring' ? renderColoringModeSelector() : null}

      {activeInteraction.kind === 'drag_drop_labeling'
        ? renderDragDropEditor(activeInteraction)
        : activeInteraction.kind === 'coloring'
          ? activeColoringSvgInteraction
            ? renderColoringSvgEditor(activeColoringSvgInteraction)
            : renderDragDropEditor(activeInteraction as CanvasInteractionContent)
          : renderFillInTheBlanksEditor(activeInteraction)}

      {activeInteraction.kind === 'drag_drop_labeling' || activeInteraction.kind === 'coloring' ? renderTokenBank() : null}

      <div className={cn(
        'rounded-[28px] border px-5 py-4 text-sm font-semibold',
        validationMessage
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      )}>
        {validationMessage ?? 'Interação válida. O backend já possui o gabarito necessário para corrigir esta questão.'}
      </div>
    </div>
  )
}
