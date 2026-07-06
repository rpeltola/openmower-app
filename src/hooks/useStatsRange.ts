import {mockStatsForRange, USE_MOCK_PERSISTENCE} from '@/lib/mockPersistence';
import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {statsPerDaySchema, statsQueryResultSchema, type StatsQueryResult} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type StatsRangeResult = {
  /** The range stats, or null when the query hasn't produced data (still loading, or resolved
   * empty / errored). Callers distinguish loading from empty via `loading`. */
  data: StatsQueryResult | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetches lifetime-to-date-range mowing stats over `query/stats/req` -> `query/stats/res`
 * (see persistence/DESIGN.md's GetStats service / MQTT contract). `from`/`to` are unix-millis;
 * `0, 0` means lifetime/recent.
 *
 * On error/timeout (e.g. no persistence backend answering) `data` resolves to null and the
 * caller shows a clean empty state -- never fabricated readings. The dev-only
 * NEXT_PUBLIC_USE_MOCK_PERSISTENCE flag (off by default) is the sole exception, for local UI work.
 */
export function useStatsRange(from: number, to: number): StatsRangeResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<StatsRangeResult>({data: null, loading: true, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchRange = useCallback(async () => {
    if (!mower) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      const res = await mower.queryClient.request('stats', {from, to});
      const per_day = parseJsonArrayField(res.per_day_json ?? res.per_day).flatMap((entry) => {
        const parsed = statsPerDaySchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      const data = statsQueryResultSchema.parse({...res, per_day});
      setResult({data, loading: false, error: null});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Real deployment: no data -> clean empty state (data stays null). Dev flag only:
      // substitute sample data for local UI iteration.
      setResult({
        data: USE_MOCK_PERSISTENCE ? mockStatsForRange(from, to) : null,
        loading: false,
        error: message,
      });
    }
  }, [mower, from, to]);

  useEffect(() => {
    const key = `${mower?.id ?? ''}:${from}:${to}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchRange();
  }, [mower?.id, from, to, fetchRange]);

  return result;
}
