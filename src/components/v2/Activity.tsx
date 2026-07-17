'use client';

import {ActivityWearMeter} from '@/components/v2/activity/ActivityWearMeter';
import {EventMap} from '@/components/v2/activity/EventMap';
import {EventTimeline, type TimelineGroup} from '@/components/v2/activity/EventTimeline';
import {RunCard, type RunMetric} from '@/components/v2/activity/RunCard';
import {RunDetail} from '@/components/v2/activity/RunDetail';
import {WeekBarChart, type WeekBarChartBar} from '@/components/v2/activity/WeekBarChart';
import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {type ChipProps} from '@/components/v2/ui/Chip';
import {FeedRow} from '@/components/v2/ui/FeedRow';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import {useMowJobs} from '@/hooks/useMowJobs';
import {useSelectedMowerEventsForDate, useSelectedMowerIsDateLoaded} from '@/hooks/useMowerEvents';
import {useStatsRange} from '@/hooks/useStatsRange';
import {mowerEventsToActivityEvents} from '@/lib/v2/events';
import {getTodayDateKey} from '@/stores/mowerEvents';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import type {BladeStatus, MowJob, MowJobStatus, StatsPerDay} from '@/stores/schemas';
import {formatDuration} from '@/utils/area-utils';
import {ChevronLeft, Inbox, Loader2} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha. The History
// tab (run list + replay) is wired to real mow jobs via useMowJobs/useJobTimedTrack; Events
// are real events (see hooks/useMowerEvents + lib/v2/events) and Stats are real per-day/blade
// numbers (see hooks/useStatsRange). Copy/layout match docs/concept/openmower-app-concept.html
// "Activity" slots + openmower-desktop-concept.html, reconciled to one dataset shared across
// breakpoints.

const TABS = [
  {value: 'events', label: 'Events'},
  {value: 'history', label: 'History'},
  {value: 'stats', label: 'Stats'},
];

const RANGE_OPTIONS = [
  {value: 'week', label: 'Week'},
  {value: 'month', label: 'Month'},
  {value: 'all', label: 'All'},
];

const EVENTS_VIEW_OPTIONS = [
  {value: 'list', label: 'List'},
  {value: 'map', label: 'Map'},
];

/** Yesterday's date key, alongside getTodayDateKey (stores/mowerEvents) -- the Events tab
 *  only ever shows these two day groups (matching the concept), so both are fixed hook calls
 *  rather than a variable-length loop over `availableDates`. */
