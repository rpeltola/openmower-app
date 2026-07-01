import {useSelectedMower} from '@/stores/mowersStore';
import {
  coverageHistoryListSchema,
  coveragePassSchema,
  type Coverage,
  type PlannedPath,
} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

interface PastCoverage {
  jobId: string;
  coverage: Coverage;
  planned: PlannedPath;
}

type JobCoverageState =
  | {status: 'live'}
  | {status: 'loading'}
  | {status: 'loaded'; past: PastCoverage}
  | {status: 'error'; jobId: string};

/**
 * Fetches and caches the historical coverage grid and planned path for a selected job.
 *
 * Returns nulls when selectedJobId is null or matches the current live job, so callers can fall
 * through to the live MQTT-streamed coverage/planned-path. Otherwise it lists the job's recorded
 * passes, picks the highest pass number, and fetches that pass's snapshot.
 */
export function useJobCoverage(selectedJobId: string | null): {
  pastCoverage: Coverage | null;
  pastPlanned: PlannedPath | null;
  isHistorical: boolean;
  loading: boolean;
} {
  const rpc = useSelectedMower((s) => s?.rpc);
  const liveJobId = useSelectedMower((s) => s?.track.attributes.job_id ?? null);

  // Cache past coverage by job_id to avoid re-fetching
  const cache = useRef<Map<string, PastCoverage>>(new Map());

  const [state, setState] = useState<JobCoverageState>({status: 'live'});

  const isHistoricalJob = selectedJobId !== null && selectedJobId !== liveJobId;

  const fetchJob = useCallback(
    async (jobId: string) => {
      if (!rpc) return;

      const cached = cache.current.get(jobId);
      if (cached) {
        setState({status: 'loaded', past: cached});
        return;
      }

      setState({status: 'loading'});
      try {
        const listRaw = await rpc.call('coverage.history.list');
        const list = coverageHistoryListSchema.safeParse(listRaw);
        if (!list.success) {
          setState({status: 'error', jobId});
          return;
        }
        const entry = list.data.find((e) => e.job_id === jobId);
        if (!entry || entry.passes.length === 0) {
          setState({status: 'error', jobId});
          return;
        }
        const highestPass = entry.passes.reduce((max, p) => (p.pass > max ? p.pass : max), entry.passes[0].pass);

        const passRaw = await rpc.call('coverage.history.pass', {job_id: jobId, pass: highestPass});
        const passResult = coveragePassSchema.safeParse(passRaw);
        if (!passResult.success) {
          setState({status: 'error', jobId});
          return;
        }
        const past: PastCoverage = {
          jobId,
          coverage: passResult.data.coverage,
          planned: {job_id: jobId, paths: passResult.data.planned_path.paths},
        };
        cache.current.set(jobId, past);
        setState({status: 'loaded', past});
      } catch {
        setState({status: 'error', jobId});
      }
    },
    [rpc],
  );

  useEffect(() => {
    if (!isHistoricalJob) {
      setState({status: 'live'});
      return;
    }
    void fetchJob(selectedJobId);
  }, [isHistoricalJob, selectedJobId, fetchJob]);

  if (!isHistoricalJob) {
    return {pastCoverage: null, pastPlanned: null, isHistorical: false, loading: false};
  }

  if (state.status === 'loaded' && state.past.jobId === selectedJobId) {
    return {pastCoverage: state.past.coverage, pastPlanned: state.past.planned, isHistorical: true, loading: false};
  }

  if (state.status === 'error' && state.jobId === selectedJobId) {
    // Historical job with no recorded coverage: show NOTHING (never fall back to live — that would
    // mix a past track with the live coverage grid).
    return {pastCoverage: null, pastPlanned: null, isHistorical: true, loading: false};
  }

  // Either explicitly loading, or state belongs to a different job (stale)
  return {pastCoverage: null, pastPlanned: null, isHistorical: true, loading: true};
}
