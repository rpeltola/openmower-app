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

/** Shoelace polygon area, in square meters. Ported verbatim from RevLaw's geo/geometry.js. */
export function polygonArea(polygon: Meters[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let areaTwice = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const j = (i + 1) % polygon.length;
    areaTwice += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
  }
  return Math.abs(areaTwice) / 2;
}

/** Perimeter (sum of edge lengths) in meters. Ported verbatim from RevLaw's geo/geometry.js. */
export function polygonPerimeter(polygon: Meters[]): number {
  if (!polygon || polygon.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const j = (i + 1) % polygon.length;
    total += distance(polygon[i], polygon[j]);
  }
  return total;
}

/** Axis-aligned bounding box. Ported verbatim from RevLaw's geo/geometry.js. */
export function boundingBox(
  points: Meters[],
): {minX: number; minY: number; maxX: number; maxY: number; width: number; height: number} | null {
  if (!points || !points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY};
}

/** Polygon centroid (simple point-average, not area-weighted — matches RevLaw's geo/geometry.js). */
export function centroid(points: Meters[]): Meters | null {
  if (!points || points.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return {x: x / points.length, y: y / points.length};
}

/** Translate every point by (dx, dy). Ported verbatim from RevLaw's geo/geometry.js. */
export function translatePoints(points: Meters[], dx: number, dy: number): Meters[] {
  return points.map((p) => ({x: p.x + dx, y: p.y + dy}));
}

/** Rotate every point about `center` by `angleRad` (CCW). Ported verbatim from RevLaw's
 *  geo/geometry.js. */
export function rotatePoints(points: Meters[], center: Meters, angleRad: number): Meters[] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos};
  });
}

/** Scale every point about `center` by `factor`. Ported verbatim from RevLaw's geo/geometry.js. */
export function scalePoints(points: Meters[], center: Meters, factor: number): Meters[] {
  return points.map((p) => ({
    x: center.x + (p.x - center.x) * factor,
    y: center.y + (p.y - center.y) * factor,
  }));
}

function lineIntersect(p1: Meters, d1: Meters, p2: Meters, d2: Meters): Meters | null {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom;
  return {x: p1.x + d1.x * t, y: p1.y + d1.y * t};
}

/**
 * Uniform polygon buffer/offset: push every edge outward (positive `dist`) or inward (negative)
 * by `dist` meters and re-intersect adjacent edges, so corners stay sharp instead of just moving
 * each vertex along its own normal. Ported verbatim from RevLaw's geo/geometry.js. Positive grows
 * a mow area; negative shrinks an obstacle's safety margin (etc).
 */
export function offsetPolygon(points: Meters[], dist: number): Meters[] {
  const n = points.length;
  if (n < 3) return points.map((p) => ({x: p.x, y: p.y}));
  let area2 = 0;
  for (let i = 0; i < n; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ccw = area2 > 0;
  const lines: ({p: Meters; d: Meters} | null)[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % n];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) {
      lines.push(null);
      continue;
    }
    dx /= len;
    dy /= len;
    const nx = ccw ? -dy : dy;
    const ny = ccw ? dx : -dx;
    lines.push({p: {x: a.x + nx * dist, y: a.y + ny * dist}, d: {x: dx, y: dy}});
  }
  const result: Meters[] = [];
  for (let i = 0; i < n; i += 1) {
    const cur = lines[i];
    let prev = lines[(i - 1 + n) % n];
    let k = (i - 1 + n) % n;
    while (!prev && k !== i) {
      k = (k - 1 + n) % n;
      prev = lines[k];
    }
    if (!prev || !cur) {
      result.push({x: points[i].x, y: points[i].y});
      continue;
    }
    const x = lineIntersect(prev.p, prev.d, cur.p, cur.d);
    result.push(x || {x: cur.p.x, y: cur.p.y});
  }
  return result;
}

/**
 * Douglas-Peucker outline simplification (never below 3 points). Ported verbatim from RevLaw's
 * geo/geometry.js.
 */
export function simplify(points: Meters[], tolerance: number): Meters[] {
  if (!points || points.length <= 3 || tolerance <= 0) {
    return points ? points.map((p) => ({x: p.x, y: p.y})) : [];
  }

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = pointToSegmentDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > tolerance && index !== -1) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  const result = points.filter((_, i) => keep[i]).map((p) => ({x: p.x, y: p.y}));
  return result.length >= 3 ? result : points.map((p) => ({x: p.x, y: p.y}));
}

/** Axis-aligned rectangle corners (CW) spanning two opposite metric points — for the rectangle
 *  draw-by-drag tool. Net-new (not a RevLaw port): our flat local ENU frame makes an
 *  axis-aligned box the natural "rectangle" shape. */
export function rectangleCorners(a: Meters, b: Meters): Meters[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return [
    {x: minX, y: minY},
    {x: maxX, y: minY},
    {x: maxX, y: maxY},
    {x: minX, y: maxY},
  ];
}

/** Regular polygon approximating a circle of `radius` meters about `center` — for the circle
 *  draw-by-drag tool. Net-new (not a RevLaw port). */
export function circleToPolygon(center: Meters, radius: number, segments = 32): Meters[] {
  const points: Meters[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle)});
  }
  return points;
}
