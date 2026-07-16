'use client';

import {cn} from '@/components/v2/lib/cn';
import {useEffect, useState, type ReactNode} from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Concept `.sheet` + `.grabber` — a dependency-free mobile bottom sheet: dim backdrop,
 *  rounded-top panel sliding up from the bottom, Escape-to-close. */
export function Sheet({open, onClose, title, children, className}: SheetProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      setShown(false);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={onClose}
        style={{background: 'color-mix(in srgb, var(--ink) 22%, transparent)'}}
        className="absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col gap-[.7rem] rounded-t-[22px] bg-surface px-[1.05rem] pb-[1.05rem] pt-[.55rem]',
          'shadow-[0_-8px_30px_rgba(0,0,0,.14)] transition-transform duration-200 motion-reduce:transition-none',
          shown ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        <span aria-hidden className="mx-auto mb-[.3rem] mt-[.1rem] h-[5px] w-[38px] rounded-[3px] bg-border" />
        {title ? <div className="text-[.95rem] font-semibold text-ink">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
