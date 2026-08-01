// jsdom 30 removed the matchMedia stub that jsdom 29 shipped. readInitialTheme
// in locale.ts resolves the dark/light preference via matchMedia, so provide a
// minimal implementation for tests.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
