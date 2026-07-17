'use client';

import {NotificationCenter} from '@/components/v2/NotificationCenter';
import {cn} from '@/components/v2/lib/cn';
import {ActivityFeedCard, type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button, buttonVariants} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {MapCard} from '@/components/v2/ui/MapCard';
import {MowingHero} from '@/components/v2/ui/MowingHero';
import {NextScheduledCard} from '@/components/v2/ui/NextScheduledCard';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {PositionTrustCard} from '@/components/v2/ui/PositionTrustCard';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Toast} from '@/components/v2/ui/Toast';
import {REJECT_COPY, STATE_COPY, heroSceneForState, isOnLawn, isPlanning, type CommandName, type Tone} from '@/lib/v2/robotState';
import {useCommand, useCommandAvailability} from '@/lib/v2/useCommand';
import {useRobotStateMock} from '@/lib/v2/useRobotStateMock';
import {Bell, CheckCircle2, Gamepad2, Home as HomeIcon, Pause, Play, Sprout, Square} from 'lucide-react';
import Link from 'next/link';
import {type ReactNode, useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, mowing
// Etupiha, 24 min left, battery 71%, RTK fixed. Home is a read/glance screen — this PoC
// wires no MQTT yet (component-library.md §7 build order item 3, live wiring lands later).
// Coverage % now rides the robot-state mock's `stateDetail.progress` instead of a fixed
// constant (see MOW.coverage's one remaining use as a display fallback below).
const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24, remainingM2: 148, batteryPct: 71};

// Tailwind needs literal class names (not `text-${tone}` template strings) to keep them in the
// build — a lookup table instead, same spirit as the old HERO_META's per-state `dotClass`.
const TONE_DOT_CLASS: Record<Tone, string> = {
  accent: 'text-accent',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-ink-faint',
};

interface QuickActionDef {
  key: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Reason chip text — set whenever `disabled` comes from a gated command, never from a
   *  plain busy/pending state, so a disabled control always says why (STATE_COMMAND_MODEL.md
   *  §3 "blockers-as-data"). */
  reason?: string;
}

/** One-tap Home quick action — a Link (Manual control, which navigates) or a Button (everything
 *  else, mocked through the command store). Icon-over-label so a row of these reads as a
 *  compact tile strip on both the mobile row and the desktop dashboard card. A gated action
 *  renders a third, smaller line with its reason instead of just going dead. */
function QuickActionButton({action}: {action: QuickActionDef}) {
  const content = (
    <>
      {action.icon}
      <span className="text-[.7rem] font-semibold">{action.label}</span>
      {action.reason ? <span className="text-[.6rem] leading-tight font-medium text-ink-faint">{action.reason}</span> : null}
    </>
  );
  const className = 'h-auto flex-1 flex-col gap-1.5 py-3';
  if (action.href) {
    return (
      <Link href={action.href} className={cn(buttonVariants({variant: 'soft'}), className)}>
        {content}
      </Link>
    );
  }
  return (
    <Button variant="soft" className={className} onClick={action.onClick} disabled={action.disabled}>
      {content}
    </Button>
  );
}

const RECENT_EVENTS: ActivityEvent[] = [
  {
    icon: <CheckCircle2 size={14} strokeWidth={2.4} />,
    tone: 'accent' as const,
    text: 'RTK fixed — position trusted',
    time: '09:32',
  },
  {
    icon: <Sprout size={14} strokeWidth={2.2} />,
    tone: 'accent' as const,
    text: `Mowing started · ${MOW.area}`,
    time: '09:30',
  },
  {
    icon: <HomeIcon size={13} strokeWidth={2.2} />,
    tone: 'info' as const,
    text: 'Docked · charging complete',
    time: 'Yst 18:10',
  },
];

