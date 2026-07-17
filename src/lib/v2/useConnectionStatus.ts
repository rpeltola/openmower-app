'use client';

import {useCallback, useEffect, useState} from 'react';

// Mirrors mowersStore's MqttStatus (src/stores/mowersStore.ts) exactly, so this hook can be
// swapped later for one that reads `useMowersStore`'s `mqttStatuses`/`reconnectNow` without
// touching any call site (ConnectionBanner only ever sees `{status, reconnect}`).
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline';

const STATUSES: ConnectionStatus[] = ['connecting', 'connected', 'reconnecting', 'disconnected', 'offline'];

function isConnectionStatus(value: string | null): value is ConnectionStatus {
  return value !== null && (STATUSES as string[]).includes(value);
}

// Dispatched as a window CustomEvent (same pattern as haptics.ts's `v2:haptics-change`) so any
// component — a dev toggle, the browser console — can force a status without a prop/context
// path into this hook.
const SIMULATE_EVENT = 'v2:simulate-connection';

/** Demo affordance: force the mock connection status, e.g. from the console —
 *  `window.dispatchEvent(new CustomEvent('v2:simulate-connection', {detail: 'disconnected'}))`
 *  — or import and call `simulateConnectionStatus('disconnected')` from anywhere (the
 *  `/v2/states` showcase has a toggle wired to this). */
export function simulateConnectionStatus(status: ConnectionStatus) {
  window.dispatchEvent(new CustomEvent<ConnectionStatus>(SIMULATE_EVENT, {detail: status}));
}

/**
 * MOCK hook shaped exactly like the real thing will be — `{status, reconnect}` — so v2 has
 * something to surface a connection banner from before the store is actually wired (v2 is
 * still all-mock; see V2_STATUS.md's "Wire REAL data" TODO). Local state defaults to
 * 'connected'; `navigator.onLine` always wins over the mock status, same as the real
 * `offline` MqttStatus should.
 *
 * Simulate a disconnect for a demo three ways:
 *  - a `?conn=disconnected|reconnecting|offline|connecting` query param on any /v2 URL,
 *    read once on mount;
 *  - `simulateConnectionStatus(status)` (above);
 *  - the toggle on `/v2/states`.
 */
export function useConnectionStatus(): {status: ConnectionStatus; reconnect: () => void} {
  const [mockStatus, setMockStatus] = useState<ConnectionStatus>('connected');
  const [browserOnline, setBrowserOnline] = useState(true);

  useEffect(() => {
    setBrowserOnline(navigator.onLine);

    const fromQuery = new URLSearchParams(window.location.search).get('conn');
    if (isConnectionStatus(fromQuery)) {
      setMockStatus(fromQuery);
    }

    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onSimulate = (e: Event) => {
      const detail = (e as CustomEvent<ConnectionStatus>).detail;
      if (isConnectionStatus(detail)) setMockStatus(detail);
    };
    window.addEventListener(SIMULATE_EVENT, onSimulate);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(SIMULATE_EVENT, onSimulate);
    };
  }, []);

  // Mirrors mowersStore's own reconnectNow() -> a 'reconnecting' event fires immediately,
  // then 'connect' shortly after (see mqttClient.on('reconnect'/'connect') handlers).
  const reconnect = useCallback(() => {
    setMockStatus('reconnecting');
    window.setTimeout(() => setMockStatus('connected'), 900);
  }, []);

  return {
    status: browserOnline ? mockStatus : 'offline',
    reconnect,
  };
}
