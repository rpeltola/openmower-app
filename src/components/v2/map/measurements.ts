// Live per-zone measurements for the edit-mode tool dock (MAP_EDITOR_SPEC.md §E). Cross-zone
// business rule (net mowable = mow area minus CONTAINED obstacle areas), built on the pure
// geometry.ts primitives — same split as validation.ts.
import {boundingBox, centroid, isPointInsidePolygon, polygonArea, polygonPerimeter} from '@/components/v2/map/geometry';
import {isMowableType, type Zone} from '@/components/v2/map/mockMap';

export interface ZoneMeasurements {
  areaM2: number;
  perimeterM: number;
  /** Only meaningful for mow-like types (null otherwise) — the zone's own area minus the area of
   *  any obstacle zone whose centroid falls inside it. */
  netMowableM2: number | null;
}

export function measureZone(zone: Zone, allZones: Zone[]): ZoneMeasurements {
  const areaM2 = polygonArea(zone.outline);
  const perimeterM = polygonPerimeter(zone.outline);

  let netMowableM2: number | null = null;
  if (isMowableType(zone.type)) {
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

// Mock assumed cutting width for the Preview/plan-preview estimate only — not a real firmware
// param, just enough to turn a polygon area into a plausible time/passes guess.
const PREVIEW_TOOL_WIDTH_M = 0.3;

export interface PreviewEstimate {
  areaM2: number;
  minutes: number;
  passes: number;
}

/**
 * MOCK time/passes estimate from the zone's real polygon area — local only, never sent to ROS.
 * Shared by AreaSettingsSheet's inline "Preview" chip and Map.tsx's full plan-preview cost card
 * (MAP_SCREEN_SPEC S7), so both agree on the same number.
 */
export function estimateMowPreview(zone: Zone): PreviewEstimate {
  const areaM2 = polygonArea(zone.outline);
  const speedMps = zone.settings?.mow_speed === 'fast' ? 0.35 : zone.settings?.mow_speed === 'slow' ? 0.15 : 0.25;
  const bbox = boundingBox(zone.outline);
  const passes = bbox ? Math.max(1, Math.round(Math.max(bbox.width, bbox.height) / PREVIEW_TOOL_WIDTH_M)) : 1;
  const pathLengthM = areaM2 / PREVIEW_TOOL_WIDTH_M;
  const minutes = Math.max(1, Math.round(pathLengthM / speedMps / 60));
  return {areaM2, minutes, passes};
}
