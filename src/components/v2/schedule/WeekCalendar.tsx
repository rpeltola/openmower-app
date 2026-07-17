import {cn} from '@/components/v2/lib/cn';

export interface WeekCalendarEvent {
  /** 0 = Mon .. 6 = Sun */
  day: number;
  /** Index into `times`. */
  timeRow: number;
  label: string;
}

export interface WeekCalendarProps {
  days: string[];
  times: string[];
  events: WeekCalendarEvent[];
  className?: string;
}

/** Desktop Schedule calendar — recurring runs plotted on a real day/time grid (concept
 *  "Schedule · calendar": a label column + one column per day, one row per time mark). */
export function WeekCalendar({days, times, events, className}: WeekCalendarProps) {
  return (
    <div
      className={cn('grid min-h-0 flex-1', className)}
      style={{
        gridTemplateColumns: `46px repeat(${days.length}, 1fr)`,
        gridTemplateRows: `22px repeat(${times.length}, 1fr)`,
      }}
    >
      {days.map((d, i) => (
        <div
          key={d}
          className="text-center font-mono text-[.62rem] uppercase tracking-[.06em] text-ink-faint"
          style={{gridColumn: i + 2, gridRow: 1}}
        >
          {d}
        </div>
      ))}

      {times.map((t, i) => (
        <div
          key={t}
          className="pr-[.4rem] text-right font-mono text-[.68rem] text-ink-faint"
          style={{gridColumn: 1, gridRow: i + 2}}
        >
          {t}
        </div>
      ))}

      {times.map((t, i) => (
        <div
          key={`line-${t}`}
          className="border-t border-border"
          style={{gridColumn: `2 / ${days.length + 2}`, gridRow: i + 2}}
        />
      ))}

      {events.map((ev) => (
        <div
          key={`${ev.day}-${ev.timeRow}`}
          className="m-0.5 flex items-center justify-center rounded-lg bg-accent text-[.64rem] font-semibold text-white"
          style={{gridColumn: ev.day + 2, gridRow: ev.timeRow + 2}}
        >
          {ev.label}
        </div>
      ))}
    </div>
  );
}
