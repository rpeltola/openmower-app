'use client';

import {SettingsCategoryRail} from '@/components/v2/settings/SettingsCategoryRail';
import {SettingsGroup} from '@/components/v2/settings/SettingsGroup';
import {cn} from '@/components/v2/lib/cn';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {ListRow} from '@/components/v2/ui/ListRow';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {Switch} from '@/components/v2/ui/Switch';
import {FormField} from '@/components/v2/ui/FormField';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Bell, Check, ChevronRight, Info, LineChart, Map as MapIcon, Navigation, Shield, Sprout, Wifi, Zap} from 'lucide-react';
import {useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, YardForce.
// Mock settings only — no MQTT/persistence wiring yet. Values match docs/concept/
// openmower-app-concept.html ("More · settings" + "More · notifications") and
// openmower-desktop-concept.html ("Settings · notifications") exactly.
const CONNECTION = {url: 'ws://…:9001', connected: true};
const POSITIONING = 'Fixed';
const DOCKING = 'Configured';
const UNITS = 'Metric';
const BASEMAP = 'Satellite · Esri';
const APP_VERSION = '2026.7';

const UNITS_OPTIONS = [
  {value: 'metric', label: 'Metric'},
  {value: 'imperial', label: 'Imperial'},
];

const BASEMAP_OPTIONS = ['Satellite · Esri', 'Satellite · MML (Finland)', 'Terrain', 'Street'];

interface NotificationCategory {
  key: string;
  label: string;
  sub: string;
  defaultOn: boolean;
}

// Category order/copy from the desktop concept's Notifications detail pane.
const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {key: 'safety', label: 'Safety stops', sub: 'Bumper hit, tilt, lift detected', defaultOn: true},
  {key: 'complete', label: 'Mowing complete', sub: 'A run finishes or returns to dock', defaultOn: true},
  {key: 'stuck', label: 'Stuck / needs help', sub: 'Wheel spin, GPS loss, out of bounds', defaultOn: true},
  {key: 'rainSkip', label: 'Rain-skip', sub: 'A scheduled run is skipped for rain', defaultOn: true},
  {key: 'lowBattery', label: 'Low battery', sub: 'Charge drops below 15% away from dock', defaultOn: false},
];

// Desktop concept's category rail — this is the concept's own list (it omits "Safety",
// unlike the mobile grouped list a few rows below, which has one).
const DESKTOP_CATEGORIES = [
  {id: 'connection', label: 'Connection'},
  {id: 'positioning', label: 'Positioning / RTK'},
  {id: 'docking', label: 'Docking station'},
  {id: 'units', label: 'Units'},
  {id: 'basemap', label: 'Map basemap'},
  {id: 'notifications', label: 'Notifications'},
  {id: 'about', label: 'About'},
];

function DrillChevron() {
  return <ChevronRight size={15} strokeWidth={2.4} className="flex-none text-ink-faint" />;
}

function DrillValue({value}: {value: string}) {
  return (
    <span className="flex items-center gap-[.35rem]">
      <span className="text-[.72rem] text-ink-soft">{value}</span>
      <DrillChevron />
    </span>
  );
}

