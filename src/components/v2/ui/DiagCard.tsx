import {Card} from '@/components/v2/ui/Card';
import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface DiagCardProps {
  /** Mono uppercase section label, e.g. "Battery & power". */
  label: string;
  /** Optional element on the same row as the label, right-aligned (e.g. a status Chip). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Concept `.card.hair` diagnostics tile: mono section label + a stack of readouts. */
export function DiagCard({label, action, children, className}: DiagCardProps) {
  return (
    <Card className={cn('p-[.85rem] md:p-4', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-mono text-[.62rem] uppercase tracking-[.08em] text-ink-faint">{label}</div>
        {action}
      </div>
      {children}
    </Card>
  );
}
