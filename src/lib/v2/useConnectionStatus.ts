'use client';

import {useMowersStore} from '@/stores/mowersStore';
import {useCallback, useEffect, useState} from 'react';

// Mirrors mowersStore's MqttStatus (src/stores/mowersStore.ts), plus 'degraded' -- a status
// this hook derives itself (see DEGRADED_THRESHOLD_MS below), not one mowersStore ever sets.
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline' | 'degraded';

const STATUSES: ConnectionStatus[] = ['connecting', 'connected', 'reconnecting', 'disconnected', 'offline', 'degraded'];

// How long a 'connected' mower can go without any inbound MQTT message before the link is
// treated as degraded rather than healthy. mowersStore's short keepalive (5s) means a properly
// dead socket is caught quickly on its own; this catches the in-between case of a stalled-but-
// still-open connection (bad wifi backlogging packets) well before that.
const DEGRADED_THRESHOLD_MS = 3000;
const DEGRADED_CHECK_INTERVAL_MS = 1000;

function isConnectionStatus(value: string | null): value is ConnectionStatus {
  return value !== null && (STATUSES as string[]).includes(value);
}

// Dispatched as a window CustomEvent (same pattern as haptics.ts's `v2:haptics-change`) so any
// component — a dev toggle, the browser console — can force a status without a prop/context
// path into this hook.
const SIMULATE_EVENT = 'v2:simulate-connection';

/** Demo affordance: force the connection status shown by the banner, e.g. from the console —
 *  `window.dispatchEvent(new CustomEvent('v2:simulate-connection', {detail: 'disconnected'}))`
 *  — or import and call `simulateConnectionStatus('disconnected')` from anywhere (the
 *  `/v2/states` showcase has a toggle wired to this). Overrides the real status until the user
 *  taps Reconnect (or navigates away and the hook remounts). */
export function simulateConnectionStatus(status: ConnectionStatus) {
  window.dispatchEvent(new CustomEvent<ConnectionStatus>(SIMULATE_EVENT, {detail: status}));
}

/**
 * Real connection status for the selected mower — `{status, reconnect, degraded}`, read from
 * `useMowersStore`'s `mqttStatuses`/`reconnectNow` (see mowersStore.ts's `client.on(...)`
 * handlers, which set 'connecting'/'connected'/'reconnecting'/'disconnected'/'offline' per
 * mower id). `navigator.onLine === false` always wins, same as the store's own intent for the
 * 'offline' status. No mower selected yet (still booting/loading config) reads as 'connecting'.
 *
 * `status` can also read 'degraded': mowersStore's `lastRxAt` is bumped on every inbound MQTT
 * message for the mower, and if a nominally-'connected' link goes quiet for longer than
 * DEGRADED_THRESHOLD_MS this hook reports 'degraded' instead — catching a stalled-but-open wifi
 * connection well before mqtt.js's own close/offline events would fire.
 *
 * A demo override can still force the displayed status (for `/v2/states` and manual testing)
 * without touching the real MQTT connection:
 *  - a `?conn=disconnected|reconnecting|offline|connecting|degraded` query param on any /v2 URL,
 *    read once on mount;
 *  - `simulateConnectionStatus(status)` (above);
 *  - the toggle on `/v2/states`.
 * The override is cleared by `reconnect()` so a real reconnect always shows the real status.
 */
export function useConnectionStatus(): {status: ConnectionStatus; reconnect: () => void; degraded: boolean} {
  const realStatus = useMowersStore((s) => {
    const mower = s.mowers[s.selected];
    return mower ? s.mqttStatuses[mower.id] : undefined;
  });
  const lastRxAt = useMowersStore((s) => {
    const mower = s.mowers[s.selected];
    return mower ? s.lastRxAt[mower.id] : undefined;
  });
  const reconnectNow = useMowersStore((s) => s.reconnectNow);

  const [browserOnline, setBrowserOnline] = useState(true);
  const [simulated, setSimulated] = useState<ConnectionStatus | null>(null);
  const [degraded, setDegraded] = useState(false);

  // Only 'connected' can be degraded -- anything else already has its own (more specific)
  // not-healthy status. Polls rather than a single timeout so it keeps re-checking as long as
  // the mower stays quiet, instead of firing once and going stale.
  useEffect(() => {
    if (realStatus !== 'connected' || lastRxAt === undefined) {
      setDegraded(false);
      return;
    }
    const check = () => setDegraded(Date.now() - lastRxAt > DEGRADED_THRESHOLD_MS);
    check();
    const id = setInterval(check, DEGRADED_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [realStatus, lastRxAt]);

  useEffect(() => {
    setBrowserOnline(navigator.onLine);

    const fromQuery = new URLSearchParams(window.location.search).get('conn');
    if (isConnectionStatus(fromQuery)) {
      setSimulated(fromQuery);
    }

    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onSimulate = (e: Event) => {
      const detail = (e as CustomEvent<ConnectionStatus>).detail;
      if (isConnectionStatus(detail)) setSimulated(detail);
    };
    window.addEventListener(SIMULATE_EVENT, onSimulate);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(SIMULATE_EVENT, onSimulate);
    };
  }, []);

  // A real reconnect is an explicit "show me the truth" action, so it drops any demo override
  // in addition to kicking the mower's MQTT client(s) (mirrors mowersStore's own reconnectNow()
  // -> a 'reconnecting' event fires immediately, then 'connect' shortly after).
  const reconnect = useCallback(() => {
    setSimulated(null);
    reconnectNow();
  }, [reconnectNow]);

  const status: ConnectionStatus = !browserOnline
    ? 'offline'
    : (simulated ?? (degraded && realStatus === 'connected' ? 'degraded' : realStatus) ?? 'connecting');

  return {status, reconnect, degraded: status === 'degraded'};
}
