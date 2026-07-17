'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Sheet} from '@/components/v2/ui/Sheet';
import {hapticTap} from '@/lib/v2/haptics';
import {useCallback, useEffect, useRef, useState} from 'react';

const HOURS = Array.from({length: 24}, (_, i) => i);
const MINUTES = Array.from({length: 12}, (_, i) => i * 5);

/** One wheel row's height and how many rows are visible at once (odd, so a single row sits
 *  dead-center under the selection band) — the geometry the top/bottom padding and the
 *  scroll-index math below are both derived from. */
const ITEM_H = 48;
const VISIBLE_ROWS = 5;
const WHEEL_H = ITEM_H * VISIBLE_ROWS;
/** Top/bottom padding so the first and last item can still scroll to the center row. */
const PAD_Y = (ITEM_H * (VISIBLE_ROWS - 1)) / 2;
/** How long to wait after the last scroll event before treating the wheel as "settled". */
const SETTLE_MS = 120;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseValue(value: string): [number, number] {
  const [h, m] = value.split(':').map(Number);
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

/** Nearest allowed minute step to an arbitrary incoming value (e.g. "07:12" from outside the
 *  picker) — snaps down to the nearest 5-minute mark so the wheel always has a matching row. */
function nearestMinuteStep(m: number): number {
  return Math.min(55, Math.round(m / 5) * 5);
}

interface WheelColumnProps {
  values: number[];
  selected: number;
  onSettle: (value: number) => void;
  label: string;
}

/** A single scroll-snap wheel — hours or minutes. Native `overflow-y-auto` gives touch
 *  momentum and mouse-wheel scrolling for free; CSS scroll-snap centers whichever row is
 *  nearest, and a debounced scroll handler reads that row back out as the committed value. */
function WheelColumn({values, selected, onSettle, label}: WheelColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Programmatic scrolls (initial mount, tap-to-select) shouldn't be misread as the user
  // scrolling to a different value while they're still animating into place.
  const suppressUntilRef = useRef(0);
  const lastIndexRef = useRef(values.indexOf(selected));

  // Snap to the incoming value with no animation — covers the sheet opening fresh and the
  // external `value` prop changing out from under the picker (not from our own onSettle).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const index = Math.max(0, values.indexOf(selected));
    if (index === lastIndexRef.current && Math.abs(el.scrollTop - index * ITEM_H) < 1) return;
    suppressUntilRef.current = Date.now() + SETTLE_MS + 300;
    el.scrollTop = index * ITEM_H;
    lastIndexRef.current = index;
    // Only re-run for genuinely external changes — `values`/`onSettle` are stable per column.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    suppressUntilRef.current = Date.now() + SETTLE_MS + 300;
    el.scrollTo({top: index * ITEM_H, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto'});
  }, []);

  const handleScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = listRef.current;
      if (!el || Date.now() < suppressUntilRef.current) return;
      const index = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index;
        hapticTap();
        onSettle(values[index]);
      }
    }, SETTLE_MS);
  }, [onSettle, values]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  function selectByTap(index: number) {
    lastIndexRef.current = index;
    scrollToIndex(index, true);
    hapticTap();
    onSettle(values[index]);
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const next = Math.min(values.length - 1, Math.max(0, lastIndexRef.current + (e.key === 'ArrowDown' ? 1 : -1)));
        selectByTap(next);
      }}
      style={{height: WHEEL_H, paddingTop: PAD_Y, paddingBottom: PAD_Y, scrollSnapType: 'y mandatory', scrollbarWidth: 'none'}}
      className="flex-1 overflow-y-auto outline-none [&::-webkit-scrollbar]:hidden"
    >
      {values.map((v, i) => (
        <div
          key={v}
          role="option"
          aria-selected={v === selected}
          onClick={() => selectByTap(i)}
          style={{height: ITEM_H, scrollSnapAlign: 'center'}}
          className={cn(
            'flex cursor-pointer select-none items-center justify-center text-[1.15rem] tabular-nums transition-colors',
            v === selected ? 'font-bold text-ink' : 'font-medium text-ink-faint',
          )}
        >
          {pad2(v)}
        </div>
      ))}
    </div>
  );
}

export interface TimePickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (hhmm: string) => void;
}

/** iOS-style wheel time picker, presented in the shared bottom `Sheet`. Hours (00–23) and
 *  minutes (5-minute steps) scroll independently under a fixed center selection band; the
 *  row centered under that band is always the live value, previewed in the header and
 *  committed on "Done". */
export function TimePicker({open, onClose, title, value, onChange}: TimePickerProps) {
  const [hour, setHour] = useState(() => parseValue(value)[0]);
  const [minute, setMinute] = useState(() => nearestMinuteStep(parseValue(value)[1]));

  // Re-seed from the incoming value each time the sheet opens, so a stale in-progress drag
  // from a previous open doesn't leak into the next one.
  useEffect(() => {
    if (!open) return;
    const [h, m] = parseValue(value);
    setHour(h);
    setMinute(nearestMinuteStep(m));
  }, [open, value]);

  function handleDone() {
    onChange(`${pad2(hour)}:${pad2(minute)}`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} className="gap-[.9rem]">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">{title}</div>
        <div className="tabular-nums text-[1.2rem] font-bold text-ink">
          {pad2(hour)}:{pad2(minute)}
        </div>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 rounded-[12px] border border-accent bg-accent-wash"
          style={{top: PAD_Y, height: ITEM_H}}
        />
        <div className="flex" style={{height: WHEEL_H}}>
          <WheelColumn values={HOURS} selected={hour} onSettle={setHour} label="Hours" />
          <div aria-hidden className="flex w-5 flex-none items-center justify-center text-[1.1rem] font-bold text-ink-faint">
            :
          </div>
          <WheelColumn values={MINUTES} selected={minute} onSettle={setMinute} label="Minutes" />
        </div>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={handleDone}>
        Done
      </Button>
    </Sheet>
  );
}
