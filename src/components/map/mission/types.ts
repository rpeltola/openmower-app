import type {RelativePoint} from '@/utils/coordinates';

// Client-side mission composer job — kept in map-frame metres per the mission contract, with a
// stable `id` for list reordering/removal that isn't part of the wire format.
interface MissionJobBase {
  id: string;
  directionDeg: number;
  repeats: number;
}

export interface MissionAreaJob extends MissionJobBase {
  type: 'area';
  areaId: string;
  areaName: string;
}

export interface MissionSpotJob extends MissionJobBase {
  type: 'spot';
  polygon: RelativePoint[];
}

export type MissionComposerJob = MissionAreaJob | MissionSpotJob;
