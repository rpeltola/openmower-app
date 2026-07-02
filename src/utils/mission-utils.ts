import type {MissionAreaJob, MissionComposerJob, MissionSpotJob} from '@/components/map/mission/types';
import type {Mission, MissionJob} from '@/stores/schemas';
import {generateId} from './area-utils';

export const DEFAULT_DIRECTION_DEG = 0;
export const DEFAULT_REPEATS = 1;
export const DIRECTION_PRESETS_DEG = [0, 45, 90, 135] as const;

export function newAreaJob(areaId: string, areaName: string): MissionAreaJob {
  return {
    id: generateId(),
    type: 'area',
    areaId,
    areaName,
    directionDeg: DEFAULT_DIRECTION_DEG,
    repeats: DEFAULT_REPEATS,
  };
}

export function newSpotJob(polygon: MissionSpotJob['polygon']): MissionSpotJob {
  return {
    id: generateId(),
    type: 'spot',
    polygon,
    directionDeg: DEFAULT_DIRECTION_DEG,
    repeats: DEFAULT_REPEATS,
  };
}

function toWireJob(job: MissionComposerJob): MissionJob {
  return job.type === 'area'
    ? {type: 'area', area_id: job.areaId, direction_deg: job.directionDeg, repeats: job.repeats}
    : {
        type: 'spot',
        polygon: job.polygon.map((p) => [p.x, p.y]),
        direction_deg: job.directionDeg,
        repeats: job.repeats,
      };
}

// Builds the exact `mow_mission/start` payload from the composer's job list (see
// OpenMowerNext sim_mow/MISSION_CONTRACT.md).
export function buildMissionPayload(jobs: MissionComposerJob[]): Mission {
  return {
    mission_id: generateId(),
    jobs: jobs.map(toWireJob),
  };
}

export function jobLabel(job: MissionComposerJob): string {
  return job.type === 'area' ? job.areaName : `Spot mow (${job.polygon.length} pts)`;
}
