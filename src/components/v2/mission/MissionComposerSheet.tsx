'use client';

import type {MissionComposerJob} from '@/components/map/mission/types';
import {Button} from '@/components/v2/ui/Button';
import {ListRow} from '@/components/v2/ui/ListRow';
import {Sheet} from '@/components/v2/ui/Sheet';
import type {MissionState} from '@/stores/schemas';
import {closestCenter, DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors} from '@dnd-kit/core';
import {restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {Play, Plus, X} from 'lucide-react';
import {MissionProgress} from './MissionProgress';
import {SortableMissionJobRow} from './SortableMissionJobRow';

// A mission is "in progress" while it's running OR paused-but-preserved — see MissionPanel.tsx (v1).
const ACTIVE_STATES = new Set<MissionState['state']>(['queued', 'planning', 'mowing', 'paused']);

export interface MissionAreaOption {
  id: string;
  name: string;
}

export interface MissionComposerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Saved areas (mowable zones — mow + spot) the "Add to mission" list offers. */
  areas: MissionAreaOption[];
  jobs: MissionComposerJob[];
  onAddAreaJob: (areaId: string, areaName: string) => void;
  onRemoveJob: (id: string) => void;
  onUpdateJob: (id: string, patch: Partial<Pick<MissionComposerJob, 'directionDeg' | 'repeats'>>) => void;
  onReorderJobs: (activeId: string, overId: string) => void;
  onClearJobs: () => void;
  missionState: MissionState | null;
  onStart: () => void;
  onAdd: () => void;
  onContinue: () => void;
  onCancel: () => void;
  /** No mower selected — every action below is a no-op. */
  disabled?: boolean;
}

// Kit port of v1's MissionPanel — the multi-area ordered mow-job queue: pick saved areas, order
// them (drag-reorder), set per-job direction + repeats, then Start/Add/Continue/Cancel against the
// real mow_mission/* wire protocol (buildMissionPayload + Mower.publishMission* — owned by the
// caller, this component is presentational so the composer logic stays unit-testable without a
// mounted map/store, same pattern as MapVersioning.tsx's SaveMapSheet/VersionHistorySheet).
export function MissionComposerSheet({
  open,
  onClose,
  areas,
  jobs,
  onAddAreaJob,
  onRemoveJob,
  onUpdateJob,
  onReorderJobs,
  onClearJobs,
  missionState,
  onStart,
  onAdd,
  onContinue,
  onCancel,
  disabled = false,
}: MissionComposerSheetProps) {
  const missionInProgress = missionState !== null && ACTIVE_STATES.has(missionState.state);
  const resumable = missionState?.state === 'paused';

  const sensors = useSensors(
    useSensor(MouseSensor, {activationConstraint: {distance: 5}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 250, tolerance: 8}}),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (over?.id !== undefined) onReorderJobs(active.id as string, over.id as string);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Mission" className="max-h-[85dvh]">
      <div className="space-y-1">
        <div className="text-[.68rem] font-semibold uppercase tracking-wide text-ink-faint">Add to mission</div>
        {areas.length === 0 ? (
          <div className="px-1 py-1.5 text-[.8rem] text-ink-soft">No mowing areas saved.</div>
        ) : (
          areas.map((area) => (
            <ListRow
              key={area.id}
              title={area.name}
              trailing={<Plus size={16} className="text-ink-faint" />}
              onClick={() => onAddAreaJob(area.id, area.name)}
            />
          ))
        )}
      </div>

      <div className="rounded-[var(--radius-card)] border border-border">
        {jobs.length === 0 ? (
          <div className="p-3 text-[.8rem] text-ink-soft">
            {missionInProgress
              ? 'Add a saved area to append it to the running mission.'
              : 'Add a saved area above to build an ordered mission.'}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
              {jobs.map((job, index) => (
                <SortableMissionJobRow
                  key={job.id}
                  index={index}
                  job={job}
                  onChange={(patch) => onUpdateJob(job.id, patch)}
                  onRemove={() => onRemoveJob(job.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex items-center gap-2">
        {missionInProgress ? (
          <Button variant="primary" className="flex-1 justify-center" disabled={disabled || jobs.length === 0} onClick={onAdd}>
            <Plus size={15} /> Add to mission
          </Button>
        ) : (
          <Button variant="primary" className="flex-1 justify-center" disabled={disabled || jobs.length === 0} onClick={onStart}>
            <Play size={15} fill="currentColor" /> Start mission
          </Button>
        )}
        {resumable && (
          <Button variant="ghost" className="justify-center" disabled={disabled} onClick={onContinue}>
            <Play size={14} fill="currentColor" /> Continue
          </Button>
        )}
        <Button variant="danger" className="justify-center" disabled={disabled || !missionInProgress} onClick={onCancel}>
          <X size={15} /> Cancel
        </Button>
      </div>
      {jobs.length > 0 && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={onClearJobs}>
          Clear all
        </Button>
      )}

      {missionState && <MissionProgress missionState={missionState} />}
    </Sheet>
  );
}
