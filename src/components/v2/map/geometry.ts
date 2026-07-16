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
