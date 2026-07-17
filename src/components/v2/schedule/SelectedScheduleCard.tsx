import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {cn} from '@/components/v2/lib/cn';

export interface SelectedScheduleCardProps {
  name: string;
  dayLabels: string[];
  windowLabel: string;
  areas: string;
  rainSkip: boolean;
  quietHours: boolean;
  minBatteryPct: number;
  className?: string;
}

/** Desktop Schedule sidebar "Selected schedule" card — the rule's days, window, target and
 *  policies at a glance (concept "Schedule · calendar" right rail). */
export function SelectedScheduleCard({
  name,
  dayLabels,
  windowLabel,
  areas,
  rainSkip,
  quietHours,
  minBatteryPct,
  className,
}: SelectedScheduleCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-2.5 font-mono text-[.7rem] font-semibold uppercase tracking-wide text-ink-faint">
        Selected schedule
      </div>
      <div className="mb-2 text-base font-bold text-ink">{name}</div>
      <div className="mb-1 flex flex-wrap gap-1.5">
        {dayLabels.map((d) => (
          <Chip key={d} variant="ok">
            {d}
          </Chip>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border py-2 text-[.84rem]">
        <span className="text-ink-soft">Time window</span>
        <span className="tabular-nums font-semibold text-ink">{windowLabel}</span>
      </div>
      <div className="flex items-center justify-between border-t border-border py-2 text-[.84rem]">
        <span className="text-ink-soft">Target</span>
        <span className="font-semibold text-ink">{areas}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Chip variant={rainSkip ? 'ok' : 'neutral'}>Rain-skip {rainSkip ? 'on' : 'off'}</Chip>
        <Chip variant={quietHours ? 'ok' : 'neutral'}>Quiet hours 21:00–07:00</Chip>
        <Chip variant="ok">Min battery {minBatteryPct}%</Chip>
      </div>
    </Card>
  );
}
