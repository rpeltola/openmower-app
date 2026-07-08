import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {chargeSessionSchema, type ChargeSession} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type ChargeSessionsResult = {
  sessions: ChargeSession[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetches past charge sessions in a time range over `query/charge_sessions/req` ->
 * `query/charge_sessions/res`, for the sensors page's time-to-full estimate (see
 * estimateChargeRate in utils/charge-estimate). Mirrors useMowJobs.
 *
 * `fromMs`/`toMs` are unix-millis, matching the `query/stats`/`query/mowjobs` range convention.
 * On error/timeout `sessions` resolves to an empty array -- never fabricated sessions.
 */
export function useChargeSessions(fromMs: number, toMs: number): ChargeSessionsResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<ChargeSessionsResult>({sessions: [], loading: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchSessions = useCallback(async () => {
    if (!mower) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      const res = await mower.queryClient.request('charge_sessions', {from_ms: fromMs, to_ms: toMs});
      const sessions = parseJsonArrayField(res.json ?? res.charge_sessions).flatMap((entry) => {
        const parsed = chargeSessionSchema.safeParse(entry);
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
