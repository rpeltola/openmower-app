'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Check} from 'lucide-react';

export interface AreaPickerListProps {
  areas: string[];
  selected: string[];
  onToggle: (area: string) => void;
  className?: string;
}

/** Multi-select checklist for the Schedule editor's "Areas" row — an inline expander (not a
 *  separate screen) so the schedule and its coverage stay on one card stack. */
export function AreaPickerList({areas, selected, onToggle, className}: AreaPickerListProps) {
  return (
    <Card className={cn('px-[.6rem] py-[.2rem]', className)}>
      {areas.map((area, i) => {
        const checked = selected.includes(area);
        return (
          <Button
            key={area}
            type="button"
            variant="soft"
            onClick={() => onToggle(area)}
            aria-pressed={checked}
            className={cn(
              'h-auto w-full justify-start gap-[.7rem] rounded-none bg-transparent px-0 py-2.5 text-left',
              i > 0 && 'border-t border-border',
            )}
          >
            <span className="min-w-0 flex-1 truncate text-[.86rem] font-medium text-ink">{area}</span>
            <span
              className={cn(
                'grid h-[20px] w-[20px] flex-none place-items-center rounded-full border',
                checked ? 'border-accent bg-accent text-white' : 'border-border bg-transparent text-transparent',
              )}
            >
              <Check size={13} strokeWidth={3} />
            </span>
          </Button>
        );
      })}
    </Card>
  );
}
