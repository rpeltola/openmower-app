'use client';

// Dock settings -- edit the physical charging dock's name/active flag, docking approach heading,
// and staging approach_distance. Ported from v1's DockingStationSettingsDialog.tsx onto the v2
// kit (this app's v2 editor previously only moved the dock's *position*, by drag or click-to-
// place -- see mockMap.ts's Dock doc comment on the schema skew this closes). Same commit model
// as AreaSettingsSheet.tsx: edits land on useMapEditor's `dock` immediately (so they ride the
// same undo/redo as geometry edits) and only reach the mower once the user hits Save in the
// map's Save sheet -- realData.ts's zonesToMapData already carries heading/approach_distance
// through to `rpc.map.replace` unedited, this sheet is what finally lets the user CHANGE them
// instead of just preserving whatever the real map already had.
import type {Dock} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {FormField} from '@/components/v2/ui/FormField';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Switch} from '@/components/v2/ui/Switch';
import {Minus, Plus, X} from 'lucide-react';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
// Wraps into (-180, 180] rather than clamping -- heading is a compass direction, so stepping
// past 180 should wrap around to -179, not get stuck at the edge (unlike AreaSettingsSheet's
// mow-angle stepper, which clamps because it's a bounded relative offset, not a heading).
function wrapDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export interface DockSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  dock: Dock;
  onUpdate: (patch: Partial<Dock>) => void;
}

export function DockSettingsSheet({open, onClose, dock, onUpdate}: DockSettingsSheetProps) {
  return (
    <>
      {/* Mobile: bottom sheet. */}
      <div className="md:hidden">
        <Sheet open={open} onClose={onClose} title="Dock settings">
          <DockSettingsContent dock={dock} onUpdate={onUpdate} />
        </Sheet>
      </div>

      {/* Desktop (md+): persistent right-hand panel, same placement as AreaSettingsSheet. */}
      {open && (
        <div className="absolute right-3 top-16 z-[500] hidden w-[360px] flex-col overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-[var(--shadow-s)] md:flex">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[.95rem] font-semibold text-ink">Dock settings</div>
            <Button variant="soft" size="icon" className="h-8 w-8" aria-label="Close" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
          <DockSettingsContent dock={dock} onUpdate={onUpdate} />
        </div>
      )}
    </>
  );
}

function DockSettingsContent({dock, onUpdate}: {dock: Dock; onUpdate: (patch: Partial<Dock>) => void}) {
  const headingDeg = Math.round(radToDeg(dock.heading ?? 0));
  const setHeadingDeg = (deg: number) => onUpdate({heading: degToRad(wrapDeg(deg))});
  // Kept as a plain number here (unlike v1's string-draft field) since edits commit immediately,
  // one stepper press at a time, same as AreaSettingsSheet's NumberStepperField.
  const approachDistance = dock.approach_distance ?? 0;

  return (
    <div className="space-y-3.5">
      <FormField label="Name">
        <input
          key={dock.id ?? 'dock'}
          type="text"
          defaultValue={dock.name ?? ''}
          placeholder="Docking station"
          onBlur={(e) => onUpdate({name: e.target.value.trim() || undefined})}
          className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink"
        />
      </FormField>

      <FormField label="Active">
        <div className="flex items-center justify-between">
          <span className="text-[.78rem] text-ink-soft">
            {dock.active === false ? 'Not used for docking' : 'The mower docks here'}
          </span>
          <Switch checked={dock.active !== false} onCheckedChange={(v) => onUpdate({active: v})} aria-label="Dock active" />
        </div>
      </FormField>

      <div className="h-px bg-border" />

      <FormField label="Approach heading" hint="The compass direction the mower faces on its final approach into the dock.">
        <div className="flex items-center gap-2">
          <Button variant="soft" size="icon" className="h-9 w-9" aria-label="Decrease heading" onClick={() => setHeadingDeg(headingDeg - 5)}>
            <Minus size={14} />
          </Button>
          <div className="flex-1 text-center font-mono text-sm tabular-nums text-ink">{`${headingDeg}°`}</div>
          <Button variant="soft" size="icon" className="h-9 w-9" aria-label="Increase heading" onClick={() => setHeadingDeg(headingDeg + 5)}>
            <Plus size={14} />
          </Button>
        </div>
      </FormField>

      <FormField
        label="Approach distance"
        hint="Staging distance before the final docking approach. 0 = use the docking system's configured default."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="soft"
            size="icon"
            className="h-9 w-9"
            aria-label="Decrease approach distance"
            onClick={() => onUpdate({approach_distance: Math.max(0, Math.round((approachDistance - 0.1) * 10) / 10)})}
          >
            <Minus size={14} />
          </Button>
          <div className="flex-1 text-center font-mono text-sm tabular-nums text-ink">{`${approachDistance.toFixed(1)} m`}</div>
          <Button
            variant="soft"
            size="icon"
            className="h-9 w-9"
            aria-label="Increase approach distance"
            onClick={() => onUpdate({approach_distance: Math.round((approachDistance + 0.1) * 10) / 10})}
          >
            <Plus size={14} />
          </Button>
        </div>
      </FormField>
    </div>
  );
}
