'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {outerCardStyles} from '@/lib/cardStyles';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';

import {
  BatteryChargingFull as BatteryChargingIcon,
  BatteryFull as BatteryIcon,
  CheckCircle as CheckIcon,
  ContentCut as BladeIcon,
  Explore as HeadingIcon,
  GpsFixed as GpsIcon,
  MyLocation as PositionIcon,
  PlayArrow as ProgressIcon,
  ReportProblem as EmergencyIcon,
  Sensors as SensorIcon,
} from '@mui/icons-material';
import {Box, Card, CardContent, Chip, Divider, LinearProgress, Typography, useTheme} from '@mui/material';
import type {ReactNode} from 'react';

// The sensor values shown here come live from the robot over MQTT (see stores/mowersStore).
// The mower publishes a consolidated `robot_state/json` (parsed into `state`) and a live
// `position/json` (parsed into `position`). These aggregate the ROS2 /ll/* sensor topics that the
// xbot_mqtt bridge collects (Power/Bms -> battery, Status/Emergency -> state, AbsolutePose ->
// pose/GPS quality). Only fields the bridge actually exposes are surfaced here.

const RAD_TO_DEG = 180 / Math.PI;

function normalizeDegrees(rad: number): number {
  const deg = (rad * RAD_TO_DEG) % 360;
  return deg < 0 ? deg + 360 : deg;
}

function batteryColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 50) return 'success';
  if (pct >= 20) return 'warning';
  return 'error';
}

function gpsColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 70) return 'success';
  if (pct >= 30) return 'warning';
  return 'error';
}

function humanizeState(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

// Units that read better without a space between value and unit.
const TIGHT_UNITS = new Set(['%', '°']);

/**
 * Format a telemetry number that may be null. The ROS2 gateway sends `null` for any
 * value the hardware reports as NaN (an unpopulated current/ADC channel, etc.), so
 * render those as an em dash instead of crashing on `null.toFixed()` or printing NaN.
 */
function fmt(value: number | null | undefined, digits: number, unit?: string, prefix = ''): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const num = `${prefix}${value.toFixed(digits)}`;
  if (!unit) return num;
  return TIGHT_UNITS.has(unit) ? `${num}${unit}` : `${num} ${unit}`;
}

// GPS fix flags (xbot_msgs/msg/AbsolutePose): FLAG_GPS_RTK=1, FLAG_GPS_RTK_FIXED=2,
// FLAG_GPS_RTK_FLOAT=4, FLAG_GPS_DEAD_RECKONING=8. The gateway pre-decodes them into
// booleans; we translate to human-readable text here rather than showing the raw word.
type GpsFlags = {
  flags: number;
  rtk: boolean;
  rtk_fixed: boolean;
  rtk_float: boolean;
  dead_reckoning: boolean;
};

/** The single strongest fix state, for the primary "Fix type" readout. */
function gpsFixLabel(gps: GpsFlags): string {
  if (gps.rtk_fixed) return 'RTK Fixed';
  if (gps.rtk_float) return 'RTK Float';
  if (gps.dead_reckoning) return 'Dead Reckoning';
  if (gps.rtk) return 'RTK (converging)';
  return 'Single / No Fix';
}

function gpsFixColor(gps: GpsFlags): 'success' | 'warning' | 'default' {
  if (gps.rtk_fixed) return 'success';
  if (gps.rtk_float || gps.dead_reckoning) return 'warning';
  return 'default';
}

/** Every active flag bit spelled out, incl. a fallback for undefined bits. */
function gpsActiveFlags(gps: GpsFlags): string {
  const out: string[] = [];
  if (gps.rtk) out.push('RTK corrections');
  if (gps.rtk_fixed) out.push('Fixed solution');
  if (gps.rtk_float) out.push('Float solution');
  if (gps.dead_reckoning) out.push('Dead reckoning');
  const unknown = gps.flags & ~0b1111; // bits beyond the four defined flags
  if (unknown) out.push(`unknown 0x${unknown.toString(16)}`);
  return out.length > 0 ? out.join(', ') : 'none';
}

