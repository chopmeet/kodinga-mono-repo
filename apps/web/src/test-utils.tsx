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

/** Test data that must exist: fails with a clear message instead of a non-null assertion */
export function must<T>(value: T | null | undefined, what = 'test data'): T {
  if (value == null) throw new Error(`Missing ${what}`);
  return value;
}

type Call = { url: string; method: string; body: unknown };

/** Stubs fetch with one answer per api path; returns the calls made */
export function stubApi(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = request.url;
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ url, method: request.method, body: text ? JSON.parse(text) : null });
    const path = Object.keys(routes).find((p) => new URL(url).pathname.endsWith(p));
    const answer = path ? routes[path] : { status: 404, body: { success: false, code: 'not_found', message: 'Not found' } };
    return new Response(JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}
