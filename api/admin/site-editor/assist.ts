import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { blogAssistSchema, processBlogAssist } from '../../../src/features/admin/blog-ai/server.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

const assistSchema = z.object({
  pageKey: z.string().min(1),
  entryKey: z.string().min(1),
  entryType: z.enum(['text', 'rich_text', 'image', 'link', 'button', 'list', 'json']),
  action: z.enum(['rewrite', 'summarize', 'cta', 'audit']),
  content: z.string().min(1),
})

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return null
}

function getBearerToken(authHeader: string | null) {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

function parseBody(rawBody: unknown) {
  if (!rawBody) return null
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof rawBody === 'object') {
    return rawBody as Record<string, unknown>
  }
  return null
}

async function assertEditorCollaborator(req: ApiRequest, res: ApiResponse) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    jsonResponse(res, 500, { error: 'Configuracao ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.' })
    return null
  }

  const token = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization))
  if (!token) {
    jsonResponse(res, 401, { error: 'Token de acesso ausente.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const userResult = await adminClient.auth.getUser(token)
  if (userResult.error || !userResult.data.user) {
    jsonResponse(res, 401, { error: 'Token invalido ou expirado.' })
    return null
  }

  const rolesResult = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userResult.data.user.id)

  if (rolesResult.error) {
    jsonResponse(res, 500, { error: 'Nao foi possivel validar as permissoes do usuario.' })
    return null
  }

  const roles = ((rolesResult.data as Array<{ roles: { code: string } | { code: string }[] | null }> | null) ?? [])
    .flatMap((relation) => {
      if (!relation.roles) return []
      return Array.isArray(relation.roles) ? relation.roles : [relation.roles]
    })
    .map((role) => role.code)

  const canCollaborate = roles.includes('admin') || roles.includes('criador') || roles.includes('professor')
  if (!canCollaborate) {
    jsonResponse(res, 403, { error: 'Apenas colaboradores do editor visual podem usar a assistencia editorial.' })
    return null
  }

  return { adminClient, userId: userResult.data.user.id }
}

function stripMarkup(content: string) {
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSentences(content: string) {
  return stripMarkup(content)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function heuristicAssist(action: z.infer<typeof assistSchema>['action'], content: string) {
  const cleanContent = stripMarkup(content)
  const sentences = splitSentences(content)
  const warnings: string[] = []
  const notes: string[] = []

  if (cleanContent.length > 420) {
    warnings.push('O texto esta longo para leitura rapida e pode ser dividido em blocos menores.')
  }
  if (cleanContent.split(/\s+/).length > 80) {
    warnings.push('Ha densidade alta de palavras; considere reduzir redundancias.')
  }
  if (!/[.!?]/.test(cleanContent) && action !== 'cta') {
    warnings.push('O texto parece pouco pontuado e pode perder legibilidade.')
  }

  if (action === 'audit') {
    notes.push('Auditoria heuristica aplicada localmente.')
    return {
      content,
      warnings,
      notes: [
        ...notes,
        cleanContent.length <= 180 ? 'O tamanho esta bom para leitura escaneavel.' : 'Vale revisar o tamanho do bloco.',
      ],
      provider: 'heuristic' as const,
    }
  }

  if (action === 'summarize') {
    const summary = sentences.slice(0, 2).join(' ') || cleanContent.slice(0, 220)
    notes.push('Resumo compacto gerado localmente.')
    return {
      content: summary,
      warnings,
      notes,
      provider: 'heuristic' as const,
    }
  }

  if (action === 'cta') {
    const compact = cleanContent
      .replace(/^(clique|acesse|veja|conheca|conheça)\s+/i, '')
      .split(/[,.!?]/)[0]
      .trim()
    const cta = compact.length > 28 ? compact.slice(0, 28).trim() : compact
    notes.push('CTA fortalecido com heuristica local.')
    return {
      content: cta ? `Quero ${cta.charAt(0).toLowerCase()}${cta.slice(1)}` : 'Quero saber mais',
      warnings,
      notes,
      provider: 'heuristic' as const,
    }
  }

  const rewritten = sentences.length > 0
    ? sentences
        .map((sentence, index) => {
          const normalized = sentence.replace(/\s+/g, ' ').trim()
          if (index === 0) return normalized
          return normalized.charAt(0).toUpperCase() + normalized.slice(1)
        })
        .join(' ')
    : cleanContent

  notes.push('Reescrita editorial gerada localmente.')
  return {
    content: rewritten,
    warnings,
    notes,
    provider: 'heuristic' as const,
  }
}

async function openAiAssist(input: z.infer<typeof assistSchema>) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  const prompt = `
Voce e um assistente editorial da plataforma GenFlix.
Responda sempre em JSON valido no formato:
{"content":"...","notes":["..."],"warnings":["..."]}

Tarefa: ${input.action}
Tipo de campo: ${input.entryType}
Pagina: ${input.pageKey}
Chave: ${input.entryKey}

Regras:
- preserve o idioma portugues do Brasil;
- nao invente fatos;
- mantenha o sentido original;
- para CTA, devolva texto curto, direto e acionavel;
- para summarize, encurte drasticamente mantendo a mensagem principal;
- para audit, mantenha o conteudo original em "content" e foque em warnings/notes;
- warnings devem apontar contraste editorial, excesso de texto, clareza e consistencia quando fizer sentido.

Conteudo original:
"""${input.content}"""
`.trim()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Voce gera assistencia editorial estruturada para um CMS visual.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Falha ao consultar OpenAI (${response.status}).`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null
      }
    }>
  }

  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI nao retornou conteudo textual valido.')
  }

  const parsed = JSON.parse(content) as {
    content?: string
    notes?: string[]
    warnings?: string[]
  }

  return {
    content: parsed.content ?? input.content,
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    provider: 'openai' as const,
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const body = parseBody(req.body)
  const blogParsed = blogAssistSchema.safeParse(body)
  if (blogParsed.success) {
    const context = await assertEditorCollaborator(req, res)
    if (!context) {
      return
    }

    const result = await processBlogAssist(context.adminClient, blogParsed.data)
    jsonResponse(res, 200, result)
    return
  }

  const context = await assertEditorCollaborator(req, res)
  if (!context) {
    return
  }

  const parsedBody = assistSchema.safeParse(body)
  if (!parsedBody.success) {
    jsonResponse(res, 400, { error: parsedBody.error.issues[0]?.message ?? 'Payload invalido.' })
    return
  }

  try {
    const aiResult = await openAiAssist(parsedBody.data).catch(() => null)
    const result = aiResult ?? heuristicAssist(parsedBody.data.action, parsedBody.data.content)

    jsonResponse(res, 200, result)
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Nao foi possivel gerar a sugestao editorial.',
    })
  }
}
