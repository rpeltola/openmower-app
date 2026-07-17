'use client';

import {useEffect, useState} from 'react';

/** L3 "backend support" registry (STATE_COMMAND_MODEL.md §4) — DISTINCT from `capabilities.ts`
 *  (L1, hardware) and the live `commands` gate (L2, per-state). This layer answers "does the
 *  mower's *software* implement this control at all yet", not "does the hardware exist" or
 *  "is it allowed right now". Static for the integration phase; each entry is the seam a real
 *  capability/version negotiation drops onto later — flipping `supported` to `true` is the
 *  entire migration for a control once the backend ships it. */
export type FeatureId =
  | 'cameras'
  | 'pushNotifications'
  | 'schedules'
  | 'cuttingHeight'
  | 'backup'
  | 'bladeToggle'
  | 'safetyWrites'
  // D7 per-area planner params (AREA_SETTINGS_SPEC.md) — currently mock/local-only zone
  // settings with no mower-side consumer.
  | 'routePattern'
  | 'mowSpeed'
  | 'turningMode'
  | 'perimeterPasses'
  | 'rotateBetweenSessions'
  | 'mowNgzEdges';

export interface FeatureSupportEntry {
  /** False = the backend doesn't implement this yet. Every entry here is `false` today —
   *  flip in place as the mower's software ships each one. */
  supported: boolean;
  /** Short human label for the control, shown alongside the "not supported yet" tag. */
  label: string;
  /** Honest, specific explanation of what's missing — shown as the reason for the greyed
   *  state when the dev toggle reveals it. */
  reason?: string;
}

// MOCK — every deferred V2 control the backend doesn't support yet, kept (not deleted) so the
// dev toggle below can surface the exact gap list. See STATE_COMMAND_MODEL.md §4.
export const FEATURE_SUPPORT: Record<FeatureId, FeatureSupportEntry> = {
  cameras: {
    supported: false,
    label: 'Camera view',
    reason: "Live camera streaming isn't wired to the mower's software yet.",
  },
  pushNotifications: {
    supported: false,
    label: 'Push notifications',
    reason: "Push notifications aren't implemented on the backend yet.",
  },
  schedules: {
    supported: false,
    label: 'Schedules',
    reason: "Scheduling isn't supported by your mower's software yet.",
  },
  cuttingHeight: {
    supported: false,
    label: 'Cutting height control',
    reason: 'No motorized cutting deck on this mower — height adjustment has nothing to act on.',
  },
  backup: {
    supported: false,
    label: 'Backup & restore',
    reason: "Backup & restore needs a mower-side RPC that doesn't exist yet.",
  },
  bladeToggle: {
    supported: false,
    label: 'Manual blade on/off',
    reason: "Manual blade toggling isn't exposed by the mower's software yet — the blade only runs during a mow.",
  },
  safetyWrites: {
    supported: false,
    label: 'Safety setting writes',
    reason: "Safety toggles (geofence, tilt/lift) aren't synced to the mower yet — changes here are local only.",
  },
  routePattern: {
    supported: false,
    label: 'Route pattern',
    reason: "The mower's coverage planner doesn't support pattern selection yet — it's a local-only preview.",
  },
  mowSpeed: {
    supported: false,
    label: 'Mow speed',
    reason: "Per-area mow speed isn't sent to the mower yet — it's a local-only preview.",
  },
  turningMode: {
    supported: false,
    label: 'Turning mode',
    reason: "Turning-mode selection isn't implemented on the mower yet.",
  },
  perimeterPasses: {
    supported: false,
    label: 'Perimeter passes',
    reason: "Outline/perimeter pass count isn't sent to the mower's coverage planner yet.",
  },
  rotateBetweenSessions: {
    supported: false,
    label: 'Rotate pattern between sessions',
    reason: "Anti-rut pattern rotation between sessions isn't implemented on the mower yet.",
  },
  mowNgzEdges: {
    supported: false,
    label: 'Mow no-go-zone edges',
    reason: "Mowing along no-go/obstacle edges isn't implemented on the mower yet.",
  },
};

/** Synchronous check — does the mower's software support this feature yet. */
export function isFeatureSupported(id: FeatureId): boolean {
  return FEATURE_SUPPORT[id].supported;
}

/** The one place a control reads its L3 registry entry from. Static today; the entries
 *  themselves are the seam a real capability/version check replaces later, so call sites
 *  never need to change. */
export function useFeatureSupport(id: FeatureId): FeatureSupportEntry {
  return FEATURE_SUPPORT[id];
}

// --- "Show controls not yet supported by your mower" dev toggle (Settings → General) ---
// Same in-memory-mirror-of-localStorage pattern as `haptics.ts`/`theme.ts`: a plain function
// pair for imperative reads/writes, plus a hook that re-renders on change (this tab or another).

const TOGGLE_STORAGE_KEY = 'v2.showUnsupportedFeatures';
const TOGGLE_CHANGE_EVENT = 'v2:showUnsupportedFeatures-change';

let cachedShowUnsupported: boolean | null = null;

function readShowUnsupportedStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TOGGLE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Synchronous, SSR-safe read of the dev toggle — defaults to off (unsupported controls
 *  stay hidden unless a user has explicitly opted in). */
export function isShowUnsupportedFeaturesEnabled(): boolean {
  if (cachedShowUnsupported === null) cachedShowUnsupported = readShowUnsupportedStored();
  return cachedShowUnsupported;
}

/** Persists the toggle and notifies `useShowUnsupportedFeatures()` subscribers, including
 *  ones in this same tab (the native `storage` event only fires in *other* tabs). */
export function setShowUnsupportedFeatures(enabled: boolean): void {
  cachedShowUnsupported = enabled;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOGGLE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // private mode / quota exceeded — preference just won't survive reload
  }
  window.dispatchEvent(new Event(TOGGLE_CHANGE_EVENT));
}

/** Reads the "show unsupported controls" dev toggle and re-renders when it changes, in this
 *  tab or another. */
export function useShowUnsupportedFeatures(): boolean {
  const [enabled, setEnabled] = useState(isShowUnsupportedFeaturesEnabled);

  useEffect(() => {
    const sync = () => {
      cachedShowUnsupported = readShowUnsupportedStored();
      setEnabled(cachedShowUnsupported);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(TOGGLE_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(TOGGLE_CHANGE_EVENT, sync);
    };
  }, []);

  return enabled;
}
