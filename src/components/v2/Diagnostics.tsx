import {Button} from '@/components/v2/ui/Button';
import {Chip} from '@/components/v2/ui/Chip';
import {DiagCard} from '@/components/v2/ui/DiagCard';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {Sparkline} from '@/components/v2/ui/Sparkline';
import {StatRow} from '@/components/v2/ui/StatRow';
import {RotateCcw} from 'lucide-react';
import {Fragment} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, mowing.
// Mock telemetry only — this screen wires no MQTT yet (component-library.md build order
// lands live sensor wiring in a later session). Values match docs/concept/
// openmower-app-concept.html and openmower-desktop-concept.html Diagnostics panels exactly.
const BATTERY = {voltageV: 24.8, currentA: 3.2, chargePct: 71, tempC: 28, cycles: 142, timeToFullMin: 38};
const GPS = {sats: 30, accuracyCm: 1.8};

type PoseRow = {label: string; value: number | string; unit: string};
const POSE: PoseRow[] = [
  {label: 'Heading', value: 47, unit: '°'},
  {label: 'Roll', value: 1.2, unit: '°'},
  {label: 'Pitch', value: '−0.4', unit: '°'},
  {label: 'X', value: 12.4, unit: 'm'},
  {label: 'Y', value: '−3.1', unit: 'm'},
];

type DriveRow = {label: string; l: number; r: number; unit?: string};
const DRIVE_ESC: DriveRow[] = [
  {label: 'RPM', l: 1450, r: 1470},
  {label: 'Current', l: 2.1, r: 2.3, unit: 'A'},
  {label: 'Temp', l: 34, r: 35, unit: '°C'},
  {label: 'Duty', l: 41, r: 42, unit: '%'},
];

const MOW_ESC = {rpm: 3200, currentA: 6.1, tempC: 41};
const RAIN = {state: 'Dry', value: '0.02'};

// Sparkline path data copied verbatim from the concept's inline SVGs.
const GPS_SPARK_MOBILE = {
  area: 'M0 6 L12 8 L24 9 L36 13 L48 15 L60 17 L72 19 L84 21 L100 22 L100 28 L0 28 Z',
  line: 'M0 6 L12 8 L24 9 L36 13 L48 15 L60 17 L72 19 L84 21 L100 22',
  dot: {x: 100, y: 22},
};
const GPS_SPARK_DESKTOP = {
  area: 'M0 6 L10 9 L20 7 L30 12 L40 10 L50 15 L60 13 L70 17 L80 16 L90 19 L100 20 L100 28 L0 28 Z',
  line: 'M0 6 L10 9 L20 7 L30 12 L40 10 L50 15 L60 13 L70 17 L80 16 L90 19 L100 20',
  dot: {x: 100, y: 20},
};
const MOW_SPARK_MOBILE = {
  area: 'M0 20 L12 16 L24 19 L36 12 L48 15 L60 9 L72 13 L84 8 L100 11 L100 28 L0 28 Z',
  line: 'M0 20 L12 16 L24 19 L36 12 L48 15 L60 9 L72 13 L84 8 L100 11',
  dot: {x: 100, y: 11},
};
const BATTERY_SPARK_DESKTOP = {
  area: 'M0 20 L10 19 L20 17 L30 18 L40 14 L50 15 L60 11 L70 12 L80 8 L90 9 L100 7 L100 28 L0 28 Z',
  line: 'M0 20 L10 19 L20 17 L30 18 L40 14 L50 15 L60 11 L70 12 L80 8 L90 9 L100 7',
  dot: {x: 100, y: 7},
};

