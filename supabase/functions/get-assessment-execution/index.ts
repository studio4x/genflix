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
  | 'coloring'

interface AssessmentRow {
  id: string
  course_id: string
  module_id: string | null
  assessment_type: 'module' | 'final'
  title: string
  description: string | null
  passing_score: number
  max_attempts: number
  estimated_minutes: number
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
  case_study_id: string | null
  case_question_position: number | null
  created_at: string
  updated_at: string
}

interface OptionRow {
  id: string
  question_id: string
  option_text: string
  position: number
}

interface CaseStudyRow {
  id: string
  assessment_id: string
  title: string | null
  case_text: string
  position: number
  created_at: string
  updated_at: string
}

interface InteractionRow {
  question_id: string
  content: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

const ASSESSMENT_ASSETS_BUCKET = 'assessment-assets'

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

    const assessmentId = typeof requestBody?.assessment_id === 'string'
      ? requestBody.assessment_id.trim()
      : ''

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500)
    }

    if (!accessToken) {
      return jsonResponse({ error: 'Token ausente.' }, 401)
    }

    if (!assessmentId) {
      return jsonResponse({ error: 'assessment_id obrigatorio.' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido ou usuario nao autenticado.' }, 401)
    }

    const [{ data: isAdmin, error: adminRoleError }, { data: isStudent, error: studentRoleError }] = await Promise.all([
      supabaseAdmin.rpc('has_role', {
        _user_id: user.id,
        _role_code: 'admin',
      }),
      supabaseAdmin.rpc('has_role', {
        _user_id: user.id,
        _role_code: 'student',
      }),
    ])

    if (adminRoleError || studentRoleError) {
      return jsonResponse({ error: 'Falha ao validar permissao do usuario.' }, 500)
    }

    if (!isAdmin && !isStudent) {
      return jsonResponse({ error: 'Usuario sem permissao para acessar avaliacoes.' }, 403)
    }

    const assessmentResult = await supabaseAdmin
      .from('assessments')
      .select('id, course_id, module_id, assessment_type, title, description, passing_score, max_attempts, estimated_minutes, is_active')
      .eq('id', assessmentId)
      .maybeSingle()

    if (assessmentResult.error) {
      return jsonResponse({ error: assessmentResult.error.message }, 400)
    }

    const assessment = (assessmentResult.data as AssessmentRow | null) ?? null
    if (!assessment || (!isAdmin && !assessment.is_active)) {
      return jsonResponse({ error: 'Avaliacao nao encontrada ou inativa.' }, 404)
    }

    if (!isAdmin) {
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
    }

    const [questionsResult, optionsResult, caseStudiesResult, interactionsResult] = await Promise.all([
      supabaseAdmin
        .from('assessment_questions')
        .select('id, assessment_id, question_text, question_type, position, is_required, points, case_study_id, case_question_position, created_at, updated_at')
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true }),
      supabaseAdmin
        .from('assessment_options')
        .select('id, question_id, option_text, position, assessment_questions!inner(assessment_id)')
        .eq('assessment_questions.assessment_id', assessmentId)
        .order('position', { ascending: true }),
      supabaseAdmin
        .from('assessment_case_studies')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true }),
      supabaseAdmin
        .from('assessment_question_interactions')
        .select('*')
        .in('question_id', (
          ((await supabaseAdmin
            .from('assessment_questions')
            .select('id')
            .eq('assessment_id', assessmentId)).data ?? []) as Array<{ id: string }>
        ).map((question) => question.id)),
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

    if (interactionsResult.error) {
      return jsonResponse({ error: interactionsResult.error.message }, 400)
    }

    const questions = ((questionsResult.data ?? []) as QuestionRow[])
    const options = ((optionsResult.data ?? []) as OptionRow[])
    const caseStudies = ((caseStudiesResult.data ?? []) as CaseStudyRow[])
    const interactions = ((interactionsResult.data ?? []) as InteractionRow[])

    const optionsByQuestion = new Map<string, OptionRow[]>()
    for (const option of options) {
      const current = optionsByQuestion.get(option.question_id) ?? []
      current.push(option)
      optionsByQuestion.set(option.question_id, current)
    }

    const interactionsByQuestion = new Map<string, InteractionRow>()
    for (const interaction of interactions) {
      interactionsByQuestion.set(interaction.question_id, await withSignedAssetUrl(supabaseAdmin, interaction))
    }

    const standaloneQuestions = questions
      .filter((question) => !question.case_study_id)
      .map((question) => ({
        ...question,
        options: optionsByQuestion.get(question.id) ?? [],
        interaction: interactionsByQuestion.get(question.id) ?? null,
      }))

    const caseStudyPayload = caseStudies.map((caseStudy) => ({
      ...caseStudy,
      questions: questions
        .filter((question) => question.case_study_id === caseStudy.id)
        .sort((questionA, questionB) => (questionA.case_question_position ?? 0) - (questionB.case_question_position ?? 0))
        .map((question) => ({
          ...question,
          options: optionsByQuestion.get(question.id) ?? [],
          interaction: interactionsByQuestion.get(question.id) ?? null,
        })),
    }))

    return jsonResponse({
      assessment,
      questions: standaloneQuestions,
      caseStudies: caseStudyPayload,
    }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao carregar avaliacao.'
    return jsonResponse({ error: message }, 500)
  }
})

async function withSignedAssetUrl(
  supabaseAdmin: ReturnType<typeof createClient>,
  interaction: InteractionRow,
) {
  const content = structuredClone(interaction.content)

  if (content?.kind !== 'drag_drop_labeling' && content?.kind !== 'coloring') {
    return interaction
  }

  const asset = typeof content.asset === 'object' && content.asset !== null
    ? content.asset as Record<string, unknown>
    : null
  const storagePath = typeof asset?.storage_path === 'string' ? asset.storage_path.trim() : ''

  if (!storagePath) {
    return interaction
  }

  const signedUrlResult = await supabaseAdmin.storage
    .from(ASSESSMENT_ASSETS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (signedUrlResult.error) {
    console.error('Falha ao assinar asset da avaliacao:', signedUrlResult.error)
    return interaction
  }

  content.asset = {
    ...asset,
    signed_url: signedUrlResult.data.signedUrl,
  }

  return {
    ...interaction,
    content,
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
