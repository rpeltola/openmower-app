import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface OverlayChipProps {
  children: ReactNode;
  className?: string;
}

export function OverlayChip({children, className}: OverlayChipProps) {
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
