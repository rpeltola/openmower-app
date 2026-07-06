import type {HeatmapMetric} from '@/stores/schemas';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';

interface MapDisplayStore {
  showSatelliteLayer: boolean;
  showTrackLayer: boolean;
  showPlannedPath: boolean;
  showAreaList: boolean;
  selectedJobId: string | null;
  // null = heatmap overlay off. See query/heatmap in persistence/DESIGN.md's MQTT contract.
  heatmapMetric: HeatmapMetric | null;
  setShowSatelliteLayer: (v: boolean) => void;
  setShowTrackLayer: (v: boolean) => void;
  setShowPlannedPath: (v: boolean) => void;
  setShowAreaList: (v: boolean) => void;
  setSelectedJobId: (v: string | null) => void;
  setHeatmapMetric: (v: HeatmapMetric | null) => void;
}

export const useMapDisplayStore = create<MapDisplayStore>()(
  persist(
    (set) => ({
      showSatelliteLayer: false,
      showTrackLayer: true,
      showPlannedPath: true,
      showAreaList: true,
      selectedJobId: null,
      heatmapMetric: null,
      setShowSatelliteLayer: (v) => set({showSatelliteLayer: v}),
      setShowTrackLayer: (v) => set({showTrackLayer: v}),
      setShowPlannedPath: (v) => set({showPlannedPath: v}),
      setShowAreaList: (v) => set({showAreaList: v}),
      setSelectedJobId: (v) => set({selectedJobId: v}),
      setHeatmapMetric: (v) => set({heatmapMetric: v}),
    }),
    {name: 'map-display'},
  ),
);
