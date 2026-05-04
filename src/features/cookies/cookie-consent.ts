export type CookieConsentPreferences = {
  analytics: boolean
  personalization: boolean
  marketing: boolean
}

export type CookieConsentState = {
  acceptedAt: string
  updatedAt: string
  preferences: CookieConsentPreferences
}

export const COOKIE_CONSENT_STORAGE_KEY = 'genflix_cookie_consent_v1'

export function createDefaultCookieConsentPreferences(): CookieConsentPreferences {
  return {
    analytics: false,
    personalization: false,
    marketing: false,
  }
}

export function createCookieConsentState(
  preferences: Partial<CookieConsentPreferences> = {},
  timestamp = new Date().toISOString(),
): CookieConsentState {
  return {
    acceptedAt: timestamp,
    updatedAt: timestamp,
    preferences: {
      ...createDefaultCookieConsentPreferences(),
      ...preferences,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function normalizeCookieConsentState(value: unknown): CookieConsentState | null {
  if (!isRecord(value)) {
    return null
  }

  const acceptedAt = readString(value.acceptedAt)
  if (!acceptedAt) {
    return null
  }

  const updatedAt = readString(value.updatedAt) ?? acceptedAt
  const preferencesRecord = isRecord(value.preferences) ? value.preferences : {}

  if (!('preferences' in value)) {
    return createCookieConsentState({
      analytics: true,
      personalization: true,
      marketing: true,
    }, acceptedAt)
  }

  return {
    acceptedAt,
    updatedAt,
    preferences: {
      analytics: readBoolean(preferencesRecord.analytics, false),
      personalization: readBoolean(preferencesRecord.personalization, false),
      marketing: readBoolean(preferencesRecord.marketing, false),
    },
  }
}

