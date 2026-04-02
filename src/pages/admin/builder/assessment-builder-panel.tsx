import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'
import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { GamifiedQuestionEditor } from '@/features/admin/assessments/gamified-question-editor'
import {
  createAssessmentCaseStudy,
  createAssessmentOption,
  createAssessmentQuestion,
  createFinalAssessment,
  createModuleAssessment,
  deleteAssessment,
  deleteAssessmentCaseStudy,
  deleteAssessmentOption,
  deleteAssessmentOptionsByQuestion,
  deleteAssessmentQuestion,
  fetchAssessmentById,
  fetchAssessmentCaseStudies,
  fetchAssessmentQuestions,
  fetchFinalAssessment,
  importAssessmentContentStructured,
  toErrorMessage,
  updateAssessmentCaseStudy,
  updateAssessment,
  updateAssessmentOption,
  updateAssessmentQuestion,
  type AssessmentCaseStudyWithQuestions,
  type AssessmentQuestionWithOptions,
  type ImportAssessmentData,
} from '@/features/admin/assessments/api'
import {
  createAnswerKeyFromInteraction,
  createDefaultInteractionContent,
  assessmentInteractionContentSchema,
  getInteractionSlotIds,
  isGamifiedQuestionType,
} from '@/features/assessments/gamified'
import { fetchModule } from '@/features/admin/content/api'
import type {
  Assessment,
  AssessmentGradingMode,
  AssessmentQuestionType,
  CourseModule,
} from '@/types/content'

function sortQuestionsByPosition(items: AssessmentQuestionWithOptions[]) {
  return [...items].sort((questionA, questionB) => questionA.position - questionB.position)
}

function sortCaseStudiesByPosition(items: AssessmentCaseStudyWithQuestions[]) {
  return [...items].sort((caseStudyA, caseStudyB) => caseStudyA.position - caseStudyB.position)
}

function sortCaseStudyQuestions(items: AssessmentQuestionWithOptions[]) {
  return [...items].sort(
    (questionA, questionB) => (questionA.case_question_position ?? 0) - (questionB.case_question_position ?? 0),
  )
}

function buildQuestionState(
  question: Omit<AssessmentQuestionWithOptions, 'options' | 'interaction' | 'answer_key'>,
  overrides?: Partial<AssessmentQuestionWithOptions>,
): AssessmentQuestionWithOptions {
  return {
    ...question,
    options: overrides?.options ?? [],
    interaction: overrides?.interaction ?? null,
    answer_key: overrides?.answer_key ?? null,
  }
}

