import {cn} from '@/components/v2/lib/cn';
import {cva, type VariantProps} from 'class-variance-authority';
import {type ReactNode} from 'react';

const pillVariants = cva('flex items-center gap-2.5 rounded-2xl border px-3 py-2.5', {
  variants: {
    tone: {
      // accent = running/planning, warn = paused, info = docked/charging — the same state
      // palette as Chip (design-language.md §"Cross-platform contract").
      accent: 'border-accent/20 bg-accent-wash',
      warn: 'border-warn/25 bg-warn-wash',
      info: 'border-info/20 bg-info-wash',
      neutral: 'border-border bg-surface-2',
    },
  },
  defaultVariants: {tone: 'accent'},
});

const iconVariants = cva('grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] text-white', {
  variants: {
    tone: {
      accent: 'bg-accent',
      warn: 'bg-warn',
      info: 'bg-info',
      neutral: 'bg-ink-soft',
    },
  },
  defaultVariants: {tone: 'accent'},
});

export interface StatePillProps extends VariantProps<typeof pillVariants> {
  icon: ReactNode;
  label: string;
  sub?: string;
  className?: string;
  /** Strip the card chrome (background/border/padding) — used where a parent Card
   *  already provides it, e.g. the desktop dashboard's mowing-hero header. */
  bare?: boolean;
}

/** The persistent state + sub-progress + ETA anchor (design-language.md §5 "State pill") —
 *  the spine of the Home hero on both mobile and desktop. */
export function StatePill({icon, label, sub, tone, className, bare}: StatePillProps) {
  return (
    <div className={cn(bare ? 'flex items-center gap-2.5' : pillVariants({tone}), className)}>
      <div className={iconVariants({tone})}>{icon}</div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[.95rem] font-bold tracking-tight text-ink md:text-base">{label}</div>
        {sub ? <div className="truncate text-[.76rem] text-ink-soft md:text-[.8rem]">{sub}</div> : null}
      </div>
    </div>
  );
}
