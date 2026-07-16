'use client';

import {useSyncExternalStore} from 'react';

/**
 * Tracks a single CSS breakpoint via matchMedia. Used only where *structure* (not just
 * layout) differs between mobile and desktop — e.g. HoldToUnlock's slide-vs-press-and-hold
 * gesture. Pure CSS (flex/grid + `md:` classes) is preferred everywhere else — see
 * component-library.md §5.
 */
export function useBreakpoint(query = '(min-width: 768px)') {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false,
  );
}
