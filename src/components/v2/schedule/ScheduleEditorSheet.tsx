'use client';

import {cn} from '@/components/v2/lib/cn';
import {AreaPickerList} from '@/components/v2/schedule/AreaPickerList';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {ListRow} from '@/components/v2/ui/ListRow';
import {Sheet} from '@/components/v2/ui/Sheet';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Switch} from '@/components/v2/ui/Switch';
import {TimePicker} from '@/components/v2/ui/TimePicker';
import {Battery, ChevronRight, Clock, CloudRain, Map as MapIcon, Moon} from 'lucide-react';
import {useState} from 'react';

// Mock mow-area list (design-language.md "Cross-platform contract" world, Kotipiha) — the real
// area list will come from the map/zones store once that's wired to Schedule.
const MOW_AREAS = ['Etupiha', 'Takapiha', 'Saunan edessä'];

function areasSummary(selected: string[]): string {
  if (selected.length === 0) return 'No areas selected';
  if (selected.length === MOW_AREAS.length) return 'All areas';
  if (selected.length <= 2) return selected.join(', ');
  return `${selected.length} areas`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) % 1440;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

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
  const [start, setStart] = useState(windowStart);
  const [end, setEnd] = useState(windowEnd);
  const [rainSkip, setRainSkip] = useState(initialRainSkip);
  const [quietHours, setQuietHours] = useState(initialQuietHours);
  // `areas` (the prop) is a free-text summary from the parent; parse it into a starting
  // selection when it names known areas, else default to all (matches "All areas").
  const [selectedAreas, setSelectedAreas] = useState<string[]>(() => {
    if (areas.trim() === 'All areas') return MOW_AREAS;
    const named = areas.split(',').map((a) => a.trim()).filter((a) => MOW_AREAS.includes(a));
    return named.length > 0 ? named : MOW_AREAS;
  });
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [timeField, setTimeField] = useState<'start' | 'end' | null>(null);

  function toggleArea(area: string) {
    setSelectedAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  // Live "what this produces next" preview, recomputed from the editable fields — the day
  // stays whatever `nextRun` (the parent's mock) named, only the time/areas/duration react.
  const previewDay = nextRun.when.split(' ')[0];
  const durationMin = (parseTimeToMinutes(end) - parseTimeToMinutes(start) + 1440) % 1440;
  const livePreview = {
    when: previewDay ? `${previewDay} ${start}` : start,
    detail: `${areasSummary(selectedAreas)} · ~${formatDuration(durationMin)}`,
  };

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
          <Button
            variant="ghost"
            aria-label={`Start time, ${start}`}
            onClick={() => setTimeField('start')}
            className="h-auto flex-1 flex-col items-stretch gap-0 rounded-[11px] border-accent bg-accent-wash px-0 py-[.4rem] text-center hover:border-accent hover:text-accent"
          >
            <span className="block text-[.58rem] font-semibold uppercase tracking-[.08em] text-accent/70">Start</span>
            <span className="tabular-nums text-[.8rem] font-[680] text-accent">{start}</span>
          </Button>
          <span className="text-[.8rem] text-ink-faint">–</span>
          <Button
            variant="ghost"
            aria-label={`End time, ${end}`}
            onClick={() => setTimeField('end')}
            className="h-auto flex-1 flex-col items-stretch gap-0 rounded-[11px] border-accent bg-accent-wash px-0 py-[.4rem] text-center hover:border-accent hover:text-accent"
          >
            <span className="block text-[.58rem] font-semibold uppercase tracking-[.08em] text-accent/70">End</span>
            <span className="tabular-nums text-[.8rem] font-[680] text-accent">{end}</span>
          </Button>
        </div>
      </div>

      <TimePicker
        open={timeField === 'start'}
        onClose={() => setTimeField(null)}
        title="Start time"
        value={start}
        onChange={setStart}
      />
      <TimePicker
        open={timeField === 'end'}
        onClose={() => setTimeField(null)}
        title="End time"
        value={end}
        onChange={setEnd}
      />

      <Card className="px-[.6rem]">
        <ListRow
          icon={
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-accent-wash text-accent">
              <MapIcon size={15} strokeWidth={2.2} />
            </span>
          }
          title="Areas"
          sub={areasSummary(selectedAreas)}
          onClick={() => setAreaPickerOpen((v) => !v)}
          trailing={
            <ChevronRight
              size={14}
              strokeWidth={2.4}
              className={cn('text-ink-faint transition-transform', areaPickerOpen && 'rotate-90')}
            />
          }
        />
      </Card>

      <div
        aria-hidden={!areaPickerOpen}
        inert={!areaPickerOpen}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          areaPickerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <AreaPickerList areas={MOW_AREAS} selected={selectedAreas} onToggle={toggleArea} className="mt-[.35rem]" />
        </div>
      </div>

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
        label={`Next: ${livePreview.when}`}
        sub={livePreview.detail}
        className="mb-[.35rem] mt-auto"
      />
    </Sheet>
  );
}
