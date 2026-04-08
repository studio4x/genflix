import { z } from 'zod'

import { createDefaultColoringSvgAsset } from '@/features/assessments/coloring-svg'
import type {
  AssessmentInteractionContent,
  AssessmentInteractionResponsePayload,
  AssessmentQuestionAnswerKeyPayload,
  AssessmentQuestionType,
  ColoringInteractionContent,
  ColoringRenderMode,
  FillInTheBlanksInteractionContent,
  ImageHotspotAnswerKeyPayload,
  ImageHotspotInteractionContent,
  ImageHotspotResponsePayload,
  TokenMappingAnswerKeyPayload,
} from '@/types/content'

export const assessmentInteractionTokenSchema = z.object({
  id: z.string().trim().min(1, 'Identificador do item inválido.'),
  label: z.string().max(160, 'Rótulo do item inválido.'),
})

export const assessmentInteractionAssetSchema = z.object({
  storage_path: z.string().trim(),
  signed_url: z.string().trim().url().nullable().optional(),
  alt: z.string().trim().min(1, 'Texto alternativo obrigatório.'),
  width: z.number().positive('Largura inválida.'),
  height: z.number().positive('Altura inválida.'),
})

export const dragDropLabelingTargetSchema = z.object({
  id: z.string().trim().min(1, 'Identificador da área obrigatório.'),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().positive().max(100),
  h: z.number().positive().max(100),
  label: z.string().trim().max(160).nullable().optional(),
})

export const dragDropLabelingInteractionContentSchema = z.object({
  kind: z.literal('drag_drop_labeling'),
  instruction: z.string().trim().min(2, 'Instrução obrigatória.'),
  asset: assessmentInteractionAssetSchema,
  tokens: z.array(assessmentInteractionTokenSchema).min(1, 'Adicione ao menos um rótulo.'),
  targets: z.array(dragDropLabelingTargetSchema).min(1, 'Adicione ao menos uma área de encaixe.'),
})

export const imageHotspotTargetSchema = z.object({
  id: z.string().trim().min(1, 'Identificador do hotspot obrigatório.'),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().positive().max(100),
  h: z.number().positive().max(100),
  label: z.string().trim().max(160).nullable().optional(),
  is_correct: z.boolean(),
  feedback_text: z.string().trim().max(1000).nullable().optional(),
})

export const imageHotspotInteractionContentSchema = z.object({
  kind: z.literal('image_hotspot'),
  mode: z.enum(['single_attempt', 'find_all']),
  instruction: z.string().trim().min(2, 'Instrução obrigatória.'),
  asset: assessmentInteractionAssetSchema,
  targets: z.array(imageHotspotTargetSchema).min(1, 'Adicione ao menos um hotspot.'),
  outside_click_feedback: z.string().trim().max(1000).nullable().optional(),
  show_feedback_as_popup: z.boolean().default(true),
})

export const coloringAreaSchema = z.object({
  id: z.string().trim().min(1, 'Identificador da área obrigatório.'),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().positive().max(100),
  h: z.number().positive().max(100),
  label: z.string().trim().max(160).nullable().optional(),
})

export const coloringPaletteColorSchema = z.object({
  id: z.string().trim().min(1, 'Identificador da cor obrigatório.'),
  label: z.string().trim().min(1, 'Rótulo da cor obrigatório.'),
  hex: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, 'Cor inválida.'),
})

export const coloringSvgRegionSchema = z.object({
  region_id: z.string().trim().min(1, 'Identificador da região obrigatório.'),
  label: z.string().trim().max(160).nullable().optional(),
})

const coloringBaseInteractionContentSchema = z.object({
  kind: z.literal('coloring'),
  instruction: z.string().trim().min(2, 'Instrução obrigatória.'),
  asset: assessmentInteractionAssetSchema,
  tokens: z.array(coloringPaletteColorSchema).min(1, 'Adicione ao menos uma cor.'),
})

export const coloringLegacyInteractionContentSchema = coloringBaseInteractionContentSchema.extend({
  render_mode: z.literal('legacy_rect').optional(),
  targets: z.array(coloringAreaSchema).min(1, 'Adicione ao menos uma área para colorir.'),
})

