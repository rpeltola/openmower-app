'use client';

import {cn} from '@/components/v2/lib/cn';
import {useBreakpoint} from '@/components/v2/lib/useBreakpoint';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {Scrubber} from '@/components/v2/ui/Scrubber';
import {useJobTimedTrack, type TimedTrackPoint} from '@/hooks/useJobTimedTrack';
import {sampleTimedTrackAt} from '@/utils/replay-track';
import {Pause, Play} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';

export interface ReplayCardProps {
  /** The real job_id (see MowJob) -- null while no run is selected/available. */
  jobId: string | null;
  className?: string;
}

/** Wall-clock time a full replay takes to play through, independent of the run's real length. */
const PLAYBACK_MS = 15000;

const VIEW_W = 300;
const VIEW_H = 220;
const VIEW_PAD = 26;

interface ScreenPoint {
  x: number;
  y: number;
}

interface FitBounds {
  minX: number;
  maxY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Fits a track's metre-space points (x=east, y=north of the mower's GPS datum -- see
 * useJobTimedTrack) into the card's SVG viewBox, preserving aspect ratio and centering within
 * the padded plot area. North stays "up": larger y maps to a SMALLER screen y.
 */
function fitBounds(points: TimedTrackPoint[]): FitBounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const plotW = VIEW_W - VIEW_PAD * 2;
  const plotH = VIEW_H - VIEW_PAD * 2;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min(plotW / spanX, plotH / spanY);
  return {
    minX,
    maxY,
    scale,
    offsetX: VIEW_PAD + (plotW - spanX * scale) / 2,
    offsetY: VIEW_PAD + (plotH - spanY * scale) / 2,
  };
}

function project(p: {x: number; y: number}, b: FitBounds): ScreenPoint {
  return {
    x: b.offsetX + (p.x - b.minX) * b.scale,
    y: b.offsetY + (b.maxY - p.y) * b.scale,
  };
}

function formatClock(totalSeconds: number, seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (totalSeconds >= 3600) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Run replay (concept "Watch the run, not just the number"): the driven-track illustration
 *  with an animated position dot fit to the job's real telemetry (useJobTimedTrack), and a
 *  scrubber transport (play/pause, drag-to-scrub, elapsed/total) below it -- paced by the
 *  track's OWN timestamps, so a paused stretch of the run barely moves the dot while a fast
 *  stretch flies by. Jobs with no timed track (predates job_track, or still the live job) fall
 *  back to a plain "no track" placeholder -- never a fabricated path. */
export function ReplayCard({jobId, className}: ReplayCardProps) {
  const {points, loading} = useJobTimedTrack(jobId);
  const [pct, setPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const reducedMotion = useBreakpoint('(prefers-reduced-motion: reduce)');

  const hasTrack = points.length > 0;

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
        const next = p + (dt / PLAYBACK_MS) * 100;
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

  const bounds = useMemo(() => (hasTrack ? fitBounds(points) : null), [hasTrack, points]);
  const screenPoints = useMemo(() => (bounds ? points.map((p) => project(p, bounds)) : []), [points, bounds]);
  const pathD = useMemo(
    () => screenPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
    [screenPoints],
  );

  const startedAt = hasTrack ? points[0].t : 0;
  const endedAt = hasTrack ? points[points.length - 1].t : 0;
  const totalSeconds = Math.max(0, endedAt - startedAt);
  const elapsedSeconds = (pct / 100) * totalSeconds;
  const currentT = startedAt + elapsedSeconds;

  const playheadMeters = hasTrack ? sampleTimedTrackAt(points, currentT)?.point : null;
  const playhead = playheadMeters && bounds ? project(playheadMeters, bounds) : null;
  const start = screenPoints[0] ?? null;
  const finish = screenPoints[screenPoints.length - 1] ?? null;

  function togglePlay() {
    if (!isPlaying && pct >= 100) setPct(0);
    setIsPlaying((p) => !p);
  }

  return (
    <>
      <Card className={cn('relative min-h-[160px] flex-1 overflow-hidden p-0', className)}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
        >
          <rect width={VIEW_W} height={VIEW_H} fill="var(--map)" />
          <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
            <path d="M0 73h300M0 146h300M100 0v220M200 0v220" />
          </g>
          <path
            d="M32 40 L262 32 L276 108 L244 196 L60 208 L24 112 Z"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="2"
          />

          {hasTrack ? (
            <>
              <path
                d={pathD}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity=".9"
              />
              {start ? <circle cx={start.x} cy={start.y} r="5" fill="var(--accent)" /> : null}
              {finish ? (
                <g transform={`translate(${finish.x},${finish.y})`}>
                  <rect x="-9" y="-9" width="18" height="18" rx="6" fill="var(--accent-bright)" />
                  <path d="M0 -14 L4 -8 L-4 -8 Z" fill="var(--accent)" />
                </g>
              ) : null}
              {playhead ? (
                <g transform={`translate(${playhead.x},${playhead.y})`}>
                  <circle r="9" fill="var(--accent-bright)" opacity=".18" className="motion-safe:animate-pulse" />
                  <circle r="5" fill="var(--surface)" stroke="var(--accent-bright)" strokeWidth="2.5" />
                </g>
              ) : null}
            </>
          ) : null}
        </svg>
        <OverlayChip className="absolute left-3 top-3">Driven track</OverlayChip>
        {!hasTrack ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="text-[.78rem] text-ink-faint">
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
      </Card>
    </>
  );
}
