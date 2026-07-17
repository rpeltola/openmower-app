'use client';

import {useEffect, useState} from 'react';

export type Theme = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: {value: Theme; label: string}[] = [
  {value: 'system', label: 'System'},
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
];

// NOTE: there was no pre-existing persisted theme preference to reuse — the blocking
// script in src/app/layout.tsx and ThemeRegistry.tsx only ever derive data-theme from
// `matchMedia('(prefers-color-scheme: dark)')`, they don't read/write localStorage. This
// key is new; the two mechanisms below cooperate with that script over the shared
// `data-theme` attribute rather than a shared storage key.
const STORAGE_KEY = 'v2.theme';
const CHANGE_EVENT = 'v2:theme-change';

// In-memory mirror of localStorage, mirroring the haptics.ts pattern, so the current
// choice can be read synchronously without re-parsing storage on every call.
let cached: Theme | null = null;

function readStored(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Stamps (or clears) `data-theme` on `<html>`: 'light'/'dark' set it explicitly so the
 *  `:root[data-theme=...]` override blocks in tailwind.css take over; 'system' removes it
 *  so the plain `@media (prefers-color-scheme)` rules apply instead. */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/** Synchronous, SSR-safe read of the current theme preference — defaults to 'system'. */
export function getTheme(): Theme {
  if (cached === null) cached = readStored();
  return cached;
}

/** Persists the choice, applies it to `<html>` immediately, and notifies `useTheme()`
 *  subscribers, including ones in this same tab (the native `storage` event only fires
 *  in *other* tabs). */
export function setTheme(theme: Theme): void {
  cached = theme;
  applyTheme(theme);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / quota exceeded — preference just won't survive reload
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Re-assert the persisted choice as soon as this module loads in the browser: the
// blocking script in layout.tsx only knows the OS preference at first paint, so this
// reapplies an explicit light/dark override the moment code that imports this module runs.
applyTheme(getTheme());

/** Reads the theme preference and re-renders when it changes, in this tab or another.
 *  Also tracks `systemIsDark` (kept live via the media-query listener) so callers can
 *  render a "currently: dark" style hint under the System option — it's display-only and
 *  never overrides an explicit light/dark choice. */
export function useTheme(): {theme: Theme; setTheme: (theme: Theme) => void; systemIsDark: boolean} {
  const [theme, setThemeState] = useState(getTheme);
  const [systemIsDark, setSystemIsDark] = useState(systemPrefersDark);

  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    setSystemIsDark(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return {theme, setTheme, systemIsDark};
}
