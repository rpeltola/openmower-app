import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface StatRowProps {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Desktop concept dense-list rows carry their own `.32rem` vertical padding
   *  (mobile rows instead rely on the parent stack's gap). */
  boxed?: boolean;
  /** Adds the desktop concept's top-border divider between boxed rows (omit on the
   *  first row of a boxed list). */
  divider?: boolean;
  className?: string;
}

/** A telemetry readout line: label left, tabular-nums value (+ optional unit) right. */
export function StatRow({label, value, unit, boxed, divider, className}: StatRowProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2',
        boxed && 'py-[.32rem]',
        divider && 'border-t border-border',
        className,
      )}
    >
      <span className="text-[.72rem] text-ink-soft">{label}</span>
      <span className="tabular-nums text-[.78rem] font-[640] text-ink">
        {value}
        {unit ? <small className="text-[.72rem] font-semibold text-ink-faint"> {unit}</small> : null}
      </span>
    </div>
  );
}
