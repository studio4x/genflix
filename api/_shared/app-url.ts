const DEFAULT_PUBLIC_APP_URL = 'https://genflix-omega.vercel.app'

function normalizeUrl(value: string | undefined | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.replace(/\/$/, '')
}

export function getPublicAppUrl() {
  return (
    normalizeUrl(process.env.APP_PUBLIC_URL) ??
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeUrl(process.env.VERCEL_URL) ??
    DEFAULT_PUBLIC_APP_URL
  )
}
