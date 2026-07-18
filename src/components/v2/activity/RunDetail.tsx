import {ReplayCard} from '@/components/v2/activity/ReplayCard';
import {type RunMetric} from '@/components/v2/activity/RunCard';
import {cn} from '@/components/v2/lib/cn';
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
  className?: string;
}

/** Desktop history detail pane (concept "List and detail, side by side"; also the mobile
 *  full-screen drill-in): the run's driven-track replay (`ReplayCard` — animated position
 *  dot, play/pause + scrubber transport) and its KPIs.
 *
 *  R1 gate audit: this used to also render a per-run event feed and an "Export GPX" button --
 *  both removed. The feed had no backend (every caller passed `events={[]}`, so it only ever
 *  rendered "No events recorded"), and GPX export has no mower-side RPC to back it. */
export function RunDetail({jobId, plan, statusLabel, statusVariant, timeRange, metrics, className}: RunDetailProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3.5', className)}>
      <div>
        <div className="text-base font-[660] text-ink">
          {plan} <Chip variant={statusVariant} className="ml-1.5">{statusLabel}</Chip>
        </div>
        <div className="mt-[.15rem] text-[.78rem] text-ink-soft">{timeRange}</div>
      </div>

      <ReplayCard jobId={jobId} />

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <KpiTile key={m.label} value={m.value} unit={m.unit} label={m.label} accent={m.accent} />
        ))}
      </div>
    </div>
  );
}
