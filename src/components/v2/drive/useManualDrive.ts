'use client';

// The one manual-drive "brain" shared by every drive surface (Manual control page, Record area).
// It owns the input-mode toggle (+persistence), the Speed control, the gamepad (axes → drive, face
// buttons/bumpers → actions), the merged touch+gamepad drive command, and publishes it over the
// real `teleop{vx,vz}` MQTT path via useTeleop. Consumers just render controls against the returned
// state and pass in whatever actions they support — Record area, for instance, passes none (no
// blade/dock/stop there), so those gamepad buttons simply do nothing while recording.
import type {StickVector} from '@/components/v2/ui/AnalogStick';
import type {Direction} from '@/components/v2/ui/Joystick';
import {useTeleop} from '@/hooks/useTeleop';
import {gamepadButtonLabels, type GamepadButtonLabels, type GamepadState, useGamepad} from '@/lib/v2/useGamepad';
import {useEffect, useRef, useState} from 'react';
import {
  axesToDirection,
  directionToVelocity,
  INPUT_MODE_STORAGE_KEY,
  type InputMode,
  SPEED_FACTOR,
  SPEED_OPTIONS,
  vectorToVelocity,
} from './driveMath';

const ZERO_VECTOR: StickVector = {x: 0, y: 0};

/** Optional actions a drive surface exposes to gamepad face buttons. A/✕ = Stop, B/○ = Dock,
 *  X/□ = toggle blade. Any omitted action just makes its button inert (Record area passes none). */
export interface ManualDriveActions {
  onStop?: () => void;
  onDock?: () => void;
  /** Only fired while `driveEnabled` — the blade is unsafe to toggle before the drive input is
   *  unlocked, matching the on-screen blade button. */
  onToggleBlade?: () => void;
}

export interface UseManualDriveOptions {
  /** Master gate for the DRIVE input (velocity publishing + stick reads). While false the mower is
   *  held at zero. Face-button Stop/Dock stay live regardless (so an e-stop works before unlock);
   *  the blade toggle is gated by this. */
  driveEnabled: boolean;
  /** Initial Speed step. Record area defaults to 'slow' for precise boundary tracing; the Manual
   *  control page defaults to 'normal'. */
  defaultSpeed?: string;
  actions?: ManualDriveActions;
}

export interface ManualDrive {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  speed: string;
  setSpeed: (speed: string) => void;
  stepSpeed: (dir: 1 | -1) => void;
  gamepad: GamepadState;
  /** Brand-correct button glyphs while a controller is connected, else null. */
  gamepadLabels: GamepadButtonLabels | null;
  driveDirection: Direction | null;
  driveVector: StickVector | null;
  onTouchDirection: (dir: Direction | null) => void;
  onTouchVector: (vec: StickVector) => void;
}

export function useManualDrive({driveEnabled, defaultSpeed = 'normal', actions}: UseManualDriveOptions): ManualDrive {
  const [inputMode, setInputModeState] = useState<InputMode>('dpad');
  useEffect(() => {
    const stored = localStorage.getItem(INPUT_MODE_STORAGE_KEY);
    if (stored === 'dpad' || stored === 'joystick') setInputModeState(stored);
  }, []);
  const setInputMode = (mode: InputMode) => {
    setInputModeState(mode);
    localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode);
  };

  const [speed, setSpeed] = useState(defaultSpeed);
  const stepSpeed = (dir: 1 | -1) => {
    setSpeed((current) => {
      const idx = SPEED_OPTIONS.findIndex((o) => o.value === current);
      return SPEED_OPTIONS[Math.min(SPEED_OPTIONS.length - 1, Math.max(0, idx + dir))].value;
    });
  };

  const gamepad = useGamepad();
  const gamepadLabels = gamepad.connected ? gamepadButtonLabels(gamepad.brand) : null;

  // Touch and gamepad both feed the one drive command; touch takes priority if both are active.
  const [touchDirection, setTouchDirection] = useState<Direction | null>(null);
  const gamepadDirection = driveEnabled ? axesToDirection(gamepad.axes.lx, gamepad.axes.ly) : null;
  const driveDirection = touchDirection ?? gamepadDirection;

  const [touchVector, setTouchVector] = useState<StickVector>(ZERO_VECTOR);
  const gamepadVector: StickVector | null = driveEnabled ? {x: gamepad.axes.lx, y: gamepad.axes.ly} : null;
  const driveVector = touchVector.x !== 0 || touchVector.y !== 0 ? touchVector : gamepadVector;

  // Publishes over the real `teleop{vx,vz}` MQTT path (useTeleop owns the ~100ms publish interval
  // and zeroing on unmount). Zeroed whenever drive is disabled so a torn-down/locked surface never
  // leaves the mower driving.
  const {setVelocity} = useTeleop();
  useEffect(() => {
    if (!driveEnabled) {
      setVelocity(0, 0);
      return;
    }
    const factor = SPEED_FACTOR[speed] ?? 1;
    const {vx, vz} =
      inputMode === 'dpad' ? directionToVelocity(driveDirection, factor) : vectorToVelocity(driveVector, factor);
    setVelocity(vx, vz);
  }, [driveEnabled, inputMode, driveDirection, driveVector, speed, setVelocity]);

  // A physical stick is analog — default to Joystick mode once per connect. If the user then
  // switches back to D-pad this won't fight them (edge-triggered) until a disconnect/reconnect.
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (gamepad.connected && !prevConnectedRef.current) setInputMode('joystick');
    prevConnectedRef.current = gamepad.connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamepad.connected]);

  // Rising-edge detection so a held gamepad button fires once per press, not once per frame —
  // mirrors what a click/tap already does for touch. `actions`/`driveEnabled` are read through refs
  // so this effect only re-runs on a button change (never re-arming/double-firing when the drive
  // gate or the action callbacks change identity).
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const driveEnabledRef = useRef(driveEnabled);
  driveEnabledRef.current = driveEnabled;
  const stepSpeedRef = useRef(stepSpeed);
  stepSpeedRef.current = stepSpeed;
  const prevButtonsRef = useRef(gamepad.buttons);
  useEffect(() => {
    const prev = prevButtonsRef.current;
    const btn = gamepad.buttons;
    const a = actionsRef.current;
    if (btn.a && !prev.a) a?.onStop?.();
    if (btn.b && !prev.b) a?.onDock?.();
    if (btn.x && !prev.x && driveEnabledRef.current) a?.onToggleBlade?.();
    if (btn.lb && !prev.lb) stepSpeedRef.current(-1);
    if (btn.rb && !prev.rb) stepSpeedRef.current(1);
    prevButtonsRef.current = btn;
  }, [gamepad.buttons]);

  return {
    inputMode,
    setInputMode,
    speed,
    setSpeed,
    stepSpeed,
    gamepad,
    gamepadLabels,
    driveDirection,
    driveVector,
    onTouchDirection: setTouchDirection,
    onTouchVector: setTouchVector,
  };
}
