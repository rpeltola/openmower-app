'use client';

import {cn} from '@/components/v2/lib/cn';

export interface StepperProps {
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  label?: string;
  icon?: React.ReactNode;
  orientation?: 'row' | 'column';
  className?: string;
}

/** − value + stepper (blade height, and any other bounded numeric setting). */
export function Stepper({
  value,
  unit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled,
  onChange,
  label,
  icon,
  orientation = 'column',
  className,
}: StepperProps) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        orientation === 'column' ? 'flex-col' : 'flex-row',
        disabled && 'opacity-45',
        className,
      )}
    >
      {label ? (
        <span className="text-[.62rem] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={dec}
        aria-label={`Decrease ${label ?? 'value'}`}
        className="grid h-8 w-8 flex-none place-items-center rounded-full border border-border bg-surface-2 text-base leading-none text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
      >
        −
      </button>
      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">
        {icon}
        {value}
        {unit ? <span className="text-ink-soft">{unit}</span> : null}
      </span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={inc}
        aria-label={`Increase ${label ?? 'value'}`}
        className="grid h-8 w-8 flex-none place-items-center rounded-full border border-border bg-surface-2 text-base leading-none text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
