// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, YardForce.
// Mock settings only — no MQTT/persistence wiring yet. Values match docs/concept/
// openmower-app-concept.html ("More · settings" + "More · notifications") and
// openmower-desktop-concept.html ("Settings · notifications") exactly. Shared by Settings.tsx
// (mobile grouped list + desktop rail) and SettingsCategoryDetail.tsx (the detail body both
// breakpoints render), so the mock data has one source.
export const CONNECTION = {url: 'ws://…:9001', connected: true};
export const POSITIONING = 'Fixed';
export const DOCKING = 'Configured';
export const UNITS = 'Metric';
export const BASEMAP = 'Satellite · Esri';
export const APP_VERSION = '2026.7';

export const UNITS_OPTIONS = [
  {value: 'metric', label: 'Metric'},
  {value: 'imperial', label: 'Imperial'},
];

export const BASEMAP_OPTIONS = ['Satellite · Esri', 'Satellite · MML (Finland)', 'Terrain', 'Street'];

// Blade-wear + service readouts, moved here from the Activity · Stats tab (that's a
// statistic surface, not a maintenance one) — now the Settings · Maintenance category.
export const MAINTENANCE = {
  bladeWearHours: 38,
  bladeCapacityHours: 100,
  lastBladeChange: '2026-05-02',
  totalRuntimeHours: 214,
  nextService: '2026-09-01',
};

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
