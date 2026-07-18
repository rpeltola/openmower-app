'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {StatCard} from '@/components/v2/ui/StatCard';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Toast} from '@/components/v2/ui/Toast';
import {REASON_COPY, REJECT_COPY, type PausedReason, type Tone} from '@/lib/v2/robotState';
import {useCommand, useCommandAvailability} from '@/lib/v2/useCommand';
import {useRobotStateSnapshot} from '@/lib/v2/useRobotStateSnapshot';
import {type Mower, useSelectedMower} from '@/stores/mowersStore';
import {Home as DockIcon, Play, TriangleAlert} from 'lucide-react';
import {useId, useState} from 'react';

const MOW = {area: 'Etupiha', batteryPct: 71};

// Demo reason for the /v2/states dev gallery + as a last-resort default (no mower selected, or
// PAUSED with an empty reasons array).
const DEMO_REASONS: PausedReason[] = ['GPS_LOSS'];

// EMERGENCY/COLLISION -- the "red-blocking" reasons (same danger tone PausedBanner.tsx keys its
// own "Clear & resume" action off of) -- get a Reset emergency action here too, since this is
// the dedicated blocked view, not just its compact banner echo.
const DANGER_REASONS = new Set<PausedReason>(['EMERGENCY', 'COLLISION']);

// StatePill's tone vocabulary is accent/warn/info/neutral only (no danger variant) — danger
// reasons (EMERGENCY/COLLISION) read as their next-most-severe equivalent, same fallback
// Home.tsx uses for ERROR.
const PILL_TONE: Record<Tone, 'accent' | 'warn' | 'info' | 'neutral'> = {
  accent: 'accent',
  warn: 'warn',
  danger: 'warn',
  info: 'info',
  neutral: 'neutral',
};

/** The garden outline + mowed lanes + robot/dock markers, plus a growing dashed uncertainty
 *  ring around the robot — the concept's "blockers as data" beat: RTK lost mid-mow grows the
 *  ring instead of hiding it (openmower-app-concept.html line 1634-1685). Chrome only, no
 *  live map wiring. */
function PausedMapSvg() {
  const clipId = useId();
  return (
    <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <rect width="300" height="300" fill="var(--map)" />
      <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
        <path d="M0 100h300M0 200h300M100 0v300M200 0v300" />
      </g>
      <path d="M40 50 L250 40 L262 150 L232 250 L70 262 L30 150 Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      <clipPath id={clipId}>
        <path d="M40 50 L250 40 L262 150 L232 250 L70 262 L30 150 Z" />
      </clipPath>
      <g clipPath={`url(#${clipId})`} stroke="var(--mowed)" strokeWidth="10" strokeLinecap="round" opacity=".9">
        <path d="M45 150h210M48 168h204M52 186h192M56 204h176M62 222h150M70 240h120" />
      </g>
      {/* growing position-uncertainty ring */}
      <circle cx="150" cy="150" r="46" fill="var(--warn-wash)" opacity=".5" />
      <circle cx="150" cy="150" r="46" fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeDasharray="6 5" opacity=".85" />
      <g transform="translate(150,150)">
        <rect x="-12" y="-12" width="24" height="24" rx="7" fill="var(--accent-bright)" />
        <path d="M0 -18 L5 -11 L-5 -11 Z" fill="var(--accent)" />
      </g>
      <g transform="translate(244,150)">
        <rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />
      </g>
    </svg>
  );
}

/** One stacked banner per active PAUSED reason, most-severe-first (the array already arrives
 *  ordered that way from the gateway, W9 §0.2) — "blockers as data": several reasons can be true
 *  at once (e.g. GPS_LOSS *and* BATTERY_LOW), each gets its own line instead of collapsing to a
 *  single guess. */
function ReasonBanners({reasons, className}: {reasons: PausedReason[]; className?: string}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {reasons.map((reason) => {
        const copy = REASON_COPY[reason];
        return (
          <StatePill
            key={reason}
            tone={PILL_TONE[copy.tone]}
            icon={<TriangleAlert size={16} strokeWidth={2.4} />}
            label={copy.label}
            className="shadow-[var(--shadow-m)]"
          />
        );
      })}
    </div>
  );
}

function BlockerControls({
  primaryReason,
  blocking,
  onReset,
  resetting,
  onDock,
  dockDisabled,
  dockLabel,
  className,
}: {
  primaryReason?: PausedReason;
  blocking: boolean;
  onReset: () => void;
  resetting: boolean;
  onDock: () => void;
  dockDisabled: boolean;
  dockLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-[.55rem]', className)}>
      <p className="m-0 text-[.8rem] leading-[1.45] text-ink-soft">
        The mower stopped itself — it won&rsquo;t drive on a position it can&rsquo;t trust.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled className="flex-1 justify-center">
          <Play size={16} fill="currentColor" />
          Mow
        </Button>
        {primaryReason ? (
          <Chip variant="warn" className="flex-none">
            {REASON_COPY[primaryReason].label}
          </Chip>
        ) : null}
      </div>
      {blocking ? (
        <Button variant="danger-solid" className="justify-center" onClick={onReset} disabled={resetting}>
          <TriangleAlert size={15} strokeWidth={2.2} />
          {resetting ? 'Resetting…' : 'Reset emergency'}
        </Button>
      ) : null}
      <Button variant="ghost" className="justify-center" onClick={onDock} disabled={dockDisabled}>
        <DockIcon size={15} strokeWidth={2.2} />
        {dockLabel}
      </Button>
    </div>
  );
}

