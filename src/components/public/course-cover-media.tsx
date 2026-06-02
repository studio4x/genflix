import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
interface CourseCoverMediaProps {
    src?: string | null;
    alt: string;
    title: string;
    category?: string;
    initials?: string;
    className?: string;
    imageClassName?: string;
    placeholderClassName?: string;
}
export function CourseCoverMedia({ src, alt, title, category, initials, className, imageClassName, placeholderClassName, }: CourseCoverMediaProps) {
    const normalizedSrc = typeof src === 'string' && src.trim() !== '' ? src.trim() : null;
    const [hasError, setHasError] = useState(!normalizedSrc);
    useEffect(() => {
        setHasError(!normalizedSrc);
    }, [normalizedSrc]);
    const showPlaceholder = !normalizedSrc || hasError;
    return (<div className={cn('relative h-full w-full overflow-hidden bg-[#173039]', className)}>
      {!showPlaceholder ? (<img src={normalizedSrc} alt={alt} loading="lazy" onError={() => setHasError(true)} className={cn('h-full w-full object-cover', imageClassName)}/>) : null}

      {showPlaceholder ? (<div className={cn('absolute inset-0 flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top_left,#1ba8c5_0%,#1398B7_28%,#0A3640_100%)] p-5 text-white', placeholderClassName)}>
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
              {category || 'Curso'}
            </span>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/12 text-sm font-black uppercase tracking-[0.12em] text-white">
              {initials || title.slice(0, 2).toUpperCase()}
            </span>
          </div>

          <div className="max-w-[18rem]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">GenFlix</p>
            <p className="mt-2 text-lg font-bold leading-tight text-white">{title}</p>
          </div>
        </div>) : null}
    </div>);
}
