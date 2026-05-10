export const APP_BUILD_VERSION = '0.0.1064-21e05f6'

interface AppVersionProps {
  className?: string
}

export function AppVersion({ className = '' }: AppVersionProps) {
  return <span className={className}>Build v{APP_BUILD_VERSION}</span>
}
