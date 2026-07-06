import {AreaProps} from '@/stores/schemas';
import {Feature, FeatureCollection, LineString, Polygon} from 'geojson';

export type AreaFeature = Feature<Polygon, AreaProps>;
export type AreaFeatureCollection = FeatureCollection<Polygon, AreaProps>;

// Docking stations are drawn as a 2-point LineString (origin + a synthetic point 0.5m
// along the heading), matching the backend's on-disk GeoJSON convention (see
// OpenMowerNext src/map_server/geo_json_map.cpp dockingStationToGeoJSONFeature /
// parseLineStringFeature) -- GeoJSON has no native oriented-point type.
export type DockingStationFeatureProps = {
  type: 'docking_station';
  name?: string;
  active: boolean;
  approach_distance: number;
};
export type DockingStationFeature = Feature<LineString, DockingStationFeatureProps>;
