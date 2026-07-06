import {mockStatsForRange} from '@/lib/mockPersistence';
import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {statsPerDaySchema, statsQueryResultSchema, type StatsQueryResult} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type StatsRangeResult = {
  data: StatsQueryResult | null;
  loading: boolean;
  /** True when this is fallback sample data because the query/stats service errored or timed out
   * (no persistence backend yet). See src/lib/mockPersistence.ts. */
  isMock: boolean;
  error: string | null;
};

/**
 * Fetches lifetime-to-date-range mowing stats over `query/stats/req` -> `query/stats/res`
 * (see persistence/DESIGN.md's GetStats service / MQTT contract). `from`/`to` are unix-millis;
 * `0, 0` means lifetime/recent. Falls back to deterministic sample data on error/timeout so the
 * Stats page still renders before the persistence backend exists.
 */
export function useStatsRange(from: number, to: number): StatsRangeResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<StatsRangeResult>({data: null, loading: true, isMock: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchRange = useCallback(async () => {
    if (!mower) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      // Short timeout: with no persistence backend yet we want the sample-data fallback to
      // appear promptly rather than after a long wait. Swaps to live data once res arrives.
      const res = await mower.queryClient.request('stats', {from, to}, 4000);
      const per_day = parseJsonArrayField(res.per_day_json ?? res.per_day).flatMap((entry) => {
        const parsed = statsPerDaySchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      const data = statsQueryResultSchema.parse({...res, per_day});
      setResult({data, loading: false, isMock: false, error: null});
    } catch (err) {
      // No persistence backend yet (or a genuine error) -- render sample data instead of a
      // blank page. Swaps back to live data automatically once query/stats/res arrives.
      setResult({
        data: mockStatsForRange(from, to),
        loading: false,
        isMock: true,
        error: err instanceof Error ? err.message : String(err),
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
