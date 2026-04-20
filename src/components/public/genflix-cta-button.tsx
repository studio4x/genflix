import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

type GenflixCtaTone = 'solid' | 'surface' | 'ghost'

const toneClasses: Record<GenflixCtaTone, string> = {
  solid:
    'border-white/70 bg-[radial-gradient(circle_at_75%_25%,rgba(255,255,255,0.12),transparent_40%),linear-gradient(180deg,#19B7DA_0%,#0A3640_100%)] text-[#F6F6F6] shadow-[0_4px_10px_rgba(10,54,64,0.25)] hover:shadow-[0_8px_16px_rgba(10,54,64,0.3)]',
  surface:
    'border-[#D8E6EB] bg-white text-[#183139] shadow-[0_10px_24px_rgba(21,50,59,0.08)] hover:border-[#BEE3EA] hover:bg-[#F7FBFC]',
  ghost:
    'border-white/24 bg-white/10 text-white backdrop-blur-sm hover:bg-white/16',
}

const iconClasses: Record<GenflixCtaTone, string> = {
  solid: 'bg-[#F8F0E8] text-[#1151B1]',
  surface: 'bg-[#E7F1F4] text-[#1151B1]',
  ghost: 'border border-white/24 bg-white/16 text-white',
}

export function GenflixCtaButton({
  asChild = false,
  tone = 'solid',
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  tone?: GenflixCtaTone
}) {
  const Comp = asChild ? Slot.Root : 'button'
  const content = (
    <>
      <span className="truncate leading-none">{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover/genflix-cta:translate-x-0.5',
          iconClasses[tone],
        )}
      >
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </>
  )

  return (
    <Comp
      data-slot="genflix-cta-button"
      className={cn(
        'group/genflix-cta inline-flex min-h-11 items-center justify-between gap-4 rounded-full border px-5 pr-2 font-readex text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-[#1398B7]/25 active:translate-y-px disabled:pointer-events-none disabled:opacity-60',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {asChild ? <Slot.Slottable>{content}</Slot.Slottable> : content}
    </Comp>
  )
}
