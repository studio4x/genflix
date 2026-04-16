import { cn } from '@/lib/utils'

interface GenflixLogoProps {
  className?: string
  theme?: 'light' | 'dark'
}

export function GenflixLogo({ className, theme = 'dark' }: GenflixLogoProps) {
  const isLight = theme === 'light'

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute h-5 w-5 -translate-x-[7px] rotate-[18deg] rounded-[6px] bg-[#1bb6b2]" />
        <span className="absolute h-5 w-5 translate-x-[7px] rotate-[-18deg] rounded-[6px] bg-[#1398B7]" />
        <span className="absolute h-3 w-3 translate-y-[9px] rounded-full bg-[#D9F0F5]" />
      </span>
      <span
        className={cn(
          'font-readex text-[1.45rem] font-medium tracking-[-0.04em]',
          isLight ? 'text-white' : 'text-[#15323b]',
        )}
      >
        GenFlix
      </span>
    </div>
  )
}
