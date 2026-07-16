import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {FeedRow} from '@/components/v2/ui/FeedRow';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {MapCard} from '@/components/v2/ui/MapCard';
import {MowingHero} from '@/components/v2/ui/MowingHero';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Bell, CheckCircle2, Clock, Home as HomeIcon, SatelliteDish, Sprout, Square} from 'lucide-react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, mowing
// Etupiha 62%, 24 min left, battery 71%, RTK fixed. Home is a read/glance screen — this PoC
// wires no MQTT yet (component-library.md §7 build order item 3, live wiring lands later).
const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24, remainingM2: 148, batteryPct: 71};

const RECENT_EVENTS = [
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
    <div className="flex flex-col gap-4 p-4 md:h-full md:gap-5 md:p-6">
      <header className="flex flex-none items-center justify-between">
        <div>
          <div className="font-mono text-[.66rem] font-semibold uppercase tracking-wide text-ink-faint">
            Kotipiha
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink md:text-[1.4rem]">Good morning</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell size={17} strokeWidth={2} />
          </Button>
          <Button variant="danger-solid" size="md" className="hidden md:inline-flex">
            <Square size={14} fill="currentColor" />
            Stop
          </Button>
        </div>
      </header>

      {/* ===== Mobile: single-column glance dashboard ("the answer in one glance") ===== */}
      <div className="flex flex-col gap-3 md:hidden">
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

        <Card className="flex items-center gap-2.5 border-none bg-surface-2 p-3 shadow-none">
          <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-accent-wash text-accent">
            <SatelliteDish size={15} strokeWidth={2.2} />
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[.82rem] font-semibold text-ink">RTK fixed · GPS strong</div>
            <div className="text-[.72rem] text-ink-soft">Position trusted to ±2 cm</div>
          </div>
        </Card>
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

          <Card className="col-span-4 p-4">
            <div className="mb-2.5 font-mono text-[.7rem] font-semibold uppercase tracking-wide text-ink-faint">
              Recent activity
            </div>
            <div className="divide-y divide-border">
              {RECENT_EVENTS.map((event) => (
                <FeedRow key={event.text} icon={event.icon} tone={event.tone} text={event.text} time={event.time} />
              ))}
            </div>
          </Card>
        </div>

        <div className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col gap-4">
          <MapCard className="flex-1" />
          <Card className="p-4">
            <div className="mb-2 font-mono text-[.7rem] font-semibold uppercase tracking-wide text-ink-faint">
              Next scheduled
            </div>
            <div className="flex items-center gap-2.5">
              <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-info-wash text-info">
                <Clock size={17} strokeWidth={2} />
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-[.92rem] font-semibold text-ink">Wed 10:00 · All areas</div>
                <div className="text-[.78rem] text-ink-soft">~1 h 40 min · rain-skip on</div>
              </div>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverlayChip({children, className}: {children: React.ReactNode; className?: string}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[.66rem] font-semibold text-ink backdrop-blur',
        className,
      )}
      style={{background: 'color-mix(in srgb, var(--surface) 82%, transparent)'}}
    >
      {children}
    </span>
  );
}
