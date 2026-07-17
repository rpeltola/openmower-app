import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// Fakes the store's queryClient (MqttQueryClient, see lib/queryClient.ts) so the `query/mapversions`
// list parse (mapVersionEntrySchema) is exercised without a real broker.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

import {useSelectedMower} from '@/stores/mowersStore';
import {useMapVersions} from '@/hooks/useMapVersions';

function mockMower(request: (...args: never[]) => Promise<Record<string, unknown>>) {
  const fakeMower = {id: 'mower-1', queryClient: {request}};
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
}

describe('useMapVersions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses the query/mapversions/res json field into MapVersionEntry[], newest first', async () => {
    const request = vi.fn(() =>
      Promise.resolve({
        json: JSON.stringify([
          {id: 1, created_at: 100, note: 'Initial map', is_current: false},
          {id: 3, created_at: 300, note: 'Added Saunan area', is_current: true},
          {id: 2, created_at: 200, is_current: false},
        ]),
      }),
    );
    mockMower(request);

    const {result} = renderHook(() => useMapVersions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(request).toHaveBeenCalledWith('mapversions', {});
    expect(result.current.versions.map((v) => v.id)).toEqual([3, 2, 1]);
    expect(result.current.versions[0]).toEqual({id: 3, created_at: 300, note: 'Added Saunan area', is_current: true});
    expect(result.current.error).toBeNull();
  });

  it('drops entries that fail schema validation instead of throwing', async () => {
    mockMower(() =>
      Promise.resolve({
        json: JSON.stringify([{id: 1, created_at: 1}, {not_an_id: true}]),
      }),
    );

    const {result} = renderHook(() => useMapVersions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.versions).toHaveLength(1);
    expect(result.current.versions[0].id).toBe(1);
  });

  it('resolves to an empty list (not a fabricated one) on a query error', async () => {
    mockMower(() => Promise.reject(new Error('mapversions timed out')));

    const {result} = renderHook(() => useMapVersions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.versions).toEqual([]);
    expect(result.current.error).toBe('mapversions timed out');
  });

  it('refresh() re-fetches on demand (e.g. after a save mints a new version)', async () => {
    const request = vi.fn(() => Promise.resolve({json: JSON.stringify([{id: 1, created_at: 1, is_current: true}])}));
    mockMower(request);

    const {result} = renderHook(() => useMapVersions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(request).toHaveBeenCalledTimes(2);
  });
});