export const coloringSvgInteractionContentSchema = coloringBaseInteractionContentSchema.extend({
  render_mode: z.literal('svg_regions'),
  svg_markup: z.string().trim().min(1, 'Envie um SVG válido para o quiz de colorir.'),
  regions: z.array(coloringSvgRegionSchema).min(1, 'Adicione ao menos uma região no SVG.'),
})

export const coloringInteractionContentSchema = z.union([
  coloringLegacyInteractionContentSchema,
  coloringSvgInteractionContentSchema,
])

export const fillInTheBlanksSegmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('blank'),
    id: z.string().trim().min(1, 'Identificador da lacuna obrigatório.'),
    placeholder: z.string().trim().max(120).nullable().optional(),
  }),
])

export const fillInTheBlanksInteractionContentSchema = z.object({
  kind: z.literal('fill_in_the_blanks'),
  instruction: z.string().trim().min(2, 'Instrução obrigatória.'),
  segments: z.array(fillInTheBlanksSegmentSchema).min(1, 'Adicione texto ou lacunas.'),
  tokens: z.array(assessmentInteractionTokenSchema).min(1, 'Adicione ao menos um item do banco.'),
  editor_groups: z.array(z.object({
    id: z.string().trim().min(1, 'Identificador da pergunta obrigatório.'),
    leading_text: z.string(),
    blanks: z.array(z.object({
      blank_id: z.string().trim().min(1, 'Identificador da lacuna obrigatório.'),
      token_id: z.string().trim().min(1, 'Identificador da resposta obrigatório.'),
      placeholder: z.string().trim().max(120).nullable().optional(),
      answer_text: z.string(),
      trailing_text: z.string(),
    })).min(1, 'Adicione ao menos uma lacuna na pergunta.'),
    extra_tokens: z.array(assessmentInteractionTokenSchema).optional().nullable(),
  })).optional().nullable(),
})

export const assessmentInteractionContentSchema = z.union([
  dragDropLabelingInteractionContentSchema,
  fillInTheBlanksInteractionContentSchema,
  imageHotspotInteractionContentSchema,
  coloringLegacyInteractionContentSchema,
  coloringSvgInteractionContentSchema,
])

export const tokenMappingAnswerKeyPayloadSchema = z.object({
  entries: z.array(z.object({
    slot_id: z.string().trim().min(1, 'Slot inválido.'),
    token_id: z.string().trim().min(1, 'Token inválido.'),
  })).min(1, 'Defina ao menos uma correspondência correta.'),
})

export const imageHotspotAnswerKeyPayloadSchema = z.object({
  kind: z.literal('image_hotspot'),
  correct_target_ids: z.array(z.string().trim().min(1, 'Hotspot inválido.')).min(1, 'Defina ao menos um hotspot correto.'),
})

export const assessmentQuestionAnswerKeyPayloadSchema = z.union([
  tokenMappingAnswerKeyPayloadSchema,
  imageHotspotAnswerKeyPayloadSchema,
])

export const tokenMappingResponsePayloadSchema = z.object({
  entries: z.array(z.object({
    slot_id: z.string().trim().min(1, 'Slot inválido.'),
    token_id: z.string().trim().nullable(),
  })),
})

export const imageHotspotResponsePayloadSchema = z.object({
  kind: z.literal('image_hotspot'),
  mode: z.enum(['single_attempt', 'find_all']),
  selected_target_id: z.string().trim().min(1, 'Hotspot inválido.').nullable(),
  found_target_ids: z.array(z.string().trim().min(1, 'Hotspot inválido.')),
  incorrect_target_ids: z.array(z.string().trim().min(1, 'Hotspot inválido.')),
  outside_click_count: z.number().int().min(0),
})

export const assessmentInteractionResponsePayloadSchema = z.union([
  tokenMappingResponsePayloadSchema,
  imageHotspotResponsePayloadSchema,
])

export function isGamifiedQuestionType(questionType: AssessmentQuestionType) {
  return questionType === 'drag_drop_labeling'
    || questionType === 'fill_in_the_blanks'
    || questionType === 'image_hotspot'
    || questionType === 'coloring'
}

