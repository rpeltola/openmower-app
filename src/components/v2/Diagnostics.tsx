'use client';

import {Button} from '@/components/v2/ui/Button';
import {Chip, type ChipProps} from '@/components/v2/ui/Chip';
import {DiagCard} from '@/components/v2/ui/DiagCard';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {StatRow} from '@/components/v2/ui/StatRow';
import {useSelectedMower} from '@/stores/mowersStore';
import type {Capabilities, Sensors} from '@/stores/schemas';
import {escHasFault, fmtEscFault} from '@/utils/esc-faults';
import {RotateCcw} from 'lucide-react';
import {Fragment} from 'react';

// Live telemetry, read from the store (see stores/mowersStore -> useSelectedMower). The gateway
// folds the ROS2 /ll/* sensor topics into a consolidated `robot_state/json`, parsed into
// `state.sensors` (stores/schemas.ts sensorsSchema). Every block is optional -- it only appears
// once its source topic has ticked -- so every read below is guarded with `?.` and renders '—'
// until the corresponding sensor is live.

const RAD_TO_DEG = 180 / Math.PI;

function normalizeDegrees(rad: number): number {
  const deg = (rad * RAD_TO_DEG) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/**
 * Roll/pitch (radians), estimated from a single accelerometer sample. The gateway's IMU source
 * is the raw `/ll/imu/data_raw` topic -- gyro + accel only, no fused orientation -- and the
 * EKF-derived `pose.heading` is yaw-only. A gravity-vector tilt estimate from the accelerometer
 * is the only way to surface roll/pitch at all; it assumes the mower is roughly static and
 * REP-103 body axes (x forward, y left, z up), so treat it as an approximation.
 */
function accelTilt(x: number | null, y: number | null, z: number | null): {roll: number; pitch: number} | undefined {
  if (x == null || y == null || z == null) return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
  if (x === 0 && y === 0 && z === 0) return undefined; // no samples yet
  return {roll: Math.atan2(y, z), pitch: Math.atan2(-x, Math.hypot(y, z))};
}

/**
 * Format a telemetry number that may be null. The gateway sends `null` for any value the
 * hardware reports as NaN (an unpopulated current/ADC channel, etc.) -- render those (and
 * anything still undefined) as an em dash, never as 0 or NaN (R1).
 */
function fmt(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** `duty_cycle` etc. arrive as a 0..1 fraction; render the percent the UI shows. */
function fmtPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return (value * 100).toFixed(digits);
}

type GpsFlags = NonNullable<Sensors['gps']>;

function gpsFixLabel(gps: GpsFlags): string {
  if (gps.rtk_fixed) return 'RTK FIXED';
  if (gps.rtk_float) return 'RTK FLOAT';
  if (gps.dead_reckoning) return 'DEAD RECKONING';
  if (gps.rtk) return 'RTK CONVERGING';
  return 'NO FIX';
}

function gpsFixVariant(gps: GpsFlags): ChipProps['variant'] {
  if (gps.rtk_fixed) return 'ok';
  if (gps.rtk_float || gps.dead_reckoning) return 'warn';
  if (gps.rtk) return 'info';
  return 'neutral';
}

/**
 * ESC fault chip: a danger chip naming the cause when the ESC reports one, a neutral "OK"
 * otherwise (mirrors v1's FaultReadout with the V2 Chip primitive). This trusts the flashed
 * firmware to emit a non-zero `fault_code` on a real fault -- an R1 pre-check the integration
 * plan flags to verify against real hardware before relying on it.
 */
function EscFaultChip({label, code}: {label: string; code: number | null | undefined}) {
  const faulted = escHasFault(code);
  return (
    <span className="flex items-center gap-1.5 text-[.72rem] text-ink-soft">
      {label}
      <Chip variant={faulted ? 'danger' : 'neutral'}>{fmtEscFault(code)}</Chip>
    </span>
  );
}

/** `mow`/`blade_reset` -> "Mow"/"Blade reset" -- the gateway's capability keys are already
 *  human-ish snake_case, so a straight split+titlecase reads fine without a lookup table. */
function capabilityLabel(key: string): string {
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Capability badges, ported from the v1 `/debug` page's `CapabilitiesSection` (same
 * `capabilities/json` -> `Capabilities` (a sparse `{name: level}` map, level >= 1 = supported)
 * this app already subscribes to and parses -- see stores/mowersStore.ts/schemas.ts). Only
 * capabilities the gateway actually reported are shown (there's no "not supported" entry to
 * render, just an absent key), so an old gateway with an empty/missing map degrades to the
 * empty-state line below instead of a wall of false negatives.
 */
function CapabilityChips({capabilities}: {capabilities: Capabilities | undefined}) {
  const entries = capabilities ? Object.entries(capabilities) : [];
  if (entries.length === 0) {
    return <div className="text-[.76rem] text-ink-faint">No capabilities reported yet</div>;
  }
  return (
    <div className="flex flex-wrap gap-[.4rem]">
      {entries.map(([key, level]) => (
        <Chip key={key} variant="ok">
          {capabilityLabel(key)}
          {level > 1 ? ` ×${level}` : ''}
        </Chip>
      ))}
    </div>
  );
}

type PoseRow = {label: string; value: string; unit: string};

type DriveRow = {label: string; l: string; r: string; unit?: string};

export function Diagnostics() {
  const name = useSelectedMower((mower) => mower?.name);
  const state = useSelectedMower((mower) => mower?.state);
  const capabilities = useSelectedMower((mower) => mower?.capabilities);
  const sensors = state?.sensors;
  const battery = sensors?.battery;
  const power = sensors?.power;
  const gps = sensors?.gps;
  const imu = sensors?.imu;
  const escLeft = sensors?.esc_left;
  const escRight = sensors?.esc_right;
  const mower = sensors?.mower;
  const pose = state?.pose;

  // No smart-battery (/ll/battery) topic on this HW -> the real pack voltage falls back to
  // /ll/power, same as v1's sensors page.
  const batteryVoltage = battery?.voltage ?? power?.battery_voltage;
  const tilt = imu ? accelTilt(imu.linear_acceleration.x, imu.linear_acceleration.y, imu.linear_acceleration.z) : undefined;
  const headingDeg = pose ? normalizeDegrees(pose.heading) : undefined;

  const POSE: PoseRow[] = [
    {label: 'Heading', value: headingDeg != null ? headingDeg.toFixed(0) : '—', unit: '°'},
    {label: 'Roll', value: tilt ? (tilt.roll * RAD_TO_DEG).toFixed(1) : '—', unit: '°'},
    {label: 'Pitch', value: tilt ? (tilt.pitch * RAD_TO_DEG).toFixed(1) : '—', unit: '°'},
    {label: 'X', value: pose ? pose.x.toFixed(1) : '—', unit: 'm'},
    {label: 'Y', value: pose ? pose.y.toFixed(1) : '—', unit: 'm'},
  ];

  const DRIVE_ESC: DriveRow[] = [
    {label: 'RPM', l: fmt(escLeft?.rpm, 0), r: fmt(escRight?.rpm, 0)},
    {label: 'Current', l: fmt(escLeft?.current, 1), r: fmt(escRight?.current, 1), unit: 'A'},
    {label: 'Motor temp', l: fmt(escLeft?.temperature_motor, 0), r: fmt(escRight?.temperature_motor, 0), unit: '°C'},
    {label: 'PCB temp', l: fmt(escLeft?.temperature_pcb, 0), r: fmt(escRight?.temperature_pcb, 0), unit: '°C'},
    {label: 'Duty', l: fmtPercent(escLeft?.duty_cycle), r: fmtPercent(escRight?.duty_cycle), unit: '%'},
    {
      label: 'Input V',
      l: fmt(escLeft?.input_voltage, 1),
      r: fmt(escRight?.input_voltage, 1),
      unit: 'V',
    },
  ];

  const gpsAccuracyCm = gps?.position_accuracy != null ? gps.position_accuracy * 100 : null;
  const rainWet = mower?.rain_detected ?? false;

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker={name ?? 'No mower selected'}
        title="Diagnostics"
        actions={
          <Button variant="soft" size="icon" aria-label="Refresh">
            <RotateCcw size={16} strokeWidth={2.2} />
          </Button>
        }
      />

      {/* ===== Mobile: single-column stack of sensor cards ("every signal, one screen") =====
          Concept `.body` fades its bottom edge via `mask-image` (openmower-app-concept.html
          "A · DIAGNOSTICS") so the dense list trails off instead of hard-cutting. */}
      <div
        className="flex flex-1 flex-col gap-3 md:hidden"
        style={{
          WebkitMaskImage: 'linear-gradient(180deg, #000 90%, transparent 99%)',
          maskImage: 'linear-gradient(180deg, #000 90%, transparent 99%)',
        }}
      >
        <DiagCard label="Battery & power">
          <div className="grid grid-cols-2 gap-x-[.6rem] gap-y-[.4rem]">
            <StatRow label="Voltage" value={fmt(batteryVoltage, 1)} unit="V" />
            <StatRow label="Current" value={fmt(battery?.current, 1)} unit="A" />
            <StatRow label="Charge" value={state?.battery_percentage ?? '—'} unit="%" />
            <StatRow label="Temp" value={fmt(battery?.temperature, 0)} unit="°C" />
            <StatRow label="Cycles" value={battery?.cycle_count ?? '—'} />
            <StatRow label="Status" value={power?.charger_status || '—'} />
          </div>
        </DiagCard>

        <DiagCard label="GPS">
          <div className="flex items-center justify-between">
            <Chip variant={gps ? gpsFixVariant(gps) : 'neutral'}>{gps ? gpsFixLabel(gps) : 'NO DATA'}</Chip>
            <span className="tabular-nums text-[.76rem] text-ink-soft">
              {state?.gps_percentage ?? '—'} <span className="text-ink-faint">%</span>
            </span>
          </div>
          <StatRow className="mt-[.42rem]" label="Accuracy" value={fmt(gpsAccuracyCm, 1)} unit="cm" />
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
          <div className="mt-[.6rem] flex items-center justify-between gap-2">
            <EscFaultChip label="L" code={escLeft?.fault_code} />
            <EscFaultChip label="R" code={escRight?.fault_code} />
          </div>
        </DiagCard>

        <DiagCard label="Mow ESC">
          <div className="flex flex-col gap-[.34rem]">
            <StatRow label="RPM" value={fmt(mower?.motor_rpm, 0)} />
            <StatRow label="Current" value={fmt(mower?.esc_current, 1)} unit="A" />
            <StatRow label="Temp" value={fmt(mower?.motor_temperature, 0)} unit="°C" />
          </div>
          <div className="mt-[.6rem]">
            <EscFaultChip label="Fault" code={mower?.esc_fault_code} />
          </div>
        </DiagCard>

        <DiagCard label="Rain">
          <div className="flex items-center justify-between">
            <Chip variant={rainWet ? 'info' : 'neutral'}>{mower ? (rainWet ? 'Wet' : 'Dry') : '—'}</Chip>
            <span className="tabular-nums text-[.76rem] text-ink-soft">
              value <b className="font-mono font-semibold text-ink">{fmt(mower?.rain_value, 2)}</b>
            </span>
          </div>
        </DiagCard>

        <DiagCard label="Capabilities">
          <CapabilityChips capabilities={capabilities} />
        </DiagCard>
      </div>

      {/* ===== Desktop: dense multi-column grid, everything visible with no scroll ===== */}
      <div className="hidden md:grid md:min-h-0 md:flex-1 md:auto-rows-min md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        <DiagCard label="Battery & power">
          <ProgressBar value={state?.battery_percentage ?? 0} className="mb-[.7rem]" />
          <StatRow boxed label="Voltage" value={fmt(batteryVoltage, 1)} unit="V" />
          <StatRow boxed divider label="Current" value={fmt(battery?.current, 1)} unit="A" />
          <StatRow boxed divider label="Charge" value={state?.battery_percentage ?? '—'} unit="%" />
          <StatRow boxed divider label="Temp" value={fmt(battery?.temperature, 0)} unit="°C" />
          <StatRow boxed divider label="Cycles" value={battery?.cycle_count ?? '—'} />
          <StatRow boxed divider label="Status" value={power?.charger_status || '—'} />
        </DiagCard>

        <DiagCard
          label="GPS"
          action={<Chip variant={gps ? gpsFixVariant(gps) : 'neutral'}>{gps ? gpsFixLabel(gps) : 'NO DATA'}</Chip>}
        >
          <StatRow boxed label="Quality" value={state?.gps_percentage ?? '—'} unit="%" />
          <StatRow boxed divider label="Accuracy" value={fmt(gpsAccuracyCm, 1)} unit="cm" />
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
          <div className="mt-[.6rem] flex items-center justify-between gap-2">
            <EscFaultChip label="L" code={escLeft?.fault_code} />
            <EscFaultChip label="R" code={escRight?.fault_code} />
          </div>
        </DiagCard>

        <DiagCard label="Mow ESC" action={<EscFaultChip label="Fault" code={mower?.esc_fault_code} />}>
          <StatRow boxed label="RPM" value={fmt(mower?.motor_rpm, 0)} />
          <StatRow boxed divider label="Current" value={fmt(mower?.esc_current, 1)} unit="A" />
          <StatRow boxed divider label="Temp" value={fmt(mower?.motor_temperature, 0)} unit="°C" />
        </DiagCard>

        <DiagCard label="Rain" action={<Chip variant={rainWet ? 'info' : 'neutral'}>{mower ? (rainWet ? 'Wet' : 'Dry') : '—'}</Chip>}>
          <StatRow boxed label="Sensor value" value={fmt(mower?.rain_value, 2)} />
        </DiagCard>

        <DiagCard label="Capabilities">
          <CapabilityChips capabilities={capabilities} />
        </DiagCard>
      </div>
    </div>
  );
}
