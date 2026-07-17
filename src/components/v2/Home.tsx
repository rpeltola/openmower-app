'use client';

import {mapDataToDock, mapDataToZones} from '@/components/v2/map/realData';
import {NotificationCenter} from '@/components/v2/NotificationCenter';
import {cn} from '@/components/v2/lib/cn';
import {ActivityFeedCard} from '@/components/v2/ui/ActivityFeedCard';
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
import {useSelectedMowerAvailableDates, useSelectedMowerEventsForDate, useSelectedMowerIsDateLoaded} from '@/hooks/useMowerEvents';
import {mowerEventsToActivityEvents} from '@/lib/v2/events';
import {REJECT_COPY, STATE_COPY, type CommandName, type Tone} from '@/lib/v2/robotState';
import {useCommand, useCommandAvailability} from '@/lib/v2/useCommand';
import {useRobotState} from '@/lib/v2/useRobotState';
import {getTodayDateKey} from '@/stores/mowerEvents';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {Bell, Gamepad2, Home as HomeIcon, Sprout, Square} from 'lucide-react';
import Link from 'next/link';
import {type ReactNode, useEffect, useMemo, useState} from 'react';

// "Show the most recent handful, not the whole log" — the desktop dashboard card is a glance
// widget, not the full Activity feed (that's the Activity screen's job).
const RECENT_ACTIVITY_LIMIT = 5;

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

