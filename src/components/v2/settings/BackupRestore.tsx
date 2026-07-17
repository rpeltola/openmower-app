'use client';

import {SettingsGroup} from '@/components/v2/settings/SettingsGroup';
import {Button} from '@/components/v2/ui/Button';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';
import {ListRow} from '@/components/v2/ui/ListRow';
import {AlertTriangle, Database, Download, Map as MapIcon, SlidersHorizontal, Upload} from 'lucide-react';
import {useState} from 'react';

// What a real backup will bundle — sizes are unknown until the app can actually reach the
// mower's backup RPC, so every row shows a mock placeholder rather than a fabricated number.
const BACKUP_CONTENTS = [
  {icon: SlidersHorizontal, label: 'App & mower settings'},
  {icon: MapIcon, label: 'Map & zones'},
  {icon: Database, label: 'Statistics database (state.db)'},
  {icon: Database, label: 'Telemetry database (telemetry.db)'},
];

/** Settings · Backup & Restore — a placeholder for the mower-side backup/restore feature.
 *  Nothing here is wired: the app only talks to the mower over MQTT today, and bundling +
 *  applying these files requires a robot-side RPC that doesn't exist yet. Both buttons are
 *  honest no-ops that report exactly that, via inline status text (this is a shared leaf
 *  inside a scrolling pane, so it owns no page-root Toast).
 *
 *  Reference usage of the L3 `featureSupport` gate (STATE_COMMAND_MODEL.md §4): this whole
 *  screen is the `backup` entry, so by default it's hidden entirely (an empty detail pane);
 *  the Settings → General dev toggle reveals it greyed + tagged. */
export function BackupRestore() {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  return (
    <FeatureGate feature="backup">
      <SettingsGroup title="Download a backup">
        <div className="py-2.5 text-[.8rem] leading-[1.5] text-ink-soft">
          A backup bundles everything needed to restore this mower exactly as configured:
        </div>
        {BACKUP_CONTENTS.map(({icon: Icon, label}) => (
          <ListRow
            key={label}
            icon={<Icon size={15} strokeWidth={2} className="text-ink-soft" />}
            title={label}
            trailing={<span className="text-[.72rem] text-ink-faint">unknown until connected</span>}
          />
        ))}
        <div className="flex flex-col gap-2 py-2.5">
          <Button
            onClick={() =>
              setDownloadStatus(
                "Backup export isn't available yet — this will bundle your settings and databases from the mower once connected.",
              )
            }
          >
            <Download size={16} strokeWidth={2.2} />
            Download backup
          </Button>
          {downloadStatus ? <p className="text-[.76rem] leading-[1.5] text-ink-soft">{downloadStatus}</p> : null}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Restore from a backup">
        <div className="flex flex-col gap-2 py-2.5">
          <p className="text-[.8rem] leading-[1.5] text-ink-soft">
            Restoring replaces this mower&apos;s current settings, map and databases with the contents of a backup
            file.
          </p>
          <div className="flex items-start gap-1.5 text-[.7rem] leading-[1.4] text-warn">
            <AlertTriangle size={12} className="mt-[.1rem] flex-none" />
            <span>This overwrites everything currently on the mower — there&apos;s no undo.</span>
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              setRestoreStatus(
                "Restore isn't available yet — you'll be able to upload a backup file here once this is wired to the mower.",
              )
            }
          >
            <Upload size={16} strokeWidth={2.2} />
            Choose backup file…
          </Button>
          {restoreStatus ? <p className="text-[.76rem] leading-[1.5] text-ink-soft">{restoreStatus}</p> : null}
        </div>
      </SettingsGroup>
    </FeatureGate>
  );
}
