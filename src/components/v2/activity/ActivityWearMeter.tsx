import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {Wrench} from 'lucide-react';

export interface ActivityWearMeterProps {
  hours: number;
  capacityHours: number;
  /** Desktop concept adds a service-estimate line under the value ("Replace around 100 h..."). */
  detail?: string;
  onChangedBlades?: () => void;
  className?: string;
}

/** Blade-wear progress meter with a "Changed blades" reset action — the maintenance
 *  reminder surfaced on the Stats sub-tab instead of buried in a settings page. Mobile
 *  shows the value inline next to the label; desktop stacks a larger value + detail line
 *  (concept `.card` blade-wear block, both forms). */
export function ActivityWearMeter({hours, capacityHours, detail, onChangedBlades, className}: ActivityWearMeterProps) {
  const pct = (hours / capacityHours) * 100;
  return (
    <Card className={cn('flex flex-col p-[.85rem] md:justify-between md:p-4', className)}>
      <div>
        <div className="flex items-center justify-between gap-2 md:hidden">
          <span className="text-[.83rem] font-semibold text-ink">Blade wear</span>
          <span className="font-mono text-[.76rem] tabular-nums text-ink-soft">
            {hours} / {capacityHours} h
          </span>
        </div>
        <div className="mb-[.6rem] hidden font-mono text-[.62rem] font-semibold uppercase tracking-[.08em] text-ink-faint md:block">
          Blade wear
        </div>

        <ProgressBar value={pct} className="mt-2 md:mt-0 md:h-[10px]" />

        <div className="mt-2 hidden text-[1.3rem] font-bold tabular-nums text-ink md:block">
          {hours}
          <small className="text-[.8rem] font-semibold text-ink-soft"> / {capacityHours} h</small>
        </div>
        {detail ? <p className="mt-[.3rem] hidden text-[.78rem] text-ink-soft md:block">{detail}</p> : null}
      </div>
      <Button variant="ghost" size="sm" onClick={onChangedBlades} className="mt-[.65rem] w-full md:mt-4 md:w-fit">
        <Wrench size={14} strokeWidth={2.2} />
        Changed blades
      </Button>
    </Card>
  );
}
