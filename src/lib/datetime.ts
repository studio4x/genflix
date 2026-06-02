import { env } from '@/config/env';
export const APP_TIMEZONE = env.VITE_APP_TIMEZONE;
export const APP_LOCALE = env.VITE_APP_LOCALE;
export function formatDateTime(date: Date | string): string {
    const value = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(APP_LOCALE, {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: APP_TIMEZONE,
    }).format(value);
}
