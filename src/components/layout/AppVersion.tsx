export const APP_BUILD_VERSION = '0.0.1225-1204e83'

interface AppVersionProps {
  className?: string
}

export function AppVersion({ className = '' }: AppVersionProps) {
  return <span className={className}>Build v{APP_BUILD_VERSION}</span>
}