export function isEssayQuestionType(questionType: AssessmentQuestionType) {
  return questionType === 'essay_ai' || questionType === 'case_study_ai'
}

export function isChoiceQuestionType(questionType: AssessmentQuestionType) {
  return questionType === 'single_choice' || questionType === 'case_study_single_choice'
}

export function isImageHotspotInteractionContent(
  content: AssessmentInteractionContent | null | undefined,
): content is ImageHotspotInteractionContent {
  return content?.kind === 'image_hotspot'
}

export function isImageHotspotAnswerKeyPayload(
  payload: AssessmentQuestionAnswerKeyPayload | null | undefined,
): payload is ImageHotspotAnswerKeyPayload {
  return Boolean(payload && 'kind' in payload && payload.kind === 'image_hotspot')
}

export function isImageHotspotResponsePayload(
  payload: AssessmentInteractionResponsePayload | null | undefined,
): payload is ImageHotspotResponsePayload {
  return Boolean(payload && 'kind' in payload && payload.kind === 'image_hotspot')
}

export function isTokenMappingAnswerKeyPayload(
  payload: AssessmentQuestionAnswerKeyPayload | null | undefined,
): payload is TokenMappingAnswerKeyPayload {
  return Boolean(payload && 'entries' in payload)
}

export function createDefaultInteractionContent(
  questionType: AssessmentQuestionType,
  options?: { hotspotMode?: ImageHotspotInteractionContent['mode'] },
): AssessmentInteractionContent | null {
  if (questionType === 'drag_drop_labeling') {
    return {
      kind: 'drag_drop_labeling',
      instruction: 'Arraste os rótulos para as áreas corretas.',
      asset: {
        storage_path: '',
        signed_url: null,
        alt: 'Imagem do exercício',
        width: 1200,
        height: 800,
      },
      tokens: [
        { id: crypto.randomUUID(), label: '' },
      ],
      targets: [
        { id: crypto.randomUUID(), x: 20, y: 20, w: 18, h: 10, label: 'Área 1' },
      ],
    }
  }

  if (questionType === 'fill_in_the_blanks') {
    const blankId = crypto.randomUUID()
    const tokenId = crypto.randomUUID()
    return {
      kind: 'fill_in_the_blanks',
      instruction: 'Arraste os itens para preencher as lacunas.',
      segments: [
        { type: 'text', text: 'Texto inicial ' },
        { type: 'blank', id: blankId, placeholder: 'lacuna' },
        { type: 'text', text: ' texto final.' },
      ],
      tokens: [
        { id: tokenId, label: 'Resposta 1' },
      ],
      editor_groups: [
        {
          id: crypto.randomUUID(),
          leading_text: 'Texto inicial ',
          blanks: [
            {
              blank_id: blankId,
              token_id: tokenId,
              placeholder: 'lacuna',
              answer_text: 'Resposta 1',
              trailing_text: ' texto final.',
            },
          ],
          extra_tokens: [],
        },
      ],
    }
  }

  if (questionType === 'image_hotspot') {
    return {
      kind: 'image_hotspot',
      mode: options?.hotspotMode ?? 'single_attempt',
      instruction: 'Clique na imagem para selecionar o hotspot correto.',
      asset: {
        storage_path: '',
        signed_url: null,
        alt: 'Imagem do quiz de hotspot',
        width: 1200,
        height: 800,
      },
      targets: [
        {
          id: crypto.randomUUID(),
          x: 20,
          y: 20,
          w: 18,
          h: 12,
          label: 'Hotspot 1',
          is_correct: true,
          feedback_text: 'Correto! Você clicou na área esperada.',
        },
      ],
      outside_click_feedback: 'Clique em uma das áreas destacadas na imagem.',
      show_feedback_as_popup: true,
    }
  }

  if (questionType === 'coloring') {
    const defaultSvgAsset = createDefaultColoringSvgAsset()
    return {
      kind: 'coloring',
      render_mode: 'svg_regions',
      instruction: 'Selecione uma cor e pinte cada área com a cor correta.',
      asset: {
        storage_path: '',
        signed_url: null,
        alt: 'Imagem para colorir',
        width: defaultSvgAsset.width,
        height: defaultSvgAsset.height,
      },
      svg_markup: defaultSvgAsset.svgMarkup,
      tokens: [
        { id: crypto.randomUUID(), label: 'Azul', hex: '#2563eb' },
      ],
      regions: [
        {
          region_id: defaultSvgAsset.regions[0]?.region_id ?? 'region-1',
          label: defaultSvgAsset.regions[0]?.label ?? 'Região 1',
        },
      ],
    } satisfies ColoringInteractionContent
  }

  return null
}