function getPointsForApproval(question: AssessmentQuestionWithOptions) {
  return question.question_type === 'essay_ai' ? 0 : Number(question.points || 0)
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function getGamifiedItemCount(question: AssessmentQuestionWithOptions) {
  const parsed = assessmentInteractionContentSchema.safeParse(question.interaction?.content ?? null)
  if (!parsed.success) {
    return 0
  }

  return getInteractionSlotIds(parsed.data).length
}

function getQuestionScoringExplanation(question: AssessmentQuestionWithOptions) {
  if (question.question_type === 'essay_ai') {
    return 'Pergunta com feedback da IA. Ela nao soma pontos na nota final do quiz.'
  }

  const points = Number(question.points || 0)
  const pointsText = formatPoints(points)

  if (!isGamifiedQuestionType(question.question_type)) {
    return `Esta pergunta vale ${pointsText} ponto(s) e entra normalmente no calculo da aprovacao.`
  }

  const itemCount = getGamifiedItemCount(question)
  const itemLabel = question.question_type === 'drag_drop_labeling' || question.question_type === 'coloring'
    ? 'area'
    : 'lacuna'
  const gradingMode = question.answer_key?.grading_mode ?? 'partial_by_item'

  if (itemCount === 0) {
    return `Esta pergunta vale ${pointsText} ponto(s). Defina as ${itemLabel}s para calcular a divisao da nota.`
  }

  if (gradingMode === 'all_or_nothing') {
    return `Esta pergunta vale ${pointsText} ponto(s). O aluno so recebe a nota se acertar todas as ${itemCount} ${itemLabel}${itemCount > 1 ? 's' : ''}. Se errar 1 item, recebe 0 nesta pergunta.`
  }

  const pointsPerItem = points / itemCount
  return `Esta pergunta vale ${pointsText} ponto(s), divididos entre ${itemCount} ${itemLabel}${itemCount > 1 ? 's' : ''}. Cada item correto vale ${formatPoints(pointsPerItem)} ponto(s).`
}

function getDefaultGamifiedState(questionId: string, questionType: AssessmentQuestionType) {
  const interactionContent = createDefaultInteractionContent(questionType)
  const answerKey = createAnswerKeyFromInteraction(interactionContent)
  const timestamp = new Date().toISOString()

  if (!interactionContent || !answerKey) {
    return {
      interaction: null,
      answer_key: null,
    }
  }

  return {
    interaction: {
      question_id: questionId,
      content: interactionContent,
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
    },
    answer_key: {
      question_id: questionId,
      grading_mode: 'partial_by_item' as AssessmentGradingMode,
      answer_key: answerKey,
      created_at: timestamp,
      updated_at: timestamp,
    },
  }
}

export function AssessmentBuilderPanel() {
  const { courseId, moduleId, assessmentId } = useParams<{
    courseId: string
    moduleId?: string
    assessmentId?: string
  }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshTree } = useCourseBuilder()

  const [module, setModule] = useState<CourseModule | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [assessmentDraft, setAssessmentDraft] = useState<{
    title: string
    description: string
    passing_score: number
    max_attempts: number
    estimated_minutes: number
  } | null>(null)
  const [questions, setQuestions] = useState<AssessmentQuestionWithOptions[]>([])
  const [caseStudies, setCaseStudies] = useState<AssessmentCaseStudyWithQuestions[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isDeletingAssessment, setIsDeletingAssessment] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const questionPersistQueueRef = useRef<Record<string, Promise<void>>>({})
  const questionsRef = useRef<AssessmentQuestionWithOptions[]>([])
  const caseStudiesRef = useRef<AssessmentCaseStudyWithQuestions[]>([])

  const isFinal = !moduleId
  const isNewModuleAssessment = !isFinal && assessmentId === 'nova'

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!isFinal && moduleId) {
        const mod = await fetchModule(moduleId)
        setModule(mod)

        if (isNewModuleAssessment) {
          setAssessment(null)
          setQuestions([])
          setCaseStudies([])
          return
        }

        if (!assessmentId) {
          throw new Error('Quiz invalido.')
        }

        const assess = await fetchAssessmentById(assessmentId)
        if (!assess || assess.assessment_type !== 'module' || assess.module_id !== moduleId) {
          throw new Error('Quiz nao encontrado para este modulo.')
        }

        setAssessment(assess)
        const loadedQuestions = await fetchAssessmentQuestions(assess.id)
        const loadedCaseStudies = await fetchAssessmentCaseStudies(assess.id, loadedQuestions)
        setQuestions(loadedQuestions)
        setCaseStudies(loadedCaseStudies)

        return
      }

      if (courseId) {
        const assess = await fetchFinalAssessment(courseId)
        setAssessment(assess)

        if (assess) {
          const loadedQuestions = await fetchAssessmentQuestions(assess.id)
          const loadedCaseStudies = await fetchAssessmentCaseStudies(assess.id, loadedQuestions)
          setQuestions(loadedQuestions)
          setCaseStudies(loadedCaseStudies)
        } else {
          setQuestions([])
          setCaseStudies([])
        }
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [assessmentId, courseId, isFinal, isNewModuleAssessment, moduleId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!assessment) {
      setAssessmentDraft(null)
      return
    }

    setAssessmentDraft({
      title: assessment.title,
      description: assessment.description ?? '',
      passing_score: assessment.passing_score,
      max_attempts: assessment.max_attempts,
      estimated_minutes: assessment.estimated_minutes,
    })
  }, [assessment])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  useEffect(() => {
    caseStudiesRef.current = caseStudies
  }, [caseStudies])

  async function handleCreateAssessment() {
    if (!user || !courseId) return

    setIsLoading(true)

    try {
      const initialData = {
        title: isFinal ? 'Avaliação Final' : `Quiz: ${module?.title || 'Novo Módulo'}`,
        description: '',
        is_required: true,
        passing_score: 70,
        max_attempts: 3,
        estimated_minutes: 10,
        is_active: true,
      }

      if (!isFinal && moduleId) {
        const createdAssessment = await createModuleAssessment(courseId, moduleId, initialData, user.id)
        await refreshTree()
        navigate(`/admin/cursos/${courseId}/builder/modulos/${moduleId}/avaliacoes/${createdAssessment.id}`)
      } else {
        await createFinalAssessment(courseId, initialData, user.id)
        await loadData()
        await refreshTree()
      }
    } catch (createError) {
      setError(toErrorMessage(createError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpdateAssessment(updates: Partial<Assessment>) {
    if (!assessment) return

    try {
      await updateAssessment(assessment.id, {
        title: updates.title ?? assessment.title,
        description: updates.description ?? assessment.description ?? '',
        is_required: updates.is_required ?? assessment.is_required,
        passing_score: updates.passing_score ?? assessment.passing_score,
        max_attempts: updates.max_attempts ?? assessment.max_attempts,
        estimated_minutes: updates.estimated_minutes ?? assessment.estimated_minutes,
        is_active: updates.is_active ?? assessment.is_active,
      })

      setAssessment((prev) => (prev ? { ...prev, ...updates } : null))
    } catch (updateError) {
      setError(toErrorMessage(updateError))
    }
  }

  async function persistAssessmentDraft(updates: Partial<Assessment>) {
    if (!assessmentDraft) return

    if (updates.title !== undefined) {
      const title = updates.title.trim()
      setAssessmentDraft((prev) => (prev ? { ...prev, title } : null))
      if (title.length < 2) return
      await handleUpdateAssessment({ title })
      return
    }

    if (updates.description !== undefined) {
      await handleUpdateAssessment({ description: updates.description })
      return
    }

    await handleUpdateAssessment(updates)
  }

  function findQuestion(questionId: string) {
    const standaloneQuestion = questionsRef.current.find((question) => question.id === questionId)
    if (standaloneQuestion) {
      return standaloneQuestion
    }

    for (const caseStudy of caseStudiesRef.current) {
      const caseQuestion = caseStudy.questions.find((question) => question.id === questionId)
      if (caseQuestion) {
        return caseQuestion
      }
    }

    return null
  }

  function findCaseStudy(caseStudyId: string) {
    return caseStudiesRef.current.find((caseStudy) => caseStudy.id === caseStudyId) ?? null
  }

  function updateQuestionState(
    questionId: string,
    updater: (question: AssessmentQuestionWithOptions) => AssessmentQuestionWithOptions,
  ) {
    const standaloneQuestion = questionsRef.current.find((question) => question.id === questionId)

    if (standaloneQuestion) {
      const nextQuestions = questionsRef.current.map((question) => (
        question.id === questionId ? updater(question) : question
      ))
      questionsRef.current = nextQuestions
      setQuestions((prev) => prev.map((question) => (
        question.id === questionId ? updater(question) : question
      )))
      return
    }

    const nextCaseStudies = caseStudiesRef.current.map((caseStudy) => ({
      ...caseStudy,
      questions: caseStudy.questions.map((question) => (
        question.id === questionId ? updater(question) : question
      )),
    }))
    caseStudiesRef.current = nextCaseStudies
    setCaseStudies((prev) => prev.map((caseStudy) => ({
      ...caseStudy,
      questions: caseStudy.questions.map((question) => (
        question.id === questionId ? updater(question) : question
      )),
    })))
  }

  function updateOptionState(
    optionId: string,
    updater: (option: AssessmentQuestionWithOptions['options'][number]) => AssessmentQuestionWithOptions['options'][number],
  ) {
    const standaloneQuestion = questions.find((question) => question.options.some((option) => option.id === optionId))

    if (standaloneQuestion) {
      setQuestions((prev) => prev.map((question) => {
        if (!question.options.some((option) => option.id === optionId)) {
          return question
        }

        return {
          ...question,
          options: question.options.map((option) => (
            option.id === optionId ? updater(option) : option
          )),
        }
      }))
      return
    }

    setCaseStudies((prev) => prev.map((caseStudy) => ({
      ...caseStudy,
      questions: caseStudy.questions.map((question) => {
        if (!question.options.some((option) => option.id === optionId)) {
          return question
        }

        return {
          ...question,
          options: question.options.map((option) => (
            option.id === optionId ? updater(option) : option
          )),
        }
      }),
    })))
  }

  const standaloneQuestions = questions.filter((question) => !question.case_study_id)
  const scoredQuestions = [
    ...standaloneQuestions,
    ...caseStudies.flatMap((caseStudy) => caseStudy.questions),
  ].filter((question) => question.question_type !== 'essay_ai')
  const scoredQuestionsCount = scoredQuestions.length
  const totalPossiblePoints = scoredQuestions.reduce((total, question) => total + getPointsForApproval(question), 0)
  const requiredPoints = assessmentDraft
    ? Math.round(((assessmentDraft.passing_score / 100) * totalPossiblePoints) * 100) / 100
    : 0

  function buildQuestionPayload(
    questionId: string,
    updates: Partial<AssessmentQuestionWithOptions>,
  ) {
    const question = findQuestion(questionId)
    if (!question) {
      throw new Error('Questao nao encontrada.')
    }

    const questionType = updates.question_type ?? question.question_type
    const interactionContent = updates.interaction?.content
      ?? question.interaction?.content
      ?? null
    const gradingMode = updates.answer_key?.grading_mode
      ?? question.answer_key?.grading_mode
      ?? 'partial_by_item'
    const answerKey = updates.answer_key?.answer_key
      ?? question.answer_key?.answer_key
      ?? null

    return {
      question_text: updates.question_text ?? question.question_text,
      question_type: questionType,
      essay_expected_answer: questionType === 'essay_ai' || questionType === 'case_study_ai'
        ? updates.essay_expected_answer ?? question.essay_expected_answer ?? 'Resposta correta esperada.'
        : '',
      is_required: updates.is_required ?? question.is_required,
      points: questionType === 'essay_ai' ? 0 : Math.max(1, Number(updates.points ?? question.points ?? 1)),
      case_study_id: updates.case_study_id ?? question.case_study_id ?? undefined,
      case_question_position: updates.case_question_position ?? question.case_question_position ?? undefined,
      interaction_content: isGamifiedQuestionType(questionType) ? interactionContent : null,
      grading_mode: isGamifiedQuestionType(questionType) ? gradingMode : undefined,
      answer_key: isGamifiedQuestionType(questionType) ? answerKey : null,
    } as const
  }

  async function handleAddQuestion(questionType: AssessmentQuestionType = 'single_choice') {
    if (!assessment) return

    try {
      const defaultGamified = isGamifiedQuestionType(questionType)
        ? getDefaultGamifiedState('pending', questionType)
        : { interaction: null, answer_key: null }
      const createdQuestion = await createAssessmentQuestion(assessment.id, {
        question_text: 'Nova Pergunta...',
        question_type: questionType,
        essay_expected_answer: questionType === 'essay_ai' ? 'Resposta correta esperada.' : '',
        is_required: true,
        points: questionType === 'essay_ai' ? 0 : 1,
        interaction_content: defaultGamified.interaction?.content,
        grading_mode: defaultGamified.answer_key?.grading_mode,
        answer_key: defaultGamified.answer_key?.answer_key,
      })
      setQuestions((prev) => sortQuestionsByPosition([
        ...prev,
        buildQuestionState(createdQuestion, isGamifiedQuestionType(questionType)
          ? getDefaultGamifiedState(createdQuestion.id, questionType)
          : undefined),
      ]))
    } catch (createError) {
      setError(toErrorMessage(createError))
    }
  }

  async function handleAddCaseStudy() {
    if (!assessment) return

    try {
      const createdCaseStudy = await createAssessmentCaseStudy(assessment.id, {
        title: 'Novo Estudo de Caso',
        case_text: 'Descreva aqui o contexto do estudo de caso, com detalhes suficientes para orientar as respostas dos alunos.',
      })
      setCaseStudies((prev) => sortCaseStudiesByPosition([
        ...prev,
        { ...createdCaseStudy, questions: [] },
      ]))
    } catch (createError) {
      setError(toErrorMessage(createError))
    }
  }

  async function handleUpdateCaseStudy(caseStudyId: string, updates: { title?: string; case_text?: string }) {
    const caseStudy = findCaseStudy(caseStudyId)
    if (!caseStudy) return

    try {
      await updateAssessmentCaseStudy(caseStudyId, {
        title: updates.title ?? caseStudy.title ?? '',
        case_text: updates.case_text ?? caseStudy.case_text,
      })
    } catch (updateError) {
      setError(toErrorMessage(updateError))
      await loadData()
    }
  }

  function handleCaseStudyChange(caseStudyId: string, updates: { title?: string; case_text?: string }) {
    setCaseStudies((prev) => prev.map((caseStudy) => (
      caseStudy.id === caseStudyId
        ? {
          ...caseStudy,
          title: updates.title ?? caseStudy.title,
          case_text: updates.case_text ?? caseStudy.case_text,
        }
        : caseStudy
    )))
  }

  async function handleDeleteCaseStudy(caseStudyId: string) {
    if (!window.confirm('Excluir este estudo de caso e todas as perguntas vinculadas?')) return

    try {
      await deleteAssessmentCaseStudy(caseStudyId)
      setCaseStudies((prev) => prev.filter((caseStudy) => caseStudy.id !== caseStudyId))
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  async function handleAddCaseQuestion(caseStudyId: string, questionType: 'case_study_ai' | 'case_study_single_choice' = 'case_study_single_choice') {
    if (!assessment) return

    const caseStudy = findCaseStudy(caseStudyId)
    const nextCasePosition = (caseStudy?.questions.length ?? 0) + 1

    try {
      const createdQuestion = await createAssessmentQuestion(assessment.id, {
        question_text: 'Nova Pergunta do Caso...',
        question_type: questionType,
        essay_expected_answer: questionType === 'case_study_ai' ? 'Resposta correta esperada.' : '',
        is_required: true,
        points: 1,
        case_study_id: caseStudyId,
        case_question_position: nextCasePosition,
      })
      setCaseStudies((prev) => prev.map((caseStudyItem) => (
        caseStudyItem.id !== caseStudyId
          ? caseStudyItem
          : {
            ...caseStudyItem,
            questions: sortCaseStudyQuestions([
              ...caseStudyItem.questions,
              buildQuestionState(createdQuestion),
            ]),
          }
      )))
    } catch (createError) {
      setError(toErrorMessage(createError))
    }
  }

  function handleQuestionTextChange(questionId: string, questionText: string) {
    updateQuestionState(questionId, (question) => ({ ...question, question_text: questionText }))
  }

  async function handlePersistQuestion(questionId: string, updates: Partial<AssessmentQuestionWithOptions>) {
    const payload = buildQuestionPayload(questionId, updates)
    const previous = questionPersistQueueRef.current[questionId] ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          await updateAssessmentQuestion(questionId, payload)
        } catch (updateError) {
          setError(toErrorMessage(updateError))
          await loadData()
        }
      })

    questionPersistQueueRef.current[questionId] = next
    await next
  }

  async function handleUpdateQuestionType(questionId: string, questionType: AssessmentQuestionType) {
    const currentQuestion = findQuestion(questionId)
    if (!currentQuestion) return

    if (currentQuestion.case_study_id && isGamifiedQuestionType(questionType)) {
      setError('Questoes gamificadas ficam apenas como perguntas independentes nesta v1.')
      return
    }

    try {
      const defaultGamifiedState = isGamifiedQuestionType(questionType)
        ? getDefaultGamifiedState(questionId, questionType)
        : { interaction: null, answer_key: null }

      await updateAssessmentQuestion(questionId, buildQuestionPayload(questionId, {
        question_type: questionType,
        interaction: defaultGamifiedState.interaction,
        answer_key: defaultGamifiedState.answer_key,
      }))

      if (questionType === 'essay_ai' || questionType === 'case_study_ai') {
        await deleteAssessmentOptionsByQuestion(questionId)
      }

      const nextQuestionState = (question: AssessmentQuestionWithOptions) => (
        question.id !== questionId
          ? question
          : {
            ...question,
            question_type: questionType,
            essay_expected_answer: questionType === 'essay_ai' || questionType === 'case_study_ai'
              ? question.essay_expected_answer ?? 'Resposta correta esperada.'
              : null,
            points: questionType === 'essay_ai' ? 0 : Math.max(1, Number(question.points || 1)),
            options: questionType === 'essay_ai' || questionType === 'case_study_ai' ? [] : question.options,
            interaction: defaultGamifiedState.interaction,
            answer_key: defaultGamifiedState.answer_key,
          }
      )

      updateQuestionState(questionId, nextQuestionState)
    } catch (updateError) {
      setError(toErrorMessage(updateError))
    }
  }

  async function handleUpdateEssayExpectedAnswer(questionId: string, expectedAnswer: string) {
    updateQuestionState(questionId, (question) => ({ ...question, essay_expected_answer: expectedAnswer }))
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!window.confirm('Excluir esta pergunta e todo o conteudo associado?')) return

    try {
      await deleteAssessmentQuestion(questionId)
      const standaloneQuestion = questions.find((question) => question.id === questionId)

      if (standaloneQuestion) {
        setQuestions((prev) => prev.filter((question) => question.id !== questionId))
        return
      }

      setCaseStudies((prev) => prev.map((caseStudy) => ({
        ...caseStudy,
        questions: caseStudy.questions.filter((question) => question.id !== questionId),
      })))
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  async function handleAddOption(questionId: string) {
    const question = findQuestion(questionId)
    if (!question || (question.question_type !== 'single_choice' && question.question_type !== 'case_study_single_choice')) return

    try {
      const createdOption = await createAssessmentOption({
        question_id: questionId,
        option_text: 'Nova opcao...',
        is_correct: false,
      })
      updateQuestionState(questionId, (questionItem) => ({
        ...questionItem,
        options: [...questionItem.options, createdOption],
      }))
    } catch (createError) {
      setError(toErrorMessage(createError))
    }
  }

  function handleOptionTextChange(optionId: string, optionText: string) {
    updateOptionState(optionId, (option) => ({ ...option, option_text: optionText }))
  }

  async function handleUpdateOption(optionId: string, optionText: string, isCorrect: boolean) {
    try {
      await updateAssessmentOption(optionId, { option_text: optionText, is_correct: isCorrect })
      const updateQuestionOptions = (question: AssessmentQuestionWithOptions) => ({
        ...question,
        options: question.options.map((option) => {
          if (option.id === optionId) {
            return { ...option, option_text: optionText, is_correct: isCorrect }
          }

          if (isCorrect) {
            return { ...option, is_correct: false }
          }

          return option
        }),
      })

      const standaloneQuestion = questions.find((question) => question.options.some((option) => option.id === optionId))

      if (standaloneQuestion) {
        setQuestions((prev) => prev.map((question) => (
          question.options.some((option) => option.id === optionId)
            ? updateQuestionOptions(question)
            : question
        )))
        return
      }

      setCaseStudies((prev) => prev.map((caseStudy) => ({
        ...caseStudy,
        questions: caseStudy.questions.map((question) => (
          question.options.some((option) => option.id === optionId)
            ? updateQuestionOptions(question)
            : question
        )),
      })))
    } catch (updateError) {
      setError(toErrorMessage(updateError))
      await loadData()
    }
  }

  async function handleDeleteOption(optionId: string) {
    try {
      await deleteAssessmentOption(optionId)
      const standaloneQuestion = questions.find((question) => question.options.some((option) => option.id === optionId))

      if (standaloneQuestion) {
        setQuestions((prev) => prev.map((question) => (
          question.options.some((option) => option.id === optionId)
            ? { ...question, options: question.options.filter((option) => option.id !== optionId) }
            : question
        )))
        return
      }

      setCaseStudies((prev) => prev.map((caseStudy) => ({
        ...caseStudy,
        questions: caseStudy.questions.map((question) => (
          question.options.some((option) => option.id === optionId)
            ? { ...question, options: question.options.filter((option) => option.id !== optionId) }
            : question
        )),
      })))
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  async function handleImportJson() {
    if (!user?.id) return

    setIsImporting(true)
    setImportError(null)

    try {
      let cleanedJson = importJson.trim()
      const fencedMatch = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (fencedMatch?.[1]) {
        cleanedJson = fencedMatch[1].trim()
      } else {
        cleanedJson = cleanedJson.replace(/^```(json)?\s+/, '').replace(/\s+```$/, '').trim()
      }

      let parsedData: unknown
      try {
        parsedData = JSON.parse(cleanedJson)
      } catch {
        const fixedJson = cleanedJson.replace(/\n(?!\s*[[\]{}",:0-9.tfn-])/g, '\\n')
        parsedData = JSON.parse(fixedJson)
      }

      const data = parsedData as Record<string, unknown>
      let targetAssessmentId = assessment?.id

      if (!targetAssessmentId) {
        const initialData = {
          title: typeof data.title === 'string' && data.title.trim()
            ? data.title
            : (isFinal ? 'Avaliação Final' : `Quiz: ${module?.title || 'Novo Módulo'}`),
          description: typeof data.description === 'string' ? data.description : '',
          is_required: true,
          passing_score: typeof data.passing_score === 'number' ? data.passing_score : 70,
          max_attempts: typeof data.max_attempts === 'number' ? data.max_attempts : 3,
          estimated_minutes: typeof data.estimated_minutes === 'number' ? data.estimated_minutes : 10,
          is_active: true,
        }

        if (!isFinal && moduleId && courseId) {
          const created = await createModuleAssessment(courseId, moduleId, initialData, user.id)
          targetAssessmentId = created.id
        } else if (courseId) {
          const created = await createFinalAssessment(courseId, initialData, user.id)
          targetAssessmentId = created.id
        }
      }

      if (!targetAssessmentId) {
        throw new Error('Não foi possível criar ou localizar a avaliação alvo.')
      }

      await importAssessmentContentStructured(targetAssessmentId, data as unknown as ImportAssessmentData)
      await loadData()
      await refreshTree()
      setIsImportModalOpen(false)
      setImportJson('')
    } catch (importLoadError) {
      console.error('Erro ao importar avaliação:', importLoadError)
      setImportError(toErrorMessage(importLoadError))
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDeleteAssessment() {
    if (!assessment || !courseId) return

    const confirmMessage = isFinal
      ? `CUIDADO: Excluir a avaliação final "${assessment.title}"?\n\nTodas as questões, estudos de caso e tentativas vinculadas serão removidos permanentemente.`
      : `CUIDADO: Excluir o quiz "${assessment.title}"?\n\nTodas as questões, estudos de caso e tentativas vinculadas serão removidos permanentemente.`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setIsDeletingAssessment(true)
    setError(null)

    try {
      await deleteAssessment(assessment.id)
      await refreshTree()
      navigate(
        isFinal
          ? `/admin/cursos/${courseId}/builder/assessments`
          : `/admin/cursos/${courseId}/builder/modulos/${moduleId}`,
        { replace: true },
      )
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    } finally {
      setIsDeletingAssessment(false)
    }
  }

  function renderQuestionCard(
    question: AssessmentQuestionWithOptions,
    indexLabel: string,
    context: 'standalone' | 'case-study',
  ) {
    const isStandalone = context === 'standalone'
    const isEssay = question.question_type === 'essay_ai' || question.question_type === 'case_study_ai'
    const isGamified = isGamifiedQuestionType(question.question_type)
    const canUseSingleChoice = isStandalone
      ? question.question_type === 'single_choice'
      : question.question_type === 'case_study_single_choice'
    const canUseEssay = isStandalone
      ? question.question_type === 'essay_ai'
      : question.question_type === 'case_study_ai'
    const canUseDragDrop = isStandalone && question.question_type === 'drag_drop_labeling'
    const canUseFillInTheBlanks = isStandalone && question.question_type === 'fill_in_the_blanks'
    const canUseColoring = isStandalone && question.question_type === 'coloring'

    const setType = (type: AssessmentQuestionType) => void handleUpdateQuestionType(question.id, type)

    return (
      <div key={question.id} className="group animate-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all slide-in-from-bottom-4 duration-500 hover:border-blue-300">
        <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white text-lg font-black text-slate-400 shadow-sm">
            {indexLabel}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setType(isStandalone ? 'single_choice' : 'case_study_single_choice')}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
                  canUseSingleChoice
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                Múltipla Escolha
              </button>
              <button
                type="button"
                onClick={() => setType(isStandalone ? 'essay_ai' : 'case_study_ai')}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
                  canUseEssay
                    ? 'bg-amber-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-700'
                }`}
              >
                Discursiva com IA
              </button>
              {isStandalone ? (
                <>
                  <button
                    type="button"
                    onClick={() => setType('drag_drop_labeling')}
                    className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
                      canUseDragDrop
                        ? 'bg-cyan-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-cyan-200 hover:text-cyan-700'
                    }`}
                  >
                    Arrastar e Soltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('fill_in_the_blanks')}
                    className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
                      canUseFillInTheBlanks
                        ? 'bg-teal-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-700'
                    }`}
                  >
                    Preencher Lacunas
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('coloring')}
                    className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
                      canUseColoring
                        ? 'bg-fuchsia-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-fuchsia-200 hover:text-fuchsia-700'
                    }`}
                  >
                    Quiz de Colorir
                  </button>
                </>
              ) : null}
            </div>

            <textarea
              className="w-full resize-none border-none bg-transparent p-0 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-0"
              value={question.question_text}
              onChange={(event) => handleQuestionTextChange(question.id, event.target.value)}
              onBlur={() => void handlePersistQuestion(question.id, { question_text: question.question_text })}
              placeholder="Escreva sua pergunta aqui..."
              rows={2}
            />
          </div>

          <button
            onClick={() => void handleDeleteQuestion(question.id)}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h5" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pontuação</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {getQuestionScoringExplanation(question)}
              </p>
            </div>
            <input
              type="number"
              min={question.question_type === 'essay_ai' ? 0 : 1}
              className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-700 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              value={question.question_type === 'essay_ai' ? 0 : Number(question.points || 1)}
              disabled={question.question_type === 'essay_ai'}
              onChange={(event) => {
                const points = Number(event.target.value || 0)
                void handlePersistQuestion(question.id, { points })
                if (question.case_study_id) {
                  setCaseStudies((prev) => prev.map((caseStudy) => ({
                    ...caseStudy,
                    questions: caseStudy.questions.map((item) => (
                      item.id === question.id
                        ? { ...item, points }
                        : item
                    )),
                  })))
                } else {
                  setQuestions((prev) => prev.map((item) => (
                    item.id === question.id
                      ? { ...item, points }
                      : item
                  )))
                }
              }}
            />
          </div>

          {isEssay ? (
            <>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Gabarito da IA</p>
                <p className="mt-2 text-sm font-medium text-amber-900">
                  {question.question_type === 'essay_ai'
                    ? 'Informe a resposta considerada correta. A IA comparara esse texto com o que o aluno escrever e devolvera um feedback. Esta questao nao soma pontos no quiz.'
                    : 'Informe a resposta considerada correta para esta pergunta do estudo de caso. Esta pergunta soma pontos e sera validada pela IA.'}
                </p>
              </div>

              <textarea
                className="min-h-[140px] w-full rounded-2xl border border-amber-100 bg-white px-4 py-4 text-sm text-slate-700 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                value={question.essay_expected_answer ?? ''}
                onChange={(event) => void handleUpdateEssayExpectedAnswer(question.id, event.target.value)}
                onBlur={() => void handlePersistQuestion(question.id, { essay_expected_answer: question.essay_expected_answer ?? '' })}
                placeholder="Descreva a resposta esperada para orientar a avaliação da IA."
              />
            </>
          ) : isGamified ? (
            <GamifiedQuestionEditor
              question={question}
              onDraftChange={(updates) => updateQuestionState(question.id, (currentQuestion) => ({
                ...currentQuestion,
                ...updates,
              }))}
              onPersist={(updates) => handlePersistQuestion(question.id, updates)}
              onError={setError}
            />
          ) : (
            <>
              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Alternativas de Resposta</p>
              <div className="grid gap-3">
                {question.options.map((option) => (
                  <div key={option.id} className="group/opt flex items-center gap-3">
                    <button
                      onClick={() => void handleUpdateOption(option.id, option.option_text, !option.is_correct)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        option.is_correct
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {option.is_correct ? (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : null}
                    </button>

                    <input
                      className={`flex-1 rounded-xl border-none px-4 py-3 text-sm transition-all focus:ring-2 focus:ring-blue-100 ${
                        option.is_correct
                          ? 'bg-emerald-50 font-bold text-emerald-700'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                      value={option.option_text}
                      onChange={(event) => handleOptionTextChange(option.id, event.target.value)}
                      onBlur={() => void handleUpdateOption(option.id, option.option_text, option.is_correct)}
                      placeholder="Descreva a alternativa..."
                    />

                    <button
                      onClick={() => void handleDeleteOption(option.id)}
                      className="p-2 text-slate-300 opacity-0 transition-all group-hover/opt:opacity-100 hover:text-rose-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => void handleAddOption(question.id)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-100 py-3 text-xs font-bold text-slate-400 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar Alternativa
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (isLoading && !assessment) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!assessment || !assessmentDraft) {
    return (
      <div className="mx-auto max-w-2xl animate-in space-y-6 py-20 text-center fade-in zoom-in duration-500">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-blue-200 bg-blue-50">
          <svg className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800">Nenhum Quiz Encontrado</h2>
          <p className="text-slate-500">
            {isFinal
              ? 'A avaliação final ainda não foi criada.'
              : 'Crie um novo quiz para este módulo.'}
          </p>
        </div>
        <Button onClick={() => void handleCreateAssessment()} className="h-12 bg-blue-600 px-8 font-bold text-white shadow-lg ring-4 ring-blue-50 hover:bg-blue-700">
          Criar Quiz Agora
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl animate-in space-y-8 pb-24 fade-in duration-500">
      <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end">
        <div className="flex-1 space-y-1">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-600">
            Construtor de Avaliação
          </span>
          <input
            className="w-full border-none bg-transparent p-0 text-3xl font-black text-slate-900 placeholder:text-slate-300 focus:ring-0"
            value={assessmentDraft.title}
            onChange={(event) => setAssessmentDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
            onBlur={() => void persistAssessmentDraft({ title: assessmentDraft.title })}
            placeholder="Título do quiz..."
          />
          <input
            className="w-full border-none bg-transparent p-0 text-sm font-medium text-slate-500 placeholder:text-slate-400 focus:ring-0"
            value={assessmentDraft.description}
            onChange={(event) => setAssessmentDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
            onBlur={() => void persistAssessmentDraft({ description: assessmentDraft.description })}
            placeholder="Breve descrição ou instruções para o aluno..."
          />
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-2">
          <div className="border-r border-slate-200 px-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Média p/ Aprovação</p>
            <input
              type="number"
              className="w-12 border-none bg-transparent p-0 text-center font-black text-blue-600 focus:ring-0"
              value={assessmentDraft.passing_score}
              onChange={(event) => setAssessmentDraft((prev) => (prev ? { ...prev, passing_score: Number(event.target.value || 0) } : prev))}
              onBlur={() => void persistAssessmentDraft({ passing_score: assessmentDraft.passing_score })}
            />
            <span className="text-xs font-bold text-blue-600">%</span>
          </div>

          <div className="px-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Tentativas</p>
            <input
              type="number"
              className="w-12 border-none bg-transparent p-0 text-center font-black text-blue-600 focus:ring-0"
              value={assessmentDraft.max_attempts}
              onChange={(event) => setAssessmentDraft((prev) => (prev ? { ...prev, max_attempts: Number(event.target.value || 0) } : prev))}
              onBlur={() => void persistAssessmentDraft({ max_attempts: assessmentDraft.max_attempts })}
            />
          </div>

          <div className="border-l border-slate-200 px-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Duração (Min)</p>
            <input
              type="number"
              className="w-12 border-none bg-transparent p-0 text-center font-black text-blue-600 focus:ring-0"
              value={assessmentDraft.estimated_minutes}
              onChange={(event) => setAssessmentDraft((prev) => (prev ? { ...prev, estimated_minutes: Number(event.target.value || 0) } : prev))}
              onBlur={() => void persistAssessmentDraft({ estimated_minutes: assessmentDraft.estimated_minutes })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void handleDeleteAssessment()}
            disabled={isDeletingAssessment}
            className="flex h-10 items-center gap-2 rounded-xl border-rose-200 bg-white px-4 font-bold text-rose-600 transition-all hover:bg-rose-50 hover:text-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isDeletingAssessment ? 'Excluindo...' : (isFinal ? 'Excluir Avaliação' : 'Excluir Quiz')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl border-slate-200 bg-white px-4 font-bold text-slate-500 transition-all hover:bg-slate-50"
          >
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Importar de IA
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="grid gap-4 rounded-3xl border border-blue-100 bg-blue-50/50 p-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white px-5 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Questões Pontuáveis</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{scoredQuestionsCount}</p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
              Quantas perguntas realmente entram no calculo da nota final.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white px-5 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nota Minima Para Aprovar</p>
            <p className="mt-2 text-3xl font-black text-blue-700">{requiredPoints}</p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
              De um total de {formatPoints(totalPossiblePoints)} ponto(s) no quiz, o aluno precisa somar pelo menos {formatPoints(requiredPoints)}.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white px-5 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Como a Aprovacao Funciona</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
              O quiz vale {formatPoints(totalPossiblePoints)} ponto(s) no total. Para ser aprovado, o aluno precisa somar pelo menos {formatPoints(requiredPoints)} ponto(s), que correspondem a {assessmentDraft.passing_score}% da nota maxima.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-100 bg-cyan-50/60 px-6 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700">Leitura Rapida da Regra</p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-cyan-950">
            A aprovacao sempre considera a soma dos pontos do quiz inteiro. Em outras palavras: o aluno nao precisa acertar um numero fixo de perguntas, ele precisa atingir a nota minima definida para o total da avaliacao. Neste quiz, a nota maxima e {formatPoints(totalPossiblePoints)} ponto(s) e a nota minima para aprovar e {formatPoints(requiredPoints)} ponto(s).
          </p>
        </div>

        {standaloneQuestions.map((question, index) => renderQuestionCard(question, String(index + 1), 'standalone'))}

        {caseStudies.map((caseStudy, caseStudyIndex) => (
          <section key={caseStudy.id} className="overflow-hidden rounded-[32px] border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50/70 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                      Estudo de Caso {caseStudyIndex + 1}
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-700">
                      {caseStudy.questions.length} pergunta(s)
                    </span>
                  </div>

                  <input
                    className="w-full border-none bg-transparent p-0 text-2xl font-black text-slate-900 placeholder:text-slate-400 focus:ring-0"
                    value={caseStudy.title ?? ''}
                    onChange={(event) => handleCaseStudyChange(caseStudy.id, { title: event.target.value })}
                    onBlur={() => void handleUpdateCaseStudy(caseStudy.id, { title: caseStudy.title ?? '' })}
                    placeholder="Título do estudo de caso"
                  />

                  <textarea
                    className="min-h-[180px] w-full rounded-3xl border border-amber-100 bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                    value={caseStudy.case_text}
                    onChange={(event) => handleCaseStudyChange(caseStudy.id, { case_text: event.target.value })}
                    onBlur={() => void handleUpdateCaseStudy(caseStudy.id, { case_text: caseStudy.case_text })}
                    placeholder="Descreva o contexto completo do caso para o aluno analisar."
                  />
                </div>

                <button
                  onClick={() => void handleDeleteCaseStudy(caseStudy.id)}
                  className="rounded-xl p-3 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 4h5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {caseStudy.questions.map((question, questionIndex) => renderQuestionCard(question, `${caseStudyIndex + 1}.${questionIndex + 1}`, 'case-study'))}

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => void handleAddCaseQuestion(caseStudy.id, 'case_study_single_choice')}
                  className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-bold text-slate-500 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar Pergunta de Alternativa
                </button>
                <button
                  onClick={() => void handleAddCaseQuestion(caseStudy.id, 'case_study_ai')}
                  className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 py-4 text-sm font-bold text-amber-700 transition-all hover:bg-amber-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar Pergunta Discursiva
                </button>
              </div>
            </div>
          </section>
        ))}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Multipla Escolha',
              description: 'Pergunta independente com alternativas tradicionais.',
              className: 'border-slate-100 text-slate-400 hover:border-blue-100 hover:bg-blue-50/30 hover:text-blue-600',
              iconClassName: 'border-slate-100 bg-slate-50',
              onClick: () => void handleAddQuestion('single_choice'),
            },
            {
              title: 'Arrastar e Soltar',
              description: 'Imagem com hotspots e banco de rotulos avaliavel.',
              className: 'border-cyan-100 text-cyan-700 hover:bg-cyan-50/70',
              iconClassName: 'border-cyan-200 bg-cyan-50',
              onClick: () => void handleAddQuestion('drag_drop_labeling'),
            },
            {
              title: 'Preencher Lacunas',
              description: 'Texto com lacunas e banco de respostas arrastavel.',
              className: 'border-teal-100 text-teal-700 hover:bg-teal-50/70',
              iconClassName: 'border-teal-200 bg-teal-50',
              onClick: () => void handleAddQuestion('fill_in_the_blanks'),
            },
            {
              title: 'Quiz de Colorir',
              description: 'Imagem com areas pintaveis e checklist de cores por area.',
              className: 'border-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-50/70',
              iconClassName: 'border-fuchsia-200 bg-fuchsia-50',
              onClick: () => void handleAddQuestion('coloring'),
            },
            {
              title: 'Novo Estudo de Caso',
              description: 'Bloco com contexto compartilhado e perguntas mistas.',
              className: 'border-amber-100 text-amber-700 hover:bg-amber-50/60',
              iconClassName: 'border-amber-200 bg-amber-50',
              onClick: () => void handleAddCaseStudy(),
            },
          ].map((card) => (
            <button
              key={card.title}
              onClick={card.onClick}
              className={`flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-4 border-dashed py-12 transition-all ${card.className}`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${card.iconClassName}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-black uppercase tracking-widest">{card.title}</p>
                <p className="text-xs font-medium">{card.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {isImportModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[40px] border border-white/20 bg-white shadow-2xl no-scrollbar animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 p-8">
              <div>
                <h3 className="text-left text-xl font-black tracking-tight text-slate-900">Importar Avaliação via IA</h3>
                <p className="mt-1 text-left text-sm font-medium text-slate-500">
                  O JSON pode misturar perguntas avulsas e `case_studies`, incluindo `interaction` e `grading` para exercicios gamificados.
                </p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 p-8">
              <div className="space-y-2 text-left">
                <span className="block pl-1 text-xs font-black uppercase tracking-widest text-slate-400">Codigo JSON Estruturado</span>
                <textarea
                  className="h-80 w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 font-mono text-xs text-emerald-400 transition-all no-scrollbar focus:ring-4 focus:ring-blue-100"
                  placeholder='{ "title": "...", "questions": [...], "case_studies": [...] }'
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                />
              </div>

              {importError ? (
                <div className="animate-in rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600 slide-in-from-left-2 transition-all">
                  {importError}
                </div>
              ) : null}
            </div>

            <div className="flex gap-4 border-t border-slate-100 bg-slate-50/50 p-8">
              <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="h-14 flex-1 rounded-2xl font-bold text-slate-500">
                Cancelar
              </Button>
              <Button
                onClick={() => void handleImportJson()}
                disabled={isImporting || !importJson.trim()}
                className="h-14 flex-[2] rounded-2xl bg-blue-600 font-black text-white shadow-xl shadow-blue-100"
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importando Conteudo...
                  </span>
                ) : 'Importar Agora'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
