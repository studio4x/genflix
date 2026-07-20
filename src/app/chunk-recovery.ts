export const CHUNK_RELOAD_FLAG = 'genflix:route-chunk-reload-attempts';
const CHUNK_RELOAD_PARAM = '_genflix_reload';
const MAX_RECOVERY_ATTEMPTS = 3;

export function getErrorMessage(error: unknown) {
    if (!error) {
        return '';
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'object') {
        const candidate = error as { message?: unknown; reason?: unknown };
        if (typeof candidate.message === 'string') {
            return candidate.message;
        }
        if (typeof candidate.reason === 'string') {
            return candidate.reason;
        }
        if (candidate.reason instanceof Error) {
            return candidate.reason.message;
        }
    }
    return '';
}

export function isChunkLoadError(error: unknown) {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes('failed to fetch dynamically imported module')
        || message.includes('error loading dynamically imported module')
        || message.includes('loading chunk')
        || message.includes('chunkloaderror')
        || message.includes('importing a module script failed');
}

export function recoverFromChunkLoadError() {
    const attempts = Number(sessionStorage.getItem(CHUNK_RELOAD_FLAG) || '0');
    if (attempts >= MAX_RECOVERY_ATTEMPTS) {
        return false;
    }

    sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(attempts + 1));
    const url = new URL(window.location.href);
    url.searchParams.set(CHUNK_RELOAD_PARAM, String(Date.now()));
    window.location.replace(url.toString());
    return true;
}

export function clearChunkRecoveryAttempts() {
    window.setTimeout(() => {
        sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    }, 15000);
}
