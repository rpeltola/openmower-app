import {ActivityWearMeter} from '@/components/v2/activity/ActivityWearMeter';
import {cn} from '@/components/v2/lib/cn';
import {BackupRestore} from '@/components/v2/settings/BackupRestore';
import {SettingsGroup} from '@/components/v2/settings/SettingsGroup';
import {
  APP_VERSION,
  BASEMAP_OPTIONS,
  gpsFixLabel,
  gpsFixVariant,
  MAINTENANCE,
  NOTIFICATION_CATEGORIES,
  UNITS_OPTIONS,
  type SafetyToggles,
} from '@/components/v2/settings/settingsData';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {FormField} from '@/components/v2/ui/FormField';
import {ListRow} from '@/components/v2/ui/ListRow';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Switch} from '@/components/v2/ui/Switch';
import {hapticStrong, setHapticsEnabled, useHapticsEnabled} from '@/lib/v2/haptics';
import {useConnectionStatus} from '@/lib/v2/useConnectionStatus';
import {useSelectedMower} from '@/stores/mowersStore';
import {Bell, Check, Info, Navigation, Shield, Wifi, Wrench, Zap} from 'lucide-react';

export interface SettingsCategoryDetailProps {
  category: string;
  units: 'metric' | 'imperial';
  onUnitsChange: (units: 'metric' | 'imperial') => void;
  basemapChoice: string;
  onBasemapChange: (choice: string) => void;
  safetyToggles: SafetyToggles;
  onSafetyToggleChange: (key: keyof SafetyToggles, checked: boolean) => void;
  notifications: Record<string, boolean>;
  onNotificationChange: (key: string, checked: boolean) => void;
  bladeWearHours: number;
  lastBladeChange: string | null;
  onLogBladeChange: () => void;
  className?: string;
}

/** The body of a settings category's detail — desktop renders it in the rail's detail pane,
 *  mobile renders the identical component full-bleed after drilling into a category row, so
 *  the two breakpoints never carry duplicate copies of the same content. */
