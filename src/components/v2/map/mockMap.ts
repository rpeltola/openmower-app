// Mock map world for the v2 Map foundation — shaped to match the real gateway/store schemas
// (src/stores/schemas.ts: zones with metric `outline` points, docking `position`, pose x/y/heading,
// footprint front/rear/half_width) so wiring live data later is a swap, not a rewrite. Metres in
// the OpenMower local ENU frame (x east, y north); datum = the Finland garden.
import type {Footprint, Origin, Pose} from '@/lib/v2/geo/projection';

// 'nav' displays as "Pathway" and 'obstacle' as "No-go zone" in the UI (MAP_SCREEN_SPEC S3) — the
// internal type strings stay as-is (existing data model / firmware-facing semantics), only the
// user-facing labels changed. 'spot' is net-new: a one-off mow patch, not part of a larger area.
export type ZoneType = 'mow' | 'nav' | 'obstacle' | 'spot';

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  mow: 'Mowing area',
  nav: 'Pathway',
  obstacle: 'No-go zone',
  spot: 'Spot-mow region',
};

/** 'mow' and 'spot' are both areas the robot actually mows (a spot region is just a smaller,
 *  standalone one) — used wherever mow-only behavior (settings, coverage preview, net-mowable,
 *  orphan-obstacle containment) should also apply to spot regions. */
export function isMowableType(type: ZoneType): boolean {
  return type === 'mow' || type === 'spot';
}

// Per-area mowing/navigation overrides (mow zones only) — synthesis of v1's "mowing settings
// overrides", the v2 concept's area-settings screen, and Yarbo/competitor per-area settings
// research. EVERY field is optional: absence = inherit GLOBAL_DEFAULTS below (v1's exact model —
// there's no separate "override enabled" flag, an unset field just falls back).
export interface AreaSettings {
  // v1 overrides (real keys + semantics, so wiring to the gateway later is a swap not a rewrite).
  /** Mow direction, RADIANS, 0 = east. undefined = auto-detect from the first ~2m of the outline. */
  angle?: number;
  /** Perimeter-following lap count (int >= 0). */
  outline_count?: number;
  /** Extra overlap laps beyond outline_count (int >= 0). */
  outline_overlap_count?: number;
  /** Inward safety margin from the drawn outline, meters (+ = inward). */
  outline_offset?: number;
  // Concept + net-new (Yarbo-inspired; mock keys, naming is ours).
  route_pattern?: 'parallel' | 'spiral' | 'grid' | 'adaptive';
  mow_speed?: 'slow' | 'normal' | 'fast';
  turning_mode?: 'smart' | 'uturn' | 'zeroturn';
  perimeter_direction?: 'auto' | 'cw' | 'ccw';
  /** true (default) = perimeter laps before infill; false = infill first. */
  perimeter_first?: boolean;
  /** Rotate the fill pattern between sessions, anti-rut. */
  rotate_between_sessions?: boolean;
  /** Run a mow pass along no-go/obstacle edges too. */
  mow_ngz_edges?: boolean;
  /** Advisory/aspirational — see the hardware caveat in AreaSettingsSheet.tsx (no motorized deck). */
  cutting_height_mm?: number;
}

/** Every AreaSettings field falls back to this when unset. `angle` is excluded: undefined always
 *  means "auto-detect", not a fixed global default. */
export type MowingDefaults = Required<Omit<AreaSettings, 'angle'>>;

export const GLOBAL_DEFAULTS: MowingDefaults = {
  outline_count: 4,
  outline_overlap_count: 0,
  outline_offset: 0.1,
  route_pattern: 'parallel',
  mow_speed: 'normal',
  turning_mode: 'smart',
  perimeter_direction: 'auto',
  perimeter_first: true,
  rotate_between_sessions: false,
  mow_ngz_edges: false,
  cutting_height_mm: 45,
};

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  /** Absence = active (true) — matches v1's "no explicit enabled flag" model. */
  active?: boolean;
  // Implicit-closed ring: the last point connects back to outline[0] (Leaflet's L.polygon does
  // this automatically); we never duplicate outline[0] as a trailing last point. So there's no
  // separate "first/last vertex" to keep synced — every edit (nudge/snap/brush/multi/insert/
  // delete) already operates on this single shared first==last vertex, a no-op by construction.
  outline: {x: number; y: number}[];
  /** Mowing/navigation overrides — only meaningful (and only shown) for type 'mow'. */
  settings?: AreaSettings;
}

export const MOCK_ORIGIN: Origin = {lat: 60.96350785, lng: 25.359377186};

// A small garden: one mow area with a flowerbed obstacle inside, a nav strip to the side.
export const MOCK_ZONES: Zone[] = [
  {
    id: 'etupiha',
    name: 'Etupiha',
    type: 'mow',
    outline: [
      {x: -9, y: -6},
      {x: 9, y: -6.5},
      {x: 9.5, y: 6},
      {x: -8.5, y: 6.5},
    ],
  },
  {
    id: 'flowerbed',
    name: 'Flowerbed',
    type: 'obstacle',
    outline: [
      {x: 2, y: 1},
      {x: 4.2, y: 0.8},
      {x: 4.4, y: 3},
      {x: 2.2, y: 3.2},
    ],
  },
  {
    id: 'transit',
    name: 'Side path',
    type: 'nav',
    outline: [
      {x: 9.5, y: 6},
      {x: 13, y: 6},
      {x: 13, y: -6.5},
      {x: 9, y: -6.5},
    ],
  },
];

export interface Dock {
  position: {x: number; y: number};
}

export const MOCK_DOCK: Dock = {position: {x: -8, y: -5.5}};

// Robot mid-mow, heading roughly north-east (radians CCW from +x/east).
export const MOCK_POSE: Pose = {x: -1.5, y: 0.5, heading: 0.6};

// YardForce-ish footprint (base_link: +x = front/charge port). ~0.63 m long × ~0.56 m wide.
export const MOCK_FOOTPRINT: Footprint = {front_m: 0.36, rear_m: 0.27, half_width_m: 0.28};

// Fixed map geometry colors for the satellite-imagery mini-maps (Home MapCard, activity
// ReplayMap) — identical in light/dark since they sit over tile imagery, not app chrome.
// The full MapCanvas editor no longer reads this: its zones are theme-aware via the
// .v2-zone-<type> CSS classes in tailwind.css, so they also read against the Minimal
// (no-tile) basemap in both themes.
export const ZONE_STYLE: Record<ZoneType, {stroke: string; fill: string}> = {
  mow: {stroke: '#2fd58a', fill: '#2fd58a'},
  obstacle: {stroke: '#ff6b5e', fill: '#ff6b5e'},
  nav: {stroke: '#5aa9ff', fill: '#5aa9ff'},
  spot: {stroke: '#fbbf24', fill: '#fbbf24'},
};
