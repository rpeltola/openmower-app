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

// Desktop concept's category rail — this is the concept's own list (it omits "Safety",
// unlike the mobile grouped list, which has one and drills into the same detail body).
export const DESKTOP_CATEGORIES = [
  {id: 'connection', label: 'Connection'},
  {id: 'positioning', label: 'Positioning / RTK'},
  {id: 'docking', label: 'Docking station'},
  {id: 'units', label: 'Units'},
  {id: 'basemap', label: 'Map basemap'},
  {id: 'notifications', label: 'Notifications'},
  {id: 'about', label: 'About'},
];

// Superset of DESKTOP_CATEGORIES's labels — also covers "safety", which the desktop rail
// omits but the mobile grouped list (and the shared detail body) both support.
export const CATEGORY_LABELS: Record<string, string> = {
  connection: 'Connection',
  positioning: 'Positioning / RTK',
  docking: 'Docking station',
  units: 'Units',
  basemap: 'Map basemap',
  safety: 'Safety',
  notifications: 'Notifications',
  about: 'About',
};

export interface SafetyToggles {
  geofence: boolean;
  tiltLift: boolean;
}
