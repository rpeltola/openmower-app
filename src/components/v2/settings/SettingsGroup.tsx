import {Card} from '@/components/v2/ui/Card';
import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface SettingsGroupProps {
  /** Optional mono uppercase group label. The concept's grouped lists carry no visible
   *  header (just card boundaries) so this is left off by default — pass it only where a
   *  screen needs one. */
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Concept `.card.hair` grouped-list — a card of `ListRow`s separated by hairline dividers,
 *  used for both the mobile settings sections and the desktop detail-pane cards. */
export function SettingsGroup({title, children, className}: SettingsGroupProps) {
  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      {title ? (
        <div className="border-b border-border px-[.9rem] py-2 font-mono text-[.62rem] uppercase tracking-[.08em] text-ink-faint">
          {title}
        </div>
      ) : null}
      <div className="divide-y divide-border px-[.9rem]">{children}</div>
    </Card>
  );
}