export function Diagnostics() {
  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Diagnostics"
        actions={
          <Button variant="soft" size="icon" aria-label="Refresh">
            <RotateCcw size={16} strokeWidth={2.2} />
          </Button>
        }
      />

      {/* ===== Mobile: single-column stack of sensor cards ("every signal, one screen") ===== */}
      <div className="flex flex-1 flex-col gap-3 md:hidden">
        <DiagCard label="Battery & power">
          <div className="grid grid-cols-2 gap-x-[.6rem] gap-y-[.4rem]">
            <StatRow label="Voltage" value={BATTERY.voltageV} unit="V" />
            <StatRow label="Current" value={BATTERY.currentA} unit="A" />
            <StatRow label="Charge" value={BATTERY.chargePct} unit="%" />
            <StatRow label="Temp" value={BATTERY.tempC} unit="°C" />
            <StatRow label="Cycles" value={BATTERY.cycles} />
            <StatRow label="Time to full" value={BATTERY.timeToFullMin} unit="min" />
          </div>
        </DiagCard>

        <DiagCard label="GPS">
          <div className="flex items-center justify-between">
            <Chip variant="ok">RTK FIXED</Chip>
            <span className="tabular-nums text-[.76rem] text-ink-soft">
              {GPS.sats} <span className="text-ink-faint">sats</span>
            </span>
          </div>
          <StatRow className="mt-[.42rem]" label="Accuracy" value={GPS.accuracyCm} unit="cm" />
          <Sparkline areaPath={GPS_SPARK_MOBILE.area} linePath={GPS_SPARK_MOBILE.line} dot={GPS_SPARK_MOBILE.dot} />
        </DiagCard>

        <DiagCard label="Pose & IMU">
          <div className="flex flex-col gap-[.34rem]">
            {POSE.map((row) => (
              <StatRow key={row.label} label={row.label} value={row.value} unit={row.unit} />
            ))}
          </div>
        </DiagCard>

        <DiagCard label="Drive ESCs">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-[.7rem] gap-y-[.32rem]">
            <span />
            <span className="text-right font-mono text-[.6rem] text-ink-faint">L</span>
            <span className="text-right font-mono text-[.6rem] text-ink-faint">R</span>
            {DRIVE_ESC.map((row) => (
              <Fragment key={row.label}>
                <span className="text-[.72rem] text-ink-soft">{row.label}</span>
                <span className="tabular-nums text-right text-[.78rem] font-[640] text-ink">
                  {row.l}
                  {row.unit ? <small className="font-semibold text-ink-faint">{row.unit}</small> : null}
                </span>
                <span className="tabular-nums text-right text-[.78rem] font-[640] text-ink">
                  {row.r}
                  {row.unit ? <small className="font-semibold text-ink-faint">{row.unit}</small> : null}
                </span>
              </Fragment>
            ))}
          </div>
        </DiagCard>

        <DiagCard label="Mow ESC">
          <div className="flex flex-col gap-[.34rem]">
            <StatRow label="RPM" value={MOW_ESC.rpm} />
            <StatRow label="Current" value={MOW_ESC.currentA} unit="A" />
            <StatRow label="Temp" value={MOW_ESC.tempC} unit="°C" />
          </div>
          <Sparkline areaPath={MOW_SPARK_MOBILE.area} linePath={MOW_SPARK_MOBILE.line} dot={MOW_SPARK_MOBILE.dot} />
        </DiagCard>

        <DiagCard label="Rain">
          <div className="flex items-center justify-between">
            <Chip variant="ok">{RAIN.state}</Chip>
            <span className="tabular-nums text-[.76rem] text-ink-soft">
              value <b className="font-mono font-semibold text-ink">{RAIN.value}</b>
            </span>
          </div>
        </DiagCard>
      </div>

      {/* ===== Desktop: dense multi-column grid, everything visible with no scroll ===== */}
      <div className="hidden md:grid md:min-h-0 md:flex-1 md:auto-rows-min md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        <DiagCard label="Battery & power">
          <ProgressBar value={BATTERY.chargePct} className="mb-[.7rem]" />
          <StatRow boxed label="Voltage" value={BATTERY.voltageV} unit="V" />
          <StatRow boxed divider label="Current" value={BATTERY.currentA} unit="A" />
          <StatRow boxed divider label="Charge" value={BATTERY.chargePct} unit="%" />
          <StatRow boxed divider label="Temp" value={BATTERY.tempC} unit="°C" />
          <StatRow boxed divider label="Cycles" value={BATTERY.cycles} />
          <StatRow boxed divider label="Time to full" value={BATTERY.timeToFullMin} unit="min" />
          <div className="mb-1 mt-3 font-mono text-[.62rem] uppercase tracking-[.08em] text-ink-faint">
            Charge trend
          </div>
          <Sparkline
            areaPath={BATTERY_SPARK_DESKTOP.area}
            linePath={BATTERY_SPARK_DESKTOP.line}
            dot={BATTERY_SPARK_DESKTOP.dot}
          />
        </DiagCard>

        <DiagCard label="GPS" action={<Chip variant="ok">RTK FIXED</Chip>}>
          <StatRow boxed label="Satellites" value={GPS.sats} />
          <StatRow boxed divider label="Accuracy" value={GPS.accuracyCm} unit="cm" />
          <div className="mb-1 mt-3 font-mono text-[.62rem] uppercase tracking-[.08em] text-ink-faint">
            Accuracy trend
          </div>
          <Sparkline
            areaPath={GPS_SPARK_DESKTOP.area}
            linePath={GPS_SPARK_DESKTOP.line}
            dot={GPS_SPARK_DESKTOP.dot}
          />
        </DiagCard>

        <DiagCard label="Pose & IMU">
          {POSE.map((row, i) => (
            <StatRow key={row.label} boxed divider={i > 0} label={row.label} value={row.value} unit={row.unit} />
          ))}
        </DiagCard>

        <DiagCard label="Drive ESCs">
          <div className="grid grid-cols-3 gap-x-2">
            <span />
            <span className="text-right font-mono text-[.68rem] text-ink-faint">L</span>
            <span className="text-right font-mono text-[.68rem] text-ink-faint">R</span>
            {DRIVE_ESC.map((row) => (
              <Fragment key={row.label}>
                <span className="border-t border-border py-[.32rem] text-[.82rem] text-ink-soft">{row.label}</span>
                <span className="tabular-nums border-t border-border py-[.32rem] text-right text-[.78rem] font-[640] text-ink">
                  {row.l}
                  {row.unit ? <small className="text-[.65rem] text-ink-faint"> {row.unit}</small> : null}
                </span>
                <span className="tabular-nums border-t border-border py-[.32rem] text-right text-[.78rem] font-[640] text-ink">
                  {row.r}
                  {row.unit ? <small className="text-[.65rem] text-ink-faint"> {row.unit}</small> : null}
                </span>
              </Fragment>
            ))}
          </div>
        </DiagCard>

        <DiagCard label="Mow ESC">
          <StatRow boxed label="RPM" value={MOW_ESC.rpm} />
          <StatRow boxed divider label="Current" value={MOW_ESC.currentA} unit="A" />
          <StatRow boxed divider label="Temp" value={MOW_ESC.tempC} unit="°C" />
        </DiagCard>

        <DiagCard label="Rain" action={<Chip variant="ok">{RAIN.state}</Chip>}>
          <StatRow boxed label="Sensor value" value={RAIN.value} />
        </DiagCard>
      </div>
    </div>
  );
}
