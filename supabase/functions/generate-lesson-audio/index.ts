import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_PUBLIC_URL')?.trim() || 'https://genflix-omega.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AUDIO_BUCKET = 'lesson-audio'
const OPENAI_AUDIO_MODEL = 'gpt-4o-mini-tts'
const OPENAI_AUDIO_VOICE = 'coral'
const OPENAI_AUDIO_FORMAT = 'mp3'
const GEMINI_AUDIO_MODEL = 'gemini-2.5-flash-preview-tts'
const GEMINI_AUDIO_VOICE = 'Kore'
const MAX_CHARS_PER_CHUNK = 2800
const SIGNED_URL_EXPIRES_IN = 60 * 60
const NARRATION_CACHE_VERSION = 'v2'

interface LessonRow {
  id: string
  title: string
  description: string | null
  text_content: string | null
}

type NarrationMode = 'read' | 'generate' | 'regenerate'

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
    let openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
    let geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Variaveis do Supabase ausentes na edge function.' }, 500)
    }

    if (!openAiApiKey && !geminiApiKey) {
      return jsonResponse({ error: 'Nenhuma chave de TTS configurada na edge function.' }, 500)
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

    const credentialsResult = await adminSupabase
      .from('narration_ai_credentials')
      .select('openai_api_key, gemini_api_key')
      .eq('id', true)
      .maybeSingle()
    if (!credentialsResult.error && credentialsResult.data) {
      const dbOpenAiKey = typeof credentialsResult.data.openai_api_key === 'string'
        ? credentialsResult.data.openai_api_key.trim()
        : ''
      const dbGeminiKey = typeof credentialsResult.data.gemini_api_key === 'string'
        ? credentialsResult.data.gemini_api_key.trim()
        : ''
      if (dbOpenAiKey) {
        openAiApiKey = dbOpenAiKey
      }
      if (dbGeminiKey) {
        geminiApiKey = dbGeminiKey
      }
    }

    const {
      data: { user },
      error: authError,
    } = await adminSupabase.auth.getUser(accessToken)

    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido ou usuario n?o autenticado.' }, 401)
    }

    const { lessonId } = requestBody
    const mode = normalizeNarrationMode(requestBody?.mode)
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
      return jsonResponse({ error: 'Aula n?o encontrada ou indisponivel para este usuario.' }, 404)
    }

    const narrationText = buildNarrationText(lesson)
    if (!narrationText) {
      return jsonResponse({ error: 'A aula n?o possui conte?do textual suficiente para narracao.' }, 400)
    }

    const chunks = splitNarrationText(narrationText, MAX_CHARS_PER_CHUNK)
    const contentHash = await sha256(`${NARRATION_CACHE_VERSION}:${narrationText}`)
    const folderPath = `${lesson.id}/${contentHash}`

    const existingObjects = await listStoredParts(adminSupabase, folderPath)
    const cachedPaths = existingObjects
      .map((item) => `${folderPath}/${item.name}`)
      .sort((pathA, pathB) => pathA.localeCompare(pathB))
    const hasAllPartsCached = cachedPaths.length === chunks.length
    const generatedPaths: string[] = []
    let providerUsed = openAiApiKey ? 'openai' : 'gemini'

    if (mode === 'read' && !hasAllPartsCached) {
      return jsonResponse({ error: 'NARRATION_NOT_READY' }, 404)
    }

    const shouldGenerate = mode === 'regenerate' || !hasAllPartsCached
    if (shouldGenerate) {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        const audioResult = await generateAudioChunk({
          chunk,
          openAiApiKey,
          geminiApiKey,
        })
        providerUsed = audioResult.provider

        const objectPath = buildPartPath(folderPath, index, audioResult.extension)
        generatedPaths.push(objectPath)
        const uploadResult = await adminSupabase.storage
          .from(AUDIO_BUCKET)
          .upload(objectPath, audioResult.bytes, {
            contentType: audioResult.contentType,
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadResult.error) {
          return jsonResponse({ error: uploadResult.error.message }, 500)
        }
      }
    }

    const finalPaths = shouldGenerate ? generatedPaths : cachedPaths
    if (!shouldGenerate && finalPaths[0]?.toLowerCase().endsWith('.wav')) {
      providerUsed = 'gemini'
    }

    const signedParts = await Promise.all(
      finalPaths.map(async (path, index) => {
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
      model: providerUsed === 'openai' ? OPENAI_AUDIO_MODEL : GEMINI_AUDIO_MODEL,
      voice: providerUsed === 'openai' ? OPENAI_AUDIO_VOICE : GEMINI_AUDIO_VOICE,
      generatedNow: shouldGenerate,
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

function normalizeNarrationMode(value: unknown): NarrationMode {
  if (value === 'read' || value === 'regenerate') {
    return value
  }
  return 'generate'
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

function buildPartPath(folderPath: string, index: number, extension: 'mp3' | 'wav') {
  return `${folderPath}/part-${String(index + 1).padStart(3, '0')}.${extension}`
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

  return (listResult.data ?? []).filter((item) => item.name.endsWith('.mp3') || item.name.endsWith('.wav'))
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function generateAudioChunk(input: {
  chunk: string
  openAiApiKey: string
  geminiApiKey: string
}) {
  if (input.openAiApiKey) {
    const openAiResult = await generateOpenAiAudioChunk(input.chunk, input.openAiApiKey)

    if (openAiResult.ok) {
      return openAiResult.data
    }

    if (openAiResult.errorCode !== 'insufficient_quota' || !input.geminiApiKey) {
      throw new Error(`Falha ao gerar audio no OpenAI: ${openAiResult.errorText}`)
    }
  }

  if (!input.geminiApiKey) {
    throw new Error('Fallback Gemini indisponivel para narracao.')
  }

  return await generateGeminiAudioChunk(input.chunk, input.geminiApiKey)
}

async function generateOpenAiAudioChunk(chunk: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_AUDIO_MODEL,
      voice: OPENAI_AUDIO_VOICE,
      response_format: OPENAI_AUDIO_FORMAT,
      input: chunk,
      instructions: 'Narrei em portugues do Brasil com tom claro, didatico e profissional.',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorCode = ''

    try {
      const payload = JSON.parse(errorText)
      errorCode = payload?.error?.code ?? ''
    } catch {
      errorCode = ''
    }

    return {
      ok: false as const,
      errorCode,
      errorText,
    }
  }

  return {
    ok: true as const,
    data: {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: 'audio/mpeg',
      extension: 'mp3' as const,
      provider: 'openai' as const,
    },
  }
}

async function generateGeminiAudioChunk(chunk: string, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_AUDIO_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Fale em portugues do Brasil, com tom claro, didatico e profissional, narrando exatamente o texto abaixo:\n\n${chunk}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: GEMINI_AUDIO_VOICE,
            },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Falha ao gerar audio no Gemini: ${errorText}`)
  }

  const payload = await response.json()
  const inlineData = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData
  const base64Audio = inlineData?.data
  const mimeType = inlineData?.mimeType as string | undefined

  if (!base64Audio || typeof base64Audio !== 'string') {
    throw new Error('Gemini n?o retornou audio valido para a narracao.')
  }

  const decodedBytes = Uint8Array.from(atob(base64Audio), (char) => char.charCodeAt(0))
  const normalizedMimeType = (mimeType ?? '').toLowerCase()

  if (normalizedMimeType.startsWith('audio/l16')) {
    const sampleRate = extractSampleRateFromL16MimeType(normalizedMimeType) ?? 24000
    const wavBytes = pcm16MonoToWav(decodedBytes, sampleRate)
    return {
      bytes: wavBytes,
      contentType: 'audio/wav',
      extension: 'wav' as const,
      provider: 'gemini' as const,
    }
  }

  if (normalizedMimeType.includes('audio/wav') || normalizedMimeType.includes('audio/wave')) {
    return {
      bytes: decodedBytes,
      contentType: 'audio/wav',
      extension: 'wav' as const,
      provider: 'gemini' as const,
    }
  }

  if (normalizedMimeType.includes('audio/mpeg') || normalizedMimeType.includes('audio/mp3')) {
    return {
      bytes: decodedBytes,
      contentType: 'audio/mpeg',
      extension: 'mp3' as const,
      provider: 'gemini' as const,
    }
  }

  return {
    bytes: decodedBytes,
    contentType: 'audio/wav',
    extension: 'wav' as const,
    provider: 'gemini' as const,
  }
}

function extractSampleRateFromL16MimeType(mimeType: string) {
  const match = mimeType.match(/rate=(\d+)/i)
  if (!match?.[1]) {
    return null
  }

  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function pcm16MonoToWav(pcmBytes: Uint8Array, sampleRate: number) {
  const wavHeaderSize = 44
  const totalSize = wavHeaderSize + pcmBytes.byteLength
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // RIFF header
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeAscii(view, 8, 'WAVE')

  // fmt chunk
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // audio format PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate: sampleRate * channels * bytesPerSample
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample

  // data chunk
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcmBytes.byteLength, true)
  bytes.set(pcmBytes, wavHeaderSize)

  return bytes
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
