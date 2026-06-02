import type { LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { BrainCircuit, BriefcaseBusiness, Download, ExternalLink, FileArchive, FileImage, FileText, FolderOpen, GraduationCap, Headphones, HeartPulse, Landmark, Link as LinkIcon, MonitorPlay, Scale, Sigma, Sparkles, } from 'lucide-react';
import { cn } from '@/lib/utils';
export interface SiteIconOption {
    value: string;
    label: string;
    icon: LucideIcon;
}
export const SITE_ICON_OPTIONS: SiteIconOption[] = [
    { value: 'heart-pulse', label: 'Saude', icon: HeartPulse },
    { value: 'scale', label: 'Juridicos', icon: Scale },
    { value: 'sigma', label: 'Exatas', icon: Sigma },
    { value: 'briefcase-business', label: "Gest?o", icon: BriefcaseBusiness },
    { value: 'landmark', label: 'Humanas', icon: Landmark },
    { value: 'brain-circuit', label: "Psican?lise / Psicologia", icon: BrainCircuit },
    { value: 'sparkles', label: 'Interesse geral', icon: Sparkles },
    { value: 'download', label: 'Download', icon: Download },
    { value: 'external-link', label: 'Link externo', icon: ExternalLink },
    { value: 'link', label: 'Link', icon: LinkIcon },
    { value: 'file-text', label: 'Documento', icon: FileText },
    { value: 'file-image', label: 'Imagem', icon: FileImage },
    { value: 'file-archive', label: 'Arquivo compactado', icon: FileArchive },
    { value: 'folder-open', label: 'Pasta', icon: FolderOpen },
    { value: 'graduation-cap', label: 'Estudo', icon: GraduationCap },
    { value: 'headphones', label: 'Audio', icon: Headphones },
    { value: 'monitor-play', label: 'Video', icon: MonitorPlay },
];
const SITE_ICON_MAP = new Map(SITE_ICON_OPTIONS.map((item) => [item.value, item.icon]));
const SVG_INLINE_CACHE = new Map<string, string>();
const SVG_VIEWBOX_CACHE = new Map<string, string>();
function normalizeIconColor(value: string | null | undefined) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}
function normalizeIconSize(value: number | null | undefined) {
    if (!Number.isFinite(value)) {
        return undefined;
    }
    const numericValue = Number(value);
    return Math.min(36, Math.max(12, numericValue));
}
function isSvgIconUrl(value: string) {
    if (value.trim() === '') {
        return false;
    }
    try {
        const parsed = new URL(value);
        return parsed.pathname.toLowerCase().endsWith('.svg');
    }
    catch {
        return value.split("")[0]?.toLowerCase().endsWith('.svg') ?? false;
    }
}
function shouldForceCurrentColorForPaintValue(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === ''
        || normalized === 'none'
        || normalized === 'currentcolor'
        || normalized === 'inherit'
        || normalized === 'transparent'
        || normalized === 'context-fill'
        || normalized === 'context-stroke'
        || normalized.startsWith('url(')
        || normalized.startsWith('var(')) {
        return false;
    }
    return true;
}
function normalizeInlineSvgStyle(styleText: string) {
    return styleText.replace(/(fill|stroke)\s*:\s*([^;]+)(;?)/gi, (fullMatch, propertyName: string, rawValue: string, trailingSemicolon: string) => {
        return shouldForceCurrentColorForPaintValue(rawValue)
            ? `${propertyName}:currentColor${trailingSemicolon || ''}`
            : fullMatch;
    });
}
function normalizeSvgMarkup(svgText: string, forceCurrentColor: boolean) {
    const withoutPreamble = svgText
        .replace(/<\?xml[\s\S]*?\?>/gi, '')
        .replace(/<!doctype[\s\S]*?>/gi, '')
        .replace(/<svg\b([^>]*)>/i, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet">');
    if (!forceCurrentColor) {
        return withoutPreamble;
    }
    const shapeTagsThatDefaultToFill = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon']);
    return withoutPreamble
        .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_fullMatch, styleAttrs: string, styleContent: string) => {
        return `<style${styleAttrs}>${normalizeInlineSvgStyle(styleContent)}</style>`;
    })
        .replace(/<(path|rect|circle|ellipse|polygon|polyline|line)\b([^>]*)>/gi, (_fullMatch, rawTagName: string, rawAttributes: string) => {
        let attributes = rawAttributes.replace(/\b(fill|stroke)=["']([^"']+)["']/gi, (paintMatch, propertyName: string, rawValue: string) => {
            return shouldForceCurrentColorForPaintValue(rawValue)
                ? `${propertyName}="currentColor"`
                : paintMatch;
        });
        attributes = attributes.replace(/\bstyle=(["'])([\s\S]*?)\1/gi, (_styleMatch, quote: string, styleValue: string) => {
            return `style=${quote}${normalizeInlineSvgStyle(styleValue)}${quote}`;
        });
        const tagName = rawTagName.toLowerCase();
        const hasPaintAttribute = /\b(fill|stroke)=["'][^"']*["']/i.test(attributes);
        const hasPaintStyle = /\bstyle=(["'])[\s\S]*?(fill|stroke)\s*:/i.test(attributes);
        if (!hasPaintAttribute && !hasPaintStyle && shapeTagsThatDefaultToFill.has(tagName)) {
            attributes += ' fill="currentColor"';
        }
        return `<${rawTagName}${attributes}>`;
    });
}
function applyNormalizedSvgViewBox(svg: SVGSVGElement, cacheKey: string) {
    const cachedViewBox = SVG_VIEWBOX_CACHE.get(cacheKey);
    if (cachedViewBox) {
        svg.setAttribute('viewBox', cachedViewBox);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';
        return;
    }
    let bbox: DOMRect | SVGRect;
    try {
        bbox = svg.getBBox();
    }
    catch {
        return;
    }
    if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
        return;
    }
    const paddingX = Math.max(bbox.width * 0.14, 1.25);
    const paddingY = Math.max(bbox.height * 0.14, 1.25);
    const viewBox = [
        bbox.x - paddingX,
        bbox.y - paddingY,
        bbox.width + (paddingX * 2),
        bbox.height + (paddingY * 2),
    ].join(' ');
    SVG_VIEWBOX_CACHE.set(cacheKey, viewBox);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
}
function RemoteSvgIcon({ iconImageUrl, iconAlt, iconColor, className, sizeStyle, }: {
    iconImageUrl: string;
    iconAlt: string;
    iconColor?: string;
    className?: string;
    sizeStyle?: {
        width: string;
        height: string;
    };
}) {
    const cacheKey = `${iconImageUrl}::${iconColor ? 'colorized' : 'original'}`;
    const [svgMarkup, setSvgMarkup] = useState<string | null>(() => SVG_INLINE_CACHE.get(cacheKey) ?? null);
    useEffect(() => {
        let isMounted = true;
        const cached = SVG_INLINE_CACHE.get(cacheKey);
        if (cached) {
            setSvgMarkup(cached);
            return () => {
                isMounted = false;
            };
        }
        setSvgMarkup(null);
        void fetch(iconImageUrl)
            .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`SVG fetch failed: ${response.status}`))))
            .then((svgText) => {
            if (!isMounted)
                return;
            const normalized = normalizeSvgMarkup(svgText, Boolean(iconColor));
            SVG_INLINE_CACHE.set(cacheKey, normalized);
            setSvgMarkup(normalized);
        })
            .catch(() => {
            if (!isMounted)
                return;
            setSvgMarkup(null);
        });
        return () => {
            isMounted = false;
        };
    }, [cacheKey, iconColor, iconImageUrl]);
    useLayoutEffect(() => {
        if (!svgMarkup || typeof document === 'undefined') {
            return;
        }
        const frameId = window.requestAnimationFrame(() => {
            const holders = document.querySelectorAll<HTMLElement>(`[data-genflix-svg-key="${CSS.escape(cacheKey)}"]`);
            holders.forEach((holder) => {
                const svg = holder.querySelector('svg');
                if (!(svg instanceof SVGSVGElement)) {
                    return;
                }
                applyNormalizedSvgViewBox(svg, cacheKey);
            });
        });
        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [cacheKey, svgMarkup]);
    if (!svgMarkup) {
        return (<img src={iconImageUrl} alt={iconAlt} className={cn('block h-full w-full object-contain', className)} style={sizeStyle}/>);
    }
    return (<span aria-label={iconAlt} role="img" data-genflix-svg-key={cacheKey} className={cn('flex h-full w-full items-center justify-center overflow-hidden', className)} style={{
            ...(iconColor ? { color: iconColor } : {}),
            ...sizeStyle,
        }} dangerouslySetInnerHTML={{ __html: svgMarkup }}/>);
}
export function renderSiteIcon(iconKey: string | null | undefined, className?: string, iconColor?: string | null) {
    const Icon = SITE_ICON_MAP.get(iconKey ?? '') ?? LinkIcon;
    const resolvedColor = normalizeIconColor(iconColor);
    return <Icon className={cn('h-4 w-4', className)} style={resolvedColor ? { color: resolvedColor } : undefined}/>;
}
export function renderSiteIconVisual(input: {
    iconKey?: string | null;
    iconImageUrl?: string | null;
    iconAlt?: string | null;
    iconColor?: string | null;
    iconImageMimeType?: string | null;
    iconSize?: number | null;
    className?: string;
}) {
    const iconColor = normalizeIconColor(input.iconColor);
    const iconImageUrl = typeof input.iconImageUrl === 'string' ? input.iconImageUrl.trim() : '';
    const iconKey = typeof input.iconKey === 'string' ? input.iconKey.trim() : '';
    const iconImageMimeType = typeof input.iconImageMimeType === 'string' ? input.iconImageMimeType.trim().toLowerCase() : '';
    const isSvgIcon = iconImageMimeType === 'image/svg+xml' || isSvgIconUrl(iconImageUrl);
    const iconSize = normalizeIconSize(input.iconSize);
    const sizeStyle = iconSize ? { width: `${iconSize}px`, height: `${iconSize}px` } : undefined;
    if (iconImageUrl !== '') {
        if (isSvgIcon) {
            return (<RemoteSvgIcon iconImageUrl={iconImageUrl} iconAlt={input.iconAlt ?? ''} iconColor={iconColor} className={input.className} sizeStyle={sizeStyle}/>);
        }
        return (<img src={iconImageUrl} alt={input.iconAlt ?? ''} className={cn('block h-full w-full object-contain', input.className)} style={sizeStyle}/>);
    }
    if (iconKey !== '') {
        const Icon = SITE_ICON_MAP.get(iconKey) ?? LinkIcon;
        return (<Icon className={cn('h-4 w-4', input.className)} style={{
                ...(iconColor ? { color: iconColor } : {}),
                ...(sizeStyle ?? {}),
            }}/>);
    }
    const FallbackIcon = SITE_ICON_MAP.get(input.iconKey ?? '') ?? LinkIcon;
    return (<FallbackIcon className={cn('h-4 w-4', input.className)} style={{
            ...(iconColor ? { color: iconColor } : {}),
            ...(sizeStyle ?? {}),
        }}/>);
}
export function getSiteIconOption(iconKey: string | null | undefined) {
    return SITE_ICON_OPTIONS.find((item) => item.value === iconKey) ?? null;
}
