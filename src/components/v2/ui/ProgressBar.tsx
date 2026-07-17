import {cn} from '@/components/v2/lib/cn';

export interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  className?: string;
  indicatorClassName?: string;
}

/** The shared coverage/charge bar (design-language.md §5 "Cards & tiles" — no bare
 *  fabricated values; always render the real percent). Used flush under MowingHero,
 *  inline in the sidestate card, and anywhere else a % needs a track. */
export function ProgressBar({value, className, indicatorClassName}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r from-accent to-accent-bright', indicatorClassName)}
        style={{width: `${pct}%`}}
      />
    </div>
  );
}
