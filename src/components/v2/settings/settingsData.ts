import type {ChipProps} from '@/components/v2/ui/Chip';
import type {Sensors} from '@/stores/schemas';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, YardForce.
// Values match docs/concept/openmower-app-concept.html ("More · settings" + "More ·
// notifications") and openmower-desktop-concept.html ("Settings · notifications") exactly.
// Shared by Settings.tsx (mobile grouped list + desktop rail) and SettingsCategoryDetail.tsx
// (the detail body both breakpoints render). Connection, Positioning/RTK, Docking station and
// Maintenance's blade-wear figures now read the real store (mowersStore via useSelectedMower)
// from those two files instead of mock constants — only Units/Basemap/Notifications/Safety/
// General stay app-only here (no backend concept of them yet).
export const UNITS = 'Metric';
export const BASEMAP = 'Satellite · Esri';
export const APP_VERSION = '2026.7';

export const UNITS_OPTIONS = [
  {value: 'metric', label: 'Metric'},
  {value: 'imperial', label: 'Imperial'},
];

export const BASEMAP_OPTIONS = ['Satellite · Esri', 'Satellite · MML (Finland)', 'Terrain', 'Street'];

// Blade-wear capacity readout: `interval_hours` on the mower's own `stats/json` (see
// BladeStatus in stores/schemas.ts) is the real per-mower service interval once telemetry
// has ticked at least once; this is only the fallback shown before that first message.
export const MAINTENANCE = {
  bladeCapacityHours: 100,
};

export type GpsSensor = NonNullable<Sensors['gps']>;

/** Fix-status copy for the Positioning/RTK category — shared by Settings.tsx's list-row
 *  preview and SettingsCategoryDetail's full chip so the two breakpoints never drift. */
export function gpsFixLabel(gps: GpsSensor | undefined): string {
  if (!gps) return 'No fix';
  if (gps.rtk_fixed) return 'RTK fixed';
  if (gps.rtk_float) return 'RTK float';
  if (gps.dead_reckoning) return 'Dead reckoning';
  if (gps.rtk) return 'RTK converging';
  return 'No fix';
}

export function gpsFixVariant(gps: GpsSensor | undefined): NonNullable<ChipProps['variant']> {
  if (!gps) return 'neutral';
  if (gps.rtk_fixed) return 'ok';
  if (gps.rtk_float || gps.dead_reckoning) return 'warn';
  if (gps.rtk) return 'info';
  return 'neutral';
}

export interface NotificationCategory {
  key: string;
  label: string;
  sub: string;
  defaultOn: boolean;
}

// Category order/copy from the desktop concept's Notifications detail pane.
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {key: 'safety', label: 'Safety stops', sub: 'Bumper hit, tilt, lift detected', defaultOn: true},
  {key: 'complete', label: 'Mowing complete', sub: 'A run finishes or returns to dock', defaultOn: true},
  {key: 'stuck', label: 'Stuck / needs help', sub: 'Wheel spin, GPS loss, out of bounds', defaultOn: true},
  {key: 'rainSkip', label: 'Rain-skip', sub: 'A scheduled run is skipped for rain', defaultOn: true},
  {key: 'lowBattery', label: 'Low battery', sub: 'Charge drops below 15% away from dock', defaultOn: false},
];

// Desktop concept's category rail — extended with "safety" (missing from the concept's
// own list) so desktop has the same path to the geofence/tilt-lift toggles that the
// mobile grouped list already drills into, via the same shared detail body.
export const DESKTOP_CATEGORIES = [
  {id: 'connection', label: 'Connection'},
  {id: 'positioning', label: 'Positioning / RTK'},
  {id: 'docking', label: 'Docking station'},
  {id: 'units', label: 'Units'},
  {id: 'basemap', label: 'Map basemap'},
  {id: 'safety', label: 'Safety'},
  {id: 'general', label: 'General'},
  {id: 'maintenance', label: 'Maintenance'},
  {id: 'notifications', label: 'Notifications'},
  {id: 'backup', label: 'Backup & Restore'},
  {id: 'about', label: 'About'},
];

// Labels for every category id used by either breakpoint's category list.
export const CATEGORY_LABELS: Record<string, string> = {
  connection: 'Connection',
  positioning: 'Positioning / RTK',
  docking: 'Docking station',
  units: 'Units',
  basemap: 'Map basemap',
  safety: 'Safety',
  general: 'General',
  maintenance: 'Maintenance',
  notifications: 'Notifications',
  backup: 'Backup & Restore',
  about: 'About',
};

export interface SafetyToggles {
  geofence: boolean;
  tiltLift: boolean;
}
