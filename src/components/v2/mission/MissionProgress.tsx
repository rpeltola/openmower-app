'use client';

import {Chip, type ChipProps} from '@/components/v2/ui/Chip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import type {MissionState} from '@/stores/schemas';

const STATE_VARIANT: Record<MissionState['state'], NonNullable<ChipProps['variant']>> = {
  queued: 'neutral',
  planning: 'info',
  mowing: 'info',
  paused: 'warn',
  done: 'ok',
  failed: 'danger',
  cancelled: 'neutral',
};

function formatEta(etaS?: number): string | null {
  if (etaS === undefined) return null;
  const minutes = Math.floor(etaS / 60);
  const seconds = Math.round(etaS % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
}

// Kit port of v1's MissionProgress — live `mow_mission/state` readout: job i/N, current job's
// state chip, coverage bar, pass/repeats + ETA.
export function MissionProgress({missionState}: {missionState: MissionState}) {
  const {job_index, job_total, type, area_id, pass, repeats, coverage, state, eta_s} = missionState;
  const eta = formatEta(eta_s);

  return (
    <div className="border-t border-border p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[.82rem] font-semibold text-ink">
          Job {job_index + 1} / {job_total}
          {type === 'area' && area_id ? ` — ${area_id}` : type === 'spot' ? ' — Spot mow' : ''}
        </span>
        <Chip variant={STATE_VARIANT[state]}>{state}</Chip>
      </div>
      <ProgressBar value={Math.round(Math.min(1, Math.max(0, coverage)) * 100)} className="mb-1" />
      <div className="flex items-center justify-between text-[.72rem] text-ink-soft">
        <span>
          Pass {pass} / {repeats} · {Math.round(coverage * 100)}% coverage
        </span>
        {eta ? <span>{eta}</span> : null}
      </div>
    </div>
  );
}
