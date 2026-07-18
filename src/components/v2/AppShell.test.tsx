import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// AppShell pulls in next/navigation (usePathname directly, useRouter via MowerSelector) and the
// mowersStore (useSelectedMower for state, useMowersStore via useConnectionStatus) -- fake both so
// the routing logic (BOOTING/PAUSED/ERROR full-screen vs. normal chrome) is exercised without a
// real app-router context or MQTT-backed store.
vi.mock('next/navigation', () => ({
  usePathname: () => '/v2',
  useRouter: () => ({push: vi.fn()}),
}));

vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
  useMowersStore: vi.fn(),
}));

import {AppShell} from '@/components/v2/AppShell';
import {setShowUnsupportedFeatures} from '@/lib/v2/featureSupport';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';

function mockMowerState(state: Record<string, unknown>) {
  const fakeMower = {state};
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
  // useConnectionStatus reads `s.mowers[s.selected]`/`s.mqttStatuses`/`s.reconnectNow` off this
  // same store -- an empty roster resolves to 'connecting', which ConnectionBanner renders as
  // nothing (COPY has no 'connecting' row), so it never interferes with the assertions below.
  // MowerSelector also reads `s.mowers` as an array (real store shape) for its own roster list.
  vi.mocked(useMowersStore).mockImplementation(
    ((selector?: (s: unknown) => unknown) =>
      selector?.({mowers: [], selected: 0, mqttStatuses: {}, reconnectNow: vi.fn()})) as typeof useMowersStore,
  );
}

describe('AppShell state routing (W9 A2a)', () => {
  afterEach(cleanup);

  it('BOOTING renders the live BootingScreen full-screen, hiding both nav chrome and route content', () => {
    mockMowerState({state: 'BOOTING', current_state: 'UNKNOWN', is_charging: false});
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.getByText('Starting up')).toBeInTheDocument();
    expect(screen.queryByText('route content')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument();
  });

  it('ERROR renders a blocking ErrorScreen with the error code, hiding nav chrome and route content', () => {
    mockMowerState({state: 'ERROR', current_state: 'UNKNOWN', is_charging: false, error: {code: 'ESC_ERROR'}});
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('ESC_ERROR')).toBeInTheDocument();
    expect(screen.queryByText('route content')).not.toBeInTheDocument();
  });

  it('PAUSED surfaces a dismissible amber banner for a warn-tier reason, alongside the normal chrome', () => {
    mockMowerState({state: 'PAUSED', current_state: 'PAUSED', is_charging: false, paused_reasons: ['GPS_LOSS']});
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.getByText('route content')).toBeInTheDocument();
    expect(screen.getByText('Waiting for GPS fix')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Dismiss'})).toBeInTheDocument();
  });

  it('PAUSED with an EMERGENCY reason renders a red-blocking banner with no dismiss affordance', () => {
    mockMowerState({
      state: 'PAUSED',
      current_state: 'PAUSED',
      is_charging: false,
      paused_reasons: ['EMERGENCY', 'GPS_LOSS'],
    });
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.getByText('Emergency stop · Waiting for GPS fix')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Dismiss'})).not.toBeInTheDocument();
  });

  it('a normal state (e.g. IDLE) renders the full nav chrome and route content, no banner', () => {
    mockMowerState({state: 'IDLE', current_state: 'IDLE', is_charging: false});
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.getByText('route content')).toBeInTheDocument();
    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// R1 gate audit (W9): Schedule is 100% mock (no backend) -- its nav entry (not just the screen
// behind it) must be gated, so the dev toggle is the only way to even see a path to it.
describe('AppShell nav — schedules gate (R1)', () => {
  afterEach(() => {
    cleanup();
    setShowUnsupportedFeatures(false);
  });

  it('hides the Schedule nav entry by default (dev toggle off)', () => {
    setShowUnsupportedFeatures(false);
    mockMowerState({state: 'IDLE', current_state: 'IDLE', is_charging: false});
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
  });

  it('reveals the Schedule nav entry greyed + tagged once the dev toggle is on', () => {
    setShowUnsupportedFeatures(true);
    mockMowerState({state: 'IDLE', current_state: 'IDLE', is_charging: false});
    render(
      <AppShell>
        <div>route content</div>
      </AppShell>,
    );
    expect(screen.getAllByText('Schedule').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not supported by your mower's software yet").length).toBeGreaterThan(0);
  });
});
