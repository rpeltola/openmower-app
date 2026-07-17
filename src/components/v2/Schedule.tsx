'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {ListRow} from '@/components/v2/ui/ListRow';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Switch} from '@/components/v2/ui/Switch';
import {NextScheduledCard} from '@/components/v2/ui/NextScheduledCard';
import {ScheduleEditorSheet} from '@/components/v2/schedule/ScheduleEditorSheet';
import {SelectedScheduleCard} from '@/components/v2/schedule/SelectedScheduleCard';
import {WeekCalendar, type WeekCalendarEvent} from '@/components/v2/schedule/WeekCalendar';
import {WeekGrid} from '@/components/v2/schedule/WeekGrid';
import {Clock, CloudRain, Play, Plus} from 'lucide-react';
import {useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha, one
// recurring rule "Weekday mornings" — Mon/Wed/Fri 10:00–12:00, all areas, rain-skip on.
// Values match docs/concept/openmower-app-concept.html and openmower-desktop-concept.html
// Schedule panels exactly. Mock data only — this screen wires no MQTT yet.
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ACTIVE_DAYS = [true, false, true, false, true, false, false]; // Mon, Wed, Fri
const TODAY_INDEX = 2; // Wed

const SCHEDULE = {
  name: 'Weekday mornings',
  windowStart: '10:00',
  windowEnd: '12:00',
  areas: 'All areas',
  minBatteryPct: 30,
};

const NEXT_RUN = {when: 'Wed 10:00', detail: 'All areas · ~1 h 40 min'};

const CAL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAL_TIMES = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
const CAL_EVENTS: WeekCalendarEvent[] = [
  {day: 0, timeRow: 2, label: 'All areas'},
  {day: 2, timeRow: 2, label: 'All areas'},
  {day: 4, timeRow: 2, label: 'All areas'},
];

export function Schedule() {
  const [rainSkip, setRainSkip] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-5 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Schedule"
        actions={
          <>
            <Button
              variant="soft"
              size="icon"
              className="md:hidden"
              aria-label="New schedule"
              onClick={() => setEditorOpen(true)}
            >
              <Plus size={17} strokeWidth={2.4} />
            </Button>
            <Button variant="ghost" className="hidden md:inline-flex">
              <Play size={14} fill="currentColor" />
              Mow all now
            </Button>
            <Button variant="primary" className="hidden md:inline-flex" onClick={() => setEditorOpen(true)}>
              <Plus size={14} strokeWidth={2.4} />
              New schedule
            </Button>
          </>
        }
      />

      {/* ===== Mobile: the weekly plan ("a real weekly plan") ===== */}
      <div className="flex flex-1 flex-col gap-3 md:hidden">
        <StatePill
          tone="info"
          icon={<Clock size={15} strokeWidth={2.2} />}
          label={`Next run · ${NEXT_RUN.when}`}
          sub={NEXT_RUN.detail}
        />

        <WeekGrid
          days={DAY_LETTERS.map((label, i) => ({label, active: ACTIVE_DAYS[i], today: i === TODAY_INDEX}))}
          windowLabel={`${SCHEDULE.windowStart} – ${SCHEDULE.windowEnd} window`}
          onClick={() => setEditorOpen(true)}
        />

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

        <Button
          variant="ghost"
          className={cn(
            'mt-auto justify-center gap-2 border border-accent bg-accent-wash font-[680] text-accent',
            'hover:brightness-95 dark:hover:brightness-110',
          )}
        >
          <Play size={17} fill="currentColor" />
          Mow all areas now
        </Button>
      </div>

      {/* ===== Desktop: the week as a real calendar ("plan the week, not just today") ===== */}
      <div className="hidden md:flex md:min-h-0 md:flex-1 md:gap-4">
        <Card className="flex flex-1 flex-col p-4">
          <div className="mb-[.7rem] font-mono text-[.62rem] uppercase tracking-[.08em] text-ink-faint">
            This week
          </div>
          <WeekCalendar days={CAL_DAYS} times={CAL_TIMES} events={CAL_EVENTS} />
        </Card>

        <div className="flex w-[312px] flex-none flex-col gap-4">
          <SelectedScheduleCard
            name={SCHEDULE.name}
            dayLabels={['Mon', 'Wed', 'Fri']}
            windowLabel={`${SCHEDULE.windowStart}–${SCHEDULE.windowEnd}`}
            areas={SCHEDULE.areas}
            rainSkip={rainSkip}
            quietHours={false}
            minBatteryPct={SCHEDULE.minBatteryPct}
          />
          <NextScheduledCard
            label="Next run"
            when={NEXT_RUN.when}
            detail={NEXT_RUN.detail}
            onEdit={() => setEditorOpen(true)}
          />
        </div>
      </div>

      <ScheduleEditorSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        name={SCHEDULE.name}
        dayLabels={DAY_LETTERS}
        activeDays={ACTIVE_DAYS}
        windowStart={SCHEDULE.windowStart}
        windowEnd={SCHEDULE.windowEnd}
        areas={SCHEDULE.areas}
        nextRun={NEXT_RUN}
        initialRainSkip={rainSkip}
        minBatteryPct={SCHEDULE.minBatteryPct}
      />
    </div>
  );
}
