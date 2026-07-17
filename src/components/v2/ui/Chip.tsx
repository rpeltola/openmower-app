import {cn} from '@/components/v2/lib/cn';
import {cva, type VariantProps} from 'class-variance-authority';
import {type HTMLAttributes} from 'react';

const chipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums whitespace-nowrap',
  {
    variants: {
      variant: {
        // ok = neutral state confirmation (battery, generic "fine"), never decorative green
        ok: 'bg-accent-wash text-accent-ink',
        warn: 'bg-warn-wash text-warn',
        danger: 'bg-danger-wash text-danger',
        // info/blue reserved for dock, charging and connection state — design-language.md §"Cross-platform contract"
        info: 'bg-info-wash text-info',
        neutral: 'bg-surface-2 text-ink-soft border border-border',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface ChipProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

export function Chip({className, variant, ...props}: ChipProps) {
  return <span className={cn(chipVariants({variant}), className)} {...props} />;
}
