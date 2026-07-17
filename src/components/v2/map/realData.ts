// Converts the real gateway MapData (src/stores/schemas.ts) into the v2 map editor's Zone[]/Dock
// shapes (mockMap.ts) — data-wiring pass, display/read-only. Area outlines and the dock position
// already arrive in datum-relative metres, the SAME frame v2's projection.ts works in, so no geo
// conversion happens here — just reshaping, an open-ring dedupe, and the type/settings mapping.
import {isMowableType, type AreaSettings, type Dock, type Zone, type ZoneType} from '@/components/v2/map/mockMap';
import type {Area, AreaType, MapData} from '@/stores/schemas';

// A real area's ring may repeat its first point as the last (GeoJSON convention) — v2 zones
// store an OPEN ring (mockMap.ts: "we never duplicate outline[0] as a trailing last point"), so
// drop the closing duplicate if present. Mirrors MowerMap.tsx's `openRing`, just on the relative
// {x,y} points directly rather than absolute lon/lat.
function openRing(outline: Zone['outline']): Zone['outline'] {
  if (outline.length > 1) {
    const first = outline[0];
    const last = outline[outline.length - 1];
    if (first.x === last.x && first.y === last.y) return outline.slice(0, -1);
  }
  return outline;
}

// v2 has no first-class "draft" concept (an in-progress, not-yet-typed area) — show one as a mow
// area rather than dropping it, since that's the closer default once it's finished.
const AREA_TYPE_TO_ZONE_TYPE: Record<AreaType, ZoneType> = {
  mow: 'mow',
  nav: 'nav',
  obstacle: 'obstacle',
  draft: 'mow',
};

// Only the 4 real per-area overrides the ROS side actually understands (mapSchema's areaSchema) —
// none of AreaSettings' other (mock-only, Yarbo-inspired) fields have a real source yet.
function toAreaSettings(area: Area, zoneType: ZoneType): AreaSettings | undefined {
  if (!isMowableType(zoneType)) return undefined;
  const {angle, outline_count, outline_overlap_count, outline_offset} = area.properties;
  if (angle === undefined && outline_count === undefined && outline_overlap_count === undefined && outline_offset === undefined) {
    return undefined;
  }
  return {angle, outline_count, outline_overlap_count, outline_offset};
}

/** Real areas -> v2 Zone[]. An area whose outline can't form a polygon (< 3 points once
 *  deduped) is dropped rather than crashing the map — same defensiveness as area-converter.ts's
 *  areaToFeature. */
export function mapDataToZones(map: MapData): Zone[] {
  return map.areas.flatMap((area, index) => {
    const outline = openRing(area.outline);
    if (outline.length < 3) return [];
    const type = AREA_TYPE_TO_ZONE_TYPE[area.properties.type];
    const zone: Zone = {
      id: area.id,
      name: area.properties.name || `Area ${index + 1}`,
      type,
      active: area.properties.active,
      outline,
      settings: toAreaSettings(area, type),
    };
    return [zone];
  });
}

// TODO multi-dock + heading/approach_distance — the real docking_stations[] carries both, but
// v2's Dock shape (mockMap.ts) is a single position only for this pass.
export function mapDataToDock(map: MapData): Dock | undefined {
  const first = map.docking_stations[0];
  return first ? {position: {x: first.position.x, y: first.position.y}} : undefined;
}
