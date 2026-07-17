import {cn} from '@/components/v2/lib/cn';
import {ZONE_STYLE, type Dock, type Zone} from '@/components/v2/map/mockMap';
import {Card} from '@/components/v2/ui/Card';
import {useMemo} from 'react';

export interface MapCardPose {
  x: number;
  y: number;
  /** yaw, radians CCW from +x/east -- lib/v2/geo/projection.ts's Pose convention. */
  heading: number;
}

export interface MapCardProps {
  /** Real area outlines (local metres -- see map/realData.ts's mapDataToZones). Absent/empty
   *  shows a calm "Map loading" placeholder instead of the old mock scene. */
  zones?: Zone[] | null;
  dock?: Dock | null;
  /** Real robot pose in the same local frame. null (explicitly, not just omitted) means "no
   *  live pose to show" -- e.g. docked -- and hides the marker entirely, same convention as
   *  MapCanvas's `pose` prop. */
  pose?: MapCardPose | null;
  /** Real state/area label for the corner chip, e.g. "Docked" or the current area name. */
  chipLabel?: string;
  className?: string;
}

const VIEW_W = 300;
const VIEW_H = 300;
const VIEW_PAD = 22;

interface ScreenPoint {
  x: number;
  y: number;
}

interface FitBounds {
  minX: number;
  maxY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fits the garden's real geometry (area outlines + dock, local metres) into the tile's SVG
 *  viewBox -- same north-up fit-to-bounds approach as activity/ReplayCard.tsx's track fit, just
 *  over polygons instead of a point track. Only depends on the (near-static) map, not the
 *  moving robot pose, so the tile doesn't rescale/pan as the robot drives around. */
function fitBounds(zones: Zone[], dock: Dock | null | undefined): FitBounds {
  const points = zones.flatMap((z) => z.outline);
  if (dock) points.push(dock.position);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const plotW = VIEW_W - VIEW_PAD * 2;
  const plotH = VIEW_H - VIEW_PAD * 2;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min(plotW / spanX, plotH / spanY);
  return {
    minX,
    maxY,
    scale,
    offsetX: VIEW_PAD + (plotW - spanX * scale) / 2,
    offsetY: VIEW_PAD + (plotH - spanY * scale) / 2,
  };
}

function project(p: {x: number; y: number}, b: FitBounds): ScreenPoint {
  return {x: b.offsetX + (p.x - b.minX) * b.scale, y: b.offsetY + (b.maxY - p.y) * b.scale};
}

function polygonPath(outline: {x: number; y: number}[], bounds: FitBounds): string {
  return (
    outline
      .map((p, i) => {
        const s = project(p, bounds);
        return `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

/** projection.ts's yaw (radians CCW from +x/east) -> degrees clockwise from north, the
 *  convention this tile's marker rotation (and the old mock's `headingDeg`) expects. */
function bearingFromHeading(headingRad: number): number {
  const deg = (headingRad * 180) / Math.PI;
  return ((90 - deg) % 360 + 360) % 360;
}

/** A larger live-map card for the desktop dashboard: the real garden's area outlines fit to
 *  the tile, the dock, and a robot marker at the real pose (green -- map markers are always
 *  green, design-language.md §"Colour roles"; dock is blue). Data-wiring pass, read-only --
 *  editing/basemap/driven-track/etc. live in the full MapCanvas (MapLibre-backed) on the Map
 *  screen; this tile is a lightweight SVG fit, not to-scale, no pan/zoom. No real map yet
 *  (zones absent/empty) -> a calm "Map loading" placeholder, never fabricated geometry. */
export function MapCard({zones, dock, pose, chipLabel, className}: MapCardProps) {
  const hasZones = Boolean(zones && zones.length > 0);
  const bounds = useMemo(() => (hasZones ? fitBounds(zones!, dock) : null), [hasZones, zones, dock]);
  const robotScreen = pose && bounds ? project(pose, bounds) : null;
  const headingDeg = pose ? bearingFromHeading(pose.heading) : 0;
  const dockScreen = dock && bounds ? project(dock.position, bounds) : null;

  return (
    <Card className={cn('relative overflow-hidden p-0', className)}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        <rect width={VIEW_W} height={VIEW_H} fill="var(--map)" />
        <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
          <path d="M0 100h300M0 200h300M100 0v300M200 0v300" />
        </g>
        {hasZones && bounds ? (
          <>
            {zones!.map((z) => {
              const style = ZONE_STYLE[z.type];
              return (
                <path
                  key={z.id}
                  d={polygonPath(z.outline, bounds)}
                  fill={style.fill}
                  fillOpacity={z.type === 'obstacle' ? 0.28 : 0.14}
                  stroke={style.stroke}
                  strokeWidth="2"
                />
              );
            })}
            {dockScreen ? (
              <g transform={`translate(${dockScreen.x},${dockScreen.y})`}>
                <rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />
              </g>
            ) : null}
            {robotScreen ? (
              <g transform={`translate(${robotScreen.x},${robotScreen.y}) rotate(${headingDeg})`}>
                <circle r="22" fill="var(--accent)" opacity=".12" />
                <rect x="-12" y="-12" width="24" height="24" rx="7" fill="var(--accent-bright)" />
                <path d="M0 -18 L5 -11 L-5 -11 Z" fill="var(--accent)" />
              </g>
            ) : null}
          </>
        ) : null}
      </svg>
      {chipLabel ? (
        <span
          className="absolute left-3 top-3 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink backdrop-blur"
          style={{background: 'color-mix(in srgb, var(--surface) 82%, transparent)'}}
        >
          {chipLabel}
        </span>
      ) : null}
      {!hasZones ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <span className="text-[.78rem] text-ink-faint">Map loading…</span>
        </div>
      ) : null}
    </Card>
  );
}
