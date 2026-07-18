'use client';

import {X} from 'lucide-react';
import {useEffect, type CSSProperties} from 'react';

export interface ToastProps {
  /** null/empty hides it. */
  message: string | null;
  onDismiss: () => void;
  /** Auto-dismiss delay, ms. */
  durationMs?: number;
  className?: string;
}

// Countdown-ring geometry -- the `stroke-dashoffset` end value it animates to (see the
// `toast-ring-deplete` keyframe in tailwind.css) is passed through as a CSS var per-instance,
// so it always matches this ring's own circumference regardless of size.
const RING_SIZE = 24;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** A tiny ephemeral message banner — surfaces failure reasons (e.g. a rejected merge/split/
 *  subtract) instead of the silent console.error v1 had. Top-center, below the global
 *  Connection/Paused banners. Auto-dismisses (a ring around the X counts it down); tap the
 *  message or the X to dismiss early. */
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
        'pointer-events-none fixed inset-x-3 top-[calc(.75rem+env(safe-area-inset-top))] z-[950] flex justify-center md:inset-x-auto md:left-1/2 md:right-auto md:w-[360px] md:-translate-x-1/2'
      }
    >
      {/* Keyed on the message text -- when a new message replaces one already showing, this
          remounts the pill (and the ring inside it) instead of reusing it, so the countdown
          ring's CSS animation restarts from full instead of continuing the old one. */}
      <div
        key={message}
        className="pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full bg-ink py-1.5 pl-3.5 pr-1.5 text-[.8rem] font-semibold text-[var(--surface)] shadow-[var(--shadow-m)]"
      >
        <button type="button" onClick={onDismiss} className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left">
          {message}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="relative grid h-6 w-6 flex-none place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--surface)]"
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            aria-hidden
            className="absolute inset-0 -rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeOpacity=".3"
              strokeWidth={RING_STROKE}
            />
            <circle
              className="toast-ring-progress"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              style={
                {
                  animationDuration: `${durationMs}ms`,
                  '--toast-ring-circumference': RING_CIRCUMFERENCE,
                } as CSSProperties
              }
            />
          </svg>
          <X size={12} strokeWidth={2.6} className="relative" />
        </button>
      </div>
    </div>
  );
}
