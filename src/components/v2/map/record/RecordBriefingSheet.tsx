'use client';

// R1 — briefing/readiness (MAP_SCREEN_SPEC S8). A static mock checklist: this app has no live
// sensor feed yet, so every row just reads "OK" — the point is the flow, not real readiness
// detection. Presentational only; Map.tsx owns all recording state.
import {Button} from '@/components/v2/ui/Button';
import {ListRow} from '@/components/v2/ui/ListRow';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Check, Play} from 'lucide-react';

export interface RecordBriefingSheetProps {
  open: boolean;
  onClose: () => void;
  /** Begins R2 (drive-the-edge). */
  onStart: () => void;
  /** Skips recording — closes this sheet and opens the "Add to map" create menu instead, so the
   *  user can place/draw a shape directly with the existing tools. */
  onDrawOnMapInstead: () => void;
}

const CHECKS = ['GPS · RTK fixed', 'Mower on the lawn, near the edge', 'Path ahead is clear'];

export function RecordBriefingSheet({open, onClose, onStart, onDrawOnMapInstead}: RecordBriefingSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Record a boundary">
      <div className="space-y-0.5">
        {CHECKS.map((label) => (
          <ListRow key={label} icon={<Check size={16} className="text-accent" />} title={label} sub="OK" />
        ))}
      </div>
      <Button variant="primary" className="mt-2.5 w-full justify-center" onClick={onStart}>
        <Play size={14} fill="currentColor" /> Start recording
      </Button>
      <Button variant="ghost" className="mt-1.5 w-full justify-center" onClick={onDrawOnMapInstead}>
        Draw on map instead
      </Button>
    </Sheet>
  );
}
