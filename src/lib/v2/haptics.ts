'use client';

import {useEffect, useState} from 'react';

const STORAGE_KEY = 'v2.haptics';
const CHANGE_EVENT = 'v2:haptics-change';

// In-memory mirror of localStorage so `haptic()` can check the preference synchronously
// (no hook available in plain event handlers) without re-parsing storage on every call.
let cached: boolean | null = null;

function readStored(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

/** Synchronous, SSR-safe read of the haptics preference — defaults to on. */
export function isHapticsEnabled(): boolean {
  if (cached === null) cached = readStored();
  return cached;
}

/** Persists the preference and notifies `useHapticsEnabled()` subscribers, including ones
 *  in this same tab (the native `storage` event only fires in *other* tabs). */
export function setHapticsEnabled(enabled: boolean): void {
  cached = enabled;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // private mode / quota exceeded — preference just won't survive reload
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Reads the haptics preference and re-renders when it changes, in this tab or another. */
export function useHapticsEnabled(): boolean {
  const [enabled, setEnabled] = useState(isHapticsEnabled);

  useEffect(() => {
    const sync = () => {
      cached = readStored();
      setEnabled(cached);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  return enabled;
}

// Safari has no Vibration API, but iOS 17.4+ fires a haptic tap when a `switch`-styled
// checkbox is toggled — momentarily mount one off-screen and click it. Best-effort only:
// silently no-ops on older iOS/other browsers that don't recognize the `switch` attribute.
function iosSwitchHapticFallback(): void {
  if (typeof document === 'undefined') return;
  try {
    const label = document.createElement('label');
    label.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    input.click();
    label.remove();
  } catch {
    // best-effort only
  }
}

/** Fires tactile feedback, respecting the user's haptics preference. `pattern` matches
 *  `navigator.vibrate`'s argument (ms, or an on/off sequence) and is ignored by the iOS
 *  fallback, which can only ever produce a single fixed tap. No-ops during SSR. */
export function haptic(pattern: number | number[] = 10): void {
  if (!isHapticsEnabled()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
    return;
  }
  iosSwitchHapticFallback();
}

/** Light tap — the default for ordinary button presses. */
export function hapticTap(): void {
  haptic(10);
}

/** Firmer buzz for danger/important actions (e.g. stop, delete, e-stop). */
export function hapticStrong(): void {
  haptic([0, 25]);
}

interface VibrationActuatorLike {
  playEffect?: (type: 'dual-rumble', params: Record<string, unknown>) => void;
}

/** Best-effort controller buzz on the first connected gamepad that supports dual-rumble,
 *  for key actions during gamepad-driven manual control. No-ops if nothing is connected
 *  or the browser/pad doesn't support the Vibration Actuator API. */
export function rumbleGamepad(ms = 120): void {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  try {
    for (const pad of navigator.getGamepads()) {
      const actuator = pad?.vibrationActuator as VibrationActuatorLike | undefined;
      actuator?.playEffect?.('dual-rumble', {
        duration: ms,
        startDelay: 0,
        strongMagnitude: 0.6,
        weakMagnitude: 0.6,
      });
    }
  } catch {
    // best-effort only
  }
}
