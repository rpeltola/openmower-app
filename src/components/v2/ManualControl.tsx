'use client';

import {Button} from '@/components/v2/ui/Button';
import {CameraSlot} from '@/components/v2/ui/CameraSlot';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {GamepadTip} from '@/components/v2/ui/GamepadTip';
import {HoldToUnlock} from '@/components/v2/ui/HoldToUnlock';
import {Direction, Joystick} from '@/components/v2/ui/Joystick';
import {MiniMap} from '@/components/v2/ui/MiniMap';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Stepper} from '@/components/v2/ui/Stepper';
import {Toast} from '@/components/v2/ui/Toast';
import {useGamepad} from '@/lib/v2/useGamepad';
import {Bluetooth, Gamepad2, Home, RotateCcw, Sprout, Square, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

const SPEED_OPTIONS = [
  {value: 'slow', label: 'Slow'},
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
];

// Left-stick analog → the same discrete up/down/left/right vocabulary the touch d-pad
// speaks (Joystick is a clickpad, not analog) — dominant-axis reading, already deadzoned
// by useGamepad.
function axesToDirection(lx: number, ly: number): Direction | null {
  if (lx === 0 && ly === 0) return null;
  return Math.abs(ly) >= Math.abs(lx) ? (ly < 0 ? 'up' : 'down') : lx < 0 ? 'left' : 'right';
}

// Strip the "(STANDARD GAMEPAD Vendor: ... Product: ...)" suffix browsers append to
// `Gamepad.id` — just the human-readable controller name.
function controllerName(id: string | null): string {
  if (!id) return 'Controller';
  return id.split(' (')[0];
}

// Static mock state — this PoC proves the stack + responsive layering, not live MQTT
// control (component-library.md §7 build order item 1). Canonical mock world values per
// design-language.md: Kotipiha / Etupiha, RTK fixed, battery 71%.
export function ManualControl() {
  const [unlocked, setUnlocked] = useState(false);
  const [speed, setSpeed] = useState('normal');
  const [bladeHeight, setBladeHeight] = useState(45);
  const [bladeOn, setBladeOn] = useState(false);
  const [hasError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const gamepad = useGamepad();
  // Touch and gamepad both feed this one piece of state — the shared "drive command" a
  // real MQTT wire-up would consume. Touch takes priority if both happen to be active.
  const [touchDirection, setTouchDirection] = useState<Direction | null>(null);
  const gamepadDirection = unlocked ? axesToDirection(gamepad.axes.lx, gamepad.axes.ly) : null;
  const driveDirection = touchDirection ?? gamepadDirection;

  const stepSpeed = (dir: 1 | -1) => {
    setSpeed((current) => {
      const idx = SPEED_OPTIONS.findIndex((o) => o.value === current);
      return SPEED_OPTIONS[Math.min(SPEED_OPTIONS.length - 1, Math.max(0, idx + dir))].value;
    });
  };

  const handleStop = () => {
    setUnlocked(false);
    setToast('Stopped');
  };

  const handleDock = () => {
    setToast('Docking…');
  };

  const handleToggleBlade = () => setBladeOn((v) => !v);

  // Rising-edge detection so a held gamepad button fires an action once per press, not
  // once per animation frame — mirrors what a click/tap already does for the touch UI.
  const prevButtonsRef = useRef(gamepad.buttons);
  useEffect(() => {
    const prev = prevButtonsRef.current;
    const btn = gamepad.buttons;
    // Buttons → the page's existing actions (see ActionRow): A = Stop, B = Dock,
    // X = toggle blade (only while unlocked, matching the on-screen blade button).
    // Bumpers step the same 3-position Speed control the touch UI uses.
    if (btn.a && !prev.a) handleStop();
    if (btn.b && !prev.b) handleDock();
    if (btn.x && !prev.x && unlocked) handleToggleBlade();
    if (btn.lb && !prev.lb) stepSpeed(-1);
    if (btn.rb && !prev.rb) stepSpeed(1);
    prevButtonsRef.current = btn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamepad.buttons, unlocked]);

  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (gamepad.connected && !prevConnectedRef.current) {
      setToast(`Controller connected: ${controllerName(gamepad.id)}`);
    }
    prevConnectedRef.current = gamepad.connected;
  }, [gamepad.connected, gamepad.id]);

  return (
    <div className="relative mx-auto flex w-full max-w-[1400px] flex-col md:h-dvh">
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <header className="flex flex-none flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6 md:py-4">
        <div className="flex items-center justify-between md:block">
          <div>
            <div className="text-[.68rem] font-semibold uppercase tracking-wide text-ink-faint">
              Kotipiha
            </div>
            <h1 className="text-lg font-bold text-ink md:text-xl">Manual control</h1>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" className="md:hidden">
            <X size={16} strokeWidth={2.4} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <Chip variant="ok">● RTK fixed</Chip>
          <Chip variant="ok" className="md:hidden">
            <Bluetooth size={11} strokeWidth={2.4} />
            Bluetooth
          </Chip>
          <Chip variant="info" className="hidden md:inline-flex">
            Connected
          </Chip>
          {gamepad.connected ? (
            <Chip variant="ok">
              <Gamepad2 size={11} strokeWidth={2.4} />
              {controllerName(gamepad.id)}
            </Chip>
          ) : null}
          <Chip variant="ok">🔋 71%</Chip>
          <Button variant="ghost" size="sm" className="hidden md:inline-flex">
            <X size={14} strokeWidth={2.4} />
            Close
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row md:gap-4 md:overflow-hidden md:p-6">
        {/* ---- Desktop-only: camera grid (reserved for the vision add-on) ---- */}
        <section className="hidden min-w-0 flex-1 flex-col gap-3 md:flex">
          <CameraSlot
            label="Front camera"
            size="lg"
            badge="Vision add-on"
            caption="Reserved — installs with the vision add-on"
            className="flex-1"
          />
          <div className="grid h-32 flex-none grid-cols-3 gap-3">
            <CameraSlot label="Left" size="sm" />
            <CameraSlot label="Rear" size="sm" />
            <CameraSlot label="Right" size="sm" />
          </div>
        </section>

        {/* ---- Cockpit: full-width stack on mobile, fixed-width aside on desktop ---- */}
        <aside className="flex flex-col gap-3 md:w-[408px] md:flex-none">
          <GamepadTip connected={gamepad.connected} />

          <MiniMap className="hidden h-[214px] flex-none md:block" headingDeg={-18} />

          {/* Mobile console: chips already in header; slide-to-unlock + speed/joystick/blade
              trio + explain caption + action row, matching the phone concept 1:1. */}
          <div className="flex flex-col gap-3 md:hidden">
            <HoldToUnlock unlocked={unlocked} onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <SegmentedSpeedColumn speed={speed} onStep={stepSpeed} />
              <Joystick
                size={140}
                disabled={!unlocked}
                onDirectionChange={setTouchDirection}
                activeOverride={driveDirection}
              />
              <BladeColumn height={bladeHeight} onChange={setBladeHeight} disabled={!unlocked} />
            </div>

            {!unlocked ? (
              <p className="text-center text-xs text-ink-faint">
                Blade stays locked until you slide to unlock.
              </p>
            ) : null}

            <ActionRow
              hasError={hasError}
              bladeOn={bladeOn}
              bladeDisabled={!unlocked}
              onToggleBlade={handleToggleBlade}
              onDock={handleDock}
              onStop={handleStop}
              className="mt-1 justify-around"
            />
          </div>

          {/* Desktop console: one card holding press-and-hold unlock, joystick + blade
              stepper, the Speed segmented control, and the action row — matches the
              cockpit concept 1:1. */}
          <Card className="hidden flex-1 flex-col justify-center gap-4 p-4 md:flex">
            <HoldToUnlock unlocked={unlocked} onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />

            <div className="flex items-center justify-center gap-6">
              <Joystick
                size={144}
                disabled={!unlocked}
                onDirectionChange={setTouchDirection}
                activeOverride={driveDirection}
              />
              <Stepper
                label="Blade"
                value={bladeHeight}
                unit=" mm"
                min={20}
                max={60}
                step={5}
                disabled={!unlocked}
                onChange={setBladeHeight}
                orientation="column"
              />
            </div>

            <SegmentedToggle label="Speed" options={SPEED_OPTIONS} value={speed} onChange={setSpeed} />

            <ActionRow
              hasError={hasError}
              bladeOn={bladeOn}
              bladeDisabled={!unlocked}
              onToggleBlade={handleToggleBlade}
              onDock={handleDock}
              onStop={handleStop}
              className="justify-center gap-4"
            />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function SegmentedSpeedColumn({speed, onStep}: {speed: string; onStep: (dir: 1 | -1) => void}) {
  const idx = SPEED_OPTIONS.findIndex((o) => o.value === speed);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[.6rem] font-semibold uppercase tracking-wide text-ink-faint">Speed</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onStep(-1)}
        aria-label="Slower"
        className="h-8 w-8 text-base leading-none"
      >
        −
      </Button>
      <span className="text-sm font-semibold text-accent">{SPEED_OPTIONS[idx].label}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onStep(1)}
        aria-label="Faster"
        className="h-8 w-8 text-base leading-none"
      >
        +
      </Button>
    </div>
  );
}

