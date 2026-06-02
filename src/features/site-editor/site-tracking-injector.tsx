import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_BEGIN_CHECKOUT_EVENT_NAME, SITE_VIEW_ITEM_EVENT_NAME, defaultSiteTrackingSettings, fetchSiteTrackingSettings, SITE_PURCHASE_EVENT_NAME, type SiteBeginCheckoutTrackingEventDetail, type SitePurchaseTrackingEventDetail, type SiteViewItemTrackingEventDetail, type SiteTrackingSettings, } from '@/features/site-editor/site-tracking';
function createScriptFromNode(source: HTMLScriptElement) {
    const script = document.createElement('script');
    for (const attribute of Array.from(source.attributes)) {
        script.setAttribute(attribute.name, attribute.value);
    }
    if (source.textContent) {
        script.text = source.textContent;
    }
    return script;
}
function appendParsedNodes(target: HTMLElement | HTMLHeadElement, html: string, beforeNode?: Node | null) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const insertedNodes: Node[] = [];
    for (const node of Array.from(template.content.childNodes)) {
        let nextNode: Node;
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'script') {
            nextNode = createScriptFromNode(node as HTMLScriptElement);
        }
        else {
            nextNode = node.cloneNode(true);
        }
        if (beforeNode) {
            target.insertBefore(nextNode, beforeNode);
        }
        else {
            target.appendChild(nextNode);
        }
        insertedNodes.push(nextNode);
    }
    return () => {
        insertedNodes.forEach((node) => node.parentNode?.removeChild(node));
    };
}
function injectGtm(gtmId: string) {
    const containerId = gtmId.trim();
    if (!containerId) {
        return () => undefined;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.jsid=${encodeURIComponent(containerId)}`;
    script.setAttribute('data-genflix-tracking', 'gtm');
    document.head.appendChild(script);
    const noscript = document.createElement('noscript');
    noscript.setAttribute('data-genflix-tracking', 'gtm-noscript');
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.htmlid=${encodeURIComponent(containerId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    const bodyRoot = document.body.firstChild;
    if (bodyRoot) {
        document.body.insertBefore(noscript, bodyRoot);
    }
    else {
        document.body.appendChild(noscript);
    }
    return () => {
        script.remove();
        noscript.remove();
    };
}
function injectMetaPixel(pixelId: string) {
    const normalizedPixelId = pixelId.trim();
    if (!normalizedPixelId) {
        return () => undefined;
    }
    const inlineScript = document.createElement('script');
    inlineScript.setAttribute('data-genflix-tracking', 'meta-pixel');
    inlineScript.text = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${normalizedPixelId}');
    fbq('track', 'PageView');
  `;
    document.head.appendChild(inlineScript);
    const noscript = document.createElement('noscript');
    noscript.setAttribute('data-genflix-tracking', 'meta-pixel-noscript');
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/trid=${encodeURIComponent(normalizedPixelId)}&ev=PageView&noscript=1" alt="" />`;
    const bodyRoot = document.body.firstChild;
    if (bodyRoot) {
        document.body.insertBefore(noscript, bodyRoot);
    }
    else {
        document.body.appendChild(noscript);
    }
    return () => {
        inlineScript.remove();
        noscript.remove();
    };
}
function trackPurchaseEvent(detail: SitePurchaseTrackingEventDetail) {
    if (typeof window === 'undefined') {
        return;
    }
    const purchasePayload = createCommercePayload({
        courseId: detail.courseId,
        courseTitle: detail.courseTitle,
        currency: detail.currency,
        value: detail.value,
        transactionId: detail.transactionId,
    });
    if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
            event: 'purchase',
            ecommerce: purchasePayload,
            genflix: {
                courseId: detail.courseId,
                courseTitle: detail.courseTitle,
            },
        });
    }
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', purchasePayload);
    }
    if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', {
            content_type: 'product',
            content_ids: [detail.courseId],
            content_name: detail.courseTitle,
            currency: detail.currency,
            value: detail.value,
        });
    }
}
function createCommercePayload({ courseId, courseTitle, currency, value, transactionId, }: {
    courseId: string;
    courseTitle: string;
    currency: string;
    value?: number;
    transactionId?: string;
}) {
    const items = [
        {
            item_id: courseId,
            item_name: courseTitle,
            quantity: 1,
            ...(typeof value === 'number' && Number.isFinite(value) && value > 0 ? { price: value } : {}),
        },
    ];
    return {
        ...(transactionId ? { transaction_id: transactionId } : {}),
        ...(typeof value === 'number' && Number.isFinite(value) && value > 0 ? { value } : {}),
        currency,
        items,
    };
}
function trackViewItemEvent(detail: SiteViewItemTrackingEventDetail) {
    if (typeof window === 'undefined') {
        return;
    }
    const payload = createCommercePayload(detail);
    if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
            event: 'view_item',
            ecommerce: payload,
            genflix: {
                courseId: detail.courseId,
                courseTitle: detail.courseTitle,
            },
        });
    }
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'view_item', payload);
    }
    if (typeof window.fbq === 'function') {
        window.fbq('track', 'ViewContent', {
            content_type: 'product',
            content_ids: [detail.courseId],
            content_name: detail.courseTitle,
            currency: detail.currency,
            ...(typeof detail.value === 'number' && Number.isFinite(detail.value) && detail.value > 0
                ? { value: detail.value }
                : {}),
        });
    }
}
function trackBeginCheckoutEvent(detail: SiteBeginCheckoutTrackingEventDetail) {
    if (typeof window === 'undefined') {
        return;
    }
    const payload = createCommercePayload(detail);
    if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
            event: 'begin_checkout',
            ecommerce: payload,
            genflix: {
                courseId: detail.courseId,
                courseTitle: detail.courseTitle,
            },
        });
    }
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', payload);
    }
    if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
            content_type: 'product',
            content_ids: [detail.courseId],
            content_name: detail.courseTitle,
            currency: detail.currency,
            ...(typeof detail.value === 'number' && Number.isFinite(detail.value) && detail.value > 0
                ? { value: detail.value }
                : {}),
        });
    }
}
function trackPageView(path: string, search: string, includeMetaPixelPageView: boolean) {
    if (typeof window === 'undefined') {
        return;
    }
    const pagePath = `${path}${search || ''}`;
    const pageLocation = `${window.location.origin}${pagePath}`;
    const pageTitle = typeof document !== 'undefined' ? document.title : undefined;
    if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
            event: 'page_view',
            page_path: pagePath,
            page_location: pageLocation,
            ...(pageTitle ? { page_title: pageTitle } : {}),
        });
    }
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
            page_path: pagePath,
            page_location: pageLocation,
            ...(pageTitle ? { page_title: pageTitle } : {}),
        });
    }
    if (includeMetaPixelPageView && typeof window.fbq === 'function') {
        window.fbq('track', 'PageView');
    }
}
function isValidTrackingValue(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function normalizeValue(value: unknown) {
    return isValidTrackingValue(value) ? value : undefined;
}
function normalizeCommerceEventDetail(detail: unknown): SiteViewItemTrackingEventDetail | null {
    if (!detail || typeof detail !== 'object') {
        return null;
    }
    const source = detail as Record<string, unknown>;
    const courseId = typeof source.courseId === 'string' ? source.courseId.trim() : '';
    const courseTitle = typeof source.courseTitle === 'string' ? source.courseTitle.trim() : '';
    const currency = typeof source.currency === 'string' ? source.currency.trim().toUpperCase() : '';
    if (!courseId || !courseTitle || !currency) {
        return null;
    }
    return {
        courseId,
        courseTitle,
        currency,
        value: normalizeValue(source.value),
    };
}
function isValidPurchaseEventDetail(detail: unknown): detail is SitePurchaseTrackingEventDetail {
    if (!detail || typeof detail !== 'object') {
        return false;
    }
    const source = detail as Record<string, unknown>;
    return (typeof source.courseId === 'string' &&
        source.courseId.trim().length > 0 &&
        typeof source.courseTitle === 'string' &&
        source.courseTitle.trim().length > 0 &&
        typeof source.currency === 'string' &&
        source.currency.trim().length > 0 &&
        typeof source.transactionId === 'string' &&
        source.transactionId.trim().length > 0 &&
        isValidTrackingValue(source.value));
}
function injectCustomCode(target: HTMLElement | HTMLHeadElement, code: string, location: 'header' | 'body' | 'footer') {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
        return () => undefined;
    }
    const bodyAnchor = location === 'body' ? target.firstChild : null;
    return appendParsedNodes(target, normalizedCode, bodyAnchor);
}
export function SiteTrackingInjector() {
    const location = useLocation();
    const [tracking, setTracking] = useState<SiteTrackingSettings>(defaultSiteTrackingSettings);
    const didEmitInitialFbqPageViewRef = useRef(false);
    useEffect(() => {
        let isMounted = true;
        void fetchSiteTrackingSettings()
            .then((value) => {
            if (isMounted) {
                setTracking(value);
            }
        })
            .catch(() => {
            if (isMounted) {
                setTracking(defaultSiteTrackingSettings);
            }
        });
        return () => {
            isMounted = false;
        };
    }, []);
    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }
        const cleanups = [
            injectGtm(tracking.gtmId),
            injectMetaPixel(tracking.metaPixelId),
            injectCustomCode(document.head, tracking.customHeaderCode, 'header'),
            injectCustomCode(document.body, tracking.customBodyCode, 'body'),
            injectCustomCode(document.body, tracking.customFooterCode, 'footer'),
        ];
        return () => {
            cleanups.reverse().forEach((cleanup) => cleanup());
        };
    }, [tracking.customBodyCode, tracking.customFooterCode, tracking.customHeaderCode, tracking.gtmId, tracking.metaPixelId]);
    useEffect(() => {
        const includeMetaPixelPageView = didEmitInitialFbqPageViewRef.current;
        trackPageView(location.pathname, location.search, includeMetaPixelPageView);
        didEmitInitialFbqPageViewRef.current = true;
    }, [location.pathname, location.search]);
    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        function handlePurchaseEvent(event: Event) {
            const detail = (event as CustomEvent<unknown>).detail;
            if (!isValidPurchaseEventDetail(detail)) {
                return;
            }
            trackPurchaseEvent(detail);
        }
        function handleViewItemEvent(event: Event) {
            const detail = normalizeCommerceEventDetail((event as CustomEvent<unknown>).detail);
            if (!detail) {
                return;
            }
            trackViewItemEvent(detail);
        }
        function handleBeginCheckoutEvent(event: Event) {
            const detail = normalizeCommerceEventDetail((event as CustomEvent<unknown>).detail);
            if (!detail) {
                return;
            }
            trackBeginCheckoutEvent(detail);
        }
        window.addEventListener(SITE_PURCHASE_EVENT_NAME, handlePurchaseEvent as EventListener);
        window.addEventListener(SITE_VIEW_ITEM_EVENT_NAME, handleViewItemEvent as EventListener);
        window.addEventListener(SITE_BEGIN_CHECKOUT_EVENT_NAME, handleBeginCheckoutEvent as EventListener);
        return () => {
            window.removeEventListener(SITE_PURCHASE_EVENT_NAME, handlePurchaseEvent as EventListener);
            window.removeEventListener(SITE_VIEW_ITEM_EVENT_NAME, handleViewItemEvent as EventListener);
            window.removeEventListener(SITE_BEGIN_CHECKOUT_EVENT_NAME, handleBeginCheckoutEvent as EventListener);
        };
    }, []);
    return null;
}