export interface PausedBlockerScreenProps {
  /** Overrides the live `paused_reasons` list (W9 §0.2, most-severe-first) -- used by the
   *  /v2/states gallery and tests to render a specific reason combo. Falls back to the real
   *  snapshot, then a static demo reason if neither has data. */
  reasons?: PausedReason[];
}

/** PAUSED / blockers-as-data: RTK lost mid-mow grows the uncertainty ring; Mow stays
 *  disabled with its reason attached, Dock is still one tap away (concept caption, mobile
 *  line 1684). */
export function PausedBlockerScreen({reasons}: PausedBlockerScreenProps) {
  const live = useRobotStateSnapshot().reasons;
  const activeReasons = reasons ?? (live.length > 0 ? live : DEMO_REASONS);
  const primary = activeReasons[0] as PausedReason | undefined;
  const blocking = activeReasons.some((r) => DANGER_REASONS.has(r));

  // Dock goes through the real `cmd/req`→`cmd/res` protocol (useCommand.ts, same client
  // Home.tsx/ManualControl.tsx use) — no fire-and-forget (R2): every press resolves to a known
  // accept/reject, toasted either way.
  const {run, pending} = useCommand();
  const dockAvailability = useCommandAvailability('dock');
  const [toast, setToast] = useState<string | null>(null);
  const handleDock = () => {
    void run('dock').then((result) => {
      setToast(result.accepted ? 'Heading to dock' : (result.reason && REJECT_COPY[result.reason]?.label) || 'Dock rejected');
    });
  };
  const dockDisabled = pending === 'dock' || !dockAvailability.allowed;
  const dockLabel = pending === 'dock' ? 'Docking…' : 'Dock';

  // Reset emergency -- the same legacy fire-and-forget `command:reset_emergency` path
  // ManualControl.tsx's own emergency banner uses (mowersStore.ts's `sendCommand`), not the
  // `cmd/req`→`cmd/res` protocol above: no accept/reject round-trip, it either clears or the
  // cause (e.g. a still-lifted wheel) just re-latches it.
  const mower = useSelectedMower<Mower | undefined>((s) => s);
  const [resetting, setResetting] = useState(false);
  const handleReset = () => {
    mower?.sendCommand('reset_emergency');
    setToast('Emergency reset sent');
    setResetting(true);
    setTimeout(() => setResetting(false), 1500);
  };

  return (
    <div className="flex min-h-full flex-col p-4 md:h-full md:min-h-0 md:p-6">
      <Toast message={toast} onDismiss={() => setToast(null)} />
      {/* ===== Mobile: map fills the screen, controls float as a bottom sheet-style card ===== */}
      <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-[var(--radius-card)] border border-border md:hidden">
        <PausedMapSvg />

        <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap gap-2">
          <OverlayChip>
            <span className="text-warn">●</span> {primary ? REASON_COPY[primary].label : 'Paused'}
          </OverlayChip>
          <OverlayChip>🔋 {MOW.batteryPct}%</OverlayChip>
          <OverlayChip className="ml-auto">{MOW.area}</OverlayChip>
        </div>

        <ReasonBanners reasons={activeReasons} className="absolute inset-x-3 top-[3.1rem] z-10" />

        <StatCard className="absolute inset-x-3 bottom-3 z-10">
          <BlockerControls
            primaryReason={primary}
            blocking={blocking}
            onReset={handleReset}
            resetting={resetting}
            onDock={handleDock}
            dockDisabled={dockDisabled}
            dockLabel={dockLabel}
          />
        </StatCard>
      </div>

      {/* ===== Desktop: map card + a persistent side panel for the blocked controls ===== */}
      <div className="hidden md:grid md:min-h-0 md:flex-1 md:grid-cols-[1fr_320px] md:gap-4">
        <Card className="relative overflow-hidden p-0">
          <PausedMapSvg />
          <ReasonBanners reasons={activeReasons} className="absolute left-3 top-3 z-10 w-fit" />
        </Card>

        <Card className="flex flex-col gap-[.9rem] p-4">
          <BlockerControls
            primaryReason={primary}
            blocking={blocking}
            onReset={handleReset}
            resetting={resetting}
            onDock={handleDock}
            dockDisabled={dockDisabled}
            dockLabel={dockLabel}
          />
        </Card>
      </div>
    </div>
  );
}
