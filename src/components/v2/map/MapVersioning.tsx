'use client';

// Map saving + version history — UNWIRED PLACEHOLDER pass (MAP_SCREEN_SPEC map-versioning).
// Nothing here mutates `editor.zones`/`editor.dock`, calls a store action, or reaches the mower.
// Every action below is an honest no-op (mirrors settings/BackupRestore.tsx): it reports exactly
// what isn't wired yet via inline status text, never a fake success or progress state. The real
// wiring later needs, at minimum: a `rpc.map.replace` (or equivalent) write call behind
// SaveMapSheet's primary button, and a `useMapVersions`/`useMapVersion` pair of read/write hooks
// backing both sheets in place of the mock list below.
import {isMowableType, type Zone} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {Chip} from '@/components/v2/ui/Chip';
import {FormField} from '@/components/v2/ui/FormField';
import {ListRow} from '@/components/v2/ui/ListRow';
import {Sheet} from '@/components/v2/ui/Sheet';
import {RotateCcw, Save} from 'lucide-react';
import {useEffect, useState} from 'react';

export interface SaveMapSheetProps {
  open: boolean;
  onClose: () => void;
  /** The editor's current zones — used only to render a read-only "what will be saved" summary. */
  zones: Zone[];
}

/** "Save map" sheet — opened from the unsaved-changes affordance (Map.tsx) or the command
 *  palette. PLACEHOLDER: the primary button never actually saves anything; see the module doc. */
export function SaveMapSheet({open, onClose, zones}: SaveMapSheetProps) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // Fresh note/status every time the sheet is (re)opened — same pattern as RecordCloseSheet's
  // draft-name reset.
  useEffect(() => {
    if (open) {
      setNote('');
      setStatus(null);
    }
  }, [open]);

  const areaCount = zones.filter((z) => isMowableType(z.type)).length;
  const noGoCount = zones.filter((z) => z.type === 'obstacle').length;

  return (
    <Sheet open={open} onClose={onClose} title="Save map">
      <div className="space-y-3.5">
        <p className="text-[.8rem] leading-[1.5] text-ink-soft">
          Saving keeps this as a new version of the map, so you can always come back to an earlier one from Version
          history.
        </p>

        <FormField label="What changed?" hint="Optional — shows up next to this version in the history list.">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Added the side path"
            className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink"
          />
        </FormField>

        <div className="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[.78rem] text-ink-soft">
          {areaCount} area{areaCount === 1 ? '' : 's'} · {noGoCount} no-go zone{noGoCount === 1 ? '' : 's'} · dock
        </div>

        {/* PLACEHOLDER SEAM: this is where a real save (rpc.map.replace against editor.zones/
            editor.dock, or whatever the eventual RPC turns out to be) goes. For now it's an honest
            no-op — no store mutation, no fabricated success. */}
        <Button
          variant="primary"
          className="w-full justify-center"
          onClick={() => setStatus("Saving to the mower isn't wired up yet — your edits stay in this session.")}
        >
          <Save size={16} strokeWidth={2.2} /> Save as new version
        </Button>
        {status ? <p className="text-[.76rem] leading-[1.5] text-ink-soft">{status}</p> : null}
      </div>
    </Sheet>
  );
}

export interface MockMapVersion {
  id: string;
  date: string;
  note: string;
}

// MOCK DATA — stands in for a real `useMapVersions()` read hook until the mower actually keeps
// versioned map history. The first entry is always treated as "Current" by VersionHistorySheet
// below (index 0), newest first.
export const MOCK_MAP_VERSIONS: MockMapVersion[] = [
  {id: 'v5', date: 'Today, 14:32', note: 'Added Saunan area'},
  {id: 'v4', date: 'Jul 14', note: 'Adjusted Alapiha boundary'},
  {id: 'v3', date: 'Jul 9', note: 'Moved the docking station'},
  {id: 'v2', date: 'Jul 2', note: 'Marked the flowerbed as a no-go zone'},
  {id: 'v1', date: 'Jun 28', note: 'Initial map'},
];

export interface VersionHistorySheetProps {
  open: boolean;
  onClose: () => void;
}

/** "Version history" sheet — reachable from a Fab in both live and edit view, plus the command
 *  palette. PLACEHOLDER: the list is MOCK_MAP_VERSIONS above, not a real read from the mower, and
 *  Restore is a no-op; see the module doc. */
export function VersionHistorySheet({open, onClose}: VersionHistorySheetProps) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open) setStatus(null);
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Version history">
      <div className="space-y-2.5">
        <p className="text-[.76rem] leading-[1.4] text-ink-faint">
          Preview — restoring and saving will be wired to the mower later.
        </p>

        {MOCK_MAP_VERSIONS.length === 0 ? (
          <div className="py-2 text-center text-[.82rem] text-ink-soft">No saved versions yet.</div>
        ) : (
          <div className="space-y-0.5">
            {MOCK_MAP_VERSIONS.map((version, index) => (
              <ListRow
                key={version.id}
                title={version.note}
                sub={version.date}
                trailing={
                  index === 0 ? (
                    <Chip variant="ok">Current</Chip>
                  ) : (
                    <Button variant="soft" size="sm" onClick={() => setStatus("Restoring a version isn't wired up yet.")}>
                      <RotateCcw size={13} /> Restore
                    </Button>
                  )
                }
              />
            ))}
          </div>
        )}

        {status ? <p className="text-[.76rem] leading-[1.5] text-ink-soft">{status}</p> : null}
      </div>
    </Sheet>
  );
}
