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
} from '@/types/content'

export const assessmentInteractionTokenSchema = z.object({
  id: z.string().trim().min(1, 'Identificador do item invalido.'),
  label: z.string().max(160, 'Rotulo do item invalido.'),
})

export const assessmentInteractionAssetSchema = z.object({
  storage_path: z.string().trim(),
  signed_url: z.string().trim().url().nullable().optional(),
  alt: z.string().trim().min(1, 'Texto alternativo obrigatorio.'),
  width: z.number().positive('Largura invalida.'),
  height: z.number().positive('Altura invalida.'),
})

export const dragDropLabelingTargetSchema = z.object({
  id: z.string().trim().min(1, 'Identificador da area obrigatorio.'),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().positive().max(100),
  h: z.number().positive().max(100),
  label: z.string().trim().max(160).nullable().optional(),
})

export const dragDropLabelingInteractionContentSchema = z.object({
  kind: z.literal('drag_drop_labeling'),
  instruction: z.string().trim().min(2, 'Instrucao obrigatoria.'),
  asset: assessmentInteractionAssetSchema,
  tokens: z.array(assessmentInteractionTokenSchema).min(1, 'Adicione ao menos um rotulo.'),
  targets: z.array(dragDropLabelingTargetSchema).min(1, 'Adicione ao menos uma area de encaixe.'),
})

export const coloringAreaSchema = z.object({
  id: z.string().trim().min(1, 'Identificador da area obrigatorio.'),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().positive().max(100),
  h: z.number().positive().max(100),
  label: z.string().trim().max(160).nullable().optional(),
})

export const coloringPaletteColorSchema = z.object({
  id: z.string().trim().min(1, 'Identificador da cor obrigatorio.'),
  label: z.string().trim().min(1, 'Rotulo da cor obrigatorio.'),
  hex: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, 'Cor invalida.'),
})

export const coloringSvgRegionSchema = z.object({
  region_id: z.string().trim().min(1, 'Identificador da regiao obrigatorio.'),
  label: z.string().trim().max(160).nullable().optional(),
})

const coloringBaseInteractionContentSchema = z.object({
  kind: z.literal('coloring'),
  instruction: z.string().trim().min(2, 'Instrucao obrigatoria.'),
  asset: assessmentInteractionAssetSchema,
  tokens: z.array(coloringPaletteColorSchema).min(1, 'Adicione ao menos uma cor.'),
})

export const coloringLegacyInteractionContentSchema = coloringBaseInteractionContentSchema.extend({
  render_mode: z.literal('legacy_rect').optional(),
  targets: z.array(coloringAreaSchema).min(1, 'Adicione ao menos uma area para colorir.'),
})

export const coloringSvgInteractionContentSchema = coloringBaseInteractionContentSchema.extend({
  render_mode: z.literal('svg_regions'),
  svg_markup: z.string().trim().min(1, 'Envie um SVG valido para o quiz de colorir.'),
  regions: z.array(coloringSvgRegionSchema).min(1, 'Adicione ao menos uma regiao no SVG.'),
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
    id: z.string().trim().min(1, 'Identificador da lacuna obrigatorio.'),
    placeholder: z.string().trim().max(120).nullable().optional(),
  }),
])

