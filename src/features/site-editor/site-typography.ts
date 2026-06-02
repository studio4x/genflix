export type SiteTypographyGroupKey = 'h1' | 'h2' | 'h3' | 'body' | 'list' | 'link';
export type SiteTypographyGroup = {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    letterSpacing: string;
    textTransform: string;
};
export type SiteTypographyConfig = Record<SiteTypographyGroupKey, SiteTypographyGroup>;
const SITE_TYPOGRAPHY_GROUP_KEYS: SiteTypographyGroupKey[] = ['h1', 'h2', 'h3', 'body', 'list', 'link'];
const VALID_TEXT_TRANSFORMS = new Set(['none', 'uppercase', 'lowercase', 'capitalize', 'inherit']);
function sanitizeCssValue(value: unknown) {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.replace(/[{};]/g, '');
}
function normalizeTextTransform(value: unknown) {
    const normalized = sanitizeCssValue(value).toLowerCase();
    if (!normalized) {
        return '';
    }
    return VALID_TEXT_TRANSFORMS.has(normalized) ? normalized : '';
}
function createEmptyGroup(): SiteTypographyGroup {
    return {
        fontFamily: '',
        fontSize: '',
        fontWeight: '',
        lineHeight: '',
        letterSpacing: '',
        textTransform: '',
    };
}
export function createDefaultSiteTypography(): SiteTypographyConfig {
    return {
        h1: createEmptyGroup(),
        h2: createEmptyGroup(),
        h3: createEmptyGroup(),
        body: createEmptyGroup(),
        list: createEmptyGroup(),
        link: createEmptyGroup(),
    };
}
export function normalizeSiteTypography(input: unknown): SiteTypographyConfig {
    const base = createDefaultSiteTypography();
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return base;
    }
    const value = input as Record<string, unknown>;
    for (const key of SITE_TYPOGRAPHY_GROUP_KEYS) {
        const rawGroup = value[key];
        if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
            continue;
        }
        const group = rawGroup as Record<string, unknown>;
        base[key] = {
            fontFamily: sanitizeCssValue(group.fontFamily),
            fontSize: sanitizeCssValue(group.fontSize),
            fontWeight: sanitizeCssValue(group.fontWeight),
            lineHeight: sanitizeCssValue(group.lineHeight),
            letterSpacing: sanitizeCssValue(group.letterSpacing),
            textTransform: normalizeTextTransform(group.textTransform),
        };
    }
    return base;
}
function buildRuleProperties(group: SiteTypographyGroup) {
    const properties = [
        ['font-family', group.fontFamily],
        ['font-size', group.fontSize],
        ['font-weight', group.fontWeight],
        ['line-height', group.lineHeight],
        ['letter-spacing', group.letterSpacing],
        ['text-transform', group.textTransform],
    ] as const;
    return properties
        .filter(([, value]) => value.trim() !== '')
        .map(([prop, value]) => `  ${prop}: ${value} !important;`);
}
function buildSelectorRule(selector: string, group: SiteTypographyGroup) {
    const properties = buildRuleProperties(group);
    if (properties.length === 0) {
        return '';
    }
    return `${selector} {\n${properties.join('\n')}\n}`;
}
export function buildSiteTypographyCss(config: SiteTypographyConfig) {
    const rules = [
        buildSelectorRule('body[data-genflix-public-shell="true"] :where(main.min-h-screen) h1', config.h1),
        buildSelectorRule('body[data-genflix-public-shell="true"] :where(main.min-h-screen) h2', config.h2),
        buildSelectorRule('body[data-genflix-public-shell="true"] :where(main.min-h-screen) h3', config.h3),
        buildSelectorRule('body[data-genflix-public-shell="true"] :where(main.min-h-screen) p', config.body),
        buildSelectorRule('body[data-genflix-public-shell="true"] :where(main.min-h-screen) li', config.list),
        buildSelectorRule('body[data-genflix-public-shell="true"] :where(main.min-h-screen) a', config.link),
    ].filter((rule) => rule !== '');
    return rules.join('\n\n');
}