export function createAnswerKeyFromInteraction(
  content: AssessmentInteractionContent | null,
): AssessmentQuestionAnswerKeyPayload | null {
  if (!content) {
    return null
  }

  if (content.kind === 'drag_drop_labeling') {
    return {
      entries: content.targets.map((target, index) => ({
        slot_id: target.id,
        token_id: content.tokens[index]?.id ?? content.tokens[0]?.id ?? '',
      })),
    }
  }

  if (content.kind === 'fill_in_the_blanks' && content.editor_groups?.length) {
    return {
      entries: content.editor_groups.flatMap((group) =>
        group.blanks.map((blank) => ({
          slot_id: blank.blank_id,
          token_id: blank.token_id,
        })),
      ),
    }
  }

  if (content.kind === 'image_hotspot') {
    return {
      kind: 'image_hotspot',
      correct_target_ids: content.targets
        .filter((target) => target.is_correct)
        .map((target) => target.id),
    }
  }

  if (content.kind === 'coloring') {
    return {
      entries: getColoringSlotIds(content).map((slotId, index) => ({
        slot_id: slotId,
        token_id: content.tokens[index]?.id ?? content.tokens[0]?.id ?? '',
      })),
    }
  }

  const blanks = content.segments.filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'blank' }> => segment.type === 'blank')
  return {
    entries: blanks.map((blank, index) => ({
      slot_id: blank.id,
      token_id: content.tokens[index]?.id ?? content.tokens[0]?.id ?? '',
    })),
  }
}

export function getInteractionSlotIds(content: AssessmentInteractionContent | null) {
  if (!content) {
    return []
  }

  if (content.kind === 'drag_drop_labeling' || content.kind === 'image_hotspot') {
    return content.targets.map((target) => target.id)
  }

  if (content.kind === 'coloring') {
    return getColoringSlotIds(content)
  }

  return content.segments
    .filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'blank' }> => segment.type === 'blank')
    .map((segment) => segment.id)
}

export function getInteractionTokenIds(content: AssessmentInteractionContent | null) {
  if (!content || content.kind === 'image_hotspot') {
    return []
  }

  return content.tokens.map((token) => token.id)
}

