import {cn} from '@/components/v2/lib/cn';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {Clock} from 'lucide-react';

type SubsystemStatus = 'done' | 'working' | 'waiting';

interface Subsystem {
  name: string;
  status: SubsystemStatus;
  label: string;
}

// Exact subsystem set + copy from the concept boot checklist (openmower-app-concept.html
// "D · BOOTING — READINESS CHECKLIST" + the desktop concept's matching card).
const SUBSYSTEMS: Subsystem[] = [
  {name: 'Board comms', status: 'done', label: 'Ready'},
  {name: 'Map', status: 'done', label: 'Ready'},
  {name: 'GPS', status: 'waiting', label: 'Waiting for fix'},
  {name: 'Estimator', status: 'working', label: 'Converging…'},
  {name: 'Nav2', status: 'working', label: 'Activating…'},
  {name: 'Safety', status: 'done', label: 'Ready'},
];

function StatusChip({status, label}: {status: SubsystemStatus; label: string}) {
  if (status === 'done') {
    return <Chip variant="ok">✓ {label}</Chip>;
  }
  // Working/waiting share the same "still converging" chip — the breathing opacity is the
  // concept's `.breath` cue that nothing is stuck, just not done yet.
  return (
    <Chip variant="warn" className="animate-pulse">
      {label}
    </Chip>
  );
}

/** BOOTING — "a wait with a face": every subsystem the mower depends on gets its own line
 *  and its own honest status, so a slow GPS fix reads as one line converging, never a
 *  black-box spinner (concept caption, mobile line 1631 / desktop line 1260). */
export function BootingScreen() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-[1.1rem] p-6 text-center md:min-h-0 md:py-10">
      <div className="grid h-[60px] w-[60px] flex-none animate-pulse place-items-center rounded-[19px] bg-surface-2 text-ink-soft">
        <Clock size={26} strokeWidth={2.1} />
      </div>

      <div className="text-[1.22rem] font-bold tracking-tight text-ink">Starting up</div>

      <Card className="flex w-full max-w-[420px] flex-col p-0 text-left">
        {SUBSYSTEMS.map((s, i) => (
          <div
            key={s.name}
            className={cn(
              'flex items-center justify-between px-4 py-[.55rem]',
              i < SUBSYSTEMS.length - 1 && 'border-b border-border',
            )}
          >
            <span className="text-[.84rem] font-semibold text-ink">{s.name}</span>
            <StatusChip status={s.status} label={s.label} />
          </div>
        ))}
      </Card>

      <p className="max-w-[320px] text-[.78rem] leading-[1.4] text-ink-soft">
        Ready in a moment — nothing is stuck.
      </p>
    </div>
  );
}