export function Settings() {
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, c.defaultOn])),
  );
  const [category, setCategory] = useState('notifications');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [basemapChoice, setBasemapChoice] = useState(BASEMAP);
  const [safetyToggles, setSafetyToggles] = useState({geofence: true, tiltLift: true});

  const categoryLabel = DESKTOP_CATEGORIES.find((c) => c.id === category)?.label ?? '';

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader kicker="Kotipiha" title="Settings" />

      {/* ===== Mobile: iOS-style grouped list — mower selector, then one tap deep ===== */}
      <div className="flex flex-1 flex-col gap-3 md:hidden">
        <SettingsGroup>
          <ListRow
            icon={
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-accent-wash text-accent">
                <Sprout size={19} strokeWidth={2} />
              </span>
            }
            title="YardForce"
            sub="Kotipiha"
            trailing={<DrillChevron />}
          />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow
            icon={<Wifi size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Connection"
            trailing={
              <span className="flex items-center gap-[.4rem]">
                <span className="font-mono text-[.68rem] tabular-nums text-ink-soft">{CONNECTION.url}</span>
                <span
                  className={cn('h-[7px] w-[7px] flex-none rounded-full', CONNECTION.connected ? 'bg-accent' : 'bg-danger')}
                />
              </span>
            }
          />
          <ListRow
            icon={<Navigation size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Positioning / RTK"
            trailing={<DrillValue value={POSITIONING} />}
          />
          <ListRow
            icon={<Zap size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Docking station"
            trailing={<DrillValue value={DOCKING} />}
          />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow
            icon={<LineChart size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Units"
            trailing={<DrillValue value={UNITS} />}
          />
          <ListRow
            icon={<MapIcon size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Map basemap"
            trailing={<DrillValue value={BASEMAP} />}
          />
          <ListRow
            icon={<Shield size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Safety"
            trailing={<DrillChevron />}
          />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow
            icon={<Bell size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Notifications"
            trailing={<DrillChevron />}
          />
          <ListRow
            icon={<Info size={15} strokeWidth={2} className="text-ink-soft" />}
            title="About"
            trailing={<span className="font-mono text-[.72rem] tabular-nums text-ink-soft">{APP_VERSION}</span>}
          />
        </SettingsGroup>
      </div>

      {/* ===== Desktop: category rail + detail pane — Notifications populated per the concept ===== */}
      <div className="hidden md:grid md:min-h-0 md:flex-1 md:grid-cols-[250px_1fr] md:gap-4">
        <SettingsCategoryRail
          categories={DESKTOP_CATEGORIES.map((c) =>
            c.id === 'connection'
              ? {...c, indicator: <span className="h-[7px] w-[7px] flex-none rounded-full bg-accent" />}
              : c,
          )}
          selected={category}
          onSelect={setCategory}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto">
          <div className="text-[1.05rem] font-[660] text-ink">{categoryLabel}</div>

          {category === 'connection' ? (
            <>
              <Card className="flex items-center gap-[.7rem] p-[.85rem]">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-accent-wash text-accent">
                  <Wifi size={17} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[.9rem] font-[640] text-ink">Broker</div>
                  <div className="font-mono text-[.78rem] text-ink-soft">{CONNECTION.url}</div>
                </div>
                <Chip variant={CONNECTION.connected ? 'ok' : 'danger'}>
                  {CONNECTION.connected ? 'Connected' : 'Disconnected'}
                </Chip>
              </Card>

              <SettingsGroup>
                <ListRow
                  title="Client ID"
                  trailing={<span className="font-mono text-[.72rem] text-ink-soft">yardforce-kotipiha</span>}
                />
                <ListRow title="TLS" trailing={<Chip variant="ok">Enabled</Chip>} />
              </SettingsGroup>
            </>
          ) : null}

          {category === 'positioning' ? (
            <SettingsGroup>
              <ListRow
                icon={<Navigation size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Fix status"
                trailing={<Chip variant="ok">RTK fixed</Chip>}
              />
              <ListRow
                title="Datum"
                trailing={<span className="font-mono text-[.72rem] text-ink-soft">ETRS89 / TM35FIN</span>}
              />
              <ListRow
                title="Horizontal accuracy"
                trailing={<span className="font-mono text-[.72rem] text-ink-soft">1.8 cm</span>}
              />
              <ListRow title="Satellites" trailing={<span className="font-mono text-[.72rem] text-ink-soft">21</span>} />
            </SettingsGroup>
          ) : null}

          {category === 'docking' ? (
            <SettingsGroup>
              <ListRow
                icon={<Zap size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Status"
                trailing={<Chip variant="ok">{DOCKING}</Chip>}
              />
              <ListRow title="Position" trailing={<span className="text-[.72rem] text-ink-soft">Kotipiha · NW corner</span>} />
              <ListRow
                title="Last calibrated"
                trailing={<span className="font-mono text-[.72rem] text-ink-soft">2026-06-02</span>}
              />
            </SettingsGroup>
          ) : null}

          {category === 'units' ? (
            <Card className="p-[.85rem]">
              <FormField
                label="Measurement units"
                hint="Applies to area, distance, and speed readouts throughout the app."
              >
                <SegmentedToggle
                  options={UNITS_OPTIONS}
                  value={units}
                  onChange={(v) => setUnits(v as 'metric' | 'imperial')}
                />
              </FormField>
            </Card>
          ) : null}

          {category === 'basemap' ? (
            <SettingsGroup>
              {BASEMAP_OPTIONS.map((opt) => (
                <ListRow
                  key={opt}
                  title={opt}
                  onClick={() => setBasemapChoice(opt)}
                  trailing={opt === basemapChoice ? <Check size={15} strokeWidth={2.6} className="text-accent" /> : undefined}
                />
              ))}
            </SettingsGroup>
          ) : null}

          {category === 'safety' ? (
            <SettingsGroup>
              <ListRow
                icon={<Shield size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Geofence enforcement"
                sub="Stop if the mower crosses the mapped boundary"
                trailing={
                  <Switch
                    checked={safetyToggles.geofence}
                    onCheckedChange={(checked) => setSafetyToggles((prev) => ({...prev, geofence: checked}))}
                    aria-label="Geofence enforcement"
                  />
                }
              />
              <ListRow
                title="Tilt / lift stop"
                sub="Stop the blade immediately if the mower is tilted or lifted"
                trailing={
                  <Switch
                    checked={safetyToggles.tiltLift}
                    onCheckedChange={(checked) => setSafetyToggles((prev) => ({...prev, tiltLift: checked}))}
                    aria-label="Tilt / lift stop"
                  />
                }
              />
            </SettingsGroup>
          ) : null}

          {category === 'notifications' ? (
            <>
              <Card className="flex items-center gap-[.7rem] p-[.85rem]">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-accent-wash text-accent">
                  <Bell size={17} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[.9rem] font-[640] text-ink">Enabled in this browser</div>
                  <div className="text-[.78rem] text-ink-soft">2 registered devices · manage in browser settings</div>
                </div>
                <Chip variant="ok">Enabled</Chip>
              </Card>

              <SettingsGroup>
                {NOTIFICATION_CATEGORIES.map((cat) => (
                  <ListRow
                    key={cat.key}
                    title={cat.label}
                    sub={cat.sub}
                    trailing={
                      <Switch
                        checked={notifications[cat.key] ?? cat.defaultOn}
                        onCheckedChange={(checked) => setNotifications((prev) => ({...prev, [cat.key]: checked}))}
                        aria-label={cat.label}
                      />
                    }
                  />
                ))}
              </SettingsGroup>

              <p className="text-[.76rem] leading-[1.5] text-ink-faint">
                On iOS, delivery isn&apos;t guaranteed while Low Power Mode is on — allow OpenMower under
                Settings → Notifications if alerts feel delayed.
              </p>
            </>
          ) : null}

          {category === 'about' ? (
            <>
              <Card className="flex items-center gap-[.7rem] p-[.85rem]">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-accent-wash text-accent">
                  <Info size={17} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[.9rem] font-[640] text-ink">OpenMower app</div>
                  <div className="font-mono text-[.78rem] text-ink-soft">v{APP_VERSION}</div>
                </div>
              </Card>

              <SettingsGroup>
                <ListRow title="Release notes" trailing={<DrillChevron />} />
                <ListRow title="Privacy policy" trailing={<DrillChevron />} />
                <ListRow title="Support" trailing={<DrillChevron />} />
              </SettingsGroup>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
