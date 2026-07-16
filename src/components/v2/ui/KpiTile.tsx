import {cn} from '@/components/v2/lib/cn';

export interface KpiTileProps {
  value: number | string;
  unit?: string;
  label: string;
  /** Accent-colored value — reserved for the one "hero" number (e.g. time left). */
  accent?: boolean;
  className?: string;
}

/** A quiet telemetry tile — tabular value + unit + label, no fabricated numbers
 *  (design-language.md §1 "Honest"). Mobile renders the concept's flat `.metric` look;
 *  desktop renders the bordered `.kpi` look — same component, `md:` reflow. */
export function KpiTile({value, unit, label, accent, className}: KpiTileProps) {
  return (
    <div
      className={cn(
        'rounded-[14px] bg-surface-2 px-3 py-2.5',
        'md:rounded-[13px] md:border md:border-border md:bg-surface md:px-4 md:py-3.5',
        className,
      )}
    >
      <div
        className={cn(
          'text-[1.35rem] font-bold leading-none tracking-tight tabular-nums md:text-[1.7rem]',
          accent && 'text-accent',
        )}
      >
        {value}
        {unit ? <span className="text-xs font-semibold text-ink-soft md:text-[.8rem]">{unit}</span> : null}
      </div>
      <div className="mt-[.42rem] font-mono text-[.66rem] font-semibold uppercase tracking-wide text-ink-faint md:mt-2 md:text-[.68rem]">
        {label}
      </div>
    </div>
  );
}
