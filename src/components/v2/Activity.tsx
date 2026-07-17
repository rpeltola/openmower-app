'use client';

import {EventMap} from '@/components/v2/activity/EventMap';
import {EventTimeline, type TimelineGroup} from '@/components/v2/activity/EventTimeline';
import {RunCard, type RunMetric} from '@/components/v2/activity/RunCard';
import {RunDetail} from '@/components/v2/activity/RunDetail';
import {WeekBarChart, type WeekBarChartBar} from '@/components/v2/activity/WeekBarChart';
import {cn} from '@/components/v2/lib/cn';
import {type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {type ChipProps} from '@/components/v2/ui/Chip';
import {FeedRow} from '@/components/v2/ui/FeedRow';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import {useMowJobs} from '@/hooks/useMowJobs';
import type {MowJob, MowJobStatus} from '@/stores/schemas';
import {formatDuration} from '@/utils/area-utils';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Home as HomeIcon,
  Inbox,
  Loader2,
  Sprout,
} from 'lucide-react';
import {useMemo, useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha. The History
// tab (run list + replay) is wired to real mow jobs via useMowJobs/useJobTimedTrack -- Events
// and Stats below are still the mock dataset. Copy and values match
// docs/concept/openmower-app-concept.html "Activity" slots + openmower-desktop-concept.html
// exactly, reconciled to one dataset shared across breakpoints (the two concept files disagree
// on the third run's exact times/duration — the mobile numbers below are treated as canonical).

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

// Each event's `location` is a mock {x,y} percent position on the garden canvas (same frame
// EventMap/MiniMap draw in) — plausible spots inside the mock garden outline, not real GPS.
const EVENT_GROUPS: TimelineGroup[] = [
  {
    day: 'Today',
    events: [
      {
        id: 'today-rtk-fixed',
        icon: <CheckCircle2 size={14} strokeWidth={2.4} />,
        tone: 'accent' as const,
        type: 'Positioning',
        text: 'RTK fixed — position trusted',
        time: '09:32',
        location: {x: 30, y: 25},
      },
      {
        id: 'today-mow-start',
        icon: <Sprout size={14} strokeWidth={2.2} />,
        tone: 'accent' as const,
        type: 'Mowing',
        text: 'Mowing started · Etupiha',
        time: '09:30',
        location: {x: 25, y: 55},
      },
    ],
  },
  {
    day: 'Yesterday',
    events: [
      {
        id: 'yday-docked',
        icon: <HomeIcon size={13} strokeWidth={2.2} />,
        tone: 'info' as const,
        type: 'Docking',
        text: 'Docked · charging',
        time: '18:10',
        location: {x: 80, y: 58},
      },
      {
        id: 'yday-lifted',
        icon: <AlertTriangle size={14} strokeWidth={2.2} />,
        tone: 'warn' as const,
        type: 'Safety',
        text: 'Lifted — paused, then reset',
        time: '18:04',
        location: {x: 55, y: 75},
      },
      {
        id: 'yday-mow-complete',
        icon: <Check size={14} strokeWidth={2.6} />,
        tone: 'accent' as const,
        type: 'Mowing',
        text: 'Full mow completed · 99%',
        time: '17:58',
        location: {x: 60, y: 35},
      },
    ],
  },
];

const ALL_EVENTS: ActivityEvent[] = EVENT_GROUPS.flatMap((g) => g.events);

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

const WEEK_BARS: WeekBarChartBar[] = [
  {label: 'M', heightPx: 40},
  {label: 'T', heightPx: 3, rest: true},
  {label: 'W', heightPx: 55, highlight: true},
  {label: 'T', heightPx: 24},
  {label: 'F', heightPx: 58},
  {label: 'S', heightPx: 3, rest: true},
  {label: 'S', heightPx: 33},
];

const FORTNIGHT_BARS: WeekBarChartBar[] = [
  {label: 'Ma', heightPx: 56},
  {label: 'Ti', heightPx: 92},
  {label: 'Ke', heightPx: 2, rest: true},
  {label: 'To', heightPx: 112},
  {label: 'Pe', heightPx: 78},
  {label: 'La', heightPx: 42},
  {label: 'Su', heightPx: 98},
  {label: 'Ma', heightPx: 84},
  {label: 'Ti', heightPx: 64},
  {label: 'Ke', heightPx: 2, rest: true},
  {label: 'To', heightPx: 106},
  {label: 'Pe', heightPx: 70},
  {label: 'La', heightPx: 120},
  {label: 'Su', heightPx: 88, highlight: true},
];

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

  const [eventsView, setEventsView] = useState('list');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = ALL_EVENTS.find((e) => e.id === selectedEventId);
  const eventPins = useMemo(
    () =>
      ALL_EVENTS.filter((e) => e.location && e.id).map((e) => ({
        id: e.id!,
        x: e.location!.x,
        y: e.location!.y,
        tone: e.tone,
        icon: e.icon,
      })),
    [],
  );

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
          {eventsView === 'list' ? (
            <EventTimeline groups={EVENT_GROUPS} onSelectEvent={(e) => setSelectedEventId(e.id ?? null)} className="flex-1" />
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
            <KpiTile value="214" unit=" h" label="Mowed" accent />
            <KpiTile value="41,200" unit=" m²" label="Area" />
            <KpiTile value="96" label="Mows" />
          </div>

          {/* ===== Mobile: week bar chart ===== */}
          <div className="flex flex-1 flex-col gap-3 md:hidden">
            <Card className="p-[.85rem]">
              <div className="flex items-center justify-between">
                <span className="text-[.8rem] font-semibold text-ink">Last 7 days</span>
                <span className="font-mono text-[.66rem] text-ink-faint">min / day</span>
              </div>
              <WeekBarChart bars={WEEK_BARS} className="mt-[.6rem]" />
            </Card>
          </div>

          {/* ===== Desktop: fortnight trend ===== */}
          <div className="hidden min-h-0 flex-1 md:flex md:flex-col">
            <Card className="flex flex-1 flex-col p-4">
              <div className="mb-3.5 flex items-baseline justify-between">
                <span className="font-mono text-[.7rem] uppercase tracking-wide text-ink-faint">
                  Last 14 days · minutes mowed
                </span>
                <span className="font-mono text-[.7rem] text-ink-faint">avg 46 min/day</span>
              </div>
              <WeekBarChart bars={FORTNIGHT_BARS} chartHeightPx={130} className="flex-1" />
            </Card>
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
