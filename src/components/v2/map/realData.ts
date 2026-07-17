// Converts the real gateway MapData (src/stores/schemas.ts) into the v2 map editor's Zone[]/Dock
// shapes (mockMap.ts) — data-wiring pass, display/read-only. Area outlines and the dock position
// already arrive in datum-relative metres, the SAME frame v2's projection.ts works in, so no geo
// conversion happens here — just reshaping, an open-ring dedupe, and the type/settings mapping.
//
// Also carries the WRITE side (W9 A2b): `zonesToMapData` reshapes the editor's Zone[]/Dock back
// into a real MapData for `rpc.map.replace`, and `versionFeaturesToZonesAndDock` turns a fetched
// `query/mapversion` GeoJSON payload (already converted to Features by area-converter.ts's
// mapVersionToFeatures) into the same Zone[]/Dock shape, for restore/preview.
import {isMowableType, type AreaSettings, type Dock, type Zone, type ZoneType} from '@/components/v2/map/mockMap';
import type {AreaFeature} from '@/types/geojson';
import type {Area, AreaType, DockingStation, MapData} from '@/stores/schemas';
import {featuresToDockingStations} from '@/utils/area-converter';
import {pointsToRelative, type AbsolutePoint, type LocalFrame} from '@/utils/coordinates';
import {generateId} from '@/utils/area-utils';
import type {FeatureCollection} from 'geojson';

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

// TODO multi-dock — v2's editor only shows/moves the FIRST docking station; any additional real
// docks are invisible to it. zonesToMapData below passes them through unchanged on save so a
// second dock is never silently deleted, but it can't be edited from v2 yet.
export function mapDataToDock(map: MapData): Dock | undefined {
  const first = map.docking_stations[0];
  return first
    ? {
        id: first.id,
        position: {x: first.position.x, y: first.position.y},
        heading: first.heading,
        approach_distance: first.approach_distance,
        name: first.properties.name,
        active: first.properties.active,
      }
    : undefined;
}

// v2-only zone type 'spot' (a standalone one-off mow patch, MAP_SCREEN_SPEC S3) has no backend
// equivalent yet -- the closest real semantics is a mow area, so it collapses to 'mow' on save.
// Lossy (the "this is a spot region, not a whole area" distinction is lost on save/reload), but
// documented and no worse than dropping the zone entirely; areaSchema has no field to tag it.
const ZONE_TYPE_TO_AREA_TYPE: Record<ZoneType, AreaType> = {
  mow: 'mow',
  nav: 'nav',
  obstacle: 'obstacle',
  spot: 'mow',
};

/** The editor's Zone[]/Dock -> a real MapData, for `rpc.map.replace` (W9 A2b save). `baseMap` is
 *  the mower's last-known real map: its `datum` is preserved (areas/dock are ALREADY in that
 *  datum's relative frame, see the module doc, so no reprojection needed) and any docking
 *  stations beyond the first are passed through untouched (see mapDataToDock's TODO) so saving
 *  never drops a second dock the editor can't see. Absent `baseMap` (never loaded a real map
 *  yet) saves with no datum -- the caller should guard against that (see Map.tsx's save handler)
 *  since a map without a datum can't be geolocated by the mower. */
export function zonesToMapData(zones: Zone[], dock: Dock, baseMap?: MapData): MapData {
  const areas: Area[] = zones.map((zone) => ({
    id: zone.id,
    properties: {
      name: zone.name,
      type: ZONE_TYPE_TO_AREA_TYPE[zone.type],
      active: zone.active ?? true,
      angle: zone.settings?.angle,
      outline_count: zone.settings?.outline_count,
      outline_overlap_count: zone.settings?.outline_overlap_count,
      outline_offset: zone.settings?.outline_offset,
    },
    outline: zone.outline,
  }));

  const extraDocks = (baseMap?.docking_stations ?? []).slice(1);
  const savedDock: DockingStation = {
    id: dock.id ?? generateId(),
    properties: {name: dock.name ?? 'Docking station', active: dock.active ?? true},
    position: dock.position,
    heading: dock.heading ?? 0,
    approach_distance: dock.approach_distance ?? 0,
  };

  return {
    datum: baseMap?.datum,
    areas,
    docking_stations: [savedDock, ...extraDocks],
  };
}

/** A fetched map version's Features (area-converter.ts's mapVersionToFeatures, already
 *  type-remapped from the backend's operation/navigation/exclusion vocabulary) -> the v2 editor's
 *  Zone[]/Dock, for Version history's Restore/preview. Unlike the live mapDataToZones/
 *  mapDataToDock above, coordinates start as absolute WGS84 lon/lat (the stored version's native
 *  frame) and need `datum` to become the same relative metres the editor/MapCanvas work in --
 *  the CURRENT live map's datum, same assumption HistoryMap.tsx already makes (a garden's datum
 *  doesn't get versioned per job, it's set once from the mower's GPS fix). */
export function versionFeaturesToZonesAndDock(
  features: FeatureCollection,
  datum: LocalFrame,
): {zones: Zone[]; dock?: Dock} {
  const zones = features.features.flatMap((feature, index): Zone[] => {
    if (feature.geometry.type !== 'Polygon') return [];
    const areaFeature = feature as AreaFeature;
    const outline = openRing(pointsToRelative(areaFeature.geometry.coordinates[0] as AbsolutePoint[], datum));
    if (outline.length < 3) return [];
    const props = areaFeature.properties;
    return [
      {
        id: typeof feature.id === 'string' ? feature.id : generateId(),
        name: props.name || `Area ${index + 1}`,
        type: AREA_TYPE_TO_ZONE_TYPE[props.type],
        active: props.active,
        outline,
        settings: undefined, // historical versions don't carry per-area overrides through GeoJSON yet
      },
    ];
  });

  const dockingStations = featuresToDockingStations(features, datum);
  const first = dockingStations[0];
  const dock: Dock | undefined = first
    ? {
        id: first.id,
        position: first.position,
        heading: first.heading,
        approach_distance: first.approach_distance,
        name: first.properties.name,
        active: first.properties.active,
      }
    : undefined;

  return {zones, dock};
}
