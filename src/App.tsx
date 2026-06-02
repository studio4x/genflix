import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers/app-providers';
import { appRouter } from '@/app/router';
function App() {
    useEffect(() => {
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
        return unsubscribe;
    }, []);
    return (<AppProviders>
      <RouterProvider router={appRouter}/>
    </AppProviders>);
}
export default App;
