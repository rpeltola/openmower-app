'use client';

import {cn} from '@/components/v2/lib/cn';
import {useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode} from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Matches the CSS `transition-transform duration-200` on the panel below — how long the
 *  open/close settle animation takes, so the unmount timer and the visual transition agree. */
const SETTLE_MS = 200;
/** Drag-down distance, as a fraction of the panel's own height, that dismisses the sheet. */
const DISMISS_DISTANCE_RATIO = 0.25;
/** Downward fling speed (px/ms) that dismisses the sheet even if the distance threshold wasn't hit. */
const DISMISS_VELOCITY = 0.5;
/** Rubber-band damping applied when dragging up past the resting position. */
const RUBBER_BAND_FACTOR = 0.35;
const RUBBER_BAND_MAX = 70;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type DragState = {
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  delta: number;
  height: number;
};

/** Concept `.sheet` + `.grabber` — a dependency-free mobile bottom sheet: dim backdrop,
 *  rounded-top panel sliding up from the bottom, Escape-to-close, and native-feeling
 *  drag-to-dismiss from the grabber/header (pointer + touch): the panel follows the finger
 *  1:1 while dragging, springs back to open below the dismiss threshold, rubber-bands when
 *  dragged up past the top, and dismisses past ~25% of its height or on a downward fling. */
export function Sheet({open, onClose, title, children, className}: SheetProps) {
  const [visible, setVisible] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Mount/entrance + unmount/exit animation, driven by the `open` prop.
  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) {
      setVisible(true);
      setDragOffset(null);
      const raf = requestAnimationFrame(() => setShown(true));
      wasOpenRef.current = true;
      return () => cancelAnimationFrame(raf);
    }
    if (wasOpenRef.current) {
      setShown(false);
      setDragOffset(null);
      const dur = prefersReducedMotion() ? 0 : SETTLE_MS;
      closeTimerRef.current = setTimeout(() => setVisible(false), dur);
    }
    wasOpenRef.current = false;
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const finishDrag = useCallback((dismiss: boolean) => {
    setDragOffset(null);
    if (!dismiss) return;
    setShown(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    const dur = prefersReducedMotion() ? 0 : SETTLE_MS;
    closeTimerRef.current = setTimeout(() => {
      setVisible(false);
      onCloseRef.current();
    }, dur);
  }, []);

  const onDragPointerMove = useCallback((e: PointerEvent) => {
    const state = dragRef.current;
    if (!state) return;
    const rawDelta = e.clientY - state.startY;
    const dt = e.timeStamp - state.lastT;
    if (dt > 0) state.velocity = (e.clientY - state.lastY) / dt;
    state.lastY = e.clientY;
    state.lastT = e.timeStamp;
    state.delta = rawDelta < 0 ? Math.max(rawDelta * RUBBER_BAND_FACTOR, -RUBBER_BAND_MAX) : rawDelta;
    setDragOffset(state.delta);
  }, []);

  const onDragPointerUp = useCallback(() => {
    window.removeEventListener('pointermove', onDragPointerMove);
    window.removeEventListener('pointerup', onDragPointerUp);
    window.removeEventListener('pointercancel', onDragPointerUp);
    const state = dragRef.current;
    dragRef.current = null;
    if (!state) return;
    const dismiss =
      state.delta > 0 && (state.delta > state.height * DISMISS_DISTANCE_RATIO || state.velocity > DISMISS_VELOCITY);
    finishDrag(dismiss);
  }, [finishDrag, onDragPointerMove]);

  const onDragPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragRef.current = {
        startY: e.clientY,
        lastY: e.clientY,
        lastT: e.timeStamp,
        velocity: 0,
        delta: 0,
        height: panelRef.current?.getBoundingClientRect().height ?? 0,
      };
      setDragOffset(0);
      window.addEventListener('pointermove', onDragPointerMove);
      window.addEventListener('pointerup', onDragPointerUp);
      window.addEventListener('pointercancel', onDragPointerUp);
    },
    [onDragPointerMove, onDragPointerUp],
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div
        aria-hidden
        onClick={onClose}
        style={{background: 'color-mix(in srgb, var(--ink) 22%, transparent)'}}
        className="absolute inset-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={dragOffset !== null ? {transform: `translateY(${dragOffset}px)`, transition: 'none'} : undefined}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col gap-[.7rem] overflow-hidden rounded-t-[22px] bg-surface px-[1.05rem] pt-[.55rem]',
          'shadow-[0_-8px_30px_rgba(0,0,0,.14)] transition-transform duration-200 motion-reduce:transition-none',
          shown ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        {/* Fixed frame: grabber + title never scroll, so the drag handle stays put under the finger. */}
        <div className="flex shrink-0 flex-col gap-[.7rem]">
          <span
            aria-hidden
            onPointerDown={onDragPointerDown}
            className="mx-auto mb-[.3rem] mt-[.1rem] h-[5px] w-[38px] shrink-0 touch-none rounded-[3px] bg-border active:cursor-grabbing"
          />
          {title ? (
            <div onPointerDown={onDragPointerDown} className="touch-none select-none text-[.95rem] font-semibold text-ink">
              {title}
            </div>
          ) : null}
        </div>
        {/* Scrollable body: content grows/scrolls in here instead of resizing the sheet. */}
        <div className="flex min-h-0 flex-1 flex-col gap-[.7rem] overflow-y-auto overscroll-contain pb-[1.05rem]">
          {children}
        </div>
      </div>
    </div>
  );
}
