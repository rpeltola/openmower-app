import {fallbackDatum, type Area, type AreaProps, type AreaType, type DockingStation, type MapData} from '@/stores/schemas';
import type {AreaFeature, DockingStationFeature, DockingStationFeatureProps} from '@/types/geojson';
import {generateId} from '@/utils/area-utils';
import {
  datumToRelative,
  movePointTowardsHeading,
  pointsToAbsolute,
  pointsToRelative,
  type AbsolutePoint,
  type RelativePoint,
  type UtmPoint,
} from '@/utils/coordinates';
import area from '@turf/area';
import {featureCollection, lineString, polygon} from '@turf/helpers';
import type {Feature, FeatureCollection, Polygon} from 'geojson';
import {produce} from 'immer';

// Synthetic second point of a docking station's LineString, `0.5m` along its heading --
// purely to encode orientation (GeoJSON has no native oriented-point type). Matches the
// backend's dockingStationToGeoJSONFeature (movePointTowardsOrientation(pos, orientation, 0.5)).
const DOCK_ORIENTATION_POINT_DISTANCE_M = 0.5;

// Remove consecutive duplicate or near-duplicate points — floating point artifacts from the mower,
// including low-precision truncated coordinates (~2mm apart in meter-space).
// Compares against the last *kept* point so removal is transitive.
const DEDUPE_EPSILON = 0.003; // meters (3mm)
function dedupePoints(points: RelativePoint[]): RelativePoint[] {
  return points.reduce<RelativePoint[]>((acc, p) => {
    const prev = acc[acc.length - 1];
    if (!prev || Math.abs(p.x - prev.x) >= DEDUPE_EPSILON || Math.abs(p.y - prev.y) >= DEDUPE_EPSILON) {
      acc.push(p);
    }
    return acc;
  }, []);
}

