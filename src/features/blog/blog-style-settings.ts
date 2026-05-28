type BlogTagKey = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'a' | 'li'
type BlogCardTextKey = 'title' | 'description' | 'link'

export type BlogTagStyle = {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  color: string
  underline: boolean
}

export type BlogCardStyle = {
  backgroundColor: string
  borderColor: string
  borderRadius: string
  padding: string
  minHeight: string
  imageObjectFit: 'cover' | 'contain'
}

export type BlogStyleSettings = {
  articleTitle: BlogTagStyle
  content: Record<BlogTagKey, BlogTagStyle>
  card: {
    container: BlogCardStyle
    text: Record<BlogCardTextKey, BlogTagStyle>
  }
}

const TAG_KEYS: BlogTagKey[] = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'li']
const CARD_TEXT_KEYS: BlogCardTextKey[] = ['title', 'description', 'link']

function sanitizeCssValue(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().replace(/[{};]/g, '')
}

function createEmptyTagStyle(): BlogTagStyle {
  return {
    fontFamily: '',
    fontSize: '',
    fontWeight: '',
    lineHeight: '',
    letterSpacing: '',
    color: '',
    underline: true,
  }
}

export function createDefaultBlogStyleSettings(): BlogStyleSettings {
  return {
    articleTitle: createEmptyTagStyle(),
    content: {
      p: createEmptyTagStyle(),
      h1: createEmptyTagStyle(),
      h2: createEmptyTagStyle(),
      h3: createEmptyTagStyle(),
      h4: createEmptyTagStyle(),
      h5: createEmptyTagStyle(),
      h6: createEmptyTagStyle(),
      a: createEmptyTagStyle(),
      li: createEmptyTagStyle(),
    },
    card: {
      container: {
        backgroundColor: '',
        borderColor: '',
        borderRadius: '',
        padding: '',
        minHeight: '',
        imageObjectFit: 'contain',
      },
      text: {
        title: createEmptyTagStyle(),
        description: createEmptyTagStyle(),
        link: createEmptyTagStyle(),
      },
    },
  }
}

function normalizeTagStyle(value: unknown): BlogTagStyle {
  const fallback = createEmptyTagStyle()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback
  }
  const style = value as Record<string, unknown>
  return {
    fontFamily: sanitizeCssValue(style.fontFamily),
    fontSize: sanitizeCssValue(style.fontSize),
    fontWeight: sanitizeCssValue(style.fontWeight),
    lineHeight: sanitizeCssValue(style.lineHeight),
      letterSpacing: sanitizeCssValue(style.letterSpacing),
      color: sanitizeCssValue(style.color),
      underline: typeof style.underline === 'boolean' ? style.underline : true,
    }
  }

export function normalizeBlogStyleSettings(value: unknown): BlogStyleSettings {
  const base = createDefaultBlogStyleSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return base
  }

  const record = value as Record<string, unknown>
  base.articleTitle = normalizeTagStyle(record.articleTitle)
  const content = record.content
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const contentRecord = content as Record<string, unknown>
    for (const key of TAG_KEYS) {
      base.content[key] = normalizeTagStyle(contentRecord[key])
    }
  }

  const card = record.card
  if (card && typeof card === 'object' && !Array.isArray(card)) {
    const cardRecord = card as Record<string, unknown>
    const container = cardRecord.container
    if (container && typeof container === 'object' && !Array.isArray(container)) {
      const containerRecord = container as Record<string, unknown>
      base.card.container = {
        backgroundColor: sanitizeCssValue(containerRecord.backgroundColor),
        borderColor: sanitizeCssValue(containerRecord.borderColor),
        borderRadius: sanitizeCssValue(containerRecord.borderRadius),
        padding: sanitizeCssValue(containerRecord.padding),
        minHeight: sanitizeCssValue(containerRecord.minHeight),
        imageObjectFit: containerRecord.imageObjectFit === 'cover' ? 'cover' : 'contain',
      }
    }

    const text = cardRecord.text
    if (text && typeof text === 'object' && !Array.isArray(text)) {
      const textRecord = text as Record<string, unknown>
      for (const key of CARD_TEXT_KEYS) {
        base.card.text[key] = normalizeTagStyle(textRecord[key])
      }
    }
  }

  return base
}