export function SettingsCategoryDetail({
  category,
  units,
  onUnitsChange,
  basemapChoice,
  onBasemapChange,
  safetyToggles,
  onSafetyToggleChange,
  notifications,
  onNotificationChange,
  bladeWearHours,
  lastBladeChange,
  onLogBladeChange,
  className,
}: SettingsCategoryDetailProps) {
  const hapticsEnabled = useHapticsEnabled();

  const mqttUrl = useSelectedMower((m) => m?.mqttUrl);
  const clientId = useSelectedMower((m) => m?.mqttClient.options.clientId);
  const {status: connectionStatus} = useConnectionStatus();
  const connected = connectionStatus === 'connected';
  const tls = mqttUrl?.startsWith('wss:') ?? false;

  const gps = useSelectedMower((m) => m?.state.sensors?.gps);
  const gpsAccuracyCm = gps?.position_accuracy != null ? gps.position_accuracy * 100 : null;
  const datum = useSelectedMower((m) => m?.map.datum);

  const dockingStation = useSelectedMower((m) => m?.map.docking_stations[0]);

  const bladeCapacityHours = useSelectedMower((m) => m?.stats?.blade.interval_hours) ?? MAINTENANCE.bladeCapacityHours;
  const totalRuntimeHours = useSelectedMower((m) => m?.stats?.mowed_hours);

  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      {category === 'connection' ? (
        <>
          <Card className="flex items-center gap-[.7rem] p-[.85rem]">
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-accent-wash text-accent">
              <Wifi size={17} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[.9rem] font-[640] text-ink">Broker</div>
              <div className="font-mono text-[.78rem] text-ink-soft">{mqttUrl ?? '—'}</div>
            </div>
            <Chip variant={connected ? 'ok' : 'danger'}>{connected ? 'Connected' : 'Disconnected'}</Chip>
          </Card>

          <SettingsGroup>
            <ListRow
              title="Client ID"
              trailing={<span className="font-mono text-[.72rem] text-ink-soft">{clientId ?? '—'}</span>}
            />
            <ListRow
              title="TLS"
              trailing={<Chip variant={tls ? 'ok' : 'neutral'}>{tls ? 'Enabled' : 'Disabled'}</Chip>}
            />
          </SettingsGroup>
        </>
      ) : null}

      {category === 'positioning' ? (
        <SettingsGroup>
          <ListRow
            icon={<Navigation size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Fix status"
            trailing={<Chip variant={gpsFixVariant(gps)}>{gpsFixLabel(gps)}</Chip>}
          />
          <ListRow
            title="Datum"
            trailing={
              <span className="font-mono text-[.72rem] text-ink-soft">
                {datum ? `${datum.lat.toFixed(6)}, ${datum.long.toFixed(6)}` : '—'}
              </span>
            }
          />
          <ListRow
            title="Horizontal accuracy"
            trailing={
              <span className="font-mono text-[.72rem] text-ink-soft">
                {gpsAccuracyCm != null ? `${gpsAccuracyCm.toFixed(1)} cm` : '—'}
              </span>
            }
          />
        </SettingsGroup>
      ) : null}

      {category === 'docking' ? (
        <SettingsGroup>
          <ListRow
            icon={<Zap size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Status"
            trailing={
              <Chip variant={dockingStation ? 'ok' : 'neutral'}>
                {dockingStation ? 'Configured' : 'Not configured'}
              </Chip>
            }
          />
          <ListRow
            title="Name"
            trailing={
              <span className="text-[.72rem] text-ink-soft">
                {dockingStation?.properties.name ?? '—'}
              </span>
            }
          />
          <ListRow
            title="Approach distance"
            trailing={
              <span className="font-mono text-[.72rem] text-ink-soft">
                {dockingStation ? `${dockingStation.approach_distance.toFixed(1)} m` : '—'}
              </span>
            }
          />
        </SettingsGroup>
      ) : null}

      {category === 'units' ? (
        <Card className="p-[.85rem]">
          <FormField label="Measurement units" hint="Applies to area, distance, and speed readouts throughout the app.">
            <SegmentedToggle
              options={UNITS_OPTIONS}
              value={units}
              onChange={(v) => onUnitsChange(v as 'metric' | 'imperial')}
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
              onClick={() => onBasemapChange(opt)}
              trailing={
                opt === basemapChoice ? <Check size={15} strokeWidth={2.6} className="text-accent" /> : undefined
              }
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
                onCheckedChange={(checked) => onSafetyToggleChange('geofence', checked)}
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
                onCheckedChange={(checked) => onSafetyToggleChange('tiltLift', checked)}
                aria-label="Tilt / lift stop"
              />
            }
          />
        </SettingsGroup>
      ) : null}

      {category === 'general' ? (
        <SettingsGroup>
          <ListRow
            title="Haptic feedback"
            sub="Vibrate on button presses (Android & modern iOS)"
            trailing={
              <div className="flex items-center gap-2.5">
                {/* noHaptic: the Button primitive already buzzes on its own pointerdown,
                    so this fires the test pulse explicitly instead of doubling up. */}
                <Button variant="soft" size="sm" noHaptic onClick={() => hapticStrong()}>
                  Test
                </Button>
                <Switch
                  checked={hapticsEnabled}
                  onCheckedChange={(checked) => setHapticsEnabled(checked)}
                  aria-label="Haptic feedback"
                />
              </div>
            }
          />
        </SettingsGroup>
      ) : null}

      {category === 'maintenance' ? (
        <>
          <ActivityWearMeter
            hours={bladeWearHours}
            capacityHours={bladeCapacityHours}
            detail={`Replace around ${bladeCapacityHours} h · ~${Math.max(0, bladeCapacityHours - bladeWearHours)} h remaining`}
            onChangedBlades={onLogBladeChange}
          />

          <SettingsGroup>
            <ListRow
              icon={<Wrench size={15} strokeWidth={2} className="text-ink-soft" />}
              title="Last blade change"
              trailing={<span className="font-mono text-[.72rem] text-ink-soft">{lastBladeChange ?? '—'}</span>}
            />
            <ListRow
              title="Total runtime"
              trailing={
                <span className="font-mono text-[.72rem] text-ink-soft">
                  {totalRuntimeHours != null ? `${totalRuntimeHours.toFixed(1)} h` : '—'}
                </span>
              }
            />
          </SettingsGroup>
        </>
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
                    onCheckedChange={(checked) => onNotificationChange(cat.key, checked)}
                    aria-label={cat.label}
                  />
                }
              />
            ))}
          </SettingsGroup>

          <p className="text-[.76rem] leading-[1.5] text-ink-faint">
            On iOS, delivery isn&apos;t guaranteed while Low Power Mode is on — allow OpenMower under Settings →
            Notifications if alerts feel delayed.
          </p>
        </>
      ) : null}

      {category === 'backup' ? (<BackupRestore />) : null}

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
            {/* No detail screens behind these yet — plain rows rather than a chevron
                implying a drill-in that doesn't exist. */}
            <ListRow title="Release notes" />
            <ListRow title="Privacy policy" />
            <ListRow title="Support" />
          </SettingsGroup>
        </>
      ) : null}
    </div>
  );
}
