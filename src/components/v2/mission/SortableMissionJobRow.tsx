'use client';

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {MissionJobRow, type MissionJobRowProps} from './MissionJobRow';

// Direct port of v1's SortableMissionJobRow — same dnd-kit/sortable wrapper, just around the
// kit-ported MissionJobRow.
export function SortableMissionJobRow(props: Omit<MissionJobRowProps, 'ref' | 'handleRef' | 'style'>) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: props.job.id,
    disabled: props.disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <MissionJobRow
      {...props}
      ref={setNodeRef}
      handleRef={setActivatorNodeRef}
      style={style}
      {...attributes}
      listeners={listeners}
      dragging={isDragging}
    />
  );
}
