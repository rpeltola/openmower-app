'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Sheet} from '@/components/v2/ui/Sheet';
import {useMowersStore} from '@/stores/mowersStore';
import {Check, Plus, Sprout} from 'lucide-react';
import {useRouter} from 'next/navigation';

export interface MowerSelectorProps {
  open: boolean;
  onClose: () => void;
}

/** Sheet opened from every mower chevron in the chrome (desktop sidebar, Settings top row,
 *  More top row) — concept has no dedicated mockup for this, so it follows the app's own
 *  grouped-list language (`Sheet` + `ListRow`-style rows).
 *
 *  R1 gate audit: this used to be a mock 2-mower roster with a picker that only set local
 *  React state. `mowersStore` has no action to actually switch the selected mower (it's fixed
 *  to `mowers[0]` at load), so this now lists the real configured roster read-only -- rows
 *  aren't buttons, there's nothing to pick since there's nothing wired to pick it with. "Add a
 *  mower" still hands off to the onboarding flow, the real (if currently gated) add-a-mower
 *  path. */
export function MowerSelector({open, onClose}: MowerSelectorProps) {
  const router = useRouter();
  const mowers = useMowersStore((s) => s.mowers);
  const selected = useMowersStore((s) => s.selected);
  const mqttStatuses = useMowersStore((s) => s.mqttStatuses);

  function addMower() {
    onClose();
    router.push('/v2/onboarding');
  }

  return (
    <Sheet open={open} onClose={onClose} title="Mowers" className="gap-2">
      <div className="flex flex-col gap-1">
        {mowers.length === 0 ? (
          <p className="py-2 text-[.82rem] text-ink-faint">No mower configured yet.</p>
        ) : (
          mowers.map((mower, i) => {
            const online = mqttStatuses[mower.id] === 'connected';
            const isSelected = i === selected;
            return (
              <div key={mower.id} className="flex items-center gap-3 py-2">
                <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-accent-wash text-accent">
                  <Sprout size={19} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[.9rem] font-semibold text-ink">{mower.name}</span>
                  <span className="flex items-center gap-1.5 text-[.75rem] text-ink-soft">
                    <span className={cn('h-[6px] w-[6px] flex-none rounded-full', online ? 'bg-accent' : 'bg-ink-faint')} />
                    {mower.description || (online ? 'Online' : 'Offline')}
                  </span>
                </span>
                {isSelected ? <Check size={17} strokeWidth={2.6} className="flex-none text-accent" /> : null}
              </div>
            );
          })
        )}
      </div>

      <Button
        type="button"
        variant="soft"
        onClick={addMower}
        className="h-auto w-full justify-start gap-3 rounded-none border-t border-border bg-transparent px-0 pt-3 text-left"
      >
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-surface-2 text-ink-soft">
          <Plus size={18} strokeWidth={2.2} />
        </span>
        <span className="text-[.9rem] font-semibold text-ink">Add a mower</span>
      </Button>
    </Sheet>
  );
}
