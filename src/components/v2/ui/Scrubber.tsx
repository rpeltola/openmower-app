'use client';

import {cn} from '@/components/v2/lib/cn';
import {type FeedRowProps} from '@/components/v2/ui/FeedRow';

export interface ScrubberMarker {
  /** 0–100 position along the timeline. */
  pct: number;
  tone?: FeedRowProps['tone'];
  /** Hover title, e.g. "Lifted — paused, then reset · 18:04". */
  label: string;
}

export interface ScrubberProps {
  /** 0–100 playhead position. */
  pct: number;
  onScrub: (pct: number) => void;
  markers?: ScrubberMarker[];
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

const MARKER_TONE_FILL: Record<NonNullable<FeedRowProps['tone']>, string> = {
  accent: 'bg-accent',
  info: 'bg-info',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-ink-faint',
};

/** How close the playhead has to be (in pct points) for a marker to read as "current". */
const MARKER_ACTIVE_RADIUS = 1.5;

/** Timeline scrubber for run replay (concept "Watch the run, not just the number") — same
 *  `Slider` convention (a hidden native range input drives real drag/keyboard/a11y over a
 *  styled track), plus fixed event markers that fill in once the playhead passes them and
 *  swell while the playhead sits on top of them. */
export function Scrubber({pct, onScrub, markers = [], disabled, 'aria-label': ariaLabel, className}: ScrubberProps) {
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className={cn('relative flex h-[26px] items-center', className)}>
      <div className="relative h-1.5 flex-1 rounded-full bg-surface-2">
        <i aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{width: `${clamped}%`}} />
        {markers.map((marker, i) => {
          const passed = clamped >= marker.pct;
          const active = Math.abs(clamped - marker.pct) <= MARKER_ACTIVE_RADIUS;
          return (
            <span
              key={i}
              aria-hidden
              title={marker.label}
              className={cn(
                'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface transition-transform',
                passed ? MARKER_TONE_FILL[marker.tone ?? 'neutral'] : 'bg-surface-2',
                active ? 'h-2.5 w-2.5 scale-110' : 'h-1.5 w-1.5',
              )}
              style={{left: `${marker.pct}%`}}
            />
          );
        })}
        <span
          aria-hidden
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-[#fff] shadow-[0_1px_4px_rgba(0,0,0,.25)]"
          style={{left: `${clamped}%`}}
        />
      </div>
      <input
        type="range"
        value={clamped}
        min={0}
        max={100}
        step={0.1}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onScrub(Number(e.target.value))}
        className="absolute inset-x-0 h-[26px] w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}
