import { supabase } from '@/services/supabase/client';
export const SITE_TRACKING_ENTRY_KEY = 'site.tracking';
export type SiteTrackingSettings = {
    gtmId: string;
    metaPixelId: string;
    customHeaderCode: string;
    customBodyCode: string;
    customFooterCode: string;
};
export type SitePurchaseTrackingEventDetail = {
    courseId: string;
    courseTitle: string;
    currency: string;
    transactionId: string;
    value: number;
};
export type SiteViewItemTrackingEventDetail = {
    courseId: string;
    courseTitle: string;
    currency: string;
    value?: number;
};
export type SiteBeginCheckoutTrackingEventDetail = {
    courseId: string;
    courseTitle: string;
    currency: string;
    value?: number;
};
export const SITE_PURCHASE_EVENT_NAME = 'genflix:purchase';
export const SITE_VIEW_ITEM_EVENT_NAME = 'genflix:view_item';
export const SITE_BEGIN_CHECKOUT_EVENT_NAME = 'genflix:begin_checkout';
export const defaultSiteTrackingSettings: SiteTrackingSettings = {
    gtmId: '',
    metaPixelId: '',
    customHeaderCode: '',
    customBodyCode: '',
    customFooterCode: '',
};
function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function readString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}
export function normalizeSiteTracking(value: unknown): SiteTrackingSettings {
    const source = isPlainRecord(value) ? value : {};
    return {
        gtmId: readString(source.gtmId),
        metaPixelId: readString(source.metaPixelId),
        customHeaderCode: readString(source.customHeaderCode),
        customBodyCode: readString(source.customBodyCode),
        customFooterCode: readString(source.customFooterCode),
    };
}
export function isValidGtmId(value: string) {
    return /^GTM-[A-Z0-9]+$/i.test(value.trim());
}
export function isValidMetaPixelId(value: string) {
    return /^\d+$/.test(value.trim());
}
export function validateSiteTrackingSettings(value: SiteTrackingSettings) {
    const gtmId = value.gtmId.trim();
    const metaPixelId = value.metaPixelId.trim();
    const hasGtm = gtmId.length > 0;
    const hasMetaPixel = metaPixelId.length > 0;
    const gtmValid = !hasGtm || isValidGtmId(gtmId);
    const metaPixelValid = !hasMetaPixel || isValidMetaPixelId(metaPixelId);
    return {
        gtm: {
            configured: hasGtm,
            valid: gtmValid,
            message: !hasGtm
                ? "N?o configurado" : gtmValid
                ? "Formato v?lido" : "Formato inv?lido. Use algo como GTM-XXXXXXX.",
        },
        metaPixel: {
            configured: hasMetaPixel,
            valid: metaPixelValid,
            message: !hasMetaPixel
                ? "N?o configurado" : metaPixelValid
                ? "Formato v?lido" : "Formato inv?lido. Use apenas numeros.",
        },
        hasIssues: !gtmValid || !metaPixelValid,
    };
}
export async function fetchSiteTrackingSettings() {
    const { data, error } = await supabase
        .from('site_content_entries')
        .select('value')
        .eq('page_key', 'global')
        .eq('entry_key', SITE_TRACKING_ENTRY_KEY)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return normalizeSiteTracking(data?.value ?? defaultSiteTrackingSettings);
}
function dispatchSiteTrackingEvent<EventDetail>(eventName: string, detail: EventDetail) {
    if (typeof window === 'undefined') {
        return;
    }
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
}
export function dispatchSitePurchaseEvent(detail: SitePurchaseTrackingEventDetail) {
    dispatchSiteTrackingEvent(SITE_PURCHASE_EVENT_NAME, detail);
}
export function dispatchSiteViewItemEvent(detail: SiteViewItemTrackingEventDetail) {
    dispatchSiteTrackingEvent(SITE_VIEW_ITEM_EVENT_NAME, detail);
}
export function dispatchSiteBeginCheckoutEvent(detail: SiteBeginCheckoutTrackingEventDetail) {
    dispatchSiteTrackingEvent(SITE_BEGIN_CHECKOUT_EVENT_NAME, detail);
}
