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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase env ausente na edge function.' }, 500)
    }

    if (!geminiApiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY nao configurada na edge function.' }, 500)
    }

    if (!accessToken) {
      return jsonResponse({ error: 'Token ausente.' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
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
    const standards = (standardsResult.data as CourseAiReviewStandardsRow | null) ?? null

    const prompt = buildPrompt({
      course: courseResult.data,
      module: moduleResult.data,
      lessons: lessonsResult.data ?? [],
      assessments: moduleAssessments,
      standards,
    })

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
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
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!geminiResponse.ok) {
      const geminiError = await geminiResponse.text()
      return jsonResponse({ error: `Falha ao consultar Gemini: ${geminiError}` }, 500)
    }

    const geminiPayload = await geminiResponse.json()
    const rawText = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rawText) {
      return jsonResponse({ error: 'Gemini nao retornou um payload valido.' }, 500)
    }

    const parsed = JSON.parse(rawText)
    return jsonResponse(parsed, 200)
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
Analise um modulo individual de curso e retorne apenas JSON valido.

Objetivo:
- validar se o modulo esta bem estruturado
- encontrar problemas de coerencia, sequencia, profundidade, avaliacao, referencias e tabelas HTML mal formatadas
- propor como o modulo deveria ficar
- devolver uma versao corrigida completa do modulo no formato exato de importacao

Regras obrigatorias:
- responda apenas JSON puro
- nao use markdown
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
