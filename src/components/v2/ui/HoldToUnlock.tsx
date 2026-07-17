'use client';

import {cn} from '@/components/v2/lib/cn';
import {useBreakpoint} from '@/components/v2/lib/useBreakpoint';
import {Lock} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

export interface HoldToUnlockProps {
  unlocked: boolean;
  onUnlock: () => void;
  onLock?: () => void;
  holdMs?: number;
  className?: string;
}

/**
 * The one blade safety-unlock component (design-language.md "One control kit" +
 * "slide-to-unlock before manual drive"): a slide gesture on mobile (thumb-reachable),
 * a deliberate press-and-hold on desktop (no drag surface with a mouse) — same contract,
 * same locked/unlocked state, structural gesture swap via useBreakpoint per
 * component-library.md §5.
 */
export function HoldToUnlock({unlocked, onUnlock, onLock, holdMs = 900, className}: HoldToUnlockProps) {
  const isDesktop = useBreakpoint();

  if (unlocked) {
    return <UnlockedPill onLock={onLock} className={className} />;
  }
  return isDesktop ? (
    <PressHold holdMs={holdMs} onUnlock={onUnlock} className={className} />
  ) : (
    <SlideToUnlock onUnlock={onUnlock} className={className} />
  );
}

function UnlockedPill({onLock, className}: {onLock?: () => void; className?: string}) {
  return (
    <button
      type="button"
      onClick={onLock}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-full border border-accent bg-accent-wash text-sm font-semibold text-accent',
        className,
      )}
    >
      <Lock size={15} strokeWidth={2.2} />
      Blade unlocked — tap to lock
    </button>
  );
}

function PressHold({
  holdMs,
  onUnlock,
  className,
}: {
  holdMs: number;
  onUnlock: () => void;
  className?: string;
}) {
  const [filling, setFilling] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const start = () => {
    setFilling(true);
    clear();
    timerRef.current = window.setTimeout(() => {
      setFilling(false);
      onUnlock();
    }, holdMs);
  };
  const cancel = () => {
    clear();
    setFilling(false);
  };
  useEffect(() => clear, []);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      className={cn(
        'relative h-11 w-full touch-none overflow-hidden rounded-full border border-border bg-surface-2 text-sm font-semibold text-ink-soft',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-accent-wash"
        style={{
          width: filling ? '100%' : '0%',
          transition: `width ${filling ? holdMs : 150}ms linear`,
        }}
      />
      <span className="relative flex items-center justify-center gap-2">
        <Lock size={15} strokeWidth={2.2} />
        Press and hold to unlock blade
      </span>
    </button>
  );
}

function SlideToUnlock({onUnlock, className}: {onUnlock: () => void; className?: string}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const maxPxRef = useRef(0);
  const draggingRef = useRef(false);
  const [translatePx, setTranslatePx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const KNOB = 36;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = trackRef.current?.getBoundingClientRect();
    maxPxRef.current = rect ? rect.width - KNOB - 8 : 0;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 4 - KNOB / 2;
    setTranslatePx(Math.min(maxPxRef.current, Math.max(0, x)));
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const frac = maxPxRef.current > 0 ? translatePx / maxPxRef.current : 0;
    if (frac > 0.85) onUnlock();
    setTranslatePx(0);
  };

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative flex h-11 w-full items-center rounded-full border border-border bg-surface-2 px-1',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink-soft">
        slide to unlock ›››
      </span>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative z-10 grid h-9 w-9 flex-none touch-none place-items-center rounded-full bg-ink text-surface shadow-sm"
        style={{
          transform: `translateX(${translatePx}px)`,
          transition: dragging ? 'none' : 'transform 150ms ease-out',
        }}
      >
        <Lock size={15} strokeWidth={2.2} />
      </div>
    </div>
  );
}
