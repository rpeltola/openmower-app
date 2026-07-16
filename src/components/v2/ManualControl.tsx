'use client';

import {AnalogStick, type StickVector} from '@/components/v2/ui/AnalogStick';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {GamepadTip} from '@/components/v2/ui/GamepadTip';
import {HoldToUnlock} from '@/components/v2/ui/HoldToUnlock';
import {Direction, Joystick} from '@/components/v2/ui/Joystick';
import {MainViewport} from '@/components/v2/ui/MainViewport';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Stepper} from '@/components/v2/ui/Stepper';
import {Toast} from '@/components/v2/ui/Toast';
import {useMediaQuery} from '@/components/v2/lib/useMediaQuery';
import {useCapabilities} from '@/lib/v2/capabilities';
import {gamepadButtonLabels, type GamepadButtonLabels, useGamepad} from '@/lib/v2/useGamepad';
import {Bluetooth, Gamepad2, Home, RotateCcw, Sprout, Square, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

const SPEED_OPTIONS = [
  {value: 'slow', label: 'Slow'},
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
];

type InputMode = 'dpad' | 'joystick';

const INPUT_MODE_OPTIONS = [
  {value: 'dpad', label: 'D-pad'},
  {value: 'joystick', label: 'Joystick'},
];

const INPUT_MODE_STORAGE_KEY = 'v2.control.inputMode';

const ZERO_VECTOR: StickVector = {x: 0, y: 0};

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

  // A phone turned sideways can be WIDER than the `md` breakpoint (e.g. 844px), so the
  // desktop layout can't be gated on width alone — pair orientation with a height cap
  // (phones in landscape are short; laptops/desktops aren't) to catch just that case.
  const isLandscapeCockpit = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const isDesktopWidth = useMediaQuery('(min-width: 768px)');
  const isDesktop = isDesktopWidth && !isLandscapeCockpit;

  const caps = useCapabilities();

  const gamepad = useGamepad();
  // Brand-correct glyphs for the badges on the buttons a gamepad actually maps to — null
  // (no controller) hides every badge.
  const gamepadLabels = gamepad.connected ? gamepadButtonLabels(gamepad.brand) : null;
  // Touch and gamepad both feed this one piece of state — the shared "drive command" a
  // real MQTT wire-up would consume. Touch takes priority if both happen to be active.
  const [touchDirection, setTouchDirection] = useState<Direction | null>(null);
  const gamepadDirection = unlocked ? axesToDirection(gamepad.axes.lx, gamepad.axes.ly) : null;
  const driveDirection = touchDirection ?? gamepadDirection;

  // Analog alternative to the d-pad — same left-stick source, just fed through unrounded.
  const [touchVector, setTouchVector] = useState<StickVector>(ZERO_VECTOR);
  const gamepadVector: StickVector | null = unlocked ? {x: gamepad.axes.lx, y: gamepad.axes.ly} : null;
  const driveVector = touchVector.x !== 0 || touchVector.y !== 0 ? touchVector : gamepadVector;

  const [inputMode, setInputModeState] = useState<InputMode>('dpad');
  useEffect(() => {
    const stored = localStorage.getItem(INPUT_MODE_STORAGE_KEY);
    if (stored === 'dpad' || stored === 'joystick') setInputModeState(stored);
  }, []);
  const setInputMode = (mode: InputMode) => {
    setInputModeState(mode);
    localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode);
  };

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
      // A physical stick is analog — default to the Joystick input mode once per connect.
      // If the user then manually switches back to D-pad, this won't fire again (it's
      // edge-triggered, not enforced) until the pad disconnects and reconnects.
      setInputMode('joystick');
    }
    prevConnectedRef.current = gamepad.connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamepad.connected, gamepad.id]);

  // The portrait console — shared by the mobile-portrait layout (full width) and the
  // landscape-with-camera layout (narrow side column next to the viewport). Blade height
  // is capability-gated: the grid still reserves its column when hidden (`grid-cols-
  // [1fr_auto_1fr]` with an empty 3rd track) so the drive input stays centered either way.
  const portraitConsole = (
    <>
      <HoldToUnlock unlocked={unlocked} onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />

      <SegmentedToggle
        label="Input"
        options={INPUT_MODE_OPTIONS}
        value={inputMode}
        onChange={(v) => setInputMode(v as InputMode)}
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <SegmentedSpeedColumn speed={speed} onStep={stepSpeed} gamepadLabels={gamepadLabels} />
        <DriveInput
          size={140}
          mode={inputMode}
          disabled={!unlocked}
          onDirectionChange={setTouchDirection}
          directionOverride={driveDirection}
          onVectorChange={setTouchVector}
          vectorOverride={driveVector}
        />
        {caps.mowHeightAdjustment ? (
          <BladeColumn height={bladeHeight} onChange={setBladeHeight} disabled={!unlocked} />
        ) : null}
      </div>

      {!unlocked ? (
        <p className="text-center text-xs text-ink-faint">Blade stays locked until you slide to unlock.</p>
      ) : null}

      <ActionRow
        hasError={hasError}
        bladeOn={bladeOn}
        bladeDisabled={!unlocked}
        onToggleBlade={handleToggleBlade}
        onDock={handleDock}
        onStop={handleStop}
        gamepadLabels={gamepadLabels}
        className="mt-1 justify-around"
      />
    </>
  );

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

      {/* Top-level layout is a JS decision (`isDesktop`/`isLandscapeCockpit`), not a raw
          `md:` breakpoint — a phone held sideways is often WIDER than `md` (844px is
          common), so width alone can't tell "desktop" from "phone in landscape". */}
      <main
        className={
          isDesktop
            ? 'flex flex-1 flex-row gap-4 overflow-hidden p-4 md:gap-4 md:p-6'
            : 'flex flex-1 flex-col gap-4 overflow-y-auto p-4'
        }
      >
        {/* The DJI-style viewport (camera FPV main + map PiP, tap to swap) replaces the
            old always-desktop camera-slot grid — capability-gated on `cameras.front`, see
            MainViewport. Desktop always gets a viewport (map-only if no camera); mobile/
            landscape only gain one when there's an actual front camera to drive by. */}
        {isDesktop ? <MainViewport showCamera={caps.cameras.front} headingDeg={-18} className="min-w-0 flex-1" /> : null}

        <aside className={isDesktop ? 'flex w-[408px] flex-none flex-col gap-3' : 'flex flex-1 flex-col gap-3'}>
          {!isLandscapeCockpit ? <GamepadTip connected={gamepad.connected} /> : null}

          {isLandscapeCockpit && caps.cameras.front ? (
            /* Landscape + a front camera to drive by: the viewport takes the width, a
               compact console sits in a narrow column beside it — trimmed down from the
               portrait console (no "Input" caption, a single action row instead of 2x2,
               a smaller drive input) so it actually fits a ~390px-tall viewport without
               scrolling — Stop is a safety action, it shouldn't be a scroll away. */
            <div className="flex flex-1 gap-3 overflow-hidden">
              <MainViewport showCamera headingDeg={-18} className="min-w-0 flex-1" />
              <div className="flex w-[236px] flex-none flex-col items-center gap-1.5 overflow-y-auto">
                <HoldToUnlock
                  unlocked={unlocked}
                  onUnlock={() => setUnlocked(true)}
                  onLock={() => setUnlocked(false)}
                  className="w-full"
                />
                <SegmentedToggle
                  options={INPUT_MODE_OPTIONS}
                  value={inputMode}
                  onChange={(v) => setInputMode(v as InputMode)}
                  className="w-full"
                />
                <div className="flex items-center gap-3">
                  <SegmentedSpeedColumn speed={speed} onStep={stepSpeed} gamepadLabels={gamepadLabels} />
                  <DriveInput
                    size={100}
                    mode={inputMode}
                    disabled={!unlocked}
                    onDirectionChange={setTouchDirection}
                    directionOverride={driveDirection}
                    onVectorChange={setTouchVector}
                    vectorOverride={driveVector}
                  />
                  {caps.mowHeightAdjustment ? (
                    <BladeColumn height={bladeHeight} onChange={setBladeHeight} disabled={!unlocked} />
                  ) : null}
                </div>
                <ActionRow
                  hasError={hasError}
                  bladeOn={bladeOn}
                  bladeDisabled={!unlocked}
                  onToggleBlade={handleToggleBlade}
                  onDock={handleDock}
                  onStop={handleStop}
                  gamepadLabels={gamepadLabels}
                  className="gap-2"
                />
              </div>
            </div>
          ) : isLandscapeCockpit ? (
            /* Landscape, no camera: the same controls as the portrait console, just laid
               out in a row so the width gets used instead of forcing a tall stack into a
               short viewport. */
            <div className="flex flex-1 items-center gap-4 overflow-x-auto px-1">
              <div className="flex flex-none flex-col items-center gap-2">
                <HoldToUnlock
                  unlocked={unlocked}
                  onUnlock={() => setUnlocked(true)}
                  onLock={() => setUnlocked(false)}
                  className="w-[172px]"
                />
                <SegmentedToggle
                  label="Input"
                  options={INPUT_MODE_OPTIONS}
                  value={inputMode}
                  onChange={(v) => setInputMode(v as InputMode)}
                  className="w-[172px]"
                />
              </div>

              <SegmentedSpeedColumn speed={speed} onStep={stepSpeed} gamepadLabels={gamepadLabels} />

              <DriveInput
                size={124}
                mode={inputMode}
                disabled={!unlocked}
                onDirectionChange={setTouchDirection}
                directionOverride={driveDirection}
                onVectorChange={setTouchVector}
                vectorOverride={driveVector}
              />

              {caps.mowHeightAdjustment ? (
                <BladeColumn height={bladeHeight} onChange={setBladeHeight} disabled={!unlocked} />
              ) : null}

              {/* 2x2 wrap, not a 4-tall column — a landscape phone is short, so a single
                  column of 4 action buttons would run off the bottom of the viewport. */}
              <ActionRow
                hasError={hasError}
                bladeOn={bladeOn}
                bladeDisabled={!unlocked}
                onToggleBlade={handleToggleBlade}
                onDock={handleDock}
                onStop={handleStop}
                gamepadLabels={gamepadLabels}
                className="w-[112px] flex-wrap content-start gap-3"
              />
            </div>
          ) : isDesktop ? (
            /* Desktop console: one card holding press-and-hold unlock, joystick + blade
               stepper, the Speed segmented control, and the action row — matches the
               cockpit concept 1:1. */
            <Card className="flex flex-1 flex-col justify-center gap-4 p-4">
              <HoldToUnlock unlocked={unlocked} onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />

              <SegmentedToggle
                label="Input"
                options={INPUT_MODE_OPTIONS}
                value={inputMode}
                onChange={(v) => setInputMode(v as InputMode)}
                className="mx-auto max-w-[220px]"
              />

              <div className="flex items-center justify-center gap-6">
                <DriveInput
                  size={144}
                  mode={inputMode}
                  disabled={!unlocked}
                  onDirectionChange={setTouchDirection}
                  directionOverride={driveDirection}
                  onVectorChange={setTouchVector}
                  vectorOverride={driveVector}
                />
                {caps.mowHeightAdjustment ? (
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
                ) : null}
              </div>

              <div>
                <SegmentedToggle label="Speed" options={SPEED_OPTIONS} value={speed} onChange={setSpeed} />
                {gamepadLabels ? (
                  <div className="mt-1 flex justify-between px-1 text-[.6rem] font-semibold text-ink-faint">
                    <span>{gamepadLabels.lb} slower</span>
                    <span>{gamepadLabels.rb} faster</span>
                  </div>
                ) : null}
              </div>

              <ActionRow
                hasError={hasError}
                bladeOn={bladeOn}
                bladeDisabled={!unlocked}
                onToggleBlade={handleToggleBlade}
                onDock={handleDock}
                onStop={handleStop}
                gamepadLabels={gamepadLabels}
                className="justify-center gap-4"
              />
            </Card>
          ) : (
            /* Mobile portrait: an FPV viewport up top when there's a front camera to drive
               by (an add-on that isn't installed shows nothing here — no camera on mobile
               stays exactly as it was before this capability existed), then the same
               console as every other layout. */
            <div className="flex flex-col gap-3">
              {caps.cameras.front ? (
                <MainViewport showCamera headingDeg={-18} className="aspect-video w-full flex-none" />
              ) : null}
              {portraitConsole}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

// A small brand-glyph pill pinned to the corner of the button it's hinting at — see the
// rising-edge effect above for the actual mapping (A/✕ = Stop, B/○ = Dock, X/□ = Blade,
// LB·RB / L1·R1 = Speed). Only ever rendered while a controller is connected.
function GamepadBadge({label, className}: {label: string; className?: string}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-surface px-1 text-[.6rem] font-bold leading-none text-ink-soft shadow-[var(--shadow-s)] ${className ?? ''}`}
    >
      {label}
    </span>
  );
}

// Swaps between the d-pad clickpad and the analog stick per the "Input" toggle — both
// share the same Speed control and the same gamepad-left-stick source, just read through
// each control's own vocabulary (discrete direction vs. continuous vector).
function DriveInput({
  size,
  mode,
  disabled,
  onDirectionChange,
  directionOverride,
  onVectorChange,
  vectorOverride,
}: {
  size: number;
  mode: InputMode;
  disabled: boolean;
  onDirectionChange: (d: Direction | null) => void;
  directionOverride: Direction | null;
  onVectorChange: (v: StickVector) => void;
  vectorOverride: StickVector | null;
}) {
  return mode === 'dpad' ? (
    <Joystick
      size={size}
      disabled={disabled}
      onDirectionChange={onDirectionChange}
      activeOverride={directionOverride}
    />
  ) : (
    <AnalogStick size={size} disabled={disabled} onChange={onVectorChange} activeOverride={vectorOverride} />
  );
}

function SegmentedSpeedColumn({
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStep(-1)}
          aria-label="Slower"
          className="h-8 w-8 text-base leading-none"
        >
          −
        </Button>
        {gamepadLabels ? <GamepadBadge label={gamepadLabels.lb} className="-right-1 -top-1" /> : null}
      </div>
      <span className="text-sm font-semibold text-accent">{SPEED_OPTIONS[idx].label}</span>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStep(1)}
          aria-label="Faster"
          className="h-8 w-8 text-base leading-none"
        >
          +
        </Button>
        {gamepadLabels ? <GamepadBadge label={gamepadLabels.rb} className="-right-1 -top-1" /> : null}
      </div>
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
  gamepadLabels,
  className,
}: {
  hasError: boolean;
  bladeOn: boolean;
  bladeDisabled: boolean;
  onToggleBlade: () => void;
  onDock: () => void;
  onStop: () => void;
  gamepadLabels: GamepadButtonLabels | null;
  className?: string;
}) {
  return (
    <div className={`flex ${className ?? ''}`}>
      <ActionItem
        icon={<Home size={17} strokeWidth={2.2} />}
        label="Dock"
        onClick={onDock}
        badge={gamepadLabels?.b}
      />
      <ActionItem
        icon={<Square size={15} fill="currentColor" />}
        label="Stop"
        variant="danger"
        onClick={onStop}
        badge={gamepadLabels?.a}
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
        badge={gamepadLabels?.x}
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
}: {
  icon: React.ReactNode;
  label: string;
  variant?: 'danger';
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  badge?: string;
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
