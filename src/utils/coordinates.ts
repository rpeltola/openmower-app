export type RelativePoint = {x: number; y: number};
export type AbsolutePoint = [longitude: number, latitude: number];

// WGS84 ellipsoid.
const WGS84_A = 6378137.0; // semi-major axis (m)
const WGS84_F = 1 / 298.257223563; // flattening
const WGS84_E2 = WGS84_F * (2 - WGS84_F); // first eccentricity squared
const DEG = Math.PI / 180;

/**
 * A local ENU tangent frame about the GPS datum.
 *
 * Local x/y (track, areas, docks, planned path, heatmap, events) are metres EAST/NORTH
 * of the datum in the ROS `map` frame, which the OpenMowerNext backend defines with
 * GeographicLib's `LocalCartesian(datum_lat, datum_lon, 0)` (see map_server/geo_json_map.cpp).
 * We project with the SAME local-tangent model here so the app renders those points at the
 * true-world lon/lat the stored map versions were baked to.
 *
 * (The previous implementation projected via UTM, which differs from LocalCartesian by the
 * meridian-convergence rotation + UTM point-scale factor -- a discrepancy that is zero at the
 * datum and GROWS with distance from it. On the live map that cancelled out because BOTH the
 * areas and the track went through the same UTM projection, but on the History page the stored
 * map version is absolute WGS84 while the replay track was UTM-projected, so the two disagreed
 * and the replayed path drew visibly offset -- rotated about the datum -- from the map. See
 * openmower_knowledgebase.)
 *
 * The `x`/`y` metres-per-degree scale factors are precomputed from the ellipsoid's radii of
 * curvature at the datum latitude; over a garden (hundreds of metres) this tangent-plane
 * approximation matches GeographicLib's exact ellipsoidal LocalCartesian to well under a
 * millimetre.
 */
export type LocalFrame = {
  lat0: number; // datum latitude (deg)
  lon0: number; // datum longitude (deg)
  metresPerDegLat: number; // metres per degree of latitude at the datum
  metresPerDegLon: number; // metres per degree of longitude at the datum
};

// Kept as an alias so existing `UtmPoint` imports keep compiling -- the handle is opaque to
// every call site (none read its fields), only produced by datumToRelative and threaded back
// into the point<->coordinate helpers.
export type UtmPoint = LocalFrame;

export function datumToRelative(absolute: AbsolutePoint): LocalFrame {
  const [lon0, lat0] = absolute;
  const sinLat = Math.sin(lat0 * DEG);
  const denom = 1 - WGS84_E2 * sinLat * sinLat;
  const meridionalRadius = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 1.5); // M
  const primeVerticalRadius = WGS84_A / Math.sqrt(denom); // N
  return {
    lat0,
    lon0,
    metresPerDegLat: meridionalRadius * DEG,
    metresPerDegLon: primeVerticalRadius * Math.cos(lat0 * DEG) * DEG,
  };
}

export function pointToAbsolute(point: RelativePoint, datum: LocalFrame): AbsolutePoint | null {
  // A single corrupt/out-of-datum point (e.g. stale track history from a different map/datum)
  // must NOT crash the whole map -- drop anything non-finite or off the valid lon/lat domain.
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  const longitude = datum.lon0 + point.x / datum.metresPerDegLon;
  const latitude = datum.lat0 + point.y / datum.metresPerDegLat;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  return [longitude, latitude];
}

export function pointToRelative(point: AbsolutePoint, datum: LocalFrame): RelativePoint {
  return {
    x: (point[0] - datum.lon0) * datum.metresPerDegLon,
    y: (point[1] - datum.lat0) * datum.metresPerDegLat,
  };
}

export function pointsToAbsolute(points: RelativePoint[], datum: LocalFrame): AbsolutePoint[] {
  return points
    .map((point) => pointToAbsolute(point, datum))
    .filter((p): p is AbsolutePoint => p !== null);
}

export function pointsToRelative(points: AbsolutePoint[], datum: LocalFrame): RelativePoint[] {
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
