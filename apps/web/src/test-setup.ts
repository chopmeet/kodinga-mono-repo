import { afterEach } from 'vitest';

// jsdom lacks window.matchMedia, used by sonner's <Toaster> and the sidebar (use-mobile hook).
// Minimal stand-in: no media query ever matches (desktop, light, no reduced motion).
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// The community space fixture of renderAppAt (test-utils.tsx) wraps fetch: unwrap it after each
// test. Not imported from test-utils: it loads the app, before the vi.mock of the test files
afterEach(() => {
  const inner = (globalThis.fetch as typeof fetch & { inner?: typeof fetch }).inner;
  if (inner) globalThis.fetch = inner;
});
