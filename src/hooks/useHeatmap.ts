import {mockHeatmap} from '@/lib/mockPersistence';
import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  heatmapCellSchema,
  mapVersionEntrySchema,
  type HeatmapCell,
  type HeatmapMetric,
} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type HeatmapResult = {
  cellSize: number;
  cells: HeatmapCell[];
  loading: boolean;
  /** True when this is fallback sample data (no persistence backend / no current map version
   * yet). See src/lib/mockPersistence.ts. */
  isMock: boolean;
};

/**
 * Fetches the coverage heatmap for one metric over `query/heatmap/req` -> `query/heatmap/res`
 * (GetHeatmap service, see persistence/DESIGN.md), for the current map version -- looked up
 * first via `query/mapversions`. Falls back to sample data if either query errors/times out
 * (no persistence backend yet), or there is no current map version.
 */
export function useHeatmap(metric: HeatmapMetric | null): HeatmapResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<HeatmapResult>({cellSize: 0.25, cells: [], loading: false, isMock: false});
  const requestKeyRef = useRef<string>('');

  const fetchHeatmap = useCallback(async () => {
    if (!mower || !metric) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      // Short timeout so the sample-data fallback appears promptly while there's no backend.
      const versionsRes = await mower.queryClient.request('mapversions', {}, 4000);
      const versions = parseJsonArrayField(versionsRes.json ?? versionsRes.versions).flatMap((entry) => {
        const parsed = mapVersionEntrySchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      const current = versions.find((v) => v.is_current) ?? versions[0];
      if (!current) throw new Error('no map version available');

      const heatmapRes = await mower.queryClient.request(
        'heatmap',
        {
          map_version_id: current.id,
          metric,
        },
        4000,
      );
      const cells = parseJsonArrayField(heatmapRes.json ?? heatmapRes.cells).flatMap((entry) => {
        const parsed = heatmapCellSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      const cellSize = typeof heatmapRes.cell_size === 'number' ? heatmapRes.cell_size : 0.25;
      setResult({cellSize, cells, loading: false, isMock: false});
    } catch {
      const mock = mockHeatmap(metric);
      setResult({cellSize: mock.cell_size, cells: mock.cells, loading: false, isMock: true});
    }
  }, [mower, metric]);

  useEffect(() => {
    if (!metric) {
      setResult({cellSize: 0.25, cells: [], loading: false, isMock: false});
      requestKeyRef.current = '';
      return;
    }
    const key = `${mower?.id ?? ''}:${metric}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchHeatmap();
  }, [mower?.id, metric, fetchHeatmap]);

  return result;
}
