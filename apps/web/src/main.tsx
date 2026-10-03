import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { TooltipProvider } from '@kodinga-mono-repo/ui';
import store from '@/redux/store';
import '@/utils/i18n';

const App = lazy(() => import('./app/app'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <TooltipProvider>
          <Suspense fallback={null}>
            <App />
          </Suspense>
        </TooltipProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
