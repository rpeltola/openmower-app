import {useEffect, useRef, useState} from 'react';

export const REPLAY_SPEEDS = [5, 10, 20, 40, 60] as const;
const DEFAULT_SPEED: (typeof REPLAY_SPEEDS)[number] = 20;

// Reduced-motion playback ticks in coarse, discrete steps instead of a ~60fps animation.
const REDUCED_MOTION_TICK_MS = 500;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface ReplayState {
  /** Current playhead, unix seconds -- same convention as MowJob started_at/ended_at and event.t. */
  t: number;
  startedAt: number;
  endedAt: number;
  playing: boolean;
  speed: number;
  /** 0..1 position within [startedAt, endedAt]; 0 when the job has no duration. */
  progress: number;
  setT: (t: number) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
}

/**
 * Drives the History map's animated-replay playhead for one job: `t` moves from `startedAt` to
 * `endedAt`, either by scrubbing (setT) or by playing at a speed multiplier (one real second
 * advances replay time by `speed` seconds). Resets to the job's full end -- matching the map's
 * prior non-animated "show everything" view -- whenever the job identity changes.
 *
 * Track points have no per-point timestamp (see useJobTrack), so `t`/`progress` here is combined
 * with the track's point count elsewhere (see utils/replay-track.ts) to drive the robot marker and
 * progressive track by index instead. Events do carry their own `t` and are filtered directly.
 */
export function useReplay(jobId: string | null, startedAt: number, endedAt: number): ReplayState {
  const [t, setTState] = useState(endedAt);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const reducedMotion = usePrefersReducedMotion();

  const tRef = useRef(t);
  tRef.current = t;

  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  // New job (or job cleared): jump back to the full end and stop playback.
  useEffect(() => {
    setTState(endedAt);
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resets on job identity only; endedAt read fresh below
  }, [jobId]);

  const setT = (next: number) => {
    setTState(Math.max(startedAt, Math.min(endedAt, next)));
  };

  const togglePlay = () => {
    const next = !playing;
    // Restart from the beginning when replaying after reaching the end, like a video player.
    if (next && t >= endedAt) {
      tRef.current = startedAt;
      setTState(startedAt);
    }
    setPlaying(next);
  };

  useEffect(() => {
    if (!playing || startedAt >= endedAt) return;

    if (reducedMotion) {
      intervalRef.current = setInterval(() => {
        const next = tRef.current + (REDUCED_MOTION_TICK_MS / 1000) * speed;
        if (next >= endedAt) {
          tRef.current = endedAt;
          setTState(endedAt);
          setPlaying(false);
          return;
        }
        tRef.current = next;
        setTState(next);
      }, REDUCED_MOTION_TICK_MS);
      return () => {
        if (intervalRef.current !== null) clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }

    lastFrameRef.current = null;
    const tick = (now: number) => {
      const dt = lastFrameRef.current !== null ? now - lastFrameRef.current : 0;
      lastFrameRef.current = now;
      const next = tRef.current + (dt / 1000) * speed;
      if (next >= endedAt) {
        tRef.current = endedAt;
        setTState(endedAt);
        setPlaying(false);
        return; // reached the end -- stop, don't schedule another frame
      }
      tRef.current = next;
      setTState(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed, startedAt, endedAt, reducedMotion]);

  const progress = endedAt > startedAt ? (t - startedAt) / (endedAt - startedAt) : 0;

  return {t, startedAt, endedAt, playing, speed, progress, setT, togglePlay, setSpeed};
}
