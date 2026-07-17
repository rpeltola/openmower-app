import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {StatePill} from '@/components/v2/ui/StatePill';
import {StatRow} from '@/components/v2/ui/StatRow';
import {DeviceHeroScene} from '@/components/v2/mower/DeviceHeroScene';
import {BatteryCharging, Home as DockIcon, Settings as SettingsIcon} from 'lucide-react';
import Link from 'next/link';
import {type ReactNode} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha,
// YardForce SA900ECO, battery 71%. Values match the concept's Device Home panel
// (docs/concept/openmower-app-concept.html "B · DEVICE HOME / CHARGING") exactly where it
// specifies one: 71%, 38 min to full, 214h total mowed, 38/100h blade, firmware 2026.7. This
// screen wires no MQTT yet — component-library.md build order lands live wiring later.
const MODEL = 'YardForce SA900ECO';

type PowerStatus = 'charging' | 'docked-full' | 'away';

const POWER: {status: PowerStatus; batteryPct: number; etaMin: number; dockLocation: string} = {
  status: 'charging',
  batteryPct: 71,
  etaMin: 38,
  dockLocation: 'Kotipiha',
};

const DEVICE = {
  firmware: '2026.7',
  bladeHoursSinceChange: 38,
  bladeServiceIntervalHours: 100,
  lastBladeChange: '5 Jun 2026',
  totalRuntimeHours: 214,
  serial: 'YFC-SA900-000417',
};

function powerPresentation(power: typeof POWER): {
  tone: 'info' | 'accent' | 'neutral';
  icon: ReactNode;
  label: string;
  sub: string;
  action: {label: string; variant: 'ghost' | 'primary' | 'danger'} | null;
} {
  switch (power.status) {
    case 'charging':
      return {
        tone: 'info',
        icon: <BatteryCharging size={16} strokeWidth={2.2} />,
        label: 'Charging',
        sub: `Docked at ${power.dockLocation} · ${power.etaMin} min to full`,
        action: {label: 'End charge', variant: 'ghost'},
      };
    case 'docked-full':
      return {
        tone: 'info',
        icon: <DockIcon size={16} strokeWidth={2.2} />,
        label: 'Docked',
        sub: `Full · ready at ${power.dockLocation}`,
        action: {label: 'Start mowing', variant: 'primary'},
      };
    case 'away':
      return {
        tone: 'accent',
        icon: <BatteryCharging size={16} strokeWidth={2.2} />,
        label: 'On battery',
        sub: `${power.batteryPct}% remaining · not docked`,
        action: {label: 'Send to dock', variant: 'ghost'},
      };
  }
}

export function DeviceHome() {
  const presentation = powerPresentation(POWER);
  const isCharging = POWER.status === 'charging';

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Your mower"
        actions={
          <Link href="/v2/settings">
            <Button variant="soft" size="icon" aria-label="Settings">
              <SettingsIcon size={17} strokeWidth={2} />
            </Button>
          </Link>
        }
      />

      {/* ===== Mobile: single-column stack ("your mower, rendered") ===== */}
      <div className="flex flex-1 flex-col gap-3 md:hidden">
        <DeviceHeroScene
          className="-mx-4 h-[220px] flex-none"
          charging={isCharging}
          modelName={MODEL}
        />

        <StatePill icon={presentation.icon} tone={presentation.tone} label={presentation.label} sub={presentation.sub} />

        <Card className="flex items-center gap-[.7rem] p-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[.8rem] font-semibold text-ink">Battery</span>
              <span className="tabular-nums text-[1.1rem] font-bold text-accent">{POWER.batteryPct}%</span>
            </div>
            <ProgressBar value={POWER.batteryPct} className="mt-[.45rem]" />
          </div>
          {presentation.action ? (
            <Button variant={presentation.action.variant} size="sm" className="flex-none">
              {presentation.action.label}
            </Button>
          ) : null}
        </Card>

        <Card className="p-4">
          <div className="grid grid-cols-3 gap-2">
            <KpiTile value={DEVICE.totalRuntimeHours} unit="h" label="Total mowed" />
            <KpiTile value={DEVICE.bladeHoursSinceChange} unit={`/${DEVICE.bladeServiceIntervalHours}h`} label="Blade" />
            <KpiTile value={DEVICE.firmware} label="Firmware" />
          </div>
          <div className="mt-3 flex flex-col gap-[.34rem] border-t border-border pt-3">
            <StatRow label="Last blade change" value={DEVICE.lastBladeChange} />
            <StatRow label="Serial" value={DEVICE.serial} />
          </div>
        </Card>
      </div>

      {/* ===== Desktop: richer two-column layout — hero + device info left, power right ===== */}
      <div className="hidden md:flex md:min-h-0 md:flex-1 md:gap-5">
        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
          <DeviceHeroScene className="min-h-[280px] flex-1" charging={isCharging} artWidth={240} modelName={MODEL} />
          <div className="flex flex-col gap-3 border-t border-border p-5">
            <div className="grid grid-cols-3 gap-3">
              <KpiTile value={DEVICE.totalRuntimeHours} unit="h" label="Total mowed" />
              <KpiTile value={DEVICE.bladeHoursSinceChange} unit={`/${DEVICE.bladeServiceIntervalHours}h`} label="Blade" />
              <KpiTile value={DEVICE.firmware} label="Firmware" />
            </div>
            <div className="flex flex-col">
              <StatRow boxed label="Last blade change" value={DEVICE.lastBladeChange} />
              <StatRow boxed divider label="Serial" value={DEVICE.serial} />
            </div>
          </div>
        </Card>

        <div className="flex w-[320px] flex-none flex-col gap-4">
          <Card className="p-5">
            <StatePill
              icon={presentation.icon}
              tone={presentation.tone}
              label={presentation.label}
              sub={presentation.sub}
            />
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[.8rem] font-semibold text-ink">Battery</span>
                <span className="tabular-nums text-[1.1rem] font-bold text-accent">{POWER.batteryPct}%</span>
              </div>
              <ProgressBar value={POWER.batteryPct} className="mt-[.45rem]" />
            </div>
            {presentation.action ? (
              <Button variant={presentation.action.variant} size="md" className="mt-4 w-full">
                {presentation.action.label}
              </Button>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="mb-1 font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">
              Device
            </div>
            <StatRow boxed label="Model" value="SA900ECO" />
            <StatRow boxed divider label="Firmware" value={DEVICE.firmware} />
            <StatRow boxed divider label="Serial" value={DEVICE.serial} />
          </Card>
        </div>
      </div>
    </div>
  );
}
