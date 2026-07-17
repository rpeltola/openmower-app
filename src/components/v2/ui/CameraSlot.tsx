import {cn} from '@/components/v2/lib/cn';
import {Chip} from '@/components/v2/ui/Chip';
import {Camera} from 'lucide-react';

export interface CameraSlotProps {
  label: string;
  size?: 'lg' | 'sm';
  caption?: string;
  badge?: string;
  className?: string;
}

/** A reserved camera feed slot — no vision add-on installed yet, so it's always this
 *  dashed placeholder, never a fabricated preview (design-language.md §1 "Honest"). */
export function CameraSlot({label, size = 'sm', caption, badge, className}: CameraSlotProps) {
  const iconSize = size === 'lg' ? 54 : 26;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-[1.5px] border-dashed border-border bg-surface-2 text-ink-faint',
        size === 'lg' ? 'min-h-40' : 'min-h-24',
        className,
      )}
    >
      <span className="absolute left-3 top-2.5 text-[.68rem] font-semibold text-ink-soft">{label}</span>
      {badge ? (
        <Chip variant="neutral" className="absolute right-2.5 top-2 bg-surface">
          {badge}
        </Chip>
      ) : null}
      <Camera size={iconSize} strokeWidth={1.5} aria-hidden />
      {caption ? (
        <p className="max-w-[34ch] text-center text-[.84rem] font-semibold text-ink-soft">{caption}</p>
      ) : null}
    </div>
  );
}
