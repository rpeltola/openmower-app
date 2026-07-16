'use client';

import {Button} from '@/components/v2/ui/Button';
import {CameraSlot} from '@/components/v2/ui/CameraSlot';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {HoldToUnlock} from '@/components/v2/ui/HoldToUnlock';
import {Joystick} from '@/components/v2/ui/Joystick';
import {MiniMap} from '@/components/v2/ui/MiniMap';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Stepper} from '@/components/v2/ui/Stepper';
import {Bluetooth, Home, RotateCcw, Sprout, Square, X} from 'lucide-react';
import {useState} from 'react';

const SPEED_OPTIONS = [
  {value: 'slow', label: 'Slow'},
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
];

// Static mock state — this PoC proves the stack + responsive layering, not live MQTT
// control (component-library.md §7 build order item 1). Canonical mock world values per
// design-language.md: Kotipiha / Etupiha, RTK fixed, battery 71%.
export function ManualControl() {
  const [unlocked, setUnlocked] = useState(false);
  const [speed, setSpeed] = useState('normal');
  const [bladeHeight, setBladeHeight] = useState(45);
  const [bladeOn, setBladeOn] = useState(false);
  const [hasError] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col md:h-dvh">
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
          <MiniMap className="hidden h-[214px] flex-none md:block" headingDeg={-18} />

          {/* Mobile console: chips already in header; slide-to-unlock + speed/joystick/blade
              trio + explain caption + action row, matching the phone concept 1:1. */}
          <div className="flex flex-col gap-3 md:hidden">
            <HoldToUnlock unlocked={unlocked} onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <SegmentedSpeedColumn speed={speed} onChange={setSpeed} />
              <Joystick size={140} disabled={!unlocked} />
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
              onToggleBlade={() => setBladeOn((v) => !v)}
              className="mt-1 justify-around"
            />
          </div>

          {/* Desktop console: one card holding press-and-hold unlock, joystick + blade
              stepper, the Speed segmented control, and the action row — matches the
              cockpit concept 1:1. */}
          <Card className="hidden flex-1 flex-col justify-center gap-4 p-4 md:flex">
            <HoldToUnlock unlocked={unlocked} onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />

            <div className="flex items-center justify-center gap-6">
              <Joystick size={144} disabled={!unlocked} />
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
              onToggleBlade={() => setBladeOn((v) => !v)}
              className="justify-center gap-4"
            />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function SegmentedSpeedColumn({speed, onChange}: {speed: string; onChange: (v: string) => void}) {
  const idx = SPEED_OPTIONS.findIndex((o) => o.value === speed);
  const step = (dir: 1 | -1) => {
    const next = SPEED_OPTIONS[Math.min(SPEED_OPTIONS.length - 1, Math.max(0, idx + dir))];
    onChange(next.value);
  };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[.6rem] font-semibold uppercase tracking-wide text-ink-faint">Speed</span>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Slower"
        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-2 text-base leading-none text-ink-soft"
      >
        −
      </button>
      <span className="text-sm font-semibold text-accent">{SPEED_OPTIONS[idx].label}</span>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Faster"
        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-2 text-base leading-none text-ink-soft"
      >
        +
      </button>
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.max(20, height - 5))}
        aria-label="Lower blade"
        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-2 text-base leading-none text-ink-soft disabled:opacity-40"
      >
        −
      </button>
      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">
        <Sprout size={11} strokeWidth={2.4} />
        {height} mm
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.min(60, height + 5))}
        aria-label="Raise blade"
        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-2 text-base leading-none text-ink-soft disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function ActionRow({
  hasError,
  bladeOn,
  bladeDisabled,
  onToggleBlade,
  className,
}: {
  hasError: boolean;
  bladeOn: boolean;
  bladeDisabled: boolean;
  onToggleBlade: () => void;
  className?: string;
}) {
  return (
    <div className={`flex ${className ?? ''}`}>
      <ActionItem icon={<Home size={17} strokeWidth={2.2} />} label="Dock" />
      <ActionItem icon={<Square size={15} fill="currentColor" />} label="Stop" variant="danger" />
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
