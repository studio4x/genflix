import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type QuestionType =
  | 'single_choice'
  | 'essay_ai'
  | 'case_study_ai'
  | 'case_study_single_choice'
  | 'drag_drop_labeling'
  | 'fill_in_the_blanks'
  | 'image_hotspot'
  | 'coloring'

interface AssessmentRow {
  id: string
  course_id: string
  module_id: string | null
  assessment_type: 'module' | 'final'
  passing_score: number
  is_active: boolean
}

interface QuestionRow {
  id: string
  assessment_id: string
  question_text: string
  question_type: QuestionType
  position: number
  is_required: boolean
  points: number
  essay_expected_answer: string | null
  case_study_id: string | null
  case_question_position: number | null
}

interface OptionRow {
  id: string
  question_id: string
  option_text: string
  position: number
  is_correct: boolean
}

interface CaseStudyRow {
  id: string
  assessment_id: string
  title: string | null
  case_text: string
  position: number
}

interface AnswerKeyRow {
  question_id: string
  grading_mode: 'partial_by_item' | 'all_or_nothing'
  answer_key: {
    entries?: Array<{
      slot_id?: string
      token_id?: string
    }>
    kind?: 'image_hotspot'
    correct_target_ids?: string[]
  } | null
}

interface InteractionRow {
  question_id: string
  content: Record<string, unknown> | null
}

interface SubmissionAnswerInput {
  question_id: string
  option_id?: string | null
  answer_text?: string | null
  response_payload?: {
    entries?: Array<{
      slot_id?: string
      token_id?: string | null
    }>
    kind?: 'image_hotspot'
    mode?: 'single_attempt' | 'find_all'
    selected_target_id?: string | null
    found_target_ids?: string[]
    incorrect_target_ids?: string[]
    outside_click_count?: number
  } | null
}

interface EssayEvaluation {
  question_id: string
  question_text: string
  answer_text: string
  is_correct: boolean
  feedback: string
}

interface ChoiceFeedback {
  question_id: string
  question_text: string
  selected_option_id: string | null
  correct_option_id: string | null
  is_correct: boolean
  earned_points: number
  possible_points: number
}

interface TokenMappingInteractionFeedback {
  question_id: string
  question_text: string
  is_correct: boolean
  earned_points: number
  possible_points: number
  entries: Array<{
    slot_id: string
    submitted_token_id: string | null
    expected_token_id: string
    is_correct: boolean
  }>
}

interface ImageHotspotInteractionFeedback {
  question_id: string
  question_text: string
  kind: 'image_hotspot'
  mode: 'single_attempt' | 'find_all'
  is_correct: boolean
  earned_points: number
  possible_points: number
  expected_correct_target_ids: string[]
  found_target_ids: string[]
  incorrect_target_ids: string[]
  outside_click_count: number
}

type InteractionFeedback =
  | TokenMappingInteractionFeedback
  | ImageHotspotInteractionFeedback

