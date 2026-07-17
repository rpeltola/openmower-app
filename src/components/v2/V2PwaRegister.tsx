'use client';

import {Serwist} from '@serwist/window';
import {useEffect} from 'react';

/**
 * Registers the service worker for the v2 app.
 *
 * v1's `PwaManager` (which registers the SW) is only mounted on non-`/v2` routes — `AppChrome`
 * returns bare children for `/v2` to keep MUI out of the v2 tree. Without this component the SW
 * therefore never registers while you're in the v2 app, so v2 gets no offline caching, no
 * standalone install (Chrome offers only an address-bar "shortcut"), and no web-push foundation.
 *
 * Registration is silent/automatic — there is no user prompt for it (the install prompt and the
 * "update available" prompt are separate, user-facing things). The SW is disabled in development
 * (`next.config.ts` serwist `disable: NODE_ENV === 'development'`), so this is a no-op under
 * `next dev`/`dev:https` and only takes effect in a production build served over a secure context.
 */
export function V2PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Only register in production. The SW is disabled in development (next.config serwist
    // `disable`), and attempting to register over the dev server's self-signed cert fails the
    // secure-context check with an SSL error — so skip it entirely in dev.
    if (process.env.NODE_ENV !== 'production') return;
    const sw = new Serwist('/sw.js', {scope: '/'});
    // Reload only when a NEW worker takes control (an update), not on the first-ever install —
    // mirrors v1's PwaManager guard so first visits don't reload themselves.
    let refreshing = false;
    sw.addEventListener('controlling', (event) => {
      if (event.isUpdate && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
    // Registration can still fail on an untrusted/misconfigured origin — swallow it rather than
    // surfacing an unhandled rejection.
    sw.register().catch(() => {});
  }, []);
  return null;
}
