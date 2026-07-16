// Mock map world for the v2 Map foundation — shaped to match the real gateway/store schemas
// (src/stores/schemas.ts: zones with metric `outline` points, docking `position`, pose x/y/heading,
// footprint front/rear/half_width) so wiring live data later is a swap, not a rewrite. Metres in
// the OpenMower local ENU frame (x east, y north); datum = the Finland garden.
import type {Footprint, Origin, Pose} from '@/lib/v2/geo/projection';

export type ZoneType = 'mow' | 'nav' | 'obstacle';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  // Implicit-closed ring: the last point connects back to outline[0] (Leaflet's L.polygon does
  // this automatically); we never duplicate outline[0] as a trailing last point. So there's no
  // separate "first/last vertex" to keep synced — every edit (nudge/snap/brush/multi/insert/
  // delete) already operates on this single shared first==last vertex, a no-op by construction.
  outline: {x: number; y: number}[];
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

export const MOCK_DOCK: {position: {x: number; y: number}} = {position: {x: -8, y: -5.5}};

// Robot mid-mow, heading roughly north-east (radians CCW from +x/east).
export const MOCK_POSE: Pose = {x: -1.5, y: 0.5, heading: 0.6};

// YardForce-ish footprint (base_link: +x = front/charge port). ~0.63 m long × ~0.56 m wide.
export const MOCK_FOOTPRINT: Footprint = {front_m: 0.36, rear_m: 0.27, half_width_m: 0.28};

// Fixed map geometry colors — identical in light/dark (map readability rule: theme changes only
// the UI chrome, never map line/point colors). Chosen to read on satellite imagery.
export const ZONE_STYLE: Record<ZoneType, {stroke: string; fill: string}> = {
  mow: {stroke: '#2fd58a', fill: '#2fd58a'},
  obstacle: {stroke: '#ff6b5e', fill: '#ff6b5e'},
  nav: {stroke: '#5aa9ff', fill: '#5aa9ff'},
};
