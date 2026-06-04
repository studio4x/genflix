import { z } from 'zod';
import { getPublicAppUrl } from '../../../../api/_shared/app-url.js';
type AssistantProvider = 'openai' | 'gemini' | 'heuristic';
type BlogAssistAction = 'suggest_tags' | 'create_tags' | "generate_se??o";
export const blogAssistSchema = z.object({
    action: z.enum(['suggest_tags', 'create_tags', "generate_se??o"]),
    article: z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        contentHtml: z.string().optional().default(''),
        seoDescription: z.string().optional().default(''),
        focusKeyword: z.string().optional().default(''),
        coverImageUrl: z.string().optional().default(''),
        currentTagIds: z.array(z.string()).optional().default([]),
        availableTags: z.array(z.object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
        })).optional().default([]),
    }),
});
type BlogAssistInput = z.infer<typeof blogAssistSchema>;
type BlogAssistBaseResponse = {
    provider: AssistantProvider;
    model: string | null;
    notes: string[];
    warnings: string[];
};
type BlogAssistSuggestTagsResponse = BlogAssistBaseResponse & {
    action: 'suggest_tags';
    selectedTagIds: string[];
};
type BlogAssistCreateTagsResponse = BlogAssistBaseResponse & {
    action: 'create_tags';
    selectedTagIds: string[];
    suggestedTags: Array<{
        name: string;
        slug: string;
        description: string | null;
    }>;
};
type BlogAssistSeoResponse = BlogAssistBaseResponse & {
    action: "generate_se??o";
    seo: {
        seo_title: string;
        seo_description: string;
        seo_canonical_url: string;
        seo_robots: string;
        seo_og_title: string;
        seo_og_description: string;
        seo_og_image_url: string;
        focus_keyword: string;
    };
};
type NarrationCredentialsRow = {
    openai_api_key: string | null;
    gemini_api_key: string | null;
};
function isLikelyOpenAiApiKey(value: string) {
    return /^sk-(proj-|pro-)?[A-Za-z0-9_-]{12,}$/i.test(value);
}
function isLikelyGeminiApiKey(value: string) {
    return /^AIza[0-9A-Za-z_-]{20,}$/i.test(value);
}
function resolveConfiguredApiKey(envKey: string, dbKey: string, provider: 'openai' | 'gemini') {
    const normalizedEnvKey = envKey.trim();
    const normalizedDbKey = dbKey.trim();
    const looksLikeValidKey = provider === 'openai' ? isLikelyOpenAiApiKey : isLikelyGeminiApiKey;
    if (looksLikeValidKey(normalizedEnvKey)) {
        return normalizedEnvKey;
    }
    if (looksLikeValidKey(normalizedDbKey)) {
        return normalizedDbKey;
    }
    if (normalizedEnvKey) {
        return normalizedEnvKey;
    }
    return normalizedDbKey;
}
function readOptionalString(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
function stripHtml(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function slugify(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
function truncate(value: string, maxLength: number) {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) {
        return trimmed;
    }
    return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
function splitKeywords(text: string) {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length >= 4);
}
function createStopWords() {
    return new Set([
        'para', 'como', 'com', 'sem', 'uma', 'das', 'dos', 'que', 'sobre', 'pela', 'pelo', 'mais', 'este', 'essa',
        "est?",
        'isso', 'isso', 'sua', 'seu', 'nos', 'nas', 'nosso', 'nossa',
        "tamb?m",
        'ainda', 'quando', 'onde',
        'entre', 'depois', 'antes', 'cada', 'todo', 'toda', 'todos', 'todas', 'porque', 'pois', 'apenas', 'aqui',
    ]);
}
function buildCorpus(input: BlogAssistInput) {
    return `${input.article.title} ${input.article.focusKeyword} ${input.article.seoDescription} ${stripHtml(input.article.contentHtml)}`.trim();
}
function buildHeuristicTagSelection(input: BlogAssistInput) {
    const corpus = buildCorpus(input).toLowerCase();
    const selectedTagIds = input.article.availableTags
        .filter((tag) => {
        const normalizedName = slugify(tag.name);
        const normalizedSlug = slugify(tag.slug);
        return (corpus.includes(tag.name.toLowerCase()) ||
            corpus.includes(tag.slug.toLowerCase()) ||
            corpus.includes(normalizedName) ||
            corpus.includes(normalizedSlug));
    })
        .map((tag) => tag.id);
    return {
        selectedTagIds: Array.from(new Set(selectedTagIds)).slice(0, 10),
        notes: ['Sugestão heurística aplicada localmente.'],
        warnings: ['Sem IA configurada ou resposta indisponível.'],
    };
}
function buildHeuristicNewTags(input: BlogAssistInput) {
    const corpus = buildCorpus(input);
    const existingSlugs = new Set(input.article.availableTags.map((tag) => slugify(tag.slug)));
    const tokens = splitKeywords(corpus);
    const stopWords = createStopWords();
    const unique: string[] = [];
    for (const token of tokens) {
        if (stopWords.has(token)) {
            continue;
        }
        const normalizedSlug = slugify(token);
        if (!normalizedSlug || existingSlugs.has(normalizedSlug)) {
            continue;
        }
        if (!unique.includes(token)) {
            unique.push(token);
        }
        if (unique.length >= 5) {
            break;
        }
    }
    return {
        selectedTagIds: buildHeuristicTagSelection(input).selectedTagIds,
        suggestedTags: unique.map((token) => ({
            name: token.charAt(0).toUpperCase() + token.slice(1),
            slug: slugify(token),
            description: `Tag gerada a partir do conteúdo do artigo sobre ${token}.`,
        })),
        notes: ['Sugestão heurística aplicada localmente.'],
        warnings: ['Sem IA configurada ou resposta indisponível.'],
    };
}
function buildHeuristicSeoDraft(input: BlogAssistInput) {
    const cleanContent = stripHtml(input.article.contentHtml);
    const focusTokens = splitKeywords(`${input.article.focusKeyword} ${input.article.title}`);
    const focusKeyword = input.article.focusKeyword.trim() || focusTokens.slice(0, 2).join(' ');
    const titleBase = input.article.title.trim();
    const seoTitleSource = focusKeyword
        ? `${focusKeyword} - ${titleBase}`
        : titleBase;
    const seoTitle = truncate(seoTitleSource, 60);
    const descriptionBase = input.article.seoDescription.trim()
        || truncate(cleanContent || titleBase, 155);
    const canonicalBase = getPublicAppUrl();
    const canonicalUrl = new URL(`/blog/${input.article.slug.trim()}`, canonicalBase).toString();
    return {
        seo: {
            seo_title: seoTitle,
            seo_description: truncate(descriptionBase, 160),
            seo_canonical_url: canonicalUrl,
            seo_robots: 'index,follow',
            seo_og_title: seoTitle,
            seo_og_description: truncate(descriptionBase, 160),
            seo_og_image_url: input.article.coverImageUrl.trim(),
            focus_keyword: focusKeyword,
        },
        notes: ['Sugestão heurística de SEO aplicada localmente.'],
        warnings: [],
    };
}
async function loadNarrationCredentials(adminClient: any) {
    const credentialsResult = await adminClient
        .from('narration_ai_credentials')
        .select('openai_api_key, gemini_api_key')
        .eq('id', true)
        .maybeSingle();
    const row = (credentialsResult.data ?? null) as NarrationCredentialsRow | null;
    return {
        openAiApiKey: resolveConfiguredApiKey(readOptionalString(process.env.OPENAI_API_KEY) ?? '', readOptionalString(row?.openai_api_key) ?? '', 'openai'),
        geminiApiKey: resolveConfiguredApiKey(readOptionalString(process.env.GEMINI_API_KEY) ?? '', readOptionalString(row?.gemini_api_key) ?? '', 'gemini'),
    };
}
function buildAiPrompt(input: BlogAssistInput, action: BlogAssistAction) {
    const article = input.article;
    const cleanContent = stripHtml(article.contentHtml);
    const availableTags = article.availableTags.slice(0, 120);
    const currentTagIds = article.currentTagIds;
    if (action === 'suggest_tags') {
        return `
Voc\u00EA \u00E9 um assistente editorial da GenFlix especializado em categoriza\u00E7\u00E3o de artigos.
An?lise o artigo e retorne apenas JSON puro no formato:
{"selectedTagIds":["id1","id2"],"notes":["..."],"warnings":["..."]}

Regras:
- selecione apenas tags existentes em availableTags;
- prefira tags realmente aderentes ao conte\u00FAdo;
- n\u00E3o selecione tags j\u00E1 presentes em currentTagIds;
- no maximo 8 tags;
- responda somente JSON v?lido.

Conte\u00FAdo do artigo:
Título: ${article.title}
Slug: ${article.slug}
Palavra-chave foco: ${article.focusKeyword}
Descrição SEO atual: ${article.seoDescription}
Tags atuais (ids): ${JSON.stringify(currentTagIds)}
Tags disponiveis:
${JSON.stringify(availableTags, null, 2)}

Texto limpo:
${cleanContent}
`.trim();
    }
    if (action === 'create_tags') {
        return `
Voc\u00EA \u00E9 um assistente editorial da GenFlix especializado em sugerir tags novas para artigos.
An?lise o artigo e retorne apenas JSON puro no formato:
{"selectedTagIds":["id1","id2"],"suggestedTags":[{"name":"...","slug":"...","description":"..."}],"notes":["..."],"warnings":["..."]}

Regras:
- selecione tags existentes quando fizer sentido;
- gere no maximo 5 novas tags;
- n\u00E3o repita tags j\u00E1 existentes;
- crie slugs curtos, sem acentos e sem caracteres especiais;
- responda somente JSON v?lido.

Conte\u00FAdo do artigo:
Título: ${article.title}
Slug: ${article.slug}
Palavra-chave foco: ${article.focusKeyword}
Descrição SEO atual: ${article.seoDescription}
Tags atuais (ids): ${JSON.stringify(currentTagIds)}
Tags disponiveis:
${JSON.stringify(availableTags, null, 2)}

Texto limpo:
${cleanContent}
`.trim();
    }
    return `
Voc\u00EA \u00E9 um assistente editorial da GenFlix especializado em SEO para artigos.
An?lise o artigo e retorne apenas JSON puro no formato:
{"se??o":{"se??o_title":"...","se??o_description":"...","se??o_canonical_url":"...","se??o_robots":"index,follow","se??o_og_title":"...","se??o_og_description":"...","se??o_og_image_url":"...","focus_keyword":"..."},"notes":["..."],"warnings":["..."]}

Regras:
- gere t\u00EDtulo SEO entre 50 e 60 caracteres quando poss\u00EDvel;
- gere meta description entre 140 e 160 caracteres;
- use o conte\u00FAdo do artigo como contexto principal;
- canonical deve ser uma URL absoluta do artigo;
- og title e og description devem ser coerentes com o SEO principal;
- responda somente JSON v?lido.

Conte\u00FAdo do artigo:
Título: ${article.title}
Slug: ${article.slug}
Palavra-chave foco atual: ${article.focusKeyword}
Descrição SEO atual: ${article.seoDescription}
Capa atual: ${article.coverImageUrl}

Texto limpo:
${cleanContent}
`.trim();
}
async function callOpenAi(prompt: string, credentials: {
    openAiApiKey: string | null;
}) {
    if (!credentials.openAiApiKey) {
        return null;
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.openAiApiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'Você gera assistência editorial estruturada para o blog da plataforma GenFlix.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });
    if (!response.ok) {
        throw new Error(`Falha ao consultar OpenAI (${response.status}).`);
    }
    const payload = (await response.json()) as {
        choices?: Array<{
            message?: {
                content?: string | null;
            };
        }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('OpenAI não retornou conteúdo textual válido.');
    }
    return content;
}
async function callGemini(prompt: string, credentials: {
    geminiApiKey: string | null;
}) {
    if (!credentials.geminiApiKey) {
        return null;
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${credentials.geminiApiKey}`, {
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
                temperature: 0.3,
                responseMimeType: 'application/json',
            },
        }),
    });
    if (!response.ok) {
        throw new Error(`Falha ao consultar Gemini (${response.status}).`);
    }
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Gemini não retornou conteúdo textual válido.');
    }
    return text;
}
function extractJsonObject(raw: string) {
    const text = raw.trim();
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        return text;
    }
    return text.slice(startIndex, endIndex + 1);
}
function parseAssistantJson<T>(raw: string) {
    return JSON.parse(extractJsonObject(raw)) as T;
}
async function runBlogAssistWithAi(input: BlogAssistInput, credentials: {
    openAiApiKey: string | null;
    geminiApiKey: string | null;
}) {
    const prompt = buildAiPrompt(input, input.action);
    if (credentials.openAiApiKey) {
        const openAiText = await callOpenAi(prompt, credentials).catch(() => null);
        if (openAiText) {
            return {
                provider: 'openai' as const,
                model: 'gpt-4o-mini',
                text: openAiText,
            };
        }
    }
    if (credentials.geminiApiKey) {
        const geminiText = await callGemini(prompt, credentials).catch(() => null);
        if (geminiText) {
            return {
                provider: 'gemini' as const,
                model: 'gemini-2.5-flash',
                text: geminiText,
            };
        }
    }
    return null;
}
function normalizeTagSuggestions(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const row = item as {
            name?: unknown;
            slug?: unknown;
            description?: unknown;
        };
        const name = readOptionalString(row.name);
        const slug = readOptionalString(row.slug);
        if (!name || !slug) {
            return null;
        }
        return {
            name,
            slug,
            description: readOptionalString(row.description),
        };
    })
        .filter((entry): entry is {
        name: string;
        slug: string;
        description: string | null;
    } => Boolean(entry));
}
function normalizeSeoDraft(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const row = value as Record<string, unknown>;
    const seo_title = readOptionalString(row.seo_title) ?? '';
    const seo_description = readOptionalString(row.seo_description) ?? '';
    const seo_canonical_url = readOptionalString(row.seo_canonical_url) ?? '';
    const seo_robots = readOptionalString(row.seo_robots) ?? 'index,follow';
    const seo_og_title = readOptionalString(row.seo_og_title) ?? '';
    const seo_og_description = readOptionalString(row.seo_og_description) ?? '';
    const seo_og_image_url = readOptionalString(row.seo_og_image_url) ?? '';
    const focus_keyword = readOptionalString(row.focus_keyword) ?? '';
    return {
        seo_title,
        seo_description,
        seo_canonical_url,
        seo_robots,
        seo_og_title,
        seo_og_description,
        seo_og_image_url,
        focus_keyword,
    };
}
function normalizeSelectedTagIds(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => readOptionalString(item))
        .filter((entry): entry is string => Boolean(entry));
}
function normalizeAiResponse(action: BlogAssistAction, payload: unknown, provider: AssistantProvider, model: string | null): BlogAssistSuggestTagsResponse | BlogAssistCreateTagsResponse | BlogAssistSeoResponse {
    const parsed = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
    const notes = Array.isArray(parsed.notes)
        ? parsed.notes.map((item) => readOptionalString(item)).filter((item): item is string => Boolean(item))
        : [];
    const warnings = Array.isArray(parsed.warnings)
        ? parsed.warnings.map((item) => readOptionalString(item)).filter((item): item is string => Boolean(item))
        : [];
    if (action === 'suggest_tags') {
        return {
            action,
            provider,
            model,
            notes,
            warnings,
            selectedTagIds: normalizeSelectedTagIds(parsed.selectedTagIds),
        };
    }
    if (action === 'create_tags') {
        return {
            action,
            provider,
            model,
            notes,
            warnings,
            selectedTagIds: normalizeSelectedTagIds(parsed.selectedTagIds),
            suggestedTags: normalizeTagSuggestions(parsed.suggestedTags),
        };
    }
    const seo = normalizeSeoDraft(parsed.seo) ?? {
        seo_title: '',
        seo_description: '',
        seo_canonical_url: '',
        seo_robots: 'index,follow',
        seo_og_title: '',
        seo_og_description: '',
        seo_og_image_url: '',
        focus_keyword: '',
    };
    return {
        action,
        provider,
        model,
        notes,
        warnings,
        seo,
    };
}
function buildDefaultSuggestions(input: BlogAssistInput): BlogAssistSuggestTagsResponse | BlogAssistCreateTagsResponse | BlogAssistSeoResponse {
    if (input.action === 'suggest_tags') {
        const heuristic = buildHeuristicTagSelection(input);
        return {
            action: 'suggest_tags',
            provider: 'heuristic',
            model: null,
            ...heuristic,
        };
    }
    if (input.action === 'create_tags') {
        const heuristic = buildHeuristicNewTags(input);
        return {
            action: 'create_tags',
            provider: 'heuristic',
            model: null,
            ...heuristic,
        };
    }
    const heuristic = buildHeuristicSeoDraft(input);
    return {
        action: "generate_se??o",
        provider: 'heuristic',
        model: null,
        notes: heuristic.notes,
        warnings: heuristic.warnings,
        seo: heuristic.seo,
    };
}
export async function processBlogAssist(adminClient: any, input: BlogAssistInput) {
    try {
        const credentials = await loadNarrationCredentials(adminClient);
        const aiResult = await runBlogAssistWithAi(input, credentials);
        if (!aiResult?.text) {
            return buildDefaultSuggestions(input);
        }
        const parsed = parseAssistantJson<Record<string, unknown>>(aiResult.text);
        return normalizeAiResponse(input.action, parsed, aiResult.provider, aiResult.model);
    }
    catch {
        return buildDefaultSuggestions(input);
    }
}
