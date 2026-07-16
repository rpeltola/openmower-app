'use client';

import {cn} from '@/components/v2/lib/cn';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Check, Plus, Sprout} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

interface MockMower {
  id: string;
  name: string;
  area: string;
  online: boolean;
}

// Mock roster (component-library.md build order — real data lands with mowersStore wiring).
// Kotipiha/YardForce is the canonical mock mower used across every other v2 screen.
const MOWERS: MockMower[] = [
  {id: 'yardforce-kotipiha', name: 'YardForce', area: 'Kotipiha', online: true},
  {id: 'yardforce-mokki', name: 'YardForce', area: 'Mökki', online: false},
];

export interface MowerSelectorProps {
  open: boolean;
  onClose: () => void;
}

/** Sheet opened from every mower chevron in the chrome (desktop sidebar, Settings top row,
 *  More top row) — concept has no dedicated mockup for this, so it follows the app's own
 *  grouped-list language (`Sheet` + `ListRow`-style rows). "Add a mower" hands off to the
 *  onboarding flow, since that's the actual add-a-mower path today. */
export function MowerSelector({open, onClose}: MowerSelectorProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(MOWERS[0].id);

  function selectMower(id: string) {
    setSelectedId(id);
    onClose();
  }

  function addMower() {
    onClose();
    router.push('/v2/onboarding');
  }

  return (
    <Sheet open={open} onClose={onClose} title="Mowers" className="gap-2">
      <div className="flex flex-col gap-1">
        {MOWERS.map((mower) => {
          const selected = mower.id === selectedId;
          return (
            <button
              key={mower.id}
              type="button"
              onClick={() => selectMower(mower.id)}
              className="flex w-full items-center gap-3 border-0 bg-transparent py-2 text-left"
            >
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-accent-wash text-accent">
                <Sprout size={19} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[.9rem] font-semibold text-ink">{mower.name}</span>
                <span className="flex items-center gap-1.5 text-[.75rem] text-ink-soft">
                  <span
                    className={cn('h-[6px] w-[6px] flex-none rounded-full', mower.online ? 'bg-accent' : 'bg-ink-faint')}
                  />
                  {mower.area} · {mower.online ? 'Online' : 'Offline'}
                </span>
              </span>
              {selected ? <Check size={17} strokeWidth={2.6} className="flex-none text-accent" /> : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addMower}
        className="flex w-full items-center gap-3 border-0 border-t border-border bg-transparent pt-3 text-left"
      >
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-surface-2 text-ink-soft">
          <Plus size={18} strokeWidth={2.2} />
        </span>
        <span className="text-[.9rem] font-semibold text-ink">Add a mower</span>
      </button>
    </Sheet>
  );
}
