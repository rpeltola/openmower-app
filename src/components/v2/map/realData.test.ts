import {mapDataToDock, mapDataToZones, versionFeaturesToZonesAndDock, zonesToMapData} from '@/components/v2/map/realData';
import {MOCK_DOCK, type Dock, type Zone} from '@/components/v2/map/mockMap';
import type {MapData} from '@/stores/schemas';
import {mapToFeatures} from '@/utils/area-converter';
import {datumToRelative} from '@/utils/coordinates';
import {describe, expect, it} from 'vitest';

// W9 A2b's riskiest surface: the save/restore payload shape, and specifically that the real
// dock's `heading`/`approach_distance` (the schema-skew the integration plan flags -- v2's editor
// only shows/moves `position`) survive a load -> save round trip instead of being silently
// dropped or defaulted to 0.

const SAMPLE_MAP: MapData = {
  datum: {lat: 60.9635, long: 25.3594, height: 0},
  areas: [
    {
      id: 'area-1',
      properties: {name: 'Etupiha', type: 'mow', active: true, angle: 0.4, outline_count: 3, outline_overlap_count: 1, outline_offset: 0.1},
      outline: [
        {x: -5, y: -5},
        {x: 5, y: -5},
        {x: 5, y: 5},
        {x: -5, y: 5},
      ],
    },
    {
      id: 'area-2',
      properties: {name: 'Side path', type: 'nav', active: true},
      outline: [
        {x: 6, y: -5},
        {x: 8, y: -5},
        {x: 8, y: 5},
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
    // A second real dock the v2 editor can't see/edit -- must survive a save untouched.
    {
      id: 'dock-2',
      properties: {name: 'Spare dock', active: false},
      position: {x: 9, y: 9},
      heading: -0.5,
      approach_distance: 0.3,
    },
  ],
};

describe('mapDataToDock', () => {
  it('carries id/heading/approach_distance/name/active through, not just position', () => {
    const dock = mapDataToDock(SAMPLE_MAP);
    expect(dock).toEqual({
      id: 'dock-1',
      position: {x: -4, y: -4.5},
      heading: 1.2345,
      approach_distance: 0.6,
      name: 'Docking station',
      active: true,
    });
  });

  it('is undefined when the real map has no docking stations', () => {
    expect(mapDataToDock({...SAMPLE_MAP, docking_stations: []})).toBeUndefined();
  });
});

describe('zonesToMapData', () => {
  it('round-trips a real map through mapDataToZones/mapDataToDock -> zonesToMapData with no edits', () => {
    const zones = mapDataToZones(SAMPLE_MAP);
    const dock = mapDataToDock(SAMPLE_MAP)!;
    const saved = zonesToMapData(zones, dock, SAMPLE_MAP);

    expect(saved.datum).toEqual(SAMPLE_MAP.datum);
    expect(saved.areas).toHaveLength(2);
    expect(saved.areas[0]).toEqual(SAMPLE_MAP.areas[0]);
    expect(saved.areas[1].properties.type).toBe('nav');

    // The primary claim under test: heading + approach_distance are NOT dropped or zeroed.
    expect(saved.docking_stations[0]).toEqual(SAMPLE_MAP.docking_stations[0]);
  });

  it('preserves a second real dock the editor never touched (no silent multi-dock deletion)', () => {
    const dock = mapDataToDock(SAMPLE_MAP)!;
    const saved = zonesToMapData([], dock, SAMPLE_MAP);
    expect(saved.docking_stations).toHaveLength(2);
    expect(saved.docking_stations[1]).toEqual(SAMPLE_MAP.docking_stations[1]);
  });

  it('moving the dock (position-only patch, as MapCanvas emits on drag-end) keeps heading/approach_distance', () => {
    const dock = mapDataToDock(SAMPLE_MAP)!;
    // Mirrors Map.tsx's onDockChange merge: {...editor.dock, ...next} where `next` is {position} only.
    const moved: Dock = {...dock, position: {x: 1, y: 2}};
    const saved = zonesToMapData([], moved, SAMPLE_MAP);
    expect(saved.docking_stations[0]).toEqual({
      id: 'dock-1',
      properties: {name: 'Docking station', active: true},
      position: {x: 1, y: 2},
      heading: 1.2345,
      approach_distance: 0.6,
    });
  });

  it('defaults heading/approach_distance to 0 and mints an id for a dock that was never loaded from a real map', () => {
    const saved = zonesToMapData([], MOCK_DOCK);
    expect(saved.docking_stations[0].heading).toBe(0);
    expect(saved.docking_stations[0].approach_distance).toBe(0);
    expect(typeof saved.docking_stations[0].id).toBe('string');
    expect(saved.docking_stations[0].id.length).toBeGreaterThan(0);
    expect(saved.datum).toBeUndefined();
  });

  it("collapses the v2-only 'spot' zone type to 'mow' (no backend equivalent)", () => {
    const spotZone: Zone = {id: 'spot-1', name: 'Patch', type: 'spot', outline: [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]};
    const saved = zonesToMapData([spotZone], MOCK_DOCK);
    expect(saved.areas[0].properties.type).toBe('mow');
  });

  it('carries per-area mowing overrides (angle/outline_count/outline_overlap_count/outline_offset)', () => {
    const zones = mapDataToZones(SAMPLE_MAP);
    const dock = mapDataToDock(SAMPLE_MAP)!;
    const saved = zonesToMapData(zones, dock, SAMPLE_MAP);
    expect(saved.areas[0].properties.angle).toBe(0.4);
    expect(saved.areas[0].properties.outline_count).toBe(3);
    expect(saved.areas[0].properties.outline_overlap_count).toBe(1);
    expect(saved.areas[0].properties.outline_offset).toBe(0.1);
  });
});

describe('versionFeaturesToZonesAndDock (restore/preview)', () => {
  it('converts a fetched map-version geojson payload back to Zone[]/Dock with heading/approach_distance intact', () => {
    // Simulate `query/mapversion`'s stored geojson: project the SAME sample map to absolute
    // lon/lat features (mapToFeatures, the same shape a real stored version's `geojson` field
    // decodes to), then run it through the real restore path.
    const features = mapToFeatures(SAMPLE_MAP);
    const datum = datumToRelative([SAMPLE_MAP.datum!.long, SAMPLE_MAP.datum!.lat]);

    const {zones, dock} = versionFeaturesToZonesAndDock(features, datum);

    expect(zones).toHaveLength(2);
    const mowZone = zones.find((z) => z.name === 'Etupiha');
    expect(mowZone?.type).toBe('mow');
    expect(mowZone?.outline[0].x).toBeCloseTo(-5, 6);
    expect(mowZone?.outline[0].y).toBeCloseTo(-5, 6);

    expect(dock?.approach_distance).toBe(0.6);
    expect(dock?.heading).toBeCloseTo(1.2345, 5);
  });
});
