'use client';

// The unified manual-drive console — the one component every drive surface renders, feature-flagged
// so each surface enables only what it needs. The Manual control page composes the exported
// sub-components (DriveInput/SegmentedSpeedColumn/BladeColumn/ActionRow) directly across its bespoke
// responsive layouts; Record area embeds <DriveConsole> with the blade OFF (you're tracing a
// boundary, not cutting). All of them share the one drive brain (useManualDrive) so input-mode,
// speed, gamepad/PS5 support, and the teleop publish path behave identically everywhere.
import {AnalogStick, type StickVector} from '@/components/v2/ui/AnalogStick';
import {Button} from '@/components/v2/ui/Button';
import {Chip} from '@/components/v2/ui/Chip';
import {cn} from '@/components/v2/lib/cn';
import {type Direction, Joystick} from '@/components/v2/ui/Joystick';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import type {GamepadBrand, GamepadButtonLabels} from '@/lib/v2/useGamepad';
import {Gamepad2, Home, RotateCcw, Sprout, Square} from 'lucide-react';
import {INPUT_MODE_OPTIONS, type InputMode, SPEED_OPTIONS} from './driveMath';
import {type ManualDriveActions, useManualDrive} from './useManualDrive';

type InputModeType = InputMode;

function controllerName(brand: GamepadBrand): string {
  if (brand === 'playstation') return 'PlayStation';
  if (brand === 'xbox') return 'Xbox';
  return 'Controller';
}

// ── Shared presentational sub-components (used by DriveConsole AND the Manual control page) ──

/** A small brand-glyph pill pinned to the corner of the button it's hinting at (A/✕ = Stop,
 *  B/○ = Dock, X/□ = Blade, LB·RB / L1·R1 = Speed). Only rendered while a controller is connected. */
