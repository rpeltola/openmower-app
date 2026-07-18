import {exportMapGeoJson, geoJsonExportFilename, geoJsonToMapData, parseMapGeoJson} from '@/components/v2/map/geojsonIO';
import type {MapData} from '@/stores/schemas';
import {describe, expect, it} from 'vitest';

const SAMPLE_MAP: MapData = {
  datum: {lat: 60.9635, long: 25.3594, height: 0},
  areas: [
    {
      id: 'area-1',
      properties: {name: 'Etupiha', type: 'mow', active: true},
      outline: [
        {x: -5, y: -5},
        {x: 5, y: -5},
        {x: 5, y: 5},
        {x: -5, y: 5},
      ],
    },
  ],
  docking_stations: [
    {
      id: 'dock-1',
      properties: {name: 'Docking station', active: true},
      position: {x: -4, y: -4.5},
      heading: 1.2345,
      approach_distance: 0.6,
    },
  ],
};

describe('exportMapGeoJson', () => {
  it('serializes areas as Polygon features and docks as LineString features', () => {
    const geojson = exportMapGeoJson(SAMPLE_MAP);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(2);
    const [area, dock] = geojson.features;
    expect(area.geometry.type).toBe('Polygon');
    expect(area.properties?.name).toBe('Etupiha');
    expect(dock.geometry.type).toBe('LineString');
    expect(dock.properties?.type).toBe('docking_station');
    expect(dock.properties?.approach_distance).toBe(0.6);
  });
});

describe('geoJsonExportFilename', () => {
  it('produces a timestamped openmower-map-*.geojson name', () => {
    const name = geoJsonExportFilename(new Date('2026-07-18T12:34:56Z'));
    expect(name).toBe('openmower-map-20260718-123456.geojson');
  });
});

describe('parseMapGeoJson', () => {
  it('accepts a valid map GeoJSON FeatureCollection', () => {
    const text = JSON.stringify(exportMapGeoJson(SAMPLE_MAP));
    const result = parseMapGeoJson(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.features.features).toHaveLength(2);
  });

  it('rejects invalid JSON gracefully', () => {
    const result = parseMapGeoJson('{not json');
    expect(result).toEqual({ok: false, error: 'Not a valid JSON file.'});
  });

  it('rejects valid JSON that is not a FeatureCollection', () => {
    const result = parseMapGeoJson(JSON.stringify({hello: 'world'}));
    expect(result.ok).toBe(false);
  });

  it('rejects a FeatureCollection with no recognizable area/dock geometry', () => {
    const result = parseMapGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [{type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('drops unrecognized geometry types but keeps the recognizable ones', () => {
    const geojson = exportMapGeoJson(SAMPLE_MAP);
    const withStray = {
      ...geojson,
      features: [...geojson.features, {type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
    };
    const result = parseMapGeoJson(JSON.stringify(withStray));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.features.features).toHaveLength(2);
  });
});

describe('geoJsonToMapData', () => {
  it('round-trips exportMapGeoJson back to an equivalent MapData against the same datum', () => {
    const geojson = exportMapGeoJson(SAMPLE_MAP);
    const converted = geoJsonToMapData(SAMPLE_MAP, geojson);
    expect(converted.areas).toHaveLength(1);
    expect(converted.areas[0].properties.name).toBe('Etupiha');
    expect(converted.docking_stations).toHaveLength(1);
    expect(converted.docking_stations[0].heading).toBeCloseTo(1.2345, 5);
    expect(converted.docking_stations[0].approach_distance).toBe(0.6);
  });

  it('throws when the base map has no datum yet (cannot geolocate the import)', () => {
    const noDatumMap: MapData = {...SAMPLE_MAP, datum: undefined};
    const geojson = exportMapGeoJson(SAMPLE_MAP);
    expect(() => geoJsonToMapData(noDatumMap, geojson)).toThrow();
  });
});
