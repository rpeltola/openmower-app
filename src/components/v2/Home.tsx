'use client';

import {NotificationCenter} from '@/components/v2/NotificationCenter';
import {cn} from '@/components/v2/lib/cn';
import {ActivityFeedCard, type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button, buttonVariants} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {MapCard} from '@/components/v2/ui/MapCard';
import {MowingHero, type MowerHeroState} from '@/components/v2/ui/MowingHero';
import {NextScheduledCard} from '@/components/v2/ui/NextScheduledCard';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {PositionTrustCard} from '@/components/v2/ui/PositionTrustCard';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Toast} from '@/components/v2/ui/Toast';
import {Bell, BatteryCharging, CheckCircle2, Gamepad2, Home as HomeIcon, Pause, Sprout, Square} from 'lucide-react';
import Link from 'next/link';
import {type ReactNode, useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, mowing
// Etupiha 62%, 24 min left, battery 71%, RTK fixed. Home is a read/glance screen — this PoC
// wires no MQTT yet (component-library.md §7 build order item 3, live wiring lands later).
const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24, remainingM2: 148, batteryPct: 71};

// Presentation per mock mowerState — mirrors StatePill's tone vocabulary (accent/warn/info)
// and drives the hero overlay/StatePill text so the mobile+desktop hero reads consistently
// with whichever MowingHero scene is showing. Flip DEFAULT_MOWER_STATE below (or tap a quick
// action) to preview mowing/charging/docked/paused/idle.
const HERO_META: Record<
  MowerHeroState,
  {label: string; dotClass: string; icon: ReactNode; tone: 'accent' | 'warn' | 'info' | 'neutral'; sub: string}
> = {
  mowing: {
    label: 'Mowing',
    dotClass: 'text-accent',
    icon: <Sprout size={17} strokeWidth={2.3} />,
    tone: 'accent',
    sub: `${MOW.timeLeftMin} min left · returns to dock after`,
  },
  paused: {
    label: 'Paused',
    dotClass: 'text-warn',
    icon: <Pause size={17} strokeWidth={2.3} fill="currentColor" />,
    tone: 'warn',
    sub: 'Holding position',
  },
  charging: {
    label: 'Charging',
    dotClass: 'text-info',
    icon: <BatteryCharging size={17} strokeWidth={2.3} />,
    tone: 'info',
    sub: `${MOW.batteryPct}% · charging at Kotipiha`,
  },
  docked: {
    label: 'Docked',
    dotClass: 'text-info',
    icon: <HomeIcon size={17} strokeWidth={2.3} />,
    tone: 'info',
    sub: 'Full · ready at Kotipiha',
  },
  idle: {
    label: 'Idle',
    dotClass: 'text-ink-faint',
    icon: <Sprout size={17} strokeWidth={2.3} />,
    tone: 'neutral',
    sub: 'Waiting for next schedule',
  },
};
// "On the lawn" states — mid-job scenes where a coverage % and RTK trust chip make sense.
const ON_LAWN_STATES: MowerHeroState[] = ['mowing', 'paused'];

interface QuickActionDef {
  key: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
}

/** One-tap Home quick action — a Link (Manual control, which navigates) or a Button (everything
 *  else, mocked with a toast). Icon-over-label so a row of these reads as a compact tile strip
 *  on both the mobile row and the desktop dashboard card. */
function QuickActionButton({action}: {action: QuickActionDef}) {
  const content = (
    <>
      {action.icon}
      <span className="text-[.7rem] font-semibold">{action.label}</span>
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
    <Button variant="soft" className={className} onClick={action.onClick}>
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

const DEFAULT_MOWER_STATE: MowerHeroState = 'mowing';

export function Home() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mowerState, setMowerState] = useState<MowerHeroState>(DEFAULT_MOWER_STATE);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const onLawn = ON_LAWN_STATES.includes(mowerState);

  const quickActions: QuickActionDef[] = [
    mowerState === 'mowing'
      ? {
          key: 'pause',
          label: 'Pause',
          icon: <Pause size={18} strokeWidth={2.2} fill="currentColor" />,
          onClick: () => {
            setMowerState('paused');
            setToastMessage('Mowing paused');
          },
        }
      : {
          key: 'mow',
          label: 'Mow now',
          icon: <Sprout size={18} strokeWidth={2.2} />,
          onClick: () => {
            setMowerState('mowing');
            setToastMessage(`Mowing started · ${MOW.area}`);
          },
        },
    {
      key: 'dock',
      label: 'Dock',
      icon: <HomeIcon size={18} strokeWidth={2.2} />,
      onClick: () => {
        setMowerState('charging');
        setToastMessage('Heading to dock');
      },
    },
    {key: 'manual', label: 'Manual control', icon: <Gamepad2 size={18} strokeWidth={2.2} />, href: '/v2/control'},
  ];

  const handleStop = () => {
    setMowerState('idle');
    setToastMessage('Mower stopped');
  };

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
            <Button variant="danger-solid" size="md" className="hidden md:inline-flex" onClick={handleStop}>
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
          state={mowerState}
          progress={onLawn ? MOW.coverage : undefined}
          overlayTop={
            <>
              <OverlayChip>
                <span className={HERO_META[mowerState].dotClass}>●</span> {HERO_META[mowerState].label}
              </OverlayChip>
              <OverlayChip>{MOW.area}</OverlayChip>
              {onLawn ? (
                <OverlayChip className="ml-auto">
                  <b className="font-bold text-accent">{MOW.coverage}%</b>&nbsp;mowed
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

        <Button variant="danger" className="justify-center" onClick={handleStop}>
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
              tone={HERO_META[mowerState].tone}
              icon={HERO_META[mowerState].icon}
              label={onLawn ? `${HERO_META[mowerState].label} ${MOW.area}` : HERO_META[mowerState].label}
              sub={HERO_META[mowerState].sub}
            />
            {onLawn ? <Chip variant="ok">● RTK fixed</Chip> : null}
          </div>
          <MowingHero className="h-[150px]" state={mowerState} />
        </Card>

        <div className="col-start-1 row-start-2 grid content-start grid-cols-4 gap-3">
          <KpiTile value={MOW.timeLeftMin} unit=" min" label="Time left" accent />
          <KpiTile value={MOW.remainingM2} unit=" m²" label="Remaining" />
          <KpiTile value={MOW.batteryPct} unit=" %" label="Battery" />
          <KpiTile value={MOW.coverage} unit=" %" label="Coverage" />

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
