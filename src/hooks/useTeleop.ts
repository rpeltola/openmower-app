import {useMowersStore} from '@/stores/mowersStore';
import {useCallback, useEffect, useRef} from 'react';

const PUBLISH_INTERVAL_MS = 100;

// Over poor wifi, stale movement packets can back up in the in-order MQTT-over-WebSocket
// (TCP) buffer, so a single zero-twist sent on release can drain behind them and arrive
// ~seconds late -- the mower keeps rolling after the user let go. The firmware has a 1s
// "no packet -> stop" watchdog, so keep re-publishing the zero-twist at the normal rate for
// a bit after release instead of sending just one: even if the stop itself is delayed, the
// watchdog reliably catches it well within this window.
const STOP_REPEAT_MS = 1200;

export function useTeleop() {
  const vel = useRef({vx: 0, vz: 0});
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publish = useCallback(() => {
    const {mowers, selected} = useMowersStore.getState();
    mowers[selected]?.publishTeleop(vel.current.vx, vel.current.vz);
  }, []);

  const clearStopTimeout = useCallback(() => {
    if (stopTimeout.current !== null) {
      clearTimeout(stopTimeout.current);
      stopTimeout.current = null;
    }
  }, []);

  const setVelocity = useCallback(
    (vx: number, vz: number) => {
      vel.current = {vx: Math.max(-1, Math.min(1, vx)), vz: Math.max(-1, Math.min(1, vz))};

      const moving = vx !== 0 || vz !== 0;
      const wasMoving = interval.current !== null;

      if (moving) {
        // Resuming movement (including during a stop-repeat window) cancels any pending
        // teardown so the interval just keeps publishing the new velocity.
        clearStopTimeout();
        if (!wasMoving) {
          publish();
          interval.current = setInterval(publish, PUBLISH_INTERVAL_MS);
        }
      } else if (!moving && wasMoving && stopTimeout.current === null) {
        // Release: don't clear the interval yet. Keep it publishing the zero-twist (vel.current
        // is now {0,0}) for STOP_REPEAT_MS, then tear it down. Guarded on `stopTimeout.current
        // === null` so a REDUNDANT setVelocity(0,0) while a stop-repeat is already counting down
        // (e.g. the consumer re-renders at telemetry cadence and re-fires the same zero) does NOT
        // restart the teardown timer -- otherwise a steady re-render faster than STOP_REPEAT_MS
        // would perpetually reset it and the interval would publish zero-twist forever instead of
        // tearing down after the window.
        publish();
        stopTimeout.current = setTimeout(() => {
          if (interval.current !== null) {
            clearInterval(interval.current);
            interval.current = null;
          }
          stopTimeout.current = null;
        }, STOP_REPEAT_MS);
      }
    },
    [publish, clearStopTimeout],
  );

  useEffect(() => {
    return () => {
      clearStopTimeout();
      if (interval.current !== null) clearInterval(interval.current);
      vel.current = {vx: 0, vz: 0};
      publish();
    };
  }, []);

  return {setVelocity};
}
