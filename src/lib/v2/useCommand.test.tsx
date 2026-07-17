import type {CommandResponse} from '@/lib/commandClient';
import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Fakes the MQTT-backed transport (Mower.commandClient, see lib/commandClient.ts) so useCommand
// is exercised against a controllable ack/nack/timeout without a real broker (W9 §0.9 / R7).
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

import {useSelectedMower} from '@/stores/mowersStore';
import {useCommand} from '@/lib/v2/useCommand';

function mockMowerSend(send: (...args: never[]) => Promise<CommandResponse>) {
  const fakeMower = {commandClient: {send}};
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
}

describe('useCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ack: clears pending and resolves accepted (optimistic pending reconciled)', async () => {
    mockMowerSend(() => Promise.resolve({accepted: true, state: 'MOWING'}));
    const {result} = renderHook(() => useCommand());

    let runPromise: ReturnType<typeof result.current.run>;
    act(() => {
      runPromise = result.current.run('mow');
    });
    // The synchronous part of run() (before its first await) has committed by the time this
    // sync act() call returns -- the optimistic pending affordance is up.
    expect(result.current.pending).toBe('mow');

    let response: {accepted: boolean; reason?: string} | undefined;
    await act(async () => {
      response = await runPromise;
    });

    expect(response).toEqual({accepted: true, reason: undefined});
    expect(result.current.pending).toBeNull();
    expect(result.current.provisional).toBeNull();
  });

  it('nack: reverts pending and surfaces the reject_code', async () => {
    mockMowerSend(() => Promise.resolve({accepted: false, reject_code: 'NO_GPS_FIX', state: 'IDLE'}));
    const {result} = renderHook(() => useCommand());

    let response: {accepted: boolean; reason?: string} | undefined;
    await act(async () => {
      response = await result.current.run('mow');
    });

    expect(response).toEqual({accepted: false, reason: 'NO_GPS_FIX'});
    expect(result.current.pending).toBeNull();
  });

  it('timeout: sets a provisional badge (not a nack) and retry re-sends the same command', async () => {
    vi.useFakeTimers();
    const send = vi.fn(() => new Promise<CommandResponse>(() => {})); // never acks
    mockMowerSend(send as unknown as (...args: never[]) => Promise<CommandResponse>);

    const {result} = renderHook(() => useCommand());

    act(() => {
      void result.current.run('dock');
    });

    expect(result.current.pending).toBe('dock');
    expect(result.current.provisional).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(result.current.provisional).toBe('dock');

    act(() => {
      result.current.retry();
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(result.current.pending).toBe('dock');
  });
});