const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-2.5-flash'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await request.json().catch(() => ({}))
    const authHeader = request.headers.get('Authorization')
    const accessTokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
    const accessTokenFromBody = typeof requestBody?.access_token === 'string'
      ? requestBody.access_token.trim()
      : ''
    const accessToken = accessTokenFromBody || accessTokenFromHeader

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500)
    }

    if (!accessToken) {
      return jsonResponse({ error: 'Token ausente.' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido ou usuario nao autenticado.' }, 401)
    }

    const { data: isStudent, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role_code: 'student',
    })

    if (roleError || !isStudent) {
      return jsonResponse({ error: 'Apenas alunos podem responder avaliacao.' }, 403)
    }

    const assessmentId = typeof requestBody?.assessment_id === 'string'
      ? requestBody.assessment_id.trim()
      : ''
    const rawAnswers = Array.isArray(requestBody?.answers) ? requestBody.answers : null

    if (!assessmentId || !rawAnswers) {
      return jsonResponse({ error: 'assessment_id e answers sao obrigatorios.' }, 400)
    }

    const answers = normalizeAnswers(rawAnswers)
    const answerMap = new Map(answers.map((answer) => [answer.question_id, answer]))

    if (answerMap.size !== answers.length) {
      return jsonResponse({ error: 'Existem respostas duplicadas para a mesma questao.' }, 400)
    }

    const assessmentResult = await supabaseAdmin
      .from('assessments')
      .select('id, course_id, module_id, assessment_type, passing_score, is_active')
      .eq('id', assessmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (assessmentResult.error) {
      return jsonResponse({ error: assessmentResult.error.message }, 400)
    }

    const assessment = (assessmentResult.data as AssessmentRow | null) ?? null
    if (!assessment) {
      return jsonResponse({ error: 'Avaliacao nao encontrada ou inativa.' }, 404)
    }

    const { data: isReleased, error: releaseError } = await supabaseAdmin.rpc('is_course_released', {
      _user_id: user.id,
      _course_id: assessment.course_id,
    })

    if (releaseError || !isReleased) {
      return jsonResponse({ error: 'Avaliacao nao liberada para o usuario.' }, 403)
    }

    if (assessment.assessment_type === 'module') {
      if (!assessment.module_id) {
        return jsonResponse({ error: 'Avaliacao de modulo invalida.' }, 400)
      }

      const { data: isUnlocked, error: unlockError } = await supabaseAdmin.rpc('is_module_unlocked', {
        _user_id: user.id,
        _module_id: assessment.module_id,
      })

      if (unlockError || !isUnlocked) {
        return jsonResponse({ error: 'Modulo bloqueado para avaliacao.' }, 403)
      }
    } else {
      const { data: allRequiredCompleted, error: completedError } = await supabaseAdmin.rpc('are_required_modules_completed', {
        _user_id: user.id,
        _course_id: assessment.course_id,
      })

      if (completedError || !allRequiredCompleted) {
        return jsonResponse({ error: 'Avaliacao final bloqueada ate concluir os modulos obrigatorios.' }, 403)
      }
    }

    const attemptsResult = await supabaseAdmin
      .from('assessment_attempts')
      .select('attempt_number, score_percent, is_approved')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .eq('status', 'submitted')
      .order('attempt_number', { ascending: false })

    if (attemptsResult.error) {
      return jsonResponse({ error: attemptsResult.error.message }, 400)
    }

    const attempts = attemptsResult.data ?? []
    const attemptsUsed = attempts.length
    const maxAttemptsResult = await supabaseAdmin.rpc('get_assessment_effective_max_attempts', {
      _assessment_id: assessmentId,
      _user_id: user.id,
    })

    if (maxAttemptsResult.error) {
      return jsonResponse({ error: maxAttemptsResult.error.message }, 400)
    }

    const effectiveMaxAttempts = Number(maxAttemptsResult.data ?? 0)
    const alreadyPerfect = attempts.some((attempt) => Boolean(attempt.is_approved) && Number(attempt.score_percent) >= 100)

    if (alreadyPerfect) {
      return jsonResponse({ error: 'Avaliacao ja concluida com aproveitamento maximo.' }, 400)
    }

    if (attemptsUsed >= effectiveMaxAttempts) {
      return jsonResponse({ error: 'Limite de tentativas atingido para esta avaliacao.' }, 400)
    }

    const questionIdsResult = await supabaseAdmin
      .from('assessment_questions')
      .select('id')
      .eq('assessment_id', assessmentId)

    if (questionIdsResult.error) {
      return jsonResponse({ error: questionIdsResult.error.message }, 400)
    }

    const questionIds = (questionIdsResult.data ?? []).map((question) => question.id as string)

    const [questionsResult, optionsResult, caseStudiesResult, answerKeysResult, interactionsResult] = await Promise.all([
      supabaseAdmin
        .from('assessment_questions')
        .select('id, assessment_id, question_text, question_type, position, is_required, points, essay_expected_answer, case_study_id, case_question_position')
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true }),
      supabaseAdmin
        .from('assessment_options')
        .select('id, question_id, option_text, position, is_correct, assessment_questions!inner(assessment_id)')
        .eq('assessment_questions.assessment_id', assessmentId)
        .order('position', { ascending: true }),
      supabaseAdmin
        .from('assessment_case_studies')
        .select('id, assessment_id, title, case_text, position')
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true }),
      questionIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabaseAdmin
          .from('assessment_question_answer_keys')
          .select('question_id, grading_mode, answer_key')
          .in('question_id', questionIds),
      questionIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabaseAdmin
          .from('assessment_question_interactions')
          .select('question_id, content')
          .in('question_id', questionIds),
    ])

    if (questionsResult.error) {
      return jsonResponse({ error: questionsResult.error.message }, 400)
    }

    if (optionsResult.error) {
      return jsonResponse({ error: optionsResult.error.message }, 400)
    }

    if (caseStudiesResult.error) {
      return jsonResponse({ error: caseStudiesResult.error.message }, 400)
    }

    if (answerKeysResult.error) {
      return jsonResponse({ error: answerKeysResult.error.message }, 400)
    }

    if (interactionsResult.error) {
      return jsonResponse({ error: interactionsResult.error.message }, 400)
    }

    const questions = ((questionsResult.data ?? []) as QuestionRow[])
    const options = ((optionsResult.data ?? []) as OptionRow[])
    const caseStudies = ((caseStudiesResult.data ?? []) as CaseStudyRow[])
    const answerKeys = ((answerKeysResult.data ?? []) as AnswerKeyRow[])
    const interactions = ((interactionsResult.data ?? []) as InteractionRow[])

    if (questions.length === 0) {
      return jsonResponse({ error: 'Avaliacao sem questoes cadastradas.' }, 400)
    }

    const optionsByQuestion = new Map<string, OptionRow[]>()
    for (const option of options) {
      const current = optionsByQuestion.get(option.question_id) ?? []
      current.push(option)
      optionsByQuestion.set(option.question_id, current)
    }

    const answerKeysByQuestion = new Map<string, AnswerKeyRow>()
    for (const answerKey of answerKeys) {
      answerKeysByQuestion.set(answerKey.question_id, answerKey)
    }

    const interactionsByQuestion = new Map<string, InteractionRow>()
    for (const interaction of interactions) {
      interactionsByQuestion.set(interaction.question_id, interaction)
    }

    const caseStudyById = new Map(caseStudies.map((caseStudy) => [caseStudy.id, caseStudy]))
    const essayQuestions = questions.filter((question) =>
      question.question_type === 'essay_ai' || question.question_type === 'case_study_ai'
    )

    if (essayQuestions.length > 0 && !openAiApiKey && !geminiApiKey) {
      return jsonResponse({ error: 'Nenhum provedor de IA configurado para corrigir questoes discursivas.' }, 500)
    }

    const essayInputs = essayQuestions
      .map((question) => {
        const answer = answerMap.get(question.id)
        const answerText = normalizeAnswerText(answer?.answer_text)

        if (!answerText && question.is_required) {
          throw new Error('Todas as questoes obrigatorias devem ser respondidas.')
        }

        return answerText
          ? { question, answerText }
          : null
      })
      .filter((item): item is { question: QuestionRow; answerText: string } => Boolean(item))

    const essayEvaluations = await Promise.all(
      essayInputs.map(({ question, answerText }) => evaluateEssayAnswer({
        caseStudyText: question.case_study_id
          ? (caseStudyById.get(question.case_study_id)?.case_text ?? null)
          : null,
        questionText: question.question_text,
        expectedAnswer: question.essay_expected_answer ?? '',
        studentAnswer: answerText,
        openAiApiKey,
        geminiApiKey,
      }).then((evaluation) => ({
        question_id: question.id,
        question_text: question.question_text,
        answer_text: answerText,
        is_correct: evaluation.is_correct,
        feedback: evaluation.feedback,
      } satisfies EssayEvaluation))),
    )

    const essayEvaluationMap = new Map(essayEvaluations.map((evaluation) => [evaluation.question_id, evaluation]))
    const choiceFeedbacks: ChoiceFeedback[] = []
    const interactionFeedbacks: InteractionFeedback[] = []
    const answerRows: Array<{
      question_id: string
      selected_option_id: string | null
      answer_text: string | null
      response_payload: Record<string, unknown> | null
      is_correct: boolean
      earned_points: number
      ai_feedback: string | null
      ai_evaluation: Record<string, unknown> | null
    }> = []

    let correctAnswers = 0
    let totalQuestions = 0
    let earnedPoints = 0
    let possiblePoints = 0

    for (const question of questions) {
      const answer = answerMap.get(question.id)
      const answerText = normalizeAnswerText(answer?.answer_text)

      if (question.question_type === 'essay_ai' || question.question_type === 'case_study_ai') {
        const evaluation = essayEvaluationMap.get(question.id) ?? null

        if (!answerText && question.is_required) {
          return jsonResponse({ error: 'Todas as questoes obrigatorias devem ser respondidas.' }, 400)
        }

        const questionPossiblePoints = question.question_type === 'case_study_ai' ? Number(question.points || 0) : 0
        const questionEarnedPoints = evaluation?.is_correct ? questionPossiblePoints : 0
        const isCorrect = Boolean(evaluation?.is_correct)

        if (questionPossiblePoints > 0) {
          possiblePoints += questionPossiblePoints
          totalQuestions += 1
          earnedPoints += questionEarnedPoints
          if (isCorrect) {
            correctAnswers += 1
          }
        }

        answerRows.push({
          question_id: question.id,
          selected_option_id: null,
          answer_text: answerText,
          response_payload: null,
          is_correct: isCorrect,
          earned_points: questionEarnedPoints,
          ai_feedback: evaluation?.feedback ?? null,
          ai_evaluation: evaluation
            ? {
              is_correct: evaluation.is_correct,
              feedback: evaluation.feedback,
            }
            : null,
        })
        continue
      }

      if (question.question_type === 'single_choice' || question.question_type === 'case_study_single_choice') {
        totalQuestions += 1
        const questionPossiblePoints = Number(question.points || 0)
        possiblePoints += questionPossiblePoints

        const selectedOptionId = typeof answer?.option_id === 'string' && answer.option_id.trim()
          ? answer.option_id.trim()
          : null

        if (!selectedOptionId && question.is_required) {
          return jsonResponse({ error: 'Todas as questoes obrigatorias devem ser respondidas.' }, 400)
        }

        let isCorrect = false
        let correctOptionId: string | null = null
        const questionOptions = optionsByQuestion.get(question.id) ?? []
        const correctOption = questionOptions.find((item) => item.is_correct)
        correctOptionId = correctOption?.id ?? null

        if (selectedOptionId) {
          const option = questionOptions.find((item) => item.id === selectedOptionId)
          if (!option) {
            return jsonResponse({ error: 'Opcao invalida para uma das questoes.' }, 400)
          }
          isCorrect = option.is_correct
        }

        const questionEarnedPoints = isCorrect ? questionPossiblePoints : 0
        earnedPoints += questionEarnedPoints

        if (isCorrect) {
          correctAnswers += 1
        }

        answerRows.push({
          question_id: question.id,
          selected_option_id: selectedOptionId,
          answer_text: null,
          response_payload: null,
          is_correct: isCorrect,
          earned_points: questionEarnedPoints,
          ai_feedback: null,
          ai_evaluation: null,
        })

        choiceFeedbacks.push({
          question_id: question.id,
          question_text: question.question_text,
          selected_option_id: selectedOptionId,
          correct_option_id: correctOptionId,
          is_correct: isCorrect,
          earned_points: questionEarnedPoints,
          possible_points: questionPossiblePoints,
        })
        continue
      }

      totalQuestions += 1
      const questionPossiblePoints = Number(question.points || 0)
      possiblePoints += questionPossiblePoints

      const grading = scoreInteractionAnswer({
        question,
        interaction: interactionsByQuestion.get(question.id) ?? null,
        answer,
        answerKey: answerKeysByQuestion.get(question.id) ?? null,
      })

      earnedPoints += grading.earnedPoints
      if (grading.isCorrect) {
        correctAnswers += 1
      }

      answerRows.push({
        question_id: question.id,
        selected_option_id: null,
        answer_text: null,
        response_payload: grading.responsePayload,
        is_correct: grading.isCorrect,
        earned_points: grading.earnedPoints,
        ai_feedback: null,
        ai_evaluation: null,
      })

      interactionFeedbacks.push({
        question_id: question.id,
        question_text: question.question_text,
        is_correct: grading.isCorrect,
        earned_points: grading.earnedPoints,
        possible_points: questionPossiblePoints,
        ...grading.feedback,
      })
    }

    const essayOnlyAssessment = possiblePoints === 0 && essayQuestions.length > 0
    const essayApproved = essayOnlyAssessment
      ? answerRows
        .filter((row) => questions.find((question) => question.id === row.question_id)?.question_type === 'essay_ai')
        .every((row) => {
          const question = questions.find((item) => item.id === row.question_id)
          if (!question) return false
          if (!row.answer_text) return !question.is_required
          return row.is_correct
        })
      : false

    const scorePercent = possiblePoints > 0
      ? roundToTwo((earnedPoints * 100) / possiblePoints)
      : essayOnlyAssessment
        ? (essayApproved ? 100 : 0)
        : 0

    const isApproved = possiblePoints > 0
      ? scorePercent >= Number(assessment.passing_score ?? 0)
      : essayOnlyAssessment
        ? essayApproved
        : false

    const attemptNumber = attemptsUsed + 1
    const attemptId = await insertAttemptWithRetry({
      supabaseAdmin,
      assessmentId,
      userId: user.id,
      attemptNumber,
      scorePercent,
      earnedPoints,
      possiblePoints,
      correctAnswers,
      totalQuestions,
      isApproved,
      answerRows,
    })

    const refreshResult = await supabaseAdmin.rpc('refresh_course_progress', {
      _user_id: user.id,
      _course_id: assessment.course_id,
    })

    if (refreshResult.error) {
      console.error('Falha ao atualizar progresso do curso apos submissao:', refreshResult.error)
    }

    return jsonResponse({
      attempt_id: attemptId,
      score_percent: scorePercent,
      earned_points: roundToTwo(earnedPoints),
      possible_points: roundToTwo(possiblePoints),
      is_approved: isApproved,
      attempt_number: attemptNumber,
      max_attempts: effectiveMaxAttempts,
      remaining_attempts: Math.max(effectiveMaxAttempts - attemptNumber, 0),
      score_mode: essayOnlyAssessment ? 'essay_only' : 'objective_only',
      correct_answers: correctAnswers,
      total_questions: totalQuestions,
      essay_feedbacks: essayEvaluations,
      choice_feedbacks: choiceFeedbacks,
      interaction_feedbacks: interactionFeedbacks,
    }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao enviar avaliacao.'
    return jsonResponse({ error: message }, 500)
  }
})

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeAnswers(rawAnswers: unknown[]): SubmissionAnswerInput[] {
  return rawAnswers.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Formato de resposta invalido.')
    }

    const answer = item as Record<string, unknown>
    const questionId = typeof answer.question_id === 'string' ? answer.question_id.trim() : ''
    const optionId = typeof answer.option_id === 'string' ? answer.option_id.trim() : null
    const answerText = typeof answer.answer_text === 'string' ? answer.answer_text : null
    const responsePayload = answer.response_payload && typeof answer.response_payload === 'object'
      ? answer.response_payload as SubmissionAnswerInput['response_payload']
      : null

    if (!questionId) {
      throw new Error('Questao invalida.')
    }

    return {
      question_id: questionId,
      option_id: optionId,
      answer_text: answerText,
      response_payload: responsePayload,
    }
  })
}