/** A labelled block with an icon header. */
function SensorCard({title, icon, children}: {title: string; icon: ReactNode; children: ReactNode}) {
  const theme = useTheme();
  return (
    <Card sx={outerCardStyles(theme)}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
          <Box sx={{color: 'primary.main', display: 'flex'}}>{icon}</Box>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

/** A metered value: label + value on one row, progress bar underneath. */
function MeteredValue({
  label,
  displayValue,
  percent,
  color,
}: {
  label: string;
  displayValue: string;
  percent: number;
  color: 'primary' | 'success' | 'warning' | 'error' | 'info';
}) {
  return (
    <Box sx={{mb: 2}}>
      <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.5}}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight="medium">
          {displayValue}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.max(0, Math.min(100, percent))}
        color={color}
        sx={{height: 6, borderRadius: 3}}
      />
    </Box>
  );
}

/** A simple label/value pair for readouts that aren't metered. */
function Readout({label, value}: {label: ReactNode; value: ReactNode}) {
  return (
    <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5}}>
      <Typography variant="body2" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="medium" component="div" sx={{textAlign: 'right'}}>
        {value}
      </Typography>
    </Box>
  );
}

export default function SensorsPage() {
  const theme = useTheme();
  const mowerId = useSelectedMower((mower) => mower?.id);
  const name = useSelectedMower((mower) => mower?.name);
  const state = useSelectedMower((mower) => mower?.state);
  const position = useSelectedMower((mower) => mower?.position);
  const datum = useSelectedMower((mower) => mower?.map.datum);
  const mqttStatus = useMowersStore((store) => (mowerId ? store.mqttStatuses[mowerId] : undefined));

  if (!mowerId || !state) {
    return (
      <Page>
        <PageHeader title="Sensor Data & Diagnostics" subtitle="Live monitoring of the mower's low-level systems" />
        <PageContent>
          <Card sx={outerCardStyles(theme)}>
            <CardContent>
              <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1}}>
                <SensorIcon sx={{fontSize: 48, color: theme.palette.grey[400]}} />
                <Typography variant="body1" color="text.secondary">
                  No mower selected.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </PageContent>
      </Page>
    );
  }

  const isConnected = mqttStatus === 'connected';
  const pose = state.pose;
  const blades = position?.attributes.blades ?? false;
  // Full low-level telemetry from the ROS2 gateway (robot_state.sensors). Each
  // block is present only when its /ll/* source topic is live.
  const sensors = state.sensors;
  const power = sensors?.power;
  const battery = sensors?.battery;
  const mower = sensors?.mower;
  const escLeft = sensors?.esc_left;
  const escRight = sensors?.esc_right;
  const emergencyInfo = sensors?.emergency;
  const gps = sensors?.gps;
  // current_action_progress is a 0..1 fraction from ROS.
  const progressPercent = Math.round(Math.max(0, Math.min(1, state.current_action_progress)) * 100);
  const headingRad = pose?.heading ?? position?.heading;

  return (
    <Page>
      <PageHeader
        title="Sensor Data & Diagnostics"
        subtitle={`Live low-level telemetry for ${name ?? 'the selected mower'}`}
      >
        <HeaderStat
          icon={state.is_charging ? <BatteryChargingIcon /> : <BatteryIcon />}
          value={`${state.battery_percentage}%`}
          label={state.is_charging ? 'Battery (charging)' : 'Battery'}
        />
        <HeaderStat icon={<GpsIcon />} value={`${state.gps_percentage}%`} label="GPS quality" />
        <HeaderStat
          icon={state.emergency ? <EmergencyIcon /> : <CheckIcon />}
          value={humanizeState(state.current_state)}
          label="Current state"
        />
      </PageHeader>

      <PageContent>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {xs: '1fr', md: 'repeat(2, 1fr)'},
            gap: 3,
          }}
        >
          {/* System / mower status */}
          <SensorCard title="System Status" icon={<CheckIcon />}>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2}}>
              <Chip
                size="small"
                label={isConnected ? 'Connected' : (mqttStatus ?? 'connecting')}
                color={isConnected ? 'success' : 'default'}
              />
              <Chip
                size="small"
                icon={state.emergency ? <EmergencyIcon /> : <CheckIcon />}
                label={state.emergency ? 'Emergency' : 'No emergency'}
                color={state.emergency ? 'error' : 'success'}
              />
              <Chip
                size="small"
                label={state.is_charging ? 'Charging' : 'Not charging'}
                color={state.is_charging ? 'info' : 'default'}
              />
            </Box>
            <Readout label="State" value={humanizeState(state.current_state)} />
            {state.current_sub_state && <Readout label="Sub-state" value={humanizeState(state.current_sub_state)} />}
            {emergencyInfo?.active && emergencyInfo.reason && (
              <Readout label="Emergency reason" value={emergencyInfo.reason} />
            )}
          </SensorCard>

          {/* Battery & power */}
          <SensorCard title="Battery & Power" icon={state.is_charging ? <BatteryChargingIcon /> : <BatteryIcon />}>
            <MeteredValue
              label="Charge"
              displayValue={`${state.battery_percentage}%`}
              percent={state.battery_percentage}
              color={batteryColor(state.battery_percentage)}
            />
            <Readout
              label="Charging"
              value={
                <Chip
                  size="small"
                  label={state.is_charging ? 'Yes' : 'No'}
                  color={state.is_charging ? 'info' : 'default'}
                />
              }
            />
            {(battery || power) && <Divider sx={{my: 1}} />}
            {battery && (
              <>
                <Readout label="Battery voltage" value={fmt(battery.voltage, 2, 'V')} />
                <Readout label="Battery current" value={fmt(battery.current, 2, 'A')} />
                <Readout label="Battery temp" value={fmt(battery.temperature, 1, '°C')} />
                <Readout label="State of charge" value={fmt(battery.state_of_charge, 0, '%')} />
                <Readout label="Charge cycles" value={battery.cycle_count} />
              </>
            )}
            {power && (
              <>
                {/* This HW has no smart-battery (/ll/battery) topic, so the real pack
                    voltage/charge come from /ll/power. Only surface them here when the
                    dedicated battery block is absent, to avoid duplicate rows. */}
                {!battery && <Readout label="Battery voltage" value={fmt(power.battery_voltage, 2, 'V')} />}
                <Readout label="Charger voltage" value={fmt(power.charge_voltage, 2, 'V')} />
                <Readout label="Charger current" value={fmt(power.charge_current, 2, 'A')} />
                {power.charger_status && <Readout label="Charger status" value={power.charger_status} />}
              </>
            )}
          </SensorCard>

          {/* Positioning / GPS */}
          <SensorCard title="Positioning & GPS" icon={<GpsIcon />}>
            <MeteredValue
              label="GPS quality"
              displayValue={`${state.gps_percentage}%`}
              percent={state.gps_percentage}
              color={gpsColor(state.gps_percentage)}
            />
            {pose ? (
              <>
                <Readout label="Position accuracy" value={`±${pose.pos_accuracy.toFixed(2)} m`} />
                <Readout
                  label="Heading valid"
                  value={
                    <Chip
                      size="small"
                      label={pose.heading_valid ? 'Yes' : 'No'}
                      color={pose.heading_valid ? 'success' : 'warning'}
                    />
                  }
                />
                <Readout label="Heading accuracy" value={`±${(pose.heading_accuracy * RAD_TO_DEG).toFixed(1)}°`} />
              </>
            ) : (
              <Typography variant="body2" color="text.disabled" sx={{py: 0.5}}>
                No pose fix yet.
              </Typography>
            )}
            {gps && (
              <>
                <Readout
                  label="Fix type"
                  value={<Chip size="small" label={gpsFixLabel(gps)} color={gpsFixColor(gps)} />}
                />
                <Readout label="Fix accuracy" value={fmt(gps.position_accuracy, 3, 'm', '±')} />
                <Readout
                  label="GPS flags"
                  value={
                    <Box component="span" title={`0x${gps.flags.toString(16)}`}>
                      {gpsActiveFlags(gps)}
                    </Box>
                  }
                />
              </>
            )}
            {datum && <Readout label="Datum" value={`${datum.lat.toFixed(6)}, ${datum.long.toFixed(6)}`} />}
          </SensorCard>

          {/* Pose / odometry */}
          <SensorCard title="Pose" icon={<PositionIcon />}>
            {headingRad !== undefined ? (
              <Readout
                label={
                  <Box component="span" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                    <HeadingIcon fontSize="inherit" /> Heading
                  </Box>
                }
                value={`${normalizeDegrees(headingRad).toFixed(1)}°`}
              />
            ) : null}
            {pose && (
              <>
                <Readout label="X (east)" value={`${pose.x.toFixed(2)} m`} />
                <Readout label="Y (north)" value={`${pose.y.toFixed(2)} m`} />
              </>
            )}
            {position && (
              <>
                <Divider sx={{my: 1}} />
                <Readout
                  label={
                    <Box component="span" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                      <BladeIcon fontSize="inherit" /> Blades
                    </Box>
                  }
                  value={<Chip size="small" label={blades ? 'On' : 'Off'} color={blades ? 'success' : 'default'} />}
                />
              </>
            )}
            {!pose && !position && (
              <Typography variant="body2" color="text.disabled" sx={{py: 0.5}}>
                No live position yet.
              </Typography>
            )}
          </SensorCard>

          {/* Current job: area name + live mowing progress from HighLevelStatus. */}
          <SensorCard title="Current Job" icon={<ProgressIcon />}>
            {state.current_area >= 0 || state.current_area_name ? (
              <>
                <Readout
                  label="Area"
                  value={
                    state.current_area_name || (state.current_area >= 0 ? `Area ${state.current_area}` : '—')
                  }
                />
                <MeteredValue
                  label="Progress"
                  displayValue={`${progressPercent}%`}
                  percent={progressPercent}
                  color="info"
                />
                <Readout label="Path" value={state.current_path >= 0 ? state.current_path : '—'} />
                <Readout label="Path index" value={state.current_path_index >= 0 ? state.current_path_index : '—'} />
                {position?.attributes.job_id && <Readout label="Job ID" value={position.attributes.job_id} />}
              </>
            ) : (
              <Typography variant="body2" color="text.disabled" sx={{py: 0.5}}>
                No active job.
              </Typography>
            )}
          </SensorCard>

          {/* Drive & mower motor telemetry (ESC status) */}
          {(escLeft || escRight || mower) && (
            <SensorCard title="Drive & Mower Motors" icon={<SensorIcon />}>
              {escLeft && (
                <>
                  <Readout label="Left drive" value={`${escLeft.rpm} rpm · ${fmt(escLeft.current, 1, 'A')}`} />
                  <Readout
                    label="Left temp (motor / PCB)"
                    value={`${fmt(escLeft.temperature_motor, 1)} / ${fmt(escLeft.temperature_pcb, 1, '°C')}`}
                  />
                </>
              )}
              {escRight && (
                <>
                  <Readout label="Right drive" value={`${escRight.rpm} rpm · ${fmt(escRight.current, 1, 'A')}`} />
                  <Readout
                    label="Right temp (motor / PCB)"
                    value={`${fmt(escRight.temperature_motor, 1)} / ${fmt(escRight.temperature_pcb, 1, '°C')}`}
                  />
                </>
              )}
              {mower && (
                <>
                  {(escLeft || escRight) && <Divider sx={{my: 1}} />}
                  <Readout
                    label={
                      <Box component="span" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                        <BladeIcon fontSize="inherit" /> Mower motor
                      </Box>
                    }
                    value={`${fmt(mower.motor_rpm, 0)} rpm · ${fmt(mower.esc_current, 1, 'A')}`}
                  />
                  <Readout
                    label="Mower temp (motor / ESC)"
                    value={`${fmt(mower.motor_temperature, 1)} / ${fmt(mower.esc_temperature, 1, '°C')}`}
                  />
                  <Readout
                    label="Rain"
                    value={
                      <Chip
                        size="small"
                        label={mower.rain_detected ? 'Detected' : 'Dry'}
                        color={mower.rain_detected ? 'info' : 'default'}
                      />
                    }
                  />
                </>
              )}
            </SensorCard>
          )}
        </Box>
      </PageContent>
    </Page>
  );
}
