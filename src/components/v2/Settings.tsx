'use client';

import {MowerSelector} from '@/components/v2/MowerSelector';
import {cn} from '@/components/v2/lib/cn';
import {SettingsCategoryDetail} from '@/components/v2/settings/SettingsCategoryDetail';
import {SettingsCategoryRail} from '@/components/v2/settings/SettingsCategoryRail';
import {
  APP_VERSION,
  BASEMAP,
  CATEGORY_LABELS,
  CONNECTION,
  DESKTOP_CATEGORIES,
  DOCKING,
  NOTIFICATION_CATEGORIES,
  POSITIONING,
  UNITS,
  type SafetyToggles,
} from '@/components/v2/settings/settingsData';
import {SettingsGroup} from '@/components/v2/settings/SettingsGroup';
import {Button} from '@/components/v2/ui/Button';
import {ListRow} from '@/components/v2/ui/ListRow';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Info,
  LineChart,
  Map as MapIcon,
  Navigation,
  Shield,
  Sprout,
  Vibrate,
  Wifi,
  Zap,
} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';

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
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, c.defaultOn])),
  );
  const [category, setCategory] = useState('notifications');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [basemapChoice, setBasemapChoice] = useState(BASEMAP);
  const [safetyToggles, setSafetyToggles] = useState<SafetyToggles>({geofence: true, tiltLift: true});
  // Mobile-only: which pane the grouped list has drilled into (desktop always shows rail + pane).
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [mowerSelectorOpen, setMowerSelectorOpen] = useState(false);

  // Deep link from More's "About" row (`/v2/settings?category=about`) — jump straight to
  // that category/detail pane instead of landing on the default grouped list.
  useEffect(() => {
    const deepLink = searchParams.get('category');
    if (deepLink && CATEGORY_LABELS[deepLink]) {
      setCategory(deepLink);
      setMobileView('detail');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryLabel = CATEGORY_LABELS[category] ?? '';

  function openCategory(id: string) {
    setCategory(id);
    setMobileView('detail');
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Settings"
        actions={
          mobileView === 'detail' ? (
            <Button
              variant="soft"
              size="icon"
              aria-label="Back to settings"
              className="md:hidden"
              onClick={() => setMobileView('list')}
            >
              <ChevronLeft size={18} strokeWidth={2.4} />
            </Button>
          ) : undefined
        }
      />

      {/* ===== Mobile: iOS-style grouped list — mower selector, then one tap deep ===== */}
      <div className="flex flex-1 flex-col gap-3 md:hidden">
        {mobileView === 'detail' ? (
          <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
            <div className="text-[1.05rem] font-[660] text-ink">{categoryLabel}</div>
            <SettingsCategoryDetail
              category={category}
              units={units}
              onUnitsChange={setUnits}
              basemapChoice={basemapChoice}
              onBasemapChange={setBasemapChoice}
              safetyToggles={safetyToggles}
              onSafetyToggleChange={(key, checked) => setSafetyToggles((prev) => ({...prev, [key]: checked}))}
              notifications={notifications}
              onNotificationChange={(key, checked) => setNotifications((prev) => ({...prev, [key]: checked}))}
            />
          </div>
        ) : (
          <>
            <SettingsGroup>
              <ListRow
                icon={
                  <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-accent-wash text-accent">
                    <Sprout size={19} strokeWidth={2} />
                  </span>
                }
                title="YardForce"
                sub="Kotipiha"
                onClick={() => setMowerSelectorOpen(true)}
                trailing={<DrillChevron />}
              />
            </SettingsGroup>

            <SettingsGroup>
              <ListRow
                icon={<Wifi size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Connection"
                onClick={() => openCategory('connection')}
                trailing={
                  <span className="flex items-center gap-[.4rem]">
                    <span className="font-mono text-[.68rem] tabular-nums text-ink-soft">{CONNECTION.url}</span>
                    <span
                      className={cn(
                        'h-[7px] w-[7px] flex-none rounded-full',
                        CONNECTION.connected ? 'bg-accent' : 'bg-danger',
                      )}
                    />
                    <DrillChevron />
                  </span>
                }
              />
              <ListRow
                icon={<Navigation size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Positioning / RTK"
                onClick={() => openCategory('positioning')}
                trailing={<DrillValue value={POSITIONING} />}
              />
              <ListRow
                icon={<Zap size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Docking station"
                onClick={() => openCategory('docking')}
                trailing={<DrillValue value={DOCKING} />}
              />
            </SettingsGroup>

            <SettingsGroup>
              <ListRow
                icon={<LineChart size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Units"
                onClick={() => openCategory('units')}
                trailing={<DrillValue value={UNITS} />}
              />
              <ListRow
                icon={<MapIcon size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Map basemap"
                onClick={() => openCategory('basemap')}
                trailing={<DrillValue value={BASEMAP} />}
              />
              <ListRow
                icon={<Shield size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Safety"
                onClick={() => openCategory('safety')}
                trailing={<DrillChevron />}
              />
            </SettingsGroup>

            <SettingsGroup>
              <ListRow
                icon={<Vibrate size={15} strokeWidth={2} className="text-ink-soft" />}
                title="General"
                onClick={() => openCategory('general')}
                trailing={<DrillChevron />}
              />
              <ListRow
                icon={<Bell size={15} strokeWidth={2} className="text-ink-soft" />}
                title="Notifications"
                onClick={() => openCategory('notifications')}
                trailing={<DrillChevron />}
              />
              <ListRow
                icon={<Info size={15} strokeWidth={2} className="text-ink-soft" />}
                title="About"
                onClick={() => openCategory('about')}
                trailing={
                  <span className="flex items-center gap-[.35rem]">
                    <span className="font-mono text-[.72rem] tabular-nums text-ink-soft">{APP_VERSION}</span>
                    <DrillChevron />
                  </span>
                }
              />
            </SettingsGroup>
          </>
        )}
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

          <SettingsCategoryDetail
            category={category}
            units={units}
            onUnitsChange={setUnits}
            basemapChoice={basemapChoice}
            onBasemapChange={setBasemapChoice}
            safetyToggles={safetyToggles}
            onSafetyToggleChange={(key, checked) => setSafetyToggles((prev) => ({...prev, [key]: checked}))}
            notifications={notifications}
            onNotificationChange={(key, checked) => setNotifications((prev) => ({...prev, [key]: checked}))}
          />
        </div>
      </div>

      <MowerSelector open={mowerSelectorOpen} onClose={() => setMowerSelectorOpen(false)} />
    </div>
  );
}
