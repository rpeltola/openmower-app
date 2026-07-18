'use client';

import {MowerSelector} from '@/components/v2/MowerSelector';
import {SettingsGroup} from '@/components/v2/settings/SettingsGroup';
import {ChevronRight} from 'lucide-react';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';
import {ListRow} from '@/components/v2/ui/ListRow';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {Gamepad2, Gauge, Info, Settings as SettingsIcon, Sprout, Tractor, Wand2} from 'lucide-react';
import {useState} from 'react';

function DrillChevron() {
  return <ChevronRight size={15} strokeWidth={2.4} className="flex-none text-ink-faint" />;
}

/** The mobile "More" tab (`/v2/more`) — mobile-architecture.md §3/§5: folds Diagnostics,
 *  Settings, manual control, the mower device home and onboarding under one hub, the way the
 *  desktop sidebar lists them separately. Grouped-list layout matches Settings.tsx/the
 *  concept's "More · settings" screen; this page is the hub in front of it, not a duplicate. */
export function MoreScreen() {
  const [mowerSelectorOpen, setMowerSelectorOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader kicker="Kotipiha" title="More" />

      <div className="flex flex-1 flex-col gap-3">
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
          <FeatureGate feature="deviceHome">
            <ListRow
              icon={<Tractor size={15} strokeWidth={2} className="text-ink-soft" />}
              title="Mower"
              sub="Device home"
              href="/v2/mower"
              trailing={<DrillChevron />}
            />
          </FeatureGate>
          <ListRow
            icon={<Gamepad2 size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Manual control"
            sub="Drive it like a remote-control car"
            href="/v2/control"
            trailing={<DrillChevron />}
          />
          <ListRow
            icon={<Gauge size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Diagnostics"
            sub="Every sensor, one screen"
            href="/v2/diagnostics"
            trailing={<DrillChevron />}
          />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow
            icon={<SettingsIcon size={15} strokeWidth={2} className="text-ink-soft" />}
            title="Settings"
            href="/v2/settings"
            trailing={<DrillChevron />}
          />
          <FeatureGate feature="onboarding">
            <ListRow
              icon={<Wand2 size={15} strokeWidth={2} className="text-ink-soft" />}
              title="Setup / onboarding"
              sub="Re-run the guided setup"
              href="/v2/onboarding"
              trailing={<DrillChevron />}
            />
          </FeatureGate>
          <ListRow
            icon={<Info size={15} strokeWidth={2} className="text-ink-soft" />}
            title="About"
            href="/v2/settings?category=about"
            trailing={<DrillChevron />}
          />
        </SettingsGroup>
      </div>

      <MowerSelector open={mowerSelectorOpen} onClose={() => setMowerSelectorOpen(false)} />
    </div>
  );
}
