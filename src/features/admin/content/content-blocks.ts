import type {
    LessonImageHotspotsAsset,
    LessonImageHotspotsBlockContent,
    LessonImageHotspotItem,
    LessonFlashcardItem,
    LessonFlashcardsBlockContent,
    LessonButtonBlockContent,
    LessonButtonBlockAlignment,
    LessonButtonBlockWidth,
    LessonButtonBlockLocalConfig,
} from '@/types/content';
export type {
    LessonButtonBlockContent,
    LessonButtonBlockAlignment,
    LessonButtonBlockWidth,
    LessonButtonBlockLocalConfig,
};

export const DEFAULT_MODAL_TITLE = 'Material Complementar';
export const DEFAULT_MODAL_SUBTITLE = 'Conteúdo complementar da aula.';

export function resolveModalSubtitle(subtitle?: string | null): string | undefined {
    if (subtitle === undefined || subtitle === null) {
        return DEFAULT_MODAL_SUBTITLE;
    }
    const trimmed = subtitle.trim();
    return trimmed !== '' ? trimmed : undefined;
}

export type LessonImageBlockSize = 'sm' | 'md' | 'lg' | 'full';
export type LessonImageBlockCaptionAlignment = 'left' | 'center' | 'right';
export type LessonVideoBlockSize = 'sm' | 'md' | 'lg' | 'full';
export type LessonVideoBlockCaptionAlignment = 'left' | 'center' | 'right';
export interface LessonImageBlockContent {
    source_type: 'url' | 'upload';
    image_url: string;
    storage_path: string;
    storage_provider?: 'supabase' | 'r2';
    signed_url?: string | null;
    file_name: string;
    mime_type: string | null;
    alt: string;
    size: LessonImageBlockSize;
    caption: string;
    caption_alignment: LessonImageBlockCaptionAlignment;
    media_asset_id?: string;
}
export interface LessonVideoBlockContent {
    source_type: 'url' | 'upload';
    url: string;
    storage_path: string;
    storage_provider?: 'supabase' | 'r2';
    signed_url?: string | null;
    file_name: string;
    mime_type: string | null;
    caption: string;
    size: LessonVideoBlockSize;
    caption_alignment: LessonVideoBlockCaptionAlignment;
}
export interface LessonHtmlBlockContent {
    source_type: 'paste' | 'upload';
    html: string;
    storage_path: string;
    storage_provider?: 'supabase' | 'r2';
    signed_url?: string | null;
    file_name: string;
    mime_type: string | null;
}
export interface LessonSvgBlockContent {
    source_type: 'url' | 'upload';
    url: string;
    storage_path: string;
    storage_provider?: 'supabase' | 'r2';
    signed_url?: string | null;
    file_name: string;
    mime_type: string | null;
    alt: string;
    size: LessonImageBlockSize;
    caption: string;
    caption_alignment: LessonImageBlockCaptionAlignment;
}
export interface LessonColumnBlockContent {
    width: number;
    blocks: LessonContentBlock[];
}
export type LessonColumnsBlockContent = LessonColumnBlockContent[];
export type LessonContentBlock = {
    type: 'rich-text';
    content: string;
} | {
    type: 'columns';
    content: LessonColumnsBlockContent;
} | {
    type: 'table';
    content: string;
} | {
    type: 'image';
    content: LessonImageBlockContent;
} | {
    type: 'video';
    content: LessonVideoBlockContent;
} | {
    type: 'image-hotspots';
    content: LessonImageHotspotsBlockContent;
} | {
    type: 'html';
    content: LessonHtmlBlockContent;
} | {
    type: 'svg';
    content: LessonSvgBlockContent;
} | {
    type: 'flashcards';
    content: LessonFlashcardsBlockContent;
} | {
    type: 'button';
    content: LessonButtonBlockContent;
};
const TABLE_PLACEHOLDER_PREFIX = '__TABLE_BLOCK__';
const IMAGE_PLACEHOLDER_PREFIX = '__IMAGE_BLOCK__';
const VIDEO_PLACEHOLDER_PREFIX = '__VIDEO_BLOCK__';
const HOTSPOTS_PLACEHOLDER_PREFIX = '__HOTSPOTS_BLOCK__';
const HTML_PLACEHOLDER_PREFIX = '__HTML_BLOCK__';
const SVG_PLACEHOLDER_PREFIX = '__SVG_BLOCK__';
const FLASHCARDS_PLACEHOLDER_PREFIX = '__FLASHCARDS_BLOCK__';
const COLUMNS_PLACEHOLDER_PREFIX = '__COLUMNS_BLOCK__';
const BUTTON_PLACEHOLDER_PREFIX = '__BUTTON_BLOCK__';
const LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR = 'data-hcm-block';
const LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR = 'data-hcm-payload';
const LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE = 'image-hotspots';
const LESSON_COLUMNS_BLOCK_COUNT_ATTR = 'data-hcm-columns';
const LESSON_COLUMNS_BLOCK_WIDTHS_ATTR = 'data-hcm-column-widths';
const LESSON_COLUMNS_BLOCK_TYPE = 'columns';
const LESSON_IMAGE_BLOCK_TYPE = 'image';
const LESSON_VIDEO_BLOCK_TYPE = 'video';
const LESSON_HTML_BLOCK_TYPE = 'html';
const LESSON_SVG_BLOCK_TYPE = 'svg';
const LESSON_FLASHCARDS_BLOCK_TYPE = 'flashcards';
const LESSON_BUTTON_BLOCK_TYPE = 'button';
const COLUMN_WIDTH_STEP = 5;
const LESSON_VIDEO_MAX_WIDTH_STYLE: Record<LessonVideoBlockSize, string> = {
    sm: 'max-width: 28rem;',
    md: 'max-width: 42rem;',
    lg: 'max-width: 56rem;',
    full: 'max-width: none;',
};
const LESSON_VIDEO_CAPTION_ALIGNMENT_STYLE: Record<LessonVideoBlockCaptionAlignment, string> = {
    left: 'left',
    center: 'center',
    right: 'right',
};
const ALLOWED_TABLE_TAGS = new Set([
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
]);
const ALLOWED_TABLE_ATTRS = new Set([
    'colspan',
    'rowspan',
    'scope',
    'span',
]);
const ALLOWED_HOTSPOT_BODY_TAGS = new Set([
    'a',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'strong',
    'u',
    'ul',
]);
const ALLOWED_HOTSPOT_BODY_ATTRS = new Set(['href', 'target', 'rel']);
const ALLOWED_RICH_TEXT_TAGS = new Set([
    'a',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'li',
    'ol',
    'p',
    'pre',
    'img',
    's',
    'span',
    'strong',
    'u',
    'ul',
]);
const ALLOWED_RICH_TEXT_ATTRS = new Set(['href', 'target', 'rel', 'data-hcm-inline-button', 'data-hcm-button-payload']);
const ALLOWED_RICH_TEXT_IMG_ATTRS = new Set(['src', 'alt', 'title', 'width', 'height', 'data-align']);
function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof DOMParser !== 'undefined';
}
function hasTableLikeMarkup(html: string): boolean {
    return /<table[\s>]/i.test(html);
}
function containsForbiddenTableFragments(html: string): boolean {
    return /<(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)\b/i.test(html);
}
function normalizeHtml(html: string): string {
    return html.replace(/\uFEFF/g, '').trim();
}
function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
function buildEqualColumnWidths(columnsCount: number): number[] {
    const safeCount = clamp(columnsCount, 1, 4);
    const baseWidth = Math.floor((100 / safeCount) / COLUMN_WIDTH_STEP) * COLUMN_WIDTH_STEP;
    const widths = Array.from({ length: safeCount }, () => baseWidth);
    let remainingWidth = 100 - widths.reduce((sum, value) => sum + value, 0);
    let index = 0;
    while (remainingWidth > 0) {
        widths[index % safeCount] += COLUMN_WIDTH_STEP;
        remainingWidth -= COLUMN_WIDTH_STEP;
        index += 1;
    }
    return widths;
}
function roundPercent(value: number) {
    return Math.round(value * 100) / 100;
}
function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function createFallbackBlock(html: string): LessonContentBlock[] {
    return [{ type: 'rich-text', content: html }];
}
function isSafeAnchorHref(value: string) {
    return /^(https?:|mailto:|tel:|#|\/)/i.test(value);
}
/**
 * Remove comentários, scripts e estilos.
 */
function removeDangerousNodes(root: ParentNode): void {
    root.querySelectorAll('script, style, iframe, object, embed').forEach((node) => {
        node.remove();
    });
}
function sanitizeHotspotBodyNode(element: Element): void {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_HOTSPOT_BODY_TAGS.has(tag)) {
        const parent = element.parentNode;
        if (!parent) {
            element.remove();
            return;
        }
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        element.remove();
        return;
    }
    ;
    [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (name === 'style'
            || name.startsWith('on')
            || !ALLOWED_HOTSPOT_BODY_ATTRS.has(name)) {
            element.removeAttribute(attribute.name);
            return;
        }
        if (name === 'href' && !isSafeAnchorHref(attribute.value)) {
            element.removeAttribute(attribute.name);
            return;
        }
        if (name === 'target' && attribute.value !== '_blank') {
            element.setAttribute('target', '_blank');
        }
    });
    if (tag === 'a') {
        const href = element.getAttribute('href');
        if (href) {
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noreferrer noopener');
        }
    }
    ;
    [...element.children].forEach((child) => sanitizeHotspotBodyNode(child));
}
function sanitizeRichTextNode(element: Element): void {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_RICH_TEXT_TAGS.has(tag)) {
        const parent = element.parentNode;
        if (!parent) {
            element.remove();
            return;
        }
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        element.remove();
        return;
    }
    ;
    const allowedAttrs = tag === 'img' ? ALLOWED_RICH_TEXT_IMG_ATTRS : ALLOWED_RICH_TEXT_ATTRS;
    [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (name === 'style' || name.startsWith('on') || !allowedAttrs.has(name)) {
            element.removeAttribute(attribute.name);
            return;
        }
        if (name === 'href' && !isSafeAnchorHref(attribute.value)) {
            element.removeAttribute(attribute.name);
            return;
        }
        if (name === 'target' && attribute.value !== '_blank') {
            element.setAttribute('target', '_blank');
        }
        if (tag === 'img') {
            if (name === 'src') {
              const src = attribute.value.trim();
              if (!src) {
                  element.removeAttribute(attribute.name);
              }
              return;
            }
            if (name === 'width' || name === 'height') {
                const parsed = Number.parseInt(attribute.value, 10);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                    element.removeAttribute(attribute.name);
                    return;
                }
                element.setAttribute(attribute.name, String(parsed));
                return;
            }
            if (name === 'data-align') {
                const nextAlign = attribute.value.toLowerCase();
                if (nextAlign !== 'left' && nextAlign !== 'center' && nextAlign !== 'right') {
                    element.setAttribute(attribute.name, 'center');
                    return;
                }
                element.setAttribute(attribute.name, nextAlign);
            }
        }
    });
    if (tag === 'span' && element.getAttribute('data-hcm-inline-button') === 'true') {
        const payload = element.getAttribute('data-hcm-button-payload');
        if (!payload || !decodeLessonButtonPayload(payload)) {
            element.remove();
            return;
        }
        element.setAttribute('class', 'genflix-inline-button');
    }
    if (tag === 'img' && !(element.getAttribute('src')?.trim())) {
        element.remove();
        return;
    }
    if (tag === 'a') {
        const href = element.getAttribute('href');
        if (href) {
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noreferrer noopener');
        }
    }
    ;
    [...element.children].forEach((child) => sanitizeRichTextNode(child));
}
export function sanitizeRichTextHtml(html: string): string {
    const source = normalizeHtml(html);
    if (!source || !isBrowser()) {
        return source;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    removeDangerousNodes(doc);
    [...doc.body.children].forEach((child) => sanitizeRichTextNode(child));
    return normalizeHtml(doc.body.innerHTML);
}
export function sanitizeHotspotBodyHtml(bodyHtml: string): string {
    const source = normalizeHtml(bodyHtml);
    if (!source || !isBrowser()) {
        return source;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    removeDangerousNodes(doc);
    [...doc.body.children].forEach((child) => sanitizeHotspotBodyNode(child));
    return normalizeHtml(doc.body.innerHTML);
}
function normalizeHotspotItem(item: LessonImageHotspotItem, index: number): LessonImageHotspotItem {
    return {
        id: item.id.trim() || crypto.randomUUID(),
        x: roundPercent(clamp(Number(item.x) || 0, 0, 100)),
        y: roundPercent(clamp(Number(item.y) || 0, 0, 100)),
        title: item.title?.trim() || `Hotspot ${index + 1}`,
        body_html: sanitizeHotspotBodyHtml(item.body_html || '<p></p>'),
    };
}
function normalizeHotspotsAsset(asset: LessonImageHotspotsAsset): LessonImageHotspotsAsset {
    return {
        storage_path: asset.storage_path?.trim() || '',
        storage_provider: asset.storage_provider === 'supabase' || asset.storage_provider === 'r2' ? asset.storage_provider : undefined,
        signed_url: asset.signed_url?.trim() || null,
        alt: asset.alt?.trim() || 'Imagem interativa da aula',
        width: Math.max(1, Number(asset.width) || 1600),
        height: Math.max(1, Number(asset.height) || 900),
    };
}
export function normalizeLessonImageHotspotsBlockContent(content: LessonImageHotspotsBlockContent): LessonImageHotspotsBlockContent {
    return {
        asset: normalizeHotspotsAsset(content.asset),
        hotspots: (content.hotspots ?? []).map(normalizeHotspotItem),
    };
}
function parseHotspotsAsset(value: unknown): LessonImageHotspotsAsset | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Partial<LessonImageHotspotsAsset>;
    if (typeof candidate.storage_path !== 'string') {
        return null;
    }
    return normalizeHotspotsAsset({
        storage_path: candidate.storage_path,
        storage_provider: candidate.storage_provider === 'supabase' || candidate.storage_provider === 'r2' ? candidate.storage_provider : undefined,
        signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
        alt: typeof candidate.alt === 'string' ? candidate.alt : 'Imagem interativa da aula',
        width: Number(candidate.width) || 1600,
        height: Number(candidate.height) || 900,
    });
}
function parseHotspotItem(value: unknown, index: number): LessonImageHotspotItem | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Partial<LessonImageHotspotItem>;
    if (typeof candidate.id !== 'string') {
        return null;
    }
    return normalizeHotspotItem({
        id: candidate.id,
        x: Number(candidate.x) || 0,
        y: Number(candidate.y) || 0,
        title: typeof candidate.title === 'string' ? candidate.title : `Hotspot ${index + 1}`,
        body_html: typeof candidate.body_html === 'string' ? candidate.body_html : '<p></p>',
    }, index);
}
export function parseLessonImageHotspotsBlockContent(payload: unknown): LessonImageHotspotsBlockContent | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const candidate = payload as {
        asset?: unknown;
        hotspots?: unknown;
    };
    const asset = parseHotspotsAsset(candidate.asset);
    if (!asset) {
        return null;
    }
    const hotspots = Array.isArray(candidate.hotspots)
        ? candidate.hotspots
            .map((item, index) => parseHotspotItem(item, index))
            .filter((item): item is LessonImageHotspotItem => item !== null)
        : [];
    return {
        asset,
        hotspots,
    };
}
function normalizeLessonImageBlockContent(content: LessonImageBlockContent): LessonImageBlockContent {
    const sourceType = content.source_type === 'upload' ? 'upload' : 'url';
    return {
        source_type: sourceType,
        image_url: sourceType === 'url' ? content.image_url?.trim() || '' : '',
        storage_path: sourceType === 'upload' ? content.storage_path?.trim() || '' : '',
        storage_provider: sourceType === 'upload' && (content.storage_provider === 'supabase' || content.storage_provider === 'r2')
            ? content.storage_provider
            : undefined,
        signed_url: sourceType === 'upload' ? content.signed_url?.trim() || null : null,
        file_name: sourceType === 'upload' ? content.file_name?.trim() || '' : '',
        mime_type: sourceType === 'upload' ? content.mime_type?.trim() || null : null,
        alt: content.alt?.trim() || 'Imagem da aula',
        size: content.size === 'sm' || content.size === 'md' || content.size === 'lg' || content.size === 'full'
            ? content.size
            : 'md',
        caption: content.caption?.trim() || '',
        caption_alignment: content.caption_alignment === 'center' || content.caption_alignment === 'right'
            ? content.caption_alignment
            : 'left',
        media_asset_id: content.media_asset_id?.trim() || undefined,
    };
}
export function createEmptyLessonImageBlockContent(): LessonImageBlockContent {
    return normalizeLessonImageBlockContent({
        source_type: 'url',
        image_url: '',
        storage_path: '',
        storage_provider: undefined,
        signed_url: null,
        file_name: '',
        mime_type: null,
        alt: 'Imagem da aula',
        size: 'md',
        caption: '',
        caption_alignment: 'left',
    });
}
function parseLessonImageBlockContent(payload: unknown): LessonImageBlockContent | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const candidate = payload as Partial<LessonImageBlockContent>;
    const sourceType = candidate.source_type === 'upload' || candidate.source_type === 'url'
        ? candidate.source_type
        : typeof candidate.storage_path === 'string' && candidate.storage_path.trim()
            ? 'upload'
            : 'url';
    if (sourceType === 'url' && typeof candidate.image_url !== 'string') {
        return null;
    }
    return normalizeLessonImageBlockContent({
        source_type: sourceType,
        image_url: typeof candidate.image_url === 'string' ? candidate.image_url : '',
        storage_path: typeof candidate.storage_path === 'string' ? candidate.storage_path : '',
        storage_provider: candidate.storage_provider === 'supabase' || candidate.storage_provider === 'r2' ? candidate.storage_provider : undefined,
        signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
        file_name: typeof candidate.file_name === 'string' ? candidate.file_name : '',
        mime_type: typeof candidate.mime_type === 'string' ? candidate.mime_type : null,
        alt: typeof candidate.alt === 'string' ? candidate.alt : 'Imagem da aula',
        size: candidate.size === 'sm' || candidate.size === 'md' || candidate.size === 'lg' || candidate.size === 'full'
            ? candidate.size
            : 'md',
        caption: typeof candidate.caption === 'string' ? candidate.caption : '',
        caption_alignment: candidate.caption_alignment === 'center' || candidate.caption_alignment === 'right'
            ? candidate.caption_alignment
            : 'left',
    });
}
function normalizeLessonVideoBlockContent(content: LessonVideoBlockContent): LessonVideoBlockContent {
    return {
        source_type: content.source_type === 'upload' ? 'upload' : 'url',
        url: content.url?.trim() || '',
        storage_path: content.storage_path?.trim() || '',
        storage_provider: content.source_type === 'upload' && (content.storage_provider === 'supabase' || content.storage_provider === 'r2')
            ? content.storage_provider
            : undefined,
        signed_url: content.signed_url?.trim() || null,
        file_name: content.file_name?.trim() || '',
        mime_type: content.mime_type?.trim() || null,
        caption: content.caption?.trim() || '',
        size: content.size === 'sm' || content.size === 'md' || content.size === 'lg' || content.size === 'full'
            ? content.size
            : 'md',
        caption_alignment: content.caption_alignment === 'center' || content.caption_alignment === 'right'
            ? content.caption_alignment
            : 'left',
    };
}
export function createEmptyLessonVideoBlockContent(): LessonVideoBlockContent {
    return normalizeLessonVideoBlockContent({
        source_type: 'url',
        url: '',
        storage_path: '',
        storage_provider: undefined,
        signed_url: null,
        file_name: '',
        mime_type: null,
        caption: '',
        size: 'md',
        caption_alignment: 'left',
    });
}
function normalizeLessonHtmlBlockContent(content: LessonHtmlBlockContent): LessonHtmlBlockContent {
    return {
        source_type: content.source_type === 'upload' ? 'upload' : 'paste',
        html: normalizeHtml(content.html || ''),
        storage_path: content.source_type === 'upload' ? content.storage_path?.trim() || '' : '',
        storage_provider: content.source_type === 'upload' && (content.storage_provider === 'supabase' || content.storage_provider === 'r2')
            ? content.storage_provider
            : undefined,
        signed_url: content.source_type === 'upload' ? content.signed_url?.trim() || null : null,
        file_name: content.source_type === 'upload' ? content.file_name?.trim() || '' : '',
        mime_type: content.source_type === 'upload' ? content.mime_type?.trim() || null : null,
    };
}
export function createEmptyLessonHtmlBlockContent(): LessonHtmlBlockContent {
    return normalizeLessonHtmlBlockContent({
        source_type: 'paste',
        html: '<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Apresentação</title>\n  </head>\n  <body>\n    <div style="font-family: sans-serif; padding: 48px;">Sua apresentação HTML entra aqui.</div>\n  </body>\n</html>',
        storage_path: '',
        storage_provider: undefined,
        signed_url: null,
        file_name: '',
        mime_type: null,
    });
}
function normalizeLessonSvgBlockContent(content: LessonSvgBlockContent): LessonSvgBlockContent {
    return {
        source_type: content.source_type === 'upload' ? 'upload' : 'url',
        url: content.source_type === 'url' ? content.url?.trim() || '' : '',
        storage_path: content.source_type === 'upload' ? content.storage_path?.trim() || '' : '',
        storage_provider: content.source_type === 'upload' && (content.storage_provider === 'supabase' || content.storage_provider === 'r2')
            ? content.storage_provider
            : undefined,
        signed_url: content.source_type === 'upload' ? content.signed_url?.trim() || null : null,
        file_name: content.source_type === 'upload' ? content.file_name?.trim() || '' : '',
        mime_type: content.source_type === 'upload' ? content.mime_type?.trim() || 'image/svg+xml' : null,
        alt: content.alt?.trim() || 'GrÃ¡fico SVG da aula',
        size: content.size === 'sm' || content.size === 'md' || content.size === 'lg' || content.size === 'full'
            ? content.size
            : 'full',
        caption: content.caption?.trim() || '',
        caption_alignment: content.caption_alignment === 'center' || content.caption_alignment === 'right'
            ? content.caption_alignment
            : 'left',
    };
}
export function createEmptyLessonSvgBlockContent(): LessonSvgBlockContent {
    return normalizeLessonSvgBlockContent({
        source_type: 'upload',
        url: '',
        storage_path: '',
        storage_provider: undefined,
        signed_url: null,
        file_name: '',
        mime_type: 'image/svg+xml',
        alt: 'GrÃ¡fico SVG da aula',
        size: 'full',
        caption: '',
        caption_alignment: 'left',
    });
}
function parseLessonHtmlBlockContent(payload: unknown): LessonHtmlBlockContent | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const candidate = payload as Partial<LessonHtmlBlockContent>;
    const sourceType = candidate.source_type === 'upload' ? 'upload' : candidate.source_type === 'paste' ? 'paste' : null;
    if (!sourceType) {
        return null;
    }
    return normalizeLessonHtmlBlockContent({
        source_type: sourceType,
        html: typeof candidate.html === 'string' ? candidate.html : '',
        storage_path: typeof candidate.storage_path === 'string' ? candidate.storage_path : '',
        storage_provider: candidate.storage_provider === 'supabase' || candidate.storage_provider === 'r2' ? candidate.storage_provider : undefined,
        signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
        file_name: typeof candidate.file_name === 'string' ? candidate.file_name : '',
        mime_type: typeof candidate.mime_type === 'string' ? candidate.mime_type : null,
    });
}
function parseLessonSvgBlockContent(payload: unknown): LessonSvgBlockContent | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const candidate = payload as Partial<LessonSvgBlockContent>;
    const sourceType = candidate.source_type === 'upload' || candidate.source_type === 'url'
        ? candidate.source_type
        : typeof candidate.storage_path === 'string' && candidate.storage_path.trim()
            ? 'upload'
            : 'url';
    if (sourceType === 'url' && typeof candidate.url !== 'string') {
        return null;
    }
    return normalizeLessonSvgBlockContent({
        source_type: sourceType,
        url: typeof candidate.url === 'string' ? candidate.url : '',
        storage_path: typeof candidate.storage_path === 'string' ? candidate.storage_path : '',
        storage_provider: candidate.storage_provider === 'supabase' || candidate.storage_provider === 'r2' ? candidate.storage_provider : undefined,
        signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
        file_name: typeof candidate.file_name === 'string' ? candidate.file_name : '',
        mime_type: typeof candidate.mime_type === 'string' ? candidate.mime_type : 'image/svg+xml',
        alt: typeof candidate.alt === 'string' ? candidate.alt : 'GrÃ¡fico SVG da aula',
        size: candidate.size === 'sm' || candidate.size === 'md' || candidate.size === 'lg' || candidate.size === 'full'
            ? candidate.size
            : 'full',
        caption: typeof candidate.caption === 'string' ? candidate.caption : '',
        caption_alignment: candidate.caption_alignment === 'center' || candidate.caption_alignment === 'right'
            ? candidate.caption_alignment
            : 'left',
    });
}
function encodeHtmlPayload(content: LessonHtmlBlockContent): string {
    return encodeURIComponent(JSON.stringify({
        source_type: content.source_type,
        html: content.html,
        storage_path: content.storage_path,
        storage_provider: content.storage_provider,
        signed_url: content.signed_url,
        file_name: content.file_name,
        mime_type: content.mime_type,
    }));
}
function decodeHtmlPayload(encodedPayload: string): LessonHtmlBlockContent | null {
    try {
        const decoded = decodeURIComponent(encodedPayload);
        return parseLessonHtmlBlockContent(JSON.parse(decoded));
    }
    catch {
        return null;
    }
}
function buildHtmlFallbackHtml(content: LessonHtmlBlockContent): string {
    const label = content.source_type === 'upload'
        ? `Arquivo HTML${content.file_name ? `: ${escapeHtml(content.file_name)}` : ''}`
        : 'HTML colado';
    return `
    <div class="hcm-html-block-fallback">
      <p><strong>${label}.</strong></p>
      <p>A prévia interativa é renderizada no player da aula.</p>
    </div>
  `;
}
export function serializeLessonHtmlBlock(content: LessonHtmlBlockContent): string {
    const normalized = normalizeLessonHtmlBlockContent(content);
    const payload = encodeHtmlPayload(normalized);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_HTML_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildHtmlFallbackHtml(normalized)}
    </div>
  `;
}
function encodeSvgPayload(content: LessonSvgBlockContent): string {
    return encodeURIComponent(JSON.stringify({
        source_type: content.source_type,
        url: content.url,
        storage_path: content.storage_path,
        storage_provider: content.storage_provider,
        signed_url: content.signed_url,
        file_name: content.file_name,
        mime_type: content.mime_type,
        alt: content.alt,
        size: content.size,
        caption: content.caption,
        caption_alignment: content.caption_alignment,
    }));
}
function decodeSvgPayload(encodedPayload: string): LessonSvgBlockContent | null {
    try {
        const decoded = decodeURIComponent(encodedPayload);
        return parseLessonSvgBlockContent(JSON.parse(decoded));
    }
    catch {
        return null;
    }
}
function buildSvgFallbackHtml(content: LessonSvgBlockContent): string {
    const label = content.source_type === 'upload'
        ? `Arquivo SVG${content.file_name ? `: ${escapeHtml(content.file_name)}` : ''}`
        : 'SVG via URL';
    return `
    <div class="hcm-svg-block-fallback">
      <p><strong>${label}.</strong></p>
      <p>O visualizador interativo de SVG Ã© carregado no player da aula.</p>
    </div>
  `;
}
export function serializeLessonSvgBlock(content: LessonSvgBlockContent): string {
    const normalized = normalizeLessonSvgBlockContent(content);
    const payload = encodeSvgPayload(normalized);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_SVG_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildSvgFallbackHtml(normalized)}
    </div>
  `;
}
function extractLessonSvgBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeSvgPayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'svg',
        content,
    };
}
export function parseLessonSvgBlockElement(element: Element): LessonSvgBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_SVG_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    return payload ? decodeSvgPayload(payload) : null;
}
function extractLessonHtmlBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeHtmlPayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'html',
        content,
    };
}
export function parseLessonHtmlBlockElement(element: Element): LessonHtmlBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_HTML_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    return decodeHtmlPayload(payload);
}
export function createEmptyColumnsBlockContent(columnsCount = 2): LessonColumnsBlockContent {
    const safeCount = clamp(columnsCount, 1, 4);
    const widths = buildEqualColumnWidths(safeCount);
    return Array.from({ length: safeCount }, (_, index) => ({
        width: widths[index] ?? widths[0] ?? 100,
        blocks: createFallbackBlock('<p></p>'),
    }));
}
function parseLessonVideoBlockContent(payload: unknown): LessonVideoBlockContent | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const candidate = payload as Partial<LessonVideoBlockContent>;
    const sourceType = candidate.source_type === 'upload' ? 'upload' : candidate.source_type === 'url' ? 'url' : null;
    if (!sourceType) {
        return null;
    }
    if (sourceType === 'url' && typeof candidate.url !== 'string') {
        return null;
    }
    return normalizeLessonVideoBlockContent({
        source_type: sourceType,
        url: typeof candidate.url === 'string' ? candidate.url : '',
        storage_path: typeof candidate.storage_path === 'string' ? candidate.storage_path : '',
        storage_provider: candidate.storage_provider === 'supabase' || candidate.storage_provider === 'r2' ? candidate.storage_provider : undefined,
        signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
        file_name: typeof candidate.file_name === 'string' ? candidate.file_name : '',
        mime_type: typeof candidate.mime_type === 'string' ? candidate.mime_type : null,
        caption: typeof candidate.caption === 'string' ? candidate.caption : '',
        size: candidate.size === 'sm' || candidate.size === 'md' || candidate.size === 'lg' || candidate.size === 'full'
            ? candidate.size
            : 'md',
        caption_alignment: candidate.caption_alignment === 'center' || candidate.caption_alignment === 'right'
            ? candidate.caption_alignment
            : 'left',
    });
}
export function createEmptyLessonImageHotspotsBlockContent(): LessonImageHotspotsBlockContent {
    return {
        asset: {
            storage_path: '',
            storage_provider: undefined,
            signed_url: null,
            alt: 'Imagem interativa da aula',
            width: 1600,
            height: 900,
        },
        hotspots: [],
    };
}
function encodeHotspotsPayload(content: LessonImageHotspotsBlockContent): string {
    return encodeURIComponent(JSON.stringify({
        asset: {
            storage_path: content.asset.storage_path,
            storage_provider: content.asset.storage_provider,
            alt: content.asset.alt,
            width: content.asset.width,
            height: content.asset.height,
        },
        hotspots: content.hotspots.map((hotspot) => ({
            id: hotspot.id,
            x: hotspot.x,
            y: hotspot.y,
            title: hotspot.title,
            body_html: sanitizeHotspotBodyHtml(hotspot.body_html),
        })),
    }));
}
function decodeHotspotsPayload(encodedPayload: string): LessonImageHotspotsBlockContent | null {
    try {
        const decoded = decodeURIComponent(encodedPayload);
        return parseLessonImageHotspotsBlockContent(JSON.parse(decoded));
    }
    catch {
        return null;
    }
}
function buildHotspotsFallbackHtml(content: LessonImageHotspotsBlockContent): string {
    const titles = content.hotspots
        .map((hotspot) => `<li>${escapeHtml(hotspot.title)}</li>`)
        .join('');
    return `
    <div class="hcm-image-hotspots-fallback">
      <p><strong>Bloco interativo de imagem.</strong></p>
      ${titles ? `<ul>${titles}</ul>` : '<p>Nenhum hotspot configurado.</p>'}
    </div>
  `;
}
type LegacyLessonColumnsBlockContent = LessonContentBlock[][];
function normalizeColumnsContent(columns: LessonColumnsBlockContent | LegacyLessonColumnsBlockContent, fallbackCount = 2): LessonColumnsBlockContent {
    const safeFallbackCount = clamp(fallbackCount, 1, 4);
    const normalized = columns
        .slice(0, 4)
        .map((column) => {
        if (Array.isArray(column)) {
            return {
                width: 0,
                blocks: column.length > 0 ? column : createFallbackBlock('<p></p>'),
            };
        }
        return {
            width: Number.isFinite(column.width) ? column.width : 0,
            blocks: Array.isArray(column.blocks) && column.blocks.length > 0 ? column.blocks : createFallbackBlock('<p></p>'),
        };
    });
    const withFallback = normalized.length > 0
        ? normalized
        : Array.from({ length: safeFallbackCount }, () => ({
            width: 0,
            blocks: createFallbackBlock('<p></p>'),
        }));
    while (withFallback.length < safeFallbackCount) {
        withFallback.push({
            width: 0,
            blocks: createFallbackBlock('<p></p>'),
        });
    }
    const widths = withFallback.map((column) => column.width);
    const resolvedWidths = widths.length === withFallback.length && widths.every((value) => Number.isFinite(value) && value > 0)
        ? (() => {
            const totalWidth = widths.reduce((sum, value) => sum + value, 0);
            if (totalWidth <= 0) {
                return buildEqualColumnWidths(withFallback.length);
            }
            const normalizedWidths = widths.map((value) => Number.parseFloat(((value / totalWidth) * 100).toFixed(2)));
            const normalizedTotal = normalizedWidths.reduce((sum, value) => sum + value, 0);
            normalizedWidths[normalizedWidths.length - 1] = Number.parseFloat((normalizedWidths[normalizedWidths.length - 1] + (100 - normalizedTotal)).toFixed(2));
            return normalizedWidths;
        })()
        : buildEqualColumnWidths(withFallback.length);
    return withFallback.map((column, index) => ({
        width: resolvedWidths[index] ?? resolvedWidths[0] ?? 100,
        blocks: column.blocks,
    }));
}
export function getColumnsTemplateValue(columns: LessonColumnsBlockContent): string {
    return columns.map((column) => `${column.width}%`).join(' ');
}
export function getColumnsWidthsAttributeValue(columns: LessonColumnsBlockContent): string {
    return columns.map((column) => column.width.toFixed(2).replace(/\.00$/, '')).join(', ');
}
function extractColumnsContent(element: Element): LessonColumnsBlockContent {
    const columns = Array.from(element.children)
        .filter((child): child is HTMLElement => (child instanceof HTMLElement && child.classList.contains('genflix-column')))
        .map((column) => splitContent(normalizeHtml(column.innerHTML)));
    const requestedCount = clamp(Number.parseInt(element.getAttribute(LESSON_COLUMNS_BLOCK_COUNT_ATTR) ?? '', 10) || columns.length || 2, 1, 4);
    const widths = (element.getAttribute(LESSON_COLUMNS_BLOCK_WIDTHS_ATTR) ?? '')
        .split(',')
        .map((part) => Number.parseFloat(part.trim().replace('%', '')))
        .filter((value) => Number.isFinite(value) && value > 0);
    const columnsWithWidths = columns.map((blocks, index) => ({
        width: widths[index] ?? 0,
        blocks,
    }));
    return normalizeColumnsContent(columnsWithWidths, requestedCount);
}
function isColumnsBlockElement(element: Element): boolean {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) === LESSON_COLUMNS_BLOCK_TYPE) {
        return true;
    }
    return (element.classList.contains('genflix-columns')
        && Array.from(element.children).some((child) => (child instanceof HTMLElement && child.classList.contains('genflix-column'))));
}
function serializeLessonColumnsBlock(columns: LessonColumnsBlockContent): string {
    const normalizedColumns = normalizeColumnsContent(columns);
    const count = clamp(normalizedColumns.length, 1, 4);
    const widthsValue = getColumnsWidthsAttributeValue(normalizedColumns);
    const templateValue = getColumnsTemplateValue(normalizedColumns);
    const columnsHtml = normalizedColumns
        .slice(0, count)
        .map((column) => `<div class="genflix-column">${mergeContent(column.blocks) || '<p></p>'}</div>`)
        .join('');
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_COLUMNS_BLOCK_TYPE}"
      ${LESSON_COLUMNS_BLOCK_COUNT_ATTR}="${count}"
      ${LESSON_COLUMNS_BLOCK_WIDTHS_ATTR}="${widthsValue}"
      style="--hcm-columns-template: ${templateValue};"
      class="genflix-columns genflix-columns-${count}"
    >
      ${columnsHtml}
    </div>
  `;
}
function extractLessonColumnsBlock(element: Element): LessonContentBlock | null {
    if (!isColumnsBlockElement(element)) {
        return null;
    }
    const columns = extractColumnsContent(element);
    return {
        type: 'columns',
        content: columns,
    };
}
function encodeImagePayload(content: LessonImageBlockContent): string {
    return encodeURIComponent(JSON.stringify({
        source_type: content.source_type,
        image_url: content.image_url,
        storage_path: content.storage_path,
        storage_provider: content.storage_provider,
        signed_url: content.signed_url,
        file_name: content.file_name,
        mime_type: content.mime_type,
        alt: content.alt,
        size: content.size,
        caption: content.caption,
        caption_alignment: content.caption_alignment,
    }));
}
function decodeImagePayload(encodedPayload: string): LessonImageBlockContent | null {
    try {
        const decoded = decodeURIComponent(encodedPayload);
        return parseLessonImageBlockContent(JSON.parse(decoded));
    }
    catch {
        return null;
    }
}
function buildImageFallbackHtml(content: LessonImageBlockContent): string {
    const caption = content.caption.trim();
    const captionAlignment = content.caption_alignment === 'center'
        ? 'center'
        : content.caption_alignment === 'right'
            ? 'right'
            : 'left';
    const imageUrl = content.source_type === 'upload'
        ? (content.signed_url?.trim() || '')
        : content.image_url.trim();
    return `
    <figure class="hcm-image-block-fallback">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(content.alt)}" />` : '<div class="hcm-image-block-fallback__placeholder">Imagem sem URL configurada.</div>'}
      ${caption ? `<figcaption style="text-align: ${captionAlignment};">${escapeHtml(caption)}</figcaption>` : ''}
    </figure>
  `;
}
export function serializeLessonImageBlock(content: LessonImageBlockContent): string {
    const normalized = normalizeLessonImageBlockContent(content);
    const payload = encodeImagePayload(normalized);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_IMAGE_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildImageFallbackHtml(normalized)}
    </div>
  `;
}
function extractLessonImageBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeImagePayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'image',
        content,
    };
}
export function parseLessonImageBlockElement(element: Element): LessonImageBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_IMAGE_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    return decodeImagePayload(payload);
}
function encodeVideoPayload(content: LessonVideoBlockContent): string {
    return encodeURIComponent(JSON.stringify({
        source_type: content.source_type,
        url: content.url,
        storage_path: content.storage_path,
        storage_provider: content.storage_provider,
        signed_url: content.signed_url,
        file_name: content.file_name,
        mime_type: content.mime_type,
        caption: content.caption,
        size: content.size,
        caption_alignment: content.caption_alignment,
    }));
}
function decodeVideoPayload(encodedPayload: string): LessonVideoBlockContent | null {
    try {
        const decoded = decodeURIComponent(encodedPayload);
        return parseLessonVideoBlockContent(JSON.parse(decoded));
    }
    catch {
        return null;
    }
}
function buildVideoFallbackHtml(content: LessonVideoBlockContent): string {
    const caption = content.caption.trim();
    const fileName = content.file_name.trim();
    const maxWidthStyle = LESSON_VIDEO_MAX_WIDTH_STYLE[content.size];
    const captionAlignment = LESSON_VIDEO_CAPTION_ALIGNMENT_STYLE[content.caption_alignment];
    const summary = content.source_type === "upload"
        ? `Vídeo enviado${fileName ? `: ${escapeHtml(fileName)}` : ''}.`
        : 'Vídeo por URL.';
    return `
    <figure class="hcm-video-block-fallback" style="${maxWidthStyle} margin: 2rem auto;">
      <div class="hcm-video-block-fallback__surface">${summary}</div>
      ${caption ? `<figcaption style="text-align: ${captionAlignment};">${escapeHtml(caption)}</figcaption>` : ""}
    </figure>
  `;
}
export function serializeLessonVideoBlock(content: LessonVideoBlockContent): string {
    const normalized = normalizeLessonVideoBlockContent(content);
    const payload = encodeVideoPayload(normalized);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_VIDEO_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildVideoFallbackHtml(normalized)}
    </div>
  `;
}
function extractLessonVideoBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeVideoPayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'video',
        content,
    };
}
export function parseLessonVideoBlockElement(element: Element): LessonVideoBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_VIDEO_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    return decodeVideoPayload(payload);
}
export function serializeLessonImageHotspotsBlock(content: LessonImageHotspotsBlockContent): string {
    const normalized = normalizeLessonImageHotspotsBlockContent(content);
    const payload = encodeHotspotsPayload(normalized);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildHotspotsFallbackHtml(normalized)}
    </div>
  `;
}
function extractLessonImageHotspotsBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeHotspotsPayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'image-hotspots',
        content,
    };
}
export function parseLessonImageHotspotsBlockElement(element: Element): LessonImageHotspotsBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    return decodeHotspotsPayload(payload);
}
function normalizeFlashcardItem(item: Partial<LessonFlashcardItem> & { front?: unknown; back?: unknown }, index: number): LessonFlashcardItem {
    const rawQuestion = typeof item.question === 'string' ? item.question : (typeof item.front === 'string' ? item.front : '');
    const rawAnswer = typeof item.answer === 'string' ? item.answer : (typeof item.back === 'string' ? item.back : '');
    const imageUrl = typeof item.image_url === 'string' ? item.image_url.trim() : undefined;
    const imageAlt = typeof item.image_alt === 'string' ? item.image_alt.trim() : undefined;
    const mediaAssetId = typeof item.media_asset_id === 'string' ? item.media_asset_id.trim() : undefined;
    const allowStudentAnswer = Boolean(item.allow_student_answer);

    return {
        id: item.id?.trim() || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `card-${index + 1}`),
        question: rawQuestion.trim(),
        answer: rawAnswer.trim(),
        image_url: imageUrl || undefined,
        image_alt: imageAlt || undefined,
        media_asset_id: mediaAssetId || undefined,
        allow_student_answer: allowStudentAnswer,
    };
}
export function normalizeLessonFlashcardsBlockContent(content: LessonFlashcardsBlockContent): LessonFlashcardsBlockContent {
    return {
        title: content.title?.trim() || 'Flashcards de Memorização',
        description: content.description?.trim() || '',
        cards: Array.isArray(content.cards)
            ? content.cards.map((card, index) => normalizeFlashcardItem(card, index))
            : [],
    };
}
export function createEmptyLessonFlashcardsBlockContent(): LessonFlashcardsBlockContent {
    return {
        title: 'Flashcards de Memorização',
        description: 'Teste sua memória com os cartões a seguir. Leia a pergunta, pense na resposta e clique no cartão para conferir.',
        cards: [
            {
                id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'card-1',
                question: '',
                answer: '',
            },
        ],
    };
}
function parseFlashcardItem(value: unknown, index: number): LessonFlashcardItem | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Partial<LessonFlashcardItem>;
    return normalizeFlashcardItem(candidate, index);
}
export function parseLessonFlashcardsBlockContent(payload: unknown): LessonFlashcardsBlockContent | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const candidate = payload as Partial<LessonFlashcardsBlockContent>;
    const cards = Array.isArray(candidate.cards)
        ? candidate.cards
            .map((item, index) => parseFlashcardItem(item, index))
            .filter((item): item is LessonFlashcardItem => item !== null)
        : [];
    return normalizeLessonFlashcardsBlockContent({
        title: typeof candidate.title === 'string' ? candidate.title : undefined,
        description: typeof candidate.description === 'string' ? candidate.description : undefined,
        cards,
    });
}
function encodeFlashcardsPayload(content: LessonFlashcardsBlockContent): string {
    return encodeURIComponent(JSON.stringify({
        title: content.title,
        description: content.description,
        cards: content.cards.map((card) => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            image_url: card.image_url,
            image_alt: card.image_alt,
            media_asset_id: card.media_asset_id,
            allow_student_answer: card.allow_student_answer,
        })),
    }));
}
function decodeFlashcardsPayload(encodedPayload: string): LessonFlashcardsBlockContent | null {
    try {
        const decoded = decodeURIComponent(encodedPayload);
        return parseLessonFlashcardsBlockContent(JSON.parse(decoded));
    }
    catch {
        return null;
    }
}
function buildFlashcardsFallbackHtml(content: LessonFlashcardsBlockContent): string {
    const title = escapeHtml(content.title || 'Flashcards de Memorização');
    const items = content.cards
        .map((card, index) => `
          <div class="hcm-flashcard-fallback-item" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem;">
            ${card.image_url ? `<div style="margin-bottom: 0.5rem;"><img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.image_alt || '')}" style="max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 0.5rem;" /></div>` : ''}
            <p><strong>Cartão ${index + 1} - Pergunta:</strong> ${escapeHtml(card.question)}</p>
            ${card.allow_student_answer ? `<p style="color: #64748b; font-size: 0.875rem;"><em>[Resposta do aluno habilitada]</em></p>` : ''}
            <p><strong>Resposta:</strong> ${escapeHtml(card.answer)}</p>
          </div>
        `)
        .join('');
    return `
    <div class="hcm-flashcards-block-fallback" style="margin: 2rem 0; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 1rem; background: #f8fafc;">
      <p style="font-size: 1.125rem; font-weight: bold; margin-bottom: 1rem;"><strong>${title}</strong></p>
      ${items || '<p>Nenhum cartão configurado.</p>'}
    </div>
  `;
}
export function serializeLessonFlashcardsBlock(content: LessonFlashcardsBlockContent): string {
    const normalized = normalizeLessonFlashcardsBlockContent(content);
    const payload = encodeFlashcardsPayload(normalized);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_FLASHCARDS_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildFlashcardsFallbackHtml(normalized)}
    </div>
  `;
}
function extractLessonFlashcardsBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeFlashcardsPayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'flashcards',
        content,
    };
}
export function parseLessonFlashcardsBlockElement(element: Element): LessonFlashcardsBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_FLASHCARDS_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    return decodeFlashcardsPayload(payload);
}

