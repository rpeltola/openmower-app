import {mockHeatmap, USE_MOCK_PERSISTENCE} from '@/lib/mockPersistence';
import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {heatmapCellSchema, mapVersionEntrySchema, type HeatmapCell, type HeatmapMetric} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type HeatmapResult = {
  cellSize: number;
  cells: HeatmapCell[];
  loading: boolean;
};

/**
 * Fetches the coverage heatmap for one metric over `query/heatmap/req` -> `query/heatmap/res`
 * (GetHeatmap service, see persistence/DESIGN.md).
 *
 * By default this is for the CURRENT map version -- looked up first via `query/mapversions`.
 * Pass an explicit `mapVersionId` (e.g. a past job's `map_version_id`, see the History page) to
 * fetch a specific historical version's heatmap instead, skipping the current-version lookup.
 *
 * If either query errors/times out, or there is no current map version / no cells, `cells`
 * resolves to an empty array and the map shows nothing -- never a fabricated heatmap. The
 * dev-only NEXT_PUBLIC_USE_MOCK_PERSISTENCE flag (off by default) is the sole exception.
 */
export function useHeatmap(metric: HeatmapMetric | null, mapVersionId?: number): HeatmapResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<HeatmapResult>({cellSize: 0.25, cells: [], loading: false});
  const requestKeyRef = useRef<string>('');

  const fetchHeatmap = useCallback(async () => {
    if (!mower || !metric) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      let versionId = mapVersionId;
      if (versionId === undefined) {
        const versionsRes = await mower.queryClient.request('mapversions', {});
        const versions = parseJsonArrayField(versionsRes.json ?? versionsRes.versions).flatMap((entry) => {
          const parsed = mapVersionEntrySchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        });
        const current = versions.find((v) => v.is_current) ?? versions[0];
        if (!current) throw new Error('no map version available');
        versionId = current.id;
      }

      const heatmapRes = await mower.queryClient.request('heatmap', {
        map_version_id: versionId,
        metric,
      });
      const cells = parseJsonArrayField(heatmapRes.json ?? heatmapRes.cells).flatMap((entry) => {
        const parsed = heatmapCellSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      const cellSize = typeof heatmapRes.cell_size === 'number' ? heatmapRes.cell_size : 0.25;
      setResult({cellSize, cells, loading: false});
    } catch {
      // Real deployment: no cells -> nothing drawn on the map. Dev flag only: sample cells.
      if (USE_MOCK_PERSISTENCE) {
        const mock = mockHeatmap(metric);
        setResult({cellSize: mock.cell_size, cells: mock.cells, loading: false});
      } else {
        setResult({cellSize: 0.25, cells: [], loading: false});
      }
    }
  }, [mower, metric, mapVersionId]);

  useEffect(() => {
    if (!metric) {
      setResult({cellSize: 0.25, cells: [], loading: false});
      requestKeyRef.current = '';
      return;
    }
    const key = `${mower?.id ?? ''}:${metric}:${mapVersionId ?? ''}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchHeatmap();
  }, [mower?.id, metric, mapVersionId, fetchHeatmap]);

  return result;
}
