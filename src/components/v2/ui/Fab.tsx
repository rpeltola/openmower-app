import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface FabProps {
  icon?: ReactNode;
  children?: ReactNode;
  'aria-label': string;
  onClick?: () => void;
  className?: string;
}

/** Concept `.fab` — a floating icon button used for map controls (center, layers, zoom). */
export function Fab({icon, children, 'aria-label': ariaLabel, onClick, className}: FabProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{background: 'color-mix(in srgb, var(--surface) 88%, transparent)'}}
      className={cn(
        'grid h-[38px] w-[38px] place-items-center rounded-[12px] border-0 text-ink backdrop-blur-[8px] shadow-[var(--shadow-s)]',
        className,
      )}
    >
      {icon ?? children}
    </button>
  );
}
