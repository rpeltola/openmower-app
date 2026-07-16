'use client';

// R2 — drive-the-edge hero (MAP_SCREEN_SPEC S8). Floats over the live map, which renders the
// actual trace/wash/close-hint/marks via MapCanvas's `recording` prop (Map.tsx owns that state and
// the mock drive simulation — this component is pure chrome: live readouts + controls).
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Joystick} from '@/components/v2/ui/Joystick';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Ban, Check, RotateCcw, X} from 'lucide-react';

export type RecordSpeed = 'slow' | 'normal' | 'fast';
type Direction = 'up' | 'down' | 'left' | 'right';

const SPEED_OPTIONS: {value: RecordSpeed; label: string}[] = [
  {value: 'slow', label: 'Slow'},
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
];

export interface RecordDriveOverlayProps {
  pointCount: number;
  areaM2: number;
  perimeterM: number;
  speed: RecordSpeed;
  onSpeedChange: (speed: RecordSpeed) => void;
  onDirectionChange: (direction: Direction | null) => void;
  onMarkNoGo: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onCloseLoop: () => void;
  canCloseLoop: boolean;
  onCancel: () => void;
}

export function RecordDriveOverlay({
  pointCount,
  areaM2,
  perimeterM,
  speed,
  onSpeedChange,
  onDirectionChange,
  onMarkNoGo,
  onUndo,
  canUndo,
  onCloseLoop,
  canCloseLoop,
  onCancel,
}: RecordDriveOverlayProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[900] flex flex-wrap items-center gap-2">
        <OverlayChip>
          <span className="text-danger">●</span> REC
        </OverlayChip>
        <OverlayChip>{pointCount} pts</OverlayChip>
        <OverlayChip>
          {areaM2.toFixed(0)} m² · {perimeterM.toFixed(1)} m
        </OverlayChip>
        <Button
          variant="soft"
          size="icon"
          className="pointer-events-auto ml-auto h-9 w-9"
          aria-label="Cancel recording"
          onClick={onCancel}
        >
          <X size={16} />
        </Button>
      </div>

      <Card className="absolute inset-x-3 bottom-3 z-[900] p-3 md:left-3 md:right-auto md:w-[340px]">
        <div className="flex items-center justify-center">
          <Joystick size={116} onDirectionChange={onDirectionChange} />
        </div>
        <SegmentedToggle
          label="Speed"
          options={SPEED_OPTIONS}
          value={speed}
          onChange={(v) => onSpeedChange(v as RecordSpeed)}
          className="mt-2"
        />
        <div className="mt-2.5 flex items-center gap-2">
          <Button variant="soft" size="sm" className="flex-1" onClick={onMarkNoGo}>
            <Ban size={14} /> Mark no-go
          </Button>
          <Button variant="ghost" size="sm" className="flex-1" onClick={onUndo} disabled={!canUndo}>
            <RotateCcw size={14} /> Undo
          </Button>
        </div>
        <Button variant="primary" className="mt-2 w-full justify-center" disabled={!canCloseLoop} onClick={onCloseLoop}>
          <Check size={14} /> Close loop
        </Button>
      </Card>
    </>
  );
}
