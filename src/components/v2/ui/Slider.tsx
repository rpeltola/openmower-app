'use client';

import {cn} from '@/components/v2/lib/cn';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Concept `.slider` — a track + fill + knob visual driven by a hidden native range input
 *  (real drag/keyboard/a11y for free). */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  className,
}: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn('relative flex h-[26px] items-center', className)}>
      <div className="relative h-1.5 flex-1 rounded-full bg-surface-2">
        <i
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{width: `${pct}%`}}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-[#fff] shadow-[0_1px_4px_rgba(0,0,0,.25)]"
          style={{left: `${pct}%`}}
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-x-0 h-[26px] w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}
