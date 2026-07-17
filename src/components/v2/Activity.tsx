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
import {AlertTriangle, Check, CheckCircle2, ChevronLeft, Home as HomeIcon, Sprout} from 'lucide-react';
import {useMemo, useState} from 'react';

// Canonical mock world (design-language.md "Cross-platform contract"): Kotipiha. Mock
// telemetry/history only — this screen wires no MQTT/persistence yet. Copy and values match
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

interface Run {
  id: string;
  plan: string;
  statusLabel: string;
  statusVariant: ChipProps['variant'];
  dayLabel: string;
  startTime: string;
  endTime: string;
  scope: string;
  area: string;
  duration: string;
  coveragePct: number;
  completed: boolean;
  events: ActivityEvent[];
}

const RUNS: Run[] = [
  {
    id: 'mon-full-mow',
    plan: 'Full mow',
    statusLabel: 'Completed',
    statusVariant: 'ok',
    dayLabel: 'Mon',
    startTime: '09:30',
    endTime: '11:22',
    scope: 'all areas',
    area: '1,542',
    duration: '1h 52m',
    coveragePct: 99,
    completed: true,
    events: [
      {icon: <Sprout size={13} strokeWidth={2.2} />, tone: 'accent', text: 'Mowing started', time: '09:30'},
      {
        icon: <CheckCircle2 size={13} strokeWidth={2.4} />,
        tone: 'accent',
        text: 'RTK fixed — position trusted',
        time: '09:31',
      },
      {icon: <HomeIcon size={13} strokeWidth={2.2} />, tone: 'info', text: 'Docked · charging complete', time: '11:22'},
    ],
  },
  {
    id: 'sat-etupiha',
    plan: 'Etupiha',
    statusLabel: 'Manual-stop',
    statusVariant: 'warn',
    dayLabel: 'Sat',
    startTime: '14:05',
    endTime: '14:43',
    scope: 'Etupiha',
    area: '235',
    duration: '38m',
    coveragePct: 46,
    completed: false,
    events: [
      {icon: <Sprout size={13} strokeWidth={2.2} />, tone: 'accent', text: 'Mowing started', time: '14:05'},
      {
        icon: <CheckCircle2 size={13} strokeWidth={2.4} />,
        tone: 'accent',
        text: 'RTK fixed — position trusted',
        time: '14:06',
      },
      {icon: <AlertTriangle size={13} strokeWidth={2.2} />, tone: 'warn', text: 'Stopped manually', time: '14:43'},
    ],
  },
  {
    id: 'thu-full-mow',
    plan: 'Full mow',
    statusLabel: 'Completed',
    statusVariant: 'ok',
    dayLabel: 'Thu',
    startTime: '08:40',
    endTime: '10:43',
    scope: 'all areas',
    area: '1,529',
    duration: '2h 03m',
    coveragePct: 98,
    completed: true,
    events: [
      {icon: <Sprout size={13} strokeWidth={2.2} />, tone: 'accent', text: 'Mowing started', time: '08:40'},
      {
        icon: <CheckCircle2 size={13} strokeWidth={2.4} />,
        tone: 'accent',
        text: 'RTK fixed — position trusted',
        time: '08:41',
      },
      {icon: <HomeIcon size={13} strokeWidth={2.2} />, tone: 'info', text: 'Docked · charging complete', time: '10:43'},
    ],
  },
];

function runMetrics(run: Run): [RunMetric, RunMetric, RunMetric] {
  return [
    {value: run.area, unit: ' m²', label: 'Area'},
    {value: run.duration, label: 'Duration'},
    {value: run.coveragePct, unit: ' %', label: 'Coverage', accent: run.completed},
  ];
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
  const [selectedRunId, setSelectedRunId] = useState(RUNS[0].id);
  const [mobileHistoryView, setMobileHistoryView] = useState<'list' | 'detail'>('list');
  const selectedRun = RUNS.find((r) => r.id === selectedRunId) ?? RUNS[0];

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
        <>
          {/* ===== Mobile: run cards, or a run's full-screen detail drill-in ===== */}
          <div className="flex flex-1 flex-col gap-2.5 md:hidden">
            {mobileHistoryView === 'list' ? (
              RUNS.map((run) => (
                <RunCard
                  key={run.id}
                  onSelect={() => openRunDetail(run.id)}
                  plan={run.plan}
                  statusLabel={run.statusLabel}
                  statusVariant={run.statusVariant}
                  timestamp={`${run.dayLabel} · ${run.startTime}–${run.endTime}`}
                  metrics={runMetrics(run)}
                />
              ))
            ) : (
              <RunDetail
                plan={selectedRun.plan}
                statusLabel={selectedRun.statusLabel}
                statusVariant={selectedRun.statusVariant}
                timeRange={`${selectedRun.dayLabel} ${selectedRun.startTime} – ${selectedRun.endTime} · ${selectedRun.scope}`}
                coveragePct={selectedRun.coveragePct}
                areaM2={selectedRun.area}
                duration={selectedRun.duration}
                events={selectedRun.events}
                className="flex-1"
              />
            )}
          </div>

          {/* ===== Desktop: run list + detail pane, side by side ===== */}
          <div className="hidden min-h-0 flex-1 gap-4 md:flex">
            <div className="flex w-[300px] flex-none flex-col gap-2.5 overflow-y-auto pr-0.5">
              {RUNS.map((run) => (
                <RunCard
                  key={run.id}
                  compact
                  selected={run.id === selectedRunId}
                  onSelect={() => setSelectedRunId(run.id)}
                  plan={run.plan}
                  statusLabel={run.statusLabel}
                  statusVariant={run.statusVariant}
                  timestamp={`${run.dayLabel} · ${run.startTime}`}
                  metrics={runMetrics(run)}
                />
              ))}
            </div>
            <RunDetail
              plan={selectedRun.plan}
              statusLabel={selectedRun.statusLabel}
              statusVariant={selectedRun.statusVariant}
              timeRange={`${selectedRun.dayLabel} ${selectedRun.startTime} – ${selectedRun.endTime} · ${selectedRun.scope}`}
              coveragePct={selectedRun.coveragePct}
              areaM2={selectedRun.area}
              duration={selectedRun.duration}
              events={selectedRun.events}
              className="flex-1"
            />
          </div>
        </>
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
