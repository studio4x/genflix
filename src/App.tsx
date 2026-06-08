import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers/app-providers';
import { appRouter } from '@/app/router';
const CHUNK_RELOAD_FLAG = 'genflix:chunk-reload-attempted';
function getChunkErrorMessage(error: unknown) {
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
function isChunkLoadError(error: unknown) {
    const message = getChunkErrorMessage(error).toLowerCase();
    return message.includes('failed to fetch dynamically imported module')
        || message.includes('error loading dynamically imported module')
        || message.includes('loading chunk')
        || message.includes('chunkloaderror')
        || message.includes('importing a module script failed');
}
function App() {
    useEffect(() => {
        sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
        let previousLocationKey = appRouter.state.location.key;
        const unsubscribe = appRouter.subscribe((state) => {
            if (state.location.key === previousLocationKey) {
                return;
            }
            previousLocationKey = state.location.key;
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            });
        });
        const handleChunkLoadFailure = (event: ErrorEvent | PromiseRejectionEvent) => {
            const error = 'reason' in event ? event.reason : event.error;
            if (!isChunkLoadError(error) || sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
                return;
            }
            event.preventDefault();
            sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
            window.location.reload();
        };
        window.addEventListener('error', handleChunkLoadFailure);
        window.addEventListener('unhandledrejection', handleChunkLoadFailure);
        return () => {
            window.removeEventListener('error', handleChunkLoadFailure);
            window.removeEventListener('unhandledrejection', handleChunkLoadFailure);
            unsubscribe();
        };
    }, []);
    return (<AppProviders>
      <RouterProvider router={appRouter}/>
    </AppProviders>);
}
export default App;
