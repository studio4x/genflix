import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AUDIO_BUCKET = 'lesson-audio'
const AUDIO_MODEL = 'gpt-4o-mini-tts'
const AUDIO_VOICE = 'coral'
const AUDIO_FORMAT = 'mp3'
const MAX_CHARS_PER_CHUNK = 2800
const SIGNED_URL_EXPIRES_IN = 60 * 60

interface LessonRow {
  id: string
  title: string
  description: string | null
  text_content: string | null
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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500)
    }

    if (!openAiApiKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY nao configurada na edge function.' }, 500)
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

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user },
      error: authError,
    } = await adminSupabase.auth.getUser(accessToken)

    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido ou usuario nao autenticado.' }, 401)
    }

    const { lessonId } = requestBody
    if (!lessonId || typeof lessonId !== 'string') {
      return jsonResponse({ error: 'lessonId e obrigatorio.' }, 400)
    }

    const lessonResult = await supabase
      .from('lessons')
      .select('id, title, description, text_content')
      .eq('id', lessonId)
      .maybeSingle()

    if (lessonResult.error) {
      return jsonResponse({ error: lessonResult.error.message }, 400)
    }

    const lesson = (lessonResult.data as LessonRow | null) ?? null
    if (!lesson) {
      return jsonResponse({ error: 'Aula nao encontrada ou indisponivel para este usuario.' }, 404)
    }

    const narrationText = buildNarrationText(lesson)
    if (!narrationText) {
      return jsonResponse({ error: 'A aula nao possui conteudo textual suficiente para narracao.' }, 400)
    }

    const chunks = splitNarrationText(narrationText, MAX_CHARS_PER_CHUNK)
    const contentHash = await sha256(`${AUDIO_MODEL}:${AUDIO_VOICE}:${narrationText}`)
    const folderPath = `${lesson.id}/${contentHash}`
    const expectedPaths = chunks.map((_, index) => buildPartPath(folderPath, index))

    const existingObjects = await listStoredParts(adminSupabase, folderPath)
    const existingPaths = existingObjects.map((item) => `${folderPath}/${item.name}`)
    const hasAllPartsCached = expectedPaths.every((path) => existingPaths.includes(path))

    if (!hasAllPartsCached) {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: AUDIO_MODEL,
            voice: AUDIO_VOICE,
            response_format: AUDIO_FORMAT,
            input: chunk,
            instructions: 'Narrei em portugues do Brasil com tom claro, didatico e profissional.',
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          return jsonResponse({ error: `Falha ao gerar audio no OpenAI: ${errorText}` }, 500)
        }

        const bytes = new Uint8Array(await response.arrayBuffer())
        const uploadResult = await adminSupabase.storage
          .from(AUDIO_BUCKET)
          .upload(buildPartPath(folderPath, index), bytes, {
            contentType: 'audio/mpeg',
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadResult.error) {
          return jsonResponse({ error: uploadResult.error.message }, 500)
        }
      }
    }

    const signedParts = await Promise.all(
      expectedPaths.map(async (path, index) => {
        const signedUrlResult = await adminSupabase.storage
          .from(AUDIO_BUCKET)
          .createSignedUrl(path, SIGNED_URL_EXPIRES_IN)

        if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
          throw new Error(signedUrlResult.error?.message ?? 'Falha ao gerar URL assinada do audio.')
        }

        return {
          index,
          path,
          url: signedUrlResult.data.signedUrl,
        }
      }),
    )

    return jsonResponse({
      lessonId: lesson.id,
      contentHash,
      model: AUDIO_MODEL,
      voice: AUDIO_VOICE,
      generatedNow: !hasAllPartsCached,
      parts: signedParts,
      expiresInSeconds: SIGNED_URL_EXPIRES_IN,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar audio da aula.'
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

function buildNarrationText(lesson: LessonRow) {
  const parts = [
    lesson.title.trim(),
    lesson.description?.trim() ?? '',
    htmlToPlainText(lesson.text_content ?? ''),
  ]
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return parts.join('\n\n')
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|blockquote|tr)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function splitNarrationText(text: string, maxChars: number) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean)

  const chunks: string[] = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      const sentenceChunks = splitLongParagraph(paragraph, maxChars)
      for (const sentenceChunk of sentenceChunks) {
        if (!currentChunk) {
          currentChunk = sentenceChunk
          continue
        }

        const candidate = `${currentChunk}\n\n${sentenceChunk}`
        if (candidate.length <= maxChars) {
          currentChunk = candidate
        } else {
          chunks.push(currentChunk)
          currentChunk = sentenceChunk
        }
      }
      continue
    }

    if (!currentChunk) {
      currentChunk = paragraph
      continue
    }

    const candidate = `${currentChunk}\n\n${paragraph}`
    if (candidate.length <= maxChars) {
      currentChunk = candidate
    } else {
      chunks.push(currentChunk)
      currentChunk = paragraph
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}

function splitLongParagraph(paragraph: string, maxChars: number) {
  const sentences = paragraph.match(/[^.!?]+[.!?]?/g) ?? [paragraph]
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    if (sentence.length > maxChars) {
      const wordChunks = splitLongSentence(sentence, maxChars)
      for (const wordChunk of wordChunks) {
        if (!current) {
          current = wordChunk
          continue
        }

        const candidate = `${current} ${wordChunk}`
        if (candidate.length <= maxChars) {
          current = candidate
        } else {
          chunks.push(current)
          current = wordChunk
        }
      }
      continue
    }

    if (!current) {
      current = sentence
      continue
    }

    const candidate = `${current} ${sentence}`
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      chunks.push(current)
      current = sentence
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function splitLongSentence(sentence: string, maxChars: number) {
  const words = sentence.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const word of words) {
    if (!current) {
      current = word
      continue
    }

    const candidate = `${current} ${word}`
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      chunks.push(current)
      current = word
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function buildPartPath(folderPath: string, index: number) {
  return `${folderPath}/part-${String(index + 1).padStart(3, '0')}.mp3`
}

async function listStoredParts(
  adminSupabase: ReturnType<typeof createClient>,
  folderPath: string,
) {
  const listResult = await adminSupabase.storage
    .from(AUDIO_BUCKET)
    .list(folderPath, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    })

  if (listResult.error) {
    throw new Error(listResult.error.message)
  }

  return (listResult.data ?? []).filter((item) => item.name.endsWith('.mp3'))
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
