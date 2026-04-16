import type { AssessmentQuestionType, CourseQuizTypeSettings } from '@/types/content'

export type CourseQuizTypeSettingKey = keyof CourseQuizTypeSettings

export interface CourseQuizTypeOption {
  key: CourseQuizTypeSettingKey
  title: string
  description: string
  helper: string
  accentClassName: string
  badgeClassName: string
}

export const DEFAULT_COURSE_QUIZ_TYPE_SETTINGS: CourseQuizTypeSettings = {
  single_choice: true,
  essay_ai: true,
  drag_drop_labeling: true,
  fill_in_the_blanks: true,
  image_hotspot: true,
  coloring: true,
  case_study: true,
}

export const COURSE_QUIZ_TYPE_OPTIONS: CourseQuizTypeOption[] = [
  {
    key: 'single_choice',
    title: 'Multipla Escolha',
    description: 'Alternativas tradicionais com uma resposta correta.',
    helper: 'Tambem habilita perguntas objetivas dentro de estudo de caso.',
    accentClassName: 'border-blue-200 bg-blue-50/60 text-blue-700',
    badgeClassName: 'bg-blue-600 text-white',
  },
  {
    key: 'essay_ai',
    title: 'Discursiva com IA',
    description: 'Perguntas abertas com resposta esperada e feedback automatizado.',
    helper: 'Tambem habilita perguntas discursivas dentro de estudo de caso.',
    accentClassName: 'border-amber-200 bg-amber-50/60 text-amber-700',
    badgeClassName: 'bg-amber-500 text-white',
  },
  {
    key: 'drag_drop_labeling',
    title: 'Arrastar e Soltar',
    description: 'Imagem com hotspots e banco de rotulos avaliavel.',
    helper: 'Disponivel apenas como pergunta independente nesta versao.',
    accentClassName: 'border-cyan-200 bg-cyan-50/60 text-cyan-700',
    badgeClassName: 'bg-cyan-600 text-white',
  },
  {
    key: 'fill_in_the_blanks',
    title: 'Preencher Lacunas',
    description: 'Texto com lacunas e banco de respostas arrastavel.',
    helper: 'Disponivel apenas como pergunta independente nesta versao.',
    accentClassName: 'border-teal-200 bg-teal-50/60 text-teal-700',
    badgeClassName: 'bg-teal-600 text-white',
  },
  {
    key: 'image_hotspot',
    title: 'Quiz de Hotspot',
    description: 'Imagem com hotspots corretos/incorretos e feedback por clique.',
    helper: 'Disponivel apenas como pergunta independente nesta versao.',
    accentClassName: 'border-sky-200 bg-sky-50/60 text-sky-700',
    badgeClassName: 'bg-sky-600 text-white',
  },
  {
    key: 'coloring',
    title: 'Quiz de Colorir',
    description: 'Areas pintaveis com cor correta por item ou por regiao SVG.',
    helper: 'Disponivel apenas como pergunta independente nesta versao.',
    accentClassName: 'border-fuchsia-200 bg-fuchsia-50/60 text-fuchsia-700',
    badgeClassName: 'bg-fuchsia-600 text-white',
  },
  {
    key: 'case_study',
    title: 'Estudo de Caso',
    description: 'Bloco com contexto compartilhado e perguntas agrupadas.',
    helper: 'Depende de Multipla Escolha ou Discursiva com IA estarem ativas.',
    accentClassName: 'border-violet-200 bg-violet-50/60 text-violet-700',
    badgeClassName: 'bg-violet-600 text-white',
  },
]

export function normalizeCourseQuizTypeSettings(
  value: Partial<CourseQuizTypeSettings> | null | undefined,
): CourseQuizTypeSettings {
  return {
    single_choice: value?.single_choice ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.single_choice,
    essay_ai: value?.essay_ai ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.essay_ai,
    drag_drop_labeling: value?.drag_drop_labeling ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.drag_drop_labeling,
    fill_in_the_blanks: value?.fill_in_the_blanks ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.fill_in_the_blanks,
    image_hotspot: value?.image_hotspot ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.image_hotspot,
    coloring: value?.coloring ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.coloring,
    case_study: value?.case_study ?? DEFAULT_COURSE_QUIZ_TYPE_SETTINGS.case_study,
  }
}

