import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {eventSchema, type MowerEvent, type MowJob} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type JobEventsResult = {
  events: MowerEvent[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetches a job's events over `query/events/req` -> `query/events/res`, for the History page's
 * event list + map markers. The query is by time range (from_ms/to_ms, unix-millis, matching
 * `query/stats`/`query/mowjobs`); events are then narrowed to this job client-side, primarily by
 * `job_id` and, for events that predate that field, by falling within the job's
 * [started_at, ended_at] window (unix seconds, matching the event `t` convention). `ended_at` is
 * absent while the job is still running, in which case "now" bounds the window.
 *
 * On error/timeout `events` resolves to an empty array -- never a fabricated event list.
 */
export function useJobEvents(job: MowJob | null): JobEventsResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<JobEventsResult>({events: [], loading: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchEvents = useCallback(
    async (target: MowJob) => {
      if (!mower) return;
      setResult((prev) => ({...prev, loading: true}));
      try {
        const endedAt = target.ended_at ?? Math.floor(Date.now() / 1000);
        const res = await mower.queryClient.request('events', {
          from_ms: target.started_at * 1000,
          to_ms: endedAt * 1000,
        });
        const parsed = parseJsonArrayField(res.json ?? res.events).flatMap((entry) => {
          const p = eventSchema.safeParse(entry);
          return p.success ? [p.data] : [];
        });
        const events = parsed
          .filter((e) => e.job_id === target.id || (!e.job_id && e.t >= target.started_at && e.t <= endedAt))
          .sort((a, b) => a.t - b.t);
        setResult({events, loading: false, error: null});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setResult({events: [], loading: false, error: message});
      }
    },
    [mower],
  );

  useEffect(() => {
    if (!job) {
      setResult({events: [], loading: false, error: null});
      requestKeyRef.current = '';
      return;
    }
    const key = `${mower?.id ?? ''}:${job.id}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchEvents(job);
  }, [mower?.id, job, fetchEvents]);

  return result;
}
