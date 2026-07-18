'use client';

import {cn} from '@/components/v2/lib/cn';
import {DIRECTION_PRESETS_DEG} from '@/utils/mission-utils';

export interface DirectionControlProps {
  valueDeg: number;
  onChange: (valueDeg: number) => void;
  disabled?: boolean;
}

// Swath angle control: a few common presets plus a free-form numeric fallback, per the mission
// contract's `direction_deg` (0 = area's default best-fit). Port of v1's MUI ToggleButtonGroup +
// TextField, as a small bespoke control (kit's SegmentedToggle is string-valued, presets here are
// numeric and the field needs a free-form fallback outside the preset set).
export function DirectionControl({valueDeg, onChange, disabled = false}: DirectionControlProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', disabled && 'opacity-45')}>
      {DIRECTION_PRESETS_DEG.map((deg) => (
        <button
          key={deg}
          type="button"
          disabled={disabled}
          aria-pressed={valueDeg === deg}
          onClick={() => onChange(deg)}
          className={cn(
            'rounded-full border px-2 py-1 text-[.68rem] font-semibold transition-colors',
            valueDeg === deg
              ? 'border-accent bg-accent-wash text-accent'
              : 'border-border bg-surface-2 text-ink-soft hover:text-ink',
          )}
        >
          {deg}°
        </button>
      ))}
      <input
        type="number"
        inputMode="decimal"
        min={-180}
        max={180}
        step="any"
        value={valueDeg}
        disabled={disabled}
        aria-label="Direction, degrees"
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="h-7 w-14 rounded-[8px] border border-border bg-surface-2 px-1.5 text-[.75rem] text-ink"
      />
    </div>
  );
}
