import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface StatCardProps {
  children: ReactNode;
  className?: string;
}

/** Concept `.statcard` — a floating glass card for map overlays. Positioning (absolute/fixed
 *  placement) is left to the consumer via `className`. */
export function StatCard({children, className}: StatCardProps) {
  return (
    <div
      style={{background: 'color-mix(in srgb, var(--surface) 90%, transparent)'}}
      className={cn(
        'rounded-[18px] border border-border px-[.85rem] py-[.8rem] backdrop-blur-[14px] shadow-[var(--shadow-m)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
