import type { LessonImageHotspotsAsset, LessonImageHotspotsBlockContent, LessonImageHotspotItem, } from '@/types/content';
export type LessonImageBlockSize = 'sm' | 'md' | 'lg' | 'full';
export type LessonImageBlockCaptionAlignment = 'left' | 'center' | 'right';
export interface LessonImageBlockContent {
    source_type: 'url' | 'upload';
    image_url: string;
    storage_path: string;
    signed_url?: string | null;
    file_name: string;
    mime_type: string | null;
    alt: string;
    size: LessonImageBlockSize;
    caption: string;
    caption_alignment: LessonImageBlockCaptionAlignment;
}
export interface LessonVideoBlockContent {
    source_type: 'url' | 'upload';
    url: string;
    storage_path: string;
    signed_url?: string | null;
    file_name: string;
    mime_type: string | null;
    caption: string;
}
export type LessonColumnsBlockContent = LessonContentBlock[][];
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
};
const TABLE_PLACEHOLDER_PREFIX = '__TABLE_BLOCK__';
const IMAGE_PLACEHOLDER_PREFIX = '__IMAGE_BLOCK__';
const VIDEO_PLACEHOLDER_PREFIX = '__VIDEO_BLOCK__';
const HOTSPOTS_PLACEHOLDER_PREFIX = '__HOTSPOTS_BLOCK__';
const COLUMNS_PLACEHOLDER_PREFIX = '__COLUMNS_BLOCK__';
const LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR = 'data-hcm-block';
const LESSON_IMAGE_HOTSPOTS_BLOCK_PAYLOAD_ATTR = 'data-hcm-payload';
const LESSON_IMAGE_HOTSPOTS_BLOCK_TYPE = 'image-hotspots';
const LESSON_COLUMNS_BLOCK_COUNT_ATTR = 'data-hcm-columns';
const LESSON_COLUMNS_BLOCK_TYPE = 'columns';
const LESSON_IMAGE_BLOCK_TYPE = 'image';
const LESSON_VIDEO_BLOCK_TYPE = 'video';
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
    's',
    'span',
    'strong',
    'u',
    'ul',
]);
const ALLOWED_RICH_TEXT_ATTRS = new Set(['href', 'target', 'rel']);
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
    [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (name === 'style' || name.startsWith('on') || !ALLOWED_RICH_TEXT_ATTRS.has(name)) {
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
    };
}
export function createEmptyLessonImageBlockContent(): LessonImageBlockContent {
    return normalizeLessonImageBlockContent({
        source_type: 'url',
        image_url: '',
        storage_path: '',
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
        signed_url: content.signed_url?.trim() || null,
        file_name: content.file_name?.trim() || '',
        mime_type: content.mime_type?.trim() || null,
        caption: content.caption?.trim() || '',
    };
}
export function createEmptyLessonVideoBlockContent(): LessonVideoBlockContent {
    return normalizeLessonVideoBlockContent({
        source_type: 'url',
        url: '',
        storage_path: '',
        signed_url: null,
        file_name: '',
        mime_type: null,
        caption: '',
    });
}
export function createEmptyColumnsBlockContent(columnsCount = 2): LessonColumnsBlockContent {
    const safeCount = clamp(columnsCount, 1, 4);
    return Array.from({ length: safeCount }, () => createFallbackBlock('<p></p>'));
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
        signed_url: typeof candidate.signed_url === 'string' ? candidate.signed_url : null,
        file_name: typeof candidate.file_name === 'string' ? candidate.file_name : '',
        mime_type: typeof candidate.mime_type === 'string' ? candidate.mime_type : null,
        caption: typeof candidate.caption === 'string' ? candidate.caption : '',
    });
}
export function createEmptyLessonImageHotspotsBlockContent(): LessonImageHotspotsBlockContent {
    return {
        asset: {
            storage_path: '',
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
function normalizeColumnsContent(columns: LessonColumnsBlockContent, fallbackCount = 2): LessonColumnsBlockContent {
    const safeFallbackCount = clamp(fallbackCount, 1, 4);
    const normalized = columns
        .slice(0, 4)
        .map((column) => (Array.isArray(column) && column.length > 0 ? column : createFallbackBlock('<p></p>')));
    const withFallback = normalized.length > 0
        ? normalized
        : Array.from({ length: safeFallbackCount }, () => createFallbackBlock('<p></p>'));
    while (withFallback.length < safeFallbackCount) {
        withFallback.push(createFallbackBlock('<p></p>'));
    }
    return withFallback;
}
function extractColumnsContent(element: Element): LessonColumnsBlockContent {
    const columns = Array.from(element.children)
        .filter((child): child is HTMLElement => (child instanceof HTMLElement && child.classList.contains('genflix-column')))
        .map((column) => splitContent(normalizeHtml(column.innerHTML)));
    const requestedCount = clamp(Number.parseInt(element.getAttribute(LESSON_COLUMNS_BLOCK_COUNT_ATTR) ?? '', 10) || columns.length || 2, 1, 4);
    return normalizeColumnsContent(columns, requestedCount);
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
    const columnsHtml = normalizedColumns
        .slice(0, count)
        .map((columnBlocks) => `<div class="genflix-column">${mergeContent(columnBlocks) || '<p></p>'}</div>`)
        .join('');
    return `
    <div
      ${LESSON_IMAGE_HOTSPOTS_BLOCK_ATTR}="${LESSON_COLUMNS_BLOCK_TYPE}"
      ${LESSON_COLUMNS_BLOCK_COUNT_ATTR}="${count}"
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
        file_name: content.file_name,
        mime_type: content.mime_type,
        caption: content.caption,
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
    const summary = content.source_type === 'upload'
        ? `Vídeo enviado${fileName ? `: ${escapeHtml(fileName)}` : ''}.`
        : 'Vídeo por URL.';
    return `
    <figure class="hcm-video-block-fallback">
      <div class="hcm-video-block-fallback__surface">${summary}</div>
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
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
    const placeholderRegex = new RegExp(`(${TABLE_PLACEHOLDER_PREFIX}_\\d+__|${HOTSPOTS_PLACEHOLDER_PREFIX}_\\d+__|${COLUMNS_PLACEHOLDER_PREFIX}_\\d+__|${IMAGE_PLACEHOLDER_PREFIX}_\\d+__|${VIDEO_PLACEHOLDER_PREFIX}_\\d+__)`, 'g');
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
        if (block.type === 'image') {
            return normalizeHtml(serializeLessonImageBlock(block.content));
        }
        if (block.type === 'video') {
            return normalizeHtml(serializeLessonVideoBlock(block.content));
        }
        if (block.type === 'columns') {
            return normalizeHtml(serializeLessonColumnsBlock(block.content));
        }
        return normalizeHtml(sanitizeRichTextHtml(block.content));
    })
        .filter(Boolean)
        .join('');
}
