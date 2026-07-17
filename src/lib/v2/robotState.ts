import type {MowerHeroState} from '@/components/v2/ui/MowingHero';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BatteryCharging,
  CheckCircle2,
  Compass,
  Gamepad2,
  Home as HomeIcon,
  type LucideIcon,
  Map as MapIcon,
  Pause,
  Pencil,
  Power,
  Ruler,
  RotateCcw,
  Sprout,
  TriangleAlert,
} from 'lucide-react';

// The canonical W9 state enum (STATE_COMMAND_MODEL.md §1) — replaces the two ad-hoc unions V2
// shipped with (MowingHero's MowerHeroState, DeviceHome's PowerStatus). The gateway will publish
// this (retained) on `robot_state/json`; for now it's driven entirely by useRobotStateMock.ts.
export type RobotState =
  | 'BOOTING'
  | 'READY'
  | 'IDLE'
  | 'DOCKED'
  | 'DOCKED_CHARGING'
  | 'PLANNING_MISSION'
  | 'MOWING'
  | 'PAUSED'
  | 'RECOVERING'
  | 'HEADING_CALIBRATION'
  | 'UNDOCKING'
  | 'DOCKING'
  | 'AREA_RECORDING'
  | 'MANUAL_DRIVE'
  | 'ERROR'
  | 'AWAITING_HEIGHT_CONFIRM';

export type PausedReason =
  | 'EMERGENCY'
  | 'COLLISION'
  | 'POSE_UNTRUSTED'
  | 'GPS_LOSS'
  | 'RAIN'
  | 'MANUAL'
  | 'BATTERY_LOW'
  | 'NOT_READY';

export type RejectCode =
  | 'EMERGENCY_ACTIVE'
  | 'POSE_UNTRUSTED'
  | 'NO_GPS_FIX'
  | 'NO_MAP'
  | 'NO_DOCK'
  | 'BATTERY_LOW'
  | 'ALREADY_RUNNING'
  | 'ALREADY_DOCKED'
  | 'NOT_READY'
  | 'RAIN_DELAY'
  | 'UNSUPPORTED';

export type CommandName = 'mow' | 'stop' | 'dock' | 'pause' | 'resume' | 'undock';

// Canonical enumeration lists -- the single place every value of each union is spelled out, so
// the R4 completeness-gate test (and BootingScreen/PausedBlockerScreen's default ordering) is
// driven off the SAME list the copy tables below are checked against, not a copy of it. Keep
// these in lockstep with their union type above (the compiler enforces STATE_COPY/REASON_COPY/
// REJECT_COPY are Record<..., ...> — i.e. exhaustive over the type — but a plain array like this
// one needs the same discipline by hand when the union grows).
export const ALL_ROBOT_STATES: RobotState[] = [
  'BOOTING',
  'READY',
  'IDLE',
  'DOCKED',
  'DOCKED_CHARGING',
  'PLANNING_MISSION',
  'MOWING',
  'PAUSED',
  'RECOVERING',
  'HEADING_CALIBRATION',
  'UNDOCKING',
  'DOCKING',
  'AREA_RECORDING',
  'MANUAL_DRIVE',
  'ERROR',
  'AWAITING_HEIGHT_CONFIRM',
];

export const ALL_PAUSED_REASONS: PausedReason[] = [
  'EMERGENCY',
  'COLLISION',
  'POSE_UNTRUSTED',
  'GPS_LOSS',
  'RAIN',
  'MANUAL',
  'BATTERY_LOW',
  'NOT_READY',
];

export const ALL_REJECT_CODES: RejectCode[] = [
  'EMERGENCY_ACTIVE',
  'POSE_UNTRUSTED',
  'NO_GPS_FIX',
  'NO_MAP',
  'NO_DOCK',
  'BATTERY_LOW',
  'ALREADY_RUNNING',
  'ALREADY_DOCKED',
  'NOT_READY',
  'RAIN_DELAY',
  'UNSUPPORTED',
];

