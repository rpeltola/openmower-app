import {cn} from '@/components/v2/lib/cn';
import {type HTMLAttributes} from 'react';

export function Card({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-border bg-surface shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
