import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { Toaster } from '@kodinga-mono-repo/ui';
import store from '@/redux/store';
import { AppRoutes } from '@/routes/router';

export const SLOW = { timeout: 3000 };

/** The app route tree at the given url (with the toaster of app.tsx); `where()` reads the current url */
export function renderAppAt(path: string) {
  const router = createMemoryRouter(AppRoutes, { initialEntries: [path] });
  const view = render(
    <Provider store={store}>
      <RouterProvider router={router} />
      <Toaster />
    </Provider>
  );
  return { ...view, where: () => router.state.location.pathname + router.state.location.search };
}
