'use client';

import {useSyncExternalStore} from 'react';

/**
 * Tracks an arbitrary CSS media query via matchMedia (SSR-safe — same
 * useSyncExternalStore shape as `useBreakpoint`, generalized to any query so callers can
 * combine signals matchMedia already understands, e.g. orientation + a height cap to tell
 * "a phone turned sideways" apart from an actually-wide desktop viewport).
 */
export function useMediaQuery(query: string): boolean {
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
