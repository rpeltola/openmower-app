import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface ListRowProps {
  icon?: ReactNode;
  title: string;
  sub?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Concept `.rowline` — a settings-list row: icon, title/sub text block, trailing control.
 *  Renders as a `<button>` when `onClick` is given, else a plain `<div>`. */
export function ListRow({icon, title, sub, trailing, onClick, className}: ListRowProps) {
  const content = (
    <>
      {icon ? <span className="flex-none">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[.9rem] font-semibold text-ink">{title}</span>
        {sub ? <span className="block text-[.75rem] text-ink-soft">{sub}</span> : null}
      </span>
      {trailing ? <span className="ml-auto flex-none">{trailing}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        // bg-transparent is required: preflight is omitted, so a bg-less <button> shows the
        // native (light, theme-blind) buttonface. Concept rows are transparent on their card.
        className={cn('flex w-full items-center gap-[.7rem] border-0 bg-transparent py-2.5 text-left', className)}
      >
        {content}
      </button>
    );
  }

  return <div className={cn('flex items-center gap-[.7rem] py-2.5', className)}>{content}</div>;
}
