export type BuilderNoticeType = 'success' | 'error'

export interface BuilderNoticePayload {
  type: BuilderNoticeType
  message: string
  createdAt: string
}

const STORAGE_KEY = 'hcm_builder_notice'
const EVENT_NAME = 'hcm:builder-notice'

export function publishBuilderNotice(type: BuilderNoticeType, message: string) {
  if (typeof window === 'undefined') return

  const payload: BuilderNoticePayload = {
    type,
    message,
    createdAt: new Date().toISOString(),
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function readBuilderNotice() {
  if (typeof window === 'undefined') return null

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as BuilderNoticePayload
    if (!parsed || (parsed.type !== 'success' && parsed.type !== 'error') || typeof parsed.message !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearBuilderNotice() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export const BUILDER_NOTICE_EVENT = EVENT_NAME
