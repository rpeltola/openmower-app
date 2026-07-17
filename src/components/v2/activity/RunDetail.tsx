import {ReplayCard} from '@/components/v2/activity/ReplayCard';
import {type RunMetric} from '@/components/v2/activity/RunCard';
import {cn} from '@/components/v2/lib/cn';
import {ActivityFeedCard, type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
import {Chip, type ChipProps} from '@/components/v2/ui/Chip';
import {KpiTile} from '@/components/v2/ui/KpiTile';

export interface RunDetailProps {
  /** The real job_id (see MowJob) -- threaded straight to ReplayCard's telemetry fetch. */
  jobId: string | null;
  plan: string;
  statusLabel: string;
  statusVariant: ChipProps['variant'];
  /** e.g. "Mon 09:30 – 11:22 · all areas". */
  timeRange: string;
  metrics: [RunMetric, RunMetric, RunMetric];
  events: ActivityEvent[];
  className?: string;
}

/** Desktop history detail pane (concept "List and detail, side by side"; also the mobile
 *  full-screen drill-in): the run's driven-track replay (`ReplayCard` — animated position
 *  dot, play/pause + scrubber transport), its KPIs, and its event feed. */
export function RunDetail({
  jobId,
  plan,
  statusLabel,
  statusVariant,
  timeRange,
  metrics,
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

      <ReplayCard jobId={jobId} />

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <KpiTile key={m.label} value={m.value} unit={m.unit} label={m.label} accent={m.accent} />
        ))}
      </div>

      <ActivityFeedCard title="Events" events={events} />
      {events.length === 0 ? <p className="px-1 text-[.76rem] text-ink-faint">No events recorded for this run.</p> : null}
    </div>
  );
}