function BladeColumn({
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

function ActionRow({
  hasError,
  bladeOn,
  bladeDisabled,
  onToggleBlade,
  onDock,
  onStop,
  className,
}: {
  hasError: boolean;
  bladeOn: boolean;
  bladeDisabled: boolean;
  onToggleBlade: () => void;
  onDock: () => void;
  onStop: () => void;
  className?: string;
}) {
  return (
    <div className={`flex ${className ?? ''}`}>
      <ActionItem icon={<Home size={17} strokeWidth={2.2} />} label="Dock" onClick={onDock} />
      <ActionItem
        icon={<Square size={15} fill="currentColor" />}
        label="Stop"
        variant="danger"
        onClick={onStop}
      />
      <ActionItem
        icon={<RotateCcw size={17} strokeWidth={2.2} />}
        label={hasError ? 'Clear error' : 'No active error'}
        disabled={!hasError}
      />
      <ActionItem
        icon={<Sprout size={17} strokeWidth={2.2} />}
        label={bladeOn ? 'Blade on' : 'Blade'}
        disabled={bladeDisabled}
        active={bladeOn}
        onClick={onToggleBlade}
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
}: {
  icon: React.ReactNode;
  label: string;
  variant?: 'danger';
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
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
      <span
        className={`text-[.7rem] font-semibold ${
          variant === 'danger' ? 'text-danger' : disabled ? 'text-ink-faint' : 'text-ink-soft'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
