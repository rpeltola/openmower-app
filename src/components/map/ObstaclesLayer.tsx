'use client';

import type {DiscoveredObstacle, Datum} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute, type AbsolutePoint} from '@/utils/coordinates';
import {featureCollection, point, polygon} from '@turf/helpers';
import type {Feature, FeatureCollection, Point, Polygon} from 'geojson';
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import {RLayer, RSource} from 'maplibre-react-components';
import {useMemo} from 'react';

type ObstacleProps = {policy: string; permanent: boolean; hit_count: number};

const emptyPolygons: FeatureCollection<Polygon, ObstacleProps> = featureCollection([]);
const emptyPoints: FeatureCollection<Point, ObstacleProps> = featureCollection([]);

// Distinct from the (grey) user-drawn `obstacle` area type in AreaItem's TYPE_CONFIG -- these
// are things the mower found itself. Colour reads as severity: amber for the two "avoid" tiers
// (avoid_wide a touch stronger than avoid_tight), a hard red for no_touch, neutral grey for an
// unrecognized/unknown policy.
const POLICY_COLOR_EXPR: ExpressionSpecification = [
  'match',
  ['get', 'policy'],
  'avoid_tight',
  '#FFA000',
  'avoid_wide',
  '#FB8C00',
  'no_touch',
  '#E53935',
  '#9E9E9E',
];

interface ObstaclesLayerProps {
  visible?: boolean;
  datum: Datum | null;
  obstacles: DiscoveredObstacle[];
}

/**
 * Discovered-obstacles layer: renders obstacles the mower found by contact/sensing (obstacles/json)
 * as filled footprint polygons plus a small centre marker, coloured by their avoidance policy.
 * Permanent obstacles render more solidly than transient ones. Coordinates are map-local metres,
 * the same frame as area outlines, so this reuses the same datum-relative projection.
 */
export default function ObstaclesLayer({visible = true, datum, obstacles}: ObstaclesLayerProps) {
  const {polygons, points} = useMemo(() => {
    if (!datum || obstacles.length === 0) return {polygons: emptyPolygons, points: emptyPoints};
    const utm = datumToRelative([datum.long, datum.lat]);

    const polygonFeatures: Feature<Polygon, ObstacleProps>[] = [];
    const pointFeatures: Feature<Point, ObstacleProps>[] = [];
    for (const obstacle of obstacles) {
      const props: ObstacleProps = {
        policy: obstacle.policy,
        permanent: obstacle.permanent,
        hit_count: obstacle.hit_count,
      };

      const ring = obstacle.footprint
        .map((p) => pointToAbsolute(p, utm))
        .filter((p): p is AbsolutePoint => p !== null);
      if (ring.length >= 3) {
        const closedRing = ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring : [...ring, ring[0]];
        polygonFeatures.push(polygon([closedRing], props));
      }

      const centerAbs = pointToAbsolute(obstacle.center, utm);
      if (centerAbs) pointFeatures.push(point(centerAbs, props));
    }
    return {polygons: featureCollection(polygonFeatures), points: featureCollection(pointFeatures)};
  }, [obstacles, datum]);

  const visibility = visible ? 'visible' : 'none';

  const fillPaint: FillLayerSpecification['paint'] = {
    'fill-color': POLICY_COLOR_EXPR,
    'fill-opacity': ['case', ['==', ['get', 'permanent'], true], 0.45, 0.25],
  };
  const linePaint: LineLayerSpecification['paint'] = {
    'line-color': POLICY_COLOR_EXPR,
    'line-width': ['case', ['==', ['get', 'permanent'], true], 2, 1.5],
    'line-dasharray': ['case', ['==', ['get', 'permanent'], true], ['literal', [1, 0]], ['literal', [2, 1]]],
  };
  const centerPaint: CircleLayerSpecification['paint'] = {
    'circle-color': POLICY_COLOR_EXPR,
    'circle-radius': 4,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1.5,
  };
  // Hit count only earns a label once it's actually informative (repeat contacts).
  const labelLayout: SymbolLayerSpecification['layout'] = {
    'text-field': ['case', ['>', ['get', 'hit_count'], 1], ['to-string', ['get', 'hit_count']], ''],
    'text-size': 11,
    'text-offset': [0, -1.2],
    'text-allow-overlap': true,
    visibility,
  };
  const labelPaint: SymbolLayerSpecification['paint'] = {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 1,
  };

  return (
    <>
      <RSource id="obstacles-fill-source" type="geojson" data={polygons} />
      <RLayer
        id="obstacles-fill-layer"
        source="obstacles-fill-source"
        type="fill"
        layout={{visibility}}
        paint={fillPaint}
      />
      <RLayer
        id="obstacles-line-layer"
        source="obstacles-fill-source"
        type="line"
        layout={{visibility, 'line-join': 'round', 'line-cap': 'round'}}
        paint={linePaint}
      />
      <RSource id="obstacles-points-source" type="geojson" data={points} />
      <RLayer
        id="obstacles-center-layer"
        source="obstacles-points-source"
        type="circle"
        layout={{visibility}}
        paint={centerPaint}
      />
      <RLayer
        id="obstacles-label-layer"
        source="obstacles-points-source"
        type="symbol"
        layout={labelLayout}
        paint={labelPaint}
      />
    </>
  );
}
