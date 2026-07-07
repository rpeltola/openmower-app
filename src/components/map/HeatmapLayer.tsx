'use client';

import type {Datum, HeatmapCell} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute, type AbsolutePoint} from '@/utils/coordinates';
import {featureCollection, polygon} from '@turf/helpers';
import type {FeatureCollection, Polygon} from 'geojson';
import type {FillLayerSpecification} from 'maplibre-gl';
import {RLayer, RSource} from 'maplibre-react-components';
import {useMemo} from 'react';

interface HeatmapLayerProps {
  visible: boolean;
  cells: HeatmapCell[];
  cellSize: number;
  datum: Datum;
  /** When true, a high reading is the "good" end -- invert the ramp so low readings (the
   * alarming end) render in HIGH_COLOR instead of high readings. */
  higherIsBetter?: boolean;
}

const emptyCollection: FeatureCollection<Polygon> = featureCollection([]);

// A single-hue sequential ramp (light -> dark), per the dataviz convention for magnitude:
// one hue, never a rainbow. Renders fine over both the "white" and "satellite" basemap
// styles regardless of the app's own light/dark theme.
const LOW_COLOR = '#dbeeff';
const HIGH_COLOR = '#0b3d91';

/** Coverage heatmap overlay: one colored square per 0.25m grid cell (see heatmap_cell /
 * query/heatmap in persistence/DESIGN.md), normalized to the current cell range. */
export default function HeatmapLayer({visible, cells, cellSize, datum, higherIsBetter}: HeatmapLayerProps) {
  const data = useMemo(() => {
    if (cells.length === 0) return emptyCollection;
    const utmDatum = datumToRelative([datum.long, datum.lat]);
    const values = cells.map((cell) => cell.mean);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const features = cells.flatMap((cell) => {
      const corners: [number, number][] = [
        [cell.x * cellSize, cell.y * cellSize],
        [(cell.x + 1) * cellSize, cell.y * cellSize],
        [(cell.x + 1) * cellSize, (cell.y + 1) * cellSize],
        [cell.x * cellSize, (cell.y + 1) * cellSize],
      ];
      const ring = corners
        .map(([x, y]) => pointToAbsolute({x, y}, utmDatum))
        .filter((p): p is AbsolutePoint => p !== null);
      if (ring.length < 4) return [];

      const closedRing = [...ring, ring[0]];
      const normalized = (cell.mean - min) / range;
      const norm = higherIsBetter ? 1 - normalized : normalized;
      return [polygon([closedRing], {norm, mean: cell.mean, count: cell.count})];
    });
    return featureCollection(features);
  }, [cells, cellSize, datum, higherIsBetter]);

  const paint: FillLayerSpecification['paint'] = {
    'fill-color': ['interpolate', ['linear'], ['get', 'norm'], 0, LOW_COLOR, 1, HIGH_COLOR],
    'fill-opacity': 0.6,
  };

  return (
    <>
      <RSource id="heatmap-source" type="geojson" data={data} />
      <RLayer
        id="heatmap-layer"
        source="heatmap-source"
        type="fill"
        layout={{visibility: visible ? 'visible' : 'none'}}
        paint={paint}
      />
    </>
  );
}

export const HEATMAP_LEGEND_COLORS = {low: LOW_COLOR, high: HIGH_COLOR};
