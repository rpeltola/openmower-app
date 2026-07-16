// Boolean area operations — Merge / Split / Subtract (MAP_BOOLEAN_OPS_SPEC.md, v1 parity). Ported
// from v1's src/utils/area-utils.ts (removeMiniCoords, splitPolygonWithLine) and
// src/components/map/edit/EditControls.tsx's merge/subtract handlers.
//
// THE KEY SIMPLIFICATION: turf's boolean ops (union/difference/polygonize/polygonToLine/
// booleanPointInPolygon/pointOnFeature/nearestPointOnLine) and sweepline-intersections are all
// planar / coordinate-system-agnostic — no geodesic math. So we run them DIRECTLY on v2's metric
// {x,y} outline points as [x,y] positions. NO datum round-trip. v2 outlines are open rings (no
// closing duplicate); turf needs closed rings, so we close on the way in and strip the closing
// point on the way out.
//
// NOTE: `@turf/area` is NOT on that planar list, and deliberately not used here — it assumes
// its input is lon/lat DEGREES and computes a geodesic area (position * earthRadius²), so feeding
// it raw meter values would return a wildly inflated garbage number, not square meters. Confirmed
// with a standalone test against the mock zones (etupiha's real ~130m² came back as ~2.8e12).
// removeMiniCoords uses geometry.ts's planar `polygonArea` (shoelace) instead, per the spec.
import {booleanPointInPolygon} from '@turf/boolean-point-in-polygon';
import {difference} from '@turf/difference';
import {featureCollection, lineString, polygon} from '@turf/helpers';
import {nearestPointOnLine} from '@turf/nearest-point-on-line';
import {pointOnFeature} from '@turf/point-on-feature';
import {polygonToLine} from '@turf/polygon-to-line';
import {polygonize} from '@turf/polygonize';
import {union} from '@turf/union';
import type {Feature, LineString as GeoLineString, MultiPolygon, Polygon, Position} from 'geojson';
import sweeplineIntersections from 'sweepline-intersections';
import {polygonArea} from '@/components/v2/map/geometry';
import type {Meters} from '@/lib/v2/geo/projection';

/** v2's open-ring outline -> a closed turf ring (first point repeated at the end). */
function toClosedRing(outline: Meters[]): Position[] {
  const ring: Position[] = outline.map((p) => [p.x, p.y]);
  ring.push([outline[0].x, outline[0].y]);
  return ring;
}

/** A closed turf ring -> v2's open-ring outline (strips the closing duplicate). */
function fromClosedRing(ring: Position[]): Meters[] {
  return ring.slice(0, -1).map(([x, y]) => ({x, y}));
}

function toTurfPolygon(outline: Meters[]): Feature<Polygon> {
  return polygon([toClosedRing(outline)]);
}

// Rings smaller than this (turf ops can leave slivers) are dropped, matching v1.
const MIN_RING_AREA_M2 = 0.001;

/**
 * Ported from v1's `removeMiniCoords` (area-utils.ts) — drops near-zero-area rings and collapses
 * the surviving Polygon/MultiPolygon geometry into a flat list of "one polygon's rings" entries
 * (each `[outer, ...holes]`). Area is the OUTER ring's planar shoelace area (geometry.ts's
 * `polygonArea` — v1 used turf's geodesic `area()`, which only makes sense for lon/lat input).
 * Un-constructable rings (too few points, etc.) are treated as zero-area rather than crashing.
 */
function removeMiniCoords(feature: Feature<Polygon | MultiPolygon> | null): Position[][][] {
  if (!feature) return [];
  const coords: Position[][][] =
    feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const safeArea = (coord: Position[][]): number => {
    const outer = coord[0];
    if (!outer || outer.length < 4) return 0; // < 4 = can't be a closed ring of >= 3 distinct points
    return polygonArea(outer.map(([x, y]) => ({x, y})));
  };
  return coords.filter((coord) => safeArea(coord) >= MIN_RING_AREA_M2);
}

/**
 * Merge outlines into one (v1's `union` + removeMiniCoords). Returns null if the operands don't
 * combine into a single contiguous area — the union collapsing to more than one surviving polygon
 * (disjoint operands, a MultiPolygon) or to a polygon with a hole (shouldn't happen for a plain
 * union of solid rings, but guarded the same way subtract is, since v2 zones can't hold one).
 */
export function mergeOutlines(rings: Meters[][]): Meters[] | null {
  const merged = union(featureCollection(rings.map(toTurfPolygon)));
  const polys = removeMiniCoords(merged);
  if (polys.length !== 1 || polys[0].length !== 1) return null;
  const outline = fromClosedRing(polys[0][0]);
  return outline.length >= 3 ? outline : null;
}

/** Ported verbatim from v1's `insertPointsOnLine` (area-utils.ts). */
function insertPointsOnLine(line: Feature<GeoLineString>, points: Position[]): Feature<GeoLineString> {
  let newLine = line;
  for (const point of points) {
    const snapped = nearestPointOnLine(newLine, point);
    newLine = lineString(newLine.geometry.coordinates.toSpliced(snapped.properties.index + 1, 0, point));
  }
  return newLine;
}

/**
 * Split an outline with a cut line (v1's `splitPolygonWithLine`, ported verbatim — v2 outlines are
 * always single-ring, so v1's holed-polygon guard doesn't apply here). Returns null if the cut
 * doesn't produce at least two pieces (e.g. the line doesn't cross the boundary at least twice).
 */
export function splitOutlineWithLine(outline: Meters[], line: Meters[]): Meters[][] | null {
  if (line.length < 2) return null;
  const poly = toTurfPolygon(outline);
  const polygonLine = polygonToLine(poly) as Feature<GeoLineString>;
  const cutterLine = lineString(line.map((p) => [p.x, p.y]));

  const intersections: Position[] = sweeplineIntersections(featureCollection([polygonLine, cutterLine]), true);
  const lines = featureCollection([
    insertPointsOnLine(polygonLine, intersections),
    insertPointsOnLine(cutterLine, intersections),
  ]);

  const candidatePolys = polygonize(lines);
  const insidePolys = candidatePolys.features.filter((candidate) =>
    booleanPointInPolygon(pointOnFeature(candidate), poly),
  );
  if (insidePolys.length < 2) return null;

  const pieces = insidePolys
    .map((p) => (p.geometry.coordinates.length === 1 ? fromClosedRing(p.geometry.coordinates[0]) : null))
    .filter((piece): piece is Meters[] => piece !== null && piece.length >= 3);
  return pieces.length >= 2 ? pieces : null;
}

/**
 * Subtract `others` from `target` (v1's `difference` + removeMiniCoords). Returns null if the
 * result is empty, splits the target into multiple pieces, or leaves a hole — v2's `Zone.outline`
 * is a single ring with no hole support, so those cases are rejected rather than losing data.
 */
export function subtractOutlines(target: Meters[], others: Meters[][]): Meters[] | null {
  const result = difference(featureCollection([toTurfPolygon(target), ...others.map(toTurfPolygon)]));
  const polys = removeMiniCoords(result);
  if (polys.length !== 1 || polys[0].length !== 1) return null;
  const outline = fromClosedRing(polys[0][0]);
  return outline.length >= 3 ? outline : null;
}
