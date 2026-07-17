'use client';

// Map saving + version history (W9 A2b) — wired to the real persistence contract: Save goes
// through `rpc.map.replace` (Map.tsx's saveMap), Version history lists `query/mapversions` and
// restores a version's `query/mapversion` geojson into the editor (see realData.ts's
// zonesToMapData / versionFeaturesToZonesAndDock). Both components are presentational: all the
// MQTT/store plumbing lives in Map.tsx, passed down as props, so this file stays easy to test.
import {isMowableType, type Zone} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {Chip} from '@/components/v2/ui/Chip';
import {FormField} from '@/components/v2/ui/FormField';
import {ListRow} from '@/components/v2/ui/ListRow';
import {Sheet} from '@/components/v2/ui/Sheet';
import type {MapVersionEntry} from '@/stores/schemas';
import {RotateCcw, Save} from 'lucide-react';
import {useEffect, useState} from 'react';

export interface SaveMapSheetProps {
  open: boolean;
  onClose: () => void;
  /** The editor's current zones — used only to render a read-only "what will be saved" summary. */
  zones: Zone[];
  /** Persists `zones`/`dock` to the mower as a new map version (`rpc.map.replace`); Map.tsx owns
   *  the actual payload build + RPC call, catches the RPC error and surfaces it via `error`. */
  onSave: () => void | Promise<void>;
  saving: boolean;
  error: string | null;
}

/** "Save map" sheet — opened from the unsaved-changes affordance (Map.tsx) or the command palette. */
export function SaveMapSheet({open, onClose, zones, onSave, saving, error}: SaveMapSheetProps) {
  const [note, setNote] = useState('');

  // Fresh note every time the sheet is (re)opened — same pattern as RecordCloseSheet's
  // draft-name reset.
  useEffect(() => {
    if (open) setNote('');
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

        {/* `note` is a local-only annotation for this session — map.replace has no field to carry
            it and the persistence service doesn't store save notes yet, so it is intentionally
            NOT sent (never fabricate a "saved" note the mower doesn't actually have). */}
        <FormField label="What changed?" hint="Local note only — not sent to the mower (it doesn't store save notes yet).">
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

        <Button variant="primary" className="w-full justify-center" disabled={saving} onClick={() => void onSave()}>
          <Save size={16} strokeWidth={2.2} /> {saving ? 'Saving…' : 'Save as new version'}
        </Button>
        {error ? <p className="text-[.76rem] leading-[1.5] text-danger">{error}</p> : null}
      </div>
    </Sheet>
  );
}

export interface VersionHistorySheetProps {
  open: boolean;
  onClose: () => void;
  versions: MapVersionEntry[];
  loading: boolean;
  error: string | null;
  /** Fetches `versionId`'s geojson and loads it into the editor as pending (unsaved) edits — the
   *  user reviews it on the map and Saves to make it the live one, or Discards to back out.
   *  Map.tsx owns the fetch + conversion (realData.ts's versionFeaturesToZonesAndDock). */
  onRestore: (versionId: number) => void | Promise<void>;
  restoringId: number | null;
  restoreError: string | null;
}

/** "Version history" sheet — reachable from a Fab in both live and edit view, plus the command
 *  palette. Lists `query/mapversions`; Restore loads a past version's geojson into the editor
 *  (a pending, unsaved edit — nothing is pushed to the mower until the user explicitly Saves). */
export function VersionHistorySheet({
  open,
  onClose,
  versions,
  loading,
  error,
  onRestore,
  restoringId,
  restoreError,
}: VersionHistorySheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Version history">
      <div className="space-y-2.5">
        <p className="text-[.76rem] leading-[1.4] text-ink-faint">
          Restoring loads that version into the map editor for review — it only becomes the live map once you Save.
        </p>

        {loading ? (
          <div className="py-2 text-center text-[.82rem] text-ink-soft">Loading versions…</div>
        ) : error ? (
          <div className="py-2 text-center text-[.82rem] text-danger">Couldn&apos;t load version history: {error}</div>
        ) : versions.length === 0 ? (
          <div className="py-2 text-center text-[.82rem] text-ink-soft">No saved versions yet.</div>
        ) : (
          <div className="space-y-0.5">
            {versions.map((version) => (
              <ListRow
                key={version.id}
                title={version.note || `Version ${version.id}`}
                sub={version.created_at ? new Date(version.created_at * 1000).toLocaleString() : undefined}
                trailing={
                  version.is_current ? (
                    <Chip variant="ok">Current</Chip>
                  ) : (
                    <Button
                      variant="soft"
                      size="sm"
                      disabled={restoringId !== null}
                      onClick={() => void onRestore(version.id)}
                    >
                      <RotateCcw size={13} /> {restoringId === version.id ? 'Restoring…' : 'Restore'}
                    </Button>
                  )
                }
              />
            ))}
          </div>
        )}

        {restoreError ? <p className="text-[.76rem] leading-[1.5] text-danger">{restoreError}</p> : null}
      </div>
    </Sheet>
  );
}
