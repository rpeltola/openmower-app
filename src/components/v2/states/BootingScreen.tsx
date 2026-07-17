'use client';

import {cn} from '@/components/v2/lib/cn';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {READINESS_KEYS, type ReadinessKey, type ReadinessValue} from '@/lib/v2/robotState';
import {useRobotStateSnapshot} from '@/lib/v2/useRobotStateSnapshot';
import {Clock} from 'lucide-react';

const READINESS_LABELS: Record<ReadinessKey, string> = {
  board_comms: 'Board comms',
  map: 'Map',
  gps: 'GPS',
  estimator: 'Estimator',
  nav2: 'Nav2',
  safety: 'Safety',
};

// Demo checklist for the /v2/states dev gallery + as a last-resort default (no mower selected,
// no live readiness yet) -- matches the concept mock's original SUBSYSTEMS content.
const DEMO_READINESS: Record<ReadinessKey, ReadinessValue> = {
  board_comms: 'ok',
  map: 'ok',
  gps: 'waiting',
  estimator: 'converging',
  nav2: 'activating',
  safety: 'ok',
};

const STATUS_LABEL: Record<ReadinessValue, string> = {
  ok: 'Ready',
  waiting: 'Waiting for fix',
  converging: 'Converging…',
  activating: 'Activating…',
  error: 'Error',
};

function StatusChip({value}: {value: ReadinessValue}) {
  if (value === 'error') {
    return <Chip variant="danger">✕ {STATUS_LABEL[value]}</Chip>;
  }
  if (value === 'ok') {
    return <Chip variant="ok">✓ {STATUS_LABEL[value]}</Chip>;
  }
  // waiting/converging/activating share the same "still converging" chip — the breathing
  // opacity is the concept's `.breath` cue that nothing is stuck, just not done yet.
  return (
    <Chip variant="warn" className="animate-pulse">
      {STATUS_LABEL[value]}
    </Chip>
  );
}

export interface BootingScreenProps {
  /** Overrides the live readiness checklist (W9 §0.8) -- used by the /v2/states gallery and
   *  tests to render a specific combo. Falls back to the real snapshot
   *  (useRobotStateSnapshot's `readiness`), then to a static demo checklist if neither has data
   *  (no mower selected, or an old gateway that doesn't send readiness at all). */
  readiness?: Partial<Record<ReadinessKey, ReadinessValue>>;
}

/** BOOTING — "a wait with a face": every subsystem the mower depends on gets its own line
 *  and its own honest status, so a slow GPS fix reads as one line converging, never a
 *  black-box spinner (concept caption, mobile line 1631 / desktop line 1260). Reused whenever a
 *  subsystem later degrades mid-run (→ PAUSED NOT_READY), not just as a one-shot splash. */
export function BootingScreen({readiness}: BootingScreenProps) {
  const live = useRobotStateSnapshot().readiness;
  const checklist = readiness ?? live ?? DEMO_READINESS;

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-[1.1rem] p-6 text-center md:min-h-0 md:py-10">
      <div className="grid h-[60px] w-[60px] flex-none animate-pulse place-items-center rounded-[19px] bg-surface-2 text-ink-soft">
        <Clock size={26} strokeWidth={2.1} />
      </div>

      <div className="text-[1.22rem] font-bold tracking-tight text-ink">Starting up</div>

      <Card className="flex w-full max-w-[420px] flex-col p-0 text-left">
        {READINESS_KEYS.map((key, i) => (
          <div
            key={key}
            className={cn(
              'flex items-center justify-between px-4 py-[.55rem]',
              i < READINESS_KEYS.length - 1 && 'border-b border-border',
            )}
          >
            <span className="text-[.84rem] font-semibold text-ink">{READINESS_LABELS[key]}</span>
            <StatusChip value={checklist[key] ?? 'waiting'} />
          </div>
        ))}
      </Card>

      <p className="max-w-[320px] text-[.78rem] leading-[1.4] text-ink-soft">
        Ready in a moment — nothing is stuck.
      </p>
    </div>
  );
}