export function getVisibleCourseQuizTypeOptions(
  globalSettings: Partial<CourseQuizTypeSettings> | null | undefined,
) {
  const normalizedGlobalSettings = normalizeCourseQuizTypeSettings(globalSettings)

  return COURSE_QUIZ_TYPE_OPTIONS.filter((option) => normalizedGlobalSettings[option.key])
}

export function getEffectiveCourseQuizTypeSettings(
  settings: Partial<CourseQuizTypeSettings> | null | undefined,
  globalSettings?: Partial<CourseQuizTypeSettings> | null | undefined,
): CourseQuizTypeSettings {
  const normalizedCourseSettings = normalizeCourseQuizTypeSettings(settings)
  const normalizedGlobalSettings = normalizeCourseQuizTypeSettings(globalSettings)

  return {
    single_choice: normalizedCourseSettings.single_choice && normalizedGlobalSettings.single_choice,
    essay_ai: normalizedCourseSettings.essay_ai && normalizedGlobalSettings.essay_ai,
    drag_drop_labeling: normalizedCourseSettings.drag_drop_labeling && normalizedGlobalSettings.drag_drop_labeling,
    fill_in_the_blanks: normalizedCourseSettings.fill_in_the_blanks && normalizedGlobalSettings.fill_in_the_blanks,
    image_hotspot: normalizedCourseSettings.image_hotspot && normalizedGlobalSettings.image_hotspot,
    coloring: normalizedCourseSettings.coloring && normalizedGlobalSettings.coloring,
    case_study: normalizedCourseSettings.case_study && normalizedGlobalSettings.case_study,
  }
}

export function isCourseQuizSettingEnabled(
  settings: Partial<CourseQuizTypeSettings> | null | undefined,
  key: CourseQuizTypeSettingKey,
  globalSettings?: Partial<CourseQuizTypeSettings> | null | undefined,
) {
  return getEffectiveCourseQuizTypeSettings(settings, globalSettings)[key]
}

export function isCourseQuestionTypeEnabled(
  settings: Partial<CourseQuizTypeSettings> | null | undefined,
  questionType: AssessmentQuestionType,
  globalSettings?: Partial<CourseQuizTypeSettings> | null | undefined,
) {
  const normalizedSettings = getEffectiveCourseQuizTypeSettings(settings, globalSettings)

  switch (questionType) {
    case 'single_choice':
      return normalizedSettings.single_choice
    case 'essay_ai':
      return normalizedSettings.essay_ai
    case 'drag_drop_labeling':
      return normalizedSettings.drag_drop_labeling
    case 'fill_in_the_blanks':
      return normalizedSettings.fill_in_the_blanks
    case 'image_hotspot':
      return normalizedSettings.image_hotspot
    case 'coloring':
      return normalizedSettings.coloring
    case 'case_study_single_choice':
      return normalizedSettings.case_study && normalizedSettings.single_choice
    case 'case_study_ai':
      return normalizedSettings.case_study && normalizedSettings.essay_ai
    default:
      return true
  }
}

export function canCourseUseCaseStudies(
  settings: Partial<CourseQuizTypeSettings> | null | undefined,
  globalSettings?: Partial<CourseQuizTypeSettings> | null | undefined,
) {
  const normalizedSettings = getEffectiveCourseQuizTypeSettings(settings, globalSettings)
  return normalizedSettings.case_study && (normalizedSettings.single_choice || normalizedSettings.essay_ai)
}

export function hasAnyCourseQuizTypeEnabled(
  settings: Partial<CourseQuizTypeSettings> | null | undefined,
  globalSettings?: Partial<CourseQuizTypeSettings> | null | undefined,
) {
  const normalizedSettings = getEffectiveCourseQuizTypeSettings(settings, globalSettings)
  return Object.values(normalizedSettings).some(Boolean)
}
