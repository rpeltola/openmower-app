import {cn} from '@/components/v2/lib/cn';
import {ActivityFeedCard, type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip, type ChipProps} from '@/components/v2/ui/Chip';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {Play} from 'lucide-react';

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

/** Desktop history detail pane (concept "List and detail, side by side"): a static driven-
 *  track illustration (mock geometry, same convention as `MapCard`/`MiniMap` — the real
 *  MapLibre-backed replay scrubber is a later build, see Activity.tsx), the run's KPIs, and
 *  its event feed. The scrubber is rendered disabled and labeled so it reads as deferred,
 *  not broken. */
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

      <Card className="relative min-h-[160px] flex-1 overflow-hidden p-0">
        <svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <rect width="300" height="220" fill="var(--map)" />
          <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
            <path d="M0 73h300M0 146h300M100 0v220M200 0v220" />
          </g>
          <path
            d="M32 40 L262 32 L276 108 L244 196 L60 208 L24 112 Z"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="2"
          />
          <path
            d="M46 62 C90 48 120 90 84 108 C48 126 66 158 112 150 C158 142 150 96 196 92 C232 89 240 130 216 158 C196 182 160 178 148 190"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".9"
          />
          <circle cx="46" cy="62" r="5" fill="var(--accent)" />
          <g transform="translate(148,190)">
            <rect x="-9" y="-9" width="18" height="18" rx="6" fill="var(--accent-bright)" />
            <path d="M0 -14 L4 -8 L-4 -8 Z" fill="var(--accent)" />
          </g>
        </svg>
        <OverlayChip className="absolute left-3 top-3">Driven track</OverlayChip>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-[.7rem]">
          <Button variant="primary" size="icon" disabled aria-label="Replay (coming soon)" className="h-[34px] w-[34px]">
            <Play size={14} fill="currentColor" />
          </Button>
          <ProgressBar value={0} className="flex-1" />
          <span className="whitespace-nowrap font-mono text-[.78rem] tabular-nums text-ink-soft">
            Replay coming soon
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <KpiTile value={coveragePct} unit=" %" label="Coverage" accent />
        <KpiTile value={areaM2} unit=" m²" label="Area mowed" />
        <KpiTile value={duration} label="Duration" />
      </div>

      <ActivityFeedCard title="Events" events={events} />
    </div>
  );
}
