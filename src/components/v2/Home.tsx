import {ActivityFeedCard, type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
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
import {Bell, CheckCircle2, Home as HomeIcon, Sprout, Square} from 'lucide-react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, mowing
// Etupiha 62%, 24 min left, battery 71%, RTK fixed. Home is a read/glance screen — this PoC
// wires no MQTT yet (component-library.md §7 build order item 3, live wiring lands later).
const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24, remainingM2: 148, batteryPct: 71};

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
  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Good morning"
        actions={
          <>
            <Button variant="soft" size="icon" aria-label="Notifications">
              <Bell size={17} strokeWidth={2} />
            </Button>
            <Button variant="danger-solid" size="md" className="hidden md:inline-flex">
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
          progress={MOW.coverage}
          overlayTop={
            <>
              <OverlayChip>
                <span className="text-accent">●</span> Mowing
              </OverlayChip>
              <OverlayChip>{MOW.area}</OverlayChip>
              <OverlayChip className="ml-auto">
                <b className="font-bold text-accent">{MOW.coverage}%</b>&nbsp;mowed
              </OverlayChip>
            </>
          }
        />

        <div className="grid grid-cols-3 gap-2">
          <KpiTile value={MOW.timeLeftMin} unit=" min" label="Time left" accent />
          <KpiTile value={MOW.remainingM2} unit=" m²" label="Remaining" />
          <KpiTile value={MOW.batteryPct} unit=" %" label="Battery" />
        </div>

        <Button variant="danger" className="justify-center">
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
              icon={<Sprout size={17} strokeWidth={2.3} />}
              label={`Mowing ${MOW.area}`}
              sub={`${MOW.timeLeftMin} min left · returns to dock after`}
            />
            <Chip variant="ok">● RTK fixed</Chip>
          </div>
          <MowingHero className="h-[150px]" />
        </Card>

        <div className="col-start-1 row-start-2 grid content-start grid-cols-4 gap-3">
          <KpiTile value={MOW.timeLeftMin} unit=" min" label="Time left" accent />
          <KpiTile value={MOW.remainingM2} unit=" m²" label="Remaining" />
          <KpiTile value={MOW.batteryPct} unit=" %" label="Battery" />
          <KpiTile value={MOW.coverage} unit=" %" label="Coverage" />

          <ActivityFeedCard events={RECENT_EVENTS} className="col-span-4" />
        </div>

        <div className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col gap-4">
          <MapCard className="flex-1" />
          <NextScheduledCard when="Wed 10:00 · All areas" detail="~1 h 40 min · rain-skip on" />
        </div>
      </div>
    </div>
  );
}
