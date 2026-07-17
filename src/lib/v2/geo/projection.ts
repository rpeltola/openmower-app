// Equirectangular (flat-earth) projection around a datum origin — ported from the community
// RevLaw editor's geo/projection.js (which itself is OpenMower's original), so maps round-trip
// identically. Valid only for small local areas (the OpenMower garden use case).
//
// Frame: OpenMower local ENU — x = east (m), y = north (m). ROS base_link yaw (`heading`) is
// radians CCW from +x (east). Datum lat/long from the gateway.

const METERS_PER_DEG_LAT = 111320;

export interface LatLng {
  lat: number;
  lng: number;
}
export interface Meters {
  x: number;
  y: number;
}
export interface Origin {
  lat: number;
  lng: number;
}

/** Local metric point (x east, y north) → [lat, lng]. */
export function metersToLatLng({x, y}: Meters, origin: Origin): [number, number] {
  const lat = origin.lat + y / METERS_PER_DEG_LAT;
  const lng = origin.lng + x / (METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180));
  return [lat, lng];
}

/** [lat, lng] → local metric point (x east, y north). */
export function latLngToMeters({lat, lng}: LatLng, origin: Origin): Meters {
  const x = (lng - origin.lng) * (METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180));
  const y = (lat - origin.lat) * METERS_PER_DEG_LAT;
  return {x, y};
}

export interface Pose {
  x: number;
  y: number;
  /** yaw, radians CCW from +x (east). */
  heading: number;
}
/** Robot footprint in base_link: +x ahead (front/charge port), −x behind, ±half_width to each side. */
export interface Footprint {
  front_m: number;
  rear_m: number;
  half_width_m: number;
}

/** Rotate a base-frame offset by heading and translate to the pose, in local meters. */
function bodyToWorld(bx: number, by: number, pose: Pose): Meters {
  const c = Math.cos(pose.heading);
  const s = Math.sin(pose.heading);
  return {x: pose.x + bx * c - by * s, y: pose.y + bx * s + by * c};
}

/**
 * The robot's TO-SCALE footprint as a georeferenced polygon ([lat,lng] ring) — sized in real
 * metres from the gateway footprint and rotated by heading, so it scales with zoom and shows the
 * robot's real size + position (never a fixed-pixel icon). Corners: front-left, front-right,
 * rear-right, rear-left (base_link: x fwd, y left).
 */
export function footprintPolygon(pose: Pose, fp: Footprint, origin: Origin): [number, number][] {
  const corners: [number, number][] = [
    [fp.front_m, fp.half_width_m],
    [fp.front_m, -fp.half_width_m],
    [-fp.rear_m, -fp.half_width_m],
    [-fp.rear_m, fp.half_width_m],
  ];
  return corners.map(([bx, by]) => metersToLatLng(bodyToWorld(bx, by, pose), origin));
}

/** A short heading "nose" segment from the front-centre outward, for direction at a glance. */
export function headingNose(pose: Pose, fp: Footprint, origin: Origin): [number, number][] {
  const base = bodyToWorld(fp.front_m * 0.45, 0, pose);
  const tip = bodyToWorld(fp.front_m + fp.half_width_m * 0.7, 0, pose);
  return [metersToLatLng(base, origin), metersToLatLng(tip, origin)];
}
