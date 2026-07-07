import {mockHeatmapMetrics, USE_MOCK_PERSISTENCE} from '@/lib/mockPersistence';
import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {heatmapMetricInfoSchema, type HeatmapMetricInfo} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type HeatmapMetricsResult = {
  metrics: HeatmapMetricInfo[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetches the list of selectable coverage-heatmap metrics over `query/heatmap_metrics/req` ->
 * `query/heatmap_metrics/res` (ListHeatmapMetrics service, see persistence/DESIGN.md), so the
 * "Coverage heatmap" picker doesn't hardcode metric keys/labels.
 *
 * On error/timeout `metrics` resolves to an empty array and the picker only offers "Off" --
 * never a fabricated list. The dev-only NEXT_PUBLIC_USE_MOCK_PERSISTENCE flag (off by default)
 * is the sole exception, for local UI work.
 */
export function useHeatmapMetrics(): HeatmapMetricsResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<HeatmapMetricsResult>({metrics: [], loading: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchMetrics = useCallback(async () => {
    if (!mower) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      const res = await mower.queryClient.request('heatmap_metrics', {});
      const metrics = parseJsonArrayField(res.json ?? res.metrics).flatMap((entry) => {
        const parsed = heatmapMetricInfoSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      setResult({metrics, loading: false, error: null});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Real deployment: no metrics -> picker only offers "Off". Dev flag only: sample list.
      setResult({
        metrics: USE_MOCK_PERSISTENCE ? mockHeatmapMetrics() : [],
        loading: false,
        error: message,
      });
    }
  }, [mower]);

  useEffect(() => {
    if (!mower) {
      setResult({metrics: [], loading: false, error: null});
      requestKeyRef.current = '';
      return;
    }
    if (requestKeyRef.current === mower.id) return;
    requestKeyRef.current = mower.id;
    void fetchMetrics();
  }, [mower, fetchMetrics]);

  return result;
}
