import { AppVersion } from '@/components/layout/AppVersion'
import { LegalLinksNav } from '@/components/layout/legal-links-nav'

interface PlatformFooterProps {
  className?: string
  linksClassName?: string
  versionClassName?: string
  compact?: boolean
}

export function PlatformFooter({
  className = '',
  linksClassName = '',
  versionClassName = '',
  compact = false,
}: PlatformFooterProps) {
  return (
    <footer
      className={`flex w-full flex-col items-center justify-between gap-3 ${compact ? 'sm:flex-row' : 'lg:flex-row'} ${className}`.trim()}
    >
      <LegalLinksNav className={linksClassName} />
      <AppVersion
        className={`text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 ${versionClassName}`.trim()}
      />
    </footer>
  )
}
