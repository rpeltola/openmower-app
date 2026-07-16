// Live per-zone measurements for the edit-mode tool dock (MAP_EDITOR_SPEC.md §E). Cross-zone
// business rule (net mowable = mow area minus CONTAINED obstacle areas), built on the pure
// geometry.ts primitives — same split as validation.ts.
import {centroid, isPointInsidePolygon, polygonArea, polygonPerimeter} from '@/components/v2/map/geometry';
import type {Zone} from '@/components/v2/map/mockMap';

export interface ZoneMeasurements {
  areaM2: number;
  perimeterM: number;
  /** Only meaningful for type 'mow' (null otherwise) — the zone's own area minus the area of any
   *  obstacle zone whose centroid falls inside it. */
  netMowableM2: number | null;
}

export function measureZone(zone: Zone, allZones: Zone[]): ZoneMeasurements {
  const areaM2 = polygonArea(zone.outline);
  const perimeterM = polygonPerimeter(zone.outline);

  let netMowableM2: number | null = null;
  if (zone.type === 'mow') {
    const containedObstacleArea = allZones
      .filter((z) => z.type === 'obstacle' && z.outline.length >= 3)
      .filter((z) => {
        const center = centroid(z.outline);
        return center ? isPointInsidePolygon(center, zone.outline) : false;
      })
      .reduce((sum, z) => sum + polygonArea(z.outline), 0);
    netMowableM2 = Math.max(0, areaM2 - containedObstacleArea);
  }

  return {areaM2, perimeterM, netMowableM2};
}
