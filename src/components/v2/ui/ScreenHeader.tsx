import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface ScreenHeaderProps {
  kicker: string;
  title: string;
  actions?: ReactNode;
  className?: string;
}

/** Screen-top header: mono uppercase kicker + title on the left, optional actions on the right. */
export function ScreenHeader({kicker, title, actions, className}: ScreenHeaderProps) {
  return (
    <header className={cn('flex flex-none items-center justify-between', className)}>
      <div>
        <div className="font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">
          {kicker}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink md:text-[1.4rem]">{title}</h1>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
