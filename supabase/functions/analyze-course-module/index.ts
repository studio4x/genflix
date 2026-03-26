import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Nullable<T> = T | null

interface CourseAiReviewStandardsRow {
  course_id: string
  ideal_course_structure: Nullable<string>
  required_elements: Nullable<string>
  bibliography_rules: Nullable<string>
  table_formatting_rules: Nullable<string>
  additional_review_rules: Nullable<string>
}

type AiProvider = 'openai' | 'gemini'
type TokenCountMethod = 'actual' | 'estimated'

interface AnalysisUsageMetrics {
  ai_provider: AiProvider
  ai_model: string
  token_count_method: TokenCountMethod
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

interface AnalysisGenerationResult {
  text: string
  usage: AnalysisUsageMetrics
}

const OPENAI_ANALYSIS_MODEL = 'gpt-4o-mini'
const GEMINI_ANALYSIS_MODEL = 'gemini-2.5-flash'

const MODEL_PRICING_USD_PER_1M: Record<AiProvider, Record<string, { input: number; output: number }>> = {
  openai: {
    [OPENAI_ANALYSIS_MODEL]: {
      input: 0.15,
      output: 0.6,
    },
  },
  gemini: {
    [GEMINI_ANALYSIS_MODEL]: {
      input: 0.3,
      output: 2.5,
    },
  },
}

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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase env ausente na edge function.' }, 500)
    }

    if (!openAiApiKey && !geminiApiKey) {
      return jsonResponse({ error: 'Nenhum provedor de IA configurado na edge function.' }, 500)
    }

    if (!accessToken) {
      return jsonResponse({ error: 'Token ausente.' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido ou usuario nao autenticado.' }, 401)
    }

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role_code: 'admin',
    })

    if (roleError || !isAdmin) {
      return jsonResponse({ error: 'Apenas administradores podem usar esta analise.' }, 403)
    }

    const { courseId, moduleId } = requestBody
    if (!courseId || !moduleId) {
      return jsonResponse({ error: 'courseId e moduleId sao obrigatorios.' }, 400)
    }

    const [courseResult, moduleResult, lessonsResult, assessmentsResult, standardsResult] = await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).single(),
      supabase.from('course_modules').select('*').eq('id', moduleId).eq('course_id', courseId).single(),
      supabase.from('lessons').select('*').eq('module_id', moduleId).order('position', { ascending: true }),
      supabase.from('assessments').select('*').eq('module_id', moduleId).order('created_at', { ascending: true }),
      supabase.from('course_ai_review_standards').select('*').eq('course_id', courseId).maybeSingle(),
    ])

    if (courseResult.error) return jsonResponse({ error: courseResult.error.message }, 400)
    if (moduleResult.error) return jsonResponse({ error: moduleResult.error.message }, 400)
    if (lessonsResult.error) return jsonResponse({ error: lessonsResult.error.message }, 400)
    if (assessmentsResult.error) return jsonResponse({ error: assessmentsResult.error.message }, 400)
    if (standardsResult.error) return jsonResponse({ error: standardsResult.error.message }, 400)

    const moduleAssessments = (assessmentsResult.data ?? []).filter((assessment) => assessment.assessment_type === 'module')
    const moduleAssessmentIds = moduleAssessments.map((assessment) => assessment.id)
    const quizWithQuestions = await buildAssessmentsWithQuestions(supabase, moduleAssessmentIds, moduleAssessments)
    const standards = (standardsResult.data as CourseAiReviewStandardsRow | null) ?? null

    const prompt = buildPrompt({
      course: courseResult.data,
      module: moduleResult.data,
      lessons: lessonsResult.data ?? [],
      assessments: quizWithQuestions,
      standards,
    })

    const analysis = await generateAnalysisJson(prompt, {
      openAiApiKey,
      geminiApiKey,
    })
    const parsed = JSON.parse(extractJsonObject(analysis.text))
    return jsonResponse({
      ...parsed,
      ...analysis.usage,
    }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao analisar modulo com IA.'
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

function buildPrompt(input: {
  course: Record<string, unknown>
  module: Record<string, unknown>
  lessons: Record<string, unknown>[]
  assessments: Record<string, unknown>[]
  standards: CourseAiReviewStandardsRow | null
}) {
  return `
Voce e um revisor pedagogico e instrucional especializado em cursos corporativos da area de saude/home care.
Analise um modulo individual de curso e retorne um unico objeto JSON valido.

Objetivo:
- validar se o modulo esta bem estruturado
- encontrar problemas de coerencia, sequencia, profundidade, avaliacao, referencias e tabelas HTML mal formatadas
- propor como o modulo deveria ficar
- devolver uma versao corrigida completa do modulo no formato exato de importacao

Regras obrigatorias:
- responda apenas JSON puro
- nao use markdown
- o retorno deve ser exatamente um objeto JSON no nivel raiz, nunca array
- mantenha o titulo do modulo
- preserve videos validos quando fizer sentido
- se detectar aula sem referencia bibliografica quando as regras exigirem, aponte isso explicitamente
- se detectar tabela mal formatada, coluna vazia ou HTML inconsistente, aponte isso explicitamente
- a propriedade corrected_module deve seguir exatamente este formato:
{
  "title": "string",
  "description": "string",
  "lessons": [
    {
      "title": "string",
      "description": "string",
      "lesson_type": "video|text|hybrid",
      "youtube_url": "string opcional",
      "text_content": "html string opcional",
      "estimated_minutes": 0
    }
  ],
  "assessments": [
    {
      "title": "string",
      "description": "string",
      "assessment_type": "module",
      "passing_score": 70,
      "questions": [
        {
          "question_text": "string",
          "points": 1,
          "options": [
            { "option_text": "string", "is_correct": false }
          ]
        }
      ]
    }
  ]
}

Estrutura esperada da resposta:
{
  "summary": "string",
  "quality_score": 0,
  "ready_to_publish": false,
  "issues": [
    {
      "id": "issue-1",
      "severity": "critical|high|medium|low",
      "category": "structure|lesson|assessment|bibliography|table|formatting|consistency",
      "location": "string",
      "title": "string",
      "current_state": "string",
      "recommended_fix": "string",
      "suggested_result": "string"
    }
  ],
  "corrected_module": { ... }
}

Padroes definidos pelo admin para este curso:
${JSON.stringify({
    ideal_course_structure: input.standards?.ideal_course_structure ?? '',
    required_elements: input.standards?.required_elements ?? '',
    bibliography_rules: input.standards?.bibliography_rules ?? '',
    table_formatting_rules: input.standards?.table_formatting_rules ?? '',
    additional_review_rules: input.standards?.additional_review_rules ?? '',
  }, null, 2)}

Curso:
${JSON.stringify(input.course, null, 2)}

Modulo:
${JSON.stringify(input.module, null, 2)}

Aulas do modulo:
${JSON.stringify(input.lessons, null, 2)}

Quiz do modulo:
${JSON.stringify(input.assessments, null, 2)}
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

  throw new Error('Gemini retornou texto sem um objeto JSON valido.')
}

async function generateAnalysisJson(
  prompt: string,
  providers: {
    openAiApiKey: string
    geminiApiKey: string
  },
): Promise<AnalysisGenerationResult> {
  if (providers.openAiApiKey) {
    const openAiResult = await generateWithOpenAi(prompt, providers.openAiApiKey)

    if (openAiResult.ok) {
      return openAiResult
    }
  }

  if (providers.geminiApiKey) {
    return await generateWithGemini(prompt, providers.geminiApiKey)
  }

  throw new Error('Nenhum provedor de IA disponivel para a analise.')
}

async function generateWithOpenAi(prompt: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_ANALYSIS_MODEL,
      temperature: 0.2,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    return {
      ok: false as const,
      errorText: await response.text(),
    }
  }

  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content

  if (!text || typeof text !== 'string') {
    return {
      ok: false as const,
      errorText: 'OpenAI nao retornou conteudo textual valido.',
    }
  }

  return {
    ok: true as const,
    text,
    usage: buildUsageMetrics({
      provider: 'openai',
      model: OPENAI_ANALYSIS_MODEL,
      prompt,
      outputText: text,
      inputTokens: payload?.usage?.prompt_tokens,
      outputTokens: payload?.usage?.completion_tokens,
      totalTokens: payload?.usage?.total_tokens,
    }),
  }
}

async function generateWithGemini(prompt: string, apiKey: string) {
  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ANALYSIS_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  })

  if (!geminiResponse.ok) {
    const geminiError = await geminiResponse.text()
    throw new Error(`Falha ao consultar Gemini: ${geminiError}`)
  }

  const geminiPayload = await geminiResponse.json()
  const rawText = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Gemini nao retornou um payload valido.')
  }

  return {
    text: rawText,
    usage: buildUsageMetrics({
      provider: 'gemini',
      model: GEMINI_ANALYSIS_MODEL,
      prompt,
      outputText: rawText,
      inputTokens: geminiPayload?.usageMetadata?.promptTokenCount,
      outputTokens: geminiPayload?.usageMetadata?.candidatesTokenCount,
      totalTokens: geminiPayload?.usageMetadata?.totalTokenCount,
    }),
  }
}

function buildUsageMetrics(input: {
  provider: AiProvider
  model: string
  prompt: string
  outputText: string
  inputTokens: unknown
  outputTokens: unknown
  totalTokens: unknown
}): AnalysisUsageMetrics {
  const hasActualCounts = isFiniteNonNegative(input.inputTokens)
    && isFiniteNonNegative(input.outputTokens)
    && isFiniteNonNegative(input.totalTokens)

  const inputTokens = hasActualCounts ? input.inputTokens : estimateTokens(input.prompt)
  const outputTokens = hasActualCounts ? input.outputTokens : estimateTokens(input.outputText)
  const totalTokens = hasActualCounts ? input.totalTokens : inputTokens + outputTokens
  const estimatedCostUsd = calculateEstimatedCostUsd({
    provider: input.provider,
    model: input.model,
    inputTokens,
    outputTokens,
  })

  return {
    ai_provider: input.provider,
    ai_model: input.model,
    token_count_method: hasActualCounts ? 'actual' : 'estimated',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: estimatedCostUsd,
  }
}

function calculateEstimatedCostUsd(input: {
  provider: AiProvider
  model: string
  inputTokens: number
  outputTokens: number
}) {
  const pricing = MODEL_PRICING_USD_PER_1M[input.provider]?.[input.model]
  if (!pricing) {
    return 0
  }

  const inputCost = (input.inputTokens / 1_000_000) * pricing.input
  const outputCost = (input.outputTokens / 1_000_000) * pricing.output

  return Number((inputCost + outputCost).toFixed(6))
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

async function buildAssessmentsWithQuestions(
  supabase: ReturnType<typeof createClient>,
  assessmentIds: string[],
  assessments: Record<string, unknown>[],
) {
  if (assessmentIds.length === 0) {
    return assessments
  }

  const questionsResult = await supabase
    .from('assessment_questions')
    .select('*')
    .in('assessment_id', assessmentIds)
    .order('position', { ascending: true })

  if (questionsResult.error) {
    throw new Error(questionsResult.error.message)
  }

  const questions = (questionsResult.data ?? []) as Record<string, unknown>[]
  const questionIds = questions
    .map((question) => question.id)
    .filter((id): id is string => typeof id === 'string')

  const optionsResult = questionIds.length > 0
    ? await supabase
      .from('assessment_options')
      .select('*')
      .in('question_id', questionIds)
      .order('position', { ascending: true })
    : { data: [], error: null }

  if (optionsResult.error) {
    throw new Error(optionsResult.error.message)
  }

  const options = (optionsResult.data ?? []) as Record<string, unknown>[]
  const optionsByQuestion = new Map<string, Record<string, unknown>[]>()
  for (const option of options) {
    const questionId = option.question_id
    if (typeof questionId !== 'string') continue
    const current = optionsByQuestion.get(questionId) ?? []
    current.push(option)
    optionsByQuestion.set(questionId, current)
  }

  const questionsByAssessment = new Map<string, Record<string, unknown>[]>()
  for (const question of questions) {
    const assessmentId = question.assessment_id
    const questionId = question.id
    if (typeof assessmentId !== 'string' || typeof questionId !== 'string') continue

    const current = questionsByAssessment.get(assessmentId) ?? []
    current.push({
      ...question,
      options: optionsByQuestion.get(questionId) ?? [],
    })
    questionsByAssessment.set(assessmentId, current)
  }

  return assessments.map((assessment) => {
    const assessmentId = assessment.id
    if (typeof assessmentId !== 'string') {
      return assessment
    }

    return {
      ...assessment,
      questions: questionsByAssessment.get(assessmentId) ?? [],
    }
  })
}
