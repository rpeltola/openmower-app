import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {mowJobSchema, type MowJob} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type MowJobsResult = {
  jobs: MowJob[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetches past (and in-progress) mow jobs in a time range over `query/mowjobs/req` ->
 * `query/mowjobs/res` (GetMowJobs service), for the History page's job list.
 *
 * `fromMs`/`toMs` are unix-millis, matching the `query/stats` range convention (see
 * useStatsRange). On error/timeout `jobs` resolves to an empty array -- never fabricated jobs.
 */
export function useMowJobs(fromMs: number, toMs: number): MowJobsResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<MowJobsResult>({jobs: [], loading: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchJobs = useCallback(async () => {
    if (!mower) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      const res = await mower.queryClient.request('mowjobs', {from_ms: fromMs, to_ms: toMs});
      const jobs = parseJsonArrayField(res.json ?? res.jobs).flatMap((entry) => {
        const parsed = mowJobSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      jobs.sort((a, b) => b.started_at - a.started_at);
      setResult({jobs, loading: false, error: null});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({jobs: [], loading: false, error: message});
    }
  }, [mower, fromMs, toMs]);

  useEffect(() => {
    const key = `${mower?.id ?? ''}:${fromMs}:${toMs}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchJobs();
  }, [mower?.id, fromMs, toMs, fetchJobs]);

  return result;
}
