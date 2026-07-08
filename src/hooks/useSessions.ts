import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {sessionSchema, type MowSession} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type SessionsResult = {
  sessions: MowSession[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetches mowing sessions in a time range over `query/sessions/req` -> `query/sessions/res`,
 * for the History page's session filter. Mirrors useMowJobs/useChargeSessions.
 *
 * `fromMs`/`toMs` are unix-millis, matching the `query/stats`/`query/mowjobs` range convention.
 * On error/timeout `sessions` resolves to an empty array -- never fabricated sessions.
 */
export function useSessions(fromMs: number, toMs: number): SessionsResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<SessionsResult>({sessions: [], loading: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchSessions = useCallback(async () => {
    if (!mower) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      const res = await mower.queryClient.request('sessions', {from_ms: fromMs, to_ms: toMs});
      const sessions = parseJsonArrayField(res.json ?? res.sessions).flatMap((entry) => {
        const parsed = sessionSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      sessions.sort((a, b) => b.started_at - a.started_at);
      setResult({sessions, loading: false, error: null});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({sessions: [], loading: false, error: message});
    }
  }, [mower, fromMs, toMs]);

  useEffect(() => {
    const key = `${mower?.id ?? ''}:${fromMs}:${toMs}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchSessions();
  }, [mower?.id, fromMs, toMs, fetchSessions]);

  return result;
}
