import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase/client';

const ASSESSMENT_ASSETS_BUCKET = 'assessment-assets';

export async function getSignedAssessmentAssetUrl(storagePath: string, storageProvider: 'supabase' | 'r2' = 'r2') {
    const response = await supabase.functions.invoke<{ signed_url: string }>('generate-asset-access', {
        body: {
            access_token: (await supabase.auth.getSession()).data.session?.access_token ?? '',
            asset_kind: 'assessment_asset',
            storage_bucket: ASSESSMENT_ASSETS_BUCKET,
            storage_provider: storageProvider,
            storage_path: storagePath,
            expires_in_seconds: 60 * 60,
        },
    });
    if (response.error || !response.data?.signed_url) {
        throw new Error(response.error?.message ?? 'Não foi possível gerar URL assinada do asset.');
    }
    return response.data.signed_url;
}

export function useResolvedAssessmentAssetUrl(storagePath: string, storageProvider?: 'supabase' | 'r2', signedUrl?: string | null) {
    const normalizedPath = storagePath.trim();
    const fallbackUrl = signedUrl?.trim() || null;
    const assetKey = `${normalizedPath}:${storageProvider ?? 'r2'}`;
    const [resolvedAsset, setResolvedAsset] = useState<{ key: string; url: string | null }>({
        key: assetKey,
        url: fallbackUrl,
    });
    const [refreshToken, setRefreshToken] = useState(0);
    const refreshAttemptsRef = useRef(0);

    useEffect(() => {
        refreshAttemptsRef.current = 0;
    }, [normalizedPath, storageProvider]);

    useEffect(() => {
        if (!normalizedPath) {
            return;
        }
        let isMounted = true;
        void getSignedAssessmentAssetUrl(normalizedPath, storageProvider ?? 'r2')
            .then((url) => {
                if (isMounted) {
                    setResolvedAsset({ key: assetKey, url });
                }
            })
            .catch(() => {
                // Keep the URL already supplied by the payload when re-signing fails.
            });
        return () => {
            isMounted = false;
        };
    }, [assetKey, fallbackUrl, normalizedPath, refreshToken, storageProvider]);

    const refresh = useCallback(() => {
        if (!normalizedPath || refreshAttemptsRef.current >= 1) {
            return;
        }
        refreshAttemptsRef.current += 1;
        setRefreshToken((current) => current + 1);
    }, [normalizedPath]);

    return {
        url: resolvedAsset.key === assetKey ? (resolvedAsset.url ?? fallbackUrl) : fallbackUrl,
        refresh,
    };
}
