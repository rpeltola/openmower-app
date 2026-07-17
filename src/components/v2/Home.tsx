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
import {STATE_COPY, type Tone} from '@/lib/v2/robotState';
import {useRobotState} from '@/lib/v2/useRobotState';
import {useSelectedMower, type Mower, type MowerCommand} from '@/stores/mowersStore';
import {Bell, CheckCircle2, Gamepad2, Home as HomeIcon, Sprout, Square} from 'lucide-react';
import Link from 'next/link';
import {type ReactNode, useState} from 'react';

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

// Still a static demo feed — the Activity tab/mowerEvents store carries the real event log;
// wiring it into this card is a separate pass from the state-display work done here.
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
    text: 'Mowing started',
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
  const mower = useSelectedMower<Mower | undefined>();
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const {state, heroState, isMowing, isCharging, batteryPct, areaName, coveragePct} = useRobotState();
  const [pendingCmd, setPendingCmd] = useState<MowerCommand | null>(null);

  const stateCopy = STATE_COPY[state];
  const tone = stateCopy.tone;
  // StatePill's tone vocabulary is accent/warn/info/neutral only (no danger variant) — ERROR
  // reads as its next-most-severe equivalent there.
  const pillTone = tone === 'danger' ? 'warn' : tone;

  const docked = state === 'DOCKED' || state === 'DOCKED_CHARGING';
  const busy = state === 'DOCKING' || state === 'UNDOCKING' || state === 'AREA_RECORDING' || state === 'HEADING_CALIBRATION';

  /** Publishes `cmd` on the shared `command` topic (Mower.sendCommand — see MowerControls.tsx)
   *  and shows a brief "sent" toast. There's no ack/nack round trip from the app side (that's
   *  the gateway/mower_logic's job), so this is fire-and-forget: the display keeps following
   *  whatever `robot_state/json` reports next, not a locally-faked transition. */
  const dispatch = (cmd: MowerCommand, acceptedMessage: string) => {
    if (!mower) return;
    mower.sendCommand(cmd);
    setPendingCmd(cmd);
    setToastMessage(acceptedMessage);
    window.setTimeout(() => setPendingCmd((p) => (p === cmd ? null : p)), 280);
  };

  const handleStop = () => dispatch('stop', 'Mower stopped');

  // The real command set has no separate pause/resume verb: 'start' both begins a fresh mow
  // and resumes a mission mower_logic left paused (see MowerControls.tsx's "Continue" comment),
  // so the primary action is Stop while mowing and Mow the rest of the time.
  const primaryAction: QuickActionDef = isMowing
    ? {
        key: 'stop',
        label: pendingCmd === 'stop' ? 'Stopping…' : 'Stop',
        icon: <Square size={18} strokeWidth={2.2} fill="currentColor" />,
        onClick: handleStop,
        disabled: emergency || pendingCmd === 'stop',
      }
    : {
        key: 'mow',
        label: pendingCmd === 'start' ? 'Starting…' : 'Mow now',
        icon: <Sprout size={18} strokeWidth={2.2} />,
        onClick: () => dispatch('start', areaName ? `Mowing ${areaName}` : 'Mowing started'),
        disabled: emergency || busy || pendingCmd === 'start',
      };

  const quickActions: QuickActionDef[] = [
    primaryAction,
    {
      key: 'dock',
      label: pendingCmd === 'dock' ? 'Docking…' : 'Dock',
      icon: <HomeIcon size={18} strokeWidth={2.2} />,
      onClick: () => dispatch('dock', 'Heading to dock'),
      disabled: emergency || docked || state === 'DOCKING' || pendingCmd === 'dock',
    },
    {key: 'manual', label: 'Manual control', icon: <Gamepad2 size={18} strokeWidth={2.2} />, href: '/v2/control'},
  ];

  const stopDisabled = emergency || state === 'IDLE' || pendingCmd === 'stop';

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
          state={heroState}
          progress={isMowing ? coveragePct : undefined}
          overlayTop={
            <>
              <OverlayChip>
                <stateCopy.icon size={13} className={TONE_DOT_CLASS[stateCopy.tone]} /> {stateCopy.label}
              </OverlayChip>
              {areaName ? <OverlayChip>{areaName}</OverlayChip> : null}
              {isMowing && coveragePct !== undefined ? (
                <OverlayChip className="ml-auto">
                  <b className="font-bold text-accent">{coveragePct}%</b>&nbsp;mowed
                </OverlayChip>
              ) : null}
            </>
          }
        />

        {/* Time left / remaining area are mission-planner numbers we don't have yet (no fabricated
            ETA) — while mowing they read as honest placeholders; docked/idle swaps the row for a
            docked-appropriate readout instead of stale mowing numbers. */}
        <div className={cn('grid gap-2', isMowing ? 'grid-cols-3' : 'grid-cols-2')}>
          {isMowing ? (
            <>
              <KpiTile value="—" unit=" min" label="Time left" accent />
              <KpiTile value="—" unit=" m²" label="Remaining" />
              <KpiTile value={batteryPct} unit=" %" label="Battery" />
            </>
          ) : (
            <>
              <KpiTile value={batteryPct} unit=" %" label="Battery" accent />
              <KpiTile value={isCharging ? 'Charging' : stateCopy.label} label="Status" />
            </>
          )}
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
              label={isMowing && areaName ? `${stateCopy.label} ${areaName}` : stateCopy.label}
              sub={stateCopy.sub}
            />
            {isMowing ? <Chip variant="ok">● RTK fixed</Chip> : null}
          </div>
          <MowingHero className="h-[150px]" state={heroState} />
        </Card>

        <div className="col-start-1 row-start-2 grid content-start grid-cols-4 gap-3">
          {isMowing ? (
            <>
              <KpiTile value="—" unit=" min" label="Time left" accent />
              <KpiTile value="—" unit=" m²" label="Remaining" />
              <KpiTile value={batteryPct} unit=" %" label="Battery" />
              <KpiTile value={coveragePct ?? 0} unit=" %" label="Coverage" />
            </>
          ) : (
            <>
              <KpiTile className="col-span-2" value={batteryPct} unit=" %" label="Battery" accent />
              <KpiTile className="col-span-2" value={isCharging ? 'Charging' : stateCopy.label} label="Status" />
            </>
          )}

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
