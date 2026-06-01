export const APP_BUILD_VERSION = '0.0.1610-d3d70f6'

interface AppVersionProps {
  className?: string
}

export function AppVersion({ className = '' }: AppVersionProps) {
  return <span className={className}>Build v{APP_BUILD_VERSION}</span>
}
