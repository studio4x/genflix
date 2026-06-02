import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
type GenflixCtaTone = 'solid' | 'warm' | 'surface' | 'ghost';
export const GENFLIX_CTA_TONES = ['solid', 'warm', 'surface', 'ghost'] as const;
export function normalizeGenflixCtaTone(value: unknown): GenflixCtaTone {
    return GENFLIX_CTA_TONES.includes(value as (typeof GENFLIX_CTA_TONES)[number])
        ? value as GenflixCtaTone
        : 'solid';
}
const toneClasses: Record<GenflixCtaTone, string> = {
    solid: 'border-white bg-[radial-gradient(circle_at_75%_25%,rgba(255,255,255,0.12),transparent_40%),linear-gradient(180deg,#19B7DA_0%,#0A3640_100%)] text-[#F6F6F6] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:shadow-[0px_6px_10px_rgba(0,0,0,0.28)]',
    warm: 'border-white bg-[radial-gradient(circle_at_75%_25%,rgba(231,248,241,0.92),transparent_40%),linear-gradient(180deg,#2FA66F_0%,#176E52_100%)] text-[#F6F6F6] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:shadow-[0px_6px_10px_rgba(0,0,0,0.28)]',
    surface: 'border-[#D8E6EB] bg-white text-[#183139] shadow-[0_10px_24px_rgba(21,50,59,0.08)] hover:border-[#BEE3EA] hover:bg-[#F7FBFC]',
    ghost: 'border-white/24 bg-white/10 text-white backdrop-blur-sm hover:bg-white/16',
};
const iconClasses: Record<GenflixCtaTone, string> = {
    solid: 'bg-[#F8F0E8] text-[#1151B1]',
    warm: 'bg-[#E7F8F1] text-[#176E52]',
    surface: 'bg-[#EBF3F5] text-[#15323B]',
    ghost: 'border border-white/24 bg-white/16 text-white',
};
export function GenflixCtaButton({ asChild = false, tone = 'solid', customColors, className, children, ...props }: React.ComponentProps<'button'> & {
    asChild?: boolean;
    tone?: GenflixCtaTone;
    customColors?: {
        buttonBackgroundColor?: string;
        buttonTextColor?: string;
        iconBackgroundColor?: string;
        iconTextColor?: string;
    };
}) {
    const classes = cn('group/genflix-cta inline-flex h-11 items-center justify-center gap-3 rounded-[32px] border px-5 pr-2 font-readex text-[16px] font-medium leading-none whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-[#1398B7]/25 active:translate-y-px disabled:pointer-events-none disabled:opacity-60', toneClasses[tone], className);
    const content = (label: React.ReactNode) => (<>
      <span className="truncate leading-none" style={{ color: customColors?.buttonTextColor }}>
        {label}
      </span>
      <span aria-hidden="true" className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover/genflix-cta:translate-x-0.5', iconClasses[tone])} style={{
            backgroundColor: customColors?.iconBackgroundColor,
            color: customColors?.iconTextColor,
        }}>
        <ArrowUpRight className="h-4 w-4"/>
      </span>
    </>);
    if (asChild && React.isValidElement<{
        className?: string;
        children?: React.ReactNode;
        style?: React.CSSProperties;
    }>(children)) {
        return React.cloneElement(children, {
            ...props,
            className: cn(classes, children.props.className),
            style: {
                ...props.style,
                ...children.props.style,
                backgroundImage: customColors?.buttonBackgroundColor ? 'none' : props.style?.backgroundImage ?? children.props.style?.backgroundImage,
                backgroundColor: customColors?.buttonBackgroundColor ?? props.style?.backgroundColor,
                color: customColors?.buttonTextColor ?? props.style?.color,
                borderColor: customColors?.buttonBackgroundColor ?? props.style?.borderColor ?? children.props.style?.borderColor,
            },
            children: content(children.props.children),
        });
    }
    return (<button data-slot="genflix-cta-button" className={classes} style={{
            backgroundImage: customColors?.buttonBackgroundColor ? 'none' : undefined,
            backgroundColor: customColors?.buttonBackgroundColor,
            color: customColors?.buttonTextColor,
            borderColor: customColors?.buttonBackgroundColor,
        }} {...props}>
      {content(children)}
    </button>);
}
