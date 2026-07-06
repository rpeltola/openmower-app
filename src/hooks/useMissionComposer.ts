'use client';

import type {MissionComposerJob} from '@/components/map/mission/types';
import type {RelativePoint} from '@/utils/coordinates';
import {newAreaJob, newSpotJob} from '@/utils/mission-utils';
import {arrayMove} from '@dnd-kit/sortable';
import {useImmer} from 'use-immer';

// Holds the in-progress mission composition (job order + per-job direction/repeats) before it's
// published to mow_mission/start. Purely client-side state — see mission-utils for the conversion
// to the wire format.
export function useMissionComposer() {
  const [jobs, setJobs] = useImmer<MissionComposerJob[]>([]);

  const addAreaJob = (areaId: string, areaName: string) => {
    setJobs((draft) => {
      draft.push(newAreaJob(areaId, areaName));
    });
  };

  const addSpotJob = (polygon: RelativePoint[]) => {
    setJobs((draft) => {
      draft.push(newSpotJob(polygon));
    });
  };

  const removeJob = (id: string) => {
    setJobs((draft) => {
      const idx = draft.findIndex((job) => job.id === id);
      if (idx !== -1) draft.splice(idx, 1);
    });
  };

  const updateJob = (id: string, patch: Partial<Pick<MissionComposerJob, 'directionDeg' | 'repeats'>>) => {
    setJobs((draft) => {
      const job = draft.find((job) => job.id === id);
      if (job) Object.assign(job, patch);
    });
  };

  const reorderJobs = (activeId: string, overId: string) => {
    if (activeId === overId) return;
    setJobs((draft) => {
      const oldIndex = draft.findIndex((job) => job.id === activeId);
      const newIndex = draft.findIndex((job) => job.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      return arrayMove(draft, oldIndex, newIndex);
    });
  };

  const clearJobs = () => setJobs([]);

  return {jobs, addAreaJob, addSpotJob, removeJob, updateJob, reorderJobs, clearJobs};
}

export type MissionComposer = ReturnType<typeof useMissionComposer>;
