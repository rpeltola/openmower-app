'use client';

import {cn} from '@/components/v2/lib/cn';
import {useBreakpoint} from '@/components/v2/lib/useBreakpoint';
import {mapDataToZones} from '@/components/v2/map/realData';
import {MOCK_ORIGIN, type Zone} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {Scrubber} from '@/components/v2/ui/Scrubber';
import {SegmentedToggle, type SegmentedToggleOption} from '@/components/v2/ui/SegmentedToggle';
import {useJobTimedTrack} from '@/hooks/useJobTimedTrack';
import type {Origin} from '@/lib/v2/geo/projection';
import {useSelectedMower} from '@/stores/mowersStore';
import {sampleTimedTrackAt} from '@/utils/replay-track';
import {Pause, Play} from 'lucide-react';
import dynamic from 'next/dynamic';
import {useEffect, useMemo, useRef, useState} from 'react';

const ReplayMap = dynamic(() => import('@/components/v2/activity/ReplayMap').then((m) => m.ReplayMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

export interface ReplayCardProps {
  /** The real job_id (see MowJob) -- null while no run is selected/available. */
  jobId: string | null;
  className?: string;
}

/** Wall-clock time a full replay takes to play through at 1x, independent of the run's real
 *  length -- scaled by the speed switcher below. */
const PLAYBACK_MS = 15000;

type ReplaySpeed = '0.5' | '1' | '2';

const SPEED_OPTIONS: SegmentedToggleOption[] = [
  {value: '0.5', label: '0.5×'},
  {value: '1', label: '1×'},
  {value: '2', label: '2×'},
];

const SPEED_RATE: Record<ReplaySpeed, number> = {'0.5': 0.5, '1': 1, '2': 2};

/** Sentinel fit-key for "no run selected", distinct from any real job_id string. */
const NO_JOB_FIT_KEY = '__no-job__';

function formatClock(totalSeconds: number, seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (totalSeconds >= 3600) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Run replay (concept "Watch the run, not just the number"): the driven track over the REAL
 *  garden map (satellite basemap + real area outlines, via ReplayMap) with an animated playhead
 *  fit to the job's real telemetry (useJobTimedTrack), a play/pause + scrubber transport, and a
 *  speed switcher -- paced by the track's OWN timestamps, so a paused stretch of the run barely
 *  moves the marker while a fast stretch flies by. Jobs with no timed track (predates job_track,
 *  or still the live job) fall back to a plain "no track" placeholder over the bare map -- never
 *  a fabricated path. */
export function ReplayCard({jobId, className}: ReplayCardProps) {
  const {points, loading} = useJobTimedTrack(jobId);
  const [pct, setPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>('1');
  const reducedMotion = useBreakpoint('(prefers-reduced-motion: reduce)');
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const hasTrack = points.length > 0;

  // The map's real GPS datum becomes the projection origin once the mower has reported one;
  // MOCK_ORIGIN otherwise (no mower selected / no fix yet), matching Map.tsx's own fallback.
  const mapData = useSelectedMower((s) => s?.map);
  const datumLat = mapData?.datum?.lat;
  const datumLng = mapData?.datum?.long;
  const origin: Origin = useMemo(
    () => (datumLat !== undefined && datumLng !== undefined ? {lat: datumLat, lng: datumLng} : MOCK_ORIGIN),
    [datumLat, datumLng],
  );
  // No mower/no map -> no real areas to draw; never falls back to the mock zones (this is a
  // display of the mower's ACTUAL garden, not a style preview).
  const zones: Zone[] = useMemo(() => (mapData ? mapDataToZones(mapData) : []), [mapData]);

  // A newly selected run always starts its replay from the beginning, paused.
  useEffect(() => {
    setPct(0);
    setIsPlaying(false);
  }, [jobId]);

  useEffect(() => {
    if (reducedMotion) setIsPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPct((p) => {
        const next = p + (dt / PLAYBACK_MS) * 100 * SPEED_RATE[speedRef.current];
        if (next >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const startedAt = hasTrack ? points[0].t : 0;
  const endedAt = hasTrack ? points[points.length - 1].t : 0;
  const totalSeconds = Math.max(0, endedAt - startedAt);
  const elapsedSeconds = (pct / 100) * totalSeconds;
  const currentT = startedAt + elapsedSeconds;

  const playheadPoint = hasTrack ? (sampleTimedTrackAt(points, currentT)?.point ?? null) : null;

  function togglePlay() {
    if (!isPlaying && pct >= 100) setPct(0);
    setIsPlaying((p) => !p);
  }

  return (
    <>
      <Card className={cn('relative min-h-[160px] flex-1 overflow-hidden p-0', className)}>
        <ReplayMap
          origin={origin}
          zones={zones}
          points={points}
          playheadPoint={playheadPoint}
          fitKey={jobId ?? NO_JOB_FIT_KEY}
          className="absolute inset-0 h-full w-full"
        />
        <OverlayChip className="absolute left-3 top-3">Driven track</OverlayChip>
        {!hasTrack ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="rounded-full bg-surface/80 px-2.5 py-1 text-[.78rem] text-ink-faint backdrop-blur">
              {loading ? 'Loading track…' : 'No track for this run'}
            </span>
          </div>
        ) : null}
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-[.7rem]">
          <Button
            variant="primary"
            size="icon"
            aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
            disabled={reducedMotion || !hasTrack}
            title={reducedMotion ? 'Reduced motion: drag the scrubber to relive this run' : undefined}
            className="h-[34px] w-[34px]"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </Button>
          <Scrubber
            pct={hasTrack ? pct : 0}
            onScrub={setPct}
            disabled={!hasTrack}
            aria-label="Replay position"
            className="flex-1"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-mono text-[.72rem] tabular-nums text-ink-soft">
            {hasTrack ? formatClock(totalSeconds, elapsedSeconds) : '–:--'}
          </span>
          <span className="font-mono text-[.72rem] tabular-nums text-ink-faint">
            {hasTrack ? formatClock(totalSeconds, totalSeconds) : '–:--'}
          </span>
        </div>
        <div className="mt-2 flex justify-end">
          <SegmentedToggle
            options={SPEED_OPTIONS}
            value={speed}
            onChange={(v) => setSpeed(v as ReplaySpeed)}
            label="Speed"
            className="w-fit"
          />
        </div>
      </Card>
    </>
  );
}
