import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface FormFieldProps {
  label: string;
  value?: ReactNode;
  unit?: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}

/** Concept `.fieldlab` + `.explain` — a labeled settings field: label row (with an optional
 *  accent value + unit), the control, and a small explain line underneath. */
export function FormField({label, value, unit, hint, children, className}: FormFieldProps) {
  return (
    <div className={cn(className)}>
      <div className="flex items-baseline justify-between text-[.82rem] font-semibold text-ink">
        <span>{label}</span>
        {value !== undefined ? (
          <span className="font-[680] text-accent">
            {value}
            {unit ? <small className="font-semibold text-ink-faint">{unit}</small> : null}
          </span>
        ) : null}
      </div>
      {children ? <div className="mt-1.5">{children}</div> : null}
      {hint ? <div className="mt-[.15rem] text-[.72rem] leading-[1.4] text-ink-faint">{hint}</div> : null}
    </div>
  );
}