function normalizeAnswerText(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.replace(/\r/g, '').trim()
  return normalized.length > 0 ? normalized.slice(0, 5000) : null
}

function normalizeResponsePayload(payload: SubmissionAnswerInput['response_payload']) {
  if (payload?.kind === 'image_hotspot') {
    const normalizeTargetIds = (value: unknown) => Array.isArray(value)
      ? value
        .map((item) => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean)
      : []

    return {
      kind: 'image_hotspot' as const,
      mode: payload.mode === 'find_all' ? 'find_all' : 'single_attempt',
      selected_target_id: typeof payload.selected_target_id === 'string' && payload.selected_target_id.trim()
        ? payload.selected_target_id.trim()
        : null,
      found_target_ids: normalizeTargetIds(payload.found_target_ids),
      incorrect_target_ids: normalizeTargetIds(payload.incorrect_target_ids),
      outside_click_count: Number.isFinite(payload.outside_click_count)
        ? Math.max(0, Math.trunc(Number(payload.outside_click_count)))
        : 0,
    }
  }

  const entries = Array.isArray(payload?.entries)
    ? payload.entries
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        slot_id: typeof entry.slot_id === 'string' ? entry.slot_id.trim() : '',
        token_id: typeof entry.token_id === 'string' && entry.token_id.trim()
          ? entry.token_id.trim()
          : null,
      }))
      .filter((entry) => entry.slot_id)
    : []

  return {
    entries,
  }
}