export function createEmptyLessonButtonBlockContent(): LessonButtonBlockContent {
    return {
        source_type: 'local',
        alignment: 'left',
        width: 'auto',
        local_config: {
            template_id: null,
            label: 'Clique aqui',
            variant: 'outline',
            theme: 'blue',
            icon: 'link',
            action_type: 'url',
            url: 'https://',
            open_target: 'new-tab',
            storage_path: null,
            file_name: null,
            mime_type: null,
            file_size_bytes: 0,
            modal: null,
        },
        global_button_id: null,
        cached_action: null,
    };
}
export function encodeLessonButtonPayload(content: LessonButtonBlockContent): string {
    return encodeURIComponent(JSON.stringify(content));
}
export function decodeLessonButtonPayload(payload: string): LessonButtonBlockContent | null {
    try {
        const parsed = JSON.parse(decodeURIComponent(payload)) as LessonButtonBlockContent;
        if (!parsed || (parsed.source_type !== 'local' && parsed.source_type !== 'global')) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function buildButtonFallbackHtml(content: LessonButtonBlockContent): string {
    const label = content.local_config?.label || content.cached_action?.label || 'Botão';
    const rawUrl = content.local_config?.url || content.cached_action?.url;
    const url = rawUrl && isSafeAnchorHref(rawUrl) ? rawUrl : null;
    if (url) {
        return `<div class="genflix-button-block-fallback" style="margin: 1rem 0; text-align: ${content.alignment || 'left'};"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 0.6rem 1.25rem; border-radius: 0.75rem; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; font-weight: bold; text-decoration: none;">${escapeHtml(label)}</a></div>`;
    }
    return `<div class="genflix-button-block-fallback" style="margin: 1rem 0; text-align: ${content.alignment || 'left'};"><span style="display: inline-block; padding: 0.6rem 1.25rem; border-radius: 0.75rem; border: 1px solid #cbd5e1; background: #f8fafc; color: #64748b; font-weight: bold;">${escapeHtml(label)}</span></div>`;
}
export function serializeLessonButtonBlock(content: LessonButtonBlockContent): string {
    const payload = encodeLessonButtonPayload(content);
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_BUTTON_BLOCK_TYPE}"
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR}="${payload}"
    >
      ${buildButtonFallbackHtml(content)}
    </div>
  `;
}
function extractLessonButtonBlock(element: Element): LessonContentBlock | null {
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    const content = decodeLessonButtonPayload(payload);
    if (!content) {
        return null;
    }
    return {
        type: 'button',
        content,
    };
}
export function parseLessonButtonBlockElement(element: Element): LessonButtonBlockContent | null {
    if (element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR) !== LESSON_BUTTON_BLOCK_TYPE) {
        return null;
    }
    const payload = element.getAttribute(LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR);
    if (!payload) {
        return null;
    }
    return decodeLessonButtonPayload(payload);
}

export function parseInlineLessonButtonElement(element: Element): LessonButtonBlockContent | null {
    if (element.getAttribute('data-hcm-inline-button') !== 'true') {
        return null;
    }
    const payload = element.getAttribute('data-hcm-button-payload');
    return payload ? decodeLessonButtonPayload(payload) : null;
}
/**
 * Sanitiza uma tabela preservando apenas estrutura segura e atributos mínimos.
 * Remove qualquer tag fora da whitelist em vez de "desembrulhar" de forma agressiva.
 */
export function sanitizeTableHtml(tableHtml: string): string {
    if (!isBrowser()) {
        return tableHtml;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(tableHtml, 'text/html');
    const table = doc.querySelector('table');
    if (!table) {
        return '';
    }
    removeDangerousNodes(doc);
    const sanitizeElement = (el: Element): void => {
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TABLE_TAGS.has(tag)) {
            el.remove();
            return;
        }
        ;
        [...el.attributes].forEach((attr) => {
            const attrName = attr.name.toLowerCase();
            if (attrName === 'style'
                || attrName.startsWith('on')
                || !ALLOWED_TABLE_ATTRS.has(attrName)) {
                el.removeAttribute(attr.name);
            }
        });
        [...el.children].forEach((child) => {
            sanitizeElement(child);
        });
    };
    sanitizeElement(table);
    table.querySelectorAll('*').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TABLE_TAGS.has(tag)) {
            el.remove();
        }
    });
    table.querySelectorAll('th, td').forEach((cell) => {
        const hasChildElements = cell.children.length > 0;
        const cellText = cell.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
        if (!hasChildElements && cellText === '') {
            cell.setAttribute('data-empty-cell', 'true');
        }
        else {
            cell.removeAttribute('data-empty-cell');
        }
    });
    return table.outerHTML;
}
/**
 * Extrai blocos especiais do HTML preservando a ordem do conteúdo.
 */
export function splitContent(html: string): LessonContentBlock[] {
    const source = normalizeHtml(html);
    if (!source) {
        return [];
    }
    if (!isBrowser()) {
        return createFallbackBlock(source);
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    const originalHadTable = hasTableLikeMarkup(source);
    const parsedTables = Array.from(doc.querySelectorAll('table'));
    if (originalHadTable && parsedTables.length === 0) {
        return createFallbackBlock(source);
    }
    removeDangerousNodes(doc);
    const blockMap = new Map<string, LessonContentBlock>();
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_COLUMNS_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected || !isColumnsBlockElement(element)) {
            return;
        }
        const placeholder = `${COLUMNS_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonColumnsBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${HOTSPOTS_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonImageHotspotsBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_IMAGE_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${IMAGE_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonImageBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_VIDEO_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${VIDEO_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonVideoBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_HTML_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${HTML_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonHtmlBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_SVG_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${SVG_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonSvgBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_FLASHCARDS_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${FLASHCARDS_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonFlashcardsBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    Array.from(doc.querySelectorAll(`[${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_BUTTON_BLOCK_TYPE}"]`))
        .forEach((element, index) => {
        if (!element.isConnected) {
            return;
        }
        const placeholder = `${BUTTON_PLACEHOLDER_PREFIX}_${index}__`;
        const parsedBlock = extractLessonButtonBlock(element);
        blockMap.set(placeholder, parsedBlock ?? {
            type: 'rich-text',
            content: normalizeHtml((element as HTMLElement).innerHTML),
        });
        const marker = doc.createTextNode(placeholder);
        element.replaceWith(marker);
    });
    const tableMap = new Map<string, string>();
    Array.from(doc.querySelectorAll('table')).forEach((table, index) => {
        const placeholder = `${TABLE_PLACEHOLDER_PREFIX}_${index}__`;
        const sanitizedTable = sanitizeTableHtml(table.outerHTML);
        tableMap.set(placeholder, sanitizedTable || table.outerHTML);
        const marker = doc.createTextNode(placeholder);
        table.replaceWith(marker);
    });
    const rawHtml = doc.body.innerHTML;
    if (!rawHtml) {
        return [];
    }
    const blocks: LessonContentBlock[] = [];
    const placeholderRegex = new RegExp(`(${TABLE_PLACEHOLDER_PREFIX}_\\d+__|${HOTSPOTS_PLACEHOLDER_PREFIX}_\\d+__|${FLASHCARDS_PLACEHOLDER_PREFIX}_\\d+__|${HTML_PLACEHOLDER_PREFIX}_\\d+__|${SVG_PLACEHOLDER_PREFIX}_\\d+__|${COLUMNS_PLACEHOLDER_PREFIX}_\\d+__|${IMAGE_PLACEHOLDER_PREFIX}_\\d+__|${VIDEO_PLACEHOLDER_PREFIX}_\\d+__|${BUTTON_PLACEHOLDER_PREFIX}_\\d+__)`, 'g');
    const parts = rawHtml.split(placeholderRegex);
    for (const part of parts) {
        if (!part)
            continue;
        const mappedBlock = blockMap.get(part);
        if (mappedBlock) {
            blocks.push(mappedBlock);
            continue;
        }
        if (tableMap.has(part)) {
            blocks.push({
                type: 'table',
                content: tableMap.get(part)!,
            });
            continue;
        }
        const cleaned = normalizeHtml(part);
        if (!cleaned)
            continue;
        if (containsForbiddenTableFragments(cleaned)) {
            blocks.push({
                type: 'rich-text',
                content: sanitizeRichTextHtml(cleaned
                    .replace(/<(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)\b[^>]*>/gi, '')
                    .replace(/<\/(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)>/gi, '')),
            });
            continue;
        }
        blocks.push({
            type: 'rich-text',
            content: sanitizeRichTextHtml(cleaned),
        });
    }
    return blocks;
}
/**
 * Recompõe o HTML final preservando a ordem original dos blocos.
 */
export function mergeContent(blocks: LessonContentBlock[]): string {
    if (!Array.isArray(blocks) || blocks.length === 0) {
        return '';
    }
    return blocks
        .map((block) => {
        if (block.type === 'table') {
            return normalizeHtml(sanitizeTableHtml(block.content));
        }
        if (block.type === 'image-hotspots') {
            return normalizeHtml(serializeLessonImageHotspotsBlock(block.content));
        }
        if (block.type === 'flashcards') {
            return normalizeHtml(serializeLessonFlashcardsBlock(block.content));
        }
        if (block.type === 'image') {
            return normalizeHtml(serializeLessonImageBlock(block.content));
        }
        if (block.type === 'video') {
            return normalizeHtml(serializeLessonVideoBlock(block.content));
        }
        if (block.type === 'html') {
            return normalizeHtml(serializeLessonHtmlBlock(block.content));
        }
        if (block.type === 'svg') {
            return normalizeHtml(serializeLessonSvgBlock(block.content));
        }
        if (block.type === 'columns') {
            return normalizeHtml(serializeLessonColumnsBlock(block.content));
        }
        if (block.type === 'button') {
            return normalizeHtml(serializeLessonButtonBlock(block.content));
        }
        return normalizeHtml(sanitizeRichTextHtml(block.content));
    })
        .filter(Boolean)
        .join('');
}

/**
 * Coleta todos os IDs de botões globais referenciados em uma lista de blocos (incluindo colunas recursivas).
 */
export function collectGlobalButtonIds(blocks: LessonContentBlock[]): string[] {
    const ids: string[] = [];
    for (const block of blocks) {
        if (block.type === 'button' && block.content.source_type === 'global' && block.content.global_button_id) {
            ids.push(block.content.global_button_id);
        }
        else if (block.type === 'rich-text' && isBrowser()) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(block.content, 'text/html');
            doc.querySelectorAll('[data-hcm-inline-button="true"]').forEach((element) => {
                const inlineButton = parseInlineLessonButtonElement(element);
                if (inlineButton?.source_type === 'global' && inlineButton.global_button_id) {
                    ids.push(inlineButton.global_button_id);
                }
            });
        }
        else if (block.type === 'columns') {
            for (const col of block.content) {
                ids.push(...collectGlobalButtonIds(col.blocks));
            }
        }
    }
    return ids;
}

export interface MaterializeGlobalButtonsResult {
    blocks: LessonContentBlock[];
    warnings: string[];
    convertedCount: number;
    preservedCount: number;
    removedCount: number;
}

/**
 * Normaliza referências a botões globais em uma árvore de blocos de aula:
 * 1. Para botões globais que EXISTEM no banco de destino (ativos OU inativos):
 *    - Mantém a referência global (source_type = 'global', global_button_id = ID).
 *    - NÃO converte para local, preservando a autoridade da biblioteca global do ambiente.
 * 2. Para botões globais que NÃO EXISTEM no banco de destino (inexistentes/órfãos):
 *    - Se possuir snapshot cached_action válido:
 *      Converte para botão local com os dados preservados em cache, desvinculando global_button_id.
 *    - Se NÃO possuir cached_action ou se ele estiver incompleto/inválido:
 *      Remove o bloco inválido da aula importada para evitar URLs artificiais ou blocos disfuncionais,
 *      registrando warning estruturado detalhado.
 */
export function materializeMissingGlobalButtonReferences(
    blocks: LessonContentBlock[],
    existingGlobalIds: Set<string>
): MaterializeGlobalButtonsResult {
    const warnings: string[] = [];
    let convertedCount = 0;
    let preservedCount = 0;
    let removedCount = 0;

    const processBlocks = (list: LessonContentBlock[]): LessonContentBlock[] => {
        const result: LessonContentBlock[] = [];

        for (const block of list) {
            if (block.type === 'button' && block.content.source_type === 'global') {
                const globalId = block.content.global_button_id;

                // Se existe no banco de destino (seja ativo ou inativo), preserva a referência global!
                if (globalId && existingGlobalIds.has(globalId)) {
                    preservedCount++;
                    result.push(block);
                    continue;
                }

                // Não existe no destino: verificar se possui cache de ação válido
                const cached = block.content.cached_action;
                const isCachedValid = Boolean(
                    cached &&
                    cached.label?.trim() &&
                    cached.action_type &&
                    (
                        (cached.action_type === 'url' && cached.url?.trim()) ||
                        (cached.action_type === 'file' && cached.storage_path?.trim()) ||
                        (cached.action_type === 'modal' && cached.modal?.title?.trim())
                    )
                );

                if (isCachedValid && cached) {
                    convertedCount++;
                    const convertedLocalConfig: LessonButtonBlockLocalConfig = {
                        label: cached.label.trim(),
                        template_id: cached.template_id ?? null,
                        template: cached.template ?? null,
                        variant: cached.variant ?? 'outline',
                        theme: cached.theme ?? 'blue',
                        icon: cached.icon ?? 'link',
                        action_type: cached.action_type,
                        url: cached.url ?? null,
                        open_target: cached.open_target ?? 'new-tab',
                        storage_path: cached.storage_path ?? null,
                        file_name: cached.file_name ?? null,
                        file_size_bytes: cached.file_size_bytes ?? 0,
                        modal: cached.modal ?? null,
                    };
                    warnings.push(
                        `Botão global '${globalId || 'desconhecido'}' não encontrado na base de destino. Convertido para botão local a partir do snapshot em cache.`
                    );
                    result.push({
                        ...block,
                        content: {
                            source_type: 'local',
                            alignment: block.content.alignment ?? 'left',
                            width: block.content.width ?? 'auto',
                            local_config: convertedLocalConfig,
                            cached_action: null,
                            global_button_id: null,
                        },
                    });
                } else {
                    // Sem cache válido: remover o bloco inválido/órfão e registrar warning estruturado (Opção B)
                    removedCount++;
                    warnings.push(
                        `Botão global '${globalId || 'desconhecido'}' não encontrado na base de destino e sem snapshot em cache válido. O bloco foi removido da aula por segurança estrutural.`
                    );
                    // Não inclui o bloco no array result
                }
                continue;
            }

            if (block.type === 'columns') {
                result.push({
                    ...block,
                    content: block.content.map((col) => ({
                        ...col,
                        blocks: processBlocks(col.blocks),
                    })),
                });
                continue;
            }

            result.push(block);
        }

        return result;
    };

    const sanitized = processBlocks(blocks);
    return {
        blocks: sanitized,
        warnings,
        convertedCount,
        preservedCount,
        removedCount,
    };
}
