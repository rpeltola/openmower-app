'use client';

import {AnalogStick, type StickVector} from '@/components/v2/ui/AnalogStick';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';
import {GamepadTip} from '@/components/v2/ui/GamepadTip';
import {HoldToUnlock} from '@/components/v2/ui/HoldToUnlock';
import {Direction, Joystick} from '@/components/v2/ui/Joystick';
import {MainViewport} from '@/components/v2/ui/MainViewport';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Stepper} from '@/components/v2/ui/Stepper';
import {Toast} from '@/components/v2/ui/Toast';
import {useMediaQuery} from '@/components/v2/lib/useMediaQuery';
import {useTeleop} from '@/hooks/useTeleop';
import {useCapabilities} from '@/lib/v2/capabilities';
import {gamepadButtonLabels, type GamepadButtonLabels, useGamepad} from '@/lib/v2/useGamepad';
import {REJECT_COPY} from '@/lib/v2/robotState';
import {useCommand, useCommandAvailability} from '@/lib/v2/useCommand';
import {useConnectionStatus} from '@/lib/v2/useConnectionStatus';
import {useRobotState} from '@/lib/v2/useRobotState';
import {Gamepad2, Home, RotateCcw, Sprout, Square, X} from 'lucide-react';
import {useRouter} from 'next/navigation';
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

// A SHORT controller label for the chip/toast — the raw `Gamepad.id` (e.g. "Sony Interactive
// Entertainment DualSense Wireless Controller") is far too long and wraps the landscape layout,
// so use the detected brand instead.
function controllerName(brand: string): string {
  if (brand === 'playstation') return 'PlayStation';
  if (brand === 'xbox') return 'Xbox';
  return 'Controller';
}

// Drive-command math (W9 A2b) — publishes over the SAME `teleop{vx,vz}` topic v1's map-screen
// joystick uses (see hooks/useTeleop.ts / components/map/teleop/VirtualJoystick.tsx), just fed by
// this page's own d-pad/analog-stick/gamepad input instead of a drag gesture. `MAX_LINEAR_MPS`/
// `MAX_ANGULAR_RAD_S` match VirtualJoystick's proven real-world caps (0.35 m/s keeps turning
// headroom below the ~0.5 m/s wheel max); the Speed segmented control scales both by the same
// factor (APP-ONLY client-side math — no backend speed concept), capping out at "Fast" = exactly
// VirtualJoystick's cap rather than exceeding it.
const MAX_LINEAR_MPS = 0.35;
const MAX_ANGULAR_RAD_S = 1.6;
const SPEED_FACTOR: Record<string, number> = {slow: 0.4, normal: 0.7, fast: 1};

// Exported for unit testing (ManualControl.test.tsx) — HoldToUnlock's gesture (press-and-hold on
// desktop, slide on mobile) isn't practical to drive headlessly, so the vx/vz math is tested
// directly rather than through the full unlock -> drive UI flow.
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

