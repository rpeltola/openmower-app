import {cn} from '@/components/v2/lib/cn';
import Link from 'next/link';
import {type ReactNode} from 'react';

export interface ListRowProps {
  icon?: ReactNode;
  title: string;
  sub?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  /** Renders the row as a `next/link` instead of a button — for rows that navigate to a
   *  route (e.g. More's Diagnostics/Settings entries) rather than mutating local state. */
  href?: string;
  className?: string;
}

/** Concept `.rowline` — a settings-list row: icon, title/sub text block, trailing control.
 *  Renders as a `Link` when `href` is given, a `<button>` when `onClick` is given, else a
 *  plain `<div>`. */
export function ListRow({icon, title, sub, trailing, onClick, href, className}: ListRowProps) {
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

  const rowClassName = cn('flex w-full items-center gap-[.7rem] border-0 bg-transparent py-2.5 text-left', className);

  if (href) {
    return (
      <Link href={href} className={rowClassName}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        // bg-transparent is required: preflight is omitted, so a bg-less <button> shows the
        // native (light, theme-blind) buttonface. Concept rows are transparent on their card.
        className={rowClassName}
      >
        {content}
      </button>
    );
  }

  return <div className={cn('flex items-center gap-[.7rem] py-2.5', className)}>{content}</div>;
}
