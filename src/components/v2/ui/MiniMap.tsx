import {cn} from '@/components/v2/lib/cn';
import {boundingBox} from '@/components/v2/map/geometry';
import {isMowableType} from '@/components/v2/map/mockMap';
import {mapDataToDock, mapDataToZones} from '@/components/v2/map/realData';
import {useSelectedMower} from '@/stores/mowersStore';
import type {Meters} from '@/lib/v2/geo/projection';
import {useMemo} from 'react';

export interface MiniMapProps {
  chipLabel?: string;
  className?: string;
}

const VIEW_W = 408;
const VIEW_H = 214;
const VIEW_PAD = 24;
// px/metre used only when the fit bbox is degenerate (a single point, or every point
// collinear on one axis) -- a real bbox always overrides this.
const FALLBACK_SCALE = 20;
const MIN_RING_RADIUS = 12;
const MAX_RING_RADIUS = 70;

interface FitBounds {
  minX: number;
  maxY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fits every point that needs to be visible (zone outlines + dock + live mower position) into
 *  the viewport, north-up. Returns null when there's nothing real to fit yet. */
function fitToViewport(points: Meters[]): FitBounds | null {
  const bbox = boundingBox(points);
  if (!bbox) return null;
  const plotW = VIEW_W - VIEW_PAD * 2;
  const plotH = VIEW_H - VIEW_PAD * 2;
  let scale = Math.min(bbox.width > 0 ? plotW / bbox.width : Infinity, bbox.height > 0 ? plotH / bbox.height : Infinity);
  if (!isFinite(scale) || scale <= 0) scale = FALLBACK_SCALE;
  return {
    minX: bbox.minX,
    maxY: bbox.maxY,
    scale,
    offsetX: VIEW_PAD + (plotW - bbox.width * scale) / 2,
    offsetY: VIEW_PAD + (plotH - bbox.height * scale) / 2,
  };
}

// Local ENU metres -> SVG screen point. Y flips: local +y is north, which must render toward
// the top of the viewBox (smaller screen Y).
function project(p: Meters, b: FitBounds): Meters {
  return {x: b.offsetX + (p.x - b.minX) * b.scale, y: b.offsetY + (b.maxY - p.y) * b.scale};
}

function polygonPoints(outline: Meters[], b: FitBounds): string {
  return outline.map((p) => project(p, b)).map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ');
}

/** projection.ts's yaw (radians CCW from +x/east) -> the on-screen rotation degrees for the
 *  marker's `rotate()` transform. */
function rotationFromHeading(headingRad: number): number {
  return 90 - headingRad * (180 / Math.PI);
}

/** A lightweight SVG viewport (not MapLibre -- a small PiP/viewport doesn't need the full
 *  map stack) showing the real garden outline(s), dock, and live mower pose read straight from
 *  the store: the same `map`/`position`/`state.pose` data Map.tsx renders, fit to bounds. Shows
 *  a calm "Map loading" placeholder (ground plane + grid, no fabricated geometry) until there's
 *  a real map or pose to draw. The position-uncertainty ring is only ever drawn from a real
 *  `sensors.gps.position_accuracy` reading -- never a fabricated default radius. */
export function MiniMap({chipLabel = 'Etupiha · position live', className}: MiniMapProps) {
  const realMap = useSelectedMower((s) => s?.map);
  const zones = useMemo(() => (realMap ? mapDataToZones(realMap) : []), [realMap]);
  const dock = useMemo(() => (realMap ? mapDataToDock(realMap) : undefined), [realMap]);

  const currentState = useSelectedMower((s) => s?.state.current_state);
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);
  const isDocked = currentState === 'DOCKED' || isCharging;
  const robotPositionBase = useSelectedMower((s) => s?.position ?? s?.state.pose);
  const robotLiveHeading = useSelectedMower((s) => (s?.state.pose?.heading_valid ? s.state.pose.heading : undefined));
  const accuracyM = useSelectedMower((s) => s?.state.sensors?.gps?.position_accuracy);

  const showRobot = Boolean(robotPositionBase) && !isDocked;
  const heading = robotLiveHeading ?? robotPositionBase?.heading ?? 0;

  const bounds = useMemo(() => {
    const points: Meters[] = zones.flatMap((z) => z.outline);
    if (dock) points.push(dock.position);
    if (showRobot && robotPositionBase) points.push({x: robotPositionBase.x, y: robotPositionBase.y});
    return fitToViewport(points);
  }, [zones, dock, showRobot, robotPositionBase]);

  const hasContent = bounds !== null;
  const robotScreen = showRobot && robotPositionBase && bounds ? project({x: robotPositionBase.x, y: robotPositionBase.y}, bounds) : null;
  const dockScreen = dock && bounds ? project(dock.position, bounds) : null;
  // R1: accuracyM comes straight off the real sensors.gps.position_accuracy reading -- null or
  // undefined means "no real reading yet", which must omit the ring entirely rather than
  // substitute a fabricated radius.
  const hasAccuracy = typeof accuracyM === 'number';
  const ringRadius =
    typeof accuracyM === 'number' && bounds ? Math.min(Math.max(accuracyM * bounds.scale, MIN_RING_RADIUS), MAX_RING_RADIUS) : 0;

  return (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-card)]', className)}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <rect width={VIEW_W} height={VIEW_H} fill="var(--map)" />
        <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
          <path d="M0 71h408M0 142h408M136 0v214M272 0v214" />
        </g>
        {hasContent && bounds ? (
          <>
            {zones.map((z) => {
              if (z.outline.length < 3) return null;
              const points = polygonPoints(z.outline, bounds);
              if (isMowableType(z.type)) {
                return <polygon key={z.id} points={points} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />;
              }
              if (z.type === 'obstacle') {
                return (
                  <polygon key={z.id} points={points} fill="var(--danger)" fillOpacity={0.15} stroke="var(--danger)" strokeWidth={1} />
                );
              }
              return (
                <polygon
                  key={z.id}
                  points={points}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              );
            })}
            {dockScreen ? (
              <g transform={`translate(${dockScreen.x},${dockScreen.y})`}>
                <rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />
              </g>
            ) : null}
            {robotScreen ? (
              <g transform={`translate(${robotScreen.x},${robotScreen.y}) rotate(${rotationFromHeading(heading)})`}>
                {hasAccuracy ? (
                  <g data-testid="accuracy-ring">
                    <circle r={ringRadius} fill="var(--accent)" opacity=".12" />
                    <circle r={ringRadius} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" opacity=".5" />
                  </g>
                ) : null}
                <rect x="-13" y="-13" width="26" height="26" rx="8" fill="var(--accent-bright)" />
                <path d="M0 -20 L6 -12 L-6 -12 Z" fill="var(--accent)" />
              </g>
            ) : null}
          </>
        ) : null}
      </svg>
      {chipLabel ? (
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur"
          style={{background: 'color-mix(in srgb, var(--surface) 82%, transparent)'}}
        >
          ● {chipLabel}
        </span>
      ) : null}
      {!hasContent ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <span className="text-[.78rem] text-ink-faint">Map loading…</span>
        </div>
      ) : null}
    </div>
  );
}
