'use client';

import {cn} from '@/components/v2/lib/cn';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

export interface SegmentedToggleOption {
  value: string;
  label: string;
}

export interface SegmentedToggleProps {
  options: SegmentedToggleOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

/** The one Slow/Normal/Fast control shared by mobile teleop + the desktop cockpit
 *  (design-language.md "One control kit"). Radix gives real roving-tabindex a11y. */
export function SegmentedToggle({options, value, onChange, label, className}: SegmentedToggleProps) {
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <div className="mb-1.5 text-center text-[.68rem] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </div>
      ) : null}
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v)}
        className="flex w-full gap-1.5"
        aria-label={label ?? 'Speed'}
      >
        {options.map((opt) => (
          <ToggleGroup.Item
            key={opt.value}
            value={opt.value}
            className={cn(
              'flex-1 rounded-full border px-2 py-1.5 text-xs font-semibold transition-colors',
              'data-[state=on]:border-accent data-[state=on]:bg-accent-wash data-[state=on]:text-accent',
              'data-[state=off]:border-border data-[state=off]:bg-surface-2 data-[state=off]:text-ink-soft',
            )}
          >
            {opt.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
