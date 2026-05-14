export const APP_BUILD_VERSION = '0.0.1228-6f42c5d'

interface AppVersionProps {
  className?: string
}

export function AppVersion({ className = '' }: AppVersionProps) {
  return <span className={className}>Build v{APP_BUILD_VERSION}</span>
}
