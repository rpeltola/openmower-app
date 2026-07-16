'use client';

import {cn} from '@/components/v2/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Concept `.toggle` — the one on/off control (design-language.md "One control kit"). */
export function Switch({checked, onCheckedChange, disabled, 'aria-label': ariaLabel, className}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-[26px] w-[42px] flex-none rounded-[14px] border-0 transition-colors disabled:opacity-40',
        checked ? 'bg-accent' : 'border border-border bg-surface-2',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-[#fff] shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all duration-150"
        style={checked ? {right: '2px', left: 'auto'} : {left: '2px', right: 'auto'}}
      />
    </button>
  );
}
