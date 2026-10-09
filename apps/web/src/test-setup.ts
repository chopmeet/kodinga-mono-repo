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