export const ALL_COMMAND_NAMES: CommandName[] = ['mow', 'stop', 'dock', 'pause', 'resume', 'undock'];

// Fixed readiness keys (W9 §0.8), in the order the BOOTING checklist displays them.
export const READINESS_KEYS = ['board_comms', 'map', 'gps', 'estimator', 'nav2', 'safety'] as const;
export type ReadinessKey = (typeof READINESS_KEYS)[number];
export type ReadinessValue = 'ok' | 'waiting' | 'converging' | 'activating' | 'error';

export interface StateDetail {
  progress?: number;
  phase?: string;
  eta?: string;
}

export interface CommandAvailability {
  allowed: boolean;
  reasons: RejectCode[];
}

export interface RobotStateSnapshot {
  state: RobotState;
  stateDetail?: StateDetail;
  reasons: PausedReason[];
  commands: Record<CommandName, CommandAvailability>;
  readiness?: Record<string, ReadinessValue>;
  error?: {code: string};
}

export type Tone = 'accent' | 'warn' | 'danger' | 'info' | 'neutral';

// One copy table keyed by every gateway enum value (STATE_COMMAND_MODEL.md §3) — state pill
// text, hero overlay, and any future PAUSED/BOOTING screens all read from this so they can
// never disagree. Tone mirrors StatePill/Chip's vocabulary (accent/warn/info/neutral/danger).
export const STATE_COPY: Record<RobotState, {label: string; sub?: string; tone: Tone; icon: LucideIcon}> = {
  BOOTING: {label: 'Starting up', sub: 'Checking systems', tone: 'neutral', icon: Power},
  READY: {label: 'Ready', sub: 'Waiting for a command', tone: 'neutral', icon: CheckCircle2},
  IDLE: {label: 'Idle', sub: 'Waiting for next schedule', tone: 'neutral', icon: Sprout},
  DOCKED: {label: 'Docked', sub: 'Ready at the dock', tone: 'info', icon: HomeIcon},
  DOCKED_CHARGING: {label: 'Charging', sub: 'Charging at the dock', tone: 'info', icon: BatteryCharging},
  PLANNING_MISSION: {label: 'Planning', sub: 'Working out the route', tone: 'info', icon: MapIcon},
  MOWING: {label: 'Mowing', tone: 'accent', icon: Sprout},
  PAUSED: {label: 'Paused', sub: 'Holding position', tone: 'warn', icon: Pause},
  RECOVERING: {label: 'Recovering', sub: 'Working through an obstacle', tone: 'warn', icon: RotateCcw},
  HEADING_CALIBRATION: {label: 'Finding heading', sub: 'Driving a short calibration loop', tone: 'info', icon: Compass},
  UNDOCKING: {label: 'Undocking', sub: 'Leaving the dock', tone: 'info', icon: ArrowUpFromLine},
  DOCKING: {label: 'Docking', sub: 'Returning to dock', tone: 'info', icon: ArrowDownToLine},
  AREA_RECORDING: {label: 'Recording area', sub: 'Tracing a boundary', tone: 'accent', icon: Pencil},
  MANUAL_DRIVE: {label: 'Manual drive', sub: 'Under your control', tone: 'accent', icon: Gamepad2},
  ERROR: {label: 'Error', sub: 'Needs attention', tone: 'danger', icon: TriangleAlert},
  AWAITING_HEIGHT_CONFIRM: {label: 'Confirm cut height', sub: 'Waiting for you to confirm', tone: 'warn', icon: Ruler},
};

// PAUSED can carry several stacked reasons at once (most-severe first per §3); this is the
// per-reason copy those banners/chips read from.
export const REASON_COPY: Record<PausedReason, {label: string; tone: Tone}> = {
  EMERGENCY: {label: 'Emergency stop', tone: 'danger'},
  COLLISION: {label: 'Collision detected', tone: 'danger'},
  POSE_UNTRUSTED: {label: 'Position not trusted', tone: 'warn'},
  GPS_LOSS: {label: 'Waiting for GPS fix', tone: 'warn'},
  RAIN: {label: 'Rain delay', tone: 'neutral'},
  MANUAL: {label: 'Paused manually', tone: 'neutral'},
  BATTERY_LOW: {label: 'Battery low', tone: 'neutral'},
  NOT_READY: {label: 'Not ready', tone: 'warn'},
};