// Static mock state — this PoC proves the stack + responsive layering, not live MQTT
// control (component-library.md §7 build order item 1). Canonical mock world values per
// design-language.md: Kotipiha / Etupiha, RTK fixed, battery 71%.
export function ManualControl() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [speed, setSpeed] = useState('normal');
  const [bladeHeight, setBladeHeight] = useState(45);
  const [hasError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fullscreen API — reclaims the browser address-bar space in landscape. Toggled from an
  // explicit corner button on the viewport (see MainViewport) rather than an on-load or
  // first-tap trigger — browsers only require a user gesture, they don't require that
  // gesture to be a full-page tap. iOS Safari doesn't support it for non-video content at
  // all, hence the `fullscreenEnabled` feature-detect (SSR-safe: `document` doesn't exist
  // during render on the server, so the button just stays hidden until the client effect
  // below runs).
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    setFullscreenSupported(document.fullscreenEnabled);
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  // Close always lands somewhere real -- drop fullscreen first if it's active, then prefer
  // going back in history (so the user returns to wherever they came from), falling back to
  // the /v2 home when there's no history to unwind (e.g. this page was opened directly).
  const closeManualControl = () => {
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen();
    if (window.history.length > 1) router.back();
    else router.push('/v2');
  };

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

  // Publishes over the real `teleop{vx,vz}` MQTT path (same store/hook v1's map joystick uses —
  // see the module doc above) whenever the unlocked drive input changes. `useTeleop` owns the
  // ~100ms publish interval and zeroing on unmount; this effect just feeds it the right vx/vz for
  // whichever input mode is active.
  const {setVelocity} = useTeleop();
  useEffect(() => {
    if (!unlocked) {
      setVelocity(0, 0);
      return;
    }
    const factor = SPEED_FACTOR[speed] ?? 1;
    const {vx, vz} =
      inputMode === 'dpad' ? directionToVelocity(driveDirection, factor) : vectorToVelocity(driveVector, factor);
    setVelocity(vx, vz);
  }, [unlocked, inputMode, driveDirection, driveVector, speed, setVelocity]);

  // Dock/Stop/manual-mode/blade all go through the real `cmd/req`→`cmd/res` protocol
  // (useCommand.ts, same client Home.tsx uses) -- NOT fire-and-forget: every press resolves to a
  // known accept/reject, toasted either way (W9 A2b; see robotState.ts's REJECT_COPY for the nack
  // copy table).
  const {run, pending: pendingCmd} = useCommand();
  const stopAvailability = useCommandAvailability('stop');
  const dockAvailability = useCommandAvailability('dock');
  const bladeOnAvailability = useCommandAvailability('blade_on');
  const bladeOffAvailability = useCommandAvailability('blade_off');

  // Real battery/connection chips (data-wiring pass) -- same sources Home.tsx/Settings.tsx read,
  // replacing the "71% / Connected" mock header (R1). `mowEnabled` is the blade's REAL state
  // (sensors.mower.mow_enabled) -- the toggle below reflects this, never a local optimistic flag,
  // so it can't show "on" while the mower disagrees.
  const {batteryPct, mowEnabled} = useRobotState();
  const {status: connectionStatus} = useConnectionStatus();
  const connected = connectionStatus === 'connected';

  // Entering this page puts the robot into MANUAL_DRIVE so `/joy_vel` teleop actually reaches the
  // wheels and blade_on/blade_off are accepted (the backend command_gate rejects them in any other
  // state); leaving returns it to IDLE and turns the blade off. Mount/unmount, not the unlock
  // gesture -- HoldToUnlock only gates the drive input UI, it isn't a mode switch.
  useEffect(() => {
    void run('manual_drive').then((result) => {
      if (!result.accepted) {
        setToast((result.reason && REJECT_COPY[result.reason]?.label) || 'Manual mode rejected');
      }
    });
    return () => {
      void run('manual_stop');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = () => {
    setUnlocked(false);
    void run('stop').then((result) => {
      setToast(result.accepted ? 'Stopped' : (result.reason && REJECT_COPY[result.reason]?.label) || 'Stop rejected');
    });
  };

  const handleDock = () => {
    void run('dock').then((result) => {
      setToast(result.accepted ? 'Heading to dock' : (result.reason && REJECT_COPY[result.reason]?.label) || 'Dock rejected');
    });
  };

  const handleToggleBlade = () => {
    const cmd = mowEnabled ? 'blade_off' : 'blade_on';
    void run(cmd).then((result) => {
      setToast(
        result.accepted
          ? cmd === 'blade_on'
            ? 'Blade on'
            : 'Blade off'
          : (result.reason && REJECT_COPY[result.reason]?.label) || 'Blade command rejected',
      );
    });
  };

  const dockDisabled = pendingCmd === 'dock' || !dockAvailability.allowed;
  const stopDisabled = pendingCmd === 'stop' || !stopAvailability.allowed;
  // The command gate (not just the hold-to-unlock lock) can block the blade -- e.g. `manual_drive`
  // hasn't been acked yet. Only surface that as a reason once the user has actually unlocked (the
  // "slide to unlock" caption already explains the locked case).
  const bladeAvailability = mowEnabled ? bladeOffAvailability : bladeOnAvailability;
  const bladeGateBlocked = !bladeAvailability.allowed;
  const bladePendingCmd = pendingCmd === 'blade_on' || pendingCmd === 'blade_off';
  const bladeDisabled = !unlocked || bladeGateBlocked || bladePendingCmd;
  const bladeReason = unlocked && bladeGateBlocked ? REJECT_COPY[bladeAvailability.reasons[0]]?.label : undefined;

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
      setToast(`Controller connected: ${controllerName(gamepad.brand)}`);
      // A physical stick is analog — default to the Joystick input mode once per connect.
      // If the user then manually switches back to D-pad, this won't fire again (it's
      // edge-triggered, not enforced) until the pad disconnects and reconnects.
      setInputMode('joystick');
    }
    prevConnectedRef.current = gamepad.connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamepad.connected, gamepad.brand]);

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
          <FeatureGate feature="cuttingHeight">
            <BladeColumn height={bladeHeight} onChange={setBladeHeight} disabled={!unlocked} />
          </FeatureGate>
        ) : null}
      </div>

      {!unlocked ? (
        <p className="text-center text-xs text-ink-faint">Blade stays locked until you slide to unlock.</p>
      ) : null}

      <ActionRow
        hasError={hasError}
        bladeOn={mowEnabled}
        bladeDisabled={bladeDisabled}
        bladeReason={bladeReason}
        onToggleBlade={handleToggleBlade}
        onDock={handleDock}
        onStop={handleStop}
        dockDisabled={dockDisabled}
        stopDisabled={stopDisabled}
        gamepadLabels={gamepadLabels}
        className="mt-1 justify-around"
      />
    </>
  );

  return (
    <div className="relative mx-auto flex w-full max-w-[1400px] flex-col md:h-dvh">
      <Toast message={toast} onDismiss={() => setToast(null)} />
      {/* Safety UX (W9 manual-blade): the one thing on this page that must be impossible to miss --
          a spinning blade under manual control, driven off the REAL `mow_enabled` sensor, not the
          optimistic toggle state. */}
      {mowEnabled ? (
        <div
          role="alert"
          className="flex flex-none animate-pulse items-center justify-center gap-2 bg-danger px-3 py-2 text-[.8rem] font-bold uppercase tracking-wide text-white"
        >
          <Sprout size={15} strokeWidth={2.6} />
          Blade spinning
        </div>
      ) : null}
      <header className="flex flex-none flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6 md:py-4">
        <div className="flex items-center justify-between md:block">
          <div>
            <div className="text-[.68rem] font-semibold uppercase tracking-wide text-ink-faint">
              Kotipiha
            </div>
            <h1 className="text-lg font-bold text-ink md:text-xl">Manual control</h1>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" className="md:hidden" onClick={closeManualControl}>
            <X size={16} strokeWidth={2.4} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <FeatureGate feature="positionTrust">
            <Chip variant="ok">● RTK fixed</Chip>
          </FeatureGate>
          <Chip variant={connected ? 'info' : 'danger'} className="hidden md:inline-flex">
            {connected ? 'Connected' : 'Disconnected'}
          </Chip>
          {gamepad.connected ? (
            <Chip variant="ok">
              <Gamepad2 size={11} strokeWidth={2.4} />
              {controllerName(gamepad.brand)}
            </Chip>
          ) : null}
          <Chip variant={connected ? 'ok' : 'neutral'}>🔋 {batteryPct}%</Chip>
          <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={closeManualControl}>
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
            : // The landscape cockpit is squeezed into a short (~390px) viewport with no
              // room to spare — the mobile p-4 leaves the camera+console row a few px
              // taller than what's left over, so it gets its own tighter padding here.
              `flex flex-1 flex-col gap-4 overflow-y-auto ${isLandscapeCockpit ? 'p-1' : 'p-4'}`
        }
      >
        {/* The DJI-style viewport (camera FPV main + map PiP, tap to swap) replaces the
            old always-desktop camera-slot grid — capability-gated on `cameras.front`, see
            MainViewport. Desktop always gets a viewport (map-only if no camera); mobile/
            landscape only gain one when there's an actual front camera to drive by. */}
        {isDesktop ? (
          <MainViewport
            showCamera={caps.cameras.front}
            className="min-w-0 flex-1"
            fullscreen={fullscreen}
            onToggleFullscreen={fullscreenSupported ? toggleFullscreen : undefined}
          />
        ) : null}

        <aside className={isDesktop ? 'flex w-[408px] flex-none flex-col gap-3' : 'flex flex-1 flex-col gap-3'}>
          {!isLandscapeCockpit ? <GamepadTip connected={gamepad.connected} /> : null}

          {isLandscapeCockpit && caps.cameras.front ? (
            /* Landscape + a front camera to drive by: the viewport takes the width, a
               compact console sits in a narrow column beside it — trimmed down from the
               portrait console (no "Input" caption, a single action row instead of 2x2,
               a smaller drive input) so it actually fits a ~390px-tall viewport without
               scrolling — Stop is a safety action, it shouldn't be a scroll away. */
            <div className="flex flex-1 gap-3 overflow-hidden">
              <MainViewport
                showCamera
                className="min-w-0 flex-1"
                fullscreen={fullscreen}
                onToggleFullscreen={fullscreenSupported ? toggleFullscreen : undefined}
              />
              <div className="flex w-[236px] flex-none flex-col items-center gap-1 overflow-y-auto">
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
                  bladeOn={mowEnabled}
                  bladeDisabled={bladeDisabled}
                  bladeReason={bladeReason}
                  onToggleBlade={handleToggleBlade}
                  onDock={handleDock}
                  onStop={handleStop}
                  dockDisabled={dockDisabled}
                  stopDisabled={stopDisabled}
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
                bladeOn={mowEnabled}
                bladeDisabled={bladeDisabled}
                bladeReason={bladeReason}
                onToggleBlade={handleToggleBlade}
                onDock={handleDock}
                onStop={handleStop}
                dockDisabled={dockDisabled}
                stopDisabled={stopDisabled}
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
                  <FeatureGate feature="cuttingHeight">
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
                  </FeatureGate>
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
                bladeOn={mowEnabled}
                bladeDisabled={bladeDisabled}
                bladeReason={bladeReason}
                onToggleBlade={handleToggleBlade}
                onDock={handleDock}
                onStop={handleStop}
                dockDisabled={dockDisabled}
                stopDisabled={stopDisabled}
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
                <MainViewport
                  showCamera
                  className="aspect-video w-full flex-none"
                  fullscreen={fullscreen}
                  onToggleFullscreen={fullscreenSupported ? toggleFullscreen : undefined}
                />
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
      <ActionItem
        icon={<Home size={17} strokeWidth={2.2} />}
        label="Dock"
        onClick={onDock}
        disabled={dockDisabled}
        badge={gamepadLabels?.b}
      />
      <ActionItem
        icon={<Square size={15} fill="currentColor" />}
        label="Stop"
        variant="danger"
        onClick={onStop}
        disabled={stopDisabled}
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
      <span
        className={`text-[.7rem] font-semibold ${
          variant === 'danger' ? 'text-danger' : disabled ? 'text-ink-faint' : 'text-ink-soft'
        }`}
      >
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
