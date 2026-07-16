import {cn} from '@/components/v2/lib/cn';
import {cva, type VariantProps} from 'class-variance-authority';
import {type ReactNode} from 'react';

const iconVariants = cva('grid h-[26px] w-[26px] flex-none place-items-center rounded-[8px]', {
  variants: {
    tone: {
      accent: 'bg-accent-wash text-accent',
      info: 'bg-info-wash text-info',
      warn: 'bg-warn-wash text-warn',
      neutral: 'bg-surface-2 text-ink-soft',
    },
  },
  defaultVariants: {tone: 'neutral'},
});

export interface FeedRowProps extends VariantProps<typeof iconVariants> {
  icon: ReactNode;
  text: string;
  time: string;
  className?: string;
}

/** One activity-log line: icon + text + timestamp. Meant to sit inside a
 *  `divide-y divide-border` list (matches the concept's recent-activity feed). */
export function FeedRow({icon, tone, text, time, className}: FeedRowProps) {
  return (
    <div className={cn('flex items-center gap-2.5 py-2', className)}>
      <div className={iconVariants({tone})}>{icon}</div>
      <div className="flex-1 truncate text-[.84rem] font-semibold text-ink">{text}</div>
      <div className="flex-none font-mono text-[.74rem] text-ink-faint">{time}</div>
    </div>
  );
}
