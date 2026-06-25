import { fetchSiteContent, saveSiteContentEntry } from '@/features/site-editor/api';

export type GlobalReviewsSettings = {
  enabled: boolean;
};

export const GLOBAL_REVIEWS_SETTINGS_ENTRY_KEY = 'global.reviews.settings';

const defaultGlobalReviewsSettings: GlobalReviewsSettings = {
  enabled: true,
};

function normalizeGlobalReviewsSettings(value: unknown): GlobalReviewsSettings {
  if (typeof value === 'boolean') {
    return { enabled: value };
  }

  if (value && typeof value === 'object' && 'enabled' in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    return {
      enabled: typeof enabled === 'boolean' ? enabled : defaultGlobalReviewsSettings.enabled,
    };
  }

  return defaultGlobalReviewsSettings;
}

export async function fetchGlobalReviewsSettings(): Promise<GlobalReviewsSettings> {
  const entries = await fetchSiteContent('global');
  const entry = entries.find((item) => item.page_key === 'global' && item.entry_key === GLOBAL_REVIEWS_SETTINGS_ENTRY_KEY);
  return normalizeGlobalReviewsSettings(entry?.value);
}

export async function fetchGlobalReviewsEnabled(): Promise<boolean> {
  const settings = await fetchGlobalReviewsSettings();
  return settings.enabled;
}

export async function saveGlobalReviewsSettings(enabled: boolean) {
  const settings: GlobalReviewsSettings = { enabled };

  await saveSiteContentEntry({
    pageKey: 'global',
    entryKey: GLOBAL_REVIEWS_SETTINGS_ENTRY_KEY,
    entryType: 'json',
    value: settings,
    schema: {
      kind: 'global-reviews-settings',
    },
  });

  return settings;
}
