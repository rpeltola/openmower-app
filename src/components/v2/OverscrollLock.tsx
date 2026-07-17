'use client';

import {useEffect} from 'react';

/**
 * Disables Chrome's overscroll **pull-to-refresh** (and vertical overscroll chaining) while a v2
 * route is mounted. In an app-like UI — especially the manual-control driving page — accidentally
 * yanking a page refresh on an over-scroll is disruptive. `overscroll-behavior-y: contain` keeps
 * normal scrolling intact and only suppresses the browser's pull-to-refresh gesture.
 *
 * Scoped to v2: it sets the style on mount and restores the previous value on unmount, so v1 (which
 * shares the same <html>/<body>) is unaffected once you navigate away from /v2. Set on both the
 * documentElement and body since either can be the top-level scroller depending on the screen.
 */
export function OverscrollLock() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const {body} = document;
    const prevHtml = html.style.overscrollBehaviorY;
    const prevBody = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'contain';
    body.style.overscrollBehaviorY = 'contain';
    return () => {
      html.style.overscrollBehaviorY = prevHtml;
      body.style.overscrollBehaviorY = prevBody;
    };
  }, []);
  return null;
}