function getImageHotspotTargets(content: Record<string, unknown> | null) {
  if (!content || typeof content !== 'object' || content.kind !== 'image_hotspot') {
    return []
  }

  return (Array.isArray(content.targets) ? content.targets : [])
    .filter((target) => target && typeof target === 'object')
    .map((target) => {
      const record = target as Record<string, unknown>
      return {
        id: typeof record.id === 'string' ? record.id.trim() : '',
        is_correct: Boolean(record.is_correct),
      }
    })
    .filter((target) => target.id)
}

function normalizeImageHotspotAnswerKey(
  content: Record<string, unknown> | null,
  answerKey: AnswerKeyRow['answer_key'],
) {
  const targetIds = new Set(getImageHotspotTargets(content).map((target) => target.id))
  const answerKeyIds = Array.isArray(answerKey?.correct_target_ids)
    ? answerKey.correct_target_ids
      .map((targetId) => typeof targetId === 'string' ? targetId.trim() : '')
      .filter((targetId) => targetId && targetIds.has(targetId))
    : []

  if (answerKeyIds.length > 0) {
    return Array.from(new Set(answerKeyIds))
  }

  return getImageHotspotTargets(content)
    .filter((target) => target.is_correct)
    .map((target) => target.id)
}

function scoreInteractionAnswer(input: {
  question: QuestionRow
  interaction: InteractionRow | null
  answer: SubmissionAnswerInput | undefined
  answerKey: AnswerKeyRow | null
}) {
  const normalizedPayload = normalizeResponsePayload(input.answer?.response_payload)

  if (normalizedPayload.kind === 'image_hotspot') {
    const targetIds = new Set(getInteractionSlotIds(input.interaction?.content ?? null))
    const correctTargetIds = normalizeImageHotspotAnswerKey(
      input.interaction?.content ?? null,
      input.answerKey?.answer_key ?? null,
    )

    if (correctTargetIds.length === 0) {
      throw new Error('Questao de hotspot sem gabarito configurado.')
    }

    const foundTargetIds = Array.from(new Set(
      normalizedPayload.found_target_ids.filter((targetId) => targetIds.has(targetId) && correctTargetIds.includes(targetId)),
    ))
    const incorrectTargetIds = Array.from(new Set(
      normalizedPayload.incorrect_target_ids.filter((targetId) => targetIds.has(targetId) && !correctTargetIds.includes(targetId)),
    ))
    const selectedTargetId = normalizedPayload.selected_target_id && targetIds.has(normalizedPayload.selected_target_id)
      ? normalizedPayload.selected_target_id
      : null
    const outsideClickCount = Math.max(0, normalizedPayload.outside_click_count)

    const hasAnswered = Boolean(selectedTargetId || foundTargetIds.length > 0 || incorrectTargetIds.length > 0 || outsideClickCount > 0)
    if (!hasAnswered && input.question.is_required) {
      throw new Error('Todas as questoes obrigatorias devem ser respondidas.')
    }

    const possiblePoints = Number(input.question.points || 0)

    if (normalizedPayload.mode === 'single_attempt') {
      const isCorrect = Boolean(selectedTargetId && correctTargetIds.includes(selectedTargetId))
      return {
        isCorrect,
        earnedPoints: isCorrect ? possiblePoints : 0,
        responsePayload: {
          kind: 'image_hotspot',
          mode: 'single_attempt',
          selected_target_id: selectedTargetId,
          found_target_ids: isCorrect && selectedTargetId ? [selectedTargetId] : [],
          incorrect_target_ids: !isCorrect && selectedTargetId ? [selectedTargetId] : [],
          outside_click_count: selectedTargetId ? 0 : outsideClickCount,
        } satisfies Record<string, unknown>,
        feedback: {
          kind: 'image_hotspot' as const,
          mode: 'single_attempt' as const,
          expected_correct_target_ids: correctTargetIds,
          found_target_ids: isCorrect && selectedTargetId ? [selectedTargetId] : [],
          incorrect_target_ids: !isCorrect && selectedTargetId ? [selectedTargetId] : [],
          outside_click_count: selectedTargetId ? 0 : outsideClickCount,
        },
      }
    }

    const correctFoundCount = foundTargetIds.length
    const allCorrectFound = correctTargetIds.every((targetId) => foundTargetIds.includes(targetId))
    const hasPenalty = incorrectTargetIds.length > 0 || outsideClickCount > 0
    const isCorrect = allCorrectFound && !hasPenalty
    const earnedPoints = input.answerKey?.grading_mode === 'all_or_nothing'
      ? (isCorrect ? possiblePoints : 0)
      : roundToTwo(possiblePoints * (correctFoundCount / correctTargetIds.length))

    return {
      isCorrect,
      earnedPoints,
      responsePayload: {
        kind: 'image_hotspot',
        mode: 'find_all',
        selected_target_id: selectedTargetId,
        found_target_ids: foundTargetIds,
        incorrect_target_ids: incorrectTargetIds,
        outside_click_count: outsideClickCount,
      } satisfies Record<string, unknown>,
      feedback: {
        kind: 'image_hotspot' as const,
        mode: 'find_all' as const,
        expected_correct_target_ids: correctTargetIds,
        found_target_ids: foundTargetIds,
        incorrect_target_ids: incorrectTargetIds,
        outside_click_count: outsideClickCount,
      },
    }
  }

  const answerEntries = normalizeInteractionAnswerKeyEntries(
    input.interaction?.content ?? null,
    Array.isArray(input.answerKey?.answer_key?.entries) ? input.answerKey?.answer_key?.entries : [],
  )

  if (answerEntries.length === 0) {
    throw new Error('Questao gamificada sem gabarito configurado.')
  }

  if (normalizedPayload.entries.length === 0 && input.question.is_required) {
    throw new Error('Todas as questoes obrigatorias devem ser respondidas.')
  }

  const responseMap = new Map(normalizedPayload.entries.map((entry) => [entry.slot_id, entry.token_id]))
  const entryFeedback = answerEntries.map((entry) => ({
    slot_id: entry.slot_id,
    submitted_token_id: responseMap.get(entry.slot_id) ?? null,
    expected_token_id: entry.token_id,
    is_correct: (responseMap.get(entry.slot_id) ?? null) === entry.token_id,
  }))
  const correctEntries = entryFeedback.filter((entry) => entry.is_correct).length
  const isCorrect = correctEntries === answerEntries.length
  const possiblePoints = Number(input.question.points || 0)

  const earnedPoints = input.answerKey?.grading_mode === 'all_or_nothing'
    ? (isCorrect ? possiblePoints : 0)
    : roundToTwo(possiblePoints * (correctEntries / answerEntries.length))

  return {
    isCorrect,
    earnedPoints,
    responsePayload: normalizedPayload as Record<string, unknown>,
    feedback: {
      entries: entryFeedback,
    },
  }
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeInteractionAnswerKeyEntries(
  content: Record<string, unknown> | null,
  rawEntries: Array<{ slot_id?: string; token_id?: string }>,
) {
  const slotIds = getInteractionSlotIds(content)
  const tokenIds = getInteractionTokenIds(content)
  const preservedEntries: Array<{ slot_id: string; token_id: string }> = []
  const usedSlots = new Set<string>()
  const usedTokens = new Set<string>()

  for (const rawEntry of rawEntries) {
    const slotId = typeof rawEntry.slot_id === 'string' ? rawEntry.slot_id.trim() : ''
    const tokenId = typeof rawEntry.token_id === 'string' ? rawEntry.token_id.trim() : ''

    if (!slotIds.includes(slotId) || !tokenIds.includes(tokenId)) {
      continue
    }

    if (usedSlots.has(slotId) || usedTokens.has(tokenId)) {
      continue
    }

    preservedEntries.push({ slot_id: slotId, token_id: tokenId })
    usedSlots.add(slotId)
    usedTokens.add(tokenId)
  }

  const availableTokenIds = tokenIds.filter((tokenId) => !usedTokens.has(tokenId))

  for (const slotId of slotIds) {
    if (usedSlots.has(slotId)) {
      continue
    }

    const nextTokenId = availableTokenIds.shift()
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

  return preservedEntries
}

function getInteractionSlotIds(content: Record<string, unknown> | null) {
  if (!content || typeof content !== 'object') {
    return []
  }

  if (content.kind === 'drag_drop_labeling') {
    const targets = Array.isArray(content.targets) ? content.targets : []
    return targets
      .map((target) => (
        target && typeof target === 'object' && typeof target.id === 'string'
          ? target.id.trim()
          : ''
      ))
      .filter(Boolean)
  }

  if (content.kind === 'image_hotspot') {
    const targets = Array.isArray(content.targets) ? content.targets : []
    return targets
      .map((target) => (
        target && typeof target === 'object' && typeof target.id === 'string'
          ? target.id.trim()
          : ''
      ))
      .filter(Boolean)
  }

  if (content.kind === 'coloring') {
    if (content.render_mode === 'svg_regions') {
      const regions = Array.isArray(content.regions) ? content.regions : []
      return regions
        .map((region) => (
          region && typeof region === 'object' && typeof region.region_id === 'string'
            ? region.region_id.trim()
            : ''
        ))
        .filter(Boolean)
    }

    const targets = Array.isArray(content.targets) ? content.targets : []
    return targets
      .map((target) => (
        target && typeof target === 'object' && typeof target.id === 'string'
          ? target.id.trim()
          : ''
      ))
      .filter(Boolean)
  }

  if (content.kind === 'fill_in_the_blanks') {
    const segments = Array.isArray(content.segments) ? content.segments : []
    return segments
      .map((segment) => (
        segment
        && typeof segment === 'object'
        && segment.type === 'blank'
        && typeof segment.id === 'string'
          ? segment.id.trim()
          : ''
      ))
      .filter(Boolean)
  }

  return []
}

function getInteractionTokenIds(content: Record<string, unknown> | null) {
  if (!content || typeof content !== 'object' || !Array.isArray(content.tokens)) {
    return []
  }

  return content.tokens
    .map((token) => (
      token && typeof token === 'object' && typeof token.id === 'string'
        ? token.id.trim()
        : ''
    ))
    .filter(Boolean)
}

async function insertAttemptWithRetry(input: {
  supabaseAdmin: ReturnType<typeof createClient>
  assessmentId: string
  userId: string
  attemptNumber: number
  scorePercent: number
  earnedPoints: number
  possiblePoints: number
  correctAnswers: number
  totalQuestions: number
  isApproved: boolean
  answerRows: Array<{
    question_id: string
    selected_option_id: string | null
    answer_text: string | null
    response_payload: Record<string, unknown> | null
    is_correct: boolean
    earned_points: number
    ai_feedback: string | null
    ai_evaluation: Record<string, unknown> | null
  }>
}) {
  let nextAttemptNumber = input.attemptNumber

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const insertAttemptResult = await input.supabaseAdmin
      .from('assessment_attempts')
      .insert({
        assessment_id: input.assessmentId,
        user_id: input.userId,
        attempt_number: nextAttemptNumber,
        status: 'submitted',
        score_percent: input.scorePercent,
        earned_points: input.earnedPoints,
        possible_points: input.possiblePoints,
        correct_answers: input.correctAnswers,
        total_questions: input.totalQuestions,
        is_approved: input.isApproved,
      })
      .select('id')
      .single()

    if (insertAttemptResult.error) {
      if (insertAttemptResult.error.code === '23505' && attempt === 0) {
        const attemptsResult = await input.supabaseAdmin
          .from('assessment_attempts')
          .select('attempt_number')
          .eq('assessment_id', input.assessmentId)
          .eq('user_id', input.userId)
          .eq('status', 'submitted')
          .order('attempt_number', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (attemptsResult.error) {
          throw new Error(attemptsResult.error.message)
        }

        nextAttemptNumber = Number(attemptsResult.data?.attempt_number ?? nextAttemptNumber) + 1
        continue
      }

      throw new Error(insertAttemptResult.error.message)
    }

    const attemptId = insertAttemptResult.data.id as string
    const answersInsertResult = await input.supabaseAdmin
      .from('assessment_answers')
      .insert(input.answerRows.map((row) => ({
        attempt_id: attemptId,
        question_id: row.question_id,
        selected_option_id: row.selected_option_id,
        answer_text: row.answer_text,
        response_payload: row.response_payload,
        earned_points: row.earned_points,
        is_correct: row.is_correct,
        ai_feedback: row.ai_feedback,
        ai_evaluation: row.ai_evaluation,
      })))

    if (answersInsertResult.error) {
      await input.supabaseAdmin
        .from('assessment_attempts')
        .delete()
        .eq('id', attemptId)

      throw new Error(answersInsertResult.error.message)
    }

    return attemptId
  }

  throw new Error('Nao foi possivel registrar a tentativa da avaliacao.')
}

async function evaluateEssayAnswer(input: {
  caseStudyText: string | null
  questionText: string
  expectedAnswer: string
  studentAnswer: string
  openAiApiKey: string
  geminiApiKey: string
}) {
  if (input.openAiApiKey) {
    const openAiResult = await evaluateWithOpenAi(input, input.openAiApiKey)
    if (openAiResult.ok) {
      return openAiResult.data
    }
  }

  if (input.geminiApiKey) {
    return await evaluateWithGemini(input, input.geminiApiKey)
  }

  throw new Error('Nenhum provedor de IA disponivel para corrigir questoes discursivas.')
}

async function evaluateWithOpenAi(
  input: {
    caseStudyText: string | null
    questionText: string
    expectedAnswer: string
    studentAnswer: string
  },
  apiKey: string,
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'user',
          content: buildEssayPrompt(input),
        },
      ],
    }),
  })

  if (!response.ok) {
    return {
      ok: false as const,
      error: await response.text(),
    }
  }

  const payload = await response.json()
  const rawContent = payload?.choices?.[0]?.message?.content
  if (typeof rawContent !== 'string') {
    return {
      ok: false as const,
      error: 'OpenAI nao retornou um conteudo valido.',
    }
  }

  return {
    ok: true as const,
    data: normalizeEssayEvaluation(extractJsonObject(rawContent)),
  }
}

