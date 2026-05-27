import { supabase } from '@/services/supabase/client'

export type BlogAssistAction = 'suggest_tags' | 'create_tags' | 'generate_seo'

export interface BlogAssistTagInput {
  id: string
  name: string
  slug: string
}

export interface BlogAssistArticleInput {
  title: string
  slug: string
  contentHtml: string
  seoDescription: string
  focusKeyword: string
  coverImageUrl: string
  currentTagIds: string[]
  availableTags: BlogAssistTagInput[]
}

export interface BlogAssistBaseResponse {
  provider: 'openai' | 'gemini' | 'heuristic'
  model: string | null
  notes: string[]
  warnings: string[]
}

export interface BlogAssistTagSuggestion {
  name: string
  slug: string
  description: string | null
}

export interface BlogAssistSeoDraft {
  seo_title: string
  seo_description: string
  seo_canonical_url: string
  seo_robots: string
  seo_og_title: string
  seo_og_description: string
  seo_og_image_url: string
  focus_keyword: string
}

export interface BlogAssistSuggestTagsResponse extends BlogAssistBaseResponse {
  action: 'suggest_tags'
  selectedTagIds: string[]
}

export interface BlogAssistCreateTagsResponse extends BlogAssistBaseResponse {
  action: 'create_tags'
  selectedTagIds: string[]
  suggestedTags: BlogAssistTagSuggestion[]
}

export interface BlogAssistSeoResponse extends BlogAssistBaseResponse {
  action: 'generate_seo'
  seo: BlogAssistSeoDraft
}

export type BlogAssistResponse =
  | BlogAssistSuggestTagsResponse
  | BlogAssistCreateTagsResponse
  | BlogAssistSeoResponse

async function getAccessToken() {
  const sessionResult = await supabase.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token
  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente para usar os assistentes do blog.')
  }

  return accessToken
}

async function requestBlogAssist<T extends BlogAssistResponse>(payload: Record<string, unknown>) {
  const accessToken = await getAccessToken()

  const response = await fetch('/api/admin/site-editor/assist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      ...payload,
      access_token: accessToken,
    }),
  })

  const parsed = await response.json().catch(() => null) as T | { error?: string } | null
  const errorMessage = parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
    ? parsed.error
    : null

  if (!response.ok || !parsed) {
    throw new Error(errorMessage ?? 'Nao foi possivel processar a assistencia do blog.')
  }

  return parsed as T
}

export async function fetchBlogTagSuggestions(input: BlogAssistArticleInput) {
  return await requestBlogAssist<BlogAssistSuggestTagsResponse>({
    action: 'suggest_tags',
    article: input,
  })
}

export async function fetchBlogTagCreationSuggestions(input: BlogAssistArticleInput) {
  return await requestBlogAssist<BlogAssistCreateTagsResponse>({
    action: 'create_tags',
    article: input,
  })
}

export async function fetchBlogSeoDraft(input: BlogAssistArticleInput) {
  return await requestBlogAssist<BlogAssistSeoResponse>({
    action: 'generate_seo',
    article: input,
  })
}
