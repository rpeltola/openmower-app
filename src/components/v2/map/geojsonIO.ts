// GeoJSON import/export for the map — v1 reference: DownloadButton.tsx/UploadButton.tsx/
// UploadModal.tsx (src/components/map/edit/), which round-trip through the SAME area-converter.ts
// conversion this reuses (mapToFeatures/featuresToMap), just presented on a file input/download
// link instead of Mapbox Draw. Kept ROS-free/pure (no MQTT, no rpc) so parsing/validation is
// unit-testable headlessly — Map.tsx wires the file-picker + confirm dialog + `rpc.map.replace`
// call around these.
import {featuresToMap, mapToFeatures, MapDatumUnavailableError} from '@/utils/area-converter';
import type {MapData} from '@/stores/schemas';
import type {FeatureCollection} from 'geojson';
import {z} from 'zod/v4';

/** Serializes the mower's current map (areas + docking stations) to a GeoJSON FeatureCollection
 *  for download — same shape (absolute WGS84 lon/lat, area Polygons + 2-point dock LineStrings)
 *  the backend's own map.geojson and v1's DownloadButton produce. */
export function exportMapGeoJson(map: MapData): FeatureCollection {
  return mapToFeatures(map);
}

// Timestamped filename, same convention as v1's DownloadButton (openmower-map-<ts>.geojson).
export function geoJsonExportFilename(now: Date = new Date()): string {
  const ts = now.toISOString().replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*/, '$1$2$3-$4$5$6');
  return `openmower-map-${ts}.geojson`;
}

// A deliberately loose structural check — not a full GeoJSON spec validator — just enough to
// reject non-GeoJSON/garbage JSON gracefully before it reaches area-converter.ts's conversion
// (which assumes valid Polygon/LineString geometries). looseObject (same as schemas.ts's own
// convention) so unknown/extra fields (bbox, foreign members, id, ...) don't fail validation.
const geoJsonFeatureSchema = z.looseObject({
  type: z.literal('Feature'),
  geometry: z.looseObject({
    type: z.enum(['Polygon', 'LineString', 'Point']),
    coordinates: z.array(z.unknown()),
  }),
  properties: z.record(z.string(), z.unknown()).nullable().optional(),
});

const geoJsonFeatureCollectionSchema = z.looseObject({
  type: z.literal('FeatureCollection'),
  features: z.array(geoJsonFeatureSchema),
});

export type GeoJsonParseResult = {ok: true; features: FeatureCollection} | {ok: false; error: string};

/** Parses + lightly validates an uploaded file's text as a map GeoJSON FeatureCollection. Never
 *  throws — every failure mode (invalid JSON, wrong top-level type, no recognizable area/dock
 *  features) returns an `{ok: false, error}` the caller can toast, so a malformed file degrades
 *  gracefully instead of crashing the import flow. */
export function parseMapGeoJson(text: string): GeoJsonParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {ok: false, error: 'Not a valid JSON file.'};
  }

  const parsed = geoJsonFeatureCollectionSchema.safeParse(raw);
  if (!parsed.success) {
    return {ok: false, error: 'Not a valid GeoJSON FeatureCollection.'};
  }

  const usable = parsed.data.features.filter((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'LineString');
  if (usable.length === 0) {
    return {ok: false, error: 'No areas or docking stations found in this file.'};
  }

  return {ok: true, features: {type: 'FeatureCollection', features: usable} as FeatureCollection};
}

/** Converts validated GeoJSON features into a real MapData against the mower's current datum
 *  (area-converter.ts's featuresToMap — the same conversion the backend's own map save path
 *  uses). Throws MapDatumUnavailableError if `baseMap` has no datum yet; the caller should catch
 *  that alongside any other conversion error and toast it (see Map.tsx's import handler). */
export function geoJsonToMapData(baseMap: MapData, features: FeatureCollection): MapData {
  return featuresToMap(baseMap, features);
}

export {MapDatumUnavailableError};
