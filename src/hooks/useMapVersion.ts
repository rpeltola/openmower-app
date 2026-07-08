import {useSelectedMower} from '@/stores/mowersStore';
import {mapVersionToFeatures} from '@/utils/area-converter';
import {featureCollection} from '@turf/helpers';
import type {FeatureCollection} from 'geojson';
import {useCallback, useEffect, useRef, useState} from 'react';

export type MapVersionResult = {
  features: FeatureCollection;
  loading: boolean;
  error: string | null;
};

const emptyFeatures: FeatureCollection = featureCollection([]);

/**
 * Fetches one stored map version's GeoJSON over `query/mapversion/req` -> `query/mapversion/res`
 * (GetMapVersion service), for the History page's per-job historical map -- see
 * mapVersionToFeatures for how the raw `geojson` string becomes the same Feature shapes the
 * live map uses.
 *
 * `id` is the job's `map_version_id`; null skips the fetch and resolves to empty features
 * (nothing selected yet). On error/timeout `features` resolves empty too -- never a stale or
 * wrong version silently shown.
 */
export function useMapVersion(id: number | null): MapVersionResult {
  const mower = useSelectedMower((m) => m);
  const [result, setResult] = useState<MapVersionResult>({features: emptyFeatures, loading: false, error: null});
  const requestKeyRef = useRef<string>('');

  const fetchVersion = useCallback(
    async (versionId: number) => {
      if (!mower) return;
      setResult((prev) => ({...prev, loading: true}));
      try {
        const res = await mower.queryClient.request('mapversion', {id: versionId});
        const raw = typeof res.geojson === 'string' ? (JSON.parse(res.geojson) as unknown) : res.geojson;
        setResult({features: mapVersionToFeatures(raw), loading: false, error: null});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setResult({features: emptyFeatures, loading: false, error: message});
      }
    },
    [mower],
  );

  useEffect(() => {
    if (id === null) {
      setResult({features: emptyFeatures, loading: false, error: null});
      requestKeyRef.current = '';
      return;
    }
    const key = `${mower?.id ?? ''}:${id}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    void fetchVersion(id);
  }, [mower?.id, id, fetchVersion]);

  return result;
}
