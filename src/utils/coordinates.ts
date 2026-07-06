import {LatLon, default as Utm} from 'geodesy/utm.js';

export type RelativePoint = {x: number; y: number};
export type AbsolutePoint = [longitude: number, latitude: number];
export type UtmPoint = Utm;

export function datumToRelative(absolute: AbsolutePoint): UtmPoint {
  return new LatLon(absolute[1], absolute[0]).toUtm();
}

export function pointToAbsolute(point: RelativePoint, datum: UtmPoint): AbsolutePoint | null {
  // A single corrupt/out-of-datum point (e.g. stale track history from a
  // different map/datum) must NOT crash the whole map: geodesy throws
  // "invalid UTM easting/northing" for out-of-range values. Guard + drop it.
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  try {
    const {latitude, longitude} = new Utm(
      datum.zone,
      datum.hemisphere,
      datum.easting + point.x,
      datum.northing + point.y,
    ).toLatLon();
    return [longitude, latitude];
  } catch {
    return null;
  }
}

export function pointToRelative(point: AbsolutePoint, datum: UtmPoint): RelativePoint {
  const utmPoint = new LatLon(point[1], point[0]).toUtm(datum.zone);
  return {x: utmPoint.easting - datum.easting, y: utmPoint.northing - datum.northing};
}

export function pointsToAbsolute(points: RelativePoint[], datum: UtmPoint): AbsolutePoint[] {
  return points
    .map((point) => pointToAbsolute(point, datum))
    .filter((p): p is AbsolutePoint => p !== null);
}

export function pointsToRelative(points: AbsolutePoint[], datum: UtmPoint): RelativePoint[] {
  return points.map((point) => pointToRelative(point, datum));
}

// Project a point `distance` metres along `heading` (radians, 0 = +x/east, CCW positive --
// the same convention the gateway's quat_to_yaw / DockingStationMarker use). Mirrors
// OpenMowerNext's GeoJSONMap::movePointTowardsOrientation (origin + distance*(cos, sin)),
// used to encode a docking station's heading as a synthetic second LineString point.
export function movePointTowardsHeading(point: RelativePoint, heading: number, distance: number): RelativePoint {
  return {
    x: point.x + distance * Math.cos(heading),
    y: point.y + distance * Math.sin(heading),
  };
}
