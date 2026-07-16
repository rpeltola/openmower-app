// Map-wide geometry validation (MAP_EDITOR_SPEC.md §E) — a port of RevLaw's editor checks
// (self-intersection, too-few-points, duplicate/degenerate vertices, dock-inside-obstacle, orphan
// obstacles) over our zone/dock model. Pure — no map/DOM access; Map.tsx uses each issue's `point`
// to pan/zoom and select the zone when the issue is clicked.
import {centroid, distance, isPointInsidePolygon, segmentsIntersect} from '@/components/v2/map/geometry';
import type {Dock, Zone} from '@/components/v2/map/mockMap';
import type {Meters} from '@/lib/v2/geo/projection';

export type IssueSeverity = 'error' | 'warning';

export interface MapIssue {
  id: string;
  severity: IssueSeverity;
  message: string;
  /** The zone this issue concerns, if any — selected when the issue is clicked. */
  zoneId?: string;
  /** Where to pan/zoom the map when this issue is clicked (local meters). */
  point: Meters;
}

// Consecutive vertices closer than this (meters) count as "on top of each other".
const DEGENERATE_EPS_M = 0.02;

export function validateMap(zones: Zone[], dock: Dock): MapIssue[] {
  const issues: MapIssue[] = [];

  for (const zone of zones) {
    const {outline} = zone;
    if (outline.length < 3) {
      issues.push({
        id: `${zone.id}-too-few-points`,
        severity: 'error',
        message: `${zone.name}: needs at least 3 points (has ${outline.length})`,
        zoneId: zone.id,
        point: outline[0] ?? {x: 0, y: 0},
      });
      continue; // the checks below assume a real polygon
    }

    const n = outline.length;

    outline.forEach((p, i) => {
      const next = outline[(i + 1) % n];
      if (distance(p, next) < DEGENERATE_EPS_M) {
        issues.push({
          id: `${zone.id}-dup-${i}`,
          severity: 'warning',
          message: `${zone.name}: vertices ${i + 1} and ${((i + 1) % n) + 1} are on top of each other`,
          zoneId: zone.id,
          point: p,
        });
      }
    });

    for (let i = 0; i < n; i += 1) {
      const a1 = outline[i];
      const a2 = outline[(i + 1) % n];
      for (let j = i + 1; j < n; j += 1) {
        const adjacent = j === i || (j + 1) % n === i || (i + 1) % n === j;
        if (adjacent) continue; // adjacent edges legitimately share a vertex
        const b1 = outline[j];
        const b2 = outline[(j + 1) % n];
        if (segmentsIntersect(a1, a2, b1, b2)) {
          issues.push({
            id: `${zone.id}-self-intersect-${i}-${j}`,
            severity: 'error',
            message: `${zone.name}: outline crosses itself (edges ${i + 1} and ${j + 1})`,
            zoneId: zone.id,
            point: {x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2},
          });
        }
      }
    }
  }

  for (const zone of zones) {
    if (zone.type !== 'obstacle' || zone.outline.length < 3) continue;
    if (isPointInsidePolygon(dock.position, zone.outline)) {
      issues.push({
        id: `dock-inside-${zone.id}`,
        severity: 'error',
        message: `Dock is inside the "${zone.name}" obstacle`,
        zoneId: zone.id,
        point: dock.position,
      });
    }
  }

  const mowZones = zones.filter((z) => z.type === 'mow' && z.outline.length >= 3);
  for (const zone of zones) {
    if (zone.type !== 'obstacle' || zone.outline.length < 3) continue;
    const center = centroid(zone.outline);
    if (!center) continue;
    const contained = mowZones.some((mow) => isPointInsidePolygon(center, mow.outline));
    if (!contained) {
      issues.push({
        id: `${zone.id}-orphan`,
        severity: 'warning',
        message: `${zone.name}: obstacle isn't inside any mowing area`,
        zoneId: zone.id,
        point: center,
      });
    }
  }

  return issues;
}