// Short reason-chip text for a disabled command button — one row per RejectCode the mock
// command gate (useRobotStateMock.ts) can emit.
export const REJECT_COPY: Record<RejectCode, {label: string}> = {
  EMERGENCY_ACTIVE: {label: 'Emergency stop active'},
  POSE_UNTRUSTED: {label: 'Position not trusted'},
  NO_GPS_FIX: {label: 'Waiting for GPS fix'},
  NO_MAP: {label: 'No map yet'},
  NO_DOCK: {label: 'No dock recorded'},
  BATTERY_LOW: {label: 'Battery too low'},
  ALREADY_RUNNING: {label: 'Already mowing'},
  ALREADY_DOCKED: {label: 'Already docked'},
  NOT_READY: {label: 'Not ready yet'},
  RAIN_DELAY: {label: 'Waiting out the rain'},
  UNSUPPORTED: {label: 'Not supported yet'},
};

// Maps the full 16-value enum onto MowingHero's scene vocabulary (mowing/paused/docked/
// charging/idle) plus the `planning` busy overlay — see STATE_COMMAND_MODEL.md §5.
export function heroSceneForState(state: RobotState): MowerHeroState {
  switch (state) {
    case 'MOWING':
      return 'mowing';
    case 'PAUSED':
    case 'AWAITING_HEIGHT_CONFIRM':
      return 'paused';
    case 'DOCKED':
    case 'DOCKING':
    case 'UNDOCKING':
      return 'docked';
    case 'DOCKED_CHARGING':
      return 'charging';
    case 'PLANNING_MISSION':
    case 'RECOVERING':
    case 'AREA_RECORDING':
    case 'MANUAL_DRIVE':
    case 'HEADING_CALIBRATION':
    case 'BOOTING':
    case 'READY':
    case 'IDLE':
    case 'ERROR':
    default:
      return 'idle';
  }
}

export function isPlanning(state: RobotState): boolean {
  return state === 'PLANNING_MISSION';
}

// "On the lawn" states — mid-job scenes where a coverage % and RTK trust chip make sense.
export function isOnLawn(state: RobotState): boolean {
  return state === 'MOWING' || state === 'PAUSED' || state === 'PLANNING_MISSION' || state === 'RECOVERING';
}

// `current_state` values (mower_logic's HighLevelStatus, folded into robot_state/json) that map
// 1:1 onto our RobotState enum by name. DOCKED is handled separately below since is_charging
// splits it into two RobotState values — same "docked" convention MowerMap.tsx/MowerControls.tsx
// already use. Anything else (older/newer gateway, a value we don't render a dedicated scene
// for yet) falls back to IDLE rather than guessing. Lives here (not useRobotState.ts) so both
// useRobotState.ts (the display hook) and useRobotStateSnapshot.ts (the canonical-state binding,
// R3/R6 fallback) can import it without a cycle between those two hook modules.
const DIRECT_STATE_MAP: Partial<Record<string, RobotState>> = {
  IDLE: 'IDLE',
  MOWING: 'MOWING',
  PAUSED: 'PAUSED',
  DOCKING: 'DOCKING',
  UNDOCKING: 'UNDOCKING',
  AREA_RECORDING: 'AREA_RECORDING',
  HEADING_CALIBRATION: 'HEADING_CALIBRATION',
};

export function toRobotState(currentState: string | undefined, isCharging: boolean): RobotState {
  if (!currentState) return 'IDLE';
  if (currentState === 'DOCKED') return isCharging ? 'DOCKED_CHARGING' : 'DOCKED';
  return DIRECT_STATE_MAP[currentState] ?? 'IDLE';
}
