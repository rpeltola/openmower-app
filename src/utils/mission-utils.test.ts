import {buildMissionPayload, jobLabel, newAreaJob, newSpotJob} from '@/utils/mission-utils';
import {missionSchema} from '@/stores/schemas';
import {describe, expect, it} from 'vitest';

// mission-utils.ts is reused as-is from the v1 port (ROS/MUI-free) — these tests pin the exact
// `mow_mission/start|add` wire shape (see OpenMowerNext sim_mow/MISSION_CONTRACT.md) so the v2
// composer can't silently drift from the backend contract.

describe('newAreaJob / newSpotJob', () => {
  it('seeds default direction/repeats and a stable id', () => {
    const job = newAreaJob('etupiha', 'Etupiha');
    expect(job.type).toBe('area');
    expect(job.areaId).toBe('etupiha');
    expect(job.areaName).toBe('Etupiha');
    expect(job.directionDeg).toBe(0);
    expect(job.repeats).toBe(1);
    expect(job.id).toHaveLength(32);
  });

  it('spot jobs carry the drawn polygon through untouched', () => {
    const polygon = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}];
    const job = newSpotJob(polygon);
    expect(job.type).toBe('spot');
    expect(job.polygon).toEqual(polygon);
  });
});

describe('buildMissionPayload', () => {
  it('builds the mow_mission/start wire shape from an ordered job list', () => {
    const jobs = [
      {...newAreaJob('etupiha', 'Etupiha'), directionDeg: 45, repeats: 3},
      {...newSpotJob([{x: 0, y: 0}, {x: 2, y: 0}, {x: 2, y: 2}]), directionDeg: 90, repeats: 2},
    ];
    const mission = buildMissionPayload(jobs);

    expect(mission.jobs).toEqual([
      {type: 'area', area_id: 'etupiha', direction_deg: 45, repeats: 3},
      {
        type: 'spot',
        polygon: [
          [0, 0],
          [2, 0],
          [2, 2],
        ],
        direction_deg: 90,
        repeats: 2,
      },
    ]);
    // area outline points are {x, y} objects; the wire polygon is [x, y] tuples (schema-enforced).
    expect(missionSchema.safeParse(mission).success).toBe(true);
  });

  it('mints a fresh mission_id for a Start, but reuses the given id for an Add', () => {
    const jobs = [newAreaJob('etupiha', 'Etupiha')];
    const started = buildMissionPayload(jobs);
    const added = buildMissionPayload(jobs, 'running-mission-id');

    expect(started.mission_id).toHaveLength(32);
    expect(added.mission_id).toBe('running-mission-id');
  });
});

describe('jobLabel', () => {
  it('labels an area job by its name and a spot job by its point count', () => {
    expect(jobLabel(newAreaJob('etupiha', 'Etupiha'))).toBe('Etupiha');
    expect(jobLabel(newSpotJob([{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]))).toBe('Spot mow (3 pts)');
  });
});
