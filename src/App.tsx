import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers/app-providers';
import { appRouter } from '@/app/router';
import { clearChunkRecoveryAttempts, isChunkLoadError, recoverFromChunkLoadError } from '@/app/chunk-recovery';
function App() {
    useEffect(() => {
        clearChunkRecoveryAttempts();
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
            if (!isChunkLoadError(error)) {
                return;
            }
            event.preventDefault();
            recoverFromChunkLoadError();
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