export function GamepadBadge({label, className}: {label: string; className?: string}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-surface px-1 text-[.6rem] font-bold leading-none text-ink-soft shadow-[var(--shadow-s)] ${className ?? ''}`}
    >
      {label}
    </span>
  );
}

/** Swaps between the d-pad clickpad and the analog stick per the "Input" toggle — both share the
 *  same Speed control and the same gamepad-left-stick source, read through each control's own
 *  vocabulary (discrete direction vs. continuous vector). */
export function DriveInput({
  size,
  mode,
  disabled,
  onDirectionChange,
  directionOverride,
  onVectorChange,
  vectorOverride,
}: {
  size: number;
  mode: InputModeType;
  disabled: boolean;
  onDirectionChange: (d: Direction | null) => void;
  directionOverride: Direction | null;
  onVectorChange: (v: StickVector) => void;
  vectorOverride: StickVector | null;
}) {
  return mode === 'dpad' ? (
    <Joystick size={size} disabled={disabled} onDirectionChange={onDirectionChange} activeOverride={directionOverride} />
  ) : (
    <AnalogStick size={size} disabled={disabled} onChange={onVectorChange} activeOverride={vectorOverride} />
  );
}

export function SegmentedSpeedColumn({
  speed,
  onStep,
  gamepadLabels,
}: {
  speed: string;
  onStep: (dir: 1 | -1) => void;
  gamepadLabels: GamepadButtonLabels | null;
}) {
  const idx = SPEED_OPTIONS.findIndex((o) => o.value === speed);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[.6rem] font-semibold uppercase tracking-wide text-ink-faint">Speed</span>
      <div className="relative">
        <Button variant="ghost" size="icon" onClick={() => onStep(-1)} aria-label="Slower" className="h-8 w-8 text-base leading-none">
          −
        </Button>
        {gamepadLabels ? <GamepadBadge label={gamepadLabels.lb} className="-right-1 -top-1" /> : null}
      </div>
      <span className="text-sm font-semibold text-accent">{SPEED_OPTIONS[idx].label}</span>
      <div className="relative">
        <Button variant="ghost" size="icon" onClick={() => onStep(1)} aria-label="Faster" className="h-8 w-8 text-base leading-none">
          +
        </Button>
        {gamepadLabels ? <GamepadBadge label={gamepadLabels.rb} className="-right-1 -top-1" /> : null}
      </div>
    </div>
  );
}

export function BladeColumn({
  height,
  onChange,
  disabled,
}: {
  height: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[.6rem] font-semibold uppercase tracking-wide text-ink-faint">Blade</span>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => onChange(Math.max(20, height - 5))}
        aria-label="Lower blade"
        className="h-8 w-8 text-base leading-none"
      >
        −
      </Button>
      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">
        <Sprout size={11} strokeWidth={2.4} />
        {height} mm
      </span>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => onChange(Math.min(60, height + 5))}
        aria-label="Raise blade"
        className="h-8 w-8 text-base leading-none"
      >
        +
      </Button>
    </div>
  );
}

export function ActionRow({
  hasError,
  bladeOn,
  bladeDisabled,
  bladeReason,
  onToggleBlade,
  onDock,
  onStop,
  dockDisabled,
  stopDisabled,
  gamepadLabels,
  className,
}: {
  hasError: boolean;
  bladeOn: boolean;
  bladeDisabled: boolean;
  /** Why the blade toggle is disabled beyond the hold-to-unlock lock -- e.g. the backend
   *  command_gate rejecting blade_on/blade_off because manual_drive hasn't been acked yet
   *  (REJECT_COPY's label for the gate's reject_code). Undefined while merely locked. */
  bladeReason?: string;
  onToggleBlade: () => void;
  onDock: () => void;
  onStop: () => void;
  /** Disabled while the command is in flight (`pending`) or the robot-state snapshot's
   *  `commands` map says it's currently blocked (see useCommandAvailability). */
  dockDisabled?: boolean;
  stopDisabled?: boolean;
  gamepadLabels: GamepadButtonLabels | null;
  className?: string;
}) {
  return (
    <div className={`flex ${className ?? ''}`}>
      <ActionItem icon={<Home size={17} strokeWidth={2.2} />} label="Dock" onClick={onDock} disabled={dockDisabled} badge={gamepadLabels?.b} />
      <ActionItem
        icon={<Square size={15} fill="currentColor" />}
        label="Stop"
        variant="danger"
        onClick={onStop}
        disabled={stopDisabled}
        badge={gamepadLabels?.a}
      />
      <ActionItem icon={<RotateCcw size={17} strokeWidth={2.2} />} label={hasError ? 'Clear error' : 'No active error'} disabled={!hasError} />
      <ActionItem
        icon={<Sprout size={17} strokeWidth={2.2} />}
        label={bladeOn ? 'Blade on' : 'Blade'}
        disabled={bladeDisabled}
        active={bladeOn}
        onClick={onToggleBlade}
        badge={gamepadLabels?.x}
        reason={bladeReason}
      />
    </div>
  );
}

function ActionItem({
  icon,
  label,
  variant,
  disabled,
  active,
  onClick,
  badge,
  reason,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: 'danger';
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  badge?: string;
  /** Short reason the control is disabled -- rendered as a small warn chip under the label
   *  (REJECT_COPY's text). Undefined shows nothing. */
  reason?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Button
          variant={variant === 'danger' ? 'danger' : 'ghost'}
          size="icon-lg"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className={active ? 'border-accent bg-accent-wash text-accent' : undefined}
        >
          {icon}
        </Button>
        {badge ? <GamepadBadge label={badge} className="-right-1 -top-1" /> : null}
      </div>
      <span className={`text-[.7rem] font-semibold ${variant === 'danger' ? 'text-danger' : disabled ? 'text-ink-faint' : 'text-ink-soft'}`}>
        {label}
      </span>
      {reason ? (
        <Chip variant="warn" className="px-1.5 py-0.5 text-[.6rem] leading-none whitespace-normal text-center">
          {reason}
        </Chip>
      ) : null}
    </div>
  );
}

// ── The assembled console ──

export interface DriveConsoleFeatures {
  /** Show the D-pad / Joystick input-mode toggle (default true). */
  inputMode?: boolean;
  /** Show the Speed control (default true). */
  speed?: boolean;
  /** Show the blade-height column (default false — Record area never cuts). */
  blade?: boolean;
}

export interface DriveConsoleProps {
  /** Master drive gate — while false the pad is greyed + inert and the mower is held at zero. */
  driveEnabled?: boolean;
  defaultSpeed?: string;
  /** Drive-input glyph size in px. */
  size?: number;
  features?: DriveConsoleFeatures;
  /** Optional gamepad face-button actions (Stop/Dock/Blade). Record area passes none. */
  actions?: ManualDriveActions;
  /** Blade-height column state (only when features.blade). */
  bladeHeight?: number;
  onBladeHeightChange?: (v: number) => void;
  /** Show a "controller connected" chip above the console when a pad is present (default true). */
  showGamepadChip?: boolean;
  className?: string;
}

/** Self-contained drive console: input-mode toggle + Speed + drive input (+ optional blade),
 *  wired to the shared useManualDrive brain. Everything it publishes goes over the same teleop path
 *  the Manual control page uses. */
export function DriveConsole({
  driveEnabled = true,
  defaultSpeed,
  size = 132,
  features,
  actions,
  bladeHeight = 45,
  onBladeHeightChange,
  showGamepadChip = true,
  className,
}: DriveConsoleProps) {
  const showInputMode = features?.inputMode ?? true;
  const showSpeed = features?.speed ?? true;
  const showBlade = features?.blade ?? false;

  const drive = useManualDrive({driveEnabled, defaultSpeed, actions});

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {showGamepadChip && drive.gamepad.connected ? (
        <Chip variant="ok">
          <Gamepad2 size={11} strokeWidth={2.4} />
          {controllerName(drive.gamepad.brand)}
        </Chip>
      ) : null}

      {showInputMode ? (
        <SegmentedToggle
          options={INPUT_MODE_OPTIONS}
          value={drive.inputMode}
          onChange={(v) => drive.setInputMode(v as InputModeType)}
        />
      ) : null}

      <div className="flex items-center justify-center gap-3">
        {showSpeed ? <SegmentedSpeedColumn speed={drive.speed} onStep={drive.stepSpeed} gamepadLabels={drive.gamepadLabels} /> : null}
        <DriveInput
          size={size}
          mode={drive.inputMode}
          disabled={!driveEnabled}
          onDirectionChange={drive.onTouchDirection}
          directionOverride={drive.driveDirection}
          onVectorChange={drive.onTouchVector}
          vectorOverride={drive.driveVector}
        />
        {showBlade ? (
          <BladeColumn height={bladeHeight} onChange={onBladeHeightChange ?? (() => {})} disabled={!driveEnabled} />
        ) : null}
      </div>
    </div>
  );
}
