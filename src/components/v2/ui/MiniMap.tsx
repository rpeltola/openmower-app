import {cn} from '@/components/v2/lib/cn';

export interface MiniMapProps {
  chipLabel?: string;
  /** Mower heading, degrees clockwise from north (map "up"). */
  headingDeg?: number;
  className?: string;
}

/** A minimal live map: the garden outline as ground plane, the mower marker (green,
 *  heading arrow + dashed position-uncertainty ring) and the dock (blue — reserved for
 *  dock/charging/connection, design-language.md §"Colour roles"). Static mock geometry;
 *  the real MapCanvas (MapLibre) pattern lands with the Map screen. */
export function MiniMap({chipLabel = 'Etupiha · position live', headingDeg = 0, className}: MiniMapProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-card)]', className)}>
      <svg viewBox="0 0 408 214" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
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
        <g transform={`translate(212,116) rotate(${headingDeg})`}>
          <circle r="26" fill="var(--accent)" opacity=".12" />
          <circle r="26" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" opacity=".5" />
          <rect x="-13" y="-13" width="26" height="26" rx="8" fill="var(--accent-bright)" />
          <path d="M0 -20 L6 -12 L-6 -12 Z" fill="var(--accent)" />
        </g>
        <g transform="translate(338,128)">
          <rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />
        </g>
      </svg>
      {chipLabel ? (
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur"
          style={{background: 'color-mix(in srgb, var(--surface) 82%, transparent)'}}
        >
          ● {chipLabel}
        </span>
      ) : null}
    </div>
  );
}
