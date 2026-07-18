// Shared drive-command math for every manual-drive surface (the Manual control page + Record
// area). Kept ROS-free/pure so it can be unit-tested without mounting any UI (see
// ManualControl.test.tsx, which imports directionToVelocity/vectorToVelocity). The one source of
// truth for how a d-pad direction / analog vector / gamepad stick maps to a teleop{vx,vz}.
import type {StickVector} from '@/components/v2/ui/AnalogStick';
import type {Direction} from '@/components/v2/ui/Joystick';

export type InputMode = 'dpad' | 'joystick';

export const INPUT_MODE_OPTIONS: {value: InputMode; label: string}[] = [
  {value: 'dpad', label: 'D-pad'},
  {value: 'joystick', label: 'Joystick'},
];

export const INPUT_MODE_STORAGE_KEY = 'v2.control.inputMode';

export const SPEED_OPTIONS = [
  {value: 'slow', label: 'Slow'},
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
];

// `MAX_LINEAR_MPS` is the mower's real wheel max (~0.5 m/s, faster than the 0.4 m/s autonomous mow
// speed) so "Fast" reaches the actual top speed rather than throttling below it — the
// drivetrain/xESC clamp to the physical max regardless, so this can't overdrive the wheels. The
// Speed control scales both linear and angular by the same factor (APP-ONLY client-side math — no
// backend speed concept), capping out at "Fast" = exactly this max rather than exceeding it.
export const MAX_LINEAR_MPS = 0.5;
export const MAX_ANGULAR_RAD_S = 1.6;
export const SPEED_FACTOR: Record<string, number> = {slow: 0.4, normal: 0.7, fast: 1};

export function directionToVelocity(dir: Direction | null, factor: number): {vx: number; vz: number} {
  switch (dir) {
    case 'up':
      return {vx: MAX_LINEAR_MPS * factor, vz: 0};
    case 'down':
      return {vx: -MAX_LINEAR_MPS * factor, vz: 0};
    case 'left':
      return {vx: 0, vz: MAX_ANGULAR_RAD_S * factor};
    case 'right':
      return {vx: 0, vz: -MAX_ANGULAR_RAD_S * factor};
    default:
      return {vx: 0, vz: 0};
  }
}

// StickVector.y is screen-space (down = positive, see AnalogStick.tsx), so "up"/forward is -y —
// same sign convention VirtualJoystick's drag math uses.
export function vectorToVelocity(vec: StickVector | null, factor: number): {vx: number; vz: number} {
  if (!vec) return {vx: 0, vz: 0};
  return {vx: -vec.y * MAX_LINEAR_MPS * factor, vz: -vec.x * MAX_ANGULAR_RAD_S * factor};
}

// Left-stick analog → the same discrete up/down/left/right vocabulary the touch d-pad speaks
// (Joystick is a clickpad, not analog) — dominant-axis reading, already deadzoned by useGamepad.
export function axesToDirection(lx: number, ly: number): Direction | null {
  if (lx === 0 && ly === 0) return null;
  return Math.abs(ly) >= Math.abs(lx) ? (ly < 0 ? 'up' : 'down') : lx < 0 ? 'left' : 'right';
}
