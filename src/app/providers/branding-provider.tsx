import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchSiteBranding } from '@/features/branding/api';
import { defaultSiteBranding, type BrandingAssetValue, type BrandingSlotKey, type SiteBranding } from '@/features/branding/types';
type BrandingContextValue = {
    branding: SiteBranding;
    isLoading: boolean;
    refreshBranding: () => Promise<void>;
    setBrandingAsset: (slot: BrandingSlotKey, value: BrandingAssetValue | null) => void;
};
const BrandingContext = createContext<BrandingContextValue | null>(null);
function applyFavicon(asset: BrandingAssetValue | null) {
    if (typeof document === 'undefined') {
        return;
    }
    const href = asset?.src || '/favicon.svg';
    const type = asset?.mime_type || undefined;
    const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
    ];
    selectors.forEach((selector) => {
        const existing = document.head.querySelector<HTMLLinkElement>(selector);
        if (existing) {
            existing.href = href;
            if (type) {
                existing.type = type;
            }
            return;
        }
        const link = document.createElement('link');
        link.rel = selector.includes('shortcut') ? 'shortcut icon' : 'icon';
        link.href = href;
        if (type) {
            link.type = type;
        }
        document.head.appendChild(link);
    });
}
export function BrandingProvider({ children }: {
    children: ReactNode;
}) {
    const [branding, setBranding] = useState<SiteBranding>(defaultSiteBranding);
    const [isLoading, setIsLoading] = useState(true);
    const refreshBranding = useCallback(async () => {
        setIsLoading(true);
        try {
            const nextBranding = await fetchSiteBranding();
            setBranding(nextBranding);
        }
        catch {
            setBranding(defaultSiteBranding);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const setBrandingAsset = useCallback((slot: BrandingSlotKey, value: BrandingAssetValue | null) => {
        setBranding((current) => ({
            ...current,
            [slot]: value,
        }));
    }, []);
    useEffect(() => {
        void refreshBranding();
    }, [refreshBranding]);
    useEffect(() => {
        applyFavicon(branding.favicon);
    }, [branding.favicon]);
    const value = useMemo<BrandingContextValue>(() => ({
        branding,
        isLoading,
        refreshBranding,
        setBrandingAsset,
    }), [branding, isLoading, refreshBranding, setBrandingAsset]);
    return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}
export function useBranding() {
    const context = useContext(BrandingContext);
    if (!context) {
        throw new Error('useBranding must be used within BrandingProvider');
    }
    return context;
}