function areaToFeature(area: Area, datum: UtmPoint): Feature<Polygon, AreaProps> | null {
  // Defensive: the incoming map data isn't guaranteed to be a valid GeoJSON ring.
  // A ring needs >=3 distinct points and MUST be closed (first == last) or turf's
  // polygon() throws "First and last Position are not equivalent" and crashes the
  // whole map. Sanitize here so one bad/edited area can't take down the render.
  const ring = pointsToAbsolute(dedupePoints(area.outline), datum);
  if (ring.length < 3) {
    return null;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  try {
    return polygon([ring], area.properties, {id: area.id});
  } catch {
    return null;
  }
}

function featureToArea(feature: AreaFeature, datum: UtmPoint): Area {
  return {
    id: feature.id as string,
    properties: feature.properties,
    outline: pointsToRelative(feature.geometry.coordinates[0] as AbsolutePoint[], datum),
  };
}

// Docking stations round-trip through the SAME 2-point-LineString convention the backend
// uses on disk (see src/types/geojson.ts DockingStationFeature), so DownloadButton/
// UploadButton and the backend's own map.geojson stay symmetric with what the app edits.
function dockingStationToFeature(dock: DockingStation, datum: UtmPoint): DockingStationFeature | null {
  const orientationPoint = movePointTowardsHeading(dock.position, dock.heading, DOCK_ORIENTATION_POINT_DISTANCE_M);
  const coordinates = pointsToAbsolute([dock.position, orientationPoint], datum);
  if (coordinates.length < 2) {
    // pointToAbsolute dropped a non-finite/out-of-range point; skip rather than emit a
    // malformed 1-point (or empty) LineString.
    return null;
  }
  return lineString(
    coordinates,
    {
      type: 'docking_station',
      name: dock.properties.name,
      active: dock.properties.active,
      approach_distance: dock.approach_distance,
    },
    {id: dock.id},
  ) as DockingStationFeature;
}

function featureToDockingStation(feature: DockingStationFeature, datum: UtmPoint): DockingStation {
  const [originAbs, orientationAbs] = feature.geometry.coordinates as AbsolutePoint[];
  const [origin, orientationPoint] = pointsToRelative([originAbs, orientationAbs], datum);
  return {
    id: feature.id as string,
    properties: {
      name: feature.properties.name,
      active: feature.properties.active,
    },
    position: origin,
    heading: Math.atan2(orientationPoint.y - origin.y, orientationPoint.x - origin.x),
    approach_distance: feature.properties.approach_distance ?? 0,
  };
}

// Exported so components that need docking stations *as data* (e.g. map markers) can
// derive them from the live Draw feature collection instead of a second, easily-desynced
// copy -- see MowerMap.tsx's rendering-source note. Defensive on coordinate count: a user
// could, in principle, delete/duplicate a vertex on a dock's LineString via Draw's default
// direct_select editing (the backend's own parser is similarly defensive, see
// GeoJSONMap::parseLineStringFeature).
export function featuresToDockingStations(features: FeatureCollection, datum: UtmPoint): DockingStation[] {
  return features.features
    .filter(
      (feature): feature is DockingStationFeature =>
        feature.geometry.type === 'LineString' &&
        (feature.properties as {type?: string} | null)?.type === 'docking_station' &&
        feature.geometry.coordinates.length >= 2,
    )
    .map((feature) => featureToDockingStation(feature, datum));
}

function convertDatum(datum: {lat: number; long: number}) {
  return datumToRelative([datum.long, datum.lat]);
}

export function mapToFeatures(map?: MapData): FeatureCollection {
  if (!map) {
    return featureCollection([]);
  }
  const datum = convertDatum(map.datum ?? fallbackDatum);
  const areaFeatures = map.areas
    .map((area) => areaToFeature(area, datum))
    .filter((f): f is Feature<Polygon, AreaProps> => f !== null);
  const dockFeatures = map.docking_stations
    .map((dock) => dockingStationToFeature(dock, datum))
    .filter((f): f is DockingStationFeature => f !== null);
  // Cast to the broad `Feature` type: featureCollection() is generic over a single
  // geometry/properties pair, but this collection intentionally mixes area Polygons
  // and docking-station LineStrings.
  return featureCollection([...areaFeatures, ...dockFeatures] as Feature[]);
}

// query/mapversion stores areas under this vocabulary rather than the app's own
// mow/nav/obstacle -- see mapVersionToFeatures.
const AREA_TYPE_REMAP: Record<string, AreaType> = {
  operation: 'mow',
  navigation: 'nav',
  exclusion: 'obstacle',
};
const AREA_TYPES = new Set<AreaType>(['mow', 'nav', 'obstacle', 'draft']);

function remapAreaType(rawType: unknown): AreaType {
  if (typeof rawType !== 'string') return 'draft';
  const remapped = AREA_TYPE_REMAP[rawType];
  if (remapped) return remapped;
  return AREA_TYPES.has(rawType as AreaType) ? (rawType as AreaType) : 'draft';
}

/**
 * Converts a stored map version's raw GeoJSON (query/mapversion's `geojson` string, see
 * useMapVersion) into the same Feature<Polygon, AreaProps> / DockingStationFeature shapes the
 * live map uses (mapToFeatures), so MowerMap/HistoryMap's layers render a historical version
 * exactly like a live one. Unlike mapToFeatures, coordinates are already absolute WGS84 lon/lat
 * -- no datum conversion needed. Area `properties.type` is remapped from the backend's stored
 * vocabulary (operation/navigation/exclusion) to the app's (mow/nav/obstacle); dock LineStrings
 * get their `type`/active/approach_distance normalized to the app's docking_station convention.
 * A feature that doesn't sanity-check (missing geometry, unknown geometry type) is dropped
 * rather than crashing the whole map -- same defensiveness as areaToFeature.
 */
export function mapVersionToFeatures(raw: unknown): FeatureCollection {
  const rawFeatures =
    raw && typeof raw === 'object' && Array.isArray((raw as {features?: unknown}).features)
      ? ((raw as {features: unknown[]}).features)
      : [];

  const features = rawFeatures.flatMap((entry): Feature[] => {
    if (!entry || typeof entry !== 'object' || !('geometry' in entry)) return [];
    const feature = entry as Feature;
    const geometry = feature.geometry;
    if (!geometry) return [];
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const id = typeof feature.id === 'string' || typeof feature.id === 'number' ? feature.id : generateId();

    if (geometry.type === 'Polygon') {
      const properties: AreaProps = {
        ...props,
        name: typeof props.name === 'string' ? props.name : undefined,
        type: remapAreaType(props.type),
        active: props.active !== false,
      };
      return [{type: 'Feature', id, geometry, properties} as AreaFeature];
    }

    if (geometry.type === 'LineString') {
      const properties: DockingStationFeatureProps = {
        type: 'docking_station',
        name: typeof props.name === 'string' ? props.name : undefined,
        active: props.active !== false,
        approach_distance: typeof props.approach_distance === 'number' ? props.approach_distance : 0,
      };
      return [{type: 'Feature', id, geometry, properties} as DockingStationFeature];
    }

    return [];
  });

  return featureCollection(features);
}

// Thrown when a save is attempted before the mower has reported its GPS datum.
// Saving against `fallbackDatum` would force the drawn points into the wrong UTM
// zone and produce out-of-range coordinates that geodesy rejects with a cryptic
// "invalid UTM easting" RangeError. Fail early with an actionable message instead.
export class MapDatumUnavailableError extends Error {
  constructor() {
    super('Cannot save the map yet: the mower has not reported its GPS datum. Wait for a GPS fix and try again.');
    this.name = 'MapDatumUnavailableError';
  }
}

export function featuresToMap(map: MapData, features: FeatureCollection) {
  if (!map.datum) {
    throw new MapDatumUnavailableError();
  }
  const datum = convertDatum(map.datum);
  return produce(map, (draft) => {
    draft.areas = features.features
      .filter((feature) => feature.geometry.type === 'Polygon')
      .map((feature) => featureToArea(feature as AreaFeature, datum));

    draft.docking_stations = featuresToDockingStations(features, datum);
  });
}

export function getFeatureDescription(feature: Feature) {
  const type = feature.geometry.type;
  const properties = feature.properties;

  if (properties?.name) {
    return `${type}: ${properties.name}`;
  }

  if (type === 'Polygon') {
    let subType = 'Polygon';
    if (properties?.type === 'mow') {
      subType = 'Working Area';
    } else if (properties?.type === 'nav') {
      subType = 'Navigation Area';
    }
    return `${subType} (${area(feature.geometry).toFixed(2)} m²)`;
  }

  if (type === 'LineString') {
    if (properties?.type === 'docking_station') {
      return 'Docking station';
    }
    const coordinates = feature.geometry.coordinates;
    return `LineString (${coordinates.length} points)`;
  }

  if (type === 'Point') {
    if (properties?.type === 'docking_station') {
      return 'Docking station';
    }
    return 'Point';
  }

  return type;
}
