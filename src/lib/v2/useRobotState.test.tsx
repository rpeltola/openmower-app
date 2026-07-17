import {renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

// Fakes the mowersStore selector (same pattern as useCommand.test.tsx) so useRobotState /
// useRobotStateSnapshot are exercised against a controllable `Mower.state` shape without a real
// MQTT-backed store.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

import {useSelectedMower} from '@/stores/mowersStore';
import {useRobotState} from '@/lib/v2/useRobotState';

function mockMowerState(state: Record<string, unknown>) {
  const fakeMower = {state};
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
}

// W9 B5: useRobotState is now THE consolidated display hook -- it must render the canonical
// `state` field the instant a gateway sends one, not just fall back to the legacy `current_state`
// mapping (which has no PLANNING_MISSION/RECOVERING/READY/ERROR equivalent at all).
describe('useRobotState (W9 B5 display-hook consolidation)', () => {
  it('renders PLANNING_MISSION from the canonical `state` field -- the dead-Mow-button fix', () => {
    mockMowerState({
      state: 'PLANNING_MISSION',
      current_state: 'IDLE',
      is_charging: false,
      state_detail: {progress: 40, phase: 'Planning coverage'},
      battery_percentage: 80,
    });
    const {result} = renderHook(() => useRobotState());
    expect(result.current.state).toBe('PLANNING_MISSION');
    expect(result.current.isPlanning).toBe(true);
    expect(result.current.isMowing).toBe(false);
    expect(result.current.coveragePct).toBe(40);
    expect(result.current.stateDetail?.phase).toBe('Planning coverage');
  });

  it('renders RECOVERING from the canonical field (no legacy equivalent exists)', () => {
    mockMowerState({state: 'RECOVERING', current_state: 'MOWING', is_charging: false});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.state).toBe('RECOVERING');
  });

  it('renders READY from the canonical field (no legacy equivalent exists)', () => {
    mockMowerState({state: 'READY', current_state: 'IDLE', is_charging: false});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.state).toBe('READY');
  });

  it('renders ERROR from the canonical field (no legacy equivalent exists)', () => {
    mockMowerState({state: 'ERROR', current_state: 'IDLE', is_charging: false});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.state).toBe('ERROR');
  });

  it('falls back to the legacy current_state+is_charging mapping when the gateway sends no canonical `state` (R3/R6)', () => {
    mockMowerState({state: undefined, current_state: 'DOCKED', is_charging: true});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.state).toBe('DOCKED_CHARGING');
    expect(result.current.isCharging).toBe(true);
  });

  it('an unrecognized/newer `state` string also falls back to the legacy mapping rather than rendering raw', () => {
    mockMowerState({state: 'SOME_FUTURE_STATE', current_state: 'MOWING', is_charging: false});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.state).toBe('MOWING');
  });

  it('coveragePct is defined while PAUSED mid-mow (isOnLawn), not just while MOWING', () => {
    mockMowerState({state: 'PAUSED', current_state: 'PAUSED', is_charging: false, state_detail: {progress: 55}});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.isPaused).toBe(true);
    expect(result.current.coveragePct).toBe(55);
  });

  it('coveragePct is undefined while docked/idle -- never a stale or fabricated number', () => {
    mockMowerState({state: 'DOCKED', current_state: 'DOCKED', is_charging: false});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.coveragePct).toBeUndefined();
  });

  it('coveragePct falls back to the legacy 0-1 current_action_progress when state_detail is absent', () => {
    mockMowerState({state: 'MOWING', current_state: 'MOWING', is_charging: false, current_action_progress: 0.62});
    const {result} = renderHook(() => useRobotState());
    expect(result.current.coveragePct).toBe(62);
  });
});