export const fillInTheBlanksInteractionContentSchema = z.object({
  kind: z.literal('fill_in_the_blanks'),
  instruction: z.string().trim().min(2, 'Instrucao obrigatoria.'),
  segments: z.array(fillInTheBlanksSegmentSchema).min(1, 'Adicione texto ou lacunas.'),
  tokens: z.array(assessmentInteractionTokenSchema).min(1, 'Adicione ao menos um item do banco.'),
  editor_groups: z.array(z.object({
    id: z.string().trim().min(1, 'Identificador da pergunta obrigatorio.'),
    leading_text: z.string(),
    blanks: z.array(z.object({
      blank_id: z.string().trim().min(1, 'Identificador da lacuna obrigatorio.'),
      token_id: z.string().trim().min(1, 'Identificador da resposta obrigatorio.'),
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
  coloringLegacyInteractionContentSchema,
  coloringSvgInteractionContentSchema,
])

export const assessmentQuestionAnswerKeyPayloadSchema = z.object({
  entries: z.array(z.object({
    slot_id: z.string().trim().min(1, 'Slot invalido.'),
    token_id: z.string().trim().min(1, 'Token invalido.'),
  })).min(1, 'Defina ao menos uma correspondencia correta.'),
})

export const assessmentInteractionResponsePayloadSchema = z.object({
  entries: z.array(z.object({
    slot_id: z.string().trim().min(1, 'Slot invalido.'),
    token_id: z.string().trim().nullable(),
  })),
})

export function isGamifiedQuestionType(questionType: AssessmentQuestionType) {
  return questionType === 'drag_drop_labeling' || questionType === 'fill_in_the_blanks' || questionType === 'coloring'
}

export function isEssayQuestionType(questionType: AssessmentQuestionType) {
  return questionType === 'essay_ai' || questionType === 'case_study_ai'
}

export function isChoiceQuestionType(questionType: AssessmentQuestionType) {
  return questionType === 'single_choice' || questionType === 'case_study_single_choice'
}

export function createDefaultInteractionContent(questionType: AssessmentQuestionType): AssessmentInteractionContent | null {
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

  if (questionType === 'coloring') {
    const defaultSvgAsset = createDefaultColoringSvgAsset()
    return {
      kind: 'coloring',
      render_mode: 'svg_regions',
      instruction: 'Selecione uma cor e pinte cada area com a cor correta.',
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
          label: defaultSvgAsset.regions[0]?.label ?? 'Regiao 1',
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

  if (content.kind === 'drag_drop_labeling') {
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
  return content?.tokens.map((token) => token.id) ?? []
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
    throw new Error(parsedContent.error.issues[0]?.message ?? 'Interacao invalida.')
  }

  const parsedAnswerKey = assessmentQuestionAnswerKeyPayloadSchema.safeParse(answerKey)
  if (!parsedAnswerKey.success) {
    throw new Error(parsedAnswerKey.error.issues[0]?.message ?? 'Gabarito da interacao invalido.')
  }

  if (parsedContent.data.kind !== questionType) {
    throw new Error('O tipo da interacao nao corresponde ao tipo da pergunta.')
  }

  const slotIds = new Set(getInteractionSlotIds(parsedContent.data))
  const tokenIds = new Set(getInteractionTokenIds(parsedContent.data))

  if (slotIds.size === 0) {
    throw new Error('A interacao precisa ter ao menos uma area ou lacuna.')
  }

  if (tokenIds.size === 0) {
    throw new Error('A interacao precisa ter ao menos um item no banco.')
  }

  if (parsedContent.data.tokens.some((token) => token.label.trim().length === 0)) {
    throw new Error('Preencha o texto de todos os itens do banco de respostas.')
  }

  if (
    parsedContent.data.kind === 'drag_drop_labeling'
    && parsedContent.data.tokens.length !== parsedContent.data.targets.length
  ) {
    throw new Error('No arrastar e soltar, o banco de respostas deve ter exatamente um item para cada area.')
  }

  if (
    parsedContent.data.kind === 'coloring'
    && parsedContent.data.tokens.some((token) => !/^#([0-9a-fA-F]{6})$/.test(token.hex))
  ) {
    throw new Error('Cada cor da paleta precisa usar um codigo hexadecimal valido.')
  }

  if (
    parsedContent.data.kind === 'coloring'
    && parsedContent.data.render_mode === 'svg_regions'
    && parsedContent.data.regions.some((region) => region.region_id.trim().length === 0)
  ) {
    throw new Error('Cada regiao do SVG precisa ter um identificador valido.')
  }

  const usedSlots = new Set<string>()
  const usedTokens = new Set<string>()

  for (const entry of parsedAnswerKey.data.entries) {
    if (!slotIds.has(entry.slot_id)) {
      throw new Error('O gabarito referencia uma area/lacuna inexistente.')
    }

    if (!tokenIds.has(entry.token_id)) {
      throw new Error('O gabarito referencia um item inexistente.')
    }

    if (usedSlots.has(entry.slot_id)) {
      throw new Error('Cada area/lacuna deve possuir apenas uma resposta correta.')
    }

    if (usedTokens.has(entry.token_id)) {
      throw new Error('Cada item do banco deve ser usado no maximo uma vez na v1.')
    }

    usedSlots.add(entry.slot_id)
    usedTokens.add(entry.token_id)
  }

  if (usedSlots.size !== slotIds.size) {
    throw new Error('Defina uma resposta correta para cada area/lacuna.')
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
