'use client';

import {useEffect} from 'react';

export interface ToastProps {
  /** null/empty hides it. */
  message: string | null;
  onDismiss: () => void;
  /** Auto-dismiss delay, ms. */
  durationMs?: number;
  className?: string;
}

/** A tiny ephemeral message banner — surfaces failure reasons (e.g. a rejected merge/split/
 *  subtract) instead of the silent console.error v1 had. Auto-dismisses; tap to dismiss early. */
export function Toast({message, onDismiss, durationMs = 3200, className}: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={
        className ??
        'pointer-events-none absolute inset-x-3 bottom-24 z-[950] flex justify-center md:inset-x-auto md:left-3 md:right-auto md:w-[320px]'
      }
    >
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto max-w-full truncate rounded-full border-0 bg-ink px-3.5 py-2 text-[.8rem] font-semibold text-[var(--surface)] shadow-[var(--shadow-m)]"
      >
        {message}
      </button>
    </div>
  );
}