async function evaluateWithGemini(
  input: {
    caseStudyText: string | null
    questionText: string
    expectedAnswer: string
    studentAnswer: string
  },
  apiKey: string,
) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildEssayPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Falha ao consultar Gemini: ${await response.text()}`)
  }

  const payload = await response.json()
  const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof rawText !== 'string') {
    throw new Error('Gemini nao retornou um payload valido para a correcao.')
  }

  return normalizeEssayEvaluation(extractJsonObject(rawText))
}

function buildEssayPrompt(input: {
  caseStudyText: string | null
  questionText: string
  expectedAnswer: string
  studentAnswer: string
}) {
  return `
Voce e um corretor pedagogico rigoroso de quiz.
Compare a resposta do aluno com o gabarito esperado e retorne apenas um objeto JSON valido.

Regras:
- aceite equivalencia semantica e variacoes de redacao quando preservarem o sentido principal
- marque is_correct como true apenas quando a resposta estiver substancialmente correta
- se estiver incompleta, ambigua ou errada, marque false
- feedback deve ser curto, claro, em portugues do Brasil e direcionado ao aluno
- responda apenas JSON puro no formato:
{
  "is_correct": true,
  "feedback": "string"
}

${input.caseStudyText ? `Contexto do estudo de caso:
${input.caseStudyText}

` : ''}Pergunta:
${input.questionText}

Gabarito esperado:
${input.expectedAnswer}

Resposta do aluno:
${input.studentAnswer}
  `.trim()
}

function extractJsonObject(value: string) {
  const trimmed = value.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]) {
    return extractJsonObject(fencedMatch[1])
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  throw new Error('A IA nao retornou um JSON valido para a correcao.')
}

function normalizeEssayEvaluation(rawJson: string) {
  const payload = JSON.parse(rawJson) as Record<string, unknown>
  const feedback = typeof payload.feedback === 'string'
    ? payload.feedback.trim()
    : ''

  return {
    is_correct: Boolean(payload.is_correct),
    feedback: feedback || 'Sua resposta foi analisada, mas nao foi possivel gerar um comentario detalhado.',
  }
}
