'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {ListRow} from '@/components/v2/ui/ListRow';
import {Sheet} from '@/components/v2/ui/Sheet';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Switch} from '@/components/v2/ui/Switch';
import {Battery, ChevronRight, Clock, CloudRain, Map as MapIcon, Moon} from 'lucide-react';
import {useState} from 'react';

export interface ScheduleEditorSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  dayLabels: string[];
  activeDays: boolean[];
  windowStart: string;
  windowEnd: string;
  areas: string;
  nextRun: {when: string; detail: string};
  initialRainSkip?: boolean;
  initialQuietHours?: boolean;
  minBatteryPct?: number;
}

/** Concept "Schedule · editor" — days, time window, target areas and policies on one
 *  screen, plus a live "what this produces next" preview. Rendered as a bottom `Sheet`
 *  (task spec) rather than the concept's full-screen mock; content is unchanged. */
export function ScheduleEditorSheet({
  open,
  onClose,
  name,
  dayLabels,
  activeDays,
  windowStart,
  windowEnd,
  areas,
  nextRun,
  initialRainSkip = true,
  initialQuietHours = false,
  minBatteryPct = 30,
}: ScheduleEditorSheetProps) {
  const [days, setDays] = useState(activeDays);
  const [rainSkip, setRainSkip] = useState(initialRainSkip);
  const [quietHours, setQuietHours] = useState(initialQuietHours);

  return (
    <Sheet open={open} onClose={onClose} className="max-h-[88vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">
            Schedule
          </div>
          <h2 className="text-[1.1rem] font-bold tracking-tight text-ink">{name}</h2>
        </div>
        <Button variant="primary" size="sm" onClick={onClose}>
          Save
        </Button>
      </div>

      <div>
        <div className="text-[.82rem] font-semibold text-ink">Repeat on</div>
        <div className="mt-[.45rem] flex gap-[.32rem]">
          {dayLabels.map((label, i) => (
            <Button
              key={i}
              variant="ghost"
              aria-label={`Toggle ${label}`}
              aria-pressed={days[i]}
              onClick={() => setDays((prev) => prev.map((v, j) => (i === j ? !v : v)))}
              className={cn(
                'h-8 w-8 rounded-full border p-0 text-xs font-bold',
                days[i] ? 'border-accent bg-accent-wash text-accent' : 'border-transparent bg-surface-2 text-ink-soft',
              )}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[.82rem] font-semibold text-ink">Time window</div>
        <div className="mt-[.4rem] flex items-center gap-[.5rem]">
          <span className="tabular-nums flex-1 rounded-[11px] border border-accent bg-accent-wash py-[.55rem] text-center text-[.8rem] font-[680] text-accent">
            Start · {windowStart}
          </span>
          <span className="text-[.8rem] text-ink-faint">–</span>
          <span className="tabular-nums flex-1 rounded-[11px] border border-accent bg-accent-wash py-[.55rem] text-center text-[.8rem] font-[680] text-accent">
            End · {windowEnd}
          </span>
        </div>
      </div>

      <Card className="px-[.6rem]">
        <ListRow
          icon={
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-accent-wash text-accent">
              <MapIcon size={15} strokeWidth={2.2} />
            </span>
          }
          title="Areas"
          sub={areas}
          trailing={<ChevronRight size={14} strokeWidth={2.4} className="text-ink-faint" />}
        />
      </Card>

      <Card className="px-[.6rem]">
        <ListRow
          icon={
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-info-wash text-info">
              <CloudRain size={15} strokeWidth={2} />
            </span>
          }
          title="Skip when it rains"
          sub="Waits for the lawn to dry"
          trailing={<Switch checked={rainSkip} onCheckedChange={setRainSkip} aria-label="Skip when it rains" />}
        />
      </Card>

      <Card className="px-[.6rem]">
        <ListRow
          icon={
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-surface-2 text-ink-soft">
              <Moon size={15} strokeWidth={2} />
            </span>
          }
          title="Quiet hours"
          sub="No blade noise 21:00–07:00"
          trailing={<Switch checked={quietHours} onCheckedChange={setQuietHours} aria-label="Quiet hours" />}
        />
      </Card>

      <Card className="px-[.6rem]">
        <ListRow
          icon={
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-surface-2 text-ink-soft">
              <Battery size={15} strokeWidth={2} />
            </span>
          }
          title="Minimum battery"
          sub="Won't start a run below this"
          trailing={
            <Chip variant="ok" className="tabular-nums">
              {minBatteryPct}%
            </Chip>
          }
        />
      </Card>

      <StatePill
        tone="info"
        icon={<Clock size={15} strokeWidth={2.2} />}
        label={`Next: ${nextRun.when}`}
        sub={nextRun.detail}
        className="mb-[.35rem] mt-auto"
      />
    </Sheet>
  );
}
