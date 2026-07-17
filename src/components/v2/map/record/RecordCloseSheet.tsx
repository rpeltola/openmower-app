'use client';

// R3 — close & name (MAP_SCREEN_SPEC S8). Name the recorded area, pick its type, review stats,
// then Save (drops into its settings editor) or Fine-tune the shape (drops into vertex edit) —
// both wired by Map.tsx, which also owns the recorded points/type/name state.
import type {ZoneType} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {FormField} from '@/components/v2/ui/FormField';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import {useEffect, useState} from 'react';

const TYPE_OPTIONS: {value: ZoneType; label: string}[] = [
  {value: 'mow', label: 'Mowing'},
  {value: 'obstacle', label: 'No-go'},
  {value: 'nav', label: 'Nav-only'},
];

export interface RecordCloseSheetProps {
  open: boolean;
  onClose: () => void;
  areaM2: number;
  perimeterM: number;
  pointCount: number;
  type: ZoneType;
  onTypeChange: (type: ZoneType) => void;
  defaultName: string;
  onSave: (name: string, fineTune: boolean) => void;
}

export function RecordCloseSheet({
  open,
  onClose,
  areaM2,
  perimeterM,
  pointCount,
  type,
  onTypeChange,
  defaultName,
  onSave,
}: RecordCloseSheetProps) {
  const [name, setName] = useState(defaultName);
  // Reset the draft name only when a fresh recording OPENS this sheet — deliberately excluding
  // `defaultName` from the deps: it's derived from `type`, so if it were included, switching Type
  // while the sheet is open would clobber whatever custom name the user already typed.
  useEffect(() => {
    if (open) setName(defaultName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Name this area">
      <div className="space-y-3.5">
        <FormField label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink"
          />
        </FormField>

        <FormField label="Type">
          <SegmentedToggle options={TYPE_OPTIONS} value={type} onChange={(v) => onTypeChange(v as ZoneType)} />
        </FormField>

        <div className="grid grid-cols-3 gap-2">
          <KpiTile value={areaM2.toFixed(0)} unit=" m²" label="Area" />
          <KpiTile value={perimeterM.toFixed(1)} unit=" m" label="Perimeter" />
          <KpiTile value={pointCount} label="Points" />
        </div>

        <Button variant="primary" className="w-full justify-center" onClick={() => onSave(name || defaultName, false)}>
          Save
        </Button>
        <Button variant="ghost" className="w-full justify-center" onClick={() => onSave(name || defaultName, true)}>
          Fine-tune the shape
        </Button>
      </div>
    </Sheet>
  );
}
