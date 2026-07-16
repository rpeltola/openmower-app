// Coverage preview (MAP_EDITOR_SPEC.md §F / KB §F) — a VISUAL-ONLY planning aid: outline laps
// (edge-first perimeter passes) + a back-and-forth fill, obstacles carved out. The robot decides
// its actual pattern at mow time; this never touches the map, only a localStorage-remembered
// preview config (see Map.tsx). Mirrors mower_logic's real controls (tool width / overlap laps /
// mow-angle offset) without being wired to it.
import {isPointInsidePolygon, offsetPolygon, polygonArea} from '@/components/v2/map/geometry';
import type {Meters} from '@/lib/v2/geo/projection';

export interface CoverageSegment {
  a: Meters;
  b: Meters;
}

const MAX_LAPS = 12; // guard against runaway insets on a tiny/oddly-shaped outline

/**
 * Edge-first perimeter laps: the outline itself, then successive `spacing`-meter insets, up to
 * `count` laps total (stops early if an inset collapses to a degenerate/zero-area ring).
 */
export function outlineLaps(outline: Meters[], count: number, spacing: number): Meters[][] {
  const laps: Meters[][] = [];
  let current = outline;
  const n = Math.max(1, Math.min(MAX_LAPS, Math.round(count)));
  for (let i = 0; i < n; i += 1) {
    if (i > 0) current = offsetPolygon(current, -spacing);
    const area = polygonArea(current);
    if (!Number.isFinite(area) || area <= 0.05) break; // ring has collapsed — stop insetting
    laps.push(current);
  }
  return laps;
}

/**
 * Back-and-forth fill: parallel stripes at `spacing` clipped to `outline`, holes carved by
 * `obstacles`. Ported verbatim from RevLaw's geo/coverage.js (`coverageLines`).
 */
export function coverageLines(
  outline: Meters[],
  obstacles: Meters[][],
  spacing: number,
  angleDeg: number,
): CoverageSegment[] {
  if (!outline || outline.length < 3 || !(spacing > 0)) return [];

  const MAX_LINES = 5000; // guard against absurd spacing on huge zones
  const ang = ((angleDeg || 0) * Math.PI) / 180;
  // Rotate the world by -ang so the stripes become horizontal scanlines.
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  const rot = (p: Meters): Meters => ({x: p.x * c - p.y * s, y: p.x * s + p.y * c});
  const cb = Math.cos(ang);
  const sb = Math.sin(ang);
  const unrot = (p: Meters): Meters => ({x: p.x * cb - p.y * sb, y: p.x * sb + p.y * cb});

  const ring = outline.map(rot);
  const holes = (obstacles || []).filter((o) => o && o.length >= 3).map((o) => o.map(rot));

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minY) || (maxY - minY) / spacing > MAX_LINES) return [];

  const crossings = (poly: Meters[], y: number): number[] => {
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    return xs;
  };

  const segments: CoverageSegment[] = [];
  for (let y = minY + spacing / 2; y < maxY; y += spacing) {
    const xs = crossings(ring, y);
    holes.forEach((h) => xs.push(...crossings(h, y)));
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 1) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      if (x1 - x0 < 1e-6) continue;
      const mid = {x: (x0 + x1) / 2, y};
      if (isPointInsidePolygon(mid, ring) && !holes.some((h) => isPointInsidePolygon(mid, h))) {
        segments.push({a: unrot({x: x0, y}), b: unrot({x: x1, y})});
      }
    }
  }
  return segments;
}
