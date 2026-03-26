import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type QuestionType = 'single_choice' | 'essay_ai'

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
}

interface OptionRow {
  id: string
  question_id: string
  option_text: string
  position: number
  is_correct: boolean
}

interface SubmissionAnswerInput {
  question_id: string
  option_id?: string | null
  answer_text?: string | null
}

interface EssayEvaluation {
  question_id: string
  question_text: string
  answer_text: string
  is_correct: boolean
  feedback: string
}

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
    const accessToken = accessTokenFromHeader || accessTokenFromBody

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

    const [questionsResult, optionsResult] = await Promise.all([
      supabaseAdmin
        .from('assessment_questions')
        .select('id, assessment_id, question_text, question_type, position, is_required, points, essay_expected_answer')
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true }),
      supabaseAdmin
        .from('assessment_options')
        .select('id, question_id, option_text, position, is_correct, assessment_questions!inner(assessment_id)')
        .eq('assessment_questions.assessment_id', assessmentId)
        .order('position', { ascending: true }),
    ])

    if (questionsResult.error) {
      return jsonResponse({ error: questionsResult.error.message }, 400)
    }
    if (optionsResult.error) {
      return jsonResponse({ error: optionsResult.error.message }, 400)
    }

    const questions = ((questionsResult.data ?? []) as QuestionRow[])
    const options = ((optionsResult.data ?? []) as OptionRow[])
    if (questions.length === 0) {
      return jsonResponse({ error: 'Avaliacao sem questoes cadastradas.' }, 400)
    }

    const optionsByQuestion = new Map<string, OptionRow[]>()
    for (const option of options) {
      const current = optionsByQuestion.get(option.question_id) ?? []
      current.push(option)
      optionsByQuestion.set(option.question_id, current)
    }

    const essayQuestions = questions.filter((question) => question.question_type === 'essay_ai')
    if (essayQuestions.length > 0 && !openAiApiKey && !geminiApiKey) {
      return jsonResponse({ error: 'Nenhum provedor de IA configurado para corrigir questoes discursivas.' }, 500)
    }

    let objectiveQuestionCount = 0
    let correctAnswers = 0
    const answerRows: Array<{
      question_id: string
      selected_option_id: string | null
      answer_text: string | null
      is_correct: boolean
      ai_feedback: string | null
      ai_evaluation: Record<string, unknown> | null
    }> = []

    const essayInputs = essayQuestions
      .map((question) => {
        const answer = answerMap.get(question.id)
        const answerText = normalizeAnswerText(answer?.answer_text)

        if (!answerText && question.is_required) {
          throw new Error('Todas as questoes obrigatorias devem ser respondidas.')
        }

        return answerText
          ? {
            question,
            answerText,
          }
          : null
      })
      .filter((item): item is { question: QuestionRow; answerText: string } => Boolean(item))

    const essayEvaluations = await Promise.all(
      essayInputs.map(({ question, answerText }) => evaluateEssayAnswer({
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

    for (const question of questions) {
      const answer = answerMap.get(question.id)
      const answerText = normalizeAnswerText(answer?.answer_text)

      if (question.question_type === 'essay_ai') {
        const evaluation = essayEvaluationMap.get(question.id) ?? null

        if (!answerText && question.is_required) {
          return jsonResponse({ error: 'Todas as questoes obrigatorias devem ser respondidas.' }, 400)
        }

        answerRows.push({
          question_id: question.id,
          selected_option_id: null,
          answer_text: answerText,
          is_correct: evaluation?.is_correct ?? false,
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

      objectiveQuestionCount += 1
      const selectedOptionId = typeof answer?.option_id === 'string' && answer.option_id.trim()
        ? answer.option_id.trim()
        : null

      if (!selectedOptionId && question.is_required) {
        return jsonResponse({ error: 'Todas as questoes obrigatorias devem ser respondidas.' }, 400)
      }

      let isCorrect = false
      if (selectedOptionId) {
        const option = (optionsByQuestion.get(question.id) ?? []).find((item) => item.id === selectedOptionId)
        if (!option) {
          return jsonResponse({ error: 'Opcao invalida para uma das questoes.' }, 400)
        }
        isCorrect = option.is_correct
      }

      if (isCorrect) {
        correctAnswers += 1
      }

      answerRows.push({
        question_id: question.id,
        selected_option_id: selectedOptionId,
        answer_text: null,
        is_correct: isCorrect,
        ai_feedback: null,
        ai_evaluation: null,
      })
    }

    const essayOnlyAssessment = objectiveQuestionCount === 0 && essayQuestions.length > 0
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

    const scorePercent = objectiveQuestionCount > 0
      ? roundToTwo((correctAnswers * 100) / objectiveQuestionCount)
      : essayOnlyAssessment
        ? (essayApproved ? 100 : 0)
        : 0

    const isApproved = objectiveQuestionCount > 0
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
      correctAnswers,
      totalQuestions: objectiveQuestionCount,
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
      is_approved: isApproved,
      attempt_number: attemptNumber,
      max_attempts: effectiveMaxAttempts,
      remaining_attempts: Math.max(effectiveMaxAttempts - attemptNumber, 0),
      score_mode: essayOnlyAssessment ? 'essay_only' : 'objective_only',
      essay_feedbacks: essayEvaluations,
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

    if (!questionId) {
      throw new Error('Questao invalida.')
    }

    return {
      question_id: questionId,
      option_id: optionId,
      answer_text: answerText,
    }
  })
}

function normalizeAnswerText(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.replace(/\r/g, '').trim()
  return normalized.length > 0 ? normalized.slice(0, 5000) : null
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

async function insertAttemptWithRetry(input: {
  supabaseAdmin: ReturnType<typeof createClient>
  assessmentId: string
  userId: string
  attemptNumber: number
  scorePercent: number
  correctAnswers: number
  totalQuestions: number
  isApproved: boolean
  answerRows: Array<{
    question_id: string
    selected_option_id: string | null
    answer_text: string | null
    is_correct: boolean
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
    throw new Error('Gemini nao retornou um payload valido para a correção.')
  }

  return normalizeEssayEvaluation(extractJsonObject(rawText))
}

function buildEssayPrompt(input: {
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

Pergunta:
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

  throw new Error('A IA nao retornou um JSON valido para a correção.')
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