export function Home() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const {state, heroState, isMowing, isPlanning, isCharging, batteryPct, areaName, coveragePct, stateDetail} = useRobotState();
  const {run, pending: pendingCmd} = useCommand();
  const mowAvailability = useCommandAvailability('mow');
  const stopAvailability = useCommandAvailability('stop');
  const dockAvailability = useCommandAvailability('dock');

  const stateCopy = STATE_COPY[state];
  const tone = stateCopy.tone;
  // StatePill's tone vocabulary is accent/warn/info/neutral only (no danger variant) — ERROR
  // reads as its next-most-severe equivalent there.
  const pillTone = tone === 'danger' ? 'warn' : tone;

  const docked = state === 'DOCKED' || state === 'DOCKED_CHARGING';

  // Recent-activity feed (desktop dashboard card): today's events, falling back to the most
  // recent available date when today is empty -- same event log the Activity screen reads, just
  // the last handful. Both today and the fallback are fetched explicitly (see below).
  const mowerId = useSelectedMower((s) => s?.id);
  const today = getTodayDateKey();
  const todayEvents = useSelectedMowerEventsForDate(today);
  const todayLoaded = useSelectedMowerIsDateLoaded(today);
  const availableDates = useSelectedMowerAvailableDates();
  const fallbackDate = todayLoaded && todayEvents.length === 0 ? availableDates[0] : undefined;
  const fallbackEvents = useSelectedMowerEventsForDate(fallbackDate ?? '');
  const fallbackLoaded = useSelectedMowerIsDateLoaded(fallbackDate ?? '');
  const fetchEventsForDate = useMowersStore((s) => s.fetchEventsForDate);

  const [feedAttempted, setFeedAttempted] = useState(false);

  // Fetch today explicitly (it is NOT auto-seeded — the events/json subscription only pushes NEW
  // events, and the historical `events.history` RPC may be absent on an older gateway, in which
  // case fetchEventsForDate swallows the error without marking the date loaded). Track our own
  // "attempted" flag so the feed falls through to its empty state instead of hanging on "Loading".
  useEffect(() => {
    if (!mowerId) return;
    let cancelled = false;
    fetchEventsForDate(mowerId, today).finally(() => {
      if (!cancelled) setFeedAttempted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mowerId, today, fetchEventsForDate]);

  // Fallback date fetch (only reachable once today loaded non-empty, i.e. history IS supported).
  useEffect(() => {
    if (!mowerId || !fallbackDate || fallbackLoaded) return;
    void fetchEventsForDate(mowerId, fallbackDate);
  }, [mowerId, fallbackDate, fallbackLoaded, fetchEventsForDate]);

  const activityLoading = Boolean(mowerId) && !feedAttempted;
  const rawRecentEvents = todayEvents.length > 0 ? todayEvents : fallbackEvents;
  const recentEvents = useMemo(
    () => mowerEventsToActivityEvents(rawRecentEvents).slice(0, RECENT_ACTIVITY_LIMIT),
    [rawRecentEvents],
  );

  // Mini-map tile (desktop dashboard card): real area outlines + dock, fit to the tile, and a
  // robot marker at the real pose -- same composition MowerMap.tsx uses (position/json falling
  // back to the 5 Hz robot_state pose; heading only from robot_state, since position/json's
  // heading freezes during an in-place spin). Hidden while docked, mirroring MapCanvas's
  // `pose === null` convention, since a docked robot's pose is a stale pre-dock reading.
  const mapData = useSelectedMower((s) => s?.map);
  const mapZones = useMemo(() => (mapData ? mapDataToZones(mapData) : null), [mapData]);
  const mapDock = useMemo(() => (mapData ? mapDataToDock(mapData) : undefined), [mapData]);
  const mowerPositionBase = useSelectedMower((s) => s?.position ?? s?.state.pose);
  const liveHeading = useSelectedMower((s) => (s?.state.pose?.heading_valid ? s.state.pose.heading : undefined));
  const mapPose = useMemo(
    () =>
      mowerPositionBase && !docked
        ? {x: mowerPositionBase.x, y: mowerPositionBase.y, heading: liveHeading ?? mowerPositionBase.heading}
        : null,
    [mowerPositionBase, liveHeading, docked],
  );
  const mapChipLabel = isMowing && areaName ? areaName : stateCopy.label;

  /** Issues `cmd` over the real `cmd/req`→`cmd/res` protocol (useCommand.ts) and toasts the
   *  outcome — the accepted message on ack, or the reject_code's copy-table label on nack. No
   *  fire-and-forget (R2): the display still follows whatever `robot_state/json.state` reports
   *  next, but every press now resolves to a known accept/reject instead of a silent publish. */
  const dispatch = async (cmd: CommandName, acceptedMessage: string) => {
    const result = await run(cmd);
    if (result.accepted) {
      setToastMessage(acceptedMessage);
    } else if (result.reason) {
      // Guard the lookup: `reject_code` arrives from the wire cast straight to RejectCode
      // (commandClient.ts) without validating it's one of the 11 known codes, so a newer/typo'd
      // gateway code has no REJECT_COPY row -- fall back to a generic message instead of throwing
      // (mirrors the `?.label` guard the disabled-reason chips below already use).
      setToastMessage(REJECT_COPY[result.reason]?.label ?? 'Command rejected');
    }
  };

  const handleStop = () => void dispatch('stop', 'Mower stopped');

  // The command vocabulary's 'mow' both begins a fresh mow and resumes a mission mower_logic
  // left paused (no separate resume verb wired to this button yet), so the primary action is
  // Stop while mowing and Mow the rest of the time.
  const primaryAction: QuickActionDef = isMowing
    ? {
        key: 'stop',
        label: pendingCmd === 'stop' ? 'Stopping…' : 'Stop',
        icon: <Square size={18} strokeWidth={2.2} fill="currentColor" />,
        onClick: handleStop,
        disabled: emergency || pendingCmd === 'stop' || !stopAvailability.allowed,
        reason: !stopAvailability.allowed ? REJECT_COPY[stopAvailability.reasons[0]]?.label : undefined,
      }
    : {
        key: 'mow',
        label: pendingCmd === 'mow' ? 'Starting…' : 'Mow now',
        icon: <Sprout size={18} strokeWidth={2.2} />,
        onClick: () => void dispatch('mow', areaName ? `Mowing ${areaName}` : 'Mowing started'),
        disabled: emergency || pendingCmd === 'mow' || !mowAvailability.allowed,
        reason: !mowAvailability.allowed ? REJECT_COPY[mowAvailability.reasons[0]]?.label : undefined,
      };

  const quickActions: QuickActionDef[] = [
    primaryAction,
    {
      key: 'dock',
      label: pendingCmd === 'dock' ? 'Docking…' : 'Dock',
      icon: <HomeIcon size={18} strokeWidth={2.2} />,
      onClick: () => void dispatch('dock', 'Heading to dock'),
      disabled: emergency || pendingCmd === 'dock' || !dockAvailability.allowed,
      reason: !dockAvailability.allowed ? REJECT_COPY[dockAvailability.reasons[0]]?.label : undefined,
    },
    {key: 'manual', label: 'Manual control', icon: <Gamepad2 size={18} strokeWidth={2.2} />, href: '/v2/control'},
  ];

  const stopDisabled = emergency || !stopAvailability.allowed || pendingCmd === 'stop';

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
          planning={isPlanning}
          progress={isMowing ? coveragePct : isPlanning ? stateDetail?.progress : undefined}
          overlayTop={
            <>
              <OverlayChip>
                <stateCopy.icon size={13} className={TONE_DOT_CLASS[stateCopy.tone]} /> {stateCopy.label}
              </OverlayChip>
              {isPlanning && stateDetail?.phase ? (
                <OverlayChip>{stateDetail.phase}</OverlayChip>
              ) : areaName ? (
                <OverlayChip>{areaName}</OverlayChip>
              ) : null}
              {isMowing && coveragePct !== undefined ? (
                <OverlayChip className="ml-auto">
                  <b className="font-bold text-accent">{coveragePct}%</b>&nbsp;mowed
                </OverlayChip>
              ) : isPlanning && stateDetail?.progress !== undefined ? (
                <OverlayChip className="ml-auto">
                  <b className="font-bold text-info">{Math.round(stateDetail.progress)}%</b>
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
          ) : isPlanning ? (
            <>
              <KpiTile value={Math.round(stateDetail?.progress ?? 0)} unit=" %" label={stateDetail?.phase ?? 'Planning'} accent />
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
              sub={isPlanning && stateDetail?.phase ? stateDetail.phase : stateCopy.sub}
            />
            {isMowing ? <Chip variant="ok">● RTK fixed</Chip> : null}
          </div>
          <MowingHero className="h-[150px]" state={heroState} planning={isPlanning} />
        </Card>

        <div className="col-start-1 row-start-2 grid content-start grid-cols-4 gap-3">
          {isMowing ? (
            <>
              <KpiTile value="—" unit=" min" label="Time left" accent />
              <KpiTile value="—" unit=" m²" label="Remaining" />
              <KpiTile value={batteryPct} unit=" %" label="Battery" />
              <KpiTile value={coveragePct ?? 0} unit=" %" label="Coverage" />
            </>
          ) : isPlanning ? (
            <>
              <KpiTile
                className="col-span-2"
                value={Math.round(stateDetail?.progress ?? 0)}
                unit=" %"
                label={stateDetail?.phase ?? 'Planning'}
                accent
              />
              <KpiTile className="col-span-2" value={batteryPct} unit=" %" label="Battery" />
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

          <ActivityFeedCard
            events={recentEvents}
            emptyState={activityLoading ? 'Loading activity…' : 'No recent activity'}
            className="col-span-4"
          />
        </div>

        <div className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col gap-4">
          <MapCard className="flex-1" zones={mapZones} dock={mapDock} pose={mapPose} chipLabel={mapChipLabel} />
          <NextScheduledCard when="Wed 10:00 · All areas" detail="~1 h 40 min · rain-skip on" />
        </div>
      </div>

      <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