export function validateInteractionBundle(
  questionType: AssessmentQuestionType,
  content: AssessmentInteractionContent | null | undefined,
  answerKey: AssessmentQuestionAnswerKeyPayload | null | undefined,
) {
  if (!isGamifiedQuestionType(questionType)) {
    return
  }

  const parsedContent = assessmentInteractionContentSchema.safeParse(content)
  if (!parsedContent.success) {
    throw new Error(parsedContent.error.issues[0]?.message ?? 'Interação inválida.')
  }

  const parsedAnswerKey = assessmentQuestionAnswerKeyPayloadSchema.safeParse(answerKey)
  if (!parsedAnswerKey.success) {
    throw new Error(parsedAnswerKey.error.issues[0]?.message ?? 'Gabarito da interação inválido.')
  }

  if (parsedContent.data.kind !== questionType) {
    throw new Error('O tipo da interação não corresponde ao tipo da pergunta.')
  }

  const slotIds = new Set(getInteractionSlotIds(parsedContent.data))

  if (slotIds.size === 0) {
    throw new Error('A interação precisa ter ao menos uma área ou lacuna.')
  }

  if (parsedContent.data.kind === 'image_hotspot') {
    if (!isImageHotspotAnswerKeyPayload(parsedAnswerKey.data)) {
      throw new Error('O gabarito do hotspot está inválido.')
    }

    const correctTargetIds = parsedContent.data.targets
      .filter((target) => target.is_correct)
      .map((target) => target.id)

    if (correctTargetIds.length === 0) {
      throw new Error('Defina ao menos um hotspot correto.')
    }

    const answerKeyIds = new Set<string>()
    for (const targetId of parsedAnswerKey.data.correct_target_ids) {
      if (!slotIds.has(targetId)) {
        throw new Error('O gabarito referência um hotspot inexistente.')
      }

      answerKeyIds.add(targetId)
    }

    if (answerKeyIds.size === 0) {
      throw new Error('Defina ao menos um hotspot correto.')
    }

    if (answerKeyIds.size !== correctTargetIds.length || correctTargetIds.some((targetId) => !answerKeyIds.has(targetId))) {
      throw new Error('Sincronize os hotspots corretos antes de salvar.')
    }

    return
  }

  const tokenIds = new Set(getInteractionTokenIds(parsedContent.data))

  if (tokenIds.size === 0) {
    throw new Error('A interação precisa ter ao menos um item no banco.')
  }

  if (!isTokenMappingAnswerKeyPayload(parsedAnswerKey.data)) {
    throw new Error('O gabarito da interação está inválido.')
  }

  if (parsedContent.data.tokens.some((token) => token.label.trim().length === 0)) {
    throw new Error('Preencha o texto de todos os itens do banco de respostas.')
  }

  if (
    parsedContent.data.kind === 'drag_drop_labeling'
    && parsedContent.data.tokens.length !== parsedContent.data.targets.length
  ) {
    throw new Error('No arrastar e soltar, o banco de respostas deve ter exatamente um item para cada área.')
  }

  if (
    parsedContent.data.kind === 'coloring'
    && parsedContent.data.tokens.some((token) => !/^#([0-9a-fA-F]{6})$/.test(token.hex))
  ) {
    throw new Error('Cada cor da paleta precisa usar um código hexadecimal válido.')
  }

  if (
    parsedContent.data.kind === 'coloring'
    && parsedContent.data.render_mode === 'svg_regions'
    && parsedContent.data.regions.some((region) => region.region_id.trim().length === 0)
  ) {
    throw new Error('Cada região do SVG precisa ter um identificador válido.')
  }

  const usedSlots = new Set<string>()
  const usedTokens = new Set<string>()

  for (const entry of parsedAnswerKey.data.entries) {
    if (!slotIds.has(entry.slot_id)) {
      throw new Error('O gabarito referencia uma área/lacuna inexistente.')
    }

    if (!tokenIds.has(entry.token_id)) {
      throw new Error('O gabarito referencia um item inexistente.')
    }

    if (usedSlots.has(entry.slot_id)) {
      throw new Error('Cada área/lacuna deve possuir apenas uma resposta correta.')
    }

    if (usedTokens.has(entry.token_id)) {
      throw new Error('Cada item do banco deve ser usado no máximo uma vez na v1.')
    }

    usedSlots.add(entry.slot_id)
    usedTokens.add(entry.token_id)
  }

  if (usedSlots.size !== slotIds.size) {
    throw new Error('Defina uma resposta correta para cada área/lacuna.')
  }
}

export function getColoringRenderMode(content: ColoringInteractionContent): ColoringRenderMode {
  return content.render_mode === 'svg_regions' ? 'svg_regions' : 'legacy_rect'
}

export function getColoringSlotIds(content: ColoringInteractionContent) {
  if ('regions' in content) {
    return content.regions.map((region) => region.region_id)
  }

  return content.targets.map((target) => target.id)
}

export function normalizeResponsePayload(
  payload: AssessmentInteractionResponsePayload | null | undefined,
) {
  return assessmentInteractionResponsePayloadSchema.parse(payload ?? { entries: [] })
}

export function createDefaultImageHotspotResponsePayload(
  mode: ImageHotspotInteractionContent['mode'],
): ImageHotspotResponsePayload {
  return {
    kind: 'image_hotspot',
    mode,
    selected_target_id: null,
    found_target_ids: [],
    incorrect_target_ids: [],
    outside_click_count: 0,
  }
}
