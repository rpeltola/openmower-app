import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement ResizeObserver, which Leaflet (LiveFollowMap) uses on mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
