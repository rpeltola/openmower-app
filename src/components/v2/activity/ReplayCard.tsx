'use client';

import {cn} from '@/components/v2/lib/cn';
import {useBreakpoint} from '@/components/v2/lib/useBreakpoint';
import {type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {Scrubber, type ScrubberMarker} from '@/components/v2/ui/Scrubber';
import {Pause, Play} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

export interface ReplayCardProps {
  /** e.g. "Mon 09:30 – 11:22 · all areas" — the two clock times anchor the event markers. */
  timeRange: string;
  /** e.g. "1h 52m" — total run length; paces the elapsed/total readout. */
  duration: string;
  events: ActivityEvent[];
  className?: string;
}

/** The driven-track illustration, same mock geometry every run uses. */
const TRACK_D =
  'M46 62 C90 48 120 90 84 108 C48 126 66 158 112 150 C158 142 150 96 196 92 C232 89 240 130 216 158 ' +
  'C196 182 160 178 148 190';

/** Wall-clock time a full replay takes to play through, independent of the run's real length. */
const PLAYBACK_MS = 15000;

const TONE_VAR: Record<NonNullable<ScrubberMarker['tone']>, string> = {
  accent: 'var(--accent)',
  info: 'var(--info)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  neutral: 'var(--ink-faint)',
};

function parseClockMinutes(time: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Derives fixed 0–100 marker positions for each event from its clock time relative to the
 *  run's start/end (both mock, parsed out of `timeRange`/`event.time`) — falls back to even
 *  spacing if either can't be parsed. */
function deriveMarkers(timeRange: string, events: ActivityEvent[]): ScrubberMarker[] {
  const clockTimes = [...timeRange.matchAll(/\d{1,2}:\d{2}/g)].map((m) => m[0]);
  const startMin = clockTimes[0] ? parseClockMinutes(clockTimes[0]) : null;
  const endMin = clockTimes[1] ? parseClockMinutes(clockTimes[1]) : null;
  const span = startMin != null && endMin != null ? endMin - startMin : null;

  return events.map((event, i) => {
    const eventMin = parseClockMinutes(event.time);
    const pct =
      span && span > 0 && eventMin != null
        ? Math.max(0, Math.min(100, ((eventMin - startMin!) / span) * 100))
        : ((i + 1) / (events.length + 1)) * 100;
    return {pct, tone: event.tone, label: `${event.text} · ${event.time}`};
  });
}

function parseDurationSeconds(duration: string): number {
  const h = /(\d+)\s*h/i.exec(duration);
  const m = /(\d+)\s*m/i.exec(duration);
  const seconds = (h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0);
  return seconds > 0 ? seconds : 3600;
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
 *  with an animated position dot + pinned event markers, and a scrubber transport (play/pause,
 *  drag-to-scrub, elapsed/total) below it. All data is mock — a canned track path, and event
 *  timing derived from the run's own (mock) clock times. */
export function ReplayCard({timeRange, duration, events, className}: ReplayCardProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const reducedMotion = useBreakpoint('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

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

  function pointAt(atPct: number) {
    if (!pathRef.current || pathLength == null) return null;
    return pathRef.current.getPointAtLength((Math.max(0, Math.min(100, atPct)) / 100) * pathLength);
  }

  const markers = deriveMarkers(timeRange, events);
  const playhead = pointAt(pct);
  const totalSeconds = parseDurationSeconds(duration);
  const elapsedSeconds = (pct / 100) * totalSeconds;

  function togglePlay() {
    if (!isPlaying && pct >= 100) setPct(0);
    setIsPlaying((p) => !p);
  }

  return (
    <>
      <Card className={cn('relative min-h-[160px] flex-1 overflow-hidden p-0', className)}>
        <svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <rect width="300" height="220" fill="var(--map)" />
          <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
            <path d="M0 73h300M0 146h300M100 0v220M200 0v220" />
          </g>
          <path
            d="M32 40 L262 32 L276 108 L244 196 L60 208 L24 112 Z"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="2"
          />
          <path
            ref={pathRef}
            d={TRACK_D}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".9"
          />
          <circle cx="46" cy="62" r="5" fill="var(--accent)" />
          <g transform="translate(148,190)">
            <rect x="-9" y="-9" width="18" height="18" rx="6" fill="var(--accent-bright)" />
            <path d="M0 -14 L4 -8 L-4 -8 Z" fill="var(--accent)" />
          </g>

          {markers.map((marker, i) => {
            const p = pointAt(marker.pct);
            if (!p) return null;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill={TONE_VAR[marker.tone ?? 'neutral']}
                stroke="var(--surface)"
                strokeWidth="1.5"
              >
                <title>{marker.label}</title>
              </circle>
            );
          })}

          {playhead ? (
            <g transform={`translate(${playhead.x},${playhead.y})`}>
              <circle r="9" fill="var(--accent-bright)" opacity=".18" className="motion-safe:animate-pulse" />
              <circle r="5" fill="var(--surface)" stroke="var(--accent-bright)" strokeWidth="2.5" />
            </g>
          ) : null}
        </svg>
        <OverlayChip className="absolute left-3 top-3">Driven track</OverlayChip>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-[.7rem]">
          <Button
            variant="primary"
            size="icon"
            aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
            disabled={reducedMotion}
            title={reducedMotion ? 'Reduced motion: drag the scrubber to relive this run' : undefined}
            className="h-[34px] w-[34px]"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </Button>
          <Scrubber pct={pct} onScrub={setPct} markers={markers} aria-label="Replay position" className="flex-1" />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-mono text-[.72rem] tabular-nums text-ink-soft">
            {formatClock(totalSeconds, elapsedSeconds)}
          </span>
          <span className="font-mono text-[.72rem] tabular-nums text-ink-faint">
            {formatClock(totalSeconds, totalSeconds)}
          </span>
        </div>
      </Card>
    </>
  );
}