export function Home() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const snap = useRobotStateMock();
  const {run, pending} = useCommand();

  const state = snap.state;
  const stateCopy = STATE_COPY[state];
  const tone = stateCopy.tone;
  // StatePill's tone vocabulary is accent/warn/info/neutral only (no danger variant) — ERROR
  // reads as its next-most-severe equivalent there.
  const pillTone = tone === 'danger' ? 'warn' : tone;
  const onLawn = isOnLawn(state);
  const planning = isPlanning(state);
  // Coverage % rides the mock progress ticker so it reads correctly through PLANNING_MISSION
  // (0→100 "planned") as well as MOWING (falls back to the mock 62% world default).
  const coverage = snap.stateDetail?.progress ?? MOW.coverage;
  const coverageLabel = planning ? 'planned' : 'mowed';

  // Every command the primary/quick-action buttons can dispatch, gated live off the mock
  // command store (STATE_COMMAND_MODEL.md §3 "blockers-as-data") — a disabled control always
  // carries its `reasons[0]` rather than just going dead.
  const mowAvailability = useCommandAvailability('mow');
  const pauseAvailability = useCommandAvailability('pause');
  const resumeAvailability = useCommandAvailability('resume');
  const dockAvailability = useCommandAvailability('dock');
  const stopAvailability = useCommandAvailability('stop');

  const isMowBusy = pending === 'mow' || state === 'PLANNING_MISSION';
  const isDockBusy = pending === 'dock' || state === 'DOCKING';

  /** Runs `cmd`, then surfaces the accepted toast or (NACK path) the gated reason via the same
   *  Toast — "Can't mow — waiting for GPS fix" instead of a silent no-op (STATE_COMMAND_MODEL.md
   *  §2's ack/nack contract). */
  const runCommand = (cmd: CommandName, verb: string, acceptedMessage: string) => {
    const result = run(cmd);
    if (result.accepted) {
      setToastMessage(acceptedMessage);
    } else {
      setToastMessage(result.reason ? `Can't ${verb} — ${REJECT_COPY[result.reason].label}` : `Can't ${verb} right now`);
    }
  };

  const handleStop = () => runCommand('stop', 'stop', 'Mower stopped');

  const primaryAction: QuickActionDef =
    state === 'MOWING'
      ? {
          key: 'pause',
          label: pending === 'pause' ? 'Pausing…' : 'Pause',
          icon: <Pause size={18} strokeWidth={2.2} fill="currentColor" />,
          onClick: () => runCommand('pause', 'pause', 'Mowing paused'),
          disabled: pending === 'pause' || !pauseAvailability.allowed,
          reason: !pauseAvailability.allowed ? REJECT_COPY[pauseAvailability.reasons[0]].label : undefined,
        }
      : state === 'PAUSED'
        ? {
            key: 'resume',
            label: pending === 'resume' ? 'Resuming…' : 'Resume',
            icon: <Play size={18} strokeWidth={2.2} fill="currentColor" />,
            onClick: () => runCommand('resume', 'resume', 'Mowing resumed'),
            disabled: pending === 'resume' || !resumeAvailability.allowed,
            reason: !resumeAvailability.allowed ? REJECT_COPY[resumeAvailability.reasons[0]].label : undefined,
          }
        : {
            key: 'mow',
            label: isMowBusy ? 'Planning…' : 'Mow now',
            icon: <Sprout size={18} strokeWidth={2.2} />,
            onClick: () => runCommand('mow', 'mow', `Planning route · ${MOW.area}`),
            disabled: isMowBusy || !mowAvailability.allowed,
            reason: !isMowBusy && !mowAvailability.allowed ? REJECT_COPY[mowAvailability.reasons[0]].label : undefined,
          };

  const quickActions: QuickActionDef[] = [
    primaryAction,
    {
      key: 'dock',
      label: isDockBusy ? 'Docking…' : 'Dock',
      icon: <HomeIcon size={18} strokeWidth={2.2} />,
      onClick: () => runCommand('dock', 'dock', 'Heading to dock'),
      disabled: isDockBusy || !dockAvailability.allowed,
      reason: !isDockBusy && !dockAvailability.allowed ? REJECT_COPY[dockAvailability.reasons[0]].label : undefined,
    },
    {key: 'manual', label: 'Manual control', icon: <Gamepad2 size={18} strokeWidth={2.2} />, href: '/v2/control'},
  ];

  const stopDisabled = pending === 'stop' || !stopAvailability.allowed;
  const stopReason = !stopAvailability.allowed ? REJECT_COPY[stopAvailability.reasons[0]].label : undefined;

  return (
    <div className="relative flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Good morning"
        actions={
          <>
            <Link href="/v2/control" aria-label="Manual control" className={buttonVariants({variant: 'soft', size: 'icon'})}>
              <Gamepad2 size={17} strokeWidth={2} />
            </Link>
            <Button variant="soft" size="icon" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}>
              <Bell size={17} strokeWidth={2} />
            </Button>
            <Button
              variant="danger-solid"
              size="md"
              className="hidden md:inline-flex"
              onClick={handleStop}
              disabled={stopDisabled}
              title={stopReason}
            >
              <Square size={14} fill="currentColor" />
              Stop
            </Button>
          </>
        }
      />

      {/* ===== Mobile: single-column glance dashboard ("the answer in one glance") ===== */}
      {/* flex-1 lets the position-trust footer sink to the bottom (concept: primary action up
          in the thumb arc, trust readout anchored above the tab bar). */}
      <div className="flex flex-1 flex-col gap-3 md:hidden">
        <MowingHero
          className="h-[140px]"
          state={heroSceneForState(state)}
          planning={planning}
          progress={onLawn ? coverage : undefined}
          overlayTop={
            <>
              <OverlayChip>
                <stateCopy.icon size={13} className={TONE_DOT_CLASS[stateCopy.tone]} /> {stateCopy.label}
              </OverlayChip>
              <OverlayChip>{MOW.area}</OverlayChip>
              {onLawn ? (
                <OverlayChip className="ml-auto">
                  <b className="font-bold text-accent">{coverage}%</b>&nbsp;{coverageLabel}
                </OverlayChip>
              ) : null}
            </>
          }
        />

        <div className="grid grid-cols-3 gap-2">
          <KpiTile value={MOW.timeLeftMin} unit=" min" label="Time left" accent />
          <KpiTile value={MOW.remainingM2} unit=" m²" label="Remaining" />
          <KpiTile value={MOW.batteryPct} unit=" %" label="Battery" />
        </div>

        <div className="flex gap-2">
          {quickActions.map((action) => (
            <QuickActionButton key={action.key} action={action} />
          ))}
        </div>

        <Button variant="danger" className="justify-center" onClick={handleStop} disabled={stopDisabled}>
          <Square size={15} fill="currentColor" />
          Stop
        </Button>
        {stopReason ? <div className="-mt-2 text-center text-[.72rem] text-ink-faint">{stopReason}</div> : null}

        <PositionTrustCard state="RTK fixed · GPS strong" detail="Position trusted to ±2 cm" className="mt-auto" />
      </div>

      {/* ===== Desktop: multi-pane dashboard ("one screen, the whole state") ===== */}
      <div className="hidden md:grid md:min-h-0 md:flex-1 md:grid-cols-[1.35fr_1fr] md:grid-rows-[auto_1fr] md:gap-4">
        <Card className="col-start-1 row-start-1 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <StatePill
              bare
              tone={pillTone}
              icon={<stateCopy.icon size={17} strokeWidth={2.3} />}
              label={onLawn ? `${stateCopy.label} ${MOW.area}` : stateCopy.label}
              sub={snap.stateDetail?.phase ?? stateCopy.sub}
            />
            {onLawn ? <Chip variant="ok">● RTK fixed</Chip> : null}
          </div>
          <MowingHero className="h-[150px]" state={heroSceneForState(state)} planning={planning} />
        </Card>

        <div className="col-start-1 row-start-2 grid content-start grid-cols-4 gap-3">
          <KpiTile value={MOW.timeLeftMin} unit=" min" label="Time left" accent />
          <KpiTile value={MOW.remainingM2} unit=" m²" label="Remaining" />
          <KpiTile value={MOW.batteryPct} unit=" %" label="Battery" />
          <KpiTile value={coverage} unit=" %" label="Coverage" />

          <Card className="col-span-4 flex gap-2 p-2">
            {quickActions.map((action) => (
              <QuickActionButton key={action.key} action={action} />
            ))}
          </Card>

          <ActivityFeedCard events={RECENT_EVENTS} className="col-span-4" />
        </div>

        <div className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col gap-4">
          <MapCard className="flex-1" />
          <NextScheduledCard when="Wed 10:00 · All areas" detail="~1 h 40 min · rain-skip on" />
        </div>
      </div>

      <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
