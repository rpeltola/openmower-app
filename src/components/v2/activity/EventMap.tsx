import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {type FeedRowProps} from '@/components/v2/ui/FeedRow';
import {type ReactNode} from 'react';

export interface EventPin {
  id: string;
  /** Percent (0-100) across the mock garden canvas — same frame as `ActivityEvent.location`. */
  x: number;
  /** Percent (0-100) down the mock garden canvas. */
  y: number;
  tone: FeedRowProps['tone'];
  icon: ReactNode;
}

const PIN_TONE: Record<NonNullable<FeedRowProps['tone']>, string> = {
  accent: 'bg-accent text-white',
  info: 'bg-info text-white',
  warn: 'bg-warn text-white',
  danger: 'bg-danger text-white',
  neutral: 'bg-ink-soft text-white',
};

export interface EventMapProps {
  pins: EventPin[];
  selectedId?: string;
  onSelectPin?: (id: string) => void;
  className?: string;
}

/** Roborock-style "where did it happen" overlay — the same static mock garden ground plane
 *  as `MiniMap`, with one pin per event positioned by its {x,y} percent, colored by the
 *  event's tone. Tapping a pin fires `onSelectPin`, same as tapping the list row. */
export function EventMap({pins, selectedId, onSelectPin, className}: EventMapProps) {
  return (
    <div className={cn('relative aspect-[408/214] w-full overflow-hidden rounded-[var(--radius-card)]', className)}>
      <svg viewBox="0 0 408 214" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <rect width="408" height="214" fill="var(--map)" />
        <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
          <path d="M0 71h408M0 142h408M136 0v214M272 0v214" />
        </g>
        <path
          d="M60 38 L348 28 L370 128 L326 190 L82 196 L40 116 Z"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
      </svg>
      {pins.map((pin) => (
        <Button
          key={pin.id}
          type="button"
          variant="soft"
          onClick={() => onSelectPin?.(pin.id)}
          style={{left: `${pin.x}%`, top: `${pin.y}%`}}
          aria-label="View event"
          className={cn(
            'absolute h-7 w-7 -translate-x-1/2 -translate-y-full cursor-pointer rounded-full border-2 border-surface p-0 shadow-md transition-transform hover:scale-110',
            PIN_TONE[pin.tone ?? 'neutral'],
            pin.id === selectedId && 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--map)]',
          )}
        >
          {pin.icon}
        </Button>
      ))}
    </div>
  );
}
