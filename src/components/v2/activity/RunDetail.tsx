import {ReplayCard} from '@/components/v2/activity/ReplayCard';
import {cn} from '@/components/v2/lib/cn';
import {ActivityFeedCard, type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
import {Chip, type ChipProps} from '@/components/v2/ui/Chip';
import {KpiTile} from '@/components/v2/ui/KpiTile';

export interface RunDetailProps {
  plan: string;
  statusLabel: string;
  statusVariant: ChipProps['variant'];
  /** e.g. "Mon 09:30 – 11:22 · all areas". */
  timeRange: string;
  coveragePct: number;
  areaM2: number | string;
  duration: string;
  events: ActivityEvent[];
  className?: string;
}

/** Desktop history detail pane (concept "List and detail, side by side"; also the mobile
 *  full-screen drill-in): the run's driven-track replay (`ReplayCard` — animated position
 *  dot, pinned event markers, play/pause + scrubber transport), its KPIs, and its event feed. */
export function RunDetail({
  plan,
  statusLabel,
  statusVariant,
  timeRange,
  coveragePct,
  areaM2,
  duration,
  events,
  className,
}: RunDetailProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-[660] text-ink">
            {plan} <Chip variant={statusVariant} className="ml-1.5">{statusLabel}</Chip>
          </div>
          <div className="mt-[.15rem] text-[.78rem] text-ink-soft">{timeRange}</div>
        </div>
        <Button variant="ghost" size="sm">
          Export GPX
        </Button>
      </div>

      <ReplayCard timeRange={timeRange} duration={duration} events={events} />

      <div className="grid grid-cols-3 gap-3">
        <KpiTile value={coveragePct} unit=" %" label="Coverage" accent />
        <KpiTile value={areaM2} unit=" m²" label="Area mowed" />
        <KpiTile value={duration} label="Duration" />
      </div>

      <ActivityFeedCard title="Events" events={events} />
    </div>
  );
}
