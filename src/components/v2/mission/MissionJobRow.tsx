'use client';

import type {MissionComposerJob} from '@/components/map/mission/types';
import {cn} from '@/components/v2/lib/cn';
import {Stepper} from '@/components/v2/ui/Stepper';
import {jobLabel} from '@/utils/mission-utils';
import type {DraggableSyntheticListeners} from '@dnd-kit/core';
import {GripVertical, Lasso, Scissors, Trash2} from 'lucide-react';
import {DirectionControl} from './DirectionControl';

export interface MissionJobRowProps {
  index: number;
  job: MissionComposerJob;
  disabled?: boolean;
  onChange: (patch: Partial<Pick<MissionComposerJob, 'directionDeg' | 'repeats'>>) => void;
  onRemove: () => void;
  ref?: React.Ref<HTMLDivElement>;
  handleRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  listeners?: DraggableSyntheticListeners;
  dragging?: boolean;
}

// Kit port of v1's MissionJobRow (MUI ListItem) — one row of the ordered mission job queue: index
// badge, job icon/label, direction + repeats controls, remove + drag handle.
export function MissionJobRow({
  index,
  job,
  disabled = false,
  onChange,
  onRemove,
  ref,
  handleRef,
  style,
  listeners,
  dragging = false,
  ...props
}: MissionJobRowProps) {
  const Icon = job.type === 'area' ? Scissors : Lasso;

  return (
    <div
      ref={ref}
      style={style}
      {...props}
      className={cn('border-b border-border p-2.5 last:border-b-0', dragging && 'bg-surface-2')}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-[1.4rem] w-[1.4rem] flex-none place-items-center rounded-full bg-accent text-[.68rem] font-semibold text-white">
          {index + 1}
        </span>
        <Icon size={15} className="flex-none text-ink-faint" />
        <span className="min-w-0 flex-1 truncate text-[.85rem] font-semibold text-ink">{jobLabel(job)}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove job"
          className="grid h-7 w-7 flex-none place-items-center rounded-full text-ink-faint hover:text-danger disabled:opacity-40"
        >
          <Trash2 size={15} />
        </button>
        {!disabled && (
          <div
            ref={handleRef}
            {...listeners}
            aria-label="Drag to reorder"
            className="flex flex-none touch-none items-center text-ink-faint"
            style={{cursor: 'grab'}}
          >
            <GripVertical size={15} />
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-[2.15rem]">
        <DirectionControl
          valueDeg={job.directionDeg}
          disabled={disabled}
          onChange={(directionDeg) => onChange({directionDeg})}
        />
        <Stepper
          value={job.repeats}
          min={1}
          max={20}
          orientation="row"
          disabled={disabled}
          onChange={(repeats) => onChange({repeats})}
        />
      </div>
    </div>
  );
}