function getYesterdayDateKey(now = new Date()): string {
  return getTodayDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

interface RunView {
  /** The real job_id (see MowJob) -- threaded to RunCard/RunDetail/ReplayCard. */
  id: string;
  plan: string;
  statusLabel: string;
  statusVariant: ChipProps['variant'];
  dayLabel: string;
  startTime: string;
  endTime: string;
  scope: string;
  metrics: [RunMetric, RunMetric, RunMetric];
}

/** History run window: last 30 days of mow jobs (see useMowJobs). */
const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function jobStatusLabel(status: MowJob['status']): string {
  switch (status as MowJobStatus) {
    case 'completed':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'superseded':
      return 'Superseded';
    default:
      return status;
  }
}

function jobStatusVariant(status: MowJob['status']): ChipProps['variant'] {
  switch (status as MowJobStatus) {
    case 'completed':
      return 'ok';
    case 'running':
      return 'info';
    case 'failed':
      return 'danger';
    case 'superseded':
      return 'warn';
    default:
      return 'neutral';
  }
}

function formatClockTime(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

/** Maps a real MowJob (see useMowJobs) to the shape RunCard/RunDetail render. MowJob has no
 *  plan name or coverage percentage, so "plan"/"scope" fall back to the areas driven (whole
 *  garden when `area_ids` is empty), and the third KPI slot is the job's average battery when
 *  known, else its path length -- never a fabricated coverage number. */
function toRunView(job: MowJob): RunView {
  const areaCount = job.area_ids.length;
  const scope = areaCount === 0 ? 'all areas' : `${areaCount} area${areaCount === 1 ? '' : 's'}`;
  const thirdMetric: RunMetric =
    job.avg_battery_pct != null
      ? {value: Math.round(job.avg_battery_pct), unit: ' %', label: 'Avg battery'}
      : {value: Math.round(job.path_length_m), unit: ' m', label: 'Path'};

  return {
    id: job.id,
    plan: areaCount === 0 ? 'Full mow' : scope,
    statusLabel: jobStatusLabel(job.status),
    statusVariant: jobStatusVariant(job.status),
    dayLabel: new Date(job.started_at * 1000).toLocaleDateString(undefined, {weekday: 'short'}),
    startTime: formatClockTime(job.started_at),
    endTime: job.ended_at != null ? formatClockTime(job.ended_at) : '…',
    scope,
    metrics: [
      {value: Math.round(job.area_m2).toLocaleString(), unit: ' m²', label: 'Area'},
      {value: formatDuration(job.duration_s), label: 'Duration'},
      thirdMetric,
    ],
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
// The bar chart always looks back 14 days regardless of the Week/Month/All toggle above it
// (that toggle scopes the three KPI tiles instead, via rangeForToggle) -- the mobile "Last 7
// days" card just shows the most recent half of the same window.
const CHART_WINDOW_DAYS = 14;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `range` toggle -> a `useStatsRange` window. 0,0 means "lifetime" per the query/stats
 *  contract (see useStatsRange / GetStats service). */
function rangeForToggle(range: string, nowMs: number): {from: number; to: number} {
  switch (range) {
    case 'week':
      return {from: nowMs - 7 * DAY_MS, to: nowMs};
    case 'month':
      return {from: nowMs - 30 * DAY_MS, to: nowMs};
    default:
      return {from: 0, to: 0};
  }
}

/** Fills the last `days` calendar days (oldest first, today last) from the sparse per-day
 *  rollup, defaulting missing days to 0 minutes mowed -- a day the backend never reported is
 *  as good as a day it mowed nothing, so this isn't a fabricated number, just a real zero. */
function dailyMinutes(perDay: StatsPerDay[] | undefined, days: number, nowMs: number): {date: Date; minutes: number}[] {
  const byDate = new Map((perDay ?? []).map((d) => [d.date, d.mowed_hours * 60]));
  return Array.from({length: days}, (_, i) => {
    const date = new Date(nowMs - (days - 1 - i) * DAY_MS);
    return {date, minutes: byDate.get(toDateKey(date)) ?? 0};
  });
}

/** Scales a day window to WeekBarChart's per-day pixel heights, tallest day filling `maxPx`;
 *  today (the last entry) is always the highlighted bar. */
function toWeekBars(entries: {date: Date; minutes: number}[], maxPx: number): WeekBarChartBar[] {
  const peak = Math.max(0, ...entries.map((e) => e.minutes));
  return entries.map((e, i) => ({
    label: e.date.toLocaleDateString(undefined, {weekday: 'narrow'}),
    heightPx: peak > 0 ? Math.max(3, Math.round((e.minutes / peak) * maxPx)) : 0,
    rest: e.minutes <= 0,
    highlight: i === entries.length - 1,
  }));
}

/** ActivityWearMeter's detail line -- mirrors BladeWearCard's (components/stats) copy. */
function bladeWearDetail(blade: BladeStatus): string {
  if (blade.due) return 'Change interval reached';
  const remaining = Math.max(0, blade.interval_hours - blade.total_hours);
  return `Replace around ${Math.round(blade.interval_hours)} h · ~${remaining.toFixed(1)} h remaining`;
}

export function Activity() {
  const [tab, setTab] = useState('events');
  const [range, setRange] = useState('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mobileHistoryView, setMobileHistoryView] = useState<'list' | 'detail'>('list');

  // Anchored once per mount, not recomputed every render -- useMowJobs refetches whenever
  // fromMs/toMs change, so a live Date.now() here would loop.
  const nowMs = useMemo(() => Date.now(), []);
  const {jobs, loading: jobsLoading, error: jobsError} = useMowJobs(nowMs - HISTORY_WINDOW_MS, nowMs);
  const runs = useMemo(() => jobs.map(toRunView), [jobs]);
  // Falls back to the first run whenever nothing (or a stale id) is selected; only read once
  // `runs.length > 0` is established below.
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0];

  // Real events: the tab only ever shows Today + Yesterday (matching the concept), so both
  // are fixed hook calls rather than looping over useSelectedMowerAvailableDates().
  const mowerId = useSelectedMower((m) => m?.id);
  const fetchEventsForDate = useMowersStore((s) => s.fetchEventsForDate);
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const yesterdayKey = useMemo(() => getYesterdayDateKey(), []);
  const todayEvents = useSelectedMowerEventsForDate(todayKey);
  const yesterdayEvents = useSelectedMowerEventsForDate(yesterdayKey);
  const todayLoaded = useSelectedMowerIsDateLoaded(todayKey);
  const yesterdayLoaded = useSelectedMowerIsDateLoaded(yesterdayKey);
  const [eventsAttempted, setEventsAttempted] = useState(false);

  // Fetch both days explicitly. Live events also seed today via the events/json subscription, but
  // the historical `events.history` RPC may be absent on an older/idle gateway (returns "Method
  // not found") — fetchEventsForDate swallows that WITHOUT marking the date loaded, so gating the
  // loading state on isDateLoaded would hang on "Loading" forever. Track our own "attempted" flag
  // (the fetch promise resolves either way) and fall through to the empty state instead.
  useEffect(() => {
    if (!mowerId) return;
    let cancelled = false;
    Promise.all([
      todayLoaded ? Promise.resolve() : fetchEventsForDate(mowerId, todayKey),
      yesterdayLoaded ? Promise.resolve() : fetchEventsForDate(mowerId, yesterdayKey),
    ]).finally(() => {
      if (!cancelled) setEventsAttempted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mowerId, todayKey, yesterdayKey, todayLoaded, yesterdayLoaded, fetchEventsForDate]);

  // Converted together so the map pins for both days share one bounding box (see
  // mowerEventsToActivityEvents) -- otherwise Today's and Yesterday's pins would be
  // normalized against different scales and not read as one consistent layout.
  const convertedEvents = useMemo(
    () => mowerEventsToActivityEvents([...todayEvents, ...yesterdayEvents]),
    [todayEvents, yesterdayEvents],
  );
  const todayActivityEvents = convertedEvents.slice(0, todayEvents.length);
  const yesterdayActivityEvents = convertedEvents.slice(todayEvents.length);
  const eventGroups: TimelineGroup[] = useMemo(() => {
    const groups: TimelineGroup[] = [];
    if (todayActivityEvents.length > 0) groups.push({day: 'Today', events: todayActivityEvents});
    if (yesterdayActivityEvents.length > 0) groups.push({day: 'Yesterday', events: yesterdayActivityEvents});
    return groups;
  }, [todayActivityEvents, yesterdayActivityEvents]);
  const eventsLoading = Boolean(mowerId) && !eventsAttempted && eventGroups.length === 0;

  const [eventsView, setEventsView] = useState('list');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = convertedEvents.find((e) => e.id === selectedEventId);
  const eventPins = useMemo(
    () =>
      convertedEvents
        .filter((e) => e.location && e.id)
        .map((e) => ({id: e.id!, x: e.location!.x, y: e.location!.y, tone: e.tone, icon: e.icon})),
    [convertedEvents],
  );

  // Stats: the Week/Month/All toggle scopes the three KPI tiles; the bar chart always looks
  // back CHART_WINDOW_DAYS regardless of it (see rangeForToggle / dailyMinutes).
  const {from: rangeFrom, to: rangeTo} = useMemo(() => rangeForToggle(range, nowMs), [range, nowMs]);
  const {data: rangeStats} = useStatsRange(rangeFrom, rangeTo);
  const {data: chartStats} = useStatsRange(nowMs - CHART_WINDOW_DAYS * DAY_MS, nowMs);
  const chartDays = useMemo(() => dailyMinutes(chartStats?.per_day, CHART_WINDOW_DAYS, nowMs), [chartStats, nowMs]);
  const weekBars = useMemo(() => toWeekBars(chartDays.slice(-7), 58), [chartDays]);
  const fortnightBars = useMemo(() => toWeekBars(chartDays, 120), [chartDays]);
  const avgMinutesPerDay = chartStats ? Math.round(chartDays.reduce((sum, d) => sum + d.minutes, 0) / chartDays.length) : null;

  const mower = useSelectedMower((m) => m);
  const bladeStatus = useSelectedMower((m) => m?.stats?.blade ?? null);

  function openRunDetail(id: string) {
    setSelectedRunId(id);
    setMobileHistoryView('detail');
  }

  const showMobileRunDetail = tab === 'history' && mobileHistoryView === 'detail';

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:h-full md:min-h-0 md:gap-4 md:p-6">
      <ScreenHeader
        kicker="Kotipiha"
        title="Activity"
        actions={
          showMobileRunDetail ? (
            <Button
              variant="soft"
              size="icon"
              aria-label="Back to history"
              className="md:hidden"
              onClick={() => setMobileHistoryView('list')}
            >
              <ChevronLeft size={18} strokeWidth={2.4} />
            </Button>
          ) : undefined
        }
      />

      {/* Mobile: hidden while the run-detail drill-in is open, so it reads as a full-screen view. */}
      <SegmentedToggle
        options={TABS}
        value={tab}
        onChange={setTab}
        className={cn('md:w-fit', showMobileRunDetail && 'hidden md:block')}
      />

      {tab === 'events' ? (
        <>
          <SegmentedToggle options={EVENTS_VIEW_OPTIONS} value={eventsView} onChange={setEventsView} className="md:w-fit" />
          {eventsLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 py-10 text-ink-faint">
              <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
              <span className="text-[.82rem]">Loading events…</span>
            </div>
          ) : eventGroups.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
              <Inbox size={22} strokeWidth={1.8} className="text-ink-faint" />
              <p className="text-[.86rem] font-semibold text-ink">No events yet</p>
              <p className="max-w-[240px] text-[.78rem] text-ink-soft">
                Events will show up here as the mower boots, mows, and docks.
              </p>
            </div>
          ) : eventsView === 'list' ? (
            <EventTimeline groups={eventGroups} onSelectEvent={(e) => setSelectedEventId(e.id ?? null)} className="flex-1" />
          ) : (
            <div className="flex flex-col gap-2 md:max-w-[720px]">
              <EventMap
                pins={eventPins}
                selectedId={selectedEventId ?? undefined}
                onSelectPin={setSelectedEventId}
              />
              <p className="text-[.76rem] text-ink-faint">Tap a pin to see what happened there.</p>
            </div>
          )}
        </>
      ) : null}

      {tab === 'history' ? (
        jobsLoading && runs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-10 text-ink-faint">
            <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
            <span className="text-[.82rem]">Loading history…</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
            <Inbox size={22} strokeWidth={1.8} className="text-ink-faint" />
            <p className="text-[.86rem] font-semibold text-ink">No runs yet</p>
            <p className="max-w-[240px] text-[.78rem] text-ink-soft">
              {jobsError ? 'Could not load run history.' : 'Runs will show up here once the mower finishes a job.'}
            </p>
          </div>
        ) : (
          <>
            {/* ===== Mobile: run cards, or a run's full-screen detail drill-in ===== */}
            <div className="flex flex-1 flex-col gap-2.5 md:hidden">
              {mobileHistoryView === 'list' ? (
                runs.map((run) => (
                  <RunCard
                    key={run.id}
                    jobId={run.id}
                    onSelect={() => openRunDetail(run.id)}
                    plan={run.plan}
                    statusLabel={run.statusLabel}
                    statusVariant={run.statusVariant}
                    timestamp={`${run.dayLabel} · ${run.startTime}–${run.endTime}`}
                    metrics={run.metrics}
                  />
                ))
              ) : (
                <RunDetail
                  jobId={selectedRun.id}
                  plan={selectedRun.plan}
                  statusLabel={selectedRun.statusLabel}
                  statusVariant={selectedRun.statusVariant}
                  timeRange={`${selectedRun.dayLabel} ${selectedRun.startTime} – ${selectedRun.endTime} · ${selectedRun.scope}`}
                  metrics={selectedRun.metrics}
                  events={[]}
                  className="flex-1"
                />
              )}
            </div>

            {/* ===== Desktop: run list + detail pane, side by side ===== */}
            <div className="hidden min-h-0 flex-1 gap-4 md:flex">
              <div className="flex w-[300px] flex-none flex-col gap-2.5 overflow-y-auto pr-0.5">
                {runs.map((run) => (
                  <RunCard
                    key={run.id}
                    jobId={run.id}
                    compact
                    selected={run.id === selectedRun.id}
                    onSelect={() => setSelectedRunId(run.id)}
                    plan={run.plan}
                    statusLabel={run.statusLabel}
                    statusVariant={run.statusVariant}
                    timestamp={`${run.dayLabel} · ${run.startTime}`}
                    metrics={run.metrics}
                  />
                ))}
              </div>
              <RunDetail
                jobId={selectedRun.id}
                plan={selectedRun.plan}
                statusLabel={selectedRun.statusLabel}
                statusVariant={selectedRun.statusVariant}
                timeRange={`${selectedRun.dayLabel} ${selectedRun.startTime} – ${selectedRun.endTime} · ${selectedRun.scope}`}
                metrics={selectedRun.metrics}
                events={[]}
                className="flex-1"
              />
            </div>
          </>
        )
      ) : null}

      {tab === 'stats' ? (
        <>
          <SegmentedToggle options={RANGE_OPTIONS} value={range} onChange={setRange} className="md:w-fit" />

          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <KpiTile value={rangeStats ? rangeStats.mowed_hours.toFixed(1) : '—'} unit=" h" label="Mowed" accent />
            <KpiTile
              value={rangeStats ? Math.round(rangeStats.mowed_m2).toLocaleString() : '—'}
              unit=" m²"
              label="Area"
            />
            <KpiTile value={rangeStats ? `${rangeStats.mow_count}` : '—'} label="Mows" />
          </div>

          {/* ===== Mobile: week bar chart + blade wear ===== */}
          <div className="flex flex-1 flex-col gap-3 md:hidden">
            <Card className="p-[.85rem]">
              <div className="flex items-center justify-between">
                <span className="text-[.8rem] font-semibold text-ink">Last 7 days</span>
                <span className="font-mono text-[.66rem] text-ink-faint">min / day</span>
              </div>
              <WeekBarChart bars={weekBars} className="mt-[.6rem]" />
            </Card>
            {bladeStatus && bladeStatus.interval_hours > 0 ? (
              <ActivityWearMeter
                hours={Math.round(bladeStatus.total_hours * 10) / 10}
                capacityHours={bladeStatus.interval_hours}
                detail={bladeWearDetail(bladeStatus)}
                onChangedBlades={() => mower?.publishBladeReset()}
              />
            ) : (
              <Card className="p-[.85rem] text-[.82rem] text-ink-faint">No blade data yet.</Card>
            )}
          </div>

          {/* ===== Desktop: fortnight trend + blade wear ===== */}
          <div className="hidden min-h-0 flex-1 gap-4 md:flex">
            <Card className="flex flex-1 flex-col p-4">
              <div className="mb-3.5 flex items-baseline justify-between">
                <span className="font-mono text-[.7rem] uppercase tracking-wide text-ink-faint">
                  Last 14 days · minutes mowed
                </span>
                <span className="font-mono text-[.7rem] text-ink-faint">
                  {avgMinutesPerDay !== null ? `avg ${avgMinutesPerDay} min/day` : '—'}
                </span>
              </div>
              <WeekBarChart bars={fortnightBars} chartHeightPx={130} className="flex-1" />
            </Card>
            {bladeStatus && bladeStatus.interval_hours > 0 ? (
              <ActivityWearMeter
                hours={Math.round(bladeStatus.total_hours * 10) / 10}
                capacityHours={bladeStatus.interval_hours}
                detail={bladeWearDetail(bladeStatus)}
                onChangedBlades={() => mower?.publishBladeReset()}
                className="w-[240px] flex-none"
              />
            ) : (
              <Card className="w-[240px] flex-none p-4 text-[.82rem] text-ink-faint">No blade data yet.</Card>
            )}
          </div>
        </>
      ) : null}

      <Sheet open={!!selectedEvent} onClose={() => setSelectedEventId(null)} title={selectedEvent?.type ?? 'Event'}>
        {selectedEvent ? (
          <div className="flex flex-col gap-3">
            {selectedEvent.location ? (
              <EventMap
                pins={[
                  {
                    id: selectedEvent.id ?? selectedEvent.text,
                    x: selectedEvent.location.x,
                    y: selectedEvent.location.y,
                    tone: selectedEvent.tone,
                    icon: selectedEvent.icon,
                  },
                ]}
                selectedId={selectedEvent.id}
                className="mx-auto max-w-[280px]"
              />
            ) : null}
            <Card className="p-0">
              <FeedRow
                icon={selectedEvent.icon}
                tone={selectedEvent.tone}
                text={selectedEvent.text}
                time={selectedEvent.time}
                className="px-3"
              />
            </Card>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
