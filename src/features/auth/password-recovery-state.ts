const PASSWORD_RECOVERY_STORAGE_KEY = 'genflix:password-recovery-active';
export function hasPasswordRecoveryUrl() {
    if (typeof window === 'undefined') {
        return false;
    }
    const urlPayload = `${window.location.search}${window.location.hash}`;
    return (urlPayload.includes('type=recovery') ||
        urlPayload.includes('access_token=') ||
        urlPayload.includes('refresh_token=') ||
        urlPayload.includes('code='));
}
export function readPasswordRecoveryState() {
    if (typeof window === 'undefined') {
        return false;
    }
    return (hasPasswordRecoveryUrl() ||
        window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1');
}
export function markPasswordRecoveryState() {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
}
export function clearPasswordRecoveryState() {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
}
