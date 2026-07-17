import {cn} from '@/components/v2/lib/cn';
import {Card} from '@/components/v2/ui/Card';
import {useId} from 'react';

export interface MapCardProps {
  chipLabel?: string;
  /** Mower heading, degrees clockwise from north (map "up"). */
  headingDeg?: number;
  className?: string;
}

/** A larger live-map card for the desktop dashboard: garden outline, mowed lanes, the
 *  robot marker (green — map markers are always green, design-language.md §"Colour
 *  roles") and the dock (blue). Bigger sibling of MiniMap; static mock geometry until the
 *  real MapCanvas (MapLibre) pattern lands with the Map screen. */
export function MapCard({chipLabel = 'Etupiha · live', headingDeg = 0, className}: MapCardProps) {
  const clipId = useId();

  return (
    <Card className={cn('relative overflow-hidden p-0', className)}>
      <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <rect width="300" height="300" fill="var(--map)" />
        <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
          <path d="M0 100h300M0 200h300M100 0v300M200 0v300" />
        </g>
        <path
          d="M40 50 L250 40 L262 150 L232 250 L70 262 L30 150 Z"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <clipPath id={clipId}>
          <path d="M40 50 L250 40 L262 150 L232 250 L70 262 L30 150 Z" />
        </clipPath>
        <g clipPath={`url(#${clipId})`} stroke="var(--mowed)" strokeWidth="10" strokeLinecap="round" opacity=".9">
          <path d="M45 150h210M48 168h204M52 186h192M56 204h176M62 222h150M70 240h120" />
        </g>
        <ellipse cx="150" cy="200" rx="24" ry="24" fill="var(--bed)" opacity=".7" />
        <g transform={`translate(150,150) rotate(${headingDeg})`}>
          <circle r="22" fill="var(--accent)" opacity=".12" />
          <rect x="-12" y="-12" width="24" height="24" rx="7" fill="var(--accent-bright)" />
          <path d="M0 -18 L5 -11 L-5 -11 Z" fill="var(--accent)" />
        </g>
        <g transform="translate(244,150)">
          <rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />
        </g>
      </svg>
      {chipLabel ? (
        <span
          className="absolute left-3 top-3 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink backdrop-blur"
          style={{background: 'color-mix(in srgb, var(--surface) 82%, transparent)'}}
        >
          {chipLabel}
        </span>
      ) : null}
    </Card>
  );
}
