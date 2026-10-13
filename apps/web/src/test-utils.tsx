import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';

import { Toaster } from '@kodinga-mono-repo/ui';
import store from '@/redux/store';
import { AppRoutes } from '@/routes/router';
import type { CommunityCategory, CommunityListItem } from '@/utils/api/community/community.type';

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

/**
 * Fake GET communities/ over a list (q, category, privacy, pricing, is_featured, page, page_size:
 * 9 by default, like the api), GET communities/categories/ and DELETE communities/<slug>/
 * (archived: leaves the list). Returns the requested urls.
 */
export function stubDirectory(initial: CommunityListItem[], categories: CommunityCategory[] = []) {
  let communities = [...initial];
  const urls: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    urls.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('communities/categories/')) return json({ success: true, data: categories });
    if (request.method === 'DELETE') {
      const slug = url.pathname.split('/').filter(Boolean).at(-1);
      communities = communities.filter((c) => c.slug !== slug);
      return json({ success: true, message: 'Archived' });
    }
    const p = url.searchParams;
    const q = (p.get('q') ?? '').toLowerCase();
    const found = communities.filter(
      (c) =>
        (!q || `${c.name} ${c.tagline} ${c.slug}`.toLowerCase().includes(q)) &&
        (!p.get('category') || c.category?.slug === p.get('category')) &&
        (!p.get('privacy') || c.privacy_type === p.get('privacy')) &&
        (!p.get('pricing') || c.pricing_type === p.get('pricing')) &&
        (!p.get('is_featured') || c.is_featured)
    );
    const page = Number(p.get('page') ?? 1);
    const size = Number(p.get('page_size') ?? 9);
    return json({
      success: true,
      pagination: { count: found.length, total_pages: Math.ceil(found.length / size), current_page: page, next: null, previous: null, page_size: size },
      results: found.slice((page - 1) * size, page * size),
    });
  });
  return urls;
}
