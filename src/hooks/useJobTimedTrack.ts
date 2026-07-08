import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {jobTrackPointSchema} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export interface TimedTrackPoint {
  /** Unix SECONDS, matching the replay playhead / event `t` convention (see useReplay). */
  t: number;
  x: number;
  y: number;
}

export type JobTimedTrackState =
  | {status: 'live'}
  | {status: 'loading'}
  | {status: 'loaded'; jobId: string; points: TimedTrackPoint[]}
  | {status: 'error'; jobId: string};

/**
 * Fetches and caches a job's timestamped driven-position track over `query/job_track/req` ->
 * `query/job_track/res`, for TRUE real-world-paced replay (see utils/replay-track.ts
 * sampleTimedTrackAt) -- unlike useJobTrack's untimed polyline, each point here carries its own
 * `t`, downsampled to <=1000 evenly-spaced points server-side.
 *
 * Mirrors useJobTrack: returns [] when selectedJobId is null or matches the current live job, so
 * callers fall through to the live pipeline. Also returns [] (not an error state) when the query
 * succeeds with no points -- older jobs predating job_track / without telemetry -- so callers can
 * fall back to useJobTrack's index-interpolated path instead.
 */
export function useJobTimedTrack(selectedJobId: string | null): {
  points: TimedTrackPoint[];
  loading: boolean;
} {
  const mower = useSelectedMower((s) => s?.queryClient);
  const liveJobId = useSelectedMower((s) => s?.track.attributes.job_id ?? null);

  // Cache timed tracks by job_id to avoid re-fetching
  const cache = useRef<Map<string, TimedTrackPoint[]>>(new Map());

  const [state, setState] = useState<JobTimedTrackState>({status: 'live'});

  const isHistoricalJob = selectedJobId !== null && selectedJobId !== liveJobId;

  const fetchJob = useCallback(
    async (jobId: string) => {
      if (!mower) return;

      const cached = cache.current.get(jobId);
      if (cached) {
        setState({status: 'loaded', jobId, points: cached});
        return;
      }

      setState({status: 'loading'});
      try {
        const res = await mower.request('job_track', {job_id: jobId});
        const points = parseJsonArrayField(res.json ?? res.points)
          .flatMap((entry) => {
            const parsed = jobTrackPointSchema.safeParse(entry);
            return parsed.success ? [parsed.data] : [];
          })
          // t arrives in unix millis (telemetry-derived); the replay playhead/events use seconds.
          .map((p) => ({t: p.t / 1000, x: p.x, y: p.y}))
          .sort((a, b) => a.t - b.t);
        cache.current.set(jobId, points);
        setState({status: 'loaded', jobId, points});
      } catch {
        setState({status: 'error', jobId});
      }
    },
    [mower],
  );

  useEffect(() => {
    if (!isHistoricalJob) {
      setState({status: 'live'});
      return;
    }
    void fetchJob(selectedJobId);
  }, [isHistoricalJob, selectedJobId, fetchJob]);

  if (!isHistoricalJob) {
    return {points: [], loading: false};
  }

  if (state.status === 'loaded' && state.jobId === selectedJobId) {
    return {points: state.points, loading: false};
  }

  // Either explicitly loading, or state belongs to a different job (stale)
  return {points: [], loading: true};
}
