import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

// Manual control's drive publish (`teleop{vx,vz}`) and Dock/Stop now go through the real store
// (W9 A2b) -- fake the mowersStore so `Mower.publishTeleop` and `commandClient.send` are
// controllable and assert the wiring, not the whole gamepad/viewport surface. `useMowersStore` is
// mocked as BOTH a callable hook (the header's real battery/Connected chips now read it via
// useConnectionStatus/useRobotState) and a `.getState()` vanilla-store escape hatch (useTeleop.ts
// reads it that way, not as a hook subscription).
vi.mock('@/stores/mowersStore', () => {
  const useMowersStoreMock = ((selector?: (s: unknown) => unknown) =>
    selector?.({mowers: [], selected: 0, mqttStatuses: {}, reconnectNow: vi.fn()})) as typeof import('@/stores/mowersStore').useMowersStore;
  useMowersStoreMock.getState = vi.fn();
  return {
    useSelectedMower: vi.fn(),
    useMowersStore: useMowersStoreMock,
  };
});

// jsdom doesn't implement matchMedia -- ManualControl's landscape-cockpit/desktop-width
// detection (useMediaQuery/useBreakpoint) calls it unconditionally on every render, unlike
// Map.tsx/AppShell (which don't use it), so this suite needs its own stub.
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

import {directionToVelocity, ManualControl, vectorToVelocity} from '@/components/v2/ManualControl';
import {setShowUnsupportedFeatures} from '@/lib/v2/featureSupport';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';

function mockMower(send: (...args: never[]) => Promise<{accepted: boolean; reject_code?: string; state?: string}>) {
  const publishTeleop = vi.fn();
  const fakeMower = {
    state: {commands: {stop: {allowed: true, reasons: []}, dock: {allowed: true, reasons: []}}},
    commandClient: {send},
    publishTeleop,
  };
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
  vi.mocked(useMowersStore.getState).mockReturnValue({mowers: [fakeMower], selected: 0} as never);
  return {publishTeleop};
}

describe('ManualControl (W9 A2b)', () => {
  afterEach(cleanup);

  it('Stop goes through the real command client, not fire-and-forget', async () => {
    const send = vi.fn(() => Promise.resolve({accepted: true, state: 'IDLE'}));
    mockMower(send);
    render(<ManualControl />);

    screen.getAllByRole('button', {name: 'Stop'})[0].click();

    await waitFor(() => expect(send).toHaveBeenCalledWith('stop', undefined));
  });

  it('Dock goes through the real command client and toasts the reject reason on a nack', async () => {
    const send = vi.fn(() => Promise.resolve({accepted: false, reject_code: 'NO_GPS_FIX', state: 'IDLE'}));
    mockMower(send);
    render(<ManualControl />);

    screen.getAllByRole('button', {name: 'Dock'})[0].click();

    await waitFor(() => expect(send).toHaveBeenCalledWith('dock', undefined));
    await waitFor(() => expect(screen.getByText('Waiting for GPS fix')).toBeInTheDocument());
  });

  it('mounts cleanly and zeros teleop out via useTeleop unmount cleanup', async () => {
    const {publishTeleop} = mockMower(() => Promise.resolve({accepted: true}));
    const {unmount} = render(<ManualControl />);
    unmount();
    // useTeleop's cleanup effect always re-publishes the zeroed velocity on unmount (see
    // hooks/useTeleop.ts) -- a safety net so a torn-down control never leaves the mower driving.
    await waitFor(() => expect(publishTeleop).toHaveBeenCalledWith(0, 0));
  });
});

// R1 gate audit (W9): the RTK/position-trust chip is mock (hardcoded "RTK fixed" with no real
// GPS-fix source) -- must stay behind the `positionTrust` L3 gate, same contract every other
// unbacked control in the app now follows (FeatureGate.test.tsx covers the mechanism itself).
describe('ManualControl — positionTrust gate (R1)', () => {
  afterEach(() => {
    cleanup();
    setShowUnsupportedFeatures(false);
  });

  it('hides the RTK chip by default (dev toggle off)', () => {
    mockMower(() => Promise.resolve({accepted: true}));
    render(<ManualControl />);
    expect(screen.queryByText(/RTK fixed/)).not.toBeInTheDocument();
  });

  it('reveals the RTK chip greyed + tagged once the dev toggle is on', () => {
    setShowUnsupportedFeatures(true);
    mockMower(() => Promise.resolve({accepted: true}));
    render(<ManualControl />);
    expect(screen.getByText(/RTK fixed/)).toBeInTheDocument();
    expect(screen.getAllByText("Not supported by your mower's software yet").length).toBeGreaterThan(0);
  });
});

// The drive-command math itself (D-pad direction / analog stick vector -> vx,vz) -- HoldToUnlock's
// gesture (press-and-hold on desktop, slide on mobile) isn't practical to drive headlessly, so
// this is tested directly rather than through the full unlock -> drive UI flow.
describe('directionToVelocity / vectorToVelocity (drive-command math)', () => {
  it('maps d-pad directions to vx/vz at full ("fast") factor, capped at VirtualJoystick\'s proven max', () => {
    expect(directionToVelocity('up', 1)).toEqual({vx: 0.35, vz: 0});
    expect(directionToVelocity('down', 1)).toEqual({vx: -0.35, vz: 0});
    expect(directionToVelocity('left', 1)).toEqual({vx: 0, vz: 1.6});
    expect(directionToVelocity('right', 1)).toEqual({vx: 0, vz: -1.6});
    expect(directionToVelocity(null, 1)).toEqual({vx: 0, vz: 0});
  });

  it('scales down for the Slow speed factor', () => {
    const {vx, vz} = directionToVelocity('up', 0.4);
    expect(vx).toBeCloseTo(0.14, 10);
    expect(vz).toBe(0);
  });

  it('maps an analog stick vector (screen-space y, down=positive) to forward/turn velocity', () => {
    // Full deflection "up" (negative y) -> max forward, no turn.
    expect(vectorToVelocity({x: 0, y: -1}, 1)).toEqual({vx: 0.35, vz: -0});
    // Full deflection right (positive x) -> turn right (negative vz), no forward.
    expect(vectorToVelocity({x: 1, y: 0}, 1)).toEqual({vx: -0, vz: -1.6});
    expect(vectorToVelocity(null, 1)).toEqual({vx: 0, vz: 0});
  });
});
