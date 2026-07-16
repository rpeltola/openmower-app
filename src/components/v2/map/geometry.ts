// Pure planar geometry helpers on metric {x,y} outline points — ported from the RevLaw editor's
// lib/geo/geometry.js (distance / pointToSegmentDistance / nearestEdgeInsertIndex). Used by the
// "add point" tool to insert a new vertex on the outline edge nearest to the click.
import type {Meters} from '@/lib/v2/geo/projection';

/** Euclidean distance between two metric points. */
export function distance(a: Meters, b: Meters): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest distance from point p to segment a-b. */
export function pointToSegmentDistance(p: Meters, a: Meters, b: Meters): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const lenSq = vx * vx + vy * vy;
  let t = lenSq > 0 ? (wx * vx + wy * vy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = p.x - (a.x + t * vx);
  const dy = p.y - (a.y + t * vy);
  return Math.hypot(dx, dy);
}

/**
 * For a closed ring of outline points, return the array index at which a new vertex should be
 * spliced so it lands on the edge nearest to `p` (insert between the two consecutive vertices of
 * that edge).
 */
export function nearestEdgeInsertIndex(points: Meters[], p: Meters): number {
  if (!points || points.length < 2) return points ? points.length : 0;
  const n = points.length;
  let best = Number.POSITIVE_INFINITY;
  let bestIndex = 0;
  for (let i = 0; i < n; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const d = pointToSegmentDistance(p, a, b);
    if (d < best) {
      best = d;
      bestIndex = i;
    }
  }
  return bestIndex + 1; // splice position after vertex bestIndex
}

/**
 * Push/smear brush: points within `radiusMeters` of `center` move along `delta` (the drag
 * movement since the last step), with a linear falloff to the edge. `strength` (0..1) scales how
 * strongly points follow at the brush center. Ported verbatim from RevLaw's geo/tools/brush.js.
 */
export function dragBrush(
  points: Meters[],
  center: Meters,
  delta: Meters,
  radiusMeters: number,
  strength: number,
): {points: Meters[]; moved: number} {
  const result = points.map((p) => ({x: p.x, y: p.y}));
  if (delta.x === 0 && delta.y === 0) return {points: result, moved: 0};
  let moved = 0;
  for (let i = 0; i < result.length; i += 1) {
    const p = result[i];
    const dist = Math.hypot(p.x - center.x, p.y - center.y);
    if (dist > radiusMeters) continue;
    const influence = 1 - dist / radiusMeters; // linear falloff
    const f = strength * influence;
    if (f <= 0) continue;
    p.x += delta.x * f;
    p.y += delta.y * f;
    moved += 1;
  }
  return {points: result, moved};
}

/** Forward (wrapping) index path from startIdx to endIdx inclusive, along a closed ring of
 *  `count` points. Ported verbatim from RevLaw's geo/tools/snap.js. */
export function buildCircularIndexPath(startIdx: number, endIdx: number, count: number): number[] {
  const path = [startIdx];
  let current = startIdx;
  for (let safety = 0; safety < count; safety += 1) {
    if (current === endIdx) break;
    current = (current + 1) % count;
    path.push(current);
  }
  return path;
}

/**
 * Snap-line tool: redistribute the points between `startIdx` and `endIdx` (inclusive, walking the
 * ring forward from start) onto a straight, equally spaced line between the two endpoints. Ported
 * verbatim from RevLaw's geo/tools/snap.js.
 */
export function snapEvenly(
  points: Meters[],
  startIdx: number | null,
  endIdx: number | null,
): {points: Meters[]; changed: number} {
  const count = points.length;
  const result = points.map((p) => ({x: p.x, y: p.y}));
  if (
    startIdx == null ||
    endIdx == null ||
    startIdx < 0 ||
    endIdx < 0 ||
    startIdx >= count ||
    endIdx >= count ||
    startIdx === endIdx
  ) {
    return {points: result, changed: 0};
  }

  const indexPath = buildCircularIndexPath(startIdx, endIdx, count);
  if (indexPath.length < 2) return {points: result, changed: 0};

  const start = {x: result[startIdx].x, y: result[startIdx].y};
  const end = {x: result[endIdx].x, y: result[endIdx].y};
  const segments = indexPath.length - 1;

  for (let step = 0; step < indexPath.length; step += 1) {
    const t = step / segments;
    const idx = indexPath[step];
    result[idx] = {x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t};
  }

  return {points: result, changed: indexPath.length};
}
