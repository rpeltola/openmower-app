import {fallbackDatum, type Area, type AreaProps, type MapData} from '@/stores/schemas';
import type {AreaFeature} from '@/types/geojson';
import {
  datumToRelative,
  pointsToAbsolute,
  pointsToRelative,
  type AbsolutePoint,
  type RelativePoint,
  type UtmPoint,
} from '@/utils/coordinates';
import area from '@turf/area';
import {featureCollection, polygon} from '@turf/helpers';
import type {Feature, FeatureCollection, Polygon} from 'geojson';
import {produce} from 'immer';

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

function convertDatum(datum: {lat: number; long: number}) {
  return datumToRelative([datum.long, datum.lat]);
}

export function mapToFeatures(map?: MapData): FeatureCollection {
  if (!map) {
    return featureCollection([]);
  }
  const datum = convertDatum(map.datum ?? fallbackDatum);
  const features = map.areas
    .map((area) => areaToFeature(area, datum))
    .filter((f): f is Feature<Polygon, AreaProps> => f !== null);
  return featureCollection(features);
}

export function featuresToMap(map: MapData, features: FeatureCollection) {
  const datum = convertDatum(map.datum ?? fallbackDatum);
  return produce(map, (draft) => {
    draft.areas = features.features
      .filter((feature) => feature.geometry.type === 'Polygon')
      .map((feature) => featureToArea(feature as AreaFeature, datum));

    // TODO: Convert docking stations (but we don't say the orientation, so we can't convert them back).
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
