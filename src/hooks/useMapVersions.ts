import {parseJsonArrayField} from '@/lib/queryClient';
import {useSelectedMower} from '@/stores/mowersStore';
import {mapVersionEntrySchema, type MapVersionEntry} from '@/stores/schemas';
import {useCallback, useEffect, useRef, useState} from 'react';

export type MapVersionsResult = {
  versions: MapVersionEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Lists stored map versions over `query/mapversions/req` -> `query/mapversions/res`
 * (ListMapVersions service, see persistence/DESIGN.md) -- the Version-history UI's read side
 * (see useMapVersion for fetching one version's geojson). Sorted newest-first by `created_at`
 * (a defensive re-sort, in case the gateway doesn't already order them).
 *
 * On error/timeout `versions` resolves to an empty array -- never a fabricated list.
 */
export function useMapVersions(): MapVersionsResult {
  const mowerId = useSelectedMower((m) => m?.id);
  const queryClient = useSelectedMower((m) => m?.queryClient);
  const [result, setResult] = useState<Omit<MapVersionsResult, 'refresh'>>({
    versions: [],
    loading: false,
    error: null,
  });
  const requestKeyRef = useRef<string>('');

  const fetchVersions = useCallback(async () => {
    if (!queryClient) return;
    setResult((prev) => ({...prev, loading: true}));
    try {
      const res = await queryClient.request('mapversions', {});
      const versions = parseJsonArrayField(res.json ?? res.versions)
        .flatMap((entry) => {
          const parsed = mapVersionEntrySchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        })
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
      setResult({versions, loading: false, error: null});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({versions: [], loading: false, error: message});
    }
  }, [queryClient]);

  useEffect(() => {
    if (!queryClient) {
      setResult({versions: [], loading: false, error: null});
      requestKeyRef.current = '';
      return;
    }
    if (requestKeyRef.current === mowerId) return;
    requestKeyRef.current = mowerId ?? '';
    void fetchVersions();
  }, [mowerId, queryClient, fetchVersions]);

  return {...result, refresh: fetchVersions};
}
