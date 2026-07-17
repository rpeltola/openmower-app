import {Button} from '@/components/v2/ui/Button';
import {cn} from '@/components/v2/lib/cn';
import {type ReactNode} from 'react';

export interface SettingsCategory {
  id: string;
  label: string;
  /** Small trailing indicator, e.g. the Connection row's live-status dot. */
  indicator?: ReactNode;
}

export interface SettingsCategoryRailProps {
  categories: SettingsCategory[];
  selected: string;
  onSelect: (id: string) => void;
  className?: string;
}

/** Desktop concept `.navi` rail — a persistent settings category list that replaces the
 *  mobile drill-down: switching sections never loses your place. */
export function SettingsCategoryRail({categories, selected, onSelect, className}: SettingsCategoryRailProps) {
  return (
    <nav className={cn('flex flex-none flex-col gap-0.5 overflow-y-auto', className)}>
      {categories.map((cat) => {
        const active = cat.id === selected;
        return (
          <Button
            key={cat.id}
            variant="ghost"
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'w-full justify-start gap-2 rounded-[10px] border-0 px-2.5 py-2 text-sm font-semibold',
              active ? 'bg-accent-wash text-accent' : 'bg-transparent text-ink-soft hover:text-ink',
            )}
          >
            <span className="flex-1 text-left">{cat.label}</span>
            {cat.indicator}
          </Button>
        );
      })}
    </nav>
  );
}
