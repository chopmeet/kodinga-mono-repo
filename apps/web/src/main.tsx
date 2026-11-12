import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider, TooltipProvider } from '@kodinga/ui';
import store from '@/redux/store';
import '@/utils/i18n';

const App = lazy(() => import('./app/app'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="kodinga-theme" disableTransitionOnChange>
      <Provider store={store}>
        <BrowserRouter>
          <TooltipProvider>
            <Suspense fallback={null}>
              <App />
            </Suspense>
          </TooltipProvider>
        </BrowserRouter>
      </Provider>
    </ThemeProvider>
  </StrictMode>
);
