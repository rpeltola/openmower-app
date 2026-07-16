import {cn} from '@/components/v2/lib/cn';
import {cva, type VariantProps} from 'class-variance-authority';
import {type ButtonHTMLAttributes, forwardRef} from 'react';

const buttonVariants = cva(
  // border-0 clears the UA button border that leaks through (preflight is omitted for v1
  // coexistence); bordered variants (ghost) re-add their own `border` via twMerge.
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] border-0 font-semibold ' +
    'transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none ' +
    'active:scale-[0.97] transition-transform',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-ink',
        ghost:
          'bg-surface-2 text-ink-soft border border-border hover:text-ink hover:border-ink-faint',
        // Borderless surface-2 chrome — concept `.ico`/`.fab` (notification bell, map FABs).
        soft: 'bg-surface-2 text-ink-soft hover:text-ink',
        danger: 'bg-danger-wash text-danger hover:brightness-95 dark:hover:brightness-110',
        'danger-solid': 'bg-danger text-white hover:brightness-95',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
        icon: 'h-11 w-11 rounded-full p-0',
        'icon-lg': 'h-[46px] w-[46px] rounded-full p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, ...props}, ref) => (
    <button ref={ref} className={cn(buttonVariants({variant, size}), className)} {...props} />
  ),
);
Button.displayName = 'Button';
