import {cn} from '@/components/v2/lib/cn';

export interface WeekBarChartBar {
  label: string;
  /** Bar height in px (concept hardcodes exact per-day pixel heights, not a computed scale). */
  heightPx: number;
  /** No mowing that day — renders as a thin border-colored tick instead of an accent bar. */
  rest?: boolean;
  /** Today / the standout day — full-opacity bar with an accent outline and a bold label. */
  highlight?: boolean;
}

export interface WeekBarChartProps {
  bars: WeekBarChartBar[];
  /** Height of the bar-plotting area in px (concept: 64 mobile "Last 7 days" / ~130 desktop "Last 14 days"). */
  chartHeightPx?: number;
  className?: string;
}

/** The Stats sub-tab's per-day bar chart — plain accent bars against a baseline, mono
 *  day-letter labels, today picked out with an outline (concept `.metricrow`-adjacent
 *  bar-chart card on mobile, the wide "Last 14 days" card on desktop). */
export function WeekBarChart({bars, chartHeightPx = 64, className}: WeekBarChartProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-end gap-1.5 border-b border-border pb-[2px]" style={{height: chartHeightPx}}>
        {bars.map((bar, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-t-[5px] rounded-b-[2px]',
              bar.rest ? 'bg-border' : 'bg-accent',
              !bar.rest && (bar.highlight ? 'outline outline-2 outline-offset-1 outline-accent' : 'opacity-55'),
            )}
            style={{height: bar.rest ? 3 : bar.heightPx}}
          />
        ))}
      </div>
      <div className="mt-[5px] flex gap-1.5">
        {bars.map((bar, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 text-center font-mono text-[.62rem]',
              bar.highlight ? 'font-bold text-accent' : 'text-ink-faint',
            )}
          >
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
}
