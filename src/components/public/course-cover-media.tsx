import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
function getVideoSource(url: string): {
    type: 'youtube';
    value: string;
} | {
    type: 'direct';
    value: string;
} | null {
    const trimmed = url.trim();
    if (!trimmed) {
        return null;
    }
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    if (match && match[2].length === 11) {
        return { type: 'youtube', value: match[2] };
    }
    const isDirectVideo = /^https?:\/\/[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?$/i.test(trimmed);
    if (isDirectVideo) {
        return { type: 'direct', value: trimmed };
    }
    return null;
}
interface CourseCoverMediaProps {
    src?: string | null;
    videoSrc?: string | null;
    alt: string;
    title: string;
    category?: string;
    initials?: string;
    className?: string;
    imageClassName?: string;
    placeholderClassName?: string;
}
export function CourseCoverMedia({ src, videoSrc, alt, title, category, initials, className, imageClassName, placeholderClassName, }: CourseCoverMediaProps) {
    const normalizedSrc = typeof src === 'string' && src.trim() !== '' ? src.trim() : null;
    const normalizedVideoSrc = typeof videoSrc === 'string' && videoSrc.trim() !== '' ? videoSrc.trim() : null;
    const resolvedVideoSource = normalizedVideoSrc ? getVideoSource(normalizedVideoSrc) : null;
    const [hasError, setHasError] = useState(!normalizedSrc);
    const [hasVideoError, setHasVideoError] = useState(!normalizedVideoSrc);
    useEffect(() => {
        setHasError(!normalizedSrc);
        setHasVideoError(!normalizedVideoSrc);
    }, [normalizedSrc, normalizedVideoSrc]);
    const showVideo = Boolean(resolvedVideoSource && !hasVideoError);
    const showPlaceholder = !showVideo && (!normalizedSrc || hasError);
    return (<div className={cn('relative h-full w-full overflow-hidden bg-[#173039]', className)}>
      {showVideo ? (resolvedVideoSource && resolvedVideoSource.type === 'youtube' ? (<iframe src={`https://www.youtube.com/embed/${resolvedVideoSource.value}`} title={alt} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className={cn('h-full w-full object-cover', imageClassName)}/>) : resolvedVideoSource ? (<video src={resolvedVideoSource.value} controls playsInline muted autoPlay loop preload="metadata" onError={() => setHasVideoError(true)} className={cn('h-full w-full object-cover', imageClassName)}/>) : null) : null}
      {!showVideo && !showPlaceholder ? (<img src={normalizedSrc ?? undefined} alt={alt} loading="lazy" onError={() => setHasError(true)} className={cn('h-full w-full object-cover', imageClassName)}/>) : null}

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
